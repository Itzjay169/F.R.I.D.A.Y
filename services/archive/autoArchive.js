/**
 * ARCHIVE — Automatic Archiving Hooks
 * Phase 6.5: Event-driven capture of desk activity into ARCHIVE
 *
 * These hooks are called by the desk's existing subsystems to automatically
 * record events as research items, creating a living knowledge graph.
 *
 * Captured events:
 * - Completed trade plans (from COMPASS / workflow)
 * - Paper fills (from PILOT / paperEngine)
 * - Position closes (win/loss/scratch)
 * - Sentinel vetoes and risk warnings
 * - News and filing events
 * - Alert triggers (from RELAY)
 *
 * Privacy: all data stays in local SQLite. No cloud uploads.
 */

import crypto from 'crypto';
import {
  saveResearchItem,
  getArchiveDb,
  saveEmbedding
} from './archivePersistence.js';
import { generateLocalEmbedding } from './retrieval.js';
import { draftTradeReview, saveReview } from './reviewEngine.js';

// =============================================================================
// HELPERS
// =============================================================================

function makeId(prefix = 'ri') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function now() {
  return new Date().toISOString();
}

/**
 * Saves item and generates/stores its embedding for semantic search
 */
function archiveAndEmbed(item, db) {
  const saved = saveResearchItem(item, db);

  // Generate and store embedding for semantic search
  try {
    const text = [item.title, item.thesis, item.body, (item.tags || []).join(' ')].join(' ');
    const vector = generateLocalEmbedding(text);
    saveEmbedding(item.item_id, vector, db);
  } catch (e) {
    // Embedding is optional; don't block archiving
    console.warn('[AUTO-ARCHIVE] Embedding generation skipped:', e.message);
  }

  return saved;
}

// =============================================================================
// WORKFLOW / TRADE PLAN COMPLETED
// =============================================================================

/**
 * Archives a completed trade plan from COMPASS/workflow
 * @param {object} plan - Trade plan object
 * @param {object} [workflow] - Workflow metadata
 * @param {DatabaseSync} [db]
 * @returns {object} saved research item
 */
