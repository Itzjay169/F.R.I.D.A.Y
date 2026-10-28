/**
 * ARCHIVE — Trade Review Engine
 * Phase 6.5: Automated trade review drafting and scoring
 *
 * Creates structured post-trade reviews from paper trade data.
 *
 * Rules:
 * - A losing trade CAN have a high process score
 * - A winning trade CAN have a low process score
 * - Model-generated observations MUST be labelled 'model-generated'
 * - NEVER infer emotions unless user explicitly states them
 *
 * Privacy: all computation is local.
 */

import crypto from 'crypto';
import {
  saveTradeReview,
  getTradeReview,
  listTradeReviews,
  getArchiveDb
} from './archivePersistence.js';

// =============================================================================
// HELPERS
// =============================================================================

function makeId(prefix = 'rv') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function now() {
  return new Date().toISOString();
}

// =============================================================================
// PROCESS SCORE COMPUTATION
// =============================================================================

/**
 * Computes a process score (0-100) based on plan adherence.
 * This is independent of trade outcome (win/loss).
 * 
 * Scoring criteria:
 * - Had a plan before entry (+20)
 * - Entry at planned level (+15)
 * - Stop placed at planned level (+20)
 * - Target at planned level (+15)
 * - Position size within plan (+15)
 * - Did not add to losing position (+15)
 * 
 * @param {object} tradeData
 * @param {object} planData - Original trade plan, if available
 * @returns {{ score: number, breakdown: object[], model_generated: boolean }}
 */
export function computeProcessScore(tradeData, planData = null) {
  const breakdown = [];
  let score = 0;

  // Had a plan?
  const hadPlan = planData !== null && planData !== undefined;
  breakdown.push({
    criterion: 'Had a trade plan before entry',
    points: hadPlan ? 20 : 0,
    max: 20,
    model_generated: true
  });
  if (hadPlan) score += 20;

  if (hadPlan) {
    // Entry at planned level?
    const entryOk = tradeData.entry_price && planData.entry &&
      Math.abs(tradeData.entry_price - planData.entry) / planData.entry < 0.02;
    breakdown.push({
      criterion: 'Entry at planned level (within 2%)',
      points: entryOk ? 15 : 0,
      max: 15,
      model_generated: true
    });
    if (entryOk) score += 15;

    // Stop placed?
    const stopOk = tradeData.stop_price && planData.stop &&
      Math.abs(tradeData.stop_price - planData.stop) / planData.stop < 0.03;
    breakdown.push({
      criterion: 'Stop at planned level (within 3%)',
      points: stopOk ? 20 : 0,
      max: 20,
      model_generated: true
    });
    if (stopOk) score += 20;

    // Target placed?
    const targetOk = tradeData.target_price && planData.targets &&
      planData.targets.length > 0;
    breakdown.push({
      criterion: 'Target at planned level',
      points: targetOk ? 15 : 0,
      max: 15,
      model_generated: true
    });
    if (targetOk) score += 15;

    // Position size within plan?
    const sizeOk = tradeData.qty && planData.position_size &&
      tradeData.qty <= planData.position_size * 1.1; // 10% tolerance
    breakdown.push({
      criterion: 'Position size within plan (10% tolerance)',
      points: sizeOk ? 15 : 0,
      max: 15,
      model_generated: true
    });
    if (sizeOk) score += 15;

    // Did not add to losing position?
    const noAdd = !tradeData.added_to_loser;
    breakdown.push({
      criterion: 'Did not add to losing position',
      points: noAdd ? 15 : 0,
      max: 15,
      model_generated: true
    });
    if (noAdd) score += 15;
  } else {
    // No plan — cap at lower score, evaluate what we can
    const hasStop = tradeData.stop_price !== undefined && tradeData.stop_price !== null;
    breakdown.push({
      criterion: 'Stop loss placed (no plan reference)',
      points: hasStop ? 30 : 0,
      max: 30,
      model_generated: true
    });
    if (hasStop) score += 30;

    const hasTarget = tradeData.target_price !== undefined && tradeData.target_price !== null;
    breakdown.push({
      criterion: 'Target set (no plan reference)',
      points: hasTarget ? 25 : 0,
      max: 25,
      model_generated: true
    });
    if (hasTarget) score += 25;

    const noAdd = !tradeData.added_to_loser;
    breakdown.push({
      criterion: 'Did not add to losing position',
      points: noAdd ? 25 : 0,
      max: 25,
      model_generated: true
    });
    if (noAdd) score += 25;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown,
    model_generated: true
  };
}

