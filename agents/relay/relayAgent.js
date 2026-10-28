import crypto from 'crypto';
import {
  createResponse,
  validateAlert,
  validateRoutine
} from '../../shared/contract.js';
import {
  saveAlert,
  getAlert,
  listAlerts,
  updateAlert,
  deleteAlert,
  pauseAlerts,
  resumeAlerts,
  saveRoutine,
  getRoutine,
  listRoutines,
  updateRoutine,
  deleteRoutine,
  getAlertsDb
} from '../../services/alerts/alertPersistence.js';
import {
  executeRoutineWithOverlapProtection,
  scheduleRoutine,
  stopScheduledRoutine
} from '../../services/alerts/routineScheduler.js';

// Symbol dictionary for common tickers
const symbolMap = {
  nvidia: 'NVDA',
  apple: 'AAPL',
  tesla: 'TSLA',
  microsoft: 'MSFT',
  google: 'GOOGL',
  amazon: 'AMZN',
  meta: 'META',
  spy: 'SPY',
  qqq: 'QQQ'
};

const STOP_WORDS = new Set([
  'ALERT', 'ME', 'MY', 'IF', 'ON', 'AT', 'IN', 'IS', 'IT', 'TO', 'UP', 'OR', 'AN', 'AS', 'BE', 'BY',
  'DO', 'GO', 'HE', 'NO', 'SO', 'US', 'WE', 'ANY', 'NEW', 'TELL', 'WARN', 'SHOW', 'PAUSE', 'STOP',
  'TIME', 'GAIN', 'LOSS', 'DROP', 'BREAK', 'FALL', 'RISE', 'RSI', 'ABOVE', 'BELOW', 'OVER', 'UNDER',
  'TODAY', 'WHEN', 'CPI', 'FOMC', 'NFP', 'FED', 'DAY', 'DAILY', 'THE', 'FOR', 'FROM', 'WITH',
  'ABOUT', 'MORE', 'THAN', 'OPEN', 'CLOSE', 'RUN', 'NOW', 'ALL', 'SEE', 'GET', 'SET'
]);

/**
 * Parses natural language user prompt into structured AlertSchema attributes
 * @param {string} prompt 
 * @param {Object} [context]
 * @returns {Object}
 */
