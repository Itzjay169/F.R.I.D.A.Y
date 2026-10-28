import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  TradePlanSchema,
  WorkflowStateSchema,
  SentinelVerdictSchema,
  validateTradePlan,
  validateWorkflowState,
  validateSentinelVerdict
} from '../../../shared/contract.js';

describe('TradePlan Contract & Zod Schema Validation', () => {
  const createSamplePlan = () => ({
    plan_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    symbol: 'AAPL',
    asset_class: 'equity',
    direction: 'long',
    timeframe: 'swing',
    thesis: 'Swing trade above 20 EMA',
    market_regime: 'trending',
    catalysts: [
      {
        type: 'technical',
        description: 'Support bounce at $220',
        source: 'chartist:technicals',
        published_at: null
      }
    ],
    entry: {
      type: 'pullback',
      trigger: 'Bounce near $224',
      price: 224.50,
      zone: { low: 223.00, high: 225.00 }
    },
    invalidation: {
      level: 217.50,
      condition: 'Daily close below $217.50',
      source: 'compass:technical-invalidation'
    },
    stop: {
      price: 217.50,
      percent: 3.1,
      rationale: 'Stop below key swing low'
    },
    targets: [
      {
        label: 'T1',
        price: 238.50,
        rationale: 'Prior swing high resistance',
        allocation_percent: 70
      }
    ],
    position_size: {
      quantity: 100,
      notional: 22450,
      risk_amount: 700,
      risk_percent_of_equity: 0.04,
      sizing_method: 'fixed_risk'
    },
    reward_risk: 2.0,
    time_stop: '10 trading days',
    event_risks: ['FOMC in 14 days'],
    bull_case: 'Expansion to $240',
    bear_case: 'Breakdown to $215',
    what_proves_thesis_right: ['Higher low on 1D'],
    what_proves_thesis_wrong: ['Break below $217.50'],
    confidence: 0.75,
    sources: ['finnhub:quote:AAPL', 'sec-edgar:10-q:AAPL'],
    model_estimated_fields: ['reward_risk', 'targets'],
    sentinel_verdict: 'pending',
    sentinel_notes: null,
    status: 'ready_for_review'
  });

  it('validates a complete, compliant TradePlan', () => {
    const plan = createSamplePlan();
    const result = validateTradePlan(plan);
    expect(result.valid).toBe(true);
  });

  it('rejects a trade plan missing plan_id or with invalid UUID', () => {
    const plan = createSamplePlan();
    plan.plan_id = 'not-a-uuid';
    const result = validateTradePlan(plan);
    expect(result.valid).toBe(false);
  });

  it('rejects an invalid asset class or direction', () => {
    const plan = createSamplePlan();
    plan.direction = 'super-bullish'; // Invalid
    const result = validateTradePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('direction'))).toBe(true);
  });

  it('rule: every plan field either has a source or is null (Requirement 13)', () => {
    const plan = createSamplePlan();
    expect(plan.sources.length).toBeGreaterThan(0);
    expect(plan.invalidation.source).toBeTruthy();
    expect(plan.catalysts.every(c => typeof c.source === 'string')).toBe(true);
  });

  it('validates SentinelVerdictSchema', () => {
    const verdict = {
      verdict: 'approve',
      reason: 'Valid risk profile',
      required_changes: [],
      suggested_quantity: 100,
      suggested_stop: 217.50,
      suggested_target: 238.50,
      risk_amount: 700,
      risk_percent: 0.04,
      event_risks: [],
      sources: ['sentinel:risk-engine-v2']
    };
    const result = validateSentinelVerdict(verdict);
    expect(result.valid).toBe(true);
  });

  it('validates WorkflowStateSchema', () => {
    const wf = {
      workflow_id: crypto.randomUUID(),
      goal: 'Plan a swing trade in AAPL',
      intent: 'plan_trade',
      symbol: 'AAPL',
      status: 'created',
      current_step: 'clarify_request',
      steps: [
        {
          id: 'clarify_request',
          agent: 'MASTER',
          task: 'Clarify constraints',
          status: 'done',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          response_ref: null,
          error: null
        }
      ],
      trade_plan: null,
      sentinel_verdict: null,
      awaiting_user: false,
      user_decision: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const result = validateWorkflowState(wf);
    expect(result.valid).toBe(true);
  });
});
