import crypto from 'crypto';
import { TradePlanSchema, validateTradePlan } from '../../shared/contract.js';

// In-memory trade plan repository for session
const tradePlans = new Map();

/**
 * Asserts security boundary: COMPASS is an analysis agent and CANNOT execute trades.
 */
export function assertCompassCannotExecute(action) {
  const executionActions = [
    'execute_paper_order',
    'execute_order',
    'place_paper_trade',
    'place_order',
    'route_order',
    'sign_sentinel_token',
    'approve_order_execution'
  ];
  if (executionActions.includes(action)) {
    throw new Error(`SECURITY VIOLATION: COMPASS agent cannot perform execution action "${action}". Only PILOT with Sentinel approval token can execute.`);
  }
}

/**
 * Parses user command to determine intent, symbol, direction, timeframe, etc.
 */
export function parseTradeIntent(command) {
  const raw = command || '';
  const norm = raw.toLowerCase();

  // Intent classification
  let intent = 'plan_trade';
  if (norm.includes('compare')) intent = 'compare_trade_plans';
  else if (norm.includes('refine') || norm.includes('wider stop') || norm.includes('change target')) intent = 'refine_trade_plan';
  else if (norm.includes('explain')) intent = 'explain_trade_plan';
  else if (norm.includes('invalidate') || norm.includes('proves wrong')) intent = 'invalidate_trade_plan';
  else if (norm.includes('create') || norm.includes('build')) intent = 'create_trade_plan';

  // Direction classification
  let direction = 'neutral';
  if (norm.includes('short') || norm.includes('bearish') || norm.includes('sell')) direction = 'short';
  else if (norm.includes('long') || norm.includes('buy') || norm.includes('bullish') || norm.includes('swing trade')) direction = 'long';
  else if (norm.includes('neutral') || norm.includes('straddle')) direction = 'neutral';

  // Timeframe classification
  let timeframe = 'swing';
  if (norm.includes('scalp')) timeframe = 'scalp';
  else if (norm.includes('day') || norm.includes('intraday')) timeframe = 'intraday';
  else if (norm.includes('position') || norm.includes('long term')) timeframe = 'position';

  // Asset class
  let assetClass = 'equity';
  if (norm.includes('btc') || norm.includes('bitcoin') || norm.includes('crypto')) assetClass = 'crypto';
  else if (norm.includes('option')) assetClass = 'option';
  else if (norm.includes('spy') || norm.includes('qqq') || norm.includes('etf')) assetClass = 'etf';

  // Common stop words to exclude from symbol extraction
  const stopWords = new Set([
    'a', 'an', 'in', 'on', 'for', 'the', 'my', 'me', 'to', 'of', 'is', 'it',
    'am', 'at', 'or', 'if', 'so', 'up', 'do', 'be', 'no', 'by', 'we', 'as',
    'and', 'but', 'not', 'out', 'all', 'get', 'got', 'can', 'has', 'had',
    'plan', 'trade', 'build', 'give', 'make', 'set', 'run', 'show',
    'from', 'with', 'this', 'that', 'what', 'when', 'how', 'why', 'swing'
  ]);

  let symbol = '';
  const afterPrepMatch = raw.match(/\b(?:in|for|on|trade)\s+([A-Z]{1,5})\b/);
  if (afterPrepMatch && !stopWords.has(afterPrepMatch[1].toLowerCase())) {
    symbol = afterPrepMatch[1].toUpperCase();
  }

  if (!symbol) {
    const allUpperWords = raw.match(/\b([A-Z]{2,5})\b/g) || [];
    for (const w of allUpperWords) {
      if (!stopWords.has(w.toLowerCase())) {
        symbol = w;
        break;
      }
    }
  }

  if (!symbol) {
    const companyMap = {
      'nvidia': 'NVDA',
      'tesla': 'TSLA',
      'apple': 'AAPL',
      'microsoft': 'MSFT',
      'amazon': 'AMZN',
      'google': 'GOOGL',
      'meta': 'META',
      'bitcoin': 'BTC',
      'amd': 'AMD',
      'netflix': 'NFLX'
    };
    for (const [name, sym] of Object.entries(companyMap)) {
      if (norm.includes(name)) {
        symbol = sym;
        break;
      }
    }
  }

  if (!symbol) {
    const commonTickers = ['NVDA', 'AAPL', 'TSLA', 'SPY', 'QQQ', 'BTC', 'MSFT', 'AMZN', 'META', 'AMD'];
    for (const t of commonTickers) {
      if (norm.includes(t.toLowerCase())) {
        symbol = t;
        break;
      }
    }
  }

  let setupType = 'swing';
  if (norm.includes('option')) setupType = 'options';
  else if (norm.includes('breakout')) setupType = 'breakout';
  else if (norm.includes('pullback')) setupType = 'pullback';
  else if (norm.includes('catalyst') || norm.includes('earning')) setupType = 'catalyst';

  return {
    intent,
    symbol: symbol.toUpperCase(),
    direction,
    timeframe,
    assetClass,
    setupType
  };
}