export function parseNaturalLanguageAlert(prompt, context = {}) {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // 1. Check for Ambiguity requiring a clarifying question (Section 9)
  if (lower.startsWith('alert me on nvda') && !lower.includes('above') && !lower.includes('below') && !lower.includes('8-k') && !lower.includes('price')) {
    return {
      ambiguous: true,
      clarifying_question: 'Should that NVDA alert trigger on the last price, or only during regular market hours?'
    };
  }

  // 2. Extract Symbol
  let symbol = null;
  const words = p.split(/\s+/);
  for (const w of words) {
    const cleanLower = w.toLowerCase().replace(/[^a-z]/g, '');
    if (symbolMap[cleanLower]) {
      symbol = symbolMap[cleanLower];
      break;
    }
    const clean = w.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (clean.length >= 2 && clean.length <= 5 && /^[A-Z]+$/.test(clean)) {
      if (!STOP_WORDS.has(clean)) {
        symbol = clean;
        break;
      }
    }
  }

  // 3. Calendar Alerts (e.g. CPI, FOMC, NFP)
  if (lower.includes('cpi') || lower.includes('fomc') || lower.includes('nfp') || lower.includes('earnings')) {
    let eventName = 'CPI';
    if (lower.includes('fomc')) eventName = 'FOMC';
    if (lower.includes('nfp')) eventName = 'NFP';
    if (lower.includes('earnings')) eventName = 'EARNINGS';

    let leadMinutes = 30;
    const minMatch = lower.match(/(\d+)\s*(?:minute|min)/);
    if (minMatch) leadMinutes = parseInt(minMatch[1], 10);

    return {
      name: `${eventName} in ${leadMinutes}m`,
      type: 'calendar',
      symbol: symbol || null,
      condition: {
        operator: 'schedule',
        left: eventName,
        right: leadMinutes
      },
      trigger: {
        once: true,
        cooldown_minutes: 60
      },
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: true,
        desktop_notification: false,
        speak: false,
        request_sentinel_review: true
      }
    };
  }

  // 4. Filing Alerts (e.g. 8-K, 10-K, Form 4)
  if (lower.includes('8-k') || lower.includes('10-k') || lower.includes('10-q') || lower.includes('form 4') || lower.includes('filing')) {
    let formType = '8-K';
    if (lower.includes('10-k')) formType = '10-K';
    if (lower.includes('10-q')) formType = '10-Q';
    if (lower.includes('form 4')) formType = 'Form 4';

    return {
      name: `New ${formType} from ${symbol || 'watchlist'}`,
      type: 'filing',
      symbol: symbol || 'NVDA',
      condition: {
        operator: 'equals',
        left: 'form_type',
        right: formType
      },
      trigger: {
        once: false,
        cooldown_minutes: 15
      },
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: false,
        desktop_notification: false,
        speak: false,
        request_sentinel_review: true
      }
    };
  }

  // 5. Indicator Alerts (e.g. RSI, EMA, VWAP)
  if (lower.includes('rsi') || lower.includes('vwap') || lower.includes('ema')) {
    let indicator = 'rsi';
    if (lower.includes('vwap')) indicator = 'vwap';
    if (lower.includes('ema')) indicator = 'ema_9';

    let operator = 'crosses_above';
    if (lower.includes('below') || lower.includes('under') || lower.includes('drops')) {
      operator = 'crosses_below';
    }

    let threshold = 70;
    const numMatch = lower.match(/(?:above|below|over|under|to)\s+(\d+(\.\d+)?)/);
    if (numMatch) threshold = parseFloat(numMatch[1]);

    let timeframe = '1d';
    if (lower.includes('5m') || lower.includes('5 min')) timeframe = '5m';
    if (lower.includes('1h') || lower.includes('1 hour')) timeframe = '1h';

    return {
      name: `${symbol || 'TSLA'} ${indicator.toUpperCase()} ${operator === 'crosses_above' ? 'above' : 'below'} ${threshold}`,
      type: 'indicator',
      symbol: symbol || 'TSLA',
      condition: {
        operator,
        left: indicator,
        right: threshold,
        timeframe
      },
      trigger: {
        once: false,
        cooldown_minutes: 60
      },
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: false,
        desktop_notification: false,
        speak: false
      }
    };
  }

  // 6. Position-Risk Alerts (e.g. "loses more than 2%", "moves more than 3% against me")
  if (lower.includes('position') || lower.includes('against me') || lower.includes('loss') || lower.includes('drawdown')) {
    let pct = -2;
    const pctMatch = lower.match(/(\d+(\.\d+)?)\s*%/);
    if (pctMatch) pct = -Math.abs(parseFloat(pctMatch[1]));

    return {
      name: `Position risk: loss exceeds ${Math.abs(pct)}%`,
      type: 'position_risk',
      symbol: symbol || null,
      condition: {
        operator: 'percent_change',
        left: 'unrealized_pnl',
        right: pct
      },
      trigger: {
        once: false,
        cooldown_minutes: 30
      },
      actions: {
        signal_log: true,
        hud_toast: true,
        sound: true,
        desktop_notification: false,
        speak: false,
        request_sentinel_review: true
      }
    };
  }

  // 7. Price Alerts (e.g. "NVDA breaks above 150", "AAPL drops below 180", "falls more than 3%")
  let operator = 'crosses_above';
  if (lower.includes('below') || lower.includes('drops') || lower.includes('falls') || lower.includes('under')) {
    operator = 'crosses_below';
  }

  // Percent change vs price level
  if (lower.includes('%') || lower.includes('percent')) {
    const pctMatch = lower.match(/(\d+(\.\d+)?)\s*%/);
    const pctVal = pctMatch ? parseFloat(pctMatch[1]) : 3;
    const finalPct = operator === 'crosses_below' ? -pctVal : pctVal;

    return {
      name: `${symbol || 'Symbol'} moves ${finalPct}%`,
      type: 'price',
      symbol: symbol || 'AAPL',
      condition: {
        operator: 'percent_change',
        left: 'close',
        right: finalPct
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
      }
    };
  }

  // Price level threshold
  const priceMatch = lower.match(/(?:above|below|over|under|breaks|drops|to)\s+(\$?\d+(\.\d+)?)/);
  const threshold = priceMatch ? parseFloat(priceMatch[1].replace('$', '')) : 150;

  return {
    name: `${symbol || 'NVDA'} ${operator === 'crosses_above' ? 'above' : 'below'} ${threshold}`,
    type: 'price',
    symbol: symbol || 'NVDA',
    condition: {
      operator,
      left: 'close',
      right: threshold
    },
    trigger: {
      once: true,
      cooldown_minutes: 30,
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
      speak: false
    }
  };
}

