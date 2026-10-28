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

// =============================================================================
// PHASE 5.5: RELAY ALERTS & ROUTINES ZOD SCHEMAS
// =============================================================================

export const AlertConditionSchema = z.object({
  operator: z.enum(['crosses_above', 'crosses_below', 'equals', 'percent_change', 'threshold', 'keyword_match', 'schedule']),
  left: z.string(), // e.g. close, high, low, rsi, vwap, ema_9, ema_21, unrealized_pnl, portfolio_heat, form_type, etc.
  right: z.union([z.number(), z.string()]).nullable(),
  secondary: z.union([z.number(), z.string()]).nullable().optional(),
  lookback: z.string().nullable().optional(),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '1d']).nullable().optional()
});

export const AlertTriggerSchema = z.object({
  once: z.boolean(),
  cooldown_minutes: z.number().default(30),
  expires_at: z.string().nullable().optional(),
  active_hours: z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string()
  }).optional(),
  trigger_immediately_if_true: z.boolean().optional().default(false)
});

export const AlertActionsSchema = z.object({
  signal_log: z.boolean().default(true),
  hud_toast: z.boolean().default(true),
  sound: z.boolean().default(false),
  desktop_notification: z.boolean().default(false),
  speak: z.boolean().default(false),
  start_workflow: z.string().nullable().optional(),
  request_sentinel_review: z.boolean().optional().default(false)
});

export const AlertSchema = z.object({
  alert_id: z.string(),
  user_id: z.string().default('local'),
  name: z.string(),
  type: z.enum(['price', 'indicator', 'news', 'filing', 'calendar', 'position_risk', 'data_health']),
  symbol: z.string().nullable(),
  condition: AlertConditionSchema,
  trigger: AlertTriggerSchema,
  actions: AlertActionsSchema,
  status: z.enum(['active', 'paused', 'triggered', 'expired', 'cancelled', 'error']).default('active'),
  last_evaluated_at: z.string().nullable().default(null),
  last_triggered_at: z.string().nullable().default(null),
  trigger_count: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  source: z.enum(['user', 'newsroom', 'sentinel', 'system']).default('user'),
  notes: z.string().nullable().optional(),
  initial_value: z.union([z.number(), z.string()]).nullable().optional()
});

export const RoutineScheduleSchema = z.object({
  type: z.enum(['daily', 'weekdays', 'weekly', 'custom']),
  time: z.string(), // e.g. "09:00"
  timezone: z.string().default('America/New_York'),
  cron: z.string(), // e.g. "0 9 * * 1-5"
  market_session: z.enum(['pre_market', 'regular', 'post_market', 'any']).optional().default('any')
});

export const RoutineActionsSchema = z.object({
  speak: z.boolean().default(true),
  hud_panel: z.boolean().default(true),
  signal_log: z.boolean().default(true),
  desktop_notification: z.boolean().default(false)
});

export const RoutineSchema = z.object({
  routine_id: z.string(),
  name: z.string(),
  schedule: RoutineScheduleSchema,
  workflow: z.string(),
  enabled: z.boolean().default(false),
  last_run_at: z.string().nullable().default(null),
  next_run_at: z.string().nullable().default(null),
  actions: RoutineActionsSchema,
  created_at: z.string(),
  updated_at: z.string()
});

export const AlertTriggerEventSchema = z.object({
  event: z.literal('alert.triggered'),
  alert_id: z.string(),
  alert_name: z.string(),
  symbol: z.string().nullable(),
  severity: z.enum(['info', 'important', 'critical']),
  message: z.string(),
  value: z.union([z.number(), z.string()]).nullable(),
  threshold: z.union([z.number(), z.string()]).nullable(),
  source: z.string(),
  as_of: z.string(),
  actions: AlertActionsSchema
});