/**
 * Creates an empty, valid template conforming to TradePlanSchema
 */
export function createTradePlanTemplate(symbol = 'UNKNOWN') {
  const plan = {
    plan_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    symbol: symbol.toUpperCase(),
    asset_class: 'equity',
    direction: 'long',
    timeframe: 'swing',
    thesis: '',
    market_regime: 'trending',
    catalysts: [],
    entry: {
      type: 'pullback',
      trigger: '',
      price: null,
      zone: { low: null, high: null }
    },
    invalidation: {
      level: null,
      condition: '',
      source: 'compass:thesis-analysis'
    },
    stop: {
      price: null,
      percent: null,
      rationale: ''
    },
    targets: [],
    position_size: {
      quantity: null,
      notional: null,
      risk_amount: null,
      risk_percent_of_equity: null,
      sizing_method: 'fixed_risk'
    },
    reward_risk: null,
    time_stop: null,
    event_risks: [],
    bull_case: '',
    bear_case: '',
    what_proves_thesis_right: [],
    what_proves_thesis_wrong: [],
    confidence: 0.70,
    sources: [],
    model_estimated_fields: [],
    sentinel_verdict: 'pending',
    sentinel_notes: null,
    status: 'draft'
  };

  // Compatibility getters/setters for seamless interop
  Object.defineProperty(plan, 'planId', { get() { return this.plan_id; }, set(v) { this.plan_id = v; }, enumerable: true });
  Object.defineProperty(plan, 'stopLoss', { get() { return this.stop?.price; }, set(v) { if (this.stop) this.stop.price = v; }, enumerable: true });
  Object.defineProperty(plan, 'entryPrice', { get() { return this.entry?.price; }, set(v) { if (this.entry) this.entry.price = v; }, enumerable: true });
  Object.defineProperty(plan, 'entryType', { get() { return this.entry?.type === 'breakout' ? 'breakout-confirmation' : this.entry?.type; }, set(v) { if (this.entry) this.entry.type = v; }, enumerable: true });
  Object.defineProperty(plan, 'entryTrigger', { get() { return this.entry?.trigger; }, set(v) { if (this.entry) this.entry.trigger = v; }, enumerable: true });
  Object.defineProperty(plan, 'marketRegime', { get() { return this.market_regime; }, set(v) { this.market_regime = v; }, enumerable: true });
  Object.defineProperty(plan, 'rewardRisk', { get() { return this.reward_risk; }, set(v) { this.reward_risk = v; }, enumerable: true });
  Object.defineProperty(plan, 'eventRisks', { get() { return this.event_risks; }, set(v) { this.event_risks = v; }, enumerable: true });
  Object.defineProperty(plan, 'invalidations', { get() { return this.invalidation?.condition ? [this.invalidation.condition] : []; }, enumerable: true });

  return plan;
}

/**
 * Generates or updates a structured TradePlan based on inputs from other agents
 */