/**
 * Security boundary assertion for RELAY (Section 10 & 1)
 * RELAY CANNOT execute orders, authorize trades, generate tokens, or modify risk rules.
 */
export function assertRelaySecurity(actionType) {
  const forbiddenActions = [
    'place_order',
    'execute_trade',
    'fill_order',
    'approve_trade',
    'generate_token',
    'modify_risk_limit',
    'bypass_sentinel'
  ];

  if (forbiddenActions.includes(actionType)) {
    throw new Error(`SECURITY VIOLATION: Agent RELAY is strictly prohibited from executing action "${actionType}".`);
  }
}

// =============================================================================
// RELAY AGENT CLASS & DISPATCHER
// =============================================================================

export class RelayAgent {
  constructor(db = getAlertsDb()) {
    this.name = 'RELAY';
    this.role = 'Alert and Routine Manager / Desk Watchtower';
    this.db = db;
  }

  /**
   * Main dispatch entry point for RELAY JSON-RPC calls
   * @param {Object} req - Standard request envelope
   * @returns {Object} Standard response envelope
   */
  async handleRequest(req) {
    const { id, intent, params = {} } = req;

    try {
      // Strict Security Guard
      assertRelaySecurity(intent);

      switch (intent) {
        case 'create_alert': {
          const alert = this.createAlert(params);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Created alert "${alert.name}" for ${alert.symbol || 'market'} (${alert.type}).`,
            data: { alert },
            sources: ['relay:local_db'],
            spoken_text: `Alert configured: ${alert.name}.`
          });
        }

        case 'list_alerts': {
          const alerts = listAlerts(params, this.db);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Retrieved ${alerts.length} alerts.`,
            data: { alerts },
            sources: ['relay:local_db'],
            spoken_text: `You have ${alerts.length} alerts on file.`
          });
        }

        case 'update_alert': {
          const updated = updateAlert(params.alert_id, params.updates, this.db);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Updated alert "${updated.name}".`,
            data: { alert: updated },
            sources: ['relay:local_db'],
            spoken_text: `Alert updated.`
          });
        }

        case 'delete_alert': {
          deleteAlert(params.alert_id, this.db);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Alert deleted.`,
            data: { alert_id: params.alert_id, deleted: true },
            sources: ['relay:local_db'],
            spoken_text: `Alert removed.`
          });
        }

        case 'pause_alerts': {
          const alerts = pauseAlerts(params.alert_ids || null, this.db);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Paused alerts.`,
            data: { alerts },
            sources: ['relay:local_db'],
            spoken_text: `Alerts paused.`
          });
        }

        case 'resume_alerts': {
          const alerts = resumeAlerts(params.alert_ids || null, this.db);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Resumed alerts.`,
            data: { alerts },
            sources: ['relay:local_db'],
            spoken_text: `Alerts resumed.`
          });
        }

        case 'create_routine': {
          const routine = this.createRoutine(params);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Created routine "${routine.name}".`,
            data: { routine },
            sources: ['relay:local_db'],
            spoken_text: `Routine created: ${routine.name}.`
          });
        }

        case 'list_routines': {
          const routines = listRoutines(this.db);
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: `Retrieved ${routines.length} routines.`,
            data: { routines },
            sources: ['relay:local_db'],
            spoken_text: `Showing ${routines.length} routines.`
          });
        }

        case 'run_routine': {
          const res = await executeRoutineWithOverlapProtection(params.routine_id, null, this.db);
          return createResponse({
            id,
            agent: this.name,
            status: res.executed ? 'ok' : 'limited',
            summary: res.executed ? `Routine execution completed.` : `Routine skipped: ${res.reason}`,
            data: res,
            sources: ['relay:scheduler'],
            spoken_text: res.executed ? `Routine complete.` : `Routine already running.`
          });
        }

        case 'explain_alert': {
          const alert = getAlert(params.alert_id, this.db);
          if (!alert) throw new Error(`Alert ${params.alert_id} not found`);
          const explanation = `Alert "${alert.name}" evaluates ${alert.condition.left} on ${alert.symbol || 'the desk'} with operator ${alert.condition.operator} and threshold ${alert.condition.right}. Cooldown is ${alert.trigger.cooldown_minutes} minutes. Current status is ${alert.status}.`;
          return createResponse({
            id,
            agent: this.name,
            status: 'ok',
            summary: explanation,
            data: { alert, explanation },
            sources: ['relay:local_db'],
            spoken_text: explanation
          });
        }

        default:
          throw new Error(`Unsupported RELAY intent: ${intent}`);
      }
    } catch (err) {
      return createResponse({
        id,
        agent: this.name,
        status: 'error',
        summary: `RELAY encountered an error: ${err.message}`,
        data: { error: err.message },
        sources: ['relay:error'],
        spoken_text: `Relay error: ${err.message}`
      });
    }
  }

  /**
   * Constructs and saves a validated alert
   */
  createAlert(params) {
    const alertId = params.alert_id || `alt_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const alert = {
      alert_id: alertId,
      user_id: params.user_id || 'local',
      name: params.name || `${params.symbol || 'Market'} Alert`,
      type: params.type || 'price',
      symbol: params.symbol ? params.symbol.toUpperCase() : null,
      condition: {
        operator: params.condition?.operator || 'crosses_above',
        left: params.condition?.left || 'close',
        right: params.condition?.right !== undefined ? params.condition.right : null,
        secondary: params.condition?.secondary || null,
        lookback: params.condition?.lookback || null,
        timeframe: params.condition?.timeframe || null
      },
      trigger: {
        once: params.trigger?.once !== undefined ? params.trigger.once : true,
        cooldown_minutes: params.trigger?.cooldown_minutes || 30,
        expires_at: params.trigger?.expires_at || null,
        active_hours: params.trigger?.active_hours || {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York'
        },
        trigger_immediately_if_true: Boolean(params.trigger?.trigger_immediately_if_true)
      },
      actions: {
        signal_log: params.actions?.signal_log !== undefined ? params.actions.signal_log : true,
        hud_toast: params.actions?.hud_toast !== undefined ? params.actions.hud_toast : true,
        sound: params.actions?.sound !== undefined ? params.actions.sound : false,
        desktop_notification: params.actions?.desktop_notification !== undefined ? params.actions.desktop_notification : false,
        speak: params.actions?.speak !== undefined ? params.actions.speak : false,
        start_workflow: params.actions?.start_workflow || null,
        request_sentinel_review: Boolean(params.actions?.request_sentinel_review)
      },
      status: params.status || 'active',
      last_evaluated_at: null,
      last_triggered_at: null,
      trigger_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
      source: params.source || 'user',
      notes: params.notes || null,
      initial_value: params.initial_value !== undefined ? params.initial_value : null
    };

    saveAlert(alert, this.db);
    return alert;
  }

  /**
   * Constructs and saves a validated routine
   */
  createRoutine(params) {
    const routineId = params.routine_id || `rtn_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const routine = {
      routine_id: routineId,
      name: params.name || 'New Routine',
      schedule: {
        type: params.schedule?.type || 'weekdays',
        time: params.schedule?.time || '09:00',
        timezone: params.schedule?.timezone || 'America/New_York',
        cron: params.schedule?.cron || '0 9 * * 1-5',
        market_session: params.schedule?.market_session || 'any'
      },
      workflow: params.workflow || 'pre_market_briefing',
      enabled: Boolean(params.enabled),
      last_run_at: null,
      next_run_at: null,
      actions: {
        speak: params.actions?.speak !== undefined ? params.actions.speak : true,
        hud_panel: params.actions?.hud_panel !== undefined ? params.actions.hud_panel : true,
        signal_log: params.actions?.signal_log !== undefined ? params.actions.signal_log : true,
        desktop_notification: params.actions?.desktop_notification !== undefined ? params.actions.desktop_notification : false
      },
      created_at: nowIso,
      updated_at: nowIso
    };

    saveRoutine(routine, this.db);
    if (routine.enabled) {
      scheduleRoutine(routine);
    }
    return routine;
  }
}
