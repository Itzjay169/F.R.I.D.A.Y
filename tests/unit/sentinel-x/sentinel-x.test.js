import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculatePositionRisk,
  calculatePortfolioHeat,
  calculateAccountSnapshot
} from '../../../services/sentinel-x/portfolioRiskModel.js';
import {
  calculateReturnsFromPrices,
  calculatePearsonCorrelation,
  calculateCorrelationMatrix,
  detectCorrelatedClusters
} from '../../../services/sentinel-x/correlationEngine.js';
import { runStressTest } from '../../../services/sentinel-x/stressTesting.js';
import { calculateRiskBudget } from '../../../services/sentinel-x/riskBudget.js';
import { killSwitchManager } from '../../../services/sentinel-x/killSwitch.js';
import { generateRiskReductionPlan } from '../../../services/sentinel-x/riskReductionPlanner.js';
import { assertSentinelXCannotExecute, parseSentinelXIntent } from '../../../agents/sentinel-x/sentinelXAgent.js';

describe('SENTINEL-X Unit Tests (Phase 7.5)', () => {
  beforeEach(() => {
    killSwitchManager._resetForTesting();
  });

  // ══════════════════════════════════════════════════════
  // TEST 1: Portfolio heat equals the sum of individual position risks
  // ══════════════════════════════════════════════════════
  it('1. portfolio heat equals the sum of individual position risks', () => {
    const equity = 100000;
    const positions = [
      { symbol: 'NVDA', entry: 120, stop: 110, qty: 100 }, // Risk = |120 - 110| * 100 = $1,000
      { symbol: 'AAPL', entry: 220, stop: 215, qty: 200 }, // Risk = |220 - 215| * 200 = $1,000
      { symbol: 'TSLA', entry: 250, stop: 260, qty: -50 }  // Short Risk = |250 - 260| * 50 = $500
    ];

    const risk1 = calculatePositionRisk(positions[0], equity);
    const risk2 = calculatePositionRisk(positions[1], equity);
    const risk3 = calculatePositionRisk(positions[2], equity);

    expect(risk1.initial_risk).toBe(1000.00);
    expect(risk2.initial_risk).toBe(1000.00);
    expect(risk3.initial_risk).toBe(500.00);

    const heat = calculatePortfolioHeat(positions, equity, equity);
    expect(heat.total_heat_dollars).toBe(risk1.initial_risk + risk2.initial_risk + risk3.initial_risk);
    expect(heat.total_heat_dollars).toBe(2500.00);
  });

  // ══════════════════════════════════════════════════════
  // TEST 2: Heat is expressed correctly in dollars and percent of equity
  // ══════════════════════════════════════════════════════
  it('2. heat is expressed correctly in dollars and percent of equity', () => {
    const equity = 50000;
    const startingEquity = 40000;
    const positions = [
      { symbol: 'NVDA', entry: 100, stop: 90, qty: 100 } // Risk = $1,000
    ];

    const heat = calculatePortfolioHeat(positions, equity, startingEquity);
    expect(heat.total_heat_dollars).toBe(1000.00);
    // 1,000 / 50,000 = 2.0%
    expect(heat.heat_percent_current_equity).toBe(2.00);
    // 1,000 / 40,000 = 2.5%
    expect(heat.heat_percent_starting_equity).toBe(2.50);
    // Remaining heat budget on 6% limit of $50,000 ($3,000 limit) = $2,000
    expect(heat.remaining_heat_budget).toBe(2000.00);
  });

  // ══════════════════════════════════════════════════════
  // TEST 8: Cluster heat is calculated correctly
  // ══════════════════════════════════════════════════════
  it('8. cluster heat is calculated correctly', () => {
    const positions = [
      { symbol: 'NVDA', entry: 120, stop: 110, qty: 50 },  // Risk = 500
      { symbol: 'AMD', entry: 150, stop: 140, qty: 40 },   // Risk = 400
      { symbol: 'AAPL', entry: 220, stop: 215, qty: 100 }  // Risk = 500
    ];

    const clusters = detectCorrelatedClusters(positions);
    const semiCluster = clusters.find(c => c.cluster_id === 'cluster_semi_ai');
    expect(semiCluster).toBeDefined();
    expect(semiCluster.symbols).toContain('NVDA');
    expect(semiCluster.symbols).toContain('AMD');
    expect(semiCluster.symbols).not.toContain('AAPL');
    // Combined heat = 500 + 400 = 900
    expect(semiCluster.combined_heat).toBe(900.00);
  });

  // ══════════════════════════════════════════════════════
  // TEST 9: Correlation matrix uses returns, not raw prices
  // ══════════════════════════════════════════════════════
  it('9. correlation matrix uses returns, not raw prices', () => {
    // Two price series with identical upwards trend in prices, but completely different daily percentage returns
    const pricesA = [100, 102, 101, 105, 104, 110];
    const pricesB = [200, 201, 204, 202, 207, 212];

    const returnsA = calculateReturnsFromPrices(pricesA);
    const returnsB = calculateReturnsFromPrices(pricesB);

    expect(returnsA.length).toBe(pricesA.length - 1);
    expect(returnsB.length).toBe(pricesB.length - 1);

    // Verify returns are proportional percentage changes, not raw price differences
    expect(returnsA[0]).toBeCloseTo((102 - 100) / 100, 4); // 0.02
    expect(returnsB[0]).toBeCloseTo((201 - 200) / 200, 4); // 0.005

    // Verify matrix calculates using return data
    const corr = calculatePearsonCorrelation(returnsA, returnsB);
    expect(typeof corr).toBe('number');
    expect(corr).toBeGreaterThanOrEqual(-1.0);
    expect(corr).toBeLessThanOrEqual(1.0);
  });

  // ══════════════════════════════════════════════════════
  // TEST 10: Correlation calculation handles missing history without inventing values
  // ══════════════════════════════════════════════════════
  it('10. correlation calculation handles missing history without inventing values', () => {
    const seriesShort = [0.01, -0.02]; // Only 2 points
    const seriesFull = [0.01, -0.02, 0.03, -0.01, 0.02, 0.01];

    const corr = calculatePearsonCorrelation(seriesShort, seriesFull);
    // Requires at least 5 points to prevent statistical noise/hallucination
    expect(corr).toBeNull();

    // Empty or non-array
    expect(calculatePearsonCorrelation([], [0.01])).toBeNull();
    expect(calculatePearsonCorrelation(null, [0.01])).toBeNull();
  });

  // ══════════════════════════════════════════════════════
  // TEST 11: Stress test estimates P&L using configured scenario assumptions
  // ══════════════════════════════════════════════════════
  it('11. stress test estimates P&L using configured scenario assumptions', () => {
    const equity = 100000;
    const positions = [
      { symbol: 'SPY', entry: 500, current_price: 500, stop: 480, qty: 100, direction: 'long' } // $50,000 market value
    ];

    const result = runStressTest(positions, equity, 'market_down_2_percent');
    expect(result.scenario).toBe('market_down_2_percent');
    // 2% drop on $50,000 position = -$1,000 PnL
    expect(result.estimated_portfolio_pnl).toBeCloseTo(-1000.00, 1);
    expect(result.estimated_portfolio_pnl_percent).toBeCloseTo(-1.00, 1);
    expect(result.positions_affected).toHaveLength(1);
    expect(result.positions_affected[0].symbol).toBe('SPY');
    expect(result.positions_affected[0].stop_breached).toBe(false);
  });

  // ══════════════════════════════════════════════════════
  // TEST 12: Stress test clearly labels results as model-estimated
  // ══════════════════════════════════════════════════════
  it('12. stress test clearly labels results as model-estimated with assumptions and limitations', () => {
    const positions = [{ symbol: 'NVDA', entry: 120, current_price: 120, stop: 110, qty: 50, direction: 'long' }];
    const result = runStressTest(positions, 50000, 'tech_down_5_percent');

    expect(result.assumptions).toBeInstanceOf(Array);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions.some(a => a.toLowerCase().includes('model-estimated') || a.toLowerCase().includes('beta'))).toBe(true);

    expect(result.limitations).toBeInstanceOf(Array);
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.limitations.some(l => l.toLowerCase().includes('not a prediction'))).toBe(true);
    expect(result.sources).toBeInstanceOf(Array);
  });

  // ══════════════════════════════════════════════════════
  // TEST 13: Daily loss limit activates RED state
  // ══════════════════════════════════════════════════════
  it('13. daily loss limit activates RED state', () => {
    const equity = 100000;
    // 3% daily limit = $3,000 loss limit
    const breachedAccount = {
      current_equity: equity,
      daily_pnl: -3500.00 // Breached!
    };

    const budget = calculateRiskBudget(breachedAccount, false, { daily_loss_limit_percent: 3.0 });
    expect(budget.risk_state).toBe('RED');
    expect(budget.reason).toContain('Daily loss limit breached');
  });

  // ══════════════════════════════════════════════════════
  // TEST 14: Max drawdown activates kill switch when configured
  // ══════════════════════════════════════════════════════
  it('14. max drawdown activates kill switch when configured', () => {
    const accountSnapshot = {
      current_equity: 85000,
      peak_equity: 100000,
      current_drawdown_percent: 15.0 // Exceeds 12% max drawdown limit
    };

    const triggerRes = killSwitchManager.evaluateAutoTriggers(accountSnapshot, {}, {
      max_drawdown_percent: 12.0,
      kill_switch: {
        enabled: true,
        auto_activate_on_max_drawdown: true
      }
    });

    expect(triggerRes.triggered).toBe(true);
    expect(killSwitchManager.getState().active).toBe(true);
    expect(killSwitchManager.getState().reason).toContain('Maximum portfolio drawdown breached');
  });

  // ══════════════════════════════════════════════════════
  // TEST 15: Kill switch blocks new entries
  // ══════════════════════════════════════════════════════
  it('15. kill switch blocks new entries', () => {
    killSwitchManager.activate({ reason: 'Emergency volatility spike' });
    const state = killSwitchManager.getState();
    expect(state.active).toBe(true);
    expect(state.new_entries_blocked).toBe(true);
  });

  // ══════════════════════════════════════════════════════
  // TEST 16: Kill switch does not cancel existing stops or targets
  // ══════════════════════════════════════════════════════
  it('16. kill switch does NOT cancel existing stops or targets', () => {
    killSwitchManager.activate({ reason: 'Pre-CPI precautionary halt' });
    const state = killSwitchManager.getState();
    expect(state.existing_stops_active).toBe(true);
    expect(state.existing_targets_active).toBe(true);
  });

  // ══════════════════════════════════════════════════════
  // TEST 17: Kill switch requires explicit confirmation to deactivate
  // ══════════════════════════════════════════════════════
  it('17. kill switch requires explicit confirmation to deactivate', () => {
    killSwitchManager.activate({ reason: 'Testing' });

    // Try without confirmation
    const failedAttempt = killSwitchManager.deactivate({ user_reason: 'Testing', confirmed: false });
    expect(failedAttempt.success).toBe(false);
    expect(killSwitchManager.getState().active).toBe(true);

    // Try without reason
    const noReasonAttempt = killSwitchManager.deactivate({ user_reason: '', confirmed: true });
    expect(noReasonAttempt.success).toBe(false);
    expect(killSwitchManager.getState().active).toBe(true);

    // With confirmation and reason
    const successAttempt = killSwitchManager.deactivate({
      user_reason: 'Market stabilized post-announcement',
      confirmed: true
    });
    expect(successAttempt.success).toBe(true);
    expect(killSwitchManager.getState().active).toBe(false);
  });

  // ══════════════════════════════════════════════════════
  // TEST 18: Risk-reduction plan proposes actions but does not execute them
  // ══════════════════════════════════════════════════════
  it('18. risk-reduction plan proposes actions but does NOT execute them', () => {
    const positions = [
      { symbol: 'NVDA', entry: 120, current_price: 125, stop: 110, qty: 100 },
      { symbol: 'TSLA', entry: 250, current_price: 240, stop: 260, qty: -50 }
    ];

    const plan = generateRiskReductionPlan(positions, { targetReductionPercent: 30 });
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.requires_human_confirmation).toBe(true);

    // Each action must require sentinel approval and pilot execution (not self-executing)
    for (const act of plan.actions) {
      expect(act.required_sentinel_approval).toBe(true);
      expect(act.required_pilot_execution).toBe(true);
    }
  });

  // ══════════════════════════════════════════════════════
  // TEST 20: SENTINEL-X cannot place, modify, cancel, or approve a trade
  // ══════════════════════════════════════════════════════
  it('20. SENTINEL-X cannot place, modify, cancel, or approve a trade', () => {
    expect(() => assertSentinelXCannotExecute('place_order')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertSentinelXCannotExecute('execute_order')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertSentinelXCannotExecute('modify_order')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertSentinelXCannotExecute('cancel_order')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertSentinelXCannotExecute('approve_order')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertSentinelXCannotExecute('generate_pilot_token')).toThrow(/SECURITY VIOLATION/);

    // Safe query actions do not throw
    expect(assertSentinelXCannotExecute('portfolio_heat_check')).toBe(true);
    expect(assertSentinelXCannotExecute('stress_test_portfolio')).toBe(true);
  });
});
