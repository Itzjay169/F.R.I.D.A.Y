import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  submitUserDecision,
  getWorkflowSummary
} from '../../../master/workflow/workflowEngine.js';
import {
  initWorkflowDatabase,
  setDb,
  loadWorkflow,
  saveWorkflow
} from '../../../master/workflow/sqlitePersistence.js';
import { reviewTradePlanWithSentinel } from '../../../services/sentinelReview.js';
import { generateTradePlan } from '../../../agents/compass/compassAgent.js';

describe('Workflow Engine — Unit Tests', () => {
  beforeEach(() => {
    // Isolated in-memory SQLite database for test predictability
    const testDb = initWorkflowDatabase(':memory:');
    setDb(testDb);
  });

  it('Requirement 1: "Plan a swing trade in AAPL" creates a workflow with the correct steps', () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in AAPL',
      symbol: 'AAPL'
    });

    expect(wf.workflow_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(wf.goal).toBe('Plan a swing trade in AAPL');
    expect(wf.symbol).toBe('AAPL');
    expect(wf.status).toBe('created');
    expect(wf.steps.length).toBe(10);

    const stepIds = wf.steps.map(s => s.id);
    expect(stepIds).toEqual([
      'clarify_request',
      'macro_context',
      'news_catalysts',
      'fundamentals_filings',
      'technical_structure',
      'probability_outlook',
      'draft_plan',
      'risk_review',
      'present_plan',
      'wait_for_user'
    ]);

    expect(wf.steps.find(s => s.id === 'wait_for_user').agent).toBe('USER');
  });

  it('Requirement 11: Workflow survives an app restart (SQLite persistence and reload)', () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in NVDA',
      symbol: 'NVDA'
    });

    // Simulate agent outputs & state change
    wf.status = 'waiting_for_user';
    wf.awaiting_user = true;
    wf.trade_plan = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'NVDA',
      thesis: 'Test thesis'
    };
    saveWorkflow(wf);

    // Rehydrate from SQLite (simulating fresh app process)
    const restoredWf = loadWorkflow(wf.workflow_id);
    expect(restoredWf).not.toBeNull();
    expect(restoredWf.workflow_id).toBe(wf.workflow_id);
    expect(restoredWf.symbol).toBe('NVDA');
    expect(restoredWf.status).toBe('waiting_for_user');
    expect(restoredWf.awaiting_user).toBe(true);
    expect(restoredWf.steps.length).toBe(10);
  });

  it('Requirement 12: Workflow can be paused, resumed, and cancelled', () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in MSFT',
      symbol: 'MSFT'
    });

    // Pause
    const pausedRes = pauseWorkflow(wf.workflow_id);
    expect(pausedRes.success).toBe(true);
    expect(pausedRes.workflow.status).toBe('paused');

    // Resume
    const resumedRes = resumeWorkflow(wf.workflow_id);
    expect(resumedRes.success).toBe(true);
    expect(resumedRes.workflow.status).toBe('running');

    // Cancel
    const cancelRes = cancelWorkflow(wf.workflow_id, 'User changed mind');
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.workflow.status).toBe('cancelled');
    expect(cancelRes.workflow.awaiting_user).toBe(false);
  });

  it('Requirement 7: SENTINEL vetoes a plan with no stop', () => {
    const { plan } = generateTradePlan({
      command: 'Plan a swing trade in AAPL',
      marketContext: [{ symbol: 'AAPL', price: 220.00 }]
    });

    // Remove stop price
    plan.stop.price = null;

    const verdict = reviewTradePlanWithSentinel(plan);
    expect(verdict.verdict).toBe('veto');
    expect(verdict.reason).toContain('stop-loss is missing');
  });

  it('Requirement 8: SENTINEL modifies a plan whose risk exceeds configured limit', () => {
    const { plan } = generateTradePlan({
      command: 'Plan a swing trade in AAPL',
      marketContext: [{ symbol: 'AAPL', price: 200.00 }]
    });

    // Artificially inflate position size to 50,000 shares (exceeding 2% risk)
    plan.position_size.quantity = 50000;

    const verdict = reviewTradePlanWithSentinel(plan, {
      config: { deskEquity: 100000, maxRiskPerTradePct: 2.0 } // Max risk $2,000
    });

    expect(verdict.verdict).toBe('modify');
    expect(verdict.suggested_quantity).toBeLessThan(50000);
    expect(verdict.reason).toContain('exceeds maximum allowable risk');
  });

  it('Requirement 9: SENTINEL vetoes a plan during a major scheduled event unless event-risk override is enabled', () => {
    const { plan } = generateTradePlan({
      command: 'Plan a swing trade in AAPL',
      marketContext: [{ symbol: 'AAPL', price: 220.00 }]
    });

    plan.event_risks = ['FOMC Rate Decision Tomorrow'];

    // Without override -> VETO
    const verdictWithoutOverride = reviewTradePlanWithSentinel(plan, { eventRiskOverride: false });
    expect(verdictWithoutOverride.verdict).toBe('veto');
    expect(verdictWithoutOverride.reason).toContain('High-impact scheduled event');

    // With explicit override -> APPROVE
    const verdictWithOverride = reviewTradePlanWithSentinel(plan, { eventRiskOverride: true });
    expect(verdictWithOverride.verdict).toBe('approve');
  });

  it('Requirement 10: A VETO prevents the user from approving the plan', () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in TSLA',
      symbol: 'TSLA'
    });

    wf.status = 'waiting_for_user';
    wf.awaiting_user = true;
    wf.sentinel_verdict = {
      verdict: 'veto',
      reason: 'No stop loss provided'
    };
    saveWorkflow(wf);

    // Attempt to approve
    const decisionRes = submitUserDecision(wf.workflow_id, 'approve');
    expect(decisionRes.success).toBe(false);
    expect(decisionRes.error).toContain('Cannot approve a trade plan that has been VETOED');
  });
});
