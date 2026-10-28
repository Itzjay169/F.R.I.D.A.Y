/**
 * ARCHIVE Agent — Research Librarian & Memory System
 * Phase 6.5: Natural language interface to the ARCHIVE subsystem
 *
 * Handles user intents:
 * - save / store / archive research notes, theses, chart snapshots
 * - search / find / recall past research
 * - create / view / manage playbooks
 * - draft / view / manage trade reviews
 * - analyze expectancy, learning curves, common mistakes
 * - export research items
 *
 * ARCHIVE CANNOT: place trades, modify orders, bypass Sentinel, or upload
 * data to external services.
 *
 * Privacy: all data is local-first. Model-generated content is labelled.
 */

import crypto from 'crypto';
import { createResponse } from '../../shared/contract.js';
import {
  saveResearchItem,
  getResearchItem,
  listResearchItems,
  updateResearchItem,
  deleteResearchItem,
  getPlaybook,
  listPlaybooks,
  getTradeReview,
  listTradeReviews,
  getArchiveDb,
  saveEmbedding,
  exportArchive
} from '../../services/archive/archivePersistence.js';
import {
  hybridSearch,
  searchByTag,
  searchByDateRange,
  getLinkedItems,
  generateLocalEmbedding,
  findSimilarTrades,
  findTradesByEvent,
  findMistakes
} from '../../services/archive/retrieval.js';
import {
  archiveUserNote,
  archiveTradePlan,
  archivePaperFill,
  archivePositionClose,
  archiveSentinelVeto,
  archiveNewsEvent,
  archiveFilingEvent,
  archiveAlertTrigger
} from '../../services/archive/autoArchive.js';
import {
  generatePlaybook,
  backtestPlaybook,
  analyzeExpectancy,
  computePerformanceStats
} from '../../services/archive/playbookEngine.js';
import {
  draftTradeReview,
  saveReview,
  updateReview,
  getReviewStats,
  getLearningCurve
} from '../../services/archive/reviewEngine.js';

// =============================================================================
// SECURITY BOUNDARY
// =============================================================================

const FORBIDDEN_ACTIONS = [
  'execute_paper_order', 'execute_order', 'place_paper_trade',
  'place_order', 'route_order', 'sign_sentinel_token',
  'approve_order_execution', 'modify_order', 'cancel_order'
];

export function assertArchiveCannotExecute(action) {
  if (FORBIDDEN_ACTIONS.includes(action)) {
    throw new Error(
      `SECURITY VIOLATION: ARCHIVE agent cannot perform execution action "${action}". ` +
      `ARCHIVE is a read/write knowledge store only.`
    );
  }
}

// =============================================================================
// SYMBOL DICTIONARY
// =============================================================================

const symbolMap = {
  nvidia: 'NVDA', apple: 'AAPL', tesla: 'TSLA', microsoft: 'MSFT',
  google: 'GOOGL', alphabet: 'GOOGL', amazon: 'AMZN', meta: 'META',
  facebook: 'META', spy: 'SPY', qqq: 'QQQ', netflix: 'NFLX',
  amd: 'AMD', intel: 'INTC', palantir: 'PLTR', coinbase: 'COIN'
};

// =============================================================================
// CONTRACT-COMPLIANT RESPONSE BUILDER
// =============================================================================

/**
 * Builds a contract-compliant response for ARCHIVE agent
 * Uses createResponse({ id, agent, status, summary, data, sources, ... })
 */
