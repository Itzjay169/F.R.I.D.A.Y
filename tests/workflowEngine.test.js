import { describe, it, expect } from 'vitest';
import {
  createWorkflow,
  advanceStep,
  confirmStep,
  failStep,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  getWorkflow,
  listWorkflows,
  getWorkflowHudSummary,
  getWorkflowTemplates,
  workflowHealthCheck,
  WORKFLOW_TEMPLATES,
  USER_CONFIRMATION_REQUIRED
} from '../services/workflow/workflowEngine.js';

// =============================================================================
// WORKFLOW ENGINE CORE TESTS
// =============================================================================
describe('Workflow Engine — Lifecycle', () => {
  it('should create a workflow from a template', () => {
    const wf = createWorkflow({
      goal: 'Plan a swing trade in AAPL',
      template: 'plan-swing-trade',
      symbol: 'AAPL'
    });

    expect(wf.workflowId).toMatch(/^WF-/);
    expect(wf.goal).toBe('Plan a swing trade in AAPL');
    expect(wf.symbol).toBe('AAPL');
    expect(wf.status).toBe('running');
    expect(wf.currentStep).toBe(0);
    expect(wf.steps.length).toBe(WORKFLOW_TEMPLATES['plan-swing-trade'].steps.length);
    expect(wf.steps[0].status).toBe('running');
    expect(wf.steps[1].status).toBe('pending');
  });

  it('should reject creation without a goal', () => {
    expect(() => createWorkflow({ template: 'plan-swing-trade' })).toThrow('goal is required');
  });

  it('should reject creation with invalid template and no steps', () => {
    expect(() => createWorkflow({ goal: 'test', template: 'nonexistent' })).toThrow('valid template');
  });

  it('should advance through steps sequentially', () => {
    const wf = createWorkflow({
      goal: 'Pre-market briefing',
      template: 'pre-market-briefing'
    });

    expect(wf.currentStep).toBe(0);
    expect(wf.steps[0].agent).toBe('ATLAS');

    const wf2 = advanceStep(wf.workflowId, { summary: 'Macro is stable' });
    expect(wf2.currentStep).toBe(1);
    expect(wf2.steps[0].status).toBe('completed');
    expect(wf2.steps[1].status).toBe('running');
    expect(wf2.steps[1].agent).toBe('SCOUT');
  });

  it('should complete a workflow when all steps are done', () => {
    const wf = createWorkflow({
      goal: 'Quick briefing',
      steps: [
        { agent: 'ATLAS', task: 'Check macro', requiresUser: false },
        { agent: 'FRIDAY', task: 'Summarize', requiresUser: false }
      ]
    });

    advanceStep(wf.workflowId, { summary: 'Macro OK' });
    const final = advanceStep(wf.workflowId, { summary: 'Done' });

    expect(final.status).toBe('completed');
    expect(final.completedAt).toBeTruthy();
  });

  it('should not allow advancing a completed workflow', () => {
    const wf = createWorkflow({
      goal: 'Tiny workflow',
      steps: [{ agent: 'FRIDAY', task: 'One step', requiresUser: false }]
    });
    advanceStep(wf.workflowId, {});
    expect(() => advanceStep(wf.workflowId, {})).toThrow('already completed');
  });
});

// =============================================================================
// USER CONFIRMATION GATE TESTS
// =============================================================================
describe('Workflow Engine — User Confirmation Gates', () => {
  it('should stop for user confirmation when step requires it', () => {
    const wf = createWorkflow({
      goal: 'Trade with confirmation',
      steps: [
        { agent: 'COMPASS', task: 'Draft plan', requiresUser: false },
        { agent: 'USER', task: 'Review and approve', requiresUser: true },
        { agent: 'PILOT', task: 'Execute', requiresUser: true }
      ]
    });

    // Advance past COMPASS
    const wf2 = advanceStep(wf.workflowId, { plan: 'drafted' });
    expect(wf2.status).toBe('awaiting-user');
    expect(wf2.awaitingUser).toBe(true);
    expect(wf2.steps[1].status).toBe('awaiting-user');
  });

  it('should proceed after user confirmation', () => {
    const wf = createWorkflow({
      goal: 'Confirm test',
      steps: [
        { agent: 'SENTINEL', task: 'Risk check', requiresUser: false },
        { agent: 'USER', task: 'Approve', requiresUser: true },
        { agent: 'PILOT', task: 'Execute', requiresUser: true }
      ]
    });

    advanceStep(wf.workflowId, {});
    expect(getWorkflow(wf.workflowId).status).toBe('awaiting-user');

    const confirmed = confirmStep(wf.workflowId);
    expect(confirmed.status).toBe('running');
    expect(confirmed.awaitingUser).toBe(false);
    expect(confirmed.steps[1].status).toBe('running');
  });

  it('should reject confirmation when workflow is not awaiting user', () => {
    const wf = createWorkflow({
      goal: 'No wait test',
      steps: [{ agent: 'ATLAS', task: 'Check', requiresUser: false }]
    });
    expect(() => confirmStep(wf.workflowId)).toThrow('not awaiting');
  });

  it('paper trade execution must always require user confirmation', () => {
    expect(USER_CONFIRMATION_REQUIRED).toContain('execute_paper_order');
    expect(USER_CONFIRMATION_REQUIRED).toContain('place_paper_trade');
    expect(USER_CONFIRMATION_REQUIRED).toContain('close_position');
    expect(USER_CONFIRMATION_REQUIRED).toContain('change_risk_limits');
  });
});

