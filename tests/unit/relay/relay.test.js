import { describe, it, expect, beforeEach } from 'vitest';
import { RelayAgent, parseNaturalLanguageAlert, assertRelaySecurity } from '../../../agents/relay/relayAgent.js';
import { initAlertsDatabase } from '../../../services/alerts/alertPersistence.js';

describe('RELAY Agent Unit Tests (Phase 5.5)', () => {
  let db;
  let relay;

  beforeEach(() => {
    db = initAlertsDatabase(':memory:');
    relay = new RelayAgent(db);
  });

  it('1. parses "Alert me if NVDA breaks above 150" into a structured price-crosses-above alert', () => {
    const parsed = parseNaturalLanguageAlert('Alert me if NVDA breaks above 150');
    expect(parsed.symbol).toBe('NVDA');
    expect(parsed.type).toBe('price');
    expect(parsed.condition.operator).toBe('crosses_above');
    expect(parsed.condition.right).toBe(150);
    expect(parsed.actions.desktop_notification).toBe(false); // Test 17: desktop notification disabled by default
  });

  it('parses natural language for TSLA RSI, filing 8-K, CPI calendar, and position risk', () => {
    const rsiAlert = parseNaturalLanguageAlert('Tell me when TSLA RSI goes above 70 on the daily');
    expect(rsiAlert.symbol).toBe('TSLA');
    expect(rsiAlert.type).toBe('indicator');
    expect(rsiAlert.condition.left).toBe('rsi');
    expect(rsiAlert.condition.right).toBe(70);

    const filingAlert = parseNaturalLanguageAlert('Alert me on any new NVDA 8-K');
    expect(filingAlert.type).toBe('filing');
    expect(filingAlert.condition.right).toBe('8-K');

    const calendarAlert = parseNaturalLanguageAlert('Notify me 30 minutes before CPI');
    expect(calendarAlert.type).toBe('calendar');
    expect(calendarAlert.condition.left).toBe('CPI');
    expect(calendarAlert.condition.right).toBe(30);

    const riskAlert = parseNaturalLanguageAlert('Warn me if any open position loses more than 2%');
    expect(riskAlert.type).toBe('position_risk');
    expect(riskAlert.condition.right).toBe(-2);
  });

  it('detects ambiguous prompt and returns a concise clarifying question', () => {
    const res = parseNaturalLanguageAlert('Alert me on NVDA');
    expect(res.ambiguous).toBe(true);
    expect(res.clarifying_question).toContain('Should that NVDA alert trigger on the last price');
  });

  it('Test 8 & 9: Pause, resume, and permanently delete alerts', async () => {
    const createRes = await relay.handleRequest({
      id: 'req_1',
      from: 'master',
      to: 'relay',
      intent: 'create_alert',
      params: {
        name: 'AAPL Test Alert',
        symbol: 'AAPL',
        type: 'price',
        condition: { operator: 'crosses_below', left: 'close', right: 180 },
        trigger: { once: true, cooldown_minutes: 10 }
      }
    });

    const alertId = createRes.data.alert.alert_id;

    // Pause
    const pauseRes = await relay.handleRequest({
      id: 'req_2',
      from: 'master',
      to: 'relay',
      intent: 'pause_alerts',
      params: { alert_ids: [alertId] }
    });
    const paused = pauseRes.data.alerts.find(a => a.alert_id === alertId);
    expect(paused.status).toBe('paused');

    // Resume
    const resumeRes = await relay.handleRequest({
      id: 'req_3',
      from: 'master',
      to: 'relay',
      intent: 'resume_alerts',
      params: { alert_ids: [alertId] }
    });
    const resumed = resumeRes.data.alerts.find(a => a.alert_id === alertId);
    expect(resumed.status).toBe('active');

    // Delete (Test 9)
    await relay.handleRequest({
      id: 'req_4',
      from: 'master',
      to: 'relay',
      intent: 'delete_alert',
      params: { alert_id: alertId }
    });

    const listRes = await relay.handleRequest({
      id: 'req_5',
      from: 'master',
      to: 'relay',
      intent: 'list_alerts',
      params: {}
    });
    expect(listRes.data.alerts.some(a => a.alert_id === alertId)).toBe(false);
  });

  it('Test 18: RELAY cannot place, modify, cancel, or approve a trade', async () => {
    expect(() => assertRelaySecurity('place_order')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertRelaySecurity('execute_trade')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertRelaySecurity('approve_trade')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertRelaySecurity('modify_risk_limit')).toThrow(/SECURITY VIOLATION/);
    expect(() => assertRelaySecurity('bypass_sentinel')).toThrow(/SECURITY VIOLATION/);

    const badReq = await relay.handleRequest({
      id: 'req_evil',
      from: 'user',
      to: 'relay',
      intent: 'place_order',
      params: { symbol: 'NVDA', qty: 100 }
    });
    expect(badReq.status).toBe('error');
    expect(badReq.summary).toContain('SECURITY VIOLATION');
  });

  it('Test 19: Critical alert can request SENTINEL review but cannot authorize execution', () => {
    const alert = relay.createAlert({
      name: 'Critical Position Drawdown',
      symbol: 'NVDA',
      type: 'position_risk',
      condition: { operator: 'percent_change', left: 'unrealized_pnl', right: -5 },
      actions: {
        signal_log: true,
        request_sentinel_review: true // Permitted
      }
    });

    expect(alert.actions.request_sentinel_review).toBe(true);

    // Assert that requesting sentinel review does NOT grant execution permissions
    expect(() => assertRelaySecurity('execute_trade')).toThrow(/SECURITY VIOLATION/);
  });
});
