import { describe, it, expect } from 'vitest';
import { validateRequest, validateResponse, createResponse } from '../shared/contract.js';

describe('Shared Message Contract Validation', () => {
  it('should accept valid agent requests', () => {
    const validReq = {
      id: 'req-001',
      from: 'friday',
      to: 'atlas',
      intent: 'macro_briefing',
      params: { scope: 'daily' },
      deadline_ms: 8000
    };
    const res = validateRequest(validReq);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('should reject requests with missing fields', () => {
    const badReq = { id: 'req-002', from: 'friday' }; // missing to, intent
    const res = validateRequest(badReq);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('should enforce mandatory "sources" on agent responses', () => {
    const badRes = {
      id: 'res-001',
      agent: 'athena',
      status: 'ok',
      summary: 'NVDA balance sheet looks solid',
      data: { pe_ratio: 45.2 },
      sources: [], // EMPTY SOURCES MUST FAIL
      confidence: 0.95,
      spoken_text: 'Athena reports positive fundamentals.',
      timestamp: new Date().toISOString()
    };
    const res = validateResponse(badRes);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('"sources" array is mandatory and must not be empty');
  });

  it('should accept compliant agent responses with sources', () => {
    const goodRes = {
      id: 'res-002',
      agent: 'athena',
      status: 'ok',
      summary: 'NVDA earnings analysis complete',
      data: { revenue_growth: '122%' },
      sources: ['sec-edgar:10-q:NVDA:2026-Q2', 'finnhub:financials:NVDA'],
      confidence: 0.98,
      spoken_text: 'Athena reports revenue up 122 percent.',
      timestamp: new Date().toISOString()
    };
    const res = validateResponse(goodRes);
    expect(res.valid).toBe(true);
  });

  it('should validate status values strictly', () => {
    const invalidStatusRes = {
      id: 'res-003',
      agent: 'sentinel',
      status: 'approved_trade', // NOT in ['ok', 'error', 'veto', 'limited']
      summary: 'Testing invalid status',
      sources: ['system:rulebook'],
      confidence: 1.0,
      spoken_text: 'Done',
      timestamp: new Date().toISOString()
    };
    const res = validateResponse(invalidStatusRes);
    expect(res.valid).toBe(false);
  });
});
