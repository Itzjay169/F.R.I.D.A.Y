import { DEFAULT_RISK_CONFIG } from '../../shared/config.js';
import { calculatePortfolioHeat, getSymbolMetadata } from './portfolioRiskModel.js';
import { calculateCorrelationMatrix, detectCorrelatedClusters } from './correlationEngine.js';
import { runStressTest } from './stressTesting.js';
import { killSwitchManager } from './killSwitch.js';
import { calculateRiskBudget } from './riskBudget.js';

/**
 * Pretrade Portfolio Check by SENTINEL-X
 * 
 * @param {Object} proposedTrade - Trade proposal with { symbol, direction, entry, stop, quantity, position_size }
 * @param {Array} currentPositions - Existing open paper positions
 * @param {Object} accountState - Account snapshot data
 * @param {Object} [config=DEFAULT_RISK_CONFIG]
 * @returns {Object} PretradePortfolioCheck result conforming to PretradePortfolioCheckSchema
 */
export function pretradePortfolioCheck(proposedTrade, currentPositions = [], accountState = {}, config = DEFAULT_RISK_CONFIG) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
  const currentEquity = Number(accountState.current_equity || accountState.equity || 1604199.00);
  const startingEquity = Number(accountState.starting_equity || accountState.initialEquity || 1604199.00);
  const asOf = new Date().toISOString();
  const sources = [
    'sentinel-x:portfolio-risk-engine',
    'sentinel-x:kill-switch',
    'sentinel-x:correlation-engine',
    'local-ledger:account-snapshot'
  ];

  // 1. Check Kill Switch
  const killSwitchState = killSwitchManager.getState();
  if (killSwitchState.active) {
    return {
      verdict: 'veto',
      portfolio_heat_before: 0,
      portfolio_heat_after: 0,
      heat_limit: cfg.max_portfolio_heat_percent / 100,
      daily_risk_used: 0,
      daily_risk_limit: cfg.daily_loss_limit_percent / 100,
      correlation_warning: null,
      concentration_warning: null,
      stress_note: null,
      required_changes: ['Kill switch must be deactivated before any new positions can be opened.'],
      reason: `VETO: Portfolio Kill Switch is currently ACTIVE (${killSwitchState.reason || 'User activated'}). All new paper entries are blocked.`,
      sources,
      as_of: asOf
    };
  }

  // 2. Open Position Count Check
  if (currentPositions.length >= cfg.max_open_positions) {
    const isExisting = currentPositions.some(p => p.symbol === proposedTrade.symbol);
    if (!isExisting) {
      return {
        verdict: 'veto',
        portfolio_heat_before: 0,
        portfolio_heat_after: 0,
        heat_limit: cfg.max_portfolio_heat_percent / 100,
        daily_risk_used: 0,
        daily_risk_limit: cfg.daily_loss_limit_percent / 100,
        correlation_warning: null,
        concentration_warning: null,
        stress_note: null,
        required_changes: [`Flatten or close at least one position to stay within max positions limit of ${cfg.max_open_positions}.`],
        reason: `VETO: Maximum open positions (${cfg.max_open_positions}) reached. Portfolio capacity full.`,
        sources,
        as_of: asOf
      };
    }
  }

  // 3. Extract proposed trade risk metrics
  const sym = proposedTrade.symbol;
  const entry = Number(proposedTrade.entry?.price || proposedTrade.entry || proposedTrade.price || 0);
  const stop = Number(proposedTrade.stop?.price || proposedTrade.stop || proposedTrade.stopLoss || 0);
  const rawQty = proposedTrade.position_size?.quantity || proposedTrade.quantity || proposedTrade.shares || proposedTrade.qty || 0;
  const qty = Math.abs(rawQty);

  if (!entry || !stop || !qty) {
    return {
      verdict: 'veto',
      portfolio_heat_before: 0,
      portfolio_heat_after: 0,
      heat_limit: cfg.max_portfolio_heat_percent / 100,
      daily_risk_used: 0,
      daily_risk_limit: cfg.daily_loss_limit_percent / 100,
      correlation_warning: null,
      concentration_warning: null,
      stress_note: null,
      required_changes: ['Provide valid entry, stop loss, and position quantity.'],
      reason: 'VETO: Incomplete proposal metrics. Entry, stop loss, and quantity are mandatory for portfolio check.',
      sources,
      as_of: asOf
    };
  }

  const proposedTradeDollarRisk = Math.abs(entry - stop) * qty;
  const proposedTradeHeatPct = (proposedTradeDollarRisk / currentEquity) * 100;

  // 4. Calculate Heat Before and After
  const heatBefore = calculatePortfolioHeat(currentPositions, currentEquity, startingEquity, cfg);
  const heatBeforePct = heatBefore.heat_percent_current_equity / 100;
  const heatAfterDollars = heatBefore.total_heat_dollars + proposedTradeDollarRisk;
  const heatAfterPct = parseFloat(((heatAfterDollars / currentEquity)).toFixed(4));
  const heatLimitFraction = cfg.max_portfolio_heat_percent / 100;

  // 5. Calculate Daily Risk Budget
  const budget = calculateRiskBudget({ ...accountState, current_equity: currentEquity, total_heat_dollars: heatBefore.total_heat_dollars }, false, cfg);
  const dailyRiskUsedFraction = parseFloat(((budget.daily_risk_used / currentEquity)).toFixed(4));
  const dailyRiskLimitFraction = cfg.daily_loss_limit_percent / 100;

  let correlation_warning = null;
  let concentration_warning = null;
  let stress_note = null;

  // 6. Check Portfolio Heat Breach (Max 6% default)
  if (heatAfterDollars > (cfg.max_portfolio_heat_percent / 100) * currentEquity) {
    const maxHeatAvailable = Math.max(0, ((cfg.max_portfolio_heat_percent / 100) * currentEquity) - heatBefore.total_heat_dollars);
    const suggestedQty = entry !== stop ? Math.floor(maxHeatAvailable / Math.abs(entry - stop)) : 0;

    return {
      verdict: suggestedQty > 0 ? 'modify' : 'veto',
      portfolio_heat_before: heatBeforePct,
      portfolio_heat_after: heatAfterPct,
      heat_limit: heatLimitFraction,
      daily_risk_used: dailyRiskUsedFraction,
      daily_risk_limit: dailyRiskLimitFraction,
      correlation_warning: null,
      concentration_warning: null,
      stress_note: null,
      required_changes: suggestedQty > 0
        ? [`Reduce quantity to ${suggestedQty} shares to keep portfolio heat under ${cfg.max_portfolio_heat_percent}%.`]
        : [`Portfolio heat hard limit of ${cfg.max_portfolio_heat_percent}% reached. Cannot add risk.`],
      reason: `VETO: Adding this trade pushes portfolio heat to ${(heatAfterPct * 100).toFixed(2)}%, exceeding the hard limit of ${cfg.max_portfolio_heat_percent}%.`,
      sources,
      as_of: asOf
    };
  }

  // 7. Single Symbol Heat Check (default limit: 2%)
  const existingSymPos = currentPositions.filter(p => p.symbol === sym);
  const existingSymHeat = existingSymPos.reduce((sum, p) => sum + (p.initial_risk || Math.abs(p.entry - p.stop) * Math.abs(p.qty || p.quantity)), 0);
  const totalSymHeat = existingSymHeat + proposedTradeDollarRisk;
  const totalSymHeatPct = (totalSymHeat / currentEquity) * 100;

  if (totalSymHeatPct > cfg.max_symbol_heat_percent) {
    const maxAllowedSymDollars = (cfg.max_symbol_heat_percent / 100) * currentEquity;
    const maxNewRisk = Math.max(0, maxAllowedSymDollars - existingSymHeat);
    const suggestedQty = entry !== stop ? Math.floor(maxNewRisk / Math.abs(entry - stop)) : 0;

    return {
      verdict: suggestedQty > 0 ? 'modify' : 'veto',
      portfolio_heat_before: heatBeforePct,
      portfolio_heat_after: heatAfterPct,
      heat_limit: heatLimitFraction,
      daily_risk_used: dailyRiskUsedFraction,
      daily_risk_limit: dailyRiskLimitFraction,
      correlation_warning: null,
      concentration_warning: `${sym} would represent ${totalSymHeatPct.toFixed(2)}% of equity heat (limit: ${cfg.max_symbol_heat_percent}%).`,
      stress_note: null,
      required_changes: suggestedQty > 0
        ? [`Reduce ${sym} position size to ${suggestedQty} shares to satisfy the ${cfg.max_symbol_heat_percent}% single-symbol limit.`]
        : [`Single-symbol heat limit (${cfg.max_symbol_heat_percent}%) reached for ${sym}.`],
      reason: `MODIFICATION REQUIRED: Symbol concentration in ${sym} (${totalSymHeatPct.toFixed(2)}%) exceeds single-symbol heat limit of ${cfg.max_symbol_heat_percent}%.`,
      sources,
      as_of: asOf
    };
  }

  // 8. Sector Concentration Check (default limit: 3%)
  const meta = getSymbolMetadata(sym);
  const sector = meta.sector;
  const existingSectorPos = currentPositions.filter(p => {
    const pMeta = getSymbolMetadata(p.symbol);
    return (p.sector || pMeta.sector) === sector;
  });
  const existingSectorHeat = existingSectorPos.reduce((sum, p) => sum + (p.initial_risk || Math.abs(p.entry - p.stop) * Math.abs(p.qty || p.quantity)), 0);
  const totalSectorHeat = existingSectorHeat + proposedTradeDollarRisk;
  const totalSectorHeatPct = (totalSectorHeat / currentEquity) * 100;

  if (totalSectorHeatPct > cfg.max_sector_heat_percent) {
    const maxSectorAllowed = (cfg.max_sector_heat_percent / 100) * currentEquity;
    const maxNewRisk = Math.max(0, maxSectorAllowed - existingSectorHeat);
    const suggestedQty = entry !== stop ? Math.floor(maxNewRisk / Math.abs(entry - stop)) : 0;

    return {
      verdict: suggestedQty > 0 ? 'modify' : 'veto',
      portfolio_heat_before: heatBeforePct,
      portfolio_heat_after: heatAfterPct,
      heat_limit: heatLimitFraction,
      daily_risk_used: dailyRiskUsedFraction,
      daily_risk_limit: dailyRiskLimitFraction,
      correlation_warning: null,
      concentration_warning: `${sector} sector heat would reach ${totalSectorHeatPct.toFixed(2)}% (limit: ${cfg.max_sector_heat_percent}%).`,
      stress_note: null,
      required_changes: suggestedQty > 0
        ? [`Reduce size to ${suggestedQty} shares to stay under ${cfg.max_sector_heat_percent}% sector limit for ${sector}.`]
        : [`Sector heat limit (${cfg.max_sector_heat_percent}%) reached for ${sector}.`],
      reason: `MODIFICATION REQUIRED: Sector heat for ${sector} (${totalSectorHeatPct.toFixed(2)}%) breaches ${cfg.max_sector_heat_percent}% limit.`,
      sources,
      as_of: asOf
    };
  }

  // 9. Check Daily Risk Budget Exhaustion
  const newDailyRiskUsed = budget.daily_risk_used + proposedTradeDollarRisk;
  if (newDailyRiskUsed > budget.daily_budget_dollars) {
    const maxAllowedDollarRisk = Math.max(0, budget.daily_budget_dollars - budget.daily_risk_used);
    const suggestedQty = entry !== stop ? Math.floor(maxAllowedDollarRisk / Math.abs(entry - stop)) : 0;

    return {
      verdict: suggestedQty > 0 ? 'modify' : 'veto',
      portfolio_heat_before: heatBeforePct,
      portfolio_heat_after: heatAfterPct,
      heat_limit: heatLimitFraction,
      daily_risk_used: dailyRiskUsedFraction,
      daily_risk_limit: dailyRiskLimitFraction,
      correlation_warning: null,
      concentration_warning: null,
      stress_note: null,
      required_changes: suggestedQty > 0
        ? [`Reduce position size to ${suggestedQty} shares to stay within daily risk budget.`]
        : ['Daily risk budget is completely exhausted. No new entries permitted today.'],
      reason: `VETO: Proposed trade risk ($${proposedTradeDollarRisk.toFixed(2)}) breaches remaining daily risk budget ($${budget.daily_budget_remaining.toFixed(2)}).`,
      sources,
      as_of: asOf
    };
  }

  // 10. Correlation & Cluster Warnings
  const allSymbols = Array.from(new Set([...currentPositions.map(p => p.symbol), sym]));
  if (allSymbols.length >= 2) {
    const matrix = calculateCorrelationMatrix(allSymbols, { lookback_days: cfg.correlation_lookback_days });
    const clusters = detectCorrelatedClusters([...currentPositions, { symbol: sym, entry, stop, qty }], matrix, cfg);

    for (const pr of matrix.pairs || []) {
      if (pr.symbols.includes(sym) && pr.correlation >= (cfg.very_high_correlation_threshold || 0.80)) {
        const other = pr.symbols[0] === sym ? pr.symbols[1] : pr.symbols[0];
        correlation_warning = `${sym} and ${other} estimated correlation ${pr.correlation} over ${cfg.correlation_lookback_days} days`;
        break;
      }
    }

    for (const cl of clusters) {
      if (cl.symbols.includes(sym)) {
        const clHeatPct = (cl.combined_heat / currentEquity) * 100;
        concentration_warning = `${cl.name} would use ${(clHeatPct / cfg.max_cluster_heat_percent * 100).toFixed(0)}% of cluster heat limit (${clHeatPct.toFixed(2)}% / ${cfg.max_cluster_heat_percent}%)`;
      }
    }
  }

  // 11. Stress Test Impact Note
  if (meta.sector === 'Technology' || meta.theme === 'Semiconductors') {
    const stressRes = runStressTest([...currentPositions, { symbol: sym, entry, stop, qty, direction: proposedTrade.direction || 'long' }], currentEquity, 'tech_down_5_percent');
    stress_note = `A 5% tech decline is estimated to reduce equity by ${Math.abs(stressRes.estimated_portfolio_pnl_percent).toFixed(1)}%`;
  }

  return {
    verdict: 'approve',
    portfolio_heat_before: heatBeforePct,
    portfolio_heat_after: heatAfterPct,
    heat_limit: heatLimitFraction,
    daily_risk_used: dailyRiskUsedFraction,
    daily_risk_limit: dailyRiskLimitFraction,
    correlation_warning,
    concentration_warning,
    stress_note,
    required_changes: [],
    reason: `APPROVE: Proposed trade remains within portfolio heat (${(heatAfterPct * 100).toFixed(2)}% / ${cfg.max_portfolio_heat_percent}%) and daily risk budget.`,
    sources,
    as_of: asOf
  };
}
