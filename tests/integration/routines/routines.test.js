import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initAlertsDatabase,
  listRoutines,
  getRoutine,
  updateRoutine
} from '../../../services/alerts/alertPersistence.js';
import {
  scheduleRoutine,
  stopScheduledRoutine,
  executeRoutineWithOverlapProtection,
  isRoutineRunning,
  stopAllRoutines
} from '../../../services/alerts/routineScheduler.js';

describe('Routines Integration & Overlap Protection Tests (Phase 5.5)', () => {
  let db;

  beforeEach(() => {
    db = initAlertsDatabase(':memory:');
    stopAllRoutines();
  });

  afterEach(() => {
    stopAllRoutines();
  });

  it('verifies that all 5 built-in routines are seeded by default in disabled state', () => {
    const routines = listRoutines(db);
    expect(routines.length).toBe(5);

    const names = routines.map(r => r.name);
    expect(names).toContain('Pre-market briefing');
    expect(names).toContain('Market-open checklist');
    expect(names).toContain('Midday risk check');
    expect(names).toContain('Post-market review');
    expect(names).toContain('Weekly journal review');

    for (const r of routines) {
      expect(r.enabled).toBe(false);
      expect(r.schedule.timezone).toBe('America/New_York');
    }
  });

  it('Test 20: Routine runs at the configured timezone and does NOT overlap a previous unfinished run', async () => {
    const routineId = 'routine-pre-market-briefing';
    const routine = getRoutine(routineId, db);
    expect(routine).not.toBeNull();
    expect(routine.schedule.timezone).toBe('America/New_York');

    // Enable routine and test scheduling
    updateRoutine(routineId, { enabled: true }, db);
    const scheduled = scheduleRoutine(getRoutine(routineId, db));
    expect(scheduled).toBe(true);

    // Simulate an ongoing long-running execution
    let finishFirstRun;
    const longRunningPromise = new Promise(resolve => {
      finishFirstRun = resolve;
    });

    const longRunner = async () => {
      await longRunningPromise;
      return { status: 'first_run_done' };
    };

    // Start 1st run (will hang until finishFirstRun is called)
    const run1Promise = executeRoutineWithOverlapProtection(routineId, longRunner, db);

    // Confirm that the routine is marked as running
    expect(isRoutineRunning(routineId)).toBe(true);

    // Attempt to start a 2nd overlapping run concurrently
    const run2Result = await executeRoutineWithOverlapProtection(routineId, async () => ({ status: 'second' }), db);

    // 2nd run must be SKIPPED due to overlap prevention!
    expect(run2Result.executed).toBe(false);
    expect(run2Result.skipped).toBe(true);
    expect(run2Result.reason).toBe('overlap_prevented');

    // Finish 1st run
    finishFirstRun();
    const run1Result = await run1Promise;
    expect(run1Result.executed).toBe(true);
    expect(run1Result.result.status).toBe('first_run_done');

    // Routine is no longer running
    expect(isRoutineRunning(routineId)).toBe(false);

    // Now a subsequent run can succeed
    const run3Result = await executeRoutineWithOverlapProtection(routineId, async () => ({ status: 'third' }), db);
    expect(run3Result.executed).toBe(true);
  });
});
