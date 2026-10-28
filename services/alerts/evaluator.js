import { validateAlertTriggerEvent } from '../../shared/contract.js';

// Cache for deduplicating events and tracking evaluation history
const evaluationHistory = [];
const triggeredEventSignatures = new Set();
const lastEvaluatedValues = new Map(); // alertId -> last seen numeric/string value

/**
 * Checks if current time is within active hours for a given timezone
 * @param {{ start: string, end: string, timezone: string }} activeHours
 * @param {Date} [currentDate]
 * @returns {boolean}
 */
export function isInActiveHours(activeHours, currentDate = new Date()) {
  if (!activeHours || !activeHours.start || !activeHours.end) return true;
  const tz = activeHours.timezone || 'America/New_York';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(currentDate);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const currentHHMM = `${hour}:${minute}`;
    return currentHHMM >= activeHours.start && currentHHMM <= activeHours.end;
  } catch (err) {
    console.warn(`Timezone formatting failed for ${tz}, falling back to UTC:`, err);
    return true;
  }
}

/**
 * Determines alert severity based on Phase 5.5 rules
 * @param {Object} alert 
 * @param {Object} data 
 * @returns {'info' | 'important' | 'critical'}
 */
export function determineSeverity(alert, data = {}) {
  // Critical cases:
  // 1. Filing or news on an open paper position
  if ((alert.type === 'filing' || alert.type === 'news') && data.has_open_position) {
    return 'critical';
  }
  // 2. Major macro event imminent (FOMC, CPI, NFP)
  if (alert.type === 'calendar') {
    const majorEvents = ['FOMC', 'CPI', 'NFP', 'FED', 'RATE_DECISION'];
    const eventName = String(alert.condition?.left || alert.symbol || data.event || '').toUpperCase();
    if (majorEvents.some(m => eventName.includes(m))) {
      return 'critical';
    }
    return 'important';
  }
  // 3. Position risk: daily loss limit, portfolio heat, or major drawdown
  if (alert.type === 'position_risk') {
    if (
      data.metric === 'daily_loss_limit' ||
      data.metric === 'portfolio_heat' ||
      (typeof data.unrealized_pnl_percent === 'number' && data.unrealized_pnl_percent <= -5)
    ) {
      return 'critical';
    }
    return 'important';
  }
  // 4. Data health: stale quote on active trade
  if (alert.type === 'data_health') {
    if (data.affects_active_trade) {
      return 'critical';
    }
    return 'important';
  }
  // 5. Watchlist filing or high-importance news
  if (alert.type === 'filing' || alert.type === 'news') {
    return 'important';
  }

  // Info: standard user price or indicator alert
  return 'info';
}

/**
 * Evaluates a single alert against incoming data
 * @param {Object} alert - Alert object
 * @param {Object} data - Market, filing, calendar, or position data
 * @param {Object} [options]
 * @returns {{ triggered: boolean, event?: Object, reason?: string }}
 */
