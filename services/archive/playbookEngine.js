/**
 * ARCHIVE — Playbook Generation & Backtesting Engine
 * Phase 6.5: Create, analyze, and backtest trading playbooks
 *
 * A playbook is a formalized, reusable trading strategy derived from
 * the trader's own closed trades and review history. This engine:
 *
 * 1. Analyzes groups of closed trades to find common patterns
 * 2. Generates playbook rules (entry, stop, target, sizing, invalidation)
 * 3. Computes performance statistics (win rate, avg R, profit factor, drawdown)
 * 4. Backtests playbooks against the user's trade history
 *
 * Model-generated observations are labelled as such.
 * Privacy: all computation is local.
 */

import crypto from 'crypto';
import {
  savePlaybook,
  getPlaybook,
  listPlaybooks,
  getArchiveDb
} from './archivePersistence.js';

// =============================================================================
// HELPERS
// =============================================================================

function makeId(prefix = 'pb') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function now() {
  return new Date().toISOString();
}

// =============================================================================
// PERFORMANCE STATISTICS
// =============================================================================

/**
 * Computes performance summary statistics from a set of trade results
 * @param {{ result_r: number|null, outcome: string }[]} trades
 * @returns {object} PlaybookPerformanceSummary
 */
export function computePerformanceStats(trades) {
  const closed = trades.filter(t => t.outcome && t.outcome !== 'open');
  if (closed.length === 0) {
    return {
      trade_count: 0,
      win_rate: 0,
      average_r: 0,
      profit_factor: 0,
      max_drawdown: 0,
      calculated_at: now(),
      data_range: { from: '—', to: '—' }
    };
  }

  const wins = closed.filter(t => t.outcome === 'win');
  const losses = closed.filter(t => t.outcome === 'loss');
  const scratches = closed.filter(t => t.outcome === 'scratch');

  const winRate = closed.length > 0 ? wins.length / closed.length : 0;

  // Average R
  const rValues = closed.map(t => t.result_r).filter(r => r !== null && r !== undefined);
  const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0;

  // Profit factor = gross profit / gross loss
  const grossProfit = rValues.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(rValues.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Max drawdown (sequential)
  let peak = 0;
  let drawdown = 0;
  let maxDrawdown = 0;
  let cumR = 0;
  for (const r of rValues) {
    cumR += r;
    if (cumR > peak) peak = cumR;
    drawdown = peak - cumR;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Date range
  const dates = closed
    .map(t => t.created_at || t.closed_at)
    .filter(Boolean)
    .sort();

  return {
    trade_count: closed.length,
    win_rate: Math.round(winRate * 1000) / 1000,
    average_r: Math.round(avgR * 100) / 100,
    profit_factor: profitFactor === Infinity ? 999 : Math.round(profitFactor * 100) / 100,
    max_drawdown: Math.round(maxDrawdown * 100) / 100,
    calculated_at: now(),
    data_range: {
      from: dates[0] || '—',
      to: dates[dates.length - 1] || '—'
    }
  };
}

// =============================================================================
// PATTERN EXTRACTION (model-generated)
// =============================================================================

/**
 * Extracts common patterns from a set of trade reviews
 * All output is labelled as model-generated
 * @param {object[]} reviews - Trade review objects
 * @returns {object} Extracted patterns
 */
export function extractPatterns(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      model_generated: true,
      common_setups: [],
      common_mistakes: [],
      recurring_lessons: [],
      best_conditions: [],
      worst_conditions: []
    };
  }

  // Count setup types
  const setupCounts = {};
  const mistakeCounts = {};
  const lessonCounts = {};

  for (const r of reviews) {
    // Count mistakes
    for (const m of (r.mistakes || [])) {
      const key = m.toLowerCase().trim();
      mistakeCounts[key] = (mistakeCounts[key] || 0) + 1;
    }
    // Count lessons
    for (const l of (r.lessons || [])) {
      const key = l.toLowerCase().trim();
      lessonCounts[key] = (lessonCounts[key] || 0) + 1;
    }
  }

  // Sort by frequency
  const sortByCount = (obj) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ pattern: key, count }));

  const winning = reviews.filter(r => r.outcome === 'win');
  const losing = reviews.filter(r => r.outcome === 'loss');

  return {
    model_generated: true,
    common_mistakes: sortByCount(mistakeCounts),
    recurring_lessons: sortByCount(lessonCounts),
    win_market_contexts: winning
      .map(r => r.market_context)
      .filter(Boolean)
      .slice(0, 5),
    loss_market_contexts: losing
      .map(r => r.market_context)
      .filter(Boolean)
      .slice(0, 5),
    avg_process_score_wins: winning.length > 0
      ? Math.round(winning.reduce((a, r) => a + r.process_score, 0) / winning.length)
      : null,
    avg_process_score_losses: losing.length > 0
      ? Math.round(losing.reduce((a, r) => a + r.process_score, 0) / losing.length)
      : null
  };
}

// =============================================================================
// PLAYBOOK GENERATION
// =============================================================================

