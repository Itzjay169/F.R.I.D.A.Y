import { DEFAULT_RISK_CONFIG } from '../../shared/config.js';

/**
 * Evaluates Daily and Weekly Risk Budgets and determines the portfolio Risk State
 * States: GREEN | YELLOW | ORANGE | RED | BLACK
 */
export function calculateRiskBudget(accountData = {}, killSwitchActive = false, config = DEFAULT_RISK_CONFIG) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
  const currentEquity = Number(accountData.current_equity || accountData.equity || 1604199.00);

  // Daily budget calculations
  const dailyBudgetPercent = cfg.daily_loss_limit_percent || 3.0;
  const dailyBudgetDollars = parseFloat(((dailyBudgetPercent / 100) * currentEquity).toFixed(2));

  // Realized losses today (positive value representing loss)
  const dailyRealizedPnl = Number(accountData.daily_pnl !== undefined ? accountData.daily_pnl : (accountData.dailyRealizedPnl || 0));
  const dailyLossRealized = dailyRealizedPnl < 0 ? parseFloat(Math.abs(dailyRealizedPnl).toFixed(2)) : 0;

  // Daily risk deployed today (new trade risk taken today)
  const dailyRiskDeployedToday = Number(accountData.daily_risk_used_today !== undefined
    ? accountData.daily_risk_used_today
    : (accountData.dailyRiskDeployed !== undefined ? accountData.dailyRiskDeployed : 0));

  // Open heat across all positions (for heat warnings)
  const dailyHeatOpen = Number(accountData.total_heat_dollars !== undefined ? accountData.total_heat_dollars : (accountData.heat_dollars || 0));

  // Daily risk used today = realized losses today + risk deployed in today's trades
  const dailyRiskUsed = parseFloat((dailyLossRealized + dailyRiskDeployedToday).toFixed(2));
  const dailyBudgetRemaining = parseFloat(Math.max(0, dailyBudgetDollars - dailyRiskUsed).toFixed(2));

  // Weekly budget calculations
  const weeklyBudgetPercent = cfg.weekly_loss_limit_percent || 8.0;
  const weeklyBudgetDollars = parseFloat(((weeklyBudgetPercent / 100) * currentEquity).toFixed(2));
  const weeklyRealizedPnl = Number(accountData.weekly_pnl !== undefined ? accountData.weekly_pnl : dailyRealizedPnl);
  const weeklyLossRealized = weeklyRealizedPnl < 0 ? parseFloat(Math.abs(weeklyRealizedPnl).toFixed(2)) : 0;
  const weeklyRiskUsed = parseFloat((weeklyLossRealized + dailyHeatOpen).toFixed(2));
  const weeklyBudgetRemaining = parseFloat(Math.max(0, weeklyBudgetDollars - weeklyRiskUsed).toFixed(2));

  // Current drawdown
  const currentDrawdownPct = Number(accountData.current_drawdown_percent || 0);

  // Determine Risk State
  let riskState = 'GREEN';
  let reason = 'Normal desk operation. Risk budget healthy.';

  if (killSwitchActive) {
    riskState = 'BLACK';
    reason = 'Kill switch is ACTIVE. All new paper entries are blocked.';
  } else if (
    dailyLossRealized >= dailyBudgetDollars ||
    (accountData.heat_percent_current_equity && accountData.heat_percent_current_equity >= cfg.max_portfolio_heat_percent) ||
    currentDrawdownPct >= cfg.max_drawdown_percent
  ) {
    riskState = 'RED';
    if (dailyLossRealized >= dailyBudgetDollars) {
      reason = `Daily loss limit breached: $${dailyLossRealized.toLocaleString()} lost vs limit of $${dailyBudgetDollars.toLocaleString()} (${dailyBudgetPercent}%).`;
    } else if (currentDrawdownPct >= cfg.max_drawdown_percent) {
      reason = `Maximum drawdown breached: ${currentDrawdownPct}% vs limit of ${cfg.max_drawdown_percent}%.`;
    } else {
      reason = `Portfolio heat hard limit breached: ${accountData.heat_percent_current_equity}% vs limit of ${cfg.max_portfolio_heat_percent}%.`;
    }
  } else if (dailyRiskUsed >= dailyBudgetDollars * 0.80 || weeklyRiskUsed >= weeklyBudgetDollars * 0.80) {
    riskState = 'ORANGE';
    reason = `Risk budget nearly exhausted (${((dailyRiskUsed / dailyBudgetDollars) * 100).toFixed(0)}% used today). Only high-conviction, reduced-size setups permitted.`;
  } else if (
    dailyRiskUsed >= dailyBudgetDollars * 0.50 ||
    (accountData.heat_percent_current_equity && accountData.heat_percent_current_equity >= cfg.soft_portfolio_heat_percent)
  ) {
    riskState = 'YELLOW';
    reason = `Risk approaching soft limit (${accountData.heat_percent_current_equity || 0}% heat vs 4% soft threshold). Extra scrutiny mandated on new proposals.`;
  }

  return {
    daily_budget_percent: dailyBudgetPercent,
    daily_budget_dollars: dailyBudgetDollars,
    daily_loss_realized: dailyLossRealized,
    daily_heat_open: dailyHeatOpen,
    daily_risk_used: dailyRiskUsed,
    daily_budget_remaining: dailyBudgetRemaining,
    weekly_budget_percent: weeklyBudgetPercent,
    weekly_budget_dollars: weeklyBudgetDollars,
    weekly_loss_realized: weeklyLossRealized,
    weekly_risk_used: weeklyRiskUsed,
    weekly_budget_remaining: weeklyBudgetRemaining,
    risk_state: riskState,
    reason,
    as_of: new Date().toISOString()
  };
}
