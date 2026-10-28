import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateAlert,
  clearEvaluatorCaches
} from '../../../services/alerts/evaluator.js';
import {
  initAlertsDatabase,
  saveAlert,
  getAlert
} from '../../../services/alerts/alertPersistence.js';

describe('Alert Evaluation Integration Tests (Phase 5.5)', () => {
  let db;

  beforeEach(() => {
    clearEvaluatorCaches();
    db = initAlertsDatabase(':memory:');
  });

  it('Test 1 & 2: Trigger price-crosses-above ONLY when threshold is actually crossed', () => {
    const alert = {
      alert_id: 'alt_nvda_150',
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
        cooldown_minutes: 30
      },
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: false,
        desktop_notification: false,
        speak: false
      },
      status: 'active',
      last_evaluated_at: null,
      last_triggered_at: null,
      trigger_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'user',
      initial_value: 148 // created while price was below 150
    };

    // 1st tick: price moves to 149.50 -> threshold not crossed
    const res1 = evaluateAlert(alert, { price: 149.50 });
    expect(res1.triggered).toBe(false);

    // 2nd tick: price crosses above 150 to 150.25 -> triggers!
    const res2 = evaluateAlert(alert, { price: 150.25 });
    expect(res2.triggered).toBe(true);
    expect(res2.event.severity).toBe('info');
    expect(res2.event.value).toBe(150.25);
    expect(res2.event.threshold).toBe(150);
  });

  it('Test 3: Does NOT trigger when price is already above threshold at creation, unless trigger_immediately_if_true is enabled', () => {
    // Alert created when price is 155 (already above 150) with default trigger_immediately_if_true: false
    const alert1 = {
      alert_id: 'alt_already_above_1',
      name: 'NVDA above 150',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: { once: true, cooldown_minutes: 30, trigger_immediately_if_true: false },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      initial_value: 155, // already above
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res1 = evaluateAlert(alert1, { price: 156 });
    expect(res1.triggered).toBe(false); // No crossing occurred; was already above!

    // Alert created with trigger_immediately_if_true: true
    const alert2 = {
      ...alert1,
      alert_id: 'alt_already_above_2',
      trigger: { ...alert1.trigger, trigger_immediately_if_true: true }
    };
    const res2 = evaluateAlert(alert2, { price: 156 });
    expect(res2.triggered).toBe(true); // Triggers immediately as requested
  });

  it('Test 4: Respects one-shot vs recurring behavior', () => {
    // One-shot alert
    const oneShot = {
      alert_id: 'alt_once',
      name: 'One shot alert',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: { once: true, cooldown_minutes: 0, trigger_immediately_if_true: true },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res1 = evaluateAlert(oneShot, { price: 151 });
    expect(res1.triggered).toBe(true);
    expect(oneShot.status).toBe('triggered'); // One-shot becomes triggered

    // Second evaluation is skipped because status is no longer active
    const res2 = evaluateAlert(oneShot, { price: 152 });
    expect(res2.triggered).toBe(false);

    // Recurring alert
    const recurring = {
      alert_id: 'alt_recurring',
      name: 'Recurring alert',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: { once: false, cooldown_minutes: 0, trigger_immediately_if_true: true },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const rRes1 = evaluateAlert(recurring, { price: 151, id: 'tick_1' });
    expect(rRes1.triggered).toBe(true);
    expect(recurring.status).toBe('active'); // Stays active for subsequent events!
    expect(recurring.trigger_count).toBe(1);
  });

  it('Test 5: Respects cooldown minutes', () => {
    const alert = {
      alert_id: 'alt_cooldown',
      name: 'Cooldown alert',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: { once: false, cooldown_minutes: 30, trigger_immediately_if_true: true },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      last_triggered_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Cooldown is 30 mins, only 10 mins passed -> blocked
    const res = evaluateAlert(alert, { price: 155 });
    expect(res.triggered).toBe(false);
    expect(res.reason).toBe('cooldown');

    // After 35 minutes passed -> triggers!
    alert.last_triggered_at = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const resAfterCooldown = evaluateAlert(alert, { price: 155, id: 'tick_cooldown_expired' });
    expect(resAfterCooldown.triggered).toBe(true);
  });

  it('Test 6: Respects active hours and timezone (America/New_York)', () => {
    const alert = {
      alert_id: 'alt_hours',
      name: 'Regular session only',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: {
        once: true,
        cooldown_minutes: 10,
        trigger_immediately_if_true: true,
        active_hours: {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York'
        }
      },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Construct a date at 08:00 AM NY time (Pre-market, outside 09:30-16:00)
    // 08:00 AM EDT is 12:00:00 UTC
    const preMarketDate = new Date('2026-10-28T12:00:00Z');
    const resPre = evaluateAlert(alert, { price: 155 }, { currentDate: preMarketDate });
    expect(resPre.triggered).toBe(false);
    expect(resPre.reason).toBe('outside_active_hours');

    // Construct a date at 10:30 AM NY time (Market hours, inside 09:30-16:00)
    // 10:30 AM EDT is 14:30:00 UTC
    const regularSessionDate = new Date('2026-10-28T14:30:00Z');
    const resRegular = evaluateAlert(alert, { price: 155 }, { currentDate: regularSessionDate });
    expect(resRegular.triggered).toBe(true);
  });

  it('Test 7: Expires alerts at the configured time', () => {
    const pastExpiration = new Date(Date.now() - 60 * 1000).toISOString();
    const alert = {
      alert_id: 'alt_expired',
      name: 'Expired alert',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: {
        once: true,
        expires_at: pastExpiration,
        trigger_immediately_if_true: true
      },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res = evaluateAlert(alert, { price: 155 });
    expect(res.triggered).toBe(false);
    expect(res.reason).toBe('expired');
    expect(alert.status).toBe('expired');
  });

  it('Test 10: Triggers RSI indicator alert using historical/cached data', () => {
    const alert = {
      alert_id: 'alt_rsi',
      name: 'TSLA RSI above 70',
      type: 'indicator',
      symbol: 'TSLA',
      condition: {
        operator: 'threshold',
        left: 'rsi',
        right: 70
      },
      trigger: { once: true },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res1 = evaluateAlert(alert, { rsi: 65.4 });
    expect(res1.triggered).toBe(false);

    const res2 = evaluateAlert(alert, { rsi: 72.8 });
    expect(res2.triggered).toBe(true);
    expect(res2.event.value).toBe(72.8);
    expect(res2.event.threshold).toBe(70);
  });

  it('Test 11: Triggers a filing alert from a mocked EDGAR 8-K submission', () => {
    const alert = {
      alert_id: 'alt_filing',
      name: 'NVDA 8-K filing',
      type: 'filing',
      symbol: 'NVDA',
      condition: {
        operator: 'equals',
        left: 'form_type',
        right: '8-K'
      },
      trigger: { once: true },
      actions: { signal_log: true, hud_toast: true, sound: true, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mocked EDGAR event for NVDA 8-K
    const edgarSubmission = {
      symbol: 'NVDA',
      form_type: '8-K',
      accessionNumber: '0001045810-26-000042',
      title: 'Current Report under Section 13 or 15(d)',
      has_open_position: true // affects an open position -> critical
    };

    const res = evaluateAlert(alert, edgarSubmission);
    expect(res.triggered).toBe(true);
    expect(res.event.severity).toBe('critical'); // Critical because of open position
    expect(res.event.message).toContain('8-K');
  });

  it('Test 12: Triggers a calendar alert 30 minutes before a mocked CPI event', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const cpiEventTime = new Date('2026-10-28T12:28:00Z').toISOString(); // exactly 28 minutes away

    const alert = {
      alert_id: 'alt_cpi',
      name: 'CPI 30m Warning',
      type: 'calendar',
      symbol: null,
      condition: {
        operator: 'schedule',
        left: 'CPI',
        right: 30 // lead time 30 mins
      },
      trigger: { once: true },
      actions: { signal_log: true, hud_toast: true, sound: true, desktop_notification: false, speak: false },
      status: 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const calendarData = {
      event: 'US CPI Release',
      event_time: cpiEventTime
    };

    const res = evaluateAlert(alert, calendarData, { currentDate: now });
    expect(res.triggered).toBe(true);
    expect(res.event.severity).toBe('critical'); // Major macro event
    expect(res.event.value).toBe(28); // 28 minutes left
  });

  it('Test 13: Triggers a position-risk alert from a mocked open paper position', () => {
    const alert = {
      alert_id: 'alt_risk',
      name: 'Position Loss Warning',
      type: 'position_risk',
      symbol: 'AAPL',
      condition: {
        operator: 'percent_change',
        left: 'unrealized_pnl',
        right: -3 // loss threshold -3%
      },
      trigger: { once: true },
      actions: { signal_log: true, hud_toast: true, sound: true, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const positionData = {
      symbol: 'AAPL',
      unrealized_pnl_percent: -3.42,
      shares: 100
    };

    const res = evaluateAlert(alert, positionData);
    expect(res.triggered).toBe(true);
    expect(res.event.value).toBe(-3.42);
    expect(res.event.severity).toBe('important');
  });

  it('Test 14: Does NOT trigger a price alert when quote is stale', () => {
    const alert = {
      alert_id: 'alt_stale',
      name: 'Stale quote test',
      type: 'price',
      symbol: 'NVDA',
      condition: { operator: 'crosses_above', left: 'close', right: 150 },
      trigger: { once: true, trigger_immediately_if_true: true },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const staleData = {
      price: 155,
      is_stale: true // Explicitly stale
    };

    const res = evaluateAlert(alert, staleData);
    expect(res.triggered).toBe(false);
    expect(res.reason).toBe('stale_data');
  });

  it('Test 15: Prevents duplicate triggers for the same event', () => {
    const alert = {
      alert_id: 'alt_dedup',
      name: 'Dedup alert',
      type: 'filing',
      symbol: 'NVDA',
      condition: { operator: 'equals', left: 'form_type', right: '8-K' },
      trigger: { once: false, cooldown_minutes: 0 },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const filingEvent = {
      symbol: 'NVDA',
      form_type: '8-K',
      accessionNumber: '0001045810-26-999999'
    };

    const first = evaluateAlert(alert, filingEvent);
    expect(first.triggered).toBe(true);

    // Second evaluation with the exact same accessionNumber
    const second = evaluateAlert(alert, filingEvent);
    expect(second.triggered).toBe(false);
    expect(second.reason).toBe('duplicate_event');
  });

  it('Test 16: Persists alerts across app restart', () => {
    // 1. Save alert in SQLite
    const saved = saveAlert({
      alert_id: 'alt_persist_test',
      user_id: 'local',
      name: 'Persistent Alert',
      type: 'price',
      symbol: 'TSLA',
      condition: { operator: 'crosses_above', left: 'close', right: 250 },
      trigger: { once: true, cooldown_minutes: 15 },
      actions: { signal_log: true, hud_toast: true, sound: false, desktop_notification: false, speak: false },
      status: 'active',
      last_evaluated_at: null,
      last_triggered_at: null,
      trigger_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'user'
    }, db);

    expect(saved.alert_id).toBe('alt_persist_test');

    // 2. Simulate app restart: re-fetch from database
    const fetched = getAlert('alt_persist_test', db);
    expect(fetched).not.toBeNull();
    expect(fetched.name).toBe('Persistent Alert');
    expect(fetched.symbol).toBe('TSLA');
    expect(fetched.condition.right).toBe(250);
  });
});