export function validateAlert(data) {
  const res = AlertSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

export function validateRoutine(data) {
  const res = RoutineSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

export function validateAlertTriggerEvent(data) {
  const res = AlertTriggerEventSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

// =============================================================================
// PHASE 6.5: ARCHIVE KNOWLEDGE, PLAYBOOKS, AND TRADE REVIEWS ZOD SCHEMAS
// =============================================================================

export const ResearchSourceRefSchema = z.object({
  source: z.string(),
  ref: z.string(),
  retrieved_at: z.string()
});

export const ResearchItemSchema = z.object({
  item_id: z.string(),
  kind: z.enum([
    'thesis', 'note', 'chart_snapshot', 'news_context', 'filing_context',
    'trade_plan', 'trade_review', 'playbook', 'daily_review', 'weekly_review'
  ]),
  title: z.string(),
  symbol: z.string().nullable(),
  symbols: z.array(z.string()).default([]),
  asset_class: z.enum(['equity', 'etf', 'options', 'crypto', 'forex', 'futures', 'macro']).default('equity'),
  timeframe: z.enum(['scalp', 'intraday', 'swing', 'position', 'any']).default('swing'),
  market_regime: z.string().nullable().optional(),
  setup: z.enum(['breakout', 'pullback', 'mean_reversion', 'earnings', 'macro', 'custom']).nullable().optional(),
  thesis: z.string().default(''),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  source_refs: z.array(ResearchSourceRefSchema).default([]),
  linked_trade_ids: z.array(z.string()).default([]),
  linked_workflow_ids: z.array(z.string()).default([]),
  linked_news_ids: z.array(z.string()).default([]),
  linked_filing_ids: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(1),
  user_authored: z.boolean().default(true),
  model_generated: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional()
});

export const PlaybookPerformanceSummarySchema = z.object({
  trade_count: z.number().default(0),
  win_rate: z.number().default(0),
  average_r: z.number().default(0),
  profit_factor: z.number().default(0),
  max_drawdown: z.number().default(0),
  calculated_at: z.string(),
  data_range: z.object({
    from: z.string(),
    to: z.string()
  })
});

export const PlaybookSchema = z.object({
  playbook_id: z.string(),
  name: z.string(),
  description: z.string(),
  market_regime: z.string().default('all'),
  symbols: z.array(z.string()).default([]),
  timeframes: z.array(z.string()).default([]),
  entry_rules: z.array(z.string()).default([]),
  invalidation_rules: z.array(z.string()).default([]),
  stop_rules: z.array(z.string()).default([]),
  target_rules: z.array(z.string()).default([]),
  position_sizing_rules: z.array(z.string()).default([]),
  event_filters: z.array(z.string()).default([]),
  required_context: z.array(z.string()).default([]),
  example_trade_ids: z.array(z.string()).default([]),
  performance_summary: PlaybookPerformanceSummarySchema,
  created_at: z.string(),
  updated_at: z.string()
});

export const TradeReviewSchema = z.object({
  review_id: z.string(),
  trade_id: z.string(),
  symbol: z.string(),
  outcome: z.enum(['win', 'loss', 'scratch', 'open']).default('open'),
  result_r: z.number().nullable().optional(),
  process_score: z.number().min(0).max(100).default(100),
  discipline_score: z.number().min(0).max(100).default(100),
  what_went_right: z.array(z.string()).default([]),
  what_went_wrong: z.array(z.string()).default([]),
  mistakes: z.array(z.string()).default([]),
  lessons: z.array(z.string()).default([]),
  market_context: z.string().default(''),
  thesis_at_entry: z.string().default(''),
  thesis_validated: z.boolean().nullable().optional(),
  followed_plan: z.boolean().nullable().optional(),
  emotional_tags: z.array(z.string()).default([]),
  user_notes: z.string().default(''),
  model_notes: z.string().default(''),
  created_at: z.string()
});

export function validateResearchItem(data) {
  const res = ResearchItemSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

export function validatePlaybook(data) {
  const res = PlaybookSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}

export function validateTradeReview(data) {
  const res = TradeReviewSchema.safeParse(data);
  if (!res.success) {
    return {
      valid: false,
      errors: (res.error.issues || []).map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }
  return { valid: true, data: res.data };
}


