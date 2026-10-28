import { describe, it, expect } from 'vitest';
import {
  validateTradePlan,
  createTradePlanTemplate,
  assertCompassCannotExecute,
  TRADE_PLAN_REQUIRED_FIELDS,
  VALID_REGIMES,
  VALID_ENTRY_TYPES,
  VALID_PLAN_STATUSES
} from '../agents/compass/contract.js';

import {
  parseTradeIntent,
  generateTradePlan,
  getTradePlan,
  listTradePlans,
  cancelTradePlan,
  compassHealthCheck
} from '../agents/compass/compassAgent.js';

// =============================================================================
// COMPASS CONTRACT TESTS
// =============================================================================
describe('COMPASS Contract Schema', () => {
  it('should list all required trade plan fields', () => {
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('planId');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('symbol');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('thesis');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('stopLoss');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('targets');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('positionSize');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('riskAmount');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('rewardRisk');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('invalidations');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('eventRisks');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('provesThesisWrong');
    expect(TRADE_PLAN_REQUIRED_FIELDS).toContain('provesThesisRight');
    expect(TRADE_PLAN_REQUIRED_FIELDS.length).toBeGreaterThanOrEqual(18);
  });

  it('should reject a plan with missing required fields', () => {
    const badPlan = { symbol: 'AAPL', thesis: 'Buy it' };
    const result = validateTradePlan(badPlan);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject a plan with invalid market regime', () => {
    const plan = createTradePlanTemplate('NVDA');
    plan.thesis = 'Test thesis for NVDA trade';
    plan.marketRegime = 'moon-shot'; // Invalid regime
    plan.catalyst = 'Test';
    plan.entryTrigger = 'Test entry';
    plan.invalidations = ['If price drops'];
    plan.stopLoss = 100;
    plan.targets = [{ level: 120, label: 'T1' }];
    plan.positionSize = 50;
    plan.riskAmount = 500;
    plan.rewardRisk = 2.0;
    plan.timeStop = '5 days';
    plan.eventRisks = ['FOMC'];
    plan.provesThesisWrong = 'Breakdown';
    plan.provesThesisRight = 'Breakout';

    const result = validateTradePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('marketRegime'))).toBe(true);
  });

  it('should accept a fully valid trade plan', () => {
    const plan = createTradePlanTemplate('AAPL');
    plan.thesis = 'AAPL pullback to 20-day EMA with bullish volume';
    plan.marketRegime = 'trending-up';
    plan.catalyst = 'Earnings beat + guidance raise';
    plan.entryType = 'pullback-to-level';
    plan.entryTrigger = 'Bounce from $220 with increasing volume';
    plan.invalidations = ['Close below $215 on daily', 'Sector weakness'];
    plan.stopLoss = 215;
    plan.targets = [{ level: 235, label: 'T1' }, { level: 245, label: 'T2' }];
    plan.positionSize = 100;
    plan.riskAmount = 500;
    plan.rewardRisk = 3.0;
    plan.timeStop = '10 days';
    plan.eventRisks = ['Earnings 11/02', 'FOMC 11/07'];
    plan.provesThesisWrong = 'Close below EMA with volume expansion';
    plan.provesThesisRight = 'Higher low holds and advances to T1';

    const result = validateTradePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn when reward:risk is below 1.0', () => {
    const plan = createTradePlanTemplate('TSLA');
    plan.thesis = 'TSLA scalp setup - very short timeframe';
    plan.marketRegime = 'range-bound';
    plan.catalyst = 'Range play';
    plan.entryType = 'limit';
    plan.entryTrigger = 'Touch of range bottom';
    plan.invalidations = ['Break below range'];
    plan.stopLoss = 240;
    plan.targets = [{ level: 248, label: 'T1' }];
    plan.positionSize = 50;
    plan.riskAmount = 250;
    plan.rewardRisk = 0.8; // Below 1.0
    plan.timeStop = '1 day';
    plan.eventRisks = [];
    plan.provesThesisWrong = 'Range break down';
    plan.provesThesisRight = 'Range holds';

    const result = validateTradePlan(plan);
    expect(result.warnings.some(w => w.includes('below 1.0'))).toBe(true);
  });

  it('should create a template with a unique planId', () => {
    const t1 = createTradePlanTemplate('SPY');
    const t2 = createTradePlanTemplate('QQQ');
    expect(t1.planId).not.toBe(t2.planId);
    expect(t1.symbol).toBe('SPY');
    expect(t2.symbol).toBe('QQQ');
    expect(t1.status).toBe('draft');
  });
});

// =============================================================================
// COMPASS SECURITY BOUNDARY TESTS
// =============================================================================
describe('COMPASS Security Boundary', () => {
  it('COMPASS must NOT be able to execute paper orders', () => {
    expect(() => assertCompassCannotExecute('execute_paper_order')).toThrow('SECURITY VETO');
  });

  it('COMPASS must NOT be able to generate Sentinel tokens', () => {
    expect(() => assertCompassCannotExecute('generate_sentinel_token')).toThrow('SECURITY VETO');
  });

  it('COMPASS must NOT be able to place orders', () => {
    expect(() => assertCompassCannotExecute('place_order')).toThrow('SECURITY VETO');
  });

  it('COMPASS must NOT be able to approve trades', () => {
    expect(() => assertCompassCannotExecute('approve_trade')).toThrow('SECURITY VETO');
  });

  it('COMPASS must NOT be able to close positions', () => {
    expect(() => assertCompassCannotExecute('close_position')).toThrow('SECURITY VETO');
  });

  it('COMPASS may generate trade plans (analysis action)', () => {
    expect(() => assertCompassCannotExecute('generate_trade_plan')).not.toThrow();
  });
});

