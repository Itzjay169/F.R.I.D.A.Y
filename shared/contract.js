// Shared JSON RPC Contract for F.R.I.D.A.Y. Master and Specialists

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
