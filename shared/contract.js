// Shared JSON RPC & Zod Contracts for F.R.I.D.A.Y. Master and Specialists
import { z } from 'zod';

/**
 * Validates an agent request payload
 * @param {Object} req 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRequest(req) {
  const errors = [];
  if (!req) return { valid: false, errors: ['Request object is required'] };
  if (!req.id || typeof req.id !== 'string') errors.push('Missing or invalid "id"');
  if (!req.from || typeof req.from !== 'string') errors.push('Missing or invalid "from"');
  if (!req.to || typeof req.to !== 'string') errors.push('Missing or invalid "to"');
  if (!req.intent || typeof req.intent !== 'string') errors.push('Missing or invalid "intent"');
  if (req.deadline_ms !== undefined && typeof req.deadline_ms !== 'number') {
    errors.push('deadline_ms must be a number');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an agent response payload
 * Rule: "sources" is mandatory. Every number cites its feed.
 * @param {Object} res 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateResponse(res) {
  const errors = [];
  if (!res) return { valid: false, errors: ['Response object is required'] };
  if (!res.id || typeof res.id !== 'string') errors.push('Missing or invalid "id"');
  if (!res.agent || typeof res.agent !== 'string') errors.push('Missing or invalid "agent"');
  
  const allowedStatuses = ['ok', 'error', 'veto', 'limited'];
  if (!allowedStatuses.includes(res.status)) {
    errors.push(`Status must be one of: ${allowedStatuses.join(', ')}`);
  }
  
  if (typeof res.summary !== 'string') errors.push('summary must be a string');
  if (!Array.isArray(res.sources) || res.sources.length === 0) {
    errors.push('"sources" array is mandatory and must not be empty');
  }
  if (typeof res.confidence !== 'number' || res.confidence < 0 || res.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }
  if (typeof res.spoken_text !== 'string') errors.push('spoken_text must be a string');
  if (!res.timestamp || typeof res.timestamp !== 'string') errors.push('Missing timestamp');

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a standard compliant response
 */
export function createResponse({
  id,
  agent,
  status = 'ok',
  summary = '',
  data = {},
  sources = [],
  confidence = 1.0,
  spoken_text = '',
  timestamp = new Date().toISOString()
}) {
  const response = {
    id,
    agent,
    status,
    summary,
    data,
    sources,
    confidence,
    spoken_text,
    timestamp
  };
  const check = validateResponse(response);
  if (!check.valid) {
    throw new Error(`Contract Validation Error: ${check.errors.join('; ')}`);
  }
  return response;
}

// =============================================================================
// PHASE 2.5: COMPASS & WORKFLOW ZOD SCHEMAS
// =============================================================================

export const CatalystSchema = z.object({
  type: z.enum(['news', 'earnings', 'macro', 'filing', 'technical']),
  description: z.string(),
  source: z.string(),
  published_at: z.string().nullable()
});

export const EntrySchema = z.object({
  type: z.enum(['market', 'limit', 'stop', 'breakout', 'pullback']),
  trigger: z.string(),
  price: z.number().nullable(),
  zone: z.object({
    low: z.number().nullable(),
    high: z.number().nullable()
  })
});

export const InvalidationSchema = z.object({
  level: z.number().nullable(),
  condition: z.string(),
  source: z.string()
});

export const StopSchema = z.object({
  price: z.number().nullable(),
  percent: z.number().nullable(),
  rationale: z.string()
});

export const TargetSchema = z.object({
  label: z.enum(['T1', 'T2', 'runner']),
  price: z.number().nullable(),
  rationale: z.string(),
  allocation_percent: z.number().nullable()
});

export const PositionSizeSchema = z.object({
  quantity: z.number().nullable(),
  notional: z.number().nullable(),
  risk_amount: z.number().nullable(),
  risk_percent_of_equity: z.number().nullable(),
  sizing_method: z.enum(['fixed_risk', 'atr', 'volatility', 'manual'])
});

/**
 * COMPASS TradePlanSchema (Section 2)
 */
export const TradePlanSchema = z.object({
  plan_id: z.string().uuid(),
  created_at: z.string(),
  symbol: z.string(),
  asset_class: z.enum(['equity', 'etf', 'crypto', 'forex', 'futures', 'option']),
  direction: z.enum(['long', 'short', 'neutral']),
  timeframe: z.enum(['scalp', 'intraday', 'swing', 'position']),
  thesis: z.string(),
  market_regime: z.string(),
  catalysts: z.array(CatalystSchema),
  entry: EntrySchema,
  invalidation: InvalidationSchema,
  stop: StopSchema,
  targets: z.array(TargetSchema),
  position_size: PositionSizeSchema,
  reward_risk: z.number().nullable(),
  time_stop: z.string().nullable(),
  event_risks: z.array(z.string()),
  bull_case: z.string(),
  bear_case: z.string(),
  what_proves_thesis_right: z.array(z.string()),
  what_proves_thesis_wrong: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
  model_estimated_fields: z.array(z.string()),
  sentinel_verdict: z.enum(['pending', 'approve', 'modify', 'veto']),
  sentinel_notes: z.string().nullable(),
  status: z.enum(['draft', 'ready_for_review', 'pending-review', 'approved', 'modified', 'vetoed', 'expired', 'cancelled', 'limited'])
});

/**
 * SENTINEL SentinelVerdictSchema (Section 6)
 */
export const SentinelVerdictSchema = z.object({
  verdict: z.enum(['approve', 'modify', 'veto']),
  reason: z.string(),
  required_changes: z.array(z.string()),
  suggested_quantity: z.number().nullable(),
  suggested_stop: z.number().nullable(),
  suggested_target: z.number().nullable(),
  risk_amount: z.number().nullable(),
  risk_percent: z.number().nullable(),
  event_risks: z.array(z.string()),
  sources: z.array(z.string())
});

/**
 * WorkflowStepSchema (Section 3)
 */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  agent: z.string(),
  task: z.string(),
  status: z.enum(['pending', 'running', 'done', 'error', 'skipped', 'timeout']),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  response_ref: z.string().nullable(),
  error: z.string().nullable()
});

/**
 * WorkflowStateSchema (Section 3)
 */
export const WorkflowStateSchema = z.object({
  workflow_id: z.string().uuid(),
  goal: z.string(),
  intent: z.enum(['plan_trade', 'research', 'review', 'backtest', 'other']),
  symbol: z.string(),
  status: z.enum(['created', 'running', 'waiting_for_user', 'completed', 'failed', 'cancelled']),
  current_step: z.string(),
  steps: z.array(WorkflowStepSchema),
  trade_plan: TradePlanSchema.nullable(),
  sentinel_verdict: SentinelVerdictSchema.nullable(),
  awaiting_user: z.boolean(),
  user_decision: z.enum(['approve', 'modify', 'reject']).nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

// Boundary SafeParse Validators
export function validateTradePlan(data) {
  const res = TradePlanSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

export function validateWorkflowState(data) {
  const res = WorkflowStateSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

export function validateSentinelVerdict(data) {
  const res = SentinelVerdictSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}
