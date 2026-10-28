/**
 * F.R.I.D.A.Y. Workflow Engine (Phase 2.5)
 *
 * Persistent multi-step workflow state machine.
 * Supports multi-agent orchestration sequences like:
 *   ATLAS → NEWSROOM → ATHENA → CHARTIST → ORACLE → COMPASS → SENTINEL → PILOT → LEDGER
 *
 * Rules:
 * - User may pause, resume, modify, or cancel any workflow.
 * - Workflow must stop for user confirmation before:
 *   - Placing any paper trade
 *   - Enabling an optional integration
 *   - Running a long backtest
 *   - Deleting journal data
 *   - Changing risk limits
 * - HUD displays current step, completed steps, blocked steps, and awaiting-user steps.
 */

// In-memory workflow store
const workflows = new Map();

/**
 * Valid workflow statuses.
 */
export const WORKFLOW_STATUSES = [
  'pending',          // Created but not started
  'running',          // Actively executing steps
  'paused',           // User paused
  'awaiting-user',    // Stopped for user confirmation
  'completed',        // All steps done
  'cancelled',        // User or system cancelled
  'failed'            // Unrecoverable error
];

/**
 * Valid step statuses.
 */
export const STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'awaiting-user',
  'blocked'
];

/**
 * Actions that ALWAYS require user confirmation before proceeding.
 */
export const USER_CONFIRMATION_REQUIRED = [
  'execute_paper_order',
  'place_paper_trade',
  'enable_integration',
  'run_backtest',
  'delete_journal_data',
  'change_risk_limits',
  'modify_portfolio',
  'close_position'
];

/**
 * Pre-defined workflow templates for common trading tasks.
 */
export const WORKFLOW_TEMPLATES = {
  'plan-swing-trade': {
    name: 'Plan Swing Trade',
    steps: [
      { agent: 'ATLAS', task: 'Assess macro backdrop', requiresUser: false },
      { agent: 'SCOUT', task: 'Scan for catalysts and news', requiresUser: false },
      { agent: 'ATHENA', task: 'Assess fundamentals and structure', requiresUser: false },
      { agent: 'CHARTIST', task: 'Mark technical levels', requiresUser: false },
      { agent: 'ORACLE', task: 'Estimate probability range', requiresUser: false },
      { agent: 'COMPASS', task: 'Draft trade plan', requiresUser: false },
      { agent: 'SENTINEL', task: 'Risk-check and size plan', requiresUser: false },
      { agent: 'USER', task: 'Review and approve trade plan', requiresUser: true },
      { agent: 'PILOT', task: 'Execute paper trade', requiresUser: true },
      { agent: 'LEDGER', task: 'Journal outcome and link review', requiresUser: false }
    ]
  },

  'plan-breakout-trade': {
    name: 'Plan Breakout Trade',
    steps: [
      { agent: 'ATLAS', task: 'Check macro environment', requiresUser: false },
      { agent: 'CHARTIST', task: 'Identify breakout levels and volume context', requiresUser: false },
      { agent: 'ORACLE', task: 'Assess breakout probability', requiresUser: false },
      { agent: 'COMPASS', task: 'Draft breakout plan', requiresUser: false },
      { agent: 'SENTINEL', task: 'Risk-check entry, stop, size', requiresUser: false },
      { agent: 'USER', task: 'Review and approve', requiresUser: true },
      { agent: 'PILOT', task: 'Execute paper trade', requiresUser: true },
      { agent: 'LEDGER', task: 'Journal entry', requiresUser: false }
    ]
  },

  'pre-market-briefing': {
    name: 'Pre-Market Briefing',
    steps: [
      { agent: 'ATLAS', task: 'Overnight macro summary', requiresUser: false },
      { agent: 'SCOUT', task: 'Pre-market movers and gaps', requiresUser: false },
      { agent: 'CHARTIST', task: 'Key levels on watchlist', requiresUser: false },
      { agent: 'SENTINEL', task: 'Portfolio risk overview', requiresUser: false },
      { agent: 'FRIDAY', task: 'Compile pre-market briefing', requiresUser: false }
    ]
  },

  'post-market-review': {
    name: 'Post-Market Review',
    steps: [
      { agent: 'LEDGER', task: 'Day trade summary', requiresUser: false },
      { agent: 'SENTINEL', task: 'End-of-day risk report', requiresUser: false },
      { agent: 'CHARTIST', task: 'End-of-day chart levels', requiresUser: false },
      { agent: 'ATLAS', task: 'After-hours macro events', requiresUser: false },
      { agent: 'FRIDAY', task: 'Compile review and lessons', requiresUser: false }
    ]
  },

  'full-research': {
    name: 'Full Research Report',
    steps: [
      { agent: 'ATLAS', task: 'Macro context', requiresUser: false },
      { agent: 'SCOUT', task: 'News and catalyst scan', requiresUser: false },
      { agent: 'ATHENA', task: 'Fundamental analysis', requiresUser: false },
      { agent: 'CAPITOL', task: 'Insider and institutional activity', requiresUser: false },
      { agent: 'CHARTIST', task: 'Technical analysis', requiresUser: false },
      { agent: 'ORACLE', task: 'Quantitative assessment', requiresUser: false },
      { agent: 'FRIDAY', task: 'Compile full research report', requiresUser: false }
    ]
  }
};

