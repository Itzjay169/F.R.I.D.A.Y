import { DEFAULT_RISK_CONFIG } from '../../shared/config.js';

/**
 * Singleton In-Memory State for the Portfolio Kill Switch
 */
class KillSwitchManager {
  constructor() {
    this.state = {
      active: false,
      activated_at: null,
      activated_by: 'none',
      reason: null,
      trigger_metric: null,
      trigger_value: null,
      limit: null,
      new_entries_blocked: true,
      existing_stops_active: true,
      existing_targets_active: true,
      risk_reduction_proposed: false,
      deactivation_requires: 'explicit_user_confirmation'
    };
    this.history = [];
  }

  /**
   * Returns current Kill Switch state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Activates the Kill Switch
   * Can be triggered by user command or automated breach detection
   */
  activate({ activated_by = 'user', reason = 'Manual user override', trigger_metric = null, trigger_value = null, limit = null, propose_risk_reduction = true } = {}) {
    const timestamp = new Date().toISOString();
    this.state = {
      active: true,
      activated_at: timestamp,
      activated_by,
      reason,
      trigger_metric,
      trigger_value,
      limit,
      new_entries_blocked: true,
      existing_stops_active: true,
      existing_targets_active: true,
      risk_reduction_proposed: Boolean(propose_risk_reduction),
      deactivation_requires: 'explicit_user_confirmation'
    };

    const entry = {
      action: 'ACTIVATED',
      timestamp,
      activated_by,
      reason,
      trigger_metric,
      trigger_value,
      limit
    };
    this.history.unshift(entry);

    return { success: true, state: { ...this.state } };
  }

  /**
   * Deactivates the Kill Switch
   * Strict rule: Requires an explicit human user reason and confirmation!
   */
  deactivate({ user_reason, confirmed = false } = {}) {
    if (!confirmed) {
      return {
        success: false,
        error: 'Deactivation failed: Explicit human confirmation is strictly mandatory.'
      };
    }
    if (!user_reason || String(user_reason).trim().length < 4) {
      return {
        success: false,
        error: 'Deactivation failed: A documented rationale (at least 4 characters) must be provided for audit journaling.'
      };
    }

    const timestamp = new Date().toISOString();
    const deactivationRecord = {
      action: 'DEACTIVATED',
      timestamp,
      deactivated_by: 'user',
      reason: String(user_reason).trim(),
      previous_activation_reason: this.state.reason
    };
    this.history.unshift(deactivationRecord);

    this.state = {
      active: false,
      activated_at: null,
      activated_by: 'none',
      reason: null,
      trigger_metric: null,
      trigger_value: null,
      limit: null,
      new_entries_blocked: true,
      existing_stops_active: true,
      existing_targets_active: true,
      risk_reduction_proposed: false,
      deactivation_requires: 'explicit_user_confirmation'
    };

    return {
      success: true,
      message: 'Kill switch deactivated. Normal paper operations resumed.',
      audit: deactivationRecord,
      state: { ...this.state }
    };
  }

  /**
   * Automatically evaluates whether account conditions mandate automatic kill-switch activation
   */
  evaluateAutoTriggers(accountSnapshot = {}, heatData = {}, config = DEFAULT_RISK_CONFIG) {
    const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
    if (!cfg.kill_switch?.enabled) return { triggered: false };

    // 1. Daily loss breach
    if (cfg.kill_switch.auto_activate_on_daily_loss) {
      const dailyLossLimitDollars = (cfg.daily_loss_limit_percent / 100) * (accountSnapshot.current_equity || 1604199);
      const dailyPnl = Number(accountSnapshot.daily_pnl || 0);
      if (dailyPnl < 0 && Math.abs(dailyPnl) >= dailyLossLimitDollars) {
        if (!this.state.active) {
          this.activate({
            activated_by: 'system',
            reason: `Daily loss limit breached: -$${Math.abs(dailyPnl).toLocaleString()} loss exceeded limit of -$${dailyLossLimitDollars.toLocaleString()} (${cfg.daily_loss_limit_percent}%).`,
            trigger_metric: 'daily_pnl_percent',
            trigger_value: accountSnapshot.daily_pnl_percent,
            limit: -cfg.daily_loss_limit_percent
          });
        }
        return { triggered: true, reason: this.state.reason };
      }
    }

    // 2. Max drawdown breach
    if (cfg.kill_switch.auto_activate_on_max_drawdown) {
      const drawdownPct = Number(accountSnapshot.current_drawdown_percent || 0);
      if (drawdownPct >= cfg.max_drawdown_percent) {
        if (!this.state.active) {
          this.activate({
            activated_by: 'system',
            reason: `Maximum portfolio drawdown breached: ${drawdownPct}% exceeded drawdown limit of ${cfg.max_drawdown_percent}%.`,
            trigger_metric: 'current_drawdown_percent',
            trigger_value: drawdownPct,
            limit: cfg.max_drawdown_percent
          });
        }
        return { triggered: true, reason: this.state.reason };
      }
    }

    // 3. Portfolio heat hard breach
    if (cfg.kill_switch.auto_activate_on_heat_breach) {
      const heatPct = Number(heatData.heat_percent_current_equity || 0);
      if (heatPct > cfg.max_portfolio_heat_percent) {
        if (!this.state.active) {
          this.activate({
            activated_by: 'system',
            reason: `Portfolio heat hard block breached: ${heatPct}% aggregate heat exceeded maximum allowable limit of ${cfg.max_portfolio_heat_percent}%.`,
            trigger_metric: 'heat_percent_current_equity',
            trigger_value: heatPct,
            limit: cfg.max_portfolio_heat_percent
          });
        }
        return { triggered: true, reason: this.state.reason };
      }
    }

    return { triggered: false };
  }

  /**
   * Resets state for unit testing
   */
  _resetForTesting() {
    this.state = {
      active: false,
      activated_at: null,
      activated_by: 'none',
      reason: null,
      trigger_metric: null,
      trigger_value: null,
      limit: null,
      new_entries_blocked: true,
      existing_stops_active: true,
      existing_targets_active: true,
      risk_reduction_proposed: false,
      deactivation_requires: 'explicit_user_confirmation'
    };
    this.history = [];
  }
}

export const killSwitchManager = new KillSwitchManager();
