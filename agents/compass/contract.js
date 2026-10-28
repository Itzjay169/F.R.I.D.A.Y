/**
 * COMPASS — Trade Planner Contract Schema (Phase 2.5)
 *
 * Every trade plan COMPASS produces must include ALL required fields.
 * COMPASS cannot execute trades — it outputs structured plans for SENTINEL review.
 *
 * Safety boundary:
 * - COMPASS is an Analysis-class agent.
 * - It may NOT call PILOT, place paper orders, or generate Sentinel tokens.
 * - Its only output is a TradePlan object routed to SENTINEL for risk-check.
 */

/**
 * Required fields for every COMPASS trade plan.
 * A plan missing ANY required field is invalid and must not reach SENTINEL.
 */
export const TRADE_PLAN_REQUIRED_FIELDS = [
  'planId',
  'symbol',
  'thesis',
  'marketRegime',
  'catalyst',
  'entryType',
  'entryTrigger',
  'invalidations',
  'stopLoss',
  'targets',
  'positionSize',
  'riskAmount',
  'rewardRisk',
  'timeStop',
  'eventRisks',
  'provesThesisWrong',
  'provesThesisRight',
  'createdAt',
  'status'
];

/**
 * Valid market regimes COMPASS may assign.
 */
export const VALID_REGIMES = [
  'trending-up',
  'trending-down',
  'range-bound',
  'breakout',
  'breakdown',
  'choppy',
  'high-volatility',
  'low-volatility',
  'unknown'
];

/**
 * Valid entry types.
 */
export const VALID_ENTRY_TYPES = [
  'market',
  'limit',
  'stop-entry',
  'breakout-confirmation',
  'pullback-to-level',
  'pattern-completion',
  'vwap-reclaim',
  'opening-range-breakout'
];

/**
 * Valid plan statuses.
 */
export const VALID_PLAN_STATUSES = [
  'draft',           // COMPASS is building it
  'pending-review',  // Awaiting SENTINEL risk-check
  'approved',        // SENTINEL approved, awaiting user confirmation
  'rejected',        // SENTINEL vetoed
  'modified',        // SENTINEL suggested modifications
  'executing',       // PILOT is executing (user confirmed)
  'completed',       // Trade filled and tracked
  'cancelled',       // User or system cancelled
  'expired'          // Time stop reached without entry
];

/**
 * Validates a COMPASS trade plan.
 * @param {Object} plan
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateTradePlan(plan) {
  const errors = [];
  const warnings = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Trade plan must be a non-null object'], warnings: [] };
  }

  // Check all required fields
  for (const field of TRADE_PLAN_REQUIRED_FIELDS) {
    if (plan[field] === undefined || plan[field] === null || plan[field] === '') {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Symbol must be a string
  if (plan.symbol && typeof plan.symbol !== 'string') {
    errors.push('symbol must be a string');
  }

  // Thesis must be a non-empty string
  if (plan.thesis && typeof plan.thesis === 'string' && plan.thesis.length < 10) {
    warnings.push('Thesis is very short — consider adding more detail');
  }

  // Market regime must be valid
  if (plan.marketRegime && !VALID_REGIMES.includes(plan.marketRegime)) {
    errors.push(`Invalid marketRegime: "${plan.marketRegime}". Must be one of: ${VALID_REGIMES.join(', ')}`);
  }

  // Entry type must be valid
  if (plan.entryType && !VALID_ENTRY_TYPES.includes(plan.entryType)) {
    errors.push(`Invalid entryType: "${plan.entryType}". Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
  }

  // Status must be valid
  if (plan.status && !VALID_PLAN_STATUSES.includes(plan.status)) {
    errors.push(`Invalid status: "${plan.status}". Must be one of: ${VALID_PLAN_STATUSES.join(', ')}`);
  }

  // Invalidations must be an array with at least 1 entry
  if (plan.invalidations) {
    if (!Array.isArray(plan.invalidations) || plan.invalidations.length === 0) {
      errors.push('invalidations must be a non-empty array');
    }
  }

  // Targets must be an array with at least 1 entry
  if (plan.targets) {
    if (!Array.isArray(plan.targets) || plan.targets.length === 0) {
      errors.push('targets must be a non-empty array');
    }
  }

  // Event risks must be an array
  if (plan.eventRisks && !Array.isArray(plan.eventRisks)) {
    errors.push('eventRisks must be an array');
  }

  // Stop loss must be a number
  if (plan.stopLoss !== undefined && plan.stopLoss !== null && typeof plan.stopLoss !== 'number') {
    errors.push('stopLoss must be a number');
  }

  // Reward:Risk must be a number >= 1.0
  if (typeof plan.rewardRisk === 'number' && plan.rewardRisk < 1.0) {
    warnings.push(`Reward:Risk ratio (${plan.rewardRisk}) is below 1.0 — SENTINEL will likely veto`);
  }

  // Risk amount must be a number > 0
  if (typeof plan.riskAmount === 'number' && plan.riskAmount <= 0) {
    errors.push('riskAmount must be positive');
  }

  // Position size must be a positive integer
  if (typeof plan.positionSize === 'number' && (plan.positionSize <= 0 || !Number.isInteger(plan.positionSize))) {
    errors.push('positionSize must be a positive integer');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Creates a default empty trade plan template.
 * COMPASS fills this in; it never leaves fields empty.
 */
export function createTradePlanTemplate(symbol = '') {
  return {
    planId: `PLAN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    symbol: symbol.toUpperCase(),
    thesis: '',
    marketRegime: 'unknown',
    catalyst: '',
    entryType: 'market',
    entryTrigger: '',
    invalidations: [],
    stopLoss: null,
    targets: [],
    positionSize: 0,
    riskAmount: 0,
    rewardRisk: 0,
    timeStop: '',
    eventRisks: [],
    provesThesisWrong: '',
    provesThesisRight: '',
    createdAt: new Date().toISOString(),
    status: 'draft',
    compassNotes: '',
    sources: []
  };
}

/**
 * COMPASS agent authority assertion.
 * COMPASS is STRICTLY PROHIBITED from executing trades.
 */
export function assertCompassCannotExecute(action) {
  const forbidden = [
    'execute_paper_order',
    'mirror_paper_trade',
    'place_order',
    'generate_sentinel_token',
    'approve_trade',
    'close_position'
  ];
  if (forbidden.includes(action)) {
    throw new Error(
      `SECURITY VETO: COMPASS (Trade Planner) attempted forbidden action "${action}". ` +
      'COMPASS is an Analysis-class agent and CANNOT execute, approve, or route trades. ' +
      'Trade plans must be sent to SENTINEL for risk-check, then to PILOT for paper execution.'
    );
  }
  return true;
}
