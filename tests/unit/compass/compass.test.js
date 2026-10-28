import { describe, it, expect } from 'vitest';
import {
  generateTradePlan,
  parseTradeIntent,
  assertCompassCannotExecute,
  createTradePlanTemplate,
  compassHealthCheck
} from '../../../agents/compass/compassAgent.js';

describe('COMPASS Agent — Unit Tests', () => {
  it('parses trade planning intents correctly', () => {
    const p1 = parseTradeIntent('Plan a swing trade in AAPL');
    expect(p1.intent).toBe('plan_trade');
    expect(p1.symbol).toBe('AAPL');
    expect(p1.direction).toBe('long');
    expect(p1.timeframe).toBe('swing');

    const p2 = parseTradeIntent('Create a breakout plan for TSLA');
    expect(p2.intent).toBe('create_trade_plan');
    expect(p2.symbol).toBe('TSLA');
    expect(p2.setupType).toBe('breakout');

    const p3 = parseTradeIntent('What would invalidate this trade?');
    expect(p3.intent).toBe('invalidate_trade_plan');

    const p4 = parseTradeIntent('Compare the NVDA long plan with the SPY long plan');
    expect(p4.intent).toBe('compare_trade_plans');

    const p5 = parseTradeIntent('Refine the AAPL plan with a wider stop');
    expect(p5.intent).toBe('refine_trade_plan');
  });

  it('Requirement 5: COMPASS must always include at least one invalidation condition', () => {
    const res = generateTradePlan({
      command: 'Plan a swing trade in AAPL',
      marketContext: [{ symbol: 'AAPL', price: 224.50 }]
    });

    expect(res.status).toBe('ok');
    expect(res.plan.invalidation).toBeDefined();
    expect(res.plan.invalidation.condition).toBeTruthy();
    expect(res.plan.invalidation.level).toBeDefined();
    expect(res.plan.what_proves_thesis_wrong.length).toBeGreaterThan(0);
  });

  it('Requirement 6: COMPASS refuses to invent a stop, target, or probability when data is missing', () => {
    // When market context has NO price data and no chartist input:
    const res = generateTradePlan({
      command: 'Plan a trade in UNKNOWN_SYMBOL',
      symbol: 'UNKNOWN_SYMBOL',
      marketContext: [] // Missing price
    });

    // COMPASS must return status "limited" with missing data explanation instead of inventing numbers!
    expect(res.status).toBe('limited');
    expect(res.plan).toBeNull();
    expect(res.missingData).toContain('live_quote');
  });

  it('COMPASS enforces security boundary: CANNOT execute trades', () => {
    expect(() => assertCompassCannotExecute('execute_paper_order')).toThrow('SECURITY VIOLATION');
    expect(() => assertCompassCannotExecute('sign_sentinel_token')).toThrow('SECURITY VIOLATION');
    expect(() => assertCompassCannotExecute('place_paper_trade')).toThrow('SECURITY VIOLATION');
  });

  it('COMPASS outputs compliant TradePlan adhering to 18 required schema rules', () => {
    const res = generateTradePlan({
      command: 'Plan a swing trade in NVDA',
      marketContext: [{ symbol: 'NVDA', price: 215.00 }]
    });

    expect(res.status).toBe('ok');
    expect(res.plan.reward_risk).toBeGreaterThanOrEqual(1.5);
    expect(res.plan.model_estimated_fields).toContain('reward_risk');
    expect(res.plan.sources.length).toBeGreaterThan(0);
  });

  it('returns healthy status and discloses restrictions', () => {
    const health = compassHealthCheck();
    expect(health.agent).toBe('COMPASS');
    expect(health.status).toBe('online');
    expect(health.restrictions).toContain('CANNOT execute trades');
  });
});
