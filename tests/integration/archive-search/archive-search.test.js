import { describe, it, expect, beforeEach } from 'vitest';
import {
  initArchiveDatabase,
  saveResearchItem,
  saveEmbedding,
  saveTradeReview,
  savePlaybook,
  createResearchLink,
  exportArchive
} from '../../../services/archive/archivePersistence.js';
import {
  hybridSearch,
  ftsSearch,
  generateLocalEmbedding,
  findSimilarTrades,
  findTradesByEvent,
  findMistakes,
  getLinkedItems
} from '../../../services/archive/retrieval.js';
import {
  archiveUserNote,
  archivePositionClose
} from '../../../services/archive/autoArchive.js';
import {
  parseArchiveIntent,
  ArchiveAgent
} from '../../../agents/archive/archiveAgent.js';

describe('ARCHIVE Search & Retrieval Integration Tests (Phase 6.5, Section 11)', () => {
  let db;

  beforeEach(() => {
    db = initArchiveDatabase(':memory:');
  });

  // ═══════════════════════════════════════════
  // TEST 4: Hybrid ranking — keyword, semantic, symbol, tag, recency
  // ═══════════════════════════════════════════

  it('4. hybrid ranking combines keyword, semantic, symbol, tag, and recency signals', () => {
    // Seed items with varied relevance
    const now = new Date().toISOString();
    const old = new Date('2020-01-01').toISOString();

    saveResearchItem({
      item_id: 'ri_rank_high', kind: 'thesis', title: 'NVDA Breakout Analysis',
      symbol: 'NVDA', symbols: ['NVDA'], thesis: 'NVDA breaking out above resistance with high volume',
      tags: ['breakout', 'nvda'], setup: 'breakout',
      created_at: now, updated_at: now
    }, db);
    saveEmbedding('ri_rank_high', generateLocalEmbedding('NVDA breakout high volume'), db);

    saveResearchItem({
      item_id: 'ri_rank_low', kind: 'note', title: 'AAPL generic note',
      symbol: 'AAPL', symbols: ['AAPL'], thesis: 'AAPL general market note about support',
      tags: ['support'], setup: null,
      created_at: old, updated_at: old
    }, db);
    saveEmbedding('ri_rank_low', generateLocalEmbedding('AAPL general note support'), db);

    saveResearchItem({
      item_id: 'ri_rank_mid', kind: 'note', title: 'NVDA Support analysis',
      symbol: 'NVDA', symbols: ['NVDA'], thesis: 'NVDA retesting support level',
      tags: ['support', 'nvda'],
      created_at: old, updated_at: old
    }, db);
    saveEmbedding('ri_rank_mid', generateLocalEmbedding('NVDA support retest'), db);

    const results = hybridSearch('NVDA breakout', { limit: 10 }, db);

    expect(results.items.length).toBeGreaterThanOrEqual(1);
    expect(results.method).toMatch(/hybrid|keyword/);
    // The most relevant item should be first (NVDA + breakout + recent)
    expect(results.items[0].item_id).toBe('ri_rank_high');
    // Items should have match_reason
    expect(results.items[0].match_reason).toBeDefined();
    expect(results.items[0].match_reason).toContain('symbol NVDA');
  });

  // ═══════════════════════════════════════════
  // TEST 5: Trade closure creates a draft review (auto-archive)
  // ═══════════════════════════════════════════

  it('5. archivePositionClose automatically creates a draft trade review', () => {
    archivePositionClose({
      symbol: 'TSLA',
      pnl: 450,
      qty: 10,
      entry_price: 200,
      exit_price: 245,
      stop_price: 195,
      order_id: 'ord_auto_review'
    }, db);

    // Check that a review was drafted and saved
    const reviews = db.prepare('SELECT * FROM trade_reviews WHERE trade_id = ?').all('ord_auto_review');
    expect(reviews.length).toBe(1);
    expect(reviews[0].outcome).toBe('win');
    expect(reviews[0].symbol).toBe('TSLA');
  });

  // ═══════════════════════════════════════════
  // TEST 6: Review links to trade, workflow, news, filing
  // ═══════════════════════════════════════════

  it('6. review links correctly to trade, workflow, news, and filing records', () => {
    // Create linked items
    saveResearchItem({
      item_id: 'ri_trade_plan', kind: 'trade_plan', title: 'NVDA Trade Plan',
      symbol: 'NVDA', symbols: ['NVDA'], thesis: 'Long breakout',
      linked_trade_ids: ['trade_linked_001'],
      linked_workflow_ids: ['wf_001'],
      linked_news_ids: ['news_001'],
      linked_filing_ids: ['filing_001'],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    // Create links
    createResearchLink('ri_trade_plan', 'trade', 'trade_linked_001', db);
    createResearchLink('ri_trade_plan', 'workflow', 'wf_001', db);

    const { links, related } = getLinkedItems('ri_trade_plan', db);
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  // ═══════════════════════════════════════════
  // TEST 9: Similar-trade search excludes unrelated symbols
  // ═══════════════════════════════════════════

  it('9. similar-trade search excludes unrelated symbols unless cross-symbol enabled', () => {
    // Seed trade reviews
    const base = { process_score: 80, discipline_score: 85, what_went_right: [], what_went_wrong: [], mistakes: [], lessons: [], emotional_tags: [], user_notes: '', model_notes: '', created_at: new Date().toISOString() };

    saveTradeReview({ review_id: 'rv_sim1', trade_id: 't_sim1', symbol: 'NVDA', outcome: 'win', result_r: 2.0, market_context: 'breakout above resistance', ...base }, db);
    saveTradeReview({ review_id: 'rv_sim2', trade_id: 't_sim2', symbol: 'NVDA', outcome: 'loss', result_r: -1.0, market_context: 'breakout failed', ...base }, db);
    saveTradeReview({ review_id: 'rv_sim3', trade_id: 't_sim3', symbol: 'AAPL', outcome: 'win', result_r: 1.5, market_context: 'breakout above 190', ...base }, db);
    saveTradeReview({ review_id: 'rv_sim4', trade_id: 't_sim4', symbol: 'TSLA', outcome: 'loss', result_r: -0.5, market_context: 'mean reversion', ...base }, db);

    // Without cross-symbol: only NVDA trades
    const sameSymbol = findSimilarTrades({ symbol: 'NVDA', setup: 'breakout' }, { crossSymbol: false }, db);
    expect(sameSymbol.length).toBe(2);
    expect(sameSymbol.every(t => t.symbol === 'NVDA')).toBe(true);

    // With cross-symbol: includes all
    const crossSymbol = findSimilarTrades({ symbol: 'NVDA', setup: 'breakout' }, { crossSymbol: true }, db);
    expect(crossSymbol.length).toBeGreaterThan(2);
    expect(crossSymbol.some(t => t.symbol !== 'NVDA')).toBe(true);
  });

  // ═══════════════════════════════════════════
  // TEST 10: Event search finds trades around CPI/FOMC
  // ═══════════════════════════════════════════

  it('10. event search finds trades around a mocked CPI/FOMC date', () => {
    // Seed reviews with a CPI date context
    const cpiDate = '2024-06-12T08:30:00Z';
    const nearCpi = '2024-06-12T14:30:00Z';
    const farFromCpi = '2024-01-15T10:00:00Z';

    const base = { process_score: 75, discipline_score: 80, what_went_right: [], what_went_wrong: [], mistakes: [], lessons: [], emotional_tags: [], user_notes: '', model_notes: '' };

    saveTradeReview({ review_id: 'rv_cpi1', trade_id: 't_cpi1', symbol: 'SPY', outcome: 'win', result_r: 1.0, market_context: 'CPI print came in hot', created_at: nearCpi, ...base }, db);
    saveTradeReview({ review_id: 'rv_cpi2', trade_id: 't_cpi2', symbol: 'QQQ', outcome: 'loss', result_r: -1.0, market_context: 'Traded ahead of CPI', created_at: nearCpi, ...base }, db);
    saveTradeReview({ review_id: 'rv_far', trade_id: 't_far', symbol: 'AAPL', outcome: 'win', result_r: 0.5, market_context: 'Regular breakout', created_at: farFromCpi, ...base }, db);

    // Search by date window
    const byDate = findTradesByEvent({ eventDate: cpiDate, eventName: 'CPI', windowDays: 2 }, db);
    expect(byDate.length).toBe(2);
    expect(byDate.every(t => t.event_match.includes('CPI'))).toBe(true);

    // Search by event name keyword
    const byName = findTradesByEvent({ eventName: 'CPI' }, db);
    expect(byName.length).toBe(2);
  });

  // ═══════════════════════════════════════════
  // TEST 11: Mistake search finds tagged mistakes
  // ═══════════════════════════════════════════

  it('11. mistake search finds trades tagged with a recurring mistake', () => {
    saveTradeReview({
      review_id: 'rv_mis1', trade_id: 't_mis1', symbol: 'NVDA', outcome: 'loss', result_r: -2.0,
      process_score: 30, discipline_score: 40,
      what_went_right: [], what_went_wrong: ['Entered without stop'],
      mistakes: ['[model-generated] Traded without a documented plan', 'no stop loss'],
      lessons: ['Always set a stop'], emotional_tags: ['FOMO'],
      user_notes: 'Chased the move without a stop', model_notes: '',
      created_at: new Date().toISOString()
    }, db);
    saveTradeReview({
      review_id: 'rv_mis2', trade_id: 't_mis2', symbol: 'AAPL', outcome: 'loss', result_r: -1.0,
      process_score: 60, discipline_score: 70,
      what_went_right: ['Had a stop'], what_went_wrong: ['Poor entry'],
      mistakes: ['Bad timing'], lessons: ['Wait for confirmation'],
      emotional_tags: ['patient'], user_notes: 'Followed plan but entry was too early', model_notes: '',
      created_at: new Date().toISOString()
    }, db);

    // Search for "stop" mistake
    const stopMistakes = findMistakes({ mistake: 'stop' }, db);
    expect(stopMistakes.length).toBe(1);
    expect(stopMistakes[0].trade_id).toBe('t_mis1');

    // Search for FOMO emotional tag
    const fomoMistakes = findMistakes({ mistake: 'fomo' }, db);
    expect(fomoMistakes.length).toBe(1);
    expect(fomoMistakes[0].trade_id).toBe('t_mis1');
  });

  // ═══════════════════════════════════════════
  // TEST 13: Export produces valid Markdown/JSON/CSV
  // ═══════════════════════════════════════════

  it('13a. exportArchive produces valid JSON', () => {
    saveResearchItem({
      item_id: 'ri_exp1', kind: 'thesis', title: 'Export Test',
      symbol: 'AAPL', symbols: ['AAPL'], thesis: 'Test thesis',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    const result = exportArchive('json', {}, db);
    expect(result.format).toBe('json');
    expect(result.item_count).toBeGreaterThan(0);
    // Should be valid JSON
    const parsed = JSON.parse(result.data);
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.exported_at).toBeDefined();
  });

  it('13b. exportArchive produces valid Markdown', () => {
    saveResearchItem({
      item_id: 'ri_exp2', kind: 'note', title: 'MD Export Test',
      symbol: 'NVDA', symbols: ['NVDA'], thesis: 'Testing markdown export',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    const result = exportArchive('markdown', {}, db);
    expect(result.format).toBe('markdown');
    expect(result.data).toContain('# ARCHIVE Research Export');
    expect(result.data).toContain('MD Export Test');
    expect(result.data).toContain('NVDA');
    expect(result.data).toContain('| Title |');
  });

  it('13c. exportArchive produces valid CSV', () => {
    saveResearchItem({
      item_id: 'ri_exp3', kind: 'thesis', title: 'CSV Export Test',
      symbol: 'TSLA', symbols: ['TSLA'], thesis: 'Testing CSV',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    const result = exportArchive('csv', {}, db);
    expect(result.format).toBe('csv');
    // First line should be headers
    const lines = result.data.split('\n');
    expect(lines[0]).toContain('"item_id"');
    expect(lines[0]).toContain('"title"');
    expect(lines.length).toBeGreaterThan(1);
    // Data row should contain our item
    expect(result.data).toContain('CSV Export Test');
  });

  // ═══════════════════════════════════════════
  // AGENT INTENT PARSING — new intents
  // ═══════════════════════════════════════════

  it('parseArchiveIntent classifies "similar trades" intent', () => {
    const result = parseArchiveIntent('Show similar trades to my last NVDA long');
    expect(result.intent).toBe('similar_trades');
    expect(result.symbol).toBe('NVDA');
  });

  it('parseArchiveIntent classifies "event search" intent', () => {
    const result = parseArchiveIntent('Show all trades around CPI');
    expect(result.intent).toBe('event_search');
  });

  it('parseArchiveIntent classifies "mistake search" intent', () => {
    const result = parseArchiveIntent('Find every time I entered without a stop');
    expect(result.intent).toBe('mistake_search');
  });

  it('parseArchiveIntent classifies "summarize" intent', () => {
    const result = parseArchiveIntent('Summarize my NVDA research');
    expect(result.intent).toBe('summarize');
    expect(result.symbol).toBe('NVDA');
  });

  it('parseArchiveIntent classifies "export to markdown" intent', () => {
    const result = parseArchiveIntent('Export my NVDA research to Markdown');
    expect(result.intent).toBe('export');
    expect(result.symbol).toBe('NVDA');
  });

  // ═══════════════════════════════════════════
  // AGENT COMMAND DISPATCH — new handlers
  // ═══════════════════════════════════════════

  it('ARCHIVE agent handles export to markdown command', async () => {
    const agent = new ArchiveAgent();
    agent.db = db;

    // Seed data
    archiveUserNote({ title: 'Test Note', symbol: 'SPY', thesis: 'Testing', tags: ['test'] }, db);

    const result = await agent.handleCommand('Export my research to Markdown');
    expect(result.status).toBe('ok');
    expect(result.data.export.format).toBe('markdown');
    expect(result.data.export.data).toContain('# ARCHIVE Research Export');
  });

  it('ARCHIVE agent handles export to CSV command', async () => {
    const agent = new ArchiveAgent();
    agent.db = db;

    archiveUserNote({ title: 'CSV Test', symbol: 'AAPL', thesis: 'Testing CSV export', tags: ['csv'] }, db);

    const result = await agent.handleCommand('Export my research to CSV');
    expect(result.status).toBe('ok');
    expect(result.data.export.format).toBe('csv');
    expect(result.data.export.data).toContain('"item_id"');
  });

  it('ARCHIVE agent handles summarize command', async () => {
    const agent = new ArchiveAgent();
    agent.db = db;

    archiveUserNote({ title: 'NVDA Breakout', symbol: 'NVDA', thesis: 'Breaking out above 150', tags: ['breakout'] }, db);
    archiveUserNote({ title: 'NVDA Support', symbol: 'NVDA', thesis: 'Testing 140 support', tags: ['support'] }, db);

    const result = await agent.handleCommand('Summarize my NVDA research');
    expect(result.status).toBe('ok');
    expect(result.data.model_generated).toBe(true);
  });
});
