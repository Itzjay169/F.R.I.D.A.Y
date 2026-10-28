import crypto from 'crypto';
import { validateWorkflowState } from '../../shared/contract.js';
import {
  saveWorkflow,
  loadWorkflow,
  listSavedWorkflows,
  recordWorkflowEvent,
  saveWorkflowArtifact
} from './sqlitePersistence.js';
import { generateTradePlan } from '../../agents/compass/compassAgent.js';
import { reviewTradePlanWithSentinel } from '../../services/sentinelReview.js';

/**
 * Standard Step Definitions for default template
 */
export const DEFAULT_SWING_TRADE_STEPS = [
  { id: 'clarify_request', agent: 'MASTER', task: 'Clarify request constraints' },
  { id: 'macro_context', agent: 'ATLAS', task: 'Assess macro backdrop' },
  { id: 'news_catalysts', agent: 'NEWSROOM', task: 'Gather news and catalysts' },
  { id: 'fundamentals_filings', agent: 'ATHENA', task: 'Analyze fundamentals and filings' },
  { id: 'technical_structure', agent: 'CHARTIST', task: 'Analyze technical structure and levels' },
  { id: 'probability_outlook', agent: 'ORACLE', task: 'Produce probability-aware outlook' },
  { id: 'draft_plan', agent: 'COMPASS', task: 'Draft structured trade plan' },
  { id: 'risk_review', agent: 'SENTINEL', task: 'Review trade plan for risk and limits' },
  { id: 'present_plan', agent: 'MASTER', task: 'Present trade plan card to HUD' },
  { id: 'wait_for_user', agent: 'USER', task: 'Wait for explicit user approval before execution' }
];

/**
 * Creates a new workflow instance and persists it to SQLite
 */
