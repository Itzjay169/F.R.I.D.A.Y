import { validateSentinelVerdict } from '../shared/contract.js';
import { pretradePortfolioCheck } from './sentinel-x/pretradeCheck.js';

/**
 * Default Risk Limits for Sentinel
 */
export const DEFAULT_SENTINEL_CONFIG = {
  maxRiskPerTradePct: 2.0,      // Max 2% risk of equity
  minRewardRisk: 1.5,           // Minimum 1.5R required
  maxPositionConcentration: 0.20, // Max 20% of desk equity in a single symbol
  maxOpenPositions: 10,
  maxPortfolioHeat: 0.08,       // Max 8% aggregate risk at any one time
  deskEquity: 1604199.00
};

/**
 * Reviews a complete TradePlan object according to Sentinel risk rules.
 * 
 * @param {Object} plan - A validated TradePlan object
 * @param {Object} [options] - Additional parameters
 * @param {boolean} [options.eventRiskOverride=false] - User explicitly accepts scheduled event risk
 * @param {Object} [options.config] - Risk configuration overrides
 * @param {Object} [options.marketContext] - Current market status and session
 * @returns {Object} SentinelVerdict conforming to SentinelVerdictSchema
 */
export function reviewTradePlanWithSentinel(plan, options = {}) {
  const config = { ...DEFAULT_SENTINEL_CONFIG, ...(options.config || {}) };
  const eventRiskOverride = Boolean(options.eventRiskOverride);

  const required_changes = [];
  const event_risks = Array.isArray(plan?.event_risks) ? [...plan.event_risks] : [];
  const sources = ['sentinel:risk-engine-v2', 'local-ledger:equity-state'];

  if (plan?.sources && Array.isArray(plan.sources)) {
    sources.push(...plan.sources);
  }

  // 1. Direction check
  if (!plan?.direction || !['long', 'short'].includes(plan.direction)) {
    return createVerdict({
      verdict: 'veto',
      reason: 'Direction must be explicitly defined as long or short. Neutral positions cannot be risk-checked.',
      required_changes: ['Specify direction as long or short.'],
      sources
    });
  }

  // 2. Entry check
  const entryPrice = plan.entry?.price;
  if (!entryPrice || entryPrice <= 0) {
    if (!plan.entry?.trigger) {
      return createVerdict({
        verdict: 'veto',
        reason: 'Trade plan entry trigger or price is undefined.',
        required_changes: ['Define entry price or valid entry trigger.'],
        sources
      });
    }
  }

  // 3. Stop loss existence check
  const stopPrice = plan.stop?.price;
  if (stopPrice === null || stopPrice === undefined || stopPrice <= 0) {
    return createVerdict({
      verdict: 'veto',
      reason: 'Mandatory stop-loss is missing. F.R.I.D.A.Y. rules strictly forbid unprotected positions.',
      required_changes: ['Provide a defined protective stop-loss price.'],
      sources
    });
  }

  // 4. Directional stop logic check
  if (entryPrice && stopPrice) {
    if (plan.direction === 'long' && stopPrice >= entryPrice) {
      return createVerdict({
        verdict: 'veto',
        reason: `Invalid long stop: Stop loss ($${stopPrice}) must be strictly BELOW entry price ($${entryPrice}).`,
        required_changes: [`Lower stop loss below entry price of $${entryPrice}.`],
        suggested_stop: parseFloat((entryPrice * 0.97).toFixed(2)),
        sources
      });
    }
    if (plan.direction === 'short' && stopPrice <= entryPrice) {
      return createVerdict({
        verdict: 'veto',
        reason: `Invalid short stop: Stop loss ($${stopPrice}) must be strictly ABOVE entry price ($${entryPrice}).`,
        required_changes: [`Raise stop loss above entry price of $${entryPrice}.`],
        suggested_stop: parseFloat((entryPrice * 1.03).toFixed(2)),
        sources
      });
    }
  }

  // 5. Invalidation rule existence check
  if (!plan.invalidation || !plan.invalidation.condition) {
    return createVerdict({
      verdict: 'veto',
      reason: 'No invalidation condition provided. Trade thesis must define when it is proven wrong.',
      required_changes: ['Define what price action or catalyst invalidates the trade thesis.'],
      sources
    });
  }

  // 6. Targets existence check
  const targets = Array.isArray(plan.targets) ? plan.targets : [];
  const primaryTarget = targets.find(t => t.price && t.price > 0) || targets[0];
  if (!primaryTarget || !primaryTarget.price) {
    return createVerdict({
      verdict: 'veto',
      reason: 'No profit target specified. A defined exit objective is required.',
      required_changes: ['Specify at least one profit target (T1).'],
      sources
    });
  }

  // 7. Reward-to-Risk ratio check
  let rewardRisk = plan.reward_risk;
  if (entryPrice && stopPrice && primaryTarget.price) {
    const risk = Math.abs(entryPrice - stopPrice);
    const reward = Math.abs(primaryTarget.price - entryPrice);
    if (risk > 0) {
      rewardRisk = parseFloat((reward / risk).toFixed(2));
    }
  }

  if (rewardRisk !== null && rewardRisk < config.minRewardRisk) {
    const requiredReward = Math.abs(entryPrice - stopPrice) * config.minRewardRisk;
    const suggestedTarget = plan.direction === 'long'
      ? parseFloat((entryPrice + requiredReward).toFixed(2))
      : parseFloat((entryPrice - requiredReward).toFixed(2));

    return createVerdict({
      verdict: 'modify',
      reason: `Reward:Risk ratio of ${rewardRisk}R is below the desk minimum threshold of ${config.minRewardRisk}R.`,
      required_changes: [`Increase target to at least $${suggestedTarget} or tighten stop to achieve ${config.minRewardRisk}R.`],
      suggested_target: suggestedTarget,
      suggested_stop: stopPrice,
      sources
    });
  }

  // 8. Position size & Risk budget check
  const maxRiskDollar = (config.deskEquity * config.maxRiskPerTradePct) / 100;
  const riskPerShare = entryPrice && stopPrice ? Math.abs(entryPrice - stopPrice) : 1;
  const plannedQuantity = plan.position_size?.quantity || (riskPerShare > 0 ? Math.floor(maxRiskDollar / riskPerShare) : 100);
  const totalTradeRisk = plannedQuantity * riskPerShare;
  const tradeRiskPct = parseFloat(((totalTradeRisk / config.deskEquity) * 100).toFixed(2));

  if (tradeRiskPct > config.maxRiskPerTradePct) {
    const suggestedQuantity = Math.max(1, Math.floor(maxRiskDollar / riskPerShare));
    return createVerdict({
      verdict: 'modify',
      reason: `Position risk (${tradeRiskPct}%) exceeds maximum allowable risk limit of ${config.maxRiskPerTradePct}% ($${maxRiskDollar.toLocaleString()}).`,
      required_changes: [`Reduce position size from ${plannedQuantity} to ${suggestedQuantity} shares.`],
      suggested_quantity: suggestedQuantity,
      suggested_stop: stopPrice,
      risk_amount: parseFloat((suggestedQuantity * riskPerShare).toFixed(2)),
      risk_percent: parseFloat(((suggestedQuantity * riskPerShare / config.deskEquity) * 100).toFixed(2)),
      event_risks,
      sources
    });
  }

  // 9. Event risks check: detect imminent high-impact scheduled events
  const majorKeywords = ['FOMC', 'CPI', 'EARNINGS', 'NFP', 'FED RATE DECISION'];
  const hasImminentEventConflict = event_risks.some(ev => {
    const u = ev.toUpperCase();
    const hasMajor = majorKeywords.some(kw => u.includes(kw));
    if (!hasMajor) return false;
    // If it mentions 2+ days or schedule/date reference without today/tomorrow, it is not an immediate conflict
    if (u.includes('IN 14 DAYS') || u.includes('IN 7 DAYS') || u.includes('SCHEDULE') || u.includes('DATE PROXIMITY')) {
      return false;
    }
    return true;
  });

  if (hasImminentEventConflict && !eventRiskOverride) {
    return createVerdict({
      verdict: 'veto',
      reason: `High-impact scheduled event detected in risk window: ${event_risks.join(', ')}. Trading prohibited unless event-risk override is explicitly enabled.`,
      required_changes: ['Enable event-risk override or defer entry until post-event resolution.'],
      event_risks,
      sources
    });
  }

  // 10. APPROVE: All parameters verified
  return createVerdict({
    verdict: 'approve',
    reason: `Plan verified within risk limits: ${rewardRisk}R reward-to-risk, ${tradeRiskPct}% equity risk ($${totalTradeRisk.toFixed(0)}), stop and invalidation confirmed.`,
    required_changes: [],
    suggested_quantity: plannedQuantity,
    suggested_stop: stopPrice,
    suggested_target: primaryTarget.price,
    risk_amount: totalTradeRisk,
    risk_percent: tradeRiskPct,
    event_risks,
    sources
  });
}