function archiveResponse(status, data = {}, summary = '') {
  return createResponse({
    id: `archive_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    agent: 'ARCHIVE',
    status,
    summary: summary || data.message || '',
    data,
    sources: ['local_archive_db'],
    confidence: 1.0,
    spoken_text: summary || data.message || ''
  });
}

// =============================================================================
// INTENT PARSING
// =============================================================================

/**
 * Classifies user intent for ARCHIVE operations
 * @param {string} command
 * @returns {object} { intent, symbol, query, tags, kind, ... }
 */
export function parseArchiveIntent(command) {
  const raw = command || '';
  const norm = raw.toLowerCase();

  // Intent classification
  let intent = 'search'; // default

  // Save / Store
  if (norm.match(/\b(save|store|archive|record|note|log|write|add)\b/)) {
    intent = 'save';
  }
  // Mistake search (must be before generic search — "find every time I entered without a stop")
  else if (norm.match(/\b(entered\s+without|no\s+stop|without\s+a\s+stop|fomo|revenge|chased|overtraded)\b/)) {
    intent = 'mistake_search';
  }
  // Similar trades (must be before generic search)
  else if (norm.match(/\b(similar\s+trade|trades?\s+like|compare\s+trade|show\s+similar)\b/)) {
    intent = 'similar_trades';
  }
  // Event search (must be before generic search)
  else if (norm.match(/\b(trades?\s+around|around\s+(cpi|fomc|nfp|earnings)|during\s+(cpi|fomc|nfp|earnings))\b/)) {
    intent = 'event_search';
  }
  // Summarize research
  else if (norm.match(/\b(summarize|summary|recap|digest)\b/)) {
    intent = 'summarize';
  }
  // Search / Find (generic — after all specific find/show patterns)
  else if (norm.match(/\b(search|find|recall|look\s*up|show\s+.*\bresearch|what\s+did\s+i|where\s+is)\b/)) {
    intent = 'search';
  }
  // Playbook
  else if (norm.match(/\b(create\s+.*playbook|build\s+.*playbook|playbook|generate\s+.*playbook)\b/)) {
    intent = 'create_playbook';
  }
  else if (norm.match(/\b(show\s+.*playbook|list\s+.*playbook|view\s+.*playbook|my\s+playbook)\b/)) {
    intent = 'list_playbooks';
  }
  else if (norm.match(/\b(backtest\s+.*playbook|test\s+.*playbook)\b/)) {
    intent = 'backtest_playbook';
  }
  // Trade Review
  else if (norm.match(/\b(review\s+.*trade|trade\s+review|post.?trade|draft\s+.*review)\b/)) {
    intent = 'draft_review';
  }
  else if (norm.match(/\b(show\s+.*review|list\s+.*review|my\s+review|view\s+.*review)\b/)) {
    intent = 'list_reviews';
  }
  // Stats & Analysis
  else if (norm.match(/\b(expectancy|best\s+setup|worst\s+setup|which\s+setup)\b/)) {
    intent = 'expectancy';
  }
  else if (norm.match(/\b(learning\s+curve|progress|improvement|am\s+i\s+improving)\b/)) {
    intent = 'learning_curve';
  }
  else if (norm.match(/\b(what\s+.*learn|lesson|mistake|what\s+went\s+wrong|common\s+mistake)\b/)) {
    intent = 'review_stats';
  }
  // Similar trades
  else if (norm.match(/\b(similar\s+trade|trades?\s+like|compare\s+trade|show\s+similar)\b/)) {
    intent = 'similar_trades';
  }
  // Event search
  else if (norm.match(/\b(trades?\s+around|around\s+(cpi|fomc|nfp|earnings)|during\s+(cpi|fomc|nfp|earnings))\b/)) {
    intent = 'event_search';
  }
  // Mistake search
  else if (norm.match(/\b(entered\s+without|no\s+stop|without\s+a\s+stop|fomo|revenge|chased|overtraded)\b/)) {
    intent = 'mistake_search';
  }
  // Summarize research
  else if (norm.match(/\b(summarize|summary|recap|digest)\b/)) {
    intent = 'summarize';
  }
  // Delete
  else if (norm.match(/\b(delete|remove|erase)\b/)) {
    intent = 'delete';
  }
  // Export
  else if (norm.match(/\b(export|download|backup)\b/)) {
    intent = 'export';
  }

  // Symbol extraction
  let symbol = null;
  // Check for explicit ticker ($NVDA, NVDA)
  const tickerMatch = raw.match(/\$?([A-Z]{1,5})\b/);
  if (tickerMatch && tickerMatch[1].length >= 2) {
    symbol = tickerMatch[1];
  }
  // Check symbol map
  for (const [name, ticker] of Object.entries(symbolMap)) {
    if (norm.includes(name)) {
      symbol = ticker;
      break;
    }
  }

  // Tags extraction (words after "tag:" or "tagged")
  const tags = [];
  const tagMatch = raw.match(/(?:tag(?:s|ged)?:?\s*)([^\s,]+(?:[,\s]+[^\s,]+)*)/i);
  if (tagMatch) {
    tags.push(...tagMatch[1].split(/[,\s]+/).filter(t => t.length > 0));
  }

  // Kind filter
  let kind = null;
  if (norm.includes('thesis')) kind = 'thesis';
  else if (norm.includes('chart') || norm.includes('snapshot')) kind = 'chart_snapshot';
  else if (norm.includes('note')) kind = 'note';
  else if (norm.includes('plan')) kind = 'trade_plan';

  // Extract the core query (strip command words)
  const query = raw
    .replace(/\b(save|store|archive|record|find|search|show|list|create|build|view|my|the|all|about|for|in|on|from|with|tagged?|note|thesis|research)\b/gi, '')
    .replace(/\$[A-Z]+/g, '')
    .trim();

  return { intent, symbol, query, tags, kind, raw };
}

// =============================================================================
// ARCHIVE AGENT CLASS
// =============================================================================

export class ArchiveAgent {
  constructor() {
    this.name = 'ARCHIVE';
    this.role = 'Research Librarian & Memory System';
    this.db = getArchiveDb();
  }

  /**
   * Main dispatch: routes natural language commands to the right handler
   * @param {string} command
   * @param {object} [context] - Additional context (tradeData, planData, etc.)
   * @returns {object} Response
   */
  async handleCommand(command, context = {}) {
    const parsed = parseArchiveIntent(command);

    try {
      switch (parsed.intent) {
        case 'save':
          return this.handleSave(parsed, context);
        case 'search':
          return this.handleSearch(parsed, context);
        case 'create_playbook':
          return this.handleCreatePlaybook(parsed, context);
        case 'list_playbooks':
          return this.handleListPlaybooks(parsed);
        case 'backtest_playbook':
          return this.handleBacktestPlaybook(parsed, context);
        case 'draft_review':
          return this.handleDraftReview(parsed, context);
        case 'list_reviews':
          return this.handleListReviews(parsed);
        case 'expectancy':
          return this.handleExpectancy(parsed);
        case 'learning_curve':
          return this.handleLearningCurve();
        case 'review_stats':
          return this.handleReviewStats(parsed);
        case 'similar_trades':
          return this.handleSimilarTrades(parsed, context);
        case 'event_search':
          return this.handleEventSearch(parsed, context);
        case 'mistake_search':
          return this.handleMistakeSearch(parsed, context);
        case 'summarize':
          return this.handleSummarize(parsed);
        case 'delete':
          return this.handleDelete(parsed);
        case 'export':
          return this.handleExport(parsed, context);
        default:
          return this.handleSearch(parsed, context);
      }
    } catch (err) {
      return archiveResponse('error', {
        message: `ARCHIVE error: ${err.message}`,
        intent: parsed.intent
      });
    }
  }

  // ─────────────────── SAVE ───────────────────

  handleSave(parsed, context) {
    const note = {
      title: parsed.query || `Note: ${parsed.symbol || 'General'}`,
      symbol: parsed.symbol,
      thesis: context.thesis || parsed.query || '',
      body: context.body || '',
      tags: parsed.tags.length > 0 ? parsed.tags : ['user_note'],
      kind: parsed.kind || 'note',
      setup: context.setup || null,
      timeframe: context.timeframe || 'any',
      asset_class: context.asset_class || 'equity',
      source_refs: context.source_refs || []
    };

    const saved = archiveUserNote(note, this.db);

    return archiveResponse('ok', {
      message: `Saved research item: "${saved.title}"`,
      item_id: saved.item_id,
      kind: saved.kind,
      symbol: saved.symbol,
      tags: saved.tags
    });
  }

  // ─────────────────── SEARCH ───────────────────

  handleSearch(parsed, context) {
    // If searching by tag
    if (parsed.tags.length > 0) {
      const items = searchByTag(parsed.tags[0], 20, this.db);
      return archiveResponse('ok', {
        message: `Found ${items.length} items tagged "${parsed.tags[0]}"`,
        items,
        method: 'tag_search'
      });
    }

    // Hybrid search
    const results = hybridSearch(parsed.query || parsed.symbol || '', {
      limit: 20,
      symbol: parsed.symbol,
      kind: parsed.kind
    }, this.db);

    return archiveResponse('ok', {
      message: `Found ${results.total} results for "${parsed.query || parsed.symbol}"`,
      ...results
    });
  }

  // ─────────────────── PLAYBOOK CRUD ───────────────────

  handleCreatePlaybook(parsed, context) {
    const reviews = context.reviews || listTradeReviews({
      symbol: parsed.symbol,
      limit: 100
    }, this.db);

    if (reviews.length === 0) {
      return archiveResponse('error', {
        message: 'No trade reviews found to create a playbook from. Complete some trades and review them first.'
      });
    }

    const playbook = generatePlaybook({
      name: parsed.query || `${parsed.symbol || 'General'} Playbook`,
      description: context.description || `Playbook generated from ${reviews.length} trade reviews`,
      reviews,
      rules: context.rules || {}
    }, this.db);

    return archiveResponse('ok', {
      message: `Created playbook "${playbook.name}" from ${reviews.length} trades`,
      playbook
    });
  }

  handleListPlaybooks() {
    const playbooks = listPlaybooks(this.db);
    return archiveResponse('ok', {
      message: `Found ${playbooks.length} playbooks`,
      playbooks
    });
  }

  handleBacktestPlaybook(parsed, context) {
    const playbookId = context.playbook_id || parsed.query;
    const allReviews = listTradeReviews({ limit: 500 }, this.db);

    const result = backtestPlaybook(playbookId, allReviews, this.db);

    return archiveResponse('ok', {
      message: `Backtested playbook "${result.playbook_name}" against ${result.tested_trades} trades`,
      ...result
    });
  }

  // ─────────────────── REVIEW ───────────────────

  handleDraftReview(parsed, context) {
    const tradeId = context.trade_id || parsed.query;
    const symbol = parsed.symbol || context.symbol || '—';

    const draft = draftTradeReview({
      trade_id: tradeId,
      symbol,
      tradeData: context.tradeData || {},
      planData: context.planData || null,
      user_notes: context.user_notes || '',
      emotional_tags: context.emotional_tags || []
    }, this.db);

    if (draft.exists) {
      return archiveResponse('ok', {
        message: `Review already exists for trade ${tradeId}`,
        review: draft.review
      });
    }

    // Auto-save the draft
    const saved = saveReview(draft.review, this.db);

    return archiveResponse('ok', {
      message: `Drafted and saved trade review for ${symbol}`,
      review: saved,
      process_breakdown: draft.processBreakdown,
      discipline_breakdown: draft.disciplineBreakdown
    });
  }

  handleListReviews(parsed) {
    const reviews = listTradeReviews({
      symbol: parsed.symbol,
      limit: 50
    }, this.db);

    return archiveResponse('ok', {
      message: `Found ${reviews.length} trade reviews${parsed.symbol ? ` for ${parsed.symbol}` : ''}`,
      reviews
    });
  }

  // ─────────────────── ANALYSIS ───────────────────

  handleExpectancy() {
    const reviews = listTradeReviews({ limit: 500 }, this.db);
    const analysis = analyzeExpectancy(reviews);

    return archiveResponse('ok', {
      message: `Expectancy analysis across ${reviews.length} reviews`,
      setups: analysis,
      model_generated: true
    });
  }

  handleLearningCurve() {
    const curve = getLearningCurve(5, this.db);
    return archiveResponse('ok', {
      message: 'Learning curve computed',
      curve,
      model_generated: true
    });
  }

  handleReviewStats(parsed) {
    const stats = getReviewStats({ symbol: parsed.symbol }, this.db);
    return archiveResponse('ok', {
      message: `Review statistics${parsed.symbol ? ` for ${parsed.symbol}` : ''}`,
      ...stats
    });
  }

  // ─────────────────── DELETE ───────────────────

  handleDelete(parsed) {
    if (!parsed.query) {
      return archiveResponse('error', {
        message: 'Please specify which item to delete (provide an item ID or search query)'
      });
    }

    // Try as item ID first
    const item = getResearchItem(parsed.query, this.db);
    if (item) {
      deleteResearchItem(parsed.query, this.db);
      return archiveResponse('ok', {
        message: `Deleted research item: "${item.title}"`,
        deleted_id: parsed.query
      });
    }

    return archiveResponse('error', {
      message: `Item "${parsed.query}" not found. Use search to find the correct item ID.`
    });
  }

  // ─────────────────── SIMILAR TRADES ───────────────────

  handleSimilarTrades(parsed, context) {
    const results = findSimilarTrades(
      { symbol: parsed.symbol, setup: context.setup, market_regime: context.market_regime },
      { crossSymbol: context.crossSymbol || false, limit: 10 },
      this.db
    );

    return archiveResponse('ok', {
      message: `Found ${results.length} similar trades${parsed.symbol ? ` for ${parsed.symbol}` : ''}`,
      similar_trades: results
    }, `Found ${results.length} similar trades`);
  }

  // ─────────────────── EVENT SEARCH ───────────────────

  handleEventSearch(parsed, context) {
    // Extract event name from query
    let eventName = null;
    const eventMatch = parsed.raw.match(/\b(CPI|FOMC|NFP|earnings|GDP|PPI|jobless)\b/i);
    if (eventMatch) eventName = eventMatch[1].toUpperCase();

    const results = findTradesByEvent({
      eventDate: context.eventDate || null,
      eventName: eventName || context.eventName || parsed.query,
      windowDays: context.windowDays || 2
    }, this.db);

    return archiveResponse('ok', {
      message: `Found ${results.length} trades around ${eventName || 'event'}`,
      trades: results
    }, `Found ${results.length} trades around ${eventName || 'the event'}`);
  }

  // ─────────────────── MISTAKE SEARCH ───────────────────

  handleMistakeSearch(parsed, context) {
    // Extract mistake keyword
    let mistake = parsed.query || 'stop';
    const mistakeMatch = parsed.raw.match(/\b(fomo|revenge|chased|overtraded|no\s+stop|without.*stop|entered\s+without)\b/i);
    if (mistakeMatch) mistake = mistakeMatch[0];

    const results = findMistakes({
      mistake,
      symbol: parsed.symbol
    }, this.db);

    return archiveResponse('ok', {
      message: `Found ${results.length} trades with mistake pattern "${mistake}"`,
      mistakes: results
    }, `Found ${results.length} trades matching mistake "${mistake}"`);
  }

  // ─────────────────── SUMMARIZE ───────────────────

  handleSummarize(parsed) {
    const results = hybridSearch(parsed.query || parsed.symbol || '', {
      limit: 20,
      symbol: parsed.symbol,
      kind: parsed.kind
    }, this.db);

    const summary = results.items.map(i => `- [${i.kind}] ${i.title}: ${i.thesis || '—'}`).join('\n');

    return archiveResponse('ok', {
      message: `Summary of ${results.items.length} items${parsed.symbol ? ` for ${parsed.symbol}` : ''}`,
      summary,
      items: results.items,
      model_generated: true
    }, `Summarized ${results.items.length} research items`);
  }

  // ─────────────────── EXPORT ───────────────────

  handleExport(parsed, context = {}) {
    // Detect format from query: "export to markdown", "export as csv"
    let format = 'json';
    const norm = (parsed.raw || '').toLowerCase();
    if (norm.includes('markdown') || norm.includes('md')) format = 'markdown';
    else if (norm.includes('csv')) format = 'csv';
    else if (context.format) format = context.format;

    const result = exportArchive(format, {
      symbol: parsed.symbol,
      kind: parsed.kind,
      limit: 500
    }, this.db);

    return archiveResponse('ok', {
      message: `Exported ${result.item_count} research items as ${result.format.toUpperCase()}`,
      export: result
    }, `Exported ${result.item_count} items as ${result.format}`);
  }

  // ─────────────────── HEALTH CHECK ───────────────────

  healthCheck() {
    try {
      const itemCount = this.db.prepare('SELECT COUNT(*) as cnt FROM research_items').get();
      const playbookCount = this.db.prepare('SELECT COUNT(*) as cnt FROM playbooks').get();
      const reviewCount = this.db.prepare('SELECT COUNT(*) as cnt FROM trade_reviews').get();
      const embeddingCount = this.db.prepare('SELECT COUNT(*) as cnt FROM archive_embeddings').get();

      return {
        status: 'healthy',
        agent: 'ARCHIVE',
        research_items: Number(itemCount.cnt),
        playbooks: Number(playbookCount.cnt),
        trade_reviews: Number(reviewCount.cnt),
        embeddings: Number(embeddingCount.cnt),
        checked_at: new Date().toISOString()
      };
    } catch (err) {
      return {
        status: 'degraded',
        agent: 'ARCHIVE',
        error: err.message,
        checked_at: new Date().toISOString()
      };
    }
  }
}

// =============================================================================
// SINGLETON & CONVENIENCE EXPORTS
// =============================================================================

let archiveInstance = null;

export function getArchiveAgent() {
  if (!archiveInstance) {
    archiveInstance = new ArchiveAgent();
  }
  return archiveInstance;
}

export function archiveHealthCheck() {
  return getArchiveAgent().healthCheck();
}
