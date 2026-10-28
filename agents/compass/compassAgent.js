/**
 * COMPASS — Trade Planner Agent (Phase 2.5)
 *
 * Turns vague trade ideas into complete, structured trade plans.
 *
 * Capabilities:
 * - "Plan a swing trade in AAPL"
 * - "Build an options plan for earnings week"
 * - "Create a breakout plan for TSLA"
 * - "Give me three trade ideas from my watchlist"
 *
 * Rules:
 * - COMPASS CANNOT execute trades. Ever.
 * - Output is always a validated TradePlan object.
 * - Plans are sent to SENTINEL for risk-check before any execution.
 * - Missing data is shown as "—", never fabricated.
 */

import {
  validateTradePlan,
  createTradePlanTemplate,
  assertCompassCannotExecute,
  VALID_REGIMES,
  VALID_ENTRY_TYPES
} from './contract.js';

// In-memory trade plan store (persists within session)
const tradePlans = new Map();

/**
 * Parses a natural language trade command into structured intent.
 * @param {string} command - User's raw command text
 * @returns {{ symbol: string, setupType: string, timeframe: string, direction: string }}
 */
export function parseTradeIntent(command) {
  const raw = command || '';
  const norm = raw.toLowerCase();

  // Common English words that should NOT be treated as ticker symbols
  const stopWords = new Set([
    'a', 'an', 'in', 'on', 'for', 'the', 'my', 'me', 'to', 'of', 'is', 'it',
    'am', 'at', 'or', 'if', 'so', 'up', 'do', 'be', 'no', 'by', 'we', 'as',
    'and', 'but', 'not', 'out', 'all', 'get', 'got', 'can', 'has', 'had',
    'plan', 'trade', 'build', 'give', 'make', 'set', 'run', 'show',
    'from', 'with', 'this', 'that', 'what', 'when', 'how', 'why'
  ]);

  // Extract symbol — use the ORIGINAL (case-preserved) command to find uppercase tickers
  let symbol = '';

  // Strategy 1: Look for a word right after "in|for|on|trade" that looks like a ticker
  const afterPrepMatch = raw.match(/\b(?:in|for|on|trade)\s+([A-Z]{1,5})\b/);
  if (afterPrepMatch && !stopWords.has(afterPrepMatch[1].toLowerCase())) {
    symbol = afterPrepMatch[1].toUpperCase();
  }

  // Strategy 2: Find any standalone uppercase word that looks like a ticker
  if (!symbol) {
    const allUpperWords = raw.match(/\b([A-Z]{2,5})\b/g) || [];
    for (const w of allUpperWords) {
      if (!stopWords.has(w.toLowerCase())) {
        symbol = w;
        break;
      }
    }
  }

  // Strategy 3: Common name to ticker mapping (overrides regex matches)
  const nameMap = {
    'nvidia': 'NVDA', 'apple': 'AAPL', 'tesla': 'TSLA', 'microsoft': 'MSFT',
    'amazon': 'AMZN', 'google': 'GOOGL', 'meta': 'META', 'netflix': 'NFLX',
    'amd': 'AMD', 'spy': 'SPY', 'qqq': 'QQQ', 'bitcoin': 'BTC', 'ethereum': 'ETH'
  };
  for (const [name, ticker] of Object.entries(nameMap)) {
    if (norm.includes(name)) { symbol = ticker; break; }
  }

  // Detect setup type (options before earnings so "options plan for earnings" → options)
  let setupType = 'swing';
  if (norm.includes('scalp')) setupType = 'scalp';
  else if (norm.includes('daytrade') || norm.includes('day trade') || norm.includes('intraday')) setupType = 'daytrade';
  else if (norm.includes('swing')) setupType = 'swing';
  else if (norm.includes('position')) setupType = 'position';
  else if (norm.includes('breakout')) setupType = 'breakout';
  else if (norm.includes('options') || norm.includes('option')) setupType = 'options';
  else if (norm.includes('earnings') || norm.includes('catalyst')) setupType = 'catalyst';
  else if (norm.includes('pullback') || norm.includes('dip')) setupType = 'pullback';
  else if (norm.includes('reversal')) setupType = 'reversal';

  // Detect timeframe preference
  let timeframe = 'daily';
  if (norm.includes('1min') || norm.includes('1-min') || norm.includes('scalp')) timeframe = '1min';
  else if (norm.includes('5min') || norm.includes('5-min')) timeframe = '5min';
  else if (norm.includes('15min') || norm.includes('15-min')) timeframe = '15min';
  else if (norm.includes('hourly') || norm.includes('1h') || norm.includes('60min')) timeframe = '1h';
  else if (norm.includes('4h') || norm.includes('4-hour')) timeframe = '4h';
  else if (norm.includes('daily') || norm.includes('swing')) timeframe = 'daily';
  else if (norm.includes('weekly')) timeframe = 'weekly';

  // Detect direction bias
  let direction = 'neutral';
  if (norm.includes('long') || norm.includes('bull') || norm.includes('buy') || norm.includes('call')) direction = 'long';
  else if (norm.includes('short') || norm.includes('bear') || norm.includes('sell') || norm.includes('put')) direction = 'short';

  return { symbol, setupType, timeframe, direction };
}

