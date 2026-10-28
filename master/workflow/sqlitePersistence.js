import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

// Default database path in project data folder, or in-memory
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'friday_workflows.db');

let dbInstance = null;

/**
 * Initializes SQLite database connection and sets up required tables
 * @param {string} [customPath] - Path to db or ':memory:'
 * @returns {DatabaseSync}
 */
export function initWorkflowDatabase(customPath = null) {
  const targetPath = customPath || DB_PATH;

  if (targetPath !== ':memory:') {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // 1. Workflows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      workflow_id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      intent TEXT NOT NULL,
      symbol TEXT NOT NULL,
      status TEXT NOT NULL,
      current_step TEXT NOT NULL,
      trade_plan TEXT,
      sentinel_verdict TEXT,
      awaiting_user INTEGER NOT NULL DEFAULT 0,
      user_decision TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 2. Workflow Steps table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      workflow_id TEXT NOT NULL,
      id TEXT NOT NULL,
      agent TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      response_ref TEXT,
      error TEXT,
      step_order INTEGER NOT NULL,
      PRIMARY KEY (workflow_id, id)
    )
  `);

  // 3. Workflow Events table (Audit Trail)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 4. Workflow Artifacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  dbInstance = db;
  return db;
}

/**
 * Gets active database instance, initializing if necessary
 */
export function getDb() {
  if (!dbInstance) {
    dbInstance = initWorkflowDatabase();
  }
  return dbInstance;
}

/**
 * Sets database instance (useful for test isolation with in-memory DB)
 */
export function setDb(db) {
  dbInstance = db;
}

/**
 * Persists a complete workflow state into SQLite
 * @param {Object} wf - Workflow state object conforming to WorkflowStateSchema
 */
export function saveWorkflow(wf) {
  const db = getDb();

  // Save/Update master workflow record
  const upsertWf = db.prepare(`
    INSERT INTO workflows (
      workflow_id, goal, intent, symbol, status, current_step,
      trade_plan, sentinel_verdict, awaiting_user, user_decision,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workflow_id) DO UPDATE SET
      goal = excluded.goal,
      intent = excluded.intent,
      symbol = excluded.symbol,
      status = excluded.status,
      current_step = excluded.current_step,
      trade_plan = excluded.trade_plan,
      sentinel_verdict = excluded.sentinel_verdict,
      awaiting_user = excluded.awaiting_user,
      user_decision = excluded.user_decision,
      updated_at = excluded.updated_at
  `);

  upsertWf.run(
    wf.workflow_id,
    wf.goal,
    wf.intent,
    wf.symbol,
    wf.status,
    wf.current_step || '',
    wf.trade_plan ? JSON.stringify(wf.trade_plan) : null,
    wf.sentinel_verdict ? JSON.stringify(wf.sentinel_verdict) : null,
    wf.awaiting_user ? 1 : 0,
    wf.user_decision || null,
    wf.created_at,
    wf.updated_at || new Date().toISOString()
  );

  // Save steps
  if (Array.isArray(wf.steps)) {
    const upsertStep = db.prepare(`
      INSERT INTO workflow_steps (
        workflow_id, id, agent, task, status, started_at, finished_at,
        response_ref, error, step_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workflow_id, id) DO UPDATE SET
        agent = excluded.agent,
        task = excluded.task,
        status = excluded.status,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        response_ref = excluded.response_ref,
        error = excluded.error,
        step_order = excluded.step_order
    `);

    wf.steps.forEach((st, idx) => {
      upsertStep.run(
        wf.workflow_id,
        st.id,
        st.agent,
        st.task,
        st.status,
        st.started_at || null,
        st.finished_at || null,
        st.response_ref || null,
        st.error || null,
        idx
      );
    });
  }

  return wf;
}

/**
 * Loads a workflow by ID from SQLite, reconstructing full step list
 * @param {string} workflow_id
 * @returns {Object|null}
 */
export function loadWorkflow(workflow_id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM workflows WHERE workflow_id = ?').get(workflow_id);
  if (!row) return null;

  const stepsRows = db.prepare(`
    SELECT * FROM workflow_steps
    WHERE workflow_id = ?
    ORDER BY step_order ASC
  `).all(workflow_id);

  const steps = stepsRows.map(s => ({
    id: s.id,
    agent: s.agent,
    task: s.task,
    status: s.status,
    started_at: s.started_at,
    finished_at: s.finished_at,
    response_ref: s.response_ref,
    error: s.error
  }));

  let trade_plan = null;
  if (row.trade_plan) {
    try { trade_plan = JSON.parse(row.trade_plan); } catch {}
  }

  let sentinel_verdict = null;
  if (row.sentinel_verdict) {
    try { sentinel_verdict = JSON.parse(row.sentinel_verdict); } catch {}
  }

  return {
    workflow_id: row.workflow_id,
    goal: row.goal,
    intent: row.intent,
    symbol: row.symbol,
    status: row.status,
    current_step: row.current_step,
    steps,
    trade_plan,
    sentinel_verdict,
    awaiting_user: Boolean(row.awaiting_user),
    user_decision: row.user_decision,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Lists stored workflows, with optional filtering
 */
export function listSavedWorkflows({ status, symbol } = {}) {
  const db = getDb();
  let query = 'SELECT workflow_id FROM workflows WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (symbol) {
    query += ' AND symbol = ?';
    params.push(symbol.toUpperCase());
  }

  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params);
  return rows.map(r => loadWorkflow(r.workflow_id)).filter(Boolean);
}

/**
 * Records an audit event for a workflow
 */
export function recordWorkflowEvent(workflow_id, event_type, details = {}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO workflow_events (workflow_id, event_type, details, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(
    workflow_id,
    event_type,
    JSON.stringify(details),
    new Date().toISOString()
  );
}

/**
 * Retrieves audit events for a workflow
 */
export function getWorkflowEvents(workflow_id) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM workflow_events
    WHERE workflow_id = ?
    ORDER BY id ASC
  `).all(workflow_id);

  return rows.map(r => ({
    id: r.id,
    workflow_id: r.workflow_id,
    event_type: r.event_type,
    details: r.details ? JSON.parse(r.details) : {},
    created_at: r.created_at
  }));
}

/**
 * Saves a workflow artifact (e.g. intermediate agent report, plan card payload)
 */
export function saveWorkflowArtifact(workflow_id, artifact_type, payload = {}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO workflow_artifacts (workflow_id, artifact_type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(
    workflow_id,
    artifact_type,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

/**
 * Retrieves artifacts for a workflow
 */
export function getWorkflowArtifacts(workflow_id) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM workflow_artifacts
    WHERE workflow_id = ?
    ORDER BY id ASC
  `).all(workflow_id);

  return rows.map(r => ({
    id: r.id,
    workflow_id: r.workflow_id,
    artifact_type: r.artifact_type,
    payload: r.payload ? JSON.parse(r.payload) : {},
    created_at: r.created_at
  }));
}