// =============================================================================
// COMPASS AGENT TESTS
// =============================================================================
describe('COMPASS Trade Planner Agent', () => {
  it('should parse "Plan a swing trade in AAPL"', () => {
    const intent = parseTradeIntent('Plan a swing trade in AAPL');
    expect(intent.symbol).toBe('AAPL');
    expect(intent.setupType).toBe('swing');
  });

  it('should parse "Create a breakout plan for TSLA"', () => {
    const intent = parseTradeIntent('Create a breakout plan for TSLA');
    expect(intent.symbol).toBe('TSLA');
    expect(intent.setupType).toBe('breakout');
  });

  it('should parse "Build an options plan for earnings"', () => {
    const intent = parseTradeIntent('Build an options plan for NVDA earnings');
    expect(intent.symbol).toBe('NVDA');
    expect(intent.setupType).toBe('options');
  });

  it('should parse common ticker names', () => {
    expect(parseTradeIntent('trade nvidia').symbol).toBe('NVDA');
    expect(parseTradeIntent('trade tesla').symbol).toBe('TSLA');
    expect(parseTradeIntent('trade apple').symbol).toBe('AAPL');
  });

  it('should detect direction bias', () => {
    expect(parseTradeIntent('long AAPL swing trade').direction).toBe('long');
    expect(parseTradeIntent('short TSLA').direction).toBe('short');
    expect(parseTradeIntent('trade NVDA').direction).toBe('neutral');
  });

  it('should generate a valid swing trade plan with market context', () => {
    const marketContext = [
      { symbol: 'AAPL', price: 225.00, changePct: 0.5 }
    ];
    const result = generateTradePlan({
      command: 'Plan a swing trade in AAPL',
      marketContext
    });

    expect(result.status).toBe('ok');
    expect(result.plan).toBeTruthy();
    expect(result.plan.symbol).toBe('AAPL');
    expect(result.plan.thesis).toBeTruthy();
    expect(result.plan.stopLoss).toBeTypeOf('number');
    expect(result.plan.targets.length).toBeGreaterThan(0);
    expect(result.plan.invalidations.length).toBeGreaterThan(0);
    expect(result.plan.eventRisks.length).toBeGreaterThan(0);
    expect(result.plan.status).toBe('pending-review');
    expect(result.nextStep).toBe('SENTINEL risk-check');
  });

  it('should generate a valid breakout trade plan', () => {
    const result = generateTradePlan({
      command: 'Create a breakout plan for NVDA',
      marketContext: [{ symbol: 'NVDA', price: 150.00 }]
    });

    expect(result.status).toBe('ok');
    expect(result.plan.marketRegime).toBe('breakout');
    expect(result.plan.entryType).toBe('breakout-confirmation');
  });

  it('should return error when no symbol is found', () => {
    const result = generateTradePlan({ command: 'Plan a trade' });
    expect(result.status).toBe('error');
    expect(result.error).toContain('ticker symbol');
  });

  it('should store and retrieve plans', () => {
    const result = generateTradePlan({
      command: 'Plan a swing trade in MSFT',
      marketContext: [{ symbol: 'MSFT', price: 420.00 }]
    });
    const planId = result.plan.planId;
    const retrieved = getTradePlan(planId);
    expect(retrieved).toBeTruthy();
    expect(retrieved.symbol).toBe('MSFT');
  });

  it('should list plans filtered by symbol', () => {
    generateTradePlan({
      command: 'swing trade in SPY',
      marketContext: [{ symbol: 'SPY', price: 560.00 }]
    });
    const spyPlans = listTradePlans({ symbol: 'SPY' });
    expect(spyPlans.length).toBeGreaterThan(0);
    expect(spyPlans.every(p => p.symbol === 'SPY')).toBe(true);
  });

  it('should cancel a trade plan', () => {
    const result = generateTradePlan({
      command: 'trade AMD',
      marketContext: [{ symbol: 'AMD', price: 160.00 }]
    });
    const cancel = cancelTradePlan(result.plan.planId);
    expect(cancel.success).toBe(true);
    expect(cancel.plan.status).toBe('cancelled');
  });

  it('should support buildTradePlan flexible signature with command and quote', () => {
    const { buildTradePlan } = require('../agents/compass/compassAgent.js');
    const result = buildTradePlan('Plan a swing trade in NVDA', { symbol: 'NVDA', price: 215.50 });
    expect(result.status).toBe('ok');
    expect(result.plan.symbol).toBe('NVDA');
    expect(result.plan.entryPrice).toBe(215.50);
  });

  it('should report healthy status', () => {
    const health = compassHealthCheck();
    expect(health.agent).toBe('COMPASS');
    expect(health.status).toBe('online');
    expect(health.restrictions).toContain('CANNOT execute trades');
  });
});