// =============================================================================
// DISCIPLINE SCORE COMPUTATION
// =============================================================================

/**
 * Computes a discipline score (0-100) based on rule-following
 * @param {object} tradeData
 * @param {object} planData
 * @returns {{ score: number, breakdown: object[], model_generated: boolean }}
 */
export function computeDisciplineScore(tradeData, planData = null) {
  const breakdown = [];
  let score = 100; // Start at 100, deduct

  // Did they move their stop? (deduct 20)
  if (tradeData.stop_moved_against) {
    score -= 20;
    breakdown.push({
      criterion: 'Moved stop against position',
      deduction: -20,
      model_generated: true
    });
  }

  // Did they exit early without reason? (deduct 15)
  if (tradeData.exited_early_no_reason) {
    score -= 15;
    breakdown.push({
      criterion: 'Exited early without documented reason',
      deduction: -15,
      model_generated: true
    });
  }

  // Did they add to a losing position? (deduct 25)
  if (tradeData.added_to_loser) {
    score -= 25;
    breakdown.push({
      criterion: 'Added to losing position',
      deduction: -25,
      model_generated: true
    });
  }

  // Did they exceed planned position size? (deduct 15)
  if (planData && tradeData.qty && planData.position_size) {
    if (tradeData.qty > planData.position_size * 1.1) {
      score -= 15;
      breakdown.push({
        criterion: 'Exceeded planned position size',
        deduction: -15,
        model_generated: true
      });
    }
  }

  // Did they ignore a Sentinel warning? (deduct 25)
  if (tradeData.ignored_sentinel_warning) {
    score -= 25;
    breakdown.push({
      criterion: 'Ignored Sentinel risk warning',
      deduction: -25,
      model_generated: true
    });
  }

  if (breakdown.length === 0) {
    breakdown.push({
      criterion: 'No discipline violations detected',
      deduction: 0,
      model_generated: true
    });
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown,
    model_generated: true
  };
}

// =============================================================================
// REVIEW DRAFTING
// =============================================================================

/**
 * Drafts a trade review from trade data and optional plan data.
 * All model-generated content is clearly labelled.
 *
 * @param {object} params
 * @param {string} params.trade_id
 * @param {string} params.symbol
 * @param {object} params.tradeData - { entry_price, exit_price, qty, side, pnl, ... }
 * @param {object} [params.planData] - Original trade plan, if available
 * @param {string} [params.user_notes] - User's own notes
 * @param {string[]} [params.emotional_tags] - Only if user provided them
 * @param {DatabaseSync} [db]
 * @returns {object} Draft trade review (not yet saved)
 */