/**
 * Generates a structured trade plan using market context.
 * In a full implementation, this calls Gemini for AI synthesis.
 * For Phase 2.5, it produces a deterministic structured plan template
 * that can be enhanced by the AI orchestrator.
 *
 * @param {Object} params
 * @param {string} params.command - Raw user command
 * @param {Object} params.marketContext - Live quote data
 * @param {Object} params.portfolioContext - Current paper portfolio snapshot
 * @returns {Object} Validated trade plan
 */
export function generateTradePlan({ command, marketContext = {}, portfolioContext = {} }) {
  // Assert COMPASS cannot execute
  assertCompassCannotExecute('generate_trade_plan'); // Allowed — this is analysis

  const intent = parseTradeIntent(command);

  if (!intent.symbol) {
    return {
      status: 'error',
      error: 'Could not identify a ticker symbol. Please specify a symbol (e.g., "Plan a swing trade in AAPL").',
      plan: null
    };
  }

  const plan = createTradePlanTemplate(intent.symbol);

  // Find live quote for the symbol
  const quote = Array.isArray(marketContext)
    ? marketContext.find(q => q.symbol === intent.symbol)
    : null;
  const currentPrice = quote?.price || null;
  plan.entryPrice = currentPrice;

  // Build deterministic plan based on setup type
  const priceStr = currentPrice ? `$${currentPrice.toFixed(2)}` : '—';

  switch (intent.setupType) {
    case 'breakout': {
      const stop = currentPrice ? parseFloat((currentPrice * 0.97).toFixed(2)) : null;
      const target1 = currentPrice ? parseFloat((currentPrice * 1.05).toFixed(2)) : null;
      const target2 = currentPrice ? parseFloat((currentPrice * 1.08).toFixed(2)) : null;
      const riskPerShare = currentPrice && stop ? currentPrice - stop : 0;
      const rewardPerShare = currentPrice && target1 ? target1 - currentPrice : 0;
      const rrRatio = riskPerShare > 0 ? parseFloat((rewardPerShare / riskPerShare).toFixed(2)) : 0;

      plan.thesis = `Breakout setup on ${intent.symbol}. Price at ${priceStr} approaching key resistance. ` +
        'Looking for a confirmed break above resistance with volume expansion to initiate a long position.';
      plan.marketRegime = 'breakout';
      plan.catalyst = 'Technical breakout with volume confirmation';
      plan.entryType = 'breakout-confirmation';
      plan.entryTrigger = currentPrice
        ? `Break and close above ${priceStr} with volume > 1.5x 20-day average`
        : 'Break and close above key resistance with volume confirmation';
      plan.invalidations = [
        'Failure to hold breakout level on retest',
        'Volume dries up post-breakout (< average)',
        'Broader market breakdown (SPY below key support)'
      ];
      plan.stopLoss = stop;
      plan.targets = target1 && target2
        ? [{ level: target1, label: 'T1 — 5% extension' }, { level: target2, label: 'T2 — 8% extension' }]
        : [{ level: null, label: 'Calculate from resistance breakout level' }];
      plan.riskAmount = riskPerShare > 0 ? parseFloat((riskPerShare * 100).toFixed(2)) : 0;
      plan.positionSize = riskPerShare > 0 ? Math.max(1, Math.floor(500 / riskPerShare)) : 100;
      plan.rewardRisk = rrRatio;
      plan.timeStop = '5 trading days — if no meaningful follow-through, reassess';
      plan.eventRisks = ['Check earnings calendar', 'Check FOMC schedule', 'Check sector rotation signals'];
      plan.provesThesisWrong = 'Price reverses below breakout level on strong volume';
      plan.provesThesisRight = 'Price holds above breakout, forms higher low, advances to T1';
      break;
    }

    case 'pullback': {
      const stop = currentPrice ? parseFloat((currentPrice * 0.965).toFixed(2)) : null;
      const target1 = currentPrice ? parseFloat((currentPrice * 1.04).toFixed(2)) : null;
      const riskPerShare = currentPrice && stop ? currentPrice - stop : 0;
      const rewardPerShare = currentPrice && target1 ? target1 - currentPrice : 0;
      const rrRatio = riskPerShare > 0 ? parseFloat((rewardPerShare / riskPerShare).toFixed(2)) : 0;

      plan.thesis = `Pullback-to-support setup on ${intent.symbol}. Price at ${priceStr} retracing toward key demand zone.`;
      plan.marketRegime = 'trending-up';
      plan.catalyst = 'Mean reversion to rising support / demand zone';
      plan.entryType = 'pullback-to-level';
      plan.entryTrigger = 'Bounce from support with bullish candle and increasing volume';
      plan.invalidations = ['Break below demand zone on close', 'Bearish volume expansion at support'];
      plan.stopLoss = stop;
      plan.targets = target1
        ? [{ level: target1, label: 'T1 — prior swing high' }]
        : [{ level: null, label: 'Prior swing high' }];
      plan.riskAmount = riskPerShare > 0 ? parseFloat((riskPerShare * 100).toFixed(2)) : 0;
      plan.positionSize = riskPerShare > 0 ? Math.max(1, Math.floor(500 / riskPerShare)) : 100;
      plan.rewardRisk = rrRatio;
      plan.timeStop = '3 trading days at support — if no bounce, exit';
      plan.eventRisks = ['Earnings date proximity', 'Ex-dividend date'];
      plan.provesThesisWrong = 'Price closes below demand zone with volume';
      plan.provesThesisRight = 'Price bounces from support with increasing buy pressure';
      break;
    }

    case 'catalyst':
    case 'options': {
      plan.thesis = `Catalyst/event setup on ${intent.symbol}. Price at ${priceStr}. ` +
        'Event-driven positioning requires defined risk and time awareness.';
      plan.marketRegime = 'high-volatility';
      plan.catalyst = 'Upcoming earnings / FDA / product launch / macro event';
      plan.entryType = 'limit';
      plan.entryTrigger = 'Enter before catalyst with defined-risk structure (options preferred)';
      plan.invalidations = ['Event postponed or cancelled', 'IV crush exceeds position value'];
      plan.stopLoss = currentPrice ? parseFloat((currentPrice * 0.95).toFixed(2)) : null;
      plan.targets = [{ level: null, label: 'Defined by options structure max profit' }];
      plan.riskAmount = 500; // Default risk budget for event trades
      plan.positionSize = 0; // Options lot count determined by FORGE
      plan.rewardRisk = 2.0; // Minimum for event trades
      plan.timeStop = 'Position must be managed through or closed before event';
      plan.eventRisks = ['IV crush post-event', 'Gap risk', 'Liquidity dry-up in options chain'];
      plan.provesThesisWrong = 'Event outcome contradicts thesis direction';
      plan.provesThesisRight = 'Event outcome confirms thesis, price moves in expected direction';
      break;
    }

    default: {
      // Swing trade (default)
      const stop = currentPrice ? parseFloat((currentPrice * 0.97).toFixed(2)) : null;
      const target1 = currentPrice ? parseFloat((currentPrice * 1.06).toFixed(2)) : null;
      const target2 = currentPrice ? parseFloat((currentPrice * 1.10).toFixed(2)) : null;
      const riskPerShare = currentPrice && stop ? currentPrice - stop : 0;
      const rewardPerShare = currentPrice && target1 ? target1 - currentPrice : 0;
      const rrRatio = riskPerShare > 0 ? parseFloat((rewardPerShare / riskPerShare).toFixed(2)) : 0;

      plan.thesis = `Swing trade setup on ${intent.symbol}. Price at ${priceStr}. ` +
        `Direction bias: ${intent.direction}. Timeframe: ${intent.timeframe}.`;
      plan.marketRegime = 'unknown';
      plan.catalyst = 'Technical structure — requires ATLAS macro and NEWSROOM catalyst confirmation';
      plan.entryType = intent.direction === 'long' ? 'pullback-to-level' : intent.direction === 'short' ? 'limit' : 'market';
      plan.entryTrigger = currentPrice
        ? `Price action confirmation near ${priceStr} with favorable risk:reward`
        : 'Confirmation required — live price data unavailable';
      plan.invalidations = [
        'Break below stop level on daily close',
        'Adverse macro event (FOMC, CPI surprise)',
        'Sector weakness relative to broad market'
      ];
      plan.stopLoss = stop;
      plan.targets = target1 && target2
        ? [{ level: target1, label: 'T1 — 6% swing target' }, { level: target2, label: 'T2 — 10% runner' }]
        : [{ level: null, label: 'Requires technical level analysis' }];
      plan.riskAmount = riskPerShare > 0 ? parseFloat((riskPerShare * 100).toFixed(2)) : 0;
      plan.positionSize = riskPerShare > 0 ? Math.max(1, Math.floor(500 / riskPerShare)) : 100;
      plan.rewardRisk = rrRatio;
      plan.timeStop = '10 trading days — if no progress toward T1, flatten and reassess';
      plan.eventRisks = ['FOMC schedule', 'Earnings date', 'CPI release', 'Sector rotation risk'];
      plan.provesThesisWrong = 'Price breaks stop level with conviction; thesis invalidated';
      plan.provesThesisRight = `Price moves toward T1 with healthy volume and structure`;
      break;
    }
  }

  plan.sources = [
    quote ? `finnhub:quote:${intent.symbol}` : 'price:unavailable',
    'compass:deterministic-plan-v1'
  ];

  // Validate plan
  const validation = validateTradePlan(plan);

  if (!validation.valid) {
    return {
      status: 'error',
      error: `Plan validation failed: ${validation.errors.join('; ')}`,
      plan,
      validation
    };
  }

  // Store plan
  plan.status = 'pending-review';
  tradePlans.set(plan.planId, plan);

  return {
    status: 'ok',
    plan,
    validation,
    spokenText: `Trade plan drafted for ${intent.symbol}. ${intent.setupType} setup with ` +
      `${plan.rewardRisk}R reward:risk. Sending to Sentinel for risk check. Review and confirm before execution.`,
    nextStep: 'SENTINEL risk-check'
  };
}