export function evaluateAlert(alert, data, options = {}) {
  const now = options.currentDate || new Date();
  const nowIso = now.toISOString();

  // 1. Status Check
  if (alert.status !== 'active') {
    return { triggered: false, reason: `status_${alert.status}` };
  }

  // 2. Expiration Check
  if (alert.trigger?.expires_at) {
    const expireTime = new Date(alert.trigger.expires_at).getTime();
    if (now.getTime() >= expireTime) {
      alert.status = 'expired';
      alert.updated_at = nowIso;
      return { triggered: false, reason: 'expired' };
    }
  }

  // 3. Stale Data Check (Section 5: Never trigger price/indicator on stale data)
  if (alert.type === 'price' || alert.type === 'indicator') {
    if (data.is_stale || data.stale) {
      alert.last_evaluated_at = nowIso;
      return { triggered: false, reason: 'stale_data' };
    }
    if (data.as_of) {
      const dataAgeMs = now.getTime() - new Date(data.as_of).getTime();
      // If data is older than 5 minutes and marked stale
      if (dataAgeMs > 5 * 60 * 1000 && options.enforceStalenessAge) {
        alert.last_evaluated_at = nowIso;
        return { triggered: false, reason: 'stale_data' };
      }
    }
  }

  // 4. Cooldown Check
  if (alert.last_triggered_at && alert.trigger?.cooldown_minutes) {
    const lastTrig = new Date(alert.last_triggered_at).getTime();
    const elapsedMinutes = (now.getTime() - lastTrig) / (60 * 1000);
    if (elapsedMinutes < alert.trigger.cooldown_minutes) {
      return { triggered: false, reason: 'cooldown' };
    }
  }

  // 5. Active Hours Check
  if (alert.trigger?.active_hours) {
    if (!isInActiveHours(alert.trigger.active_hours, now)) {
      return { triggered: false, reason: 'outside_active_hours' };
    }
  }

  // 6. Condition Evaluation
  const cond = alert.condition;
  const prevVal = lastEvaluatedValues.has(alert.alert_id)
    ? lastEvaluatedValues.get(alert.alert_id)
    : (alert.initial_value !== undefined ? alert.initial_value : null);

  let isConditionMet = false;
  let currentVal = null;
  let thresholdVal = cond.right !== undefined ? cond.right : null;
  let eventMessage = '';

  switch (alert.type) {
    case 'price': {
      currentVal = data.price !== undefined ? data.price : (data.close !== undefined ? data.close : null);
      if (currentVal === null || typeof currentVal !== 'number') {
        return { triggered: false, reason: 'missing_price' };
      }

      const threshold = Number(cond.right);

      if (cond.operator === 'crosses_above') {
        if (alert.trigger?.trigger_immediately_if_true && currentVal > threshold) {
          isConditionMet = true;
        } else if (prevVal !== null && typeof prevVal === 'number') {
          // True crossing: previous <= threshold and current > threshold
          if (prevVal <= threshold && currentVal > threshold) {
            isConditionMet = true;
          }
        }
        eventMessage = `${alert.symbol || 'Price'} crossed above ${threshold.toFixed(2)} (current: ${currentVal.toFixed(2)})`;
      } else if (cond.operator === 'crosses_below') {
        if (alert.trigger?.trigger_immediately_if_true && currentVal < threshold) {
          isConditionMet = true;
        } else if (prevVal !== null && typeof prevVal === 'number') {
          if (prevVal >= threshold && currentVal < threshold) {
            isConditionMet = true;
          }
        }
        eventMessage = `${alert.symbol || 'Price'} dropped below ${threshold.toFixed(2)} (current: ${currentVal.toFixed(2)})`;
      } else if (cond.operator === 'equals') {
        if (Math.abs(currentVal - threshold) < 0.0001) {
          isConditionMet = true;
          eventMessage = `${alert.symbol} reached target level ${threshold.toFixed(2)}`;
        }
      } else if (cond.operator === 'percent_change') {
        const pctChange = data.percent_change !== undefined
          ? data.percent_change
          : (prevVal ? ((currentVal - prevVal) / prevVal) * 100 : 0);
        currentVal = pctChange;
        if (threshold < 0 ? pctChange <= threshold : pctChange >= threshold) {
          isConditionMet = true;
          eventMessage = `${alert.symbol} moved ${pctChange.toFixed(2)}% (threshold: ${threshold}%)`;
        }
      }
      break;
    }

    case 'indicator': {
      // e.g. RSI, EMA, VWAP
      const indicatorName = (cond.left || 'rsi').toLowerCase();
      currentVal = data[indicatorName] !== undefined ? data[indicatorName] : data.value;
      if (currentVal === null || currentVal === undefined || typeof currentVal !== 'number') {
        return { triggered: false, reason: 'missing_indicator_value' };
      }

      const threshold = Number(cond.right);
      if (cond.operator === 'threshold' || cond.operator === 'crosses_above') {
        if (cond.operator === 'threshold') {
          if (currentVal >= threshold) isConditionMet = true;
        } else {
          if (prevVal !== null && typeof prevVal === 'number') {
            if (prevVal <= threshold && currentVal > threshold) isConditionMet = true;
          } else if (alert.trigger?.trigger_immediately_if_true && currentVal > threshold) {
            isConditionMet = true;
          }
        }
        eventMessage = `${alert.symbol || 'Symbol'} ${indicatorName.toUpperCase()} reached ${currentVal.toFixed(2)} (threshold: ${threshold})`;
      } else if (cond.operator === 'crosses_below') {
        if (prevVal !== null && typeof prevVal === 'number') {
          if (prevVal >= threshold && currentVal < threshold) isConditionMet = true;
        } else if (alert.trigger?.trigger_immediately_if_true && currentVal < threshold) {
          isConditionMet = true;
        }
        eventMessage = `${alert.symbol || 'Symbol'} ${indicatorName.toUpperCase()} fell below ${threshold} (current: ${currentVal.toFixed(2)})`;
      }
      break;
    }

    case 'filing': {
      // e.g. 8-K, 10-K, Form 4
      const formType = (data.form_type || data.form || '').toUpperCase();
      const targetForm = String(cond.right || cond.left || '8-K').toUpperCase();
      const targetSymbol = alert.symbol ? alert.symbol.toUpperCase() : null;
      const dataSymbol = data.symbol ? data.symbol.toUpperCase() : null;

      if (!targetSymbol || dataSymbol === targetSymbol) {
        if (formType.includes(targetForm) || targetForm === 'ANY') {
          isConditionMet = true;
          currentVal = formType;
          thresholdVal = targetForm;
          eventMessage = `New ${formType} filing filed for ${dataSymbol || alert.symbol}`;
        }
      }
      break;
    }

    case 'news': {
      const headline = (data.headline || data.title || '').toLowerCase();
      const keyword = String(cond.right || cond.left || '').toLowerCase();
      const targetSymbol = alert.symbol ? alert.symbol.toUpperCase() : null;
      const dataSymbol = data.symbol ? data.symbol.toUpperCase() : null;

      if (!targetSymbol || dataSymbol === targetSymbol) {
        if (!keyword || headline.includes(keyword)) {
          isConditionMet = true;
          currentVal = data.headline || data.title;
          thresholdVal = keyword || 'any';
          eventMessage = `News alert for ${alert.symbol}: "${data.headline || data.title}"`;
        }
      }
      break;
    }

    case 'calendar': {
      // Calendar alert: lead_time check before event
      const eventTime = data.event_time ? new Date(data.event_time).getTime() : null;
      const leadMinutes = Number(cond.right || 30); // default 30 min
      if (eventTime) {
        const timeDiffMinutes = (eventTime - now.getTime()) / (60 * 1000);
        // If event is in the future and within the lead time window (e.g. 0 to leadMinutes)
        if (timeDiffMinutes >= 0 && timeDiffMinutes <= leadMinutes) {
          isConditionMet = true;
          currentVal = Math.round(timeDiffMinutes);
          thresholdVal = leadMinutes;
          eventMessage = `Calendar Alert: ${data.event || cond.left} is in ${Math.round(timeDiffMinutes)} minutes`;
        }
      }
      break;
    }

    case 'position_risk': {
      // Unrealized PnL or Stop Proximity
      const pnlPct = data.unrealized_pnl_percent !== undefined
        ? data.unrealized_pnl_percent
        : data.pnl_percent;
      if (typeof pnlPct === 'number') {
        const threshold = Number(cond.right || -2);
        currentVal = pnlPct;
        thresholdVal = threshold;
        if (threshold < 0 ? pnlPct <= threshold : pnlPct >= threshold) {
          isConditionMet = true;
          eventMessage = `Position Risk Alert: ${alert.symbol || data.symbol} position unrealized P&L is ${pnlPct.toFixed(2)}% (threshold: ${threshold}%)`;
        }
      }
      break;
    }

    case 'data_health': {
      if (data.is_stale || data.service_down || data.error) {
        isConditionMet = true;
        currentVal = data.error || 'stale';
        eventMessage = `Data Health Alert: ${data.message || 'Service interruption or stale quote detected'}`;
      }
      break;
    }

    default:
      break;
  }

  // Update last evaluated value cache
  if (currentVal !== null) {
    lastEvaluatedValues.set(alert.alert_id, currentVal);
  }
  alert.last_evaluated_at = nowIso;

  if (!isConditionMet) {
    return { triggered: false, reason: 'condition_not_met' };
  }

  // 7. Deduplication Check
  const eventSignature = `${alert.alert_id}:${data.id || data.accessionNumber || currentVal || nowIso.slice(0, 16)}`;
  if (triggeredEventSignatures.has(eventSignature)) {
    return { triggered: false, reason: 'duplicate_event' };
  }
  triggeredEventSignatures.add(eventSignature);

  // 8. Construct Trigger Event
  const severity = determineSeverity(alert, data);
  const triggerEvent = {
    event: 'alert.triggered',
    alert_id: alert.alert_id,
    alert_name: alert.name,
    symbol: alert.symbol,
    severity,
    message: eventMessage || `${alert.name} triggered`,
    value: currentVal,
    threshold: thresholdVal,
    source: data.source || `feed:${alert.type}:${alert.symbol || 'desk'}`,
    as_of: nowIso,
    actions: alert.actions
  };

  const check = validateAlertTriggerEvent(triggerEvent);
  if (!check.valid) {
    console.error('Trigger event contract error:', check.errors);
  }

  // 9. Update Alert State
  alert.last_triggered_at = nowIso;
  alert.trigger_count = (alert.trigger_count || 0) + 1;
  alert.updated_at = nowIso;

  if (alert.trigger?.once) {
    alert.status = 'triggered';
  }

  // 10. Record in Evaluation History
  evaluationHistory.push({
    alert_id: alert.alert_id,
    timestamp: nowIso,
    event: triggerEvent
  });

  return {
    triggered: true,
    event: triggerEvent
  };
}

/**
 * Resets evaluation history and deduplication caches (useful for testing)
 */
export function clearEvaluatorCaches() {
  evaluationHistory.length = 0;
  triggeredEventSignatures.clear();
  lastEvaluatedValues.clear();
}