// =============================================================================
// PAUSE / RESUME / CANCEL TESTS
// =============================================================================
describe('Workflow Engine — Pause, Resume, Cancel', () => {
  it('should pause a running workflow', () => {
    const wf = createWorkflow({
      goal: 'Pausable flow',
      template: 'full-research',
      symbol: 'NVDA'
    });

    const paused = pauseWorkflow(wf.workflowId);
    expect(paused.status).toBe('paused');
  });

  it('should resume a paused workflow', () => {
    const wf = createWorkflow({
      goal: 'Resume test',
      steps: [
        { agent: 'ATLAS', task: 'Macro', requiresUser: false },
        { agent: 'CHARTIST', task: 'Levels', requiresUser: false }
      ]
    });

    pauseWorkflow(wf.workflowId);
    const resumed = resumeWorkflow(wf.workflowId);
    expect(resumed.status).toBe('running');
  });

  it('should not pause an already completed workflow', () => {
    const wf = createWorkflow({
      goal: 'Complete then pause',
      steps: [{ agent: 'FRIDAY', task: 'Done', requiresUser: false }]
    });
    advanceStep(wf.workflowId, {});
    expect(() => pauseWorkflow(wf.workflowId)).toThrow('Cannot pause');
  });

  it('should cancel a workflow and mark pending steps as skipped', () => {
    const wf = createWorkflow({
      goal: 'Cancel test',
      template: 'plan-swing-trade',
      symbol: 'AAPL'
    });

    const cancelled = cancelWorkflow(wf.workflowId);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.steps.filter(s => s.status === 'skipped').length).toBeGreaterThan(0);
  });

  it('should not cancel an already cancelled workflow', () => {
    const wf = createWorkflow({
      goal: 'Double cancel',
      steps: [{ agent: 'FRIDAY', task: 'Test', requiresUser: false }]
    });
    cancelWorkflow(wf.workflowId);
    expect(() => cancelWorkflow(wf.workflowId)).toThrow('already cancelled');
  });
});

// =============================================================================
// FAILURE HANDLING TESTS
// =============================================================================
describe('Workflow Engine — Failure Handling', () => {
  it('should fail a step and block remaining steps', () => {
    const wf = createWorkflow({
      goal: 'Fail test',
      steps: [
        { agent: 'ATLAS', task: 'Macro', requiresUser: false },
        { agent: 'CHARTIST', task: 'Levels', requiresUser: false },
        { agent: 'COMPASS', task: 'Plan', requiresUser: false }
      ]
    });

    const failed = failStep(wf.workflowId, 'API timeout — Finnhub unreachable');
    expect(failed.status).toBe('failed');
    expect(failed.steps[0].status).toBe('failed');
    expect(failed.steps[0].error).toBe('API timeout — Finnhub unreachable');
    expect(failed.steps[1].status).toBe('blocked');
    expect(failed.steps[2].status).toBe('blocked');
  });
});

// =============================================================================
// HUD SUMMARY & QUERY TESTS
// =============================================================================
describe('Workflow Engine — HUD Summary & Queries', () => {
  it('should produce a compact HUD summary', () => {
    const wf = createWorkflow({
      goal: 'HUD test',
      template: 'pre-market-briefing',
      symbol: 'SPY'
    });

    const hud = getWorkflowHudSummary(wf.workflowId);
    expect(hud.workflowId).toBe(wf.workflowId);
    expect(hud.goal).toBe('HUD test');
    expect(hud.symbol).toBe('SPY');
    expect(hud.totalSteps).toBe(5);
    expect(hud.currentAgent).toBe('ATLAS');
    expect(hud.progress).toBe(0);
    expect(hud.steps.length).toBe(5);
  });

  it('should list workflows filtered by status', () => {
    createWorkflow({ goal: 'Active 1', steps: [{ agent: 'A', task: 'X', requiresUser: false }] });
    const running = listWorkflows({ status: 'running' });
    expect(running.length).toBeGreaterThan(0);
    expect(running.every(w => w.status === 'running')).toBe(true);
  });

  it('should list available templates', () => {
    const templates = getWorkflowTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(5);
    expect(templates.find(t => t.id === 'plan-swing-trade')).toBeTruthy();
    expect(templates.find(t => t.id === 'pre-market-briefing')).toBeTruthy();
  });

  it('should report healthy engine status', () => {
    const health = workflowHealthCheck();
    expect(health.service).toBe('WorkflowEngine');
    expect(health.status).toBe('online');
    expect(health.availableTemplates).toBeGreaterThanOrEqual(5);
  });
});