export function draftTradeReview(params, db = getArchiveDb()) {
  const { trade_id, symbol, tradeData = {}, planData = null, user_notes = '', emotional_tags = [] } = params;

  // Check if review already exists
  const existing = getTradeReview(trade_id, db);
  if (existing) {
    return { exists: true, review: existing };
  }

  // Compute outcome
  const pnl = tradeData.pnl || tradeData.realized_pnl || 0;
  let outcome = 'open';
  if (tradeData.closed) {
    outcome = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'scratch';
  }

  // Compute R-multiple if we have stop and entry
  let resultR = null;
  if (tradeData.entry_price && tradeData.exit_price && tradeData.stop_price) {
    const riskPerShare = Math.abs(tradeData.entry_price - tradeData.stop_price);
    if (riskPerShare > 0) {
      const rewardPerShare = tradeData.exit_price - tradeData.entry_price;
      resultR = Math.round((rewardPerShare / riskPerShare) * 100) / 100;
      // Invert for shorts
      if (tradeData.side === 'sell' || tradeData.side === 'short') {
        resultR = -resultR;
      }
    }
  }

  // Compute scores
  const processResult = computeProcessScore(tradeData, planData);
  const disciplineResult = computeDisciplineScore(tradeData, planData);

  // Model-generated observations
  const whatWentRight = [];
  const whatWentWrong = [];
  const mistakes = [];
  const lessons = [];

  if (outcome === 'win') {
    whatWentRight.push('[model-generated] Trade closed in profit');
    if (processResult.score >= 80) {
      whatWentRight.push('[model-generated] High process adherence');
    }
    if (planData && tradeData.entry_price) {
      whatWentRight.push('[model-generated] Entered with a pre-defined plan');
    }
  }

  if (outcome === 'loss') {
    if (tradeData.stop_price) {
      whatWentRight.push('[model-generated] Had a stop loss in place');
    }
    whatWentWrong.push(`[model-generated] Trade closed at a loss (${resultR !== null ? resultR + 'R' : '$' + pnl.toFixed(2)})`);
  }

  if (tradeData.added_to_loser) {
    mistakes.push('[model-generated] Added to losing position');
    lessons.push('[model-generated] Avoid adding to losing positions — define max risk before entry');
  }

  if (tradeData.stop_moved_against) {
    mistakes.push('[model-generated] Moved stop against the position');
    lessons.push('[model-generated] Honor original stop placement — moving stops increases risk');
  }

  if (!planData) {
    mistakes.push('[model-generated] Traded without a documented plan');
    lessons.push('[model-generated] Create a trade plan before entering — define entry, stop, and target');
  }

  // Thesis validation
  let thesisValidated = null;
  if (planData && planData.thesis) {
    if (outcome === 'win') thesisValidated = true;
    // Don't auto-set false for losses — thesis could be right but timing wrong
  }

  // Followed plan?
  let followedPlan = null;
  if (planData) {
    followedPlan = processResult.score >= 70;
  }

  const review = {
    review_id: makeId('rv'),
    trade_id,
    symbol: (symbol || '').toUpperCase(),
    outcome,
    result_r: resultR,
    process_score: processResult.score,
    discipline_score: disciplineResult.score,
    what_went_right: whatWentRight,
    what_went_wrong: whatWentWrong,
    mistakes,
    lessons,
    market_context: tradeData.market_context || '',
    thesis_at_entry: planData?.thesis || tradeData.thesis || '',
    thesis_validated: thesisValidated,
    followed_plan: followedPlan,
    emotional_tags, // Only user-provided, never inferred
    user_notes,
    model_notes: `[model-generated] Process score: ${processResult.score}/100. Discipline score: ${disciplineResult.score}/100.`,
    created_at: now()
  };

  return { exists: false, review, processBreakdown: processResult.breakdown, disciplineBreakdown: disciplineResult.breakdown };
}

// =============================================================================
// SAVE & UPDATE REVIEW
// =============================================================================

