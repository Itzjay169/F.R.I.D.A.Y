import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkflow,
  runTradePlanningWorkflow,
  getWorkflowSummary
} from '../../../master/workflow/workflowEngine.js';
import {
  initWorkflowDatabase,
  setDb,
  loadWorkflow
} from '../../../master/workflow/sqlitePersistence.js';

describe('End-to-End Trade Planning Integration Tests', () => {
  beforeEach(() => {
    const testDb = initWorkflowDatabase(':memory:');
    setDb(testDb);
  });

  it('Requirement 2 & 3: Runs specialists in parallel and COMPASS drafts plan after acquiring outputs', async () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in AAPL',
      symbol: 'AAPL'
    });

    const completedWf = await runTradePlanningWorkflow(wf.workflow_id, {
      marketContext: [{ symbol: 'AAPL', price: 224.50 }]
    });

    expect(completedWf.status).toBe('waiting_for_user');
    expect(completedWf.awaiting_user).toBe(true);

    // Verify all parallel steps finished
    const parallelSteps = ['macro_context', 'news_catalysts', 'fundamentals_filings', 'technical_structure', 'probability_outlook'];
    parallelSteps.forEach(sId => {
      const step = completedWf.steps.find(s => s.id === sId);
      expect(step.status).toBe('done');
      expect(step.started_at).toBeTruthy();
      expect(step.finished_at).toBeTruthy();
    });

    // Verify COMPASS drafted TradePlan
    expect(completedWf.trade_plan).toBeDefined();
    expect(completedWf.trade_plan.symbol).toBe('AAPL');
    expect(completedWf.trade_plan.direction).toBe('long');
    expect(completedWf.trade_plan.invalidation.level).toBeDefined();

    // Verify SENTINEL reviewed the plan
    expect(completedWf.sentinel_verdict).toBeDefined();
    expect(completedWf.sentinel_verdict.verdict).toBe('approve');

    // Requirement 14: NO PILOT execution occurs in this phase
    const pilotStep = completedWf.steps.find(s => s.agent === 'PILOT');
    expect(pilotStep).toBeUndefined(); // Pilot is NOT in the workflow steps
    expect(completedWf.status).toBe('waiting_for_user'); // Halts and waits for human!
  });

  it('Requirement 4: A failed or timed-out agent produces a partial plan with an explicit data-gap note', async () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in NVDA',
      symbol: 'NVDA'
    });

    // Force a tiny timeout (e.g. 0ms) to trigger timeout in parallel calls
    const completedWf = await runTradePlanningWorkflow(wf.workflow_id, {
      timeoutMs: 0,
      marketContext: [{ symbol: 'NVDA', price: 215.00 }]
    });

    // Workflow must still succeed in drafting a partial plan
    expect(completedWf.trade_plan).toBeDefined();
    expect(completedWf.trade_plan.symbol).toBe('NVDA');

    // Must have explicit data-gap notes in event_risks and model_estimated_fields
    expect(completedWf.trade_plan.model_estimated_fields).toContain('partial_data_gap_mode');
    const hasDataGapNote = completedWf.trade_plan.event_risks.some(r => r.includes('Data gap'));
    expect(hasDataGapNote).toBe(true);
  });

  it('Requirement 15: Spoken summary is concise and under 25 seconds', async () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in AAPL',
      symbol: 'AAPL'
    });

    const completedWf = await runTradePlanningWorkflow(wf.workflow_id);
    const summary = getWorkflowSummary(completedWf.workflow_id);

    expect(summary.spoken_summary).toBeTruthy();

    // Average reading speed is ~130-150 words per minute, or ~2.5 words per second.
    // 25 seconds is ~60 words max.
    const wordCount = summary.spoken_summary.split(/\s+/).length;
    expect(wordCount).toBeLessThan(60);
  });
});
