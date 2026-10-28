import { describe, it, expect, beforeEach } from 'vitest';
import { initArchiveDatabase } from '../../../services/archive/archivePersistence.js';
import {
  saveResearchItem,
  getResearchItem,
  listResearchItems,
  updateResearchItem,
  deleteResearchItem,
  savePlaybook,
  getPlaybook,
  listPlaybooks,
  saveTradeReview,
  getTradeReview,
  listTradeReviews,
  saveEmbedding,
  getEmbedding,
  listAllEmbeddings
} from '../../../services/archive/archivePersistence.js';

describe('ARCHIVE Unit Tests — Persistence Layer (Phase 6.5)', () => {
  let db;

  beforeEach(() => {
    db = initArchiveDatabase(':memory:');
  });

  // ── RESEARCH ITEMS ──

  it('1. saves and retrieves a research item', () => {
    const item = {
      item_id: 'ri_test001',
      kind: 'thesis',
      title: 'NVDA Breakout Thesis',
      symbol: 'NVDA',
      symbols: ['NVDA'],
      asset_class: 'equity',
      timeframe: 'swing',
      thesis: 'NVDA breaking out above 150 resistance',
      body: 'Detailed analysis body',
      tags: ['breakout', 'nvda'],
      source_refs: [],
      linked_trade_ids: [],
      linked_workflow_ids: [],
      linked_news_ids: [],
      linked_filing_ids: [],
      confidence: 0.85,
      user_authored: true,
      model_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveResearchItem(item, db);
    const retrieved = getResearchItem('ri_test001', db);

    expect(retrieved).not.toBeNull();
    expect(retrieved.item_id).toBe('ri_test001');
    expect(retrieved.kind).toBe('thesis');
    expect(retrieved.title).toBe('NVDA Breakout Thesis');
    expect(retrieved.symbol).toBe('NVDA');
    expect(retrieved.confidence).toBe(0.85);
    expect(retrieved.user_authored).toBe(true);
    expect(retrieved.model_generated).toBe(false);
  });

  it('2. lists research items with symbol filter', () => {
    const items = [
      { item_id: 'ri_a', kind: 'note', title: 'AAPL Note', symbol: 'AAPL', symbols: ['AAPL'], thesis: 't', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { item_id: 'ri_b', kind: 'note', title: 'NVDA Note', symbol: 'NVDA', symbols: ['NVDA'], thesis: 't', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { item_id: 'ri_c', kind: 'note', title: 'AAPL Thesis', symbol: 'AAPL', symbols: ['AAPL'], thesis: 't', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    items.forEach(i => saveResearchItem(i, db));

    const aaplItems = listResearchItems({ symbol: 'AAPL' }, db);
    expect(aaplItems.length).toBe(2);
    expect(aaplItems.every(i => i.symbol === 'AAPL')).toBe(true);
  });

  it('3. updates a research item preserving other fields', () => {
    saveResearchItem({
      item_id: 'ri_upd', kind: 'thesis', title: 'Original', symbol: 'TSLA', symbols: ['TSLA'],
      thesis: 'Original thesis', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    updateResearchItem('ri_upd', { title: 'Updated Title', thesis: 'New thesis' }, db);
    const updated = getResearchItem('ri_upd', db);

    expect(updated.title).toBe('Updated Title');
    expect(updated.thesis).toBe('New thesis');
    expect(updated.symbol).toBe('TSLA'); // preserved
  });

  it('4. deletes a research item and its FTS/tags/embeddings', () => {
    saveResearchItem({
      item_id: 'ri_del', kind: 'note', title: 'Deletable', symbol: 'SPY', symbols: ['SPY'],
      tags: ['test'], thesis: 'test', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);

    saveEmbedding('ri_del', [0.1, 0.2, 0.3], db);
    expect(getEmbedding('ri_del', db)).not.toBeNull();

    deleteResearchItem('ri_del', db);
    expect(getResearchItem('ri_del', db)).toBeNull();
    expect(getEmbedding('ri_del', db)).toBeNull();
  });

  it('5. rejects invalid research item (missing required fields)', () => {
    expect(() => saveResearchItem({ title: 'No ID' }, db)).toThrow();
  });

  // ── PLAYBOOKS ──

  it('6. saves and retrieves a playbook with performance stats', () => {
    const pb = {
      playbook_id: 'pb_test001',
      name: 'Breakout Strategy',
      description: 'Buy breakouts above resistance',
      market_regime: 'bullish',
      symbols: ['AAPL', 'NVDA'],
      timeframes: ['swing'],
      entry_rules: ['Buy above prior high'],
      stop_rules: ['Stop 2% below entry'],
      target_rules: ['Target 3:1 R:R'],
      invalidation_rules: ['Close below support'],
      position_sizing_rules: [],
      event_filters: [],
      required_context: [],
      example_trade_ids: ['t1', 't2'],
      performance_summary: {
        trade_count: 10,
        win_rate: 0.6,
        average_r: 1.5,
        profit_factor: 2.1,
        max_drawdown: 3.2,
        calculated_at: new Date().toISOString(),
        data_range: { from: '2024-01-01', to: '2024-12-31' }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    savePlaybook(pb, db);
    const retrieved = getPlaybook('pb_test001', db);

    expect(retrieved).not.toBeNull();
    expect(retrieved.name).toBe('Breakout Strategy');
    expect(retrieved.performance_summary.win_rate).toBe(0.6);
    expect(retrieved.symbols).toContain('NVDA');
    expect(retrieved.entry_rules[0]).toBe('Buy above prior high');
  });

  it('7. lists all playbooks ordered by created_at desc', () => {
    const t1 = new Date('2024-01-01').toISOString();
    const t2 = new Date('2024-06-01').toISOString();
    const perfSummary = { trade_count: 0, win_rate: 0, average_r: 0, profit_factor: 0, max_drawdown: 0, calculated_at: t1, data_range: { from: t1, to: t1 } };

    savePlaybook({ playbook_id: 'pb_a', name: 'Older', description: 'd', performance_summary: { ...perfSummary }, created_at: t1, updated_at: t1 }, db);
    savePlaybook({ playbook_id: 'pb_b', name: 'Newer', description: 'd', performance_summary: { ...perfSummary, calculated_at: t2 }, created_at: t2, updated_at: t2 }, db);

    const pbs = listPlaybooks(db);
    expect(pbs.length).toBe(2);
    expect(pbs[0].name).toBe('Newer');
  });

  // ── TRADE REVIEWS ──

  it('8. saves and retrieves a trade review', () => {
    const review = {
      review_id: 'rv_test001',
      trade_id: 'trade_001',
      symbol: 'AAPL',
      outcome: 'win',
      result_r: 2.5,
      process_score: 85,
      discipline_score: 90,
      what_went_right: ['Good entry'],
      what_went_wrong: [],
      mistakes: [],
      lessons: ['Patience pays'],
      market_context: 'Bullish trend',
      thesis_at_entry: 'Breakout above 190',
      thesis_validated: true,
      followed_plan: true,
      emotional_tags: [],
      user_notes: 'Clean trade',
      model_notes: '[model-generated] Process score: 85/100',
      created_at: new Date().toISOString()
    };

    saveTradeReview(review, db);
    const retrieved = getTradeReview('trade_001', db);

    expect(retrieved).not.toBeNull();
    expect(retrieved.symbol).toBe('AAPL');
    expect(retrieved.outcome).toBe('win');
    expect(retrieved.result_r).toBe(2.5);
    expect(retrieved.process_score).toBe(85);
    expect(retrieved.followed_plan).toBe(true);
  });

  it('9. lists trade reviews filtered by symbol', () => {
    const base = { process_score: 70, discipline_score: 80, what_went_right: [], what_went_wrong: [], mistakes: [], lessons: [], emotional_tags: [], user_notes: '', model_notes: '', created_at: new Date().toISOString() };
    saveTradeReview({ review_id: 'rv_a', trade_id: 't_a', symbol: 'AAPL', outcome: 'win', ...base }, db);
    saveTradeReview({ review_id: 'rv_b', trade_id: 't_b', symbol: 'NVDA', outcome: 'loss', ...base }, db);
    saveTradeReview({ review_id: 'rv_c', trade_id: 't_c', symbol: 'AAPL', outcome: 'loss', ...base }, db);

    const aaplReviews = listTradeReviews({ symbol: 'AAPL' }, db);
    expect(aaplReviews.length).toBe(2);
  });

  // ── EMBEDDINGS ──

  it('10. saves and retrieves embedding vectors', () => {
    const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
    saveEmbedding('ri_emb', vector, db);
    const retrieved = getEmbedding('ri_emb', db);
    expect(retrieved).toEqual(vector);
  });

  it('11. lists all embeddings', () => {
    saveEmbedding('ri_e1', [1, 0, 0], db);
    saveEmbedding('ri_e2', [0, 1, 0], db);
    const all = listAllEmbeddings(db);
    expect(all.length).toBe(2);
  });

  it('12. deleting a research item removes its embedding', () => {
    saveResearchItem({
      item_id: 'ri_emb_del', kind: 'note', title: 'Emb Test', symbol: 'SPY', symbols: ['SPY'],
      thesis: 't', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, db);
    saveEmbedding('ri_emb_del', [0.5, 0.5], db);

    deleteResearchItem('ri_emb_del', db);
    expect(getEmbedding('ri_emb_del', db)).toBeNull();
  });

  // ── WAL MODE ──

  it('13. database is initialized (no crash for in-memory)', () => {
    const testDb = initArchiveDatabase(':memory:');
    expect(testDb).toBeDefined();
  });
});