function createVerdict(data) {
  const verdict = {
    verdict: data.verdict,
    reason: data.reason,
    required_changes: data.required_changes || [],
    suggested_quantity: data.suggested_quantity ?? null,
    suggested_stop: data.suggested_stop ?? null,
    suggested_target: data.suggested_target ?? null,
    risk_amount: data.risk_amount ?? null,
    risk_percent: data.risk_percent ?? null,
    event_risks: data.event_risks || [],
    sources: data.sources || ['sentinel:risk-engine-v2']
  };

  const validation = validateSentinelVerdict(verdict);
  if (!validation.valid) {
    throw new Error(`Sentinel verdict failed validation: ${validation.errors.join('; ')}`);
  }
  return verdict;
}

/**
 * Phase 7.5: Evaluates a trade proposal through BOTH:
 * 1. SENTINEL trade-level risk review
 * 2. SENTINEL-X portfolio-level risk check
 */
export function reviewTradePlanWithSentinelSuite(plan, options = {}) {
  // Level 1: SENTINEL Trade-Level Check
  const tradeVerdict = reviewTradePlanWithSentinel(plan, options);
  if (tradeVerdict.verdict === 'veto') {
    return {
      ...tradeVerdict,
      sentinel_x_checked: false,
      portfolio_verdict: null
    };
  }

  // Level 2: SENTINEL-X Portfolio-Level Check
  const portfolioPositions = options.portfolioPositions || options.positions || [];
  const accountSnapshot = options.accountSnapshot || { current_equity: options.config?.deskEquity || 1604199.00 };

  const portfolioVerdict = pretradePortfolioCheck(
    plan,
    portfolioPositions,
    accountSnapshot,
    options.config
  );

  // If portfolio check issues veto, overall verdict is veto
  if (portfolioVerdict.verdict === 'veto') {
    return {
      ...tradeVerdict,
      verdict: 'veto',
      reason: `SENTINEL-X PORTFOLIO VETO: ${portfolioVerdict.reason}`,
      required_changes: [...tradeVerdict.required_changes, ...portfolioVerdict.required_changes],
      sources: [...tradeVerdict.sources, ...portfolioVerdict.sources],
      sentinel_x_checked: true,
      portfolio_verdict: portfolioVerdict
    };
  }

  // If portfolio check issues modify, overall verdict is modify
  if (portfolioVerdict.verdict === 'modify') {
    return {
      ...tradeVerdict,
      verdict: 'modify',
      reason: `SENTINEL-X PORTFOLIO MODIFICATION: ${portfolioVerdict.reason}`,
      required_changes: [...tradeVerdict.required_changes, ...portfolioVerdict.required_changes],
      sources: [...tradeVerdict.sources, ...portfolioVerdict.sources],
      sentinel_x_checked: true,
      portfolio_verdict: portfolioVerdict
    };
  }

  return {
    ...tradeVerdict,
    sentinel_x_checked: true,
    portfolio_verdict: portfolioVerdict
  };
}
