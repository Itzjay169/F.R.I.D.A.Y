import { describe, it, expect, beforeEach } from 'vitest';
import { initArchiveDatabase, saveResearchItem, saveEmbedding, listTradeReviews, saveTradeReview } from '../../../services/archive/archivePersistence.js';
import {
  hybridSearch,
  ftsSearch,
  semanticSearch,
  searchByTag,
  searchByDateRange,
  getLinkedItems,
  generateLocalEmbedding,
  cosineSimilarity
} from '../../../services/archive/retrieval.js';
import {
  archiveUserNote,
  archiveTradePlan,
  archivePaperFill,
  archivePositionClose,
  archiveSentinelVeto,
  archiveNewsEvent,
  archiveAlertTrigger
} from '../../../services/archive/autoArchive.js';
import {
  computePerformanceStats,
  generatePlaybook,
  analyzeExpectancy
} from '../../../services/archive/playbookEngine.js';
import {
  draftTradeReview,
  computeProcessScore,
  computeDisciplineScore,
  getReviewStats,
  getLearningCurve
} from '../../../services/archive/reviewEngine.js';
import {
  ArchiveAgent,
  parseArchiveIntent,
  assertArchiveCannotExecute
} from '../../../agents/archive/archiveAgent.js';

describe('ARCHIVE Integration Tests (Phase 6.5)', () => {
  let db;

  beforeEach(() => {
    db = initArchiveDatabase(':memory:');
  });

  // ═══════════════════════════════════════════
  // RETRIEVAL ENGINE
  // ═══════════════════════════════════════════

  it('1. FTS5 search finds items by keyword', () => {
    saveResearchItem({
      item_id: 'ri_fts1', kind: 'thesis', title: 'NVDA Breakout Analysis',
      symbol: 'NVDA', symbols: ['NVDA'], thesis: 'NVDA is breaking out above 150 resistance level',
      tags: ['breakout'], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);
    saveResearchItem({
      item_id: 'ri_fts2', kind: 'note', title: 'AAPL Earnings Note',
      symbol: 'AAPL', symbols: ['AAPL'], thesis: 'AAPL earnings beat expectations',
      tags: ['earnings'], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    const results = ftsSearch('breakout', 10, db);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item_id).toBe('ri_fts1');
  });

  it('2. cosine similarity returns 1.0 for identical vectors', () => {
    const v = [1, 0, 0, 1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('3. cosine similarity returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('4. generateLocalEmbedding produces deterministic vectors', () => {
    const a = generateLocalEmbedding('NVDA breakout thesis');
    const b = generateLocalEmbedding('NVDA breakout thesis');
    expect(a).toEqual(b);
  });

  it('5. hybrid search returns results ranked by combined score', () => {
    // Seed items
    ['thesis', 'note', 'chart_snapshot'].forEach((kind, i) => {
      const item = {
        item_id: `ri_hy${i}`, kind, title: `NVDA ${kind} about breakout`,
        symbol: 'NVDA', symbols: ['NVDA'], thesis: `NVDA breakout analysis ${kind}`,
        tags: ['breakout', 'nvda'], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      saveResearchItem(item, db);
      const vec = generateLocalEmbedding(`NVDA ${kind} breakout`);
      saveEmbedding(item.item_id, vec, db);
    });

    const results = hybridSearch('NVDA breakout', { limit: 10 }, db);
    expect(results.items.length).toBeGreaterThan(0);
    expect(results.method).toMatch(/hybrid|keyword/);
  });

  it('6. search by tag returns matching items', () => {
    saveResearchItem({
      item_id: 'ri_tag1', kind: 'note', title: 'Tagged item',
      symbol: 'SPY', symbols: ['SPY'], thesis: 't', tags: ['macro', 'fed'],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    const results = searchByTag('macro', 10, db);
    expect(results.length).toBe(1);
    expect(results[0].item_id).toBe('ri_tag1');
  });

  // ═══════════════════════════════════════════
  // AUTO-ARCHIVING HOOKS
  // ═══════════════════════════════════════════

  it('7. archiveUserNote saves a user-authored note with embedding', () => {
    const saved = archiveUserNote({
      title: 'My TSLA Note',
      symbol: 'TSLA',
      thesis: 'TSLA looks oversold',
      tags: ['oversold']
    }, db);

    expect(saved.item_id).toBeDefined();
    expect(saved.user_authored).toBe(true);
    expect(saved.model_generated).toBe(false);
  });

  it('8. archiveTradePlan saves a model-generated trade plan', () => {
    const saved = archiveTradePlan({
      symbol: 'AAPL',
      direction: 'long',
      timeframe: 'swing',
      thesis: 'Breakout above 190',
      entry: 190,
      stop: 185,
      targets: [200, 210]
    }, null, db);

    expect(saved.kind).toBe('trade_plan');
    expect(saved.model_generated).toBe(true);
  });

  it('9. archivePaperFill saves fill event', () => {
    const saved = archivePaperFill({
      symbol: 'NVDA',
      side: 'buy',
      qty: 10,
      fill_price: 150.50,
      order_id: 'ord_001'
    }, db);

    expect(saved.item_id).toBeDefined();
    expect(saved.title).toContain('Paper Fill');
    expect(saved.title).toContain('NVDA');
  });

  it('10. archivePositionClose saves close with win/loss outcome', () => {
    const win = archivePositionClose({ symbol: 'AAPL', pnl: 500, qty: 10 }, db);
    expect(win.title).toContain('win');

    const loss = archivePositionClose({ symbol: 'TSLA', pnl: -200, qty: 5 }, db);
    expect(loss.title).toContain('loss');
  });

  it('11. archiveSentinelVeto records risk rejection', () => {
    const saved = archiveSentinelVeto({
      symbol: 'NVDA',
      decision: 'reject',
      reason: 'Position too large',
      risk_flags: ['concentration_risk']
    }, db);

    expect(saved.kind).toBe('note');
    expect(saved.tags).toContain('sentinel_veto');
  });

  it('12. archiveNewsEvent records news with source_refs', () => {
    const saved = archiveNewsEvent({
      headline: 'NVDA Beats Earnings',
      source: 'Reuters',
      url: 'https://example.com/nvda',
      symbol: 'NVDA'
    }, db);

    expect(saved.kind).toBe('news_context');
    expect(saved.source_refs.length).toBe(1);
  });

  // ═══════════════════════════════════════════
  // PLAYBOOK ENGINE
  // ═══════════════════════════════════════════

  it('13. computePerformanceStats calculates correct win rate and avg R', () => {
    const trades = [
      { outcome: 'win', result_r: 2.0 },
      { outcome: 'win', result_r: 1.5 },
      { outcome: 'loss', result_r: -1.0 },
      { outcome: 'loss', result_r: -1.0 },
      { outcome: 'scratch', result_r: 0 }
    ];

    const stats = computePerformanceStats(trades);
    expect(stats.trade_count).toBe(5);
    expect(stats.win_rate).toBeCloseTo(0.4, 1);
    expect(stats.average_r).toBeCloseTo(0.3, 1);
    expect(stats.profit_factor).toBeGreaterThan(0);
  });

  it('14. generatePlaybook creates a playbook from reviews', () => {
    const reviews = [
      { trade_id: 't1', symbol: 'AAPL', outcome: 'win', result_r: 2.0, timeframe: 'swing' },
      { trade_id: 't2', symbol: 'AAPL', outcome: 'loss', result_r: -1.0, timeframe: 'swing' }
    ];

    const pb = generatePlaybook({
      name: 'Test Playbook',
      description: 'Testing',
      reviews
    }, db);

    expect(pb.playbook_id).toBeDefined();
    expect(pb.name).toBe('Test Playbook');
    expect(pb.performance_summary.trade_count).toBe(2);
    expect(pb.symbols).toContain('AAPL');
  });

  it('15. analyzeExpectancy ranks setups by expectancy', () => {
    const reviews = [
      { outcome: 'win', result_r: 3.0, market_context: 'breakout' },
      { outcome: 'win', result_r: 2.0, market_context: 'breakout' },
      { outcome: 'loss', result_r: -1.0, market_context: 'breakout' },
      { outcome: 'loss', result_r: -1.0, market_context: 'mean reversion' },
      { outcome: 'loss', result_r: -1.0, market_context: 'mean reversion' }
    ];

    const analysis = analyzeExpectancy(reviews);
    expect(analysis.length).toBeGreaterThan(0);
    expect(analysis[0]).toHaveProperty('expectancy');
    expect(analysis[0].model_generated).toBe(true);
  });

  // ═══════════════════════════════════════════
  // TRADE REVIEW ENGINE
  // ═══════════════════════════════════════════

  it('16. computeProcessScore awards points for plan adherence', () => {
    const result = computeProcessScore(
      { entry_price: 150, stop_price: 147, target_price: 160, qty: 10 },
      { entry: 150, stop: 147, targets: [160], position_size: 10 }
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.model_generated).toBe(true);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it('17. a winning trade CAN have a low process score (no plan)', () => {
    const result = computeProcessScore({ entry_price: 100, added_to_loser: true }, null);
    expect(result.score).toBeLessThan(100);
  });

  it('18. a losing trade CAN have a high process score (followed plan)', () => {
    const result = computeProcessScore(
      { entry_price: 150, stop_price: 147, target_price: 160, qty: 10 },
      { entry: 150, stop: 147, targets: [160], position_size: 10 }
    );
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('19. draftTradeReview creates a review with model-generated labels', () => {
    const draft = draftTradeReview({
      trade_id: 'trade_draft1',
      symbol: 'NVDA',
      tradeData: { pnl: 500, closed: true, entry_price: 150, exit_price: 155, stop_price: 147 }
    }, db);

    expect(draft.exists).toBe(false);
    expect(draft.review.outcome).toBe('win');
    expect(draft.review.what_went_right.some(w => w.includes('[model-generated]'))).toBe(true);
    expect(draft.review.model_notes).toContain('[model-generated]');
  });

  it('20. computeDisciplineScore deducts for stop movement', () => {
    const result = computeDisciplineScore({ stop_moved_against: true });
    expect(result.score).toBeLessThan(100);
    expect(result.breakdown.some(b => b.criterion.includes('stop'))).toBe(true);
  });

  // ═══════════════════════════════════════════
  // ARCHIVE AGENT — INTENT PARSING
  // ═══════════════════════════════════════════

  it('21. parseArchiveIntent classifies "save" intents', () => {
    const result = parseArchiveIntent('Save this NVDA thesis');
    expect(result.intent).toBe('save');
    expect(result.symbol).toBe('NVDA');
  });

  it('22. parseArchiveIntent classifies "search" intents', () => {
    const result = parseArchiveIntent('Find my last TSLA breakout notes');
    expect(result.intent).toBe('search');
    expect(result.symbol).toBe('TSLA');
  });

  it('23. parseArchiveIntent classifies "create playbook" intent', () => {
    const result = parseArchiveIntent('Create a playbook from my AAPL trades');
    expect(result.intent).toBe('create_playbook');
    expect(result.symbol).toBe('AAPL');
  });

  it('24. parseArchiveIntent classifies "expectancy" intent', () => {
    const result = parseArchiveIntent('What setup has the best expectancy?');
    expect(result.intent).toBe('expectancy');
  });

  it('25. parseArchiveIntent classifies "learning curve" intent', () => {
    const result = parseArchiveIntent('Show me my learning curve');
    expect(result.intent).toBe('learning_curve');
  });

  // ═══════════════════════════════════════════
  // SECURITY BOUNDARY
  // ═══════════════════════════════════════════

  it('26. ARCHIVE agent CANNOT execute trades', () => {
    expect(() => assertArchiveCannotExecute('execute_paper_order')).toThrow('SECURITY VIOLATION');
    expect(() => assertArchiveCannotExecute('place_order')).toThrow('SECURITY VIOLATION');
    expect(() => assertArchiveCannotExecute('sign_sentinel_token')).toThrow('SECURITY VIOLATION');
  });

  it('27. ARCHIVE agent CAN perform read/write operations', () => {
    expect(() => assertArchiveCannotExecute('search_research')).not.toThrow();
    expect(() => assertArchiveCannotExecute('save_note')).not.toThrow();
    expect(() => assertArchiveCannotExecute('create_playbook')).not.toThrow();
  });

  // ═══════════════════════════════════════════
  // ARCHIVE AGENT — COMMAND DISPATCH
  // ═══════════════════════════════════════════

  it('28. ARCHIVE agent handles save command via handleCommand', async () => {
    // Override the agent's db
    const agent = new ArchiveAgent();
    agent.db = db;

    const result = await agent.handleCommand('Save this NVDA thesis about breakout above 150', {
      thesis: 'NVDA breaking above 150 resistance'
    });

    expect(result.status).toBe('ok');
    expect(result.data.item_id).toBeDefined();
  });

  it('29. ARCHIVE agent handles search command', async () => {
    const agent = new ArchiveAgent();
    agent.db = db;

    // Seed data
    archiveUserNote({ title: 'TSLA Note', symbol: 'TSLA', thesis: 'Oversold bounce setup' }, db);

    const result = await agent.handleCommand('Find my TSLA notes');
    expect(result.status).toBe('ok');
  });

  it('30. ARCHIVE agent health check returns stats', () => {
    const agent = new ArchiveAgent();
    agent.db = db;
    const health = agent.healthCheck();

    expect(health.status).toBe('healthy');
    expect(health.agent).toBe('ARCHIVE');
    expect(typeof health.research_items).toBe('number');
  });
});