/**
 * Saves a drafted trade review to the database
 * @param {object} review
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function saveReview(review, db = getArchiveDb()) {
  return saveTradeReview(review, db);
}

/**
 * Updates an existing review with user edits
 * @param {string} tradeId
 * @param {object} updates
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function updateReview(tradeId, updates, db = getArchiveDb()) {
  const existing = getTradeReview(tradeId, db);
  if (!existing) {
    throw new Error(`No review found for trade ${tradeId}`);
  }

  const merged = {
    ...existing,
    ...updates,
    // Preserve lists — merge rather than replace
    what_went_right: updates.what_went_right || existing.what_went_right,
    what_went_wrong: updates.what_went_wrong || existing.what_went_wrong,
    mistakes: updates.mistakes || existing.mistakes,
    lessons: updates.lessons || existing.lessons,
    emotional_tags: updates.emotional_tags || existing.emotional_tags
  };

  return saveTradeReview(merged, db);
}

// =============================================================================
// REVIEW STATISTICS
// =============================================================================

/**
 * Computes aggregate review statistics across all reviews
 * @param {object} [filters] - { symbol, outcome, limit }
 * @param {DatabaseSync} [db]
 * @returns {object} Aggregate stats
 */
export function getReviewStats(filters = {}, db = getArchiveDb()) {
  const reviews = listTradeReviews(filters, db);

  if (reviews.length === 0) {
    return {
      model_generated: true,
      total_reviews: 0,
      avg_process_score: null,
      avg_discipline_score: null,
      most_common_mistakes: [],
      most_common_lessons: [],
      outcome_breakdown: {}
    };
  }

  // Average scores
  const avgProcess = Math.round(
    reviews.reduce((a, r) => a + r.process_score, 0) / reviews.length
  );
  const avgDiscipline = Math.round(
    reviews.reduce((a, r) => a + r.discipline_score, 0) / reviews.length
  );

  // Outcome breakdown
  const outcomes = {};
  for (const r of reviews) {
    outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
  }

  // Frequency of mistakes
  const mistakeCounts = {};
  for (const r of reviews) {
    for (const m of (r.mistakes || [])) {
      const key = m.replace('[model-generated] ', '').toLowerCase().trim();
      mistakeCounts[key] = (mistakeCounts[key] || 0) + 1;
    }
  }

  // Frequency of lessons
  const lessonCounts = {};
  for (const r of reviews) {
    for (const l of (r.lessons || [])) {
      const key = l.replace('[model-generated] ', '').toLowerCase().trim();
      lessonCounts[key] = (lessonCounts[key] || 0) + 1;
    }
  }

  const topMistakes = Object.entries(mistakeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([mistake, count]) => ({ mistake, count }));

  const topLessons = Object.entries(lessonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lesson, count]) => ({ lesson, count }));

  return {
    model_generated: true,
    total_reviews: reviews.length,
    avg_process_score: avgProcess,
    avg_discipline_score: avgDiscipline,
    most_common_mistakes: topMistakes,
    most_common_lessons: topLessons,
    outcome_breakdown: outcomes
  };
}

/**
 * Computes a "learning curve" showing how process/discipline scores
 * evolve over time
 * @param {number} [windowSize=5] - Rolling window size
 * @param {DatabaseSync} [db]
 * @returns {object[]} Array of { period, avg_process, avg_discipline, trade_count }
 */
export function getLearningCurve(windowSize = 5, db = getArchiveDb()) {
  const reviews = listTradeReviews({ limit: 500 }, db);
  if (reviews.length < windowSize) {
    return [{
      model_generated: true,
      period: 1,
      avg_process: reviews.length > 0 ? Math.round(reviews.reduce((a, r) => a + r.process_score, 0) / reviews.length) : 0,
      avg_discipline: reviews.length > 0 ? Math.round(reviews.reduce((a, r) => a + r.discipline_score, 0) / reviews.length) : 0,
      trade_count: reviews.length
    }];
  }

  // Sort by created_at ascending
  reviews.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

  const curve = [];
  for (let i = 0; i <= reviews.length - windowSize; i++) {
    const window = reviews.slice(i, i + windowSize);
    curve.push({
      model_generated: true,
      period: i + 1,
      avg_process: Math.round(window.reduce((a, r) => a + r.process_score, 0) / windowSize),
      avg_discipline: Math.round(window.reduce((a, r) => a + r.discipline_score, 0) / windowSize),
      trade_count: windowSize
    });
  }

  return curve;
}
