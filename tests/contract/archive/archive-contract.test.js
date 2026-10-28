import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateResearchItem,
  validatePlaybook,
  validateTradeReview
} from '../../../shared/contract.js';

describe('ARCHIVE Contract Tests — Zod Schema Validation (Phase 6.5)', () => {

  // ── RESEARCH ITEM ──

  it('1. validates a well-formed ResearchItem', () => {
    const result = validateResearchItem({
      item_id: 'ri_001',
      kind: 'thesis',
      title: 'NVDA Thesis',
      symbol: 'NVDA',
      symbols: ['NVDA'],
      thesis: 'Breakout above 150',
      body: 'Analysis details',
      tags: ['breakout'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(result.valid).toBe(true);
  });

  it('2. rejects ResearchItem missing item_id', () => {
    const result = validateResearchItem({
      kind: 'note',
      title: 'No ID',
      thesis: 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('3. rejects ResearchItem with invalid kind', () => {
    const result = validateResearchItem({
      item_id: 'ri_bad',
      kind: 'invalid_kind',
      title: 'Bad Kind',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(result.valid).toBe(false);
  });

  it('4. validates ResearchItem with null symbol', () => {
    const result = validateResearchItem({
      item_id: 'ri_nosym',
      kind: 'note',
      title: 'General Note',
      symbol: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(result.valid).toBe(true);
  });

  it('5. validates confidence is bounded [0, 1]', () => {
    const tooHigh = validateResearchItem({
      item_id: 'ri_c1', kind: 'note', title: 't',
      confidence: 1.5,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    expect(tooHigh.valid).toBe(false);

    const tooLow = validateResearchItem({
      item_id: 'ri_c2', kind: 'note', title: 't',
      confidence: -0.1,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    expect(tooLow.valid).toBe(false);
  });

  // ── PLAYBOOK ──

  it('6. validates a well-formed Playbook', () => {
    const result = validatePlaybook({
      playbook_id: 'pb_001',
      name: 'Breakout Strategy',
      description: 'Buy breakouts',
      performance_summary: {
        trade_count: 10,
        win_rate: 0.6,
        average_r: 1.5,
        profit_factor: 2.0,
        max_drawdown: 3.0,
        calculated_at: new Date().toISOString(),
        data_range: { from: '2024-01-01', to: '2024-12-31' }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(result.valid).toBe(true);
  });

  it('7. rejects Playbook missing performance_summary', () => {
    const result = validatePlaybook({
      playbook_id: 'pb_bad',
      name: 'No Stats',
      description: 'Missing performance',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(result.valid).toBe(false);
  });

  // ── TRADE REVIEW ──

  it('8. validates a well-formed TradeReview', () => {
    const result = validateTradeReview({
      review_id: 'rv_001',
      trade_id: 'trade_001',
      symbol: 'AAPL',
      outcome: 'win',
      result_r: 2.5,
      process_score: 85,
      discipline_score: 90,
      created_at: new Date().toISOString()
    });
    expect(result.valid).toBe(true);
  });

  it('9. rejects TradeReview with invalid outcome', () => {
    const result = validateTradeReview({
      review_id: 'rv_bad',
      trade_id: 'trade_bad',
      symbol: 'AAPL',
      outcome: 'invalid_outcome',
      created_at: new Date().toISOString()
    });
    expect(result.valid).toBe(false);
  });

  it('10. validates process_score is bounded [0, 100]', () => {
    const tooHigh = validateTradeReview({
      review_id: 'rv_ps1', trade_id: 't_ps1', symbol: 'AAPL',
      process_score: 150,
      created_at: new Date().toISOString()
    });
    expect(tooHigh.valid).toBe(false);

    const tooLow = validateTradeReview({
      review_id: 'rv_ps2', trade_id: 't_ps2', symbol: 'AAPL',
      process_score: -5,
      created_at: new Date().toISOString()
    });
    expect(tooLow.valid).toBe(false);
  });

  it('11. validates discipline_score is bounded [0, 100]', () => {
    const tooHigh = validateTradeReview({
      review_id: 'rv_ds1', trade_id: 't_ds1', symbol: 'AAPL',
      discipline_score: 200,
      created_at: new Date().toISOString()
    });
    expect(tooHigh.valid).toBe(false);
  });

  it('12. allows nullable result_r', () => {
    const result = validateTradeReview({
      review_id: 'rv_null_r', trade_id: 't_null_r', symbol: 'AAPL',
      result_r: null,
      created_at: new Date().toISOString()
    });
    expect(result.valid).toBe(true);
  });

  it('13. allows nullable thesis_validated and followed_plan', () => {
    const result = validateTradeReview({
      review_id: 'rv_null_bool', trade_id: 't_null_bool', symbol: 'TSLA',
      thesis_validated: null,
      followed_plan: null,
      created_at: new Date().toISOString()
    });
    expect(result.valid).toBe(true);
  });
});
