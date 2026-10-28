import cron from 'node-cron';
import { getAlertsDb, updateRoutine, getRoutine, listRoutines } from './alertPersistence.js';

// Map of active node-cron scheduled tasks: routine_id -> Task
const activeCronTasks = new Map();

// Set of currently executing routines (for overlap prevention)
const runningRoutines = new Set();

// Routine execution callback (can be hooked by Master Orchestrator or tests)
let routineExecutor = null;

/**
 * Sets the execution handler when a routine triggers
 * @param {(routine: Object) => Promise<any>} handler
 */
export function setRoutineExecutor(handler) {
  routineExecutor = handler;
}

/**
 * Starts or restarts the schedule for a given routine
 * @param {Object} routine
 * @param {Object} [options]
 * @returns {boolean}
 */
export function scheduleRoutine(routine, options = {}) {
  if (!routine || !routine.enabled || !routine.schedule?.cron) {
    stopScheduledRoutine(routine?.routine_id);
    return false;
  }

  // Stop any existing job first
  stopScheduledRoutine(routine.routine_id);

  const timezone = routine.schedule.timezone || 'America/New_York';
  const cronExpr = routine.schedule.cron;

  try {
    if (!cron.validate(cronExpr)) {
      console.error(`Invalid cron expression for routine ${routine.routine_id}: "${cronExpr}"`);
      return false;
    }

    const task = cron.schedule(
      cronExpr,
      async () => {
        await executeRoutineWithOverlapProtection(routine.routine_id, options.executor || routineExecutor);
      },
      {
        timezone,
        scheduled: true
      }
    );

    activeCronTasks.set(routine.routine_id, task);
    return true;
  } catch (err) {
    console.error(`Failed to schedule routine ${routine.routine_id}:`, err);
    return false;
  }
}

/**
 * Stops a scheduled routine
 * @param {string} routineId
 */
export function stopScheduledRoutine(routineId) {
  if (activeCronTasks.has(routineId)) {
    const task = activeCronTasks.get(routineId);
    try {
      task.stop();
      if (typeof task.destroy === 'function') task.destroy();
    } catch (e) {
      // ignore cleanup errors
    }
    activeCronTasks.delete(routineId);
  }
}

/**
 * Executes a routine with overlap prevention and updates timestamps
 * @param {string} routineId
 * @param {Function} [customExecutor]
 * @returns {Promise<{ executed: boolean, skipped?: boolean, reason?: string, result?: any }>}
 */
export function executeRoutineWithOverlapProtection(routineId, customExecutor = null, db = getAlertsDb()) {
  if (runningRoutines.has(routineId)) {
    console.warn(`[RoutineScheduler] Overlap prevented for routine ${routineId}; previous execution still running.`);
    return Promise.resolve({ executed: false, skipped: true, reason: 'overlap_prevented' });
  }

  runningRoutines.add(routineId);
  const nowIso = new Date().toISOString();

  const routine = getRoutine(routineId, db);
  if (!routine) {
    runningRoutines.delete(routineId);
    return Promise.resolve({ executed: false, skipped: true, reason: 'routine_not_found' });
  }

  const executor = customExecutor || routineExecutor || defaultRoutineRunner;

  return Promise.resolve()
    .then(() => executor(routine))
    .then(result => {
      updateRoutine(routineId, { last_run_at: nowIso }, db);
      return { executed: true, result };
    })
    .catch(err => {
      console.error(`[RoutineScheduler] Error running routine ${routineId}:`, err);
      updateRoutine(routineId, { last_run_at: nowIso }, db);
      return { executed: false, error: err.message };
    })
    .finally(() => {
      runningRoutines.delete(routineId);
    });
}

/**
 * Default routine runner if no custom executor is supplied
 */
async function defaultRoutineRunner(routine) {
  return {
    routine_id: routine.routine_id,
    name: routine.name,
    workflow: routine.workflow,
    status: 'completed',
    output: `Ran routine ${routine.name} (${routine.workflow}) at ${new Date().toISOString()}`
  };
}

/**
 * Initializes and schedules all enabled routines in DB
 * @param {Object} [db]
 */
export function initAllRoutines(db = getAlertsDb()) {
  const routines = listRoutines(db);
  let scheduledCount = 0;
  for (const r of routines) {
    if (r.enabled) {
      if (scheduleRoutine(r)) scheduledCount++;
    }
  }
  return scheduledCount;
}

/**
 * Stops all scheduled routines and clears memory
 */
export function stopAllRoutines() {
  for (const [id, task] of activeCronTasks.entries()) {
    try {
      task.stop();
      if (typeof task.destroy === 'function') task.destroy();
    } catch (e) {
      // ignore
    }
  }
  activeCronTasks.clear();
  runningRoutines.clear();
}

/**
 * Checks if a routine is currently running
 * @param {string} routineId
 */
export function isRoutineRunning(routineId) {
  return runningRoutines.has(routineId);
}