export function archiveTradePlan(plan, workflow = null, db = getArchiveDb()) {
  const symbol = plan.symbol || plan.ticker || '—';
  const item = {
    item_id: makeId('tp'),
    kind: 'trade_plan',
    title: `Trade Plan: ${symbol} ${plan.direction || 'neutral'} ${plan.timeframe || 'swing'}`,
    symbol: symbol.toUpperCase(),
    symbols: [symbol.toUpperCase()],
    asset_class: plan.asset_class || 'equity',
    timeframe: plan.timeframe || 'swing',
    market_regime: plan.market_regime || null,
    setup: plan.setup || null,
    thesis: plan.thesis || plan.summary || '',
    body: JSON.stringify({
      entry: plan.entry,
      stop: plan.stop,
      targets: plan.targets,
      risk_reward: plan.risk_reward,
      position_size: plan.position_size,
      direction: plan.direction,
      sentinel_verdict: plan.sentinel_verdict
    }, null, 2),
    tags: [
      'trade_plan',
      symbol.toLowerCase(),
      plan.direction || 'neutral',
      plan.timeframe || 'swing'
    ].filter(Boolean),
    source_refs: [],
    linked_trade_ids: plan.trade_id ? [plan.trade_id] : [],
    linked_workflow_ids: workflow ? [workflow.workflow_id] : [],
    linked_news_ids: [],
    linked_filing_ids: [],
    confidence: plan.confidence || 1.0,
    user_authored: false,
    model_generated: true,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}

// =============================================================================
// PAPER FILL (POSITION OPENED)
// =============================================================================

/**
 * Archives a paper fill event
 * @param {object} fill - Fill object from paperEngine
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archivePaperFill(fill, db = getArchiveDb()) {
  const symbol = (fill.symbol || '').toUpperCase();
  const item = {
    item_id: makeId('pf'),
    kind: 'note',
    title: `Paper Fill: ${fill.side || 'buy'} ${fill.qty || 0} ${symbol} @ ${fill.fill_price || '—'}`,
    symbol,
    symbols: [symbol],
    asset_class: fill.asset_class || 'equity',
    timeframe: fill.timeframe || 'swing',
    market_regime: null,
    setup: null,
    thesis: `Paper ${fill.side || 'buy'} order filled for ${symbol}`,
    body: JSON.stringify({
      order_id: fill.order_id,
      fill_price: fill.fill_price,
      qty: fill.qty,
      side: fill.side,
      filled_at: fill.filled_at,
      sentinel_token: fill.sentinel_token ? '✓ approved' : '—'
    }, null, 2),
    tags: ['paper_fill', symbol.toLowerCase(), fill.side || 'buy'],
    source_refs: [],
    linked_trade_ids: fill.order_id ? [fill.order_id] : [],
    linked_workflow_ids: [],
    linked_news_ids: [],
    linked_filing_ids: [],
    confidence: 1.0,
    user_authored: false,
    model_generated: false,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}

// =============================================================================
// POSITION CLOSED
// =============================================================================

/**
 * Archives a position close event
 * @param {object} closeResult - Close result from paperEngine
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archivePositionClose(closeResult, db = getArchiveDb()) {
  const symbol = (closeResult.symbol || '').toUpperCase();
  const pnl = closeResult.realized_pnl || closeResult.pnl || 0;
  const outcome = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'scratch';

  const item = {
    item_id: makeId('pc'),
    kind: 'note',
    title: `Position Closed: ${symbol} — ${outcome} ($${pnl.toFixed(2)})`,
    symbol,
    symbols: [symbol],
    asset_class: closeResult.asset_class || 'equity',
    timeframe: 'swing',
    market_regime: null,
    setup: null,
    thesis: `Closed ${symbol} position with ${outcome} outcome. P&L: $${pnl.toFixed(2)}`,
    body: JSON.stringify({
      entry_price: closeResult.entry_price || closeResult.avg_price,
      exit_price: closeResult.exit_price || closeResult.close_price,
      qty: closeResult.qty,
      pnl,
      outcome,
      hold_duration: closeResult.hold_duration,
      closed_at: closeResult.closed_at || now()
    }, null, 2),
    tags: ['position_close', symbol.toLowerCase(), outcome],
    source_refs: [],
    linked_trade_ids: closeResult.order_id ? [closeResult.order_id] : [],
    linked_workflow_ids: [],
    linked_news_ids: [],
    linked_filing_ids: [],
    confidence: 1.0,
    user_authored: false,
    model_generated: false,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  const saved = archiveAndEmbed(item, db);

  // Automatically create a draft review for the closed trade (Section 7, Test 5)
  const tradeId = closeResult.order_id || closeResult.trade_id || saved.item_id;
  try {
    const draft = draftTradeReview({
      trade_id: tradeId,
      symbol,
      tradeData: {
        closed: true,
        pnl,
        entry_price: closeResult.entry_price || closeResult.avg_price,
        exit_price: closeResult.exit_price || closeResult.close_price,
        stop_price: closeResult.stop_price,
        side: closeResult.side || 'buy',
        market_context: closeResult.market_context || ''
      }
    }, db);
    if (!draft.exists) {
      saveReview(draft.review, db);
    }
  } catch (err) {
    console.warn('[AUTO-ARCHIVE] Auto draft review error:', err.message);
  }

  return saved;
}

// =============================================================================
// SENTINEL VETO
// =============================================================================

/**
 * Archives a Sentinel risk veto
 * @param {object} verdict - Sentinel verdict object
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archiveSentinelVeto(verdict, db = getArchiveDb()) {
  const symbol = (verdict.symbol || '').toUpperCase();

  const item = {
    item_id: makeId('sv'),
    kind: 'note',
    title: `Sentinel Veto: ${symbol} — ${verdict.decision || 'reject'}`,
    symbol,
    symbols: [symbol],
    asset_class: verdict.asset_class || 'equity',
    timeframe: 'swing',
    market_regime: null,
    setup: null,
    thesis: `Sentinel ${verdict.decision || 'rejected'} trade in ${symbol}. Reason: ${verdict.reason || '—'}`,
    body: JSON.stringify({
      decision: verdict.decision,
      reason: verdict.reason,
      risk_flags: verdict.risk_flags || [],
      max_loss: verdict.max_loss,
      position_pct: verdict.position_pct,
      warnings: verdict.warnings || [],
      evaluated_at: verdict.evaluated_at || now()
    }, null, 2),
    tags: ['sentinel_veto', symbol.toLowerCase(), 'risk'],
    source_refs: [],
    linked_trade_ids: verdict.order_id ? [verdict.order_id] : [],
    linked_workflow_ids: verdict.workflow_id ? [verdict.workflow_id] : [],
    linked_news_ids: [],
    linked_filing_ids: [],
    confidence: 1.0,
    user_authored: false,
    model_generated: true,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}

// =============================================================================
// NEWS EVENT
// =============================================================================

/**
 * Archives a news event relevant to the user's watchlist
 * @param {object} newsItem - News article metadata
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archiveNewsEvent(newsItem, db = getArchiveDb()) {
  const symbols = newsItem.symbols || (newsItem.symbol ? [newsItem.symbol.toUpperCase()] : []);

  const item = {
    item_id: makeId('nw'),
    kind: 'news_context',
    title: newsItem.headline || newsItem.title || 'News Event',
    symbol: symbols[0] || null,
    symbols,
    asset_class: newsItem.asset_class || 'equity',
    timeframe: 'any',
    market_regime: null,
    setup: null,
    thesis: newsItem.summary || newsItem.description || '',
    body: JSON.stringify({
      source: newsItem.source,
      url: newsItem.url,
      published_at: newsItem.published_at,
      sentiment: newsItem.sentiment,
      category: newsItem.category
    }, null, 2),
    tags: ['news', ...(symbols.map(s => s.toLowerCase())), newsItem.category || 'general'].filter(Boolean),
    source_refs: newsItem.url ? [{ source: newsItem.source || 'news', ref: newsItem.url, retrieved_at: now() }] : [],
    linked_trade_ids: [],
    linked_workflow_ids: [],
    linked_news_ids: newsItem.news_id ? [newsItem.news_id] : [],
    linked_filing_ids: [],
    confidence: 1.0,
    user_authored: false,
    model_generated: false,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}

// =============================================================================
// FILING EVENT
// =============================================================================

/**
 * Archives a filing event (8-K, 10-Q, 10-K, etc.)
 * @param {object} filing - Filing metadata
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archiveFilingEvent(filing, db = getArchiveDb()) {
  const symbol = (filing.symbol || filing.ticker || '').toUpperCase();

  const item = {
    item_id: makeId('fl'),
    kind: 'filing_context',
    title: `${filing.form_type || 'Filing'}: ${symbol} — ${filing.title || 'SEC Filing'}`,
    symbol,
    symbols: [symbol],
    asset_class: 'equity',
    timeframe: 'any',
    market_regime: null,
    setup: null,
    thesis: filing.summary || `${filing.form_type || 'Filing'} filed by ${symbol}`,
    body: JSON.stringify({
      form_type: filing.form_type,
      filed_at: filing.filed_at,
      url: filing.url,
      accession_number: filing.accession_number
    }, null, 2),
    tags: ['filing', symbol.toLowerCase(), (filing.form_type || '').toLowerCase()].filter(Boolean),
    source_refs: filing.url ? [{ source: 'sec', ref: filing.url, retrieved_at: now() }] : [],
    linked_trade_ids: [],
    linked_workflow_ids: [],
    linked_news_ids: [],
    linked_filing_ids: filing.filing_id ? [filing.filing_id] : [],
    confidence: 1.0,
    user_authored: false,
    model_generated: false,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}

// =============================================================================
// ALERT TRIGGER
// =============================================================================

/**
 * Archives a triggered alert from RELAY
 * @param {object} alertEvent - Alert trigger event
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archiveAlertTrigger(alertEvent, db = getArchiveDb()) {
  const symbol = (alertEvent.symbol || '').toUpperCase();

  const item = {
    item_id: makeId('at'),
    kind: 'note',
    title: `Alert Triggered: ${alertEvent.alert_type || 'alert'} on ${symbol || 'portfolio'}`,
    symbol: symbol || null,
    symbols: symbol ? [symbol] : [],
    asset_class: alertEvent.asset_class || 'equity',
    timeframe: 'any',
    market_regime: null,
    setup: null,
    thesis: alertEvent.message || `Alert triggered for ${symbol}`,
    body: JSON.stringify({
      alert_id: alertEvent.alert_id,
      alert_type: alertEvent.alert_type,
      condition: alertEvent.condition,
      value_at_trigger: alertEvent.value_at_trigger,
      triggered_at: alertEvent.triggered_at || now()
    }, null, 2),
    tags: ['alert_trigger', symbol ? symbol.toLowerCase() : 'portfolio', alertEvent.alert_type || 'price'].filter(Boolean),
    source_refs: [],
    linked_trade_ids: [],
    linked_workflow_ids: [],
    linked_news_ids: [],
    linked_filing_ids: [],
    confidence: 1.0,
    user_authored: false,
    model_generated: false,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}

// =============================================================================
// MANUAL USER NOTE
// =============================================================================

/**
 * Archives a user-authored note or thesis
 * @param {object} note - { title, symbol, thesis, body, tags, kind }
 * @param {DatabaseSync} [db]
 * @returns {object}
 */
export function archiveUserNote(note, db = getArchiveDb()) {
  const symbol = (note.symbol || '').toUpperCase();

  const item = {
    item_id: makeId('un'),
    kind: note.kind || 'note',
    title: note.title || `Note: ${symbol || 'General'}`,
    symbol: symbol || null,
    symbols: symbol ? [symbol] : [],
    asset_class: note.asset_class || 'equity',
    timeframe: note.timeframe || 'any',
    market_regime: note.market_regime || null,
    setup: note.setup || null,
    thesis: note.thesis || '',
    body: note.body || '',
    tags: note.tags || ['user_note'],
    source_refs: note.source_refs || [],
    linked_trade_ids: note.linked_trade_ids || [],
    linked_workflow_ids: note.linked_workflow_ids || [],
    linked_news_ids: note.linked_news_ids || [],
    linked_filing_ids: note.linked_filing_ids || [],
    confidence: 1.0,
    user_authored: true,
    model_generated: false,
    created_at: now(),
    updated_at: now(),
    archived_at: null
  };

  return archiveAndEmbed(item, db);
}