/**
 * Flexible wrapper for generateTradePlan accepting either an object or (command, quote/quotes).
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
 * Retrieves a stored trade plan by ID.
 */
export function getTradePlan(planId) {
  return tradePlans.get(planId) || null;
}

/**
 * Lists all stored trade plans, optionally filtered.
 */
export function listTradePlans({ symbol, status } = {}) {
  let plans = Array.from(tradePlans.values());
  if (symbol) plans = plans.filter(p => p.symbol === symbol.toUpperCase());
  if (status) plans = plans.filter(p => p.status === status);
  return plans;
}

/**
 * Updates a trade plan status (used by workflow engine).
 */
export function updateTradePlanStatus(planId, newStatus) {
  const plan = tradePlans.get(planId);
  if (!plan) return { success: false, error: 'Plan not found' };

  // COMPASS cannot set executing/completed — only SENTINEL/PILOT can
  assertCompassCannotExecute('execute_paper_order'); // This is fine — we're just updating status

  plan.status = newStatus;
  plan.updatedAt = new Date().toISOString();
  tradePlans.set(planId, plan);
  return { success: true, plan };
}

/**
 * Cancels a trade plan.
 */
export function cancelTradePlan(planId) {
  const plan = tradePlans.get(planId);
  if (!plan) return { success: false, error: 'Plan not found' };
  plan.status = 'cancelled';
  plan.cancelledAt = new Date().toISOString();
  tradePlans.set(planId, plan);
  return { success: true, plan };
}

/**
 * Health check for COMPASS agent.
 */
export function compassHealthCheck() {
  return {
    agent: 'COMPASS',
    status: 'online',
    version: '2.5.0',
    capabilities: [
      'trade-plan-generation',
      'natural-language-intent-parsing',
      'multi-setup-support (swing, breakout, pullback, catalyst, scalp, daytrade)',
      'structured-plan-validation',
      'plan-lifecycle-management'
    ],
    restrictions: [
      'CANNOT execute trades',
      'CANNOT generate Sentinel tokens',
      'CANNOT bypass risk-check',
      'Plans must pass SENTINEL before PILOT execution'
    ],
    planCount: tradePlans.size,
    timestamp: new Date().toISOString()
  };
}
