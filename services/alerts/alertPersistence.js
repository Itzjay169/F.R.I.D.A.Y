import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { validateAlert, validateRoutine } from '../../shared/contract.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'friday_alerts.db');

let globalDb = null;

/**
 * Initializes SQLite database for Alerts and Routines
 * @param {string} [customPath]
 * @returns {DatabaseSync}
 */
export function initAlertsDatabase(customPath = null) {
  const targetPath = customPath || DB_PATH;

  if (targetPath !== ':memory:') {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // 1. Alerts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      alert_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'local',
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      symbol TEXT,
      condition_json TEXT NOT NULL,
      trigger_json TEXT NOT NULL,
      actions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_evaluated_at TEXT,
      last_triggered_at TEXT,
      trigger_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user',
      notes TEXT,
      initial_value TEXT
    )
  `);

  // 2. Routines Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS routines (
      routine_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule_json TEXT NOT NULL,
      workflow TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      next_run_at TEXT,
      actions_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 3. Alert Events / Audit Log Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT,
      event_type TEXT NOT NULL,
      severity TEXT,
      message TEXT NOT NULL,
      value TEXT,
      threshold TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Seed default routines if empty
  seedDefaultRoutines(db);

  if (!customPath) {
    globalDb = db;
  }
  return db;
}

export function getAlertsDb() {
  if (!globalDb) {
    globalDb = initAlertsDatabase();
  }
  return globalDb;
}

/**
 * Default routines specified in Phase 5.5 Section 7
 */
export const DEFAULT_ROUTINES = [
  {
    routine_id: 'routine-pre-market-briefing',
    name: 'Pre-market briefing',
    schedule: {
      type: 'weekdays',
      time: '09:00',
      timezone: 'America/New_York',
      cron: '0 9 * * 1-5',
      market_session: 'pre_market'
    },
    workflow: 'pre_market_briefing',
    enabled: false,
    last_run_at: null,
    next_run_at: null,
    actions: {
      speak: true,
      hud_panel: true,
      signal_log: true,
      desktop_notification: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    routine_id: 'routine-market-open-checklist',
    name: 'Market-open checklist',
    schedule: {
      type: 'weekdays',
      time: '09:30',
      timezone: 'America/New_York',
      cron: '30 9 * * 1-5',
      market_session: 'regular'
    },
    workflow: 'market_open_checklist',
    enabled: false,
    last_run_at: null,
    next_run_at: null,
    actions: {
      speak: true,
      hud_panel: true,
      signal_log: true,
      desktop_notification: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    routine_id: 'routine-midday-risk-check',
    name: 'Midday risk check',
    schedule: {
      type: 'weekdays',
      time: '13:00',
      timezone: 'America/New_York',
      cron: '0 13 * * 1-5',
      market_session: 'regular'
    },
    workflow: 'midday_risk_check',
    enabled: false,
    last_run_at: null,
    next_run_at: null,
    actions: {
      speak: true,
      hud_panel: true,
      signal_log: true,
      desktop_notification: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    routine_id: 'routine-post-market-review',
    name: 'Post-market review',
    schedule: {
      type: 'weekdays',
      time: '16:15',
      timezone: 'America/New_York',
      cron: '15 16 * * 1-5',
      market_session: 'post_market'
    },
    workflow: 'post_market_review',
    enabled: false,
    last_run_at: null,
    next_run_at: null,
    actions: {
      speak: true,
      hud_panel: true,
      signal_log: true,
      desktop_notification: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    routine_id: 'routine-weekly-journal-review',
    name: 'Weekly journal review',
    schedule: {
      type: 'weekly',
      time: '17:00',
      timezone: 'America/New_York',
      cron: '0 17 * * 5',
      market_session: 'post_market'
    },
    workflow: 'weekly_journal_review',
    enabled: false,
    last_run_at: null,
    next_run_at: null,
    actions: {
      speak: true,
      hud_panel: true,
      signal_log: true,
      desktop_notification: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function seedDefaultRoutines(db) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM routines');
  const res = stmt.get();
  if (res && res.count === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO routines (
        routine_id, name, schedule_json, workflow, enabled, last_run_at, next_run_at, actions_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of DEFAULT_ROUTINES) {
      insertStmt.run(
        r.routine_id,
        r.name,
        JSON.stringify(r.schedule),
        r.workflow,
        r.enabled ? 1 : 0,
        r.last_run_at,
        r.next_run_at,
        JSON.stringify(r.actions),
        r.created_at,
        r.updated_at
      );
    }
  }
}

// =============================================================================
// ALERT CRUD OPERATIONS
// =============================================================================

function rowToAlert(row) {
  if (!row) return null;
  return {
    alert_id: row.alert_id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    symbol: row.symbol,
    condition: JSON.parse(row.condition_json),
    trigger: JSON.parse(row.trigger_json),
    actions: JSON.parse(row.actions_json),
    status: row.status,
    last_evaluated_at: row.last_evaluated_at,
    last_triggered_at: row.last_triggered_at,
    trigger_count: Number(row.trigger_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: row.source,
    notes: row.notes,
    initial_value: row.initial_value ? JSON.parse(row.initial_value) : null
  };
}

export function saveAlert(alert, db = getAlertsDb()) {
  const check = validateAlert(alert);
  if (!check.valid) {
    throw new Error(`Invalid Alert: ${check.errors.join('; ')}`);
  }

  const stmt = db.prepare(`
    INSERT INTO alerts (
      alert_id, user_id, name, type, symbol, condition_json, trigger_json, actions_json,
      status, last_evaluated_at, last_triggered_at, trigger_count, created_at, updated_at,
      source, notes, initial_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(alert_id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      symbol = excluded.symbol,
      condition_json = excluded.condition_json,
      trigger_json = excluded.trigger_json,
      actions_json = excluded.actions_json,
      status = excluded.status,
      last_evaluated_at = excluded.last_evaluated_at,
      last_triggered_at = excluded.last_triggered_at,
      trigger_count = excluded.trigger_count,
      updated_at = excluded.updated_at,
      source = excluded.source,
      notes = excluded.notes,
      initial_value = excluded.initial_value
  `);

  stmt.run(
    alert.alert_id,
    alert.user_id || 'local',
    alert.name,
    alert.type,
    alert.symbol || null,
    JSON.stringify(alert.condition),
    JSON.stringify(alert.trigger),
    JSON.stringify(alert.actions),
    alert.status || 'active',
    alert.last_evaluated_at || null,
    alert.last_triggered_at || null,
    alert.trigger_count || 0,
    alert.created_at || new Date().toISOString(),
    alert.updated_at || new Date().toISOString(),
    alert.source || 'user',
    alert.notes || null,
    alert.initial_value !== undefined ? JSON.stringify(alert.initial_value) : null
  );

  return alert;
}

export function getAlert(alertId, db = getAlertsDb()) {
  const stmt = db.prepare('SELECT * FROM alerts WHERE alert_id = ?');
  const row = stmt.get(alertId);
  return rowToAlert(row);
}

export function listAlerts({ status, symbol, type } = {}, db = getAlertsDb()) {
  let sql = 'SELECT * FROM alerts WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (symbol) {
    sql += ' AND symbol = ?';
    params.push(symbol.toUpperCase());
  }
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC';
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);
  return rows.map(rowToAlert);
}

export function updateAlert(alertId, updates, db = getAlertsDb()) {
  const existing = getAlert(alertId, db);
  if (!existing) {
    throw new Error(`Alert with id ${alertId} not found`);
  }

  const merged = {
    ...existing,
    ...updates,
    condition: updates.condition ? { ...existing.condition, ...updates.condition } : existing.condition,
    trigger: updates.trigger ? { ...existing.trigger, ...updates.trigger } : existing.trigger,
    actions: updates.actions ? { ...existing.actions, ...updates.actions } : existing.actions,
    updated_at: new Date().toISOString()
  };

  return saveAlert(merged, db);
}

export function deleteAlert(alertId, db = getAlertsDb()) {
  const stmt = db.prepare('DELETE FROM alerts WHERE alert_id = ?');
  stmt.run(alertId);
  return { deleted: true, alert_id: alertId };
}

export function pauseAlerts(alertIds = null, db = getAlertsDb()) {
  if (alertIds && Array.isArray(alertIds) && alertIds.length > 0) {
    const placeholders = alertIds.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE alerts SET status = 'paused', updated_at = ? WHERE alert_id IN (${placeholders})`);
    stmt.run(new Date().toISOString(), ...alertIds);
  } else {
    const stmt = db.prepare(`UPDATE alerts SET status = 'paused', updated_at = ? WHERE status = 'active'`);
    stmt.run(new Date().toISOString());
  }
  return listAlerts({}, db);
}