/**
 * Creates a new workflow from a template or custom steps.
 *
 * @param {Object} params
 * @param {string} params.goal - Human-readable goal description
 * @param {string} [params.template] - Template name from WORKFLOW_TEMPLATES
 * @param {Array} [params.steps] - Custom steps (overrides template)
 * @param {string} [params.symbol] - Associated symbol
 * @param {Object} [params.metadata] - Additional context data
 * @returns {Object} Created workflow
 */
export function createWorkflow({ goal, template, steps, symbol, metadata = {} }) {
  if (!goal || typeof goal !== 'string') {
    throw new Error('Workflow goal is required');
  }

  // Resolve steps
  let resolvedSteps;
  if (steps && Array.isArray(steps)) {
    resolvedSteps = steps;
  } else if (template && WORKFLOW_TEMPLATES[template]) {
    resolvedSteps = WORKFLOW_TEMPLATES[template].steps;
  } else {
    throw new Error(`Must provide either custom steps or a valid template. Available: ${Object.keys(WORKFLOW_TEMPLATES).join(', ')}`);
  }

  const workflow = {
    workflowId: `WF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    goal,
    template: template || 'custom',
    symbol: symbol ? symbol.toUpperCase() : null,
    steps: resolvedSteps.map((s, i) => ({
      index: i,
      agent: s.agent,
      task: s.task,
      requiresUser: s.requiresUser || false,
      status: i === 0 ? 'running' : 'pending',
      result: null,
      startedAt: i === 0 ? new Date().toISOString() : null,
      completedAt: null,
      error: null
    })),
    status: 'running',
    currentStep: 0,
    awaitingUser: false,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  };

  workflows.set(workflow.workflowId, workflow);
  return workflow;
}

/**
 * Advances the workflow to the next step after completing the current one.
 *
 * @param {string} workflowId
 * @param {Object} result - Result of the current step
 * @returns {Object} Updated workflow
 */
export function advanceStep(workflowId, result = {}) {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  if (wf.status === 'completed' || wf.status === 'cancelled' || wf.status === 'failed') {
    throw new Error(`Workflow ${workflowId} is already ${wf.status}`);
  }

  const currentIdx = wf.currentStep;
  const currentStepObj = wf.steps[currentIdx];

  // Complete current step
  currentStepObj.status = 'completed';
  currentStepObj.result = result;
  currentStepObj.completedAt = new Date().toISOString();

  // Check if there are more steps
  const nextIdx = currentIdx + 1;

  if (nextIdx >= wf.steps.length) {
    // Workflow complete
    wf.status = 'completed';
    wf.completedAt = new Date().toISOString();
    wf.updatedAt = new Date().toISOString();
    workflows.set(workflowId, wf);
    return wf;
  }

  const nextStep = wf.steps[nextIdx];

  // Check if next step requires user confirmation
  if (nextStep.requiresUser) {
    nextStep.status = 'awaiting-user';
    wf.status = 'awaiting-user';
    wf.awaitingUser = true;
    wf.currentStep = nextIdx;
  } else {
    nextStep.status = 'running';
    nextStep.startedAt = new Date().toISOString();
    wf.currentStep = nextIdx;
    wf.status = 'running';
    wf.awaitingUser = false;
  }

  wf.updatedAt = new Date().toISOString();
  workflows.set(workflowId, wf);
  return wf;
}

/**
 * User confirms the current awaiting step, allowing it to proceed.
 */
export function confirmStep(workflowId) {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  if (wf.status !== 'awaiting-user') {
    throw new Error(`Workflow ${workflowId} is not awaiting user confirmation (status: ${wf.status})`);
  }

  const step = wf.steps[wf.currentStep];
  step.status = 'running';
  step.startedAt = new Date().toISOString();
  wf.status = 'running';
  wf.awaitingUser = false;
  wf.updatedAt = new Date().toISOString();

  workflows.set(workflowId, wf);
  return wf;
}

/**
 * Fails the current step with an error.
 */
export function failStep(workflowId, error) {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);

  const step = wf.steps[wf.currentStep];
  step.status = 'failed';
  step.error = error;
  step.completedAt = new Date().toISOString();

  // Mark remaining steps as blocked
  for (let i = wf.currentStep + 1; i < wf.steps.length; i++) {
    wf.steps[i].status = 'blocked';
  }

  wf.status = 'failed';
  wf.updatedAt = new Date().toISOString();
  workflows.set(workflowId, wf);
  return wf;
}

/**
 * Pauses a running workflow.
 */
export function pauseWorkflow(workflowId) {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  if (wf.status !== 'running' && wf.status !== 'awaiting-user') {
    throw new Error(`Cannot pause workflow in status: ${wf.status}`);
  }

  wf.status = 'paused';
  wf.updatedAt = new Date().toISOString();
  workflows.set(workflowId, wf);
  return wf;
}

/**
 * Resumes a paused workflow.
 */
export function resumeWorkflow(workflowId) {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  if (wf.status !== 'paused') {
    throw new Error(`Cannot resume workflow in status: ${wf.status}`);
  }

  const step = wf.steps[wf.currentStep];
  if (step.requiresUser && step.status !== 'completed') {
    wf.status = 'awaiting-user';
    wf.awaitingUser = true;
    step.status = 'awaiting-user';
  } else {
    wf.status = 'running';
    wf.awaitingUser = false;
    step.status = 'running';
    step.startedAt = step.startedAt || new Date().toISOString();
  }

  wf.updatedAt = new Date().toISOString();
  workflows.set(workflowId, wf);
  return wf;
}

/**
 * Cancels a workflow.
 */
export function cancelWorkflow(workflowId) {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  if (wf.status === 'completed' || wf.status === 'cancelled') {
    throw new Error(`Workflow ${workflowId} is already ${wf.status}`);
  }

  wf.status = 'cancelled';
  wf.updatedAt = new Date().toISOString();

  // Mark all pending/running steps as skipped
  for (const step of wf.steps) {
    if (step.status === 'pending' || step.status === 'running' || step.status === 'awaiting-user') {
      step.status = 'skipped';
    }
  }

  workflows.set(workflowId, wf);
  return wf;
}

/**
 * Gets a workflow by ID.
 */
export function getWorkflow(workflowId) {
  return workflows.get(workflowId) || null;
}

/**
 * Lists all workflows, optionally filtered.
 */
export function listWorkflows({ status, symbol } = {}) {
  let wfs = Array.from(workflows.values());
  if (status) wfs = wfs.filter(w => w.status === status);
  if (symbol) wfs = wfs.filter(w => w.symbol === symbol.toUpperCase());
  return wfs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Returns a compact HUD-ready summary of a workflow.
 */
export function getWorkflowHudSummary(workflowId) {
  const wf = workflows.get(workflowId);
  if (!wf) return null;

  return {
    workflowId: wf.workflowId,
    goal: wf.goal,
    symbol: wf.symbol,
    status: wf.status,
    currentStep: wf.currentStep,
    totalSteps: wf.steps.length,
    currentAgent: wf.steps[wf.currentStep]?.agent || null,
    currentTask: wf.steps[wf.currentStep]?.task || null,
    awaitingUser: wf.awaitingUser,
    completedSteps: wf.steps.filter(s => s.status === 'completed').length,
    failedSteps: wf.steps.filter(s => s.status === 'failed').length,
    blockedSteps: wf.steps.filter(s => s.status === 'blocked').length,
    progress: Math.round((wf.steps.filter(s => s.status === 'completed').length / wf.steps.length) * 100),
    steps: wf.steps.map(s => ({
      agent: s.agent,
      task: s.task,
      status: s.status,
      requiresUser: s.requiresUser
    }))
  };
}

/**
 * Lists available workflow templates.
 */
export function getWorkflowTemplates() {
  return Object.entries(WORKFLOW_TEMPLATES).map(([key, tmpl]) => ({
    id: key,
    name: tmpl.name,
    stepCount: tmpl.steps.length,
    agents: tmpl.steps.map(s => s.agent),
    userStops: tmpl.steps.filter(s => s.requiresUser).length
  }));
}

/**
 * Workflow engine health check.
 */
export function workflowHealthCheck() {
  const allWfs = Array.from(workflows.values());
  return {
    service: 'WorkflowEngine',
    status: 'online',
    version: '2.5.0',
    activeWorkflows: allWfs.filter(w => w.status === 'running' || w.status === 'awaiting-user').length,
    totalWorkflows: allWfs.length,
    availableTemplates: Object.keys(WORKFLOW_TEMPLATES).length,
    timestamp: new Date().toISOString()
  };
}