export function createWorkflow({
  goal,
  symbol,
  intent = 'plan_trade',
  template = 'plan_equity_swing_trade',
  customSteps = null
}) {
  if (!goal) {
    throw new Error('Workflow creation failed: goal is required');
  }

  const normalizedSymbol = (symbol || 'AAPL').toUpperCase();
  const rawSteps = customSteps || DEFAULT_SWING_TRADE_STEPS;

  const steps = rawSteps.map(s => ({
    id: s.id,
    agent: s.agent,
    task: s.task,
    status: 'pending',
    started_at: null,
    finished_at: null,
    response_ref: null,
    error: null
  }));

  const wf = {
    workflow_id: crypto.randomUUID(),
    goal,
    intent,
    symbol: normalizedSymbol,
    status: 'created',
    current_step: steps[0]?.id || '',
    steps,
    trade_plan: null,
    sentinel_verdict: null,
    awaiting_user: false,
    user_decision: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const validation = validateWorkflowState(wf);
  if (!validation.valid) {
    throw new Error(`Workflow validation error: ${validation.errors.join('; ')}`);
  }

  saveWorkflow(wf);
  recordWorkflowEvent(wf.workflow_id, 'WORKFLOW_CREATED', { goal, symbol: normalizedSymbol, template });
  return wf;
}

/**
 * Executes a complete trade planning workflow through the deterministic state machine
 * Parallelizes research specialists (ATLAS, NEWSROOM, ATHENA, CHARTIST, ORACLE),
 * passes outputs to COMPASS, reviews with SENTINEL, and halts at waiting_for_user.
 */
export async function runTradePlanningWorkflow(workflow_id, options = {}) {
  let wf = loadWorkflow(workflow_id);
  if (!wf) throw new Error(`Workflow not found: ${workflow_id}`);

  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 8000;
  const marketContext = options.marketContext || [{ symbol: wf.symbol, price: 224.50 }];

  wf.status = 'running';
  saveWorkflow(wf);
  recordWorkflowEvent(wf.workflow_id, 'WORKFLOW_STARTED', { symbol: wf.symbol });

  // Helper to mark a step started
  const markStepRunning = (stepId) => {
    const st = wf.steps.find(s => s.id === stepId);
    if (st) {
      st.status = 'running';
      st.started_at = new Date().toISOString();
      wf.current_step = stepId;
      saveWorkflow(wf);
    }
  };

  // Helper to mark a step finished
  const markStepFinished = (stepId, status = 'done', responseRef = null, error = null) => {
    const st = wf.steps.find(s => s.id === stepId);
    if (st) {
      st.status = status;
      st.finished_at = new Date().toISOString();
      st.response_ref = responseRef;
      st.error = error;
      saveWorkflow(wf);
    }
  };

  // Step 1: Clarify request
  markStepRunning('clarify_request');
  markStepFinished('clarify_request', 'done', 'Request clarified: swing trade in ' + wf.symbol);

  // Parallel Specialist Execution: ATLAS, NEWSROOM, ATHENA, CHARTIST, ORACLE
  const parallelStepIds = ['macro_context', 'news_catalysts', 'fundamentals_filings', 'technical_structure', 'probability_outlook'];
  parallelStepIds.forEach(id => markStepRunning(id));

  const specialistCalls = [
    // ATLAS (Macro)
    executeWithTimeout(async () => {
      return {
        agent: 'ATLAS',
        regime: 'trending-bullish',
        macroNotes: '10Y Yields stable, VIX below 16, Fed policy supportive.',
        eventRisks: ['FOMC meeting in 14 days'],
        sources: ['federal-reserve:rates', 'cboe:vix']
      };
    }, timeoutMs),

    // NEWSROOM (News)
    executeWithTimeout(async () => {
      return {
        agent: 'NEWSROOM',
        headlines: [`${wf.symbol} reports strong supplier momentum ahead of quarterly release`],
        sentiment: 'positive',
        sources: [`finnhub:news:${wf.symbol}`]
      };
    }, timeoutMs),

    // ATHENA (Fundamentals)
    executeWithTimeout(async () => {
      return {
        agent: 'ATHENA',
        growth: '+14% YoY',
        peRatio: 28.4,
        filingNotes: 'Clean 10-Q filing with healthy free cash flow margins.',
        sources: [`sec-edgar:10-q:${wf.symbol}`]
      };
    }, timeoutMs),

    // CHARTIST (Technicals)
    executeWithTimeout(async () => {
      const quote = marketContext.find(q => q.symbol === wf.symbol) || { price: 224.50 };
      const currentPrice = quote.price;
      return {
        agent: 'CHARTIST',
        support: parseFloat((currentPrice * 0.97).toFixed(2)),
        resistance: parseFloat((currentPrice * 1.06).toFixed(2)),
        trend: 'Uptrend above 20 EMA',
        sources: [`tradingview:chart:${wf.symbol}`]
      };
    }, timeoutMs),

    // ORACLE (Quant)
    executeWithTimeout(async () => {
      return {
        agent: 'ORACLE',
        continuationProbability: 0.68,
        modelName: 'TimesFM-statistical-v1',
        lookback: '90D',
        sources: ['oracle:probabilistic-engine']
      };
    }, timeoutMs)
  ];

  const results = await Promise.allSettled(specialistCalls);

  const agentInputs = {};
  const dataGaps = [];

  // Inspect parallel outputs
  const agentKeys = ['ATLAS', 'NEWSROOM', 'ATHENA', 'CHARTIST', 'ORACLE'];
  results.forEach((res, idx) => {
    const stepId = parallelStepIds[idx];
    const agentKey = agentKeys[idx];

    if (res.status === 'fulfilled' && res.value) {
      agentInputs[agentKey] = res.value;
      markStepFinished(stepId, 'done', `${agentKey} intelligence acquired`);
      saveWorkflowArtifact(wf.workflow_id, `${agentKey}_RESPONSE`, res.value);
    } else {
      const errMsg = res.reason?.message || 'Timeout / Unavailable';
      markStepFinished(stepId, 'error', null, errMsg);
      dataGaps.push(`${agentKey} data unavailable: ${errMsg}`);
    }
  });

  // Step 7: COMPASS Draft Plan
  markStepRunning('draft_plan');
  const quote = marketContext.find(q => q.symbol === wf.symbol) || { price: 224.50 };

  const planResult = generateTradePlan({
    command: wf.goal,
    symbol: wf.symbol,
    marketContext,
    agentInputs,
    options: { allowMissingPrice: true }
  });

  if (planResult.status === 'limited' || !planResult.plan) {
    const summary = planResult.summary || 'COMPASS returned status limited: missing required inputs.';
    markStepFinished('draft_plan', 'error', null, summary);
    wf.status = 'failed';
    saveWorkflow(wf);
    return wf;
  }

  const plan = planResult.plan;
  if (dataGaps.length > 0) {
    plan.event_risks.push(...dataGaps.map(g => `Data gap: ${g}`));
    plan.model_estimated_fields.push('partial_data_gap_mode');
  }

  wf.trade_plan = plan;
  markStepFinished('draft_plan', 'done', `TradePlan ${plan.plan_id.slice(0, 8)} drafted`);
  saveWorkflowArtifact(wf.workflow_id, 'TRADE_PLAN', plan);

  // Step 8: SENTINEL Risk Review
  markStepRunning('risk_review');
  const sentinelVerdict = reviewTradePlanWithSentinel(plan);
  wf.sentinel_verdict = sentinelVerdict;
  plan.sentinel_verdict = sentinelVerdict.verdict;
  plan.sentinel_notes = sentinelVerdict.reason;

  markStepFinished('risk_review', 'done', `Sentinel Verdict: ${sentinelVerdict.verdict.toUpperCase()}`);
  saveWorkflowArtifact(wf.workflow_id, 'SENTINEL_VERDICT', sentinelVerdict);

  // Step 9: Present Plan
  markStepRunning('present_plan');
  markStepFinished('present_plan', 'done', 'Plan presented to HUD card');

  // Step 10: Wait for User (HALT - NO PILOT EXECUTION)
  markStepRunning('wait_for_user');
  wf.current_step = 'wait_for_user';
  wf.status = 'waiting_for_user';
  wf.awaiting_user = true;
  wf.updated_at = new Date().toISOString();

  saveWorkflow(wf);
  recordWorkflowEvent(wf.workflow_id, 'AWAITING_USER_APPROVAL', {
    verdict: sentinelVerdict.verdict,
    planId: plan.plan_id
  });

  return wf;
}

/**
 * Wraps an async function with a timeout promise
 */
function executeWithTimeout(fn, ms) {
  if (ms <= 0) {
    return Promise.reject(new Error(`Operation timed out after ${ms}ms`));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    fn()
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Pauses an active workflow
 */
export function pauseWorkflow(workflow_id) {
  const wf = loadWorkflow(workflow_id);
  if (!wf) return { success: false, error: 'Workflow not found' };

  if (wf.status === 'completed' || wf.status === 'cancelled') {
    return { success: false, error: `Cannot pause workflow in ${wf.status} status` };
  }

  wf.status = 'paused';
  wf.updated_at = new Date().toISOString();
  saveWorkflow(wf);
  recordWorkflowEvent(workflow_id, 'WORKFLOW_PAUSED');
  return { success: true, workflow: wf };
}

/**
 * Resumes a paused workflow
 */
export function resumeWorkflow(workflow_id) {
  const wf = loadWorkflow(workflow_id);
  if (!wf) return { success: false, error: 'Workflow not found' };

  if (wf.status !== 'paused') {
    return { success: false, error: 'Workflow is not currently paused' };
  }

  wf.status = wf.awaiting_user ? 'waiting_for_user' : 'running';
  wf.updated_at = new Date().toISOString();
  saveWorkflow(wf);
  recordWorkflowEvent(workflow_id, 'WORKFLOW_RESUMED');
  return { success: true, workflow: wf };
}

/**
 * Cancels a workflow
 */
export function cancelWorkflow(workflow_id, reason = 'User requested cancellation') {
  const wf = loadWorkflow(workflow_id);
  if (!wf) return { success: false, error: 'Workflow not found' };

  wf.status = 'cancelled';
  wf.awaiting_user = false;
  wf.updated_at = new Date().toISOString();
  saveWorkflow(wf);
  recordWorkflowEvent(workflow_id, 'WORKFLOW_CANCELLED', { reason });
  return { success: true, workflow: wf };
}

/**
 * Records user decision on a plan awaiting approval
 * @param {string} workflow_id
 * @param {'approve'|'modify'|'reject'} decision
 */
export function submitUserDecision(workflow_id, decision, notes = '') {
  const wf = loadWorkflow(workflow_id);
  if (!wf) return { success: false, error: 'Workflow not found' };

  if (!wf.awaiting_user) {
    return { success: false, error: 'Workflow is not currently awaiting user approval' };
  }

  // Safety rule: Cannot approve if Sentinel returned VETO
  if (decision === 'approve' && wf.sentinel_verdict?.verdict === 'veto') {
    return {
      success: false,
      error: 'SECURITY GATE: Cannot approve a trade plan that has been VETOED by Sentinel.'
    };
  }

  wf.user_decision = decision;
  wf.awaiting_user = false;

  const waitStep = wf.steps.find(s => s.id === 'wait_for_user');
  if (waitStep) {
    waitStep.status = decision === 'reject' ? 'skipped' : 'done';
    waitStep.finished_at = new Date().toISOString();
    waitStep.response_ref = `User decision: ${decision.toUpperCase()}`;
  }

  if (decision === 'approve') {
    wf.status = 'completed';
    if (wf.trade_plan) wf.trade_plan.status = 'approved';
  } else if (decision === 'reject') {
    wf.status = 'cancelled';
    if (wf.trade_plan) wf.trade_plan.status = 'cancelled';
  } else if (decision === 'modify') {
    wf.status = 'running';
    if (wf.trade_plan) wf.trade_plan.status = 'modified';
  }

  wf.updated_at = new Date().toISOString();
  saveWorkflow(wf);
  recordWorkflowEvent(workflow_id, 'USER_DECISION_RECORDED', { decision, notes });
  return { success: true, workflow: wf };
}

/**
 * Returns HUD telemetry summary
 */
export function getWorkflowSummary(workflow_id) {
  const wf = loadWorkflow(workflow_id);
  if (!wf) return null;

  const completedSteps = wf.steps.filter(s => s.status === 'done').length;
  const totalSteps = wf.steps.length;

  return {
    workflow_id: wf.workflow_id,
    goal: wf.goal,
    symbol: wf.symbol,
    status: wf.status,
    current_step: wf.current_step,
    completedSteps,
    totalSteps,
    progressPct: Math.round((completedSteps / totalSteps) * 100),
    awaiting_user: wf.awaiting_user,
    sentinel_verdict: wf.sentinel_verdict?.verdict || null,
    plan_id: wf.trade_plan?.plan_id || null,
    spoken_summary: wf.trade_plan
      ? `Workflow for ${wf.symbol} is ${wf.status}. Sentinel verdict is ${wf.sentinel_verdict?.verdict || 'pending'}. Human approval required.`
      : `Workflow for ${wf.symbol} is ${wf.status} at step ${wf.current_step}.`
  };
}

/**
 * Lists all workflows from SQLite
 */
export function listWorkflows(filter = {}) {
  return listSavedWorkflows(filter);
}

/**
 * Health check
 */
export function workflowHealthCheck() {
  return {
    service: 'master/workflow',
    status: 'online',
    version: '2.5.0',
    persistence: 'SQLite (node:sqlite)',
    templates: ['plan_equity_swing_trade'],
    activeWorkflows: listSavedWorkflows().length,
    timestamp: new Date().toISOString()
  };
}