export function resumeAlerts(alertIds = null, db = getAlertsDb()) {
  if (alertIds && Array.isArray(alertIds) && alertIds.length > 0) {
    const placeholders = alertIds.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE alerts SET status = 'active', updated_at = ? WHERE alert_id IN (${placeholders})`);
    stmt.run(new Date().toISOString(), ...alertIds);
  } else {
    const stmt = db.prepare(`UPDATE alerts SET status = 'active', updated_at = ? WHERE status = 'paused'`);
    stmt.run(new Date().toISOString());
  }
  return listAlerts({}, db);
}

// =============================================================================
// ROUTINE CRUD OPERATIONS
// =============================================================================

function rowToRoutine(row) {
  if (!row) return null;
  return {
    routine_id: row.routine_id,
    name: row.name,
    schedule: JSON.parse(row.schedule_json),
    workflow: row.workflow,
    enabled: Boolean(row.enabled),
    last_run_at: row.last_run_at,
    next_run_at: row.next_run_at,
    actions: JSON.parse(row.actions_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function saveRoutine(routine, db = getAlertsDb()) {
  const check = validateRoutine(routine);
  if (!check.valid) {
    throw new Error(`Invalid Routine: ${check.errors.join('; ')}`);
  }

  const stmt = db.prepare(`
    INSERT INTO routines (
      routine_id, name, schedule_json, workflow, enabled, last_run_at, next_run_at, actions_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(routine_id) DO UPDATE SET
      name = excluded.name,
      schedule_json = excluded.schedule_json,
      workflow = excluded.workflow,
      enabled = excluded.enabled,
      last_run_at = excluded.last_run_at,
      next_run_at = excluded.next_run_at,
      actions_json = excluded.actions_json,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    routine.routine_id,
    routine.name,
    JSON.stringify(routine.schedule),
    routine.workflow,
    routine.enabled ? 1 : 0,
    routine.last_run_at || null,
    routine.next_run_at || null,
    JSON.stringify(routine.actions),
    routine.created_at || new Date().toISOString(),
    routine.updated_at || new Date().toISOString()
  );

  return routine;
}

export function getRoutine(routineId, db = getAlertsDb()) {
  const stmt = db.prepare('SELECT * FROM routines WHERE routine_id = ?');
  const row = stmt.get(routineId);
  return rowToRoutine(row);
}

export function listRoutines(db = getAlertsDb()) {
  const stmt = db.prepare('SELECT * FROM routines ORDER BY created_at ASC');
  const rows = stmt.all();
  return rows.map(rowToRoutine);
}

export function updateRoutine(routineId, updates, db = getAlertsDb()) {
  const existing = getRoutine(routineId, db);
  if (!existing) {
    throw new Error(`Routine with id ${routineId} not found`);
  }

  const merged = {
    ...existing,
    ...updates,
    schedule: updates.schedule ? { ...existing.schedule, ...updates.schedule } : existing.schedule,
    actions: updates.actions ? { ...existing.actions, ...updates.actions } : existing.actions,
    updated_at: new Date().toISOString()
  };

  return saveRoutine(merged, db);
}

export function deleteRoutine(routineId, db = getAlertsDb()) {
  const stmt = db.prepare('DELETE FROM routines WHERE routine_id = ?');
  stmt.run(routineId);
  return { deleted: true, routine_id: routineId };
}

// =============================================================================
// AUDIT & TRIGGER LOG OPERATIONS
// =============================================================================

export function recordAlertEvent(event, db = getAlertsDb()) {
  const stmt = db.prepare(`
    INSERT INTO alert_events (
      alert_id, event_type, severity, message, value, threshold, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    event.alert_id || null,
    event.event || event.event_type || 'alert.triggered',
    event.severity || 'info',
    event.message || '',
    event.value !== undefined ? String(event.value) : null,
    event.threshold !== undefined ? String(event.threshold) : null,
    JSON.stringify(event),
    event.as_of || event.created_at || new Date().toISOString()
  );
}

export function getAlertEvents({ alertId = null, limit = 50 } = {}, db = getAlertsDb()) {
  let sql = 'SELECT * FROM alert_events WHERE 1=1';
  const params = [];
  if (alertId) {
    sql += ' AND alert_id = ?';
    params.push(alertId);
  }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);
  return rows.map(r => ({
    id: r.id,
    alert_id: r.alert_id,
    event_type: r.event_type,
    severity: r.severity,
    message: r.message,
    value: r.value,
    threshold: r.threshold,
    payload: JSON.parse(r.payload_json),
    created_at: r.created_at
  }));
}
