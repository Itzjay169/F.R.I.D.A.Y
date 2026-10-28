import { describe, it, expect } from 'vitest';
import {
  AlertSchema,
  RoutineSchema,
  AlertTriggerEventSchema,
  validateAlert,
  validateRoutine,
  validateAlertTriggerEvent
} from '../../../shared/contract.js';
import { DEFAULT_ROUTINES } from '../../../services/alerts/alertPersistence.js';

describe('Alert & Routine Contract Tests (Phase 5.5)', () => {
  it('validates a complete, compliant AlertSchema object', () => {
    const validAlert = {
      alert_id: 'alt_123',
      user_id: 'local',
      name: 'NVDA above 150',
      type: 'price',
      symbol: 'NVDA',
      condition: {
        operator: 'crosses_above',
        left: 'close',
        right: 150
      },
      trigger: {
        once: true,
        cooldown_minutes: 30,
        expires_at: '2026-12-31T23:59:59Z',
        active_hours: {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York'
        }
      },
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: false,
        desktop_notification: false,
        speak: false,
        start_workflow: 'research_symbol',
        request_sentinel_review: false
      },
      status: 'active',
      last_evaluated_at: null,
      last_triggered_at: null,
      trigger_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'user',
      notes: 'Key resistance breakout watch'
    };

    const res = validateAlert(validAlert);
    expect(res.valid).toBe(true);
    expect(res.data.symbol).toBe('NVDA');
  });

  it('rejects an alert with invalid alert type or missing mandatory fields', () => {
    const invalidAlert = {
      alert_id: 'alt_bad',
      type: 'unsupported_type', // Invalid type
      name: 'Invalid Alert'
      // missing condition, trigger, actions, etc.
    };

    const res = validateAlert(invalidAlert);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('validates a complete RoutineSchema object', () => {
    const validRoutine = {
      routine_id: 'rtn_test_1',
      name: 'Pre-market briefing',
      schedule: {
        type: 'weekdays',
        time: '09:00',
        timezone: 'America/New_York',
        cron: '0 9 * * 1-5',
        market_session: 'pre_market'
      },
      workflow: 'pre_market_briefing',
      enabled: true,
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
    };

    const res = validateRoutine(validRoutine);
    expect(res.valid).toBe(true);
    expect(res.data.name).toBe('Pre-market briefing');
  });

  it('validates that all 5 default routines conform strictly to RoutineSchema', () => {
    for (const routine of DEFAULT_ROUTINES) {
      const res = validateRoutine(routine);
      expect(res.valid).toBe(true);
      expect(['pre_market_briefing', 'market_open_checklist', 'midday_risk_check', 'post_market_review', 'weekly_journal_review']).toContain(routine.workflow);
    }
  });

  it('validates an AlertTriggerEvent payload with severity rules', () => {
    const triggerEvent = {
      event: 'alert.triggered',
      alert_id: 'alt_999',
      alert_name: 'NVDA above 150',
      symbol: 'NVDA',
      severity: 'critical',
      message: 'NVDA crossed above 150.00 at 10:42 AM ET.',
      value: 150.24,
      threshold: 150,
      source: 'finnhub:quote:NVDA',
      as_of: new Date().toISOString(),
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: true,
        desktop_notification: false,
        speak: false
      }
    };

    const res = validateAlertTriggerEvent(triggerEvent);
    expect(res.valid).toBe(true);
    expect(res.data.severity).toBe('critical');
  });
});
