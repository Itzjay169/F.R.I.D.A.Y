import { describe, it, expect, beforeEach } from 'vitest';
import {
  routeChartCommand,
  parseNaturalChartCommand,
  assertAgentAuthority,
  getChartCapabilities
} from '../services/chart/chartRouter.js';

import {
  createTradeOverlay,
  updateTradeOverlay,
  removeTradeOverlay,
  getOverlaysForSymbol,
  addStructureDrawing,
  getStructureDrawingsForSymbol,
  clearAgentDrawings,
  resetOverlayStore
} from '../services/chart/chartTradeOverlay.js';

describe('Phase 8: TradingView Chart Router & Agent Permissions', () => {
  beforeEach(() => {
    resetOverlayStore();
  });

  // 1. Symbol, Timeframe, Chart Type
  it('handles symbol, timeframe, and chart type changes', async () => {
    const symRes = await routeChartCommand({ intent: 'change_symbol', payload: { symbol: 'NVDA' } });
    expect(symRes.symbol).toBe('NVDA');
    expect(symRes.status).toBe('SUCCESS');

    const tfRes = await routeChartCommand({ intent: 'change_timeframe', payload: { interval: '5' } });
    expect(tfRes.interval).toBe('5');
    expect(tfRes.status).toBe('SUCCESS');

    const styleRes = await routeChartCommand({ intent: 'change_chart_type', payload: { style: '8' } });
    expect(styleRes.style).toBe('8');
    expect(styleRes.styleName).toBe('Heikin Ashi');
  });

  // 2. Indicators: Add, Remove, Configure
  it('handles indicator lifecycle: add, configure, and remove', async () => {
    const addRes = await routeChartCommand({ intent: 'add_indicator', payload: { indicator: 'VWAP' } });
    expect(addRes.indicator).toBe('VWAP');

    const cfgRes = await routeChartCommand({ intent: 'configure_indicator', payload: { indicator: 'RSI', params: { length: 14 } } });
    expect(cfgRes.params.length).toBe(14);

    const rmRes = await routeChartCommand({ intent: 'remove_indicator', payload: { indicator: 'MACD' } });
    expect(rmRes.indicator).toBe('MACD');
  });

  // 3. Technical Drawings: Level, Zone, Trendline, Fibonacci
  it('plots technical drawings and stores them in structure drawings', async () => {
    // Level
    const lvlRes = await routeChartCommand({
      intent: 'draw_level',
      payload: { symbol: 'NVDA', price: 115.50, label: 'KEY SUPPORT' },
      agent: 'CHARTIST'
    });
    expect(lvlRes.drawing.data.price).toBe(115.50);

    // Zone
    const zoneRes = await routeChartCommand({
      intent: 'draw_zone',
      payload: { symbol: 'NVDA', low: 120.00, high: 125.00, label: 'DAILY SUPPLY' },
      agent: 'ATHENA'
    });
    expect(zoneRes.drawing.data.low).toBe(120.00);
    expect(zoneRes.drawing.data.high).toBe(125.00);

    // Fibonacci Retracement
    const fibRes = await routeChartCommand({
      intent: 'draw_fibonacci',
      payload: { symbol: 'NVDA', swingLow: 100.00, swingHigh: 150.00 },
      agent: 'CHARTIST'
    });
    expect(fibRes.levels).toHaveLength(7);
    const goldenPocket = fibRes.levels.find(l => l.ratio === '0.618');
    expect(goldenPocket.price).toBe(119.10);

    const stored = getStructureDrawingsForSymbol('NVDA');
    expect(stored).toHaveLength(3);
  });

  // 4. Trade-Aware Overlay Synchronization: Zero Orphaned Lines
  it('creates entry/stop/target drawings for filled paper trades and removes them when closed', async () => {
    const trade = {
      tradeId: 'TRD-NVDA-TEST-1',
      symbol: 'NVDA',
      side: 'BUY',
      shares: 50,
      price: 142.30,
      stopLoss: 139.00,
      takeProfit: 150.00,
      token: 'SIG_SENTINEL_APPROVED'
    };

    // Mirror paper trade
    const mirrorRes = await routeChartCommand({
      intent: 'mirror_paper_trade',
      payload: trade,
      agent: 'PILOT'
    });

    expect(mirrorRes.overlay.status).toBe('OPEN');
    expect(mirrorRes.overlay.drawing_ids).toHaveLength(5);
    expect(mirrorRes.overlay.drawings.tradeLabel.text).toContain('PAPER LONG 50 NVDA @ 142.30');

    // Retrieve active overlays
    const active = getOverlaysForSymbol('NVDA');
    expect(active).toHaveLength(1);
    expect(active[0].drawing_ids).toHaveLength(5);

    // Update trade (e.g. adjust stop loss)
    const updated = updateTradeOverlay('TRD-NVDA-TEST-1', { stopLoss: 140.50 });
    expect(updated.stop).toBe(140.50);
    expect(updated.drawings.stopLine.price).toBe(140.50);

    // Close position: guarantees drawings are detached and no orphaned lines remain
    const closeRes = removeTradeOverlay('TRD-NVDA-TEST-1', 'CLOSED');
    expect(closeRes.detachedDrawingIds).toHaveLength(5);

    const afterClose = getOverlaysForSymbol('NVDA');
    expect(afterClose).toHaveLength(0); // Zero orphaned overlays for active chart
  });

  // 5. Preserving Manual Drawings when Clearing Agent Drawings
  it('clears agent drawings while strictly preserving manual drawings', () => {
    addStructureDrawing({ symbol: 'NVDA', agent: 'ATHENA', type: 'zone', data: { low: 100, high: 110 } });
    addStructureDrawing({ symbol: 'NVDA', agent: 'CHARTIST', type: 'level', data: { price: 125 } });

    expect(getStructureDrawingsForSymbol('NVDA')).toHaveLength(2);

    const clearRes = clearAgentDrawings('NVDA');
    expect(clearRes.cleared).toBe(2);
    expect(clearRes.preservedManual).toBe('ALL_MANUAL_DRAWINGS_PRESERVED');
    expect(getStructureDrawingsForSymbol('NVDA')).toHaveLength(0);
  });

  // 6. Security & Authorization Gate
  it('strictly blocks analysis agents from authorizing or mirroring paper trades', async () => {
    const analysisAgents = ['ATHENA', 'CHARTIST', 'ORACLE', 'ATLAS', 'SCOUT', 'CAPITOL'];

    for (const agent of analysisAgents) {
      await expect(
        routeChartCommand({
          intent: 'mirror_paper_trade',
          payload: { symbol: 'NVDA', shares: 10, price: 100, token: 'SIG_MOCK' },
          agent
        })
      ).rejects.toThrow(/SECURITY VETO/);
    }
  });

  // 7. Oracle Forecast Honesty Enforcement
  it('enforces "model-estimated, not a prediction" label on Oracle forecast bands', async () => {
    const res = await routeChartCommand({
      intent: 'add_text_label',
      payload: { symbol: 'NVDA', text: 'Bullish breakout probability 68%', price: 120 },
      agent: 'ORACLE'
    });

    expect(res.drawing.label).toContain('model-estimated, not a prediction');
  });

  // 8. Machine-Readable Capabilities Map & Honesty Disclosures
  it('exports accurate capability map disclosing unsupported TV features honestly', () => {
    const caps = getChartCapabilities();
    expect(caps.capabilities.symbol_control.status).toBe('ONLINE');
    expect(caps.capabilities.drawings.status).toBe('ONLINE');
    expect(caps.capabilities.paper_order_mirroring.status).toBe('ONLINE');

    // Disclosed honesty fallbacks
    expect(caps.capabilities.replay.status).toBe('SIMULATED_FALLBACK');
    expect(caps.capabilities.replay.limitation).toBeDefined();

    expect(caps.capabilities.pine_script.status).toBe('UNSUPPORTED_DISCLOSED');
    expect(caps.capabilities.pine_script.limitation).toBeDefined();

    expect(caps.capabilities.paper_order_mirroring.warning).toContain('strict source of truth');
  });

  // 9. Natural Voice/Text Intent Parsing
  it('correctly maps natural voice commands to structured chart actions', () => {
    // "Pull up NVDA and mark the levels"
    const p1 = parseNaturalChartCommand('Pull up NVDA and mark the levels', 'SPY', { price: 120 });
    expect(p1.type).toBe('COMPOSITE_CHART_ANALYSIS');
    expect(p1.symbol).toBe('NVDA');
    expect(p1.actions.length).toBeGreaterThanOrEqual(4);

    // "Add VWAP and volume profile to NVDA"
    const p2 = parseNaturalChartCommand('Add VWAP and volume profile to NVDA', 'NVDA', { price: 120 });
    expect(p2.type).toBe('ADD_INDICATORS');
    expect(p2.actions.some(a => a.payload.indicator === 'VWAP')).toBe(true);

    // "Mark the daily supply zone"
    const p3 = parseNaturalChartCommand('Mark the daily supply zone', 'NVDA', { price: 120 });
    expect(p3.type).toBe('DRAW_ZONE');

    // "Draw a Fibonacci retracement from the last swing low to swing high"
    const p4 = parseNaturalChartCommand('Draw a Fibonacci retracement from the last swing low to swing high', 'NVDA', { price: 120 });
    expect(p4.type).toBe('DRAW_FIBONACCI');

    // "Switch to 5-minute Heikin Ashi"
    const p5 = parseNaturalChartCommand('Switch to 5-minute Heikin Ashi', 'NVDA', { price: 120 });
    expect(p5.type).toBe('CHANGE_CHART_TYPE_AND_TIMEFRAME');
    expect(p5.actions[0].payload.style).toBe('8');
    expect(p5.actions[1].payload.interval).toBe('5');

    // "Start replay from yesterday's open"
    const p6 = parseNaturalChartCommand("Start replay from yesterday's open", 'NVDA', { price: 120 });
    expect(p6.type).toBe('REPLAY_ACTION');
    expect(p6.spokenText).toContain('Notice: TradingView official embed');

    // "Set an alert if NVDA crosses 150"
    const p7 = parseNaturalChartCommand('Set an alert if NVDA crosses 150', 'NVDA', { price: 120 });
    expect(p7.type).toBe('CREATE_ALERT');
    expect(p7.actions[0].payload.price).toBe(150);

    // "Show my open trade levels on the chart"
    const p8 = parseNaturalChartCommand('Show my open trade levels on the chart', 'NVDA', { price: 120 });
    expect(p8.type).toBe('SHOW_TRADE_OVERLAYS');

    // "Clear all F.R.I.D.A.Y. drawings, but keep my manual drawings"
    const p9 = parseNaturalChartCommand('Clear all F.R.I.D.A.Y. drawings, but keep my manual drawings', 'NVDA', { price: 120 });
    expect(p9.type).toBe('CLEAR_AGENT_DRAWINGS');
  });
});