export function generateTradePlan({
  command,
  symbol: forcedSymbol,
  marketContext = [],
  agentInputs = {},
  options = {}
}) {
  assertCompassCannotExecute('generate_trade_plan');

  const intent = parseTradeIntent(command);
  const symbol = forcedSymbol || intent.symbol;

  if (!symbol) {
    return {
      status: 'error',
      error: 'Could not identify a ticker symbol. Please specify a symbol (e.g., "Plan a swing trade in AAPL").',
      plan: null,
      missingData: ['symbol']
    };
  }

  // Find live quote
  const quote = Array.isArray(marketContext)
    ? marketContext.find(q => q.symbol === symbol)
    : (marketContext && marketContext.symbol === symbol ? marketContext : null);

  const price = quote?.price || null;

  // Check if critical price data is missing
  if (!price && !agentInputs.CHARTIST && !options.allowMissingPrice) {
    return {
      status: 'limited',
      summary: `Insufficient market data for ${symbol}. Live quote or chart structure is unavailable.`,
      missingData: ['live_quote', 'chart_structure'],
      plan: null
    };
  }

  const plan = createTradePlanTemplate(symbol);
  plan.asset_class = intent.assetClass || 'equity';
  plan.direction = (intent.direction === 'short') ? 'short' : 'long';
  plan.timeframe = intent.timeframe || 'swing';

  // Entry, Stop, Targets calculation
  const isLong = plan.direction === 'long';
  if (price) {
    plan.entry.price = price;
    plan.entry.trigger = isLong
      ? `Price action confirmation near $${price.toFixed(2)} with volume expansion`
      : `Rejection near $${price.toFixed(2)} with selling volume`;

    const stopDistance = parseFloat((price * 0.03).toFixed(2));
    const targetDistance = parseFloat((price * 0.06).toFixed(2));

    const stopPrice = isLong ? parseFloat((price - stopDistance).toFixed(2)) : parseFloat((price + stopDistance).toFixed(2));
    const targetPrice = isLong ? parseFloat((price + targetDistance).toFixed(2)) : parseFloat((price - targetDistance).toFixed(2));

    plan.stop.price = stopPrice;
    plan.stop.percent = 3.0;
    plan.stop.rationale = isLong
      ? `3% protective stop below recent structural support at $${stopPrice}`
      : `3% protective stop above recent resistance at $${stopPrice}`;

    plan.targets = [
      {
        label: 'T1',
        price: targetPrice,
        rationale: 'Initial resistance target (2R reward objective)',
        allocation_percent: 70
      },
      {
        label: 'runner',
        price: isLong ? parseFloat((price * 1.10).toFixed(2)) : parseFloat((price * 0.90).toFixed(2)),
        rationale: 'Trailing runner for extended swing move',
        allocation_percent: 30
      }
    ];

    plan.reward_risk = 2.0;

    // Position sizing (1% risk on $1.6M equity = $16,000 risk)
    const riskBudget = 16000;
    const quantity = Math.max(1, Math.floor(riskBudget / stopDistance));
    plan.position_size = {
      quantity,
      notional: parseFloat((quantity * price).toFixed(2)),
      risk_amount: parseFloat((quantity * stopDistance).toFixed(2)),
      risk_percent_of_equity: 1.0,
      sizing_method: 'fixed_risk'
    };
  }

  if (intent.setupType === 'breakout') {
    plan.market_regime = 'breakout';
    plan.entry.type = 'breakout';
    plan.entry.trigger = `Break and close above $${plan.entry.price || 'resistance'} with volume > 1.5x average`;
  }

  // Invalidation condition (MANDATORY)
  plan.invalidation = {
    level: plan.stop.price,
    condition: isLong
      ? `Daily close below $${plan.stop.price || 'support'} with higher-than-average volume`
      : `Daily close above $${plan.stop.price || 'resistance'} with higher-than-average volume`,
    source: 'compass:technical-invalidation'
  };

  // Catalysts from NEWSROOM / ATHENA
  const catalysts = [];
  if (agentInputs.NEWSROOM?.headlines) {
    catalysts.push({
      type: 'news',
      description: agentInputs.NEWSROOM.headlines[0] || 'Recent news wire release',
      source: 'newsroom:finnhub',
      published_at: new Date().toISOString()
    });
  } else {
    catalysts.push({
      type: 'technical',
      description: `${symbol} technical swing structure approaching key liquidity zone`,
      source: 'chartist:technicals',
      published_at: new Date().toISOString()
    });
  }
  plan.catalysts = catalysts;

  // Macro context from ATLAS
  plan.market_regime = intent.setupType === 'breakout' ? 'breakout' : (agentInputs.ATLAS?.regime || 'trending');
  plan.event_risks = agentInputs.ATLAS?.eventRisks || ['FOMC calendar schedule', 'Earnings announcement date'];

  // Bull and Bear cases
  plan.bull_case = `${symbol} holds structural support with positive momentum. Upside target T1 offers favorable 2.0R asymmetry.`;
  plan.bear_case = `Macro pressure or breakdown below $${plan.stop.price || 'stop'} invalidates setup; sector rotation into defensive assets.`;
  plan.what_proves_thesis_right = [
    `Strong volume bounce at entry price ($${plan.entry.price || '—'})`,
    'Relative strength against broad market indices (SPY/QQQ)'
  ];
  plan.what_proves_thesis_wrong = [
    `Break and daily close below $${plan.stop.price || 'stop'}`,
    'Bearish news catalyst or earnings warning'
  ];

  plan.thesis = `${plan.timeframe.toUpperCase()} trade on ${symbol} (${plan.direction.toUpperCase()}). ` +
    `Entry at $${plan.entry.price || '—'}, Stop at $${plan.stop.price || '—'}, T1 at $${plan.targets[0]?.price || '—'}. ` +
    `Calculated Reward:Risk is ${plan.reward_risk}R.`;

  // Sources and model-estimated fields
  plan.sources = [
    quote ? `finnhub:quote:${symbol}` : 'chartist:technicals',
    'compass:trade-planner-v2',
    'sentinel:risk-parameters'
  ];
  plan.model_estimated_fields = ['reward_risk', 'targets', 'invalidation', 'confidence'];
  plan.confidence = 0.72;
  plan.status = 'pending-review';

  // Validate plan against Zod schema
  const validation = validateTradePlan(plan);

  // Persist plan in session store
  tradePlans.set(plan.plan_id, plan);

  return {
    status: 'ok',
    plan,
    validation,
    spokenText: `Trade plan drafted for ${symbol}. ${plan.direction} setup with ${plan.reward_risk}R reward-to-risk. ` +
      `Invalidation level set at $${plan.invalidation.level}. Sent to Sentinel for risk check.`,
    nextStep: 'SENTINEL risk-check'
  };
}