/**
 * Generates a playbook from a set of trade reviews and their associated trades
 * @param {object} params
 * @param {string} params.name - Playbook name
 * @param {string} params.description - Description
 * @param {object[]} params.reviews - Trade review objects
 * @param {object} [params.rules] - Optional explicit rules
 * @param {DatabaseSync} [db]
 * @returns {object} Saved playbook
 */
export function generatePlaybook(params, db = getArchiveDb()) {
  const { name, description, reviews = [], rules = {} } = params;

  // Compute performance from reviews
  const perfStats = computePerformanceStats(reviews);

  // Extract symbols and timeframes from reviews
  const symbols = [...new Set(reviews.map(r => r.symbol).filter(Boolean))];
  const timeframes = [...new Set(reviews.map(r => r.timeframe).filter(Boolean))];

  // Extract trade IDs
  const tradeIds = reviews.map(r => r.trade_id).filter(Boolean);

  const playbook = {
    playbook_id: makeId('pb'),
    name: name || `Playbook ${now().slice(0, 10)}`,
    description: description || `[model-generated] Playbook created from ${reviews.length} trades`,
    market_regime: rules.market_regime || 'all',
    symbols,
    timeframes: timeframes.length > 0 ? timeframes : ['swing'],
    entry_rules: rules.entry_rules || ['[model-generated] Derived from winning trade entries'],
    invalidation_rules: rules.invalidation_rules || [],
    stop_rules: rules.stop_rules || ['[model-generated] Derived from trade stop levels'],
    target_rules: rules.target_rules || ['[model-generated] Derived from trade target levels'],
    position_sizing_rules: rules.position_sizing_rules || [],
    event_filters: rules.event_filters || [],
    required_context: rules.required_context || [],
    example_trade_ids: tradeIds.slice(0, 10),
    performance_summary: perfStats,
    created_at: now(),
    updated_at: now()
  };

  return savePlaybook(playbook, db);
}

// =============================================================================
// BACKTEST PLAYBOOK AGAINST TRADE HISTORY
// =============================================================================

/**
 * Backtests a playbook against the user's closed trade reviews
 * @param {string} playbookId
 * @param {object[]} allReviews - All trade reviews to test against
 * @param {DatabaseSync} [db]
 * @returns {object} Backtest result
 */
export function backtestPlaybook(playbookId, allReviews, db = getArchiveDb()) {
  const playbook = getPlaybook(playbookId, db);
  if (!playbook) {
    throw new Error(`Playbook ${playbookId} not found`);
  }

  // Filter reviews that match playbook criteria
  const matching = allReviews.filter(r => {
    // Symbol match
    if (playbook.symbols.length > 0 && !playbook.symbols.includes(r.symbol)) return false;
    // Must be closed
    if (!r.outcome || r.outcome === 'open') return false;
    return true;
  });

  const included = matching.map(r => r.trade_id);
  const stats = computePerformanceStats(matching);

  // Compare to playbook's original performance
  const original = playbook.performance_summary;
  const delta = {
    win_rate_delta: stats.win_rate - (original.win_rate || 0),
    avg_r_delta: stats.average_r - (original.average_r || 0),
    trade_count_delta: stats.trade_count - (original.trade_count || 0)
  };

  return {
    model_generated: true,
    playbook_id: playbookId,
    playbook_name: playbook.name,
    tested_trades: matching.length,
    included_trade_ids: included,
    performance: stats,
    comparison_to_original: delta,
    tested_at: now()
  };
}

// =============================================================================
// EXPECTANCY ANALYSIS
// =============================================================================

/**
 * Computes setup-level expectancy from reviews grouped by setup type
 * @param {object[]} reviews - Trade reviews with setup info
 * @returns {object[]} Ranked setups by expectancy
 */
export function analyzeExpectancy(reviews) {
  const bySetup = {};

  for (const r of reviews) {
    const setup = r.setup || r.market_context?.split(' ')[0] || 'unknown';
    if (!bySetup[setup]) bySetup[setup] = [];
    bySetup[setup].push(r);
  }

  const results = Object.entries(bySetup).map(([setup, trades]) => {
    const stats = computePerformanceStats(trades);
    // Expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)
    const rValues = trades.map(t => t.result_r).filter(r => r !== null && r !== undefined);
    const avgWin = rValues.filter(r => r > 0).length > 0
      ? rValues.filter(r => r > 0).reduce((a, b) => a + b, 0) / rValues.filter(r => r > 0).length
      : 0;
    const avgLoss = rValues.filter(r => r < 0).length > 0
      ? Math.abs(rValues.filter(r => r < 0).reduce((a, b) => a + b, 0) / rValues.filter(r => r < 0).length)
      : 0;
    const expectancy = (stats.win_rate * avgWin) - ((1 - stats.win_rate) * avgLoss);

    return {
      model_generated: true,
      setup,
      trade_count: stats.trade_count,
      win_rate: stats.win_rate,
      average_r: stats.average_r,
      expectancy: Math.round(expectancy * 100) / 100,
      profit_factor: stats.profit_factor,
      avg_win: Math.round(avgWin * 100) / 100,
      avg_loss: Math.round(avgLoss * 100) / 100
    };
  });

  results.sort((a, b) => b.expectancy - a.expectancy);
  return results;
}