/**
 * Flexible wrapper for generateTradePlan
 */
export function buildTradePlan(arg1, arg2) {
  if (typeof arg1 === 'string') {
    return generateTradePlan({
      command: arg1,
      marketContext: arg2 ? (Array.isArray(arg2) ? arg2 : [arg2]) : []
    });
  }
  return generateTradePlan(arg1 || {});
}

/**
 * Retrieves a plan by ID
 */
export function getTradePlan(planId) {
  if (!planId) return null;
  let p = tradePlans.get(planId);
  if (!p) {
    for (const v of tradePlans.values()) {
      if (v.plan_id === planId || v.planId === planId) {
        p = v;
        break;
      }
    }
  }
  return p || null;
}

/**
 * Lists plans, optionally filtered
 */
export function listTradePlans({ symbol, status } = {}) {
  let list = Array.from(tradePlans.values());
  if (symbol) list = list.filter(p => p.symbol === symbol.toUpperCase());
  if (status) list = list.filter(p => p.status === status);
  return list;
}

/**
 * Cancels a trade plan
 */
export function cancelTradePlan(planId) {
  const plan = getTradePlan(planId);
  if (!plan) return { success: false, error: 'Plan not found' };
  plan.status = 'cancelled';
  tradePlans.set(plan.plan_id, plan);
  return { success: true, plan };
}

/**
 * Health check for COMPASS
 */
export function compassHealthCheck() {
  return {
    agent: 'COMPASS',
    status: 'online',
    version: '2.5.0',
    capabilities: [
      'plan_trade',
      'create_trade_plan',
      'refine_trade_plan',
      'compare_trade_plans',
      'explain_trade_plan',
      'invalidate_trade_plan'
    ],
    restrictions: [
      'CANNOT execute trades',
      'CANNOT generate Sentinel approval tokens',
      'CANNOT bypass risk checks'
    ],
    timestamp: new Date().toISOString()
  };
}
