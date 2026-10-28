import React, { useState, useEffect, useCallback } from 'react';

export default function AlertManagerView({ onSendToChart, onNotify, onSpeak }) {
  const [activeSubTab, setActiveSubTab] = useState('alerts'); // 'alerts' | 'routines' | 'events'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'paused' | 'triggered' | 'expired'
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [desktopPerm, setDesktopPerm] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');
  const [soundEnabled, setSoundEnabled] = useState(false);

  // New alert form state
  const [formSymbol, setFormSymbol] = useState('NVDA');
  const [formType, setFormType] = useState('price');
  const [formOperator, setFormOperator] = useState('crosses_above');
  const [formThreshold, setFormThreshold] = useState('150');
  const [formName, setFormName] = useState('NVDA breaks above 150');
  const [formOnce, setFormOnce] = useState(true);
  const [formCooldown, setFormCooldown] = useState(30);

  // Fetch alerts from backend
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch routines from backend
  const fetchRoutines = useCallback(async () => {
    try {
      const res = await fetch('/api/routines');
      if (res.ok) {
        const data = await res.json();
        setRoutines(data.routines || []);
      }
    } catch (e) {
      console.error('Error fetching routines:', e);
    }
  }, []);

  // Fetch event log
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/events?limit=50');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.error('Error fetching events:', e);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchRoutines();
    fetchEvents();
    const interval = setInterval(() => {
      fetchAlerts();
      fetchEvents();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts, fetchRoutines, fetchEvents]);

  // Request desktop notification permission
  const handleRequestDesktopPermission = async () => {
    if (!('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser environment.');
      return;
    }
    const perm = await Notification.requestPermission();
    setDesktopPerm(perm);
    if (perm === 'granted') {
      new Notification('F.R.I.D.A.Y. Watchtower', {
        body: 'Desktop notifications are now armed and active.',
        icon: '/favicon.ico'
      });
      if (onNotify) onNotify('RELAY', 'Desktop notifications enabled.', 'var(--neon-green)');
    }
  };

  // Toggle routine enabled state
  const handleToggleRoutine = async (routineId, currentlyEnabled) => {
    try {
      const res = await fetch('/api/routines/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          routine_id: routineId,
          updates: { enabled: !currentlyEnabled }
        })
      });
      if (res.ok) {
        fetchRoutines();
        if (onNotify) onNotify('RELAY', `Routine ${currentlyEnabled ? 'disabled' : 'enabled'}.`, 'var(--neon-cyan)');
      }
    } catch (err) {
      console.error('Error toggling routine:', err);
    }
  };

  // Run routine immediately
  const handleRunRoutineNow = async (routineId, name) => {
    try {
      if (onNotify) onNotify('RELAY', `Dispatching routine: ${name}...`, 'var(--neon-cyan)');
      const res = await fetch('/api/routines/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', routine_id: routineId })
      });
      if (res.ok) {
        const data = await res.json();
        fetchRoutines();
        fetchEvents();
        if (data.result?.skipped) {
          if (onNotify) onNotify('RELAY', `Routine skipped: overlap prevented.`, '#eab308');
        } else {
          if (onNotify) onNotify('RELAY', `Routine "${name}" executed successfully.`, 'var(--neon-green)');
          if (onSpeak) onSpeak(`Routine ${name} execution complete.`);
        }
      }
    } catch (err) {
      console.error('Error running routine:', err);
    }
  };

  // Handle alert actions (pause, resume, delete)
  const handleAlertAction = async (action, alertId) => {
    try {
      const res = await fetch('/api/alerts/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, alert_id: alertId })
      });
      if (res.ok) {
        fetchAlerts();
        if (onNotify) onNotify('RELAY', `Alert ${action}d.`, 'var(--neon-cyan)');
      }
    } catch (err) {
      console.error(`Error performing ${action} on alert:`, err);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action) => {
    try {
      const res = await fetch('/api/alerts/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        fetchAlerts();
        if (onNotify) onNotify('RELAY', `Bulk ${action} applied to all alerts.`, 'var(--neon-cyan)');
      }
    } catch (err) {
      console.error(`Error performing bulk ${action}:`, err);
    }
  };

  // Evaluate single alert manually
  const handleEvaluateAlertNow = async (alert) => {
    try {
      const testPrice = alert.condition.right ? Number(alert.condition.right) + 1 : 155;
      const res = await fetch('/api/alerts/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          event_data: {
            symbol: alert.symbol || 'NVDA',
            price: testPrice,
            close: testPrice,
            form_type: '8-K',
            rsi: 74,
            source: 'manual:test-trigger'
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        fetchAlerts();
        fetchEvents();
        if (data.triggeredCount > 0) {
          if (onNotify) onNotify('RELAY', `Trigger test successful: ${data.triggered[0].message}`, 'var(--neon-green)');
          if (onSpeak) onSpeak(`Alert triggered: ${data.triggered[0].message}`);
        } else {
          if (onNotify) onNotify('RELAY', 'Evaluation completed: Condition not met under current test data.', 'var(--text-muted)');
        }
      }
    } catch (err) {
      console.error('Error evaluating alert:', err);
    }
  };

  // Create alert form submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formName || `${formSymbol} ${formOperator} ${formThreshold}`,
        symbol: formSymbol ? formSymbol.toUpperCase() : null,
        type: formType,
        condition: {
          operator: formOperator,
          left: formType === 'price' ? 'close' : formType === 'indicator' ? 'rsi' : 'form_type',
          right: isNaN(Number(formThreshold)) ? formThreshold : Number(formThreshold)
        },
        trigger: {
          once: formOnce,
          cooldown_minutes: Number(formCooldown) || 30,
          active_hours: {
            start: '09:30',
            end: '16:00',
            timezone: 'America/New_York'
          }
        },
        actions: {
          signal_log: true,
          hud_toast: true,
          sound: soundEnabled,
          desktop_notification: desktopPerm === 'granted',
          speak: false,
          request_sentinel_review: formType === 'position_risk' || formType === 'filing'
        }
      };

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchAlerts();
        if (onNotify) onNotify('RELAY', `Alert created: ${payload.name}`, 'var(--neon-green)');
      }
    } catch (err) {
      console.error('Error creating alert:', err);
    }
  };

  // Filtering
  const filteredAlerts = alerts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSym = a.symbol?.toLowerCase().includes(q);
      const matchName = a.name?.toLowerCase().includes(q);
      if (!matchSym && !matchName) return false;
    }
    return true;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(6, 11, 25, 0.85)',
      borderRadius: '6px',
      border: '1px solid rgba(0, 240, 255, 0.2)',
      padding: '16px',
      overflow: 'hidden',
      fontFamily: 'var(--font-hud, monospace)'
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
        paddingBottom: '12px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '2px',
            color: 'var(--neon-cyan, #00f0ff)',
            textShadow: '0 0 10px rgba(0, 240, 255, 0.5)'
          }}>
            RELAY · WATCHTOWER & ROUTINES
          </div>
          <span style={{
            fontSize: '10px',
            padding: '2px 8px',
            background: 'rgba(0, 240, 255, 0.1)',
            border: '1px solid var(--neon-cyan, #00f0ff)',
            borderRadius: '10px',
            color: 'var(--neon-cyan, #00f0ff)'
          }}>
            AGENT ONLINE
          </span>
        </div>

        {/* System Settings & Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Desktop Notification Button */}
          {desktopPerm === 'granted' ? (
            <span style={{ fontSize: '10px', color: 'var(--neon-green, #10b981)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ● DESKTOP ALERTS ACTIVE
            </span>
          ) : desktopPerm === 'denied' ? (
            <span style={{ fontSize: '10px', color: '#ef4444' }}>
              ✕ DESKTOP NOTIFICATIONS BLOCKED
            </span>
          ) : (
            <button
              onClick={handleRequestDesktopPermission}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#f8fafc',
                fontSize: '10px',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              🔔 ENABLE DESKTOP ALERTS
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: soundEnabled ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${soundEnabled ? 'var(--neon-cyan, #00f0ff)' : 'rgba(255, 255, 255, 0.2)'}`,
              color: soundEnabled ? 'var(--neon-cyan, #00f0ff)' : 'var(--text-muted, #94a3b8)',
              fontSize: '10px',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? '🔊 SOUND ON' : '🔇 SOUND MUTED'}
          </button>
        </div>
      </div>

      {/* Primary Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {[
          { id: 'alerts', label: `ALERTS (${alerts.length})` },
          { id: 'routines', label: `ROUTINES (${routines.length})` },
          { id: 'events', label: `TRIGGER LOG (${events.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              fontFamily: 'var(--font-hud, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1px',
              padding: '6px 16px',
              background: activeSubTab === tab.id ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              border: activeSubTab === tab.id ? '1px solid var(--neon-cyan, #00f0ff)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: activeSubTab === tab.id ? 'var(--neon-cyan, #00f0ff)' : 'var(--text-muted, #94a3b8)',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-PANEL 1: ALERTS */}
      {activeSubTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Controls & Filter Strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '12px',
            flexWrap: 'wrap'
          }}>
            {/* Status tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {['all', 'active', 'paused', 'triggered', 'expired'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    fontSize: '9.5px',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    background: statusFilter === st ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${statusFilter === st ? 'var(--neon-cyan, #00f0ff)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: statusFilter === st ? 'var(--neon-cyan, #00f0ff)' : 'var(--text-muted, #94a3b8)',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search and filters */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search symbol or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  fontSize: '10px',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  outline: 'none',
                  width: '180px'
                }}
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  fontSize: '10px',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  outline: 'none'
                }}
              >
                <option value="all">ALL TYPES</option>
                <option value="price">PRICE</option>
                <option value="indicator">INDICATOR</option>
                <option value="news">NEWS</option>
                <option value="filing">FILING</option>
                <option value="calendar">CALENDAR</option>
                <option value="position_risk">POSITION RISK</option>
                <option value="data_health">DATA HEALTH</option>
              </select>

              <button
                onClick={() => handleBulkAction('pause')}
                style={{
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid #eab308',
                  color: '#eab308',
                  fontSize: '10px',
                  padding: '4px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                ⏸ PAUSE ALL
              </button>

              <button
                onClick={() => handleBulkAction('resume')}
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid var(--neon-green, #10b981)',
                  color: 'var(--neon-green, #10b981)',
                  fontSize: '10px',
                  padding: '4px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                ▶ RESUME ALL
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: 'rgba(0, 240, 255, 0.2)',
                  border: '1px solid var(--neon-cyan, #00f0ff)',
                  color: 'var(--neon-cyan, #00f0ff)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                + NEW ALERT
              </button>
            </div>
          </div>

          {/* Alert Cards Grid */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)', fontSize: '12px' }}>
                {loading ? 'Querying Watchtower database...' : 'No alerts matching criteria. Click "+ NEW ALERT" or use voice command (e.g. "Alert me if NVDA breaks above 150").'}
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const statusColor = alert.status === 'active'
                  ? 'var(--neon-cyan, #00f0ff)'
                  : alert.status === 'paused'
                    ? '#eab308'
                    : alert.status === 'triggered'
                      ? 'var(--neon-green, #10b981)'
                      : '#64748b';

                return (
                  <div
                    key={alert.alert_id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: `1px solid ${alert.status === 'active' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '4px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      {/* Status indicator dot */}
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: statusColor,
                        boxShadow: alert.status === 'active' ? `0 0 6px ${statusColor}` : 'none'
                      }} />

                      {/* Main title & condition */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                            {alert.name}
                          </span>
                          {alert.symbol && (
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 6px',
                              background: 'rgba(0, 240, 255, 0.1)',
                              border: '1px solid rgba(0, 240, 255, 0.3)',
                              color: 'var(--neon-cyan, #00f0ff)',
                              borderRadius: '2px'
                            }}>
                              {alert.symbol}
                            </span>
                          )}
                          <span style={{
                            fontSize: '9px',
                            padding: '1px 6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted, #94a3b8)',
                            borderRadius: '2px',
                            textTransform: 'uppercase'
                          }}>
                            {alert.type}
                          </span>
                        </div>

                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #94a3b8)' }}>
                          Formula: <span style={{ color: '#cbd5e1' }}>{alert.condition.left} {alert.condition.operator} {alert.condition.right ?? '—'}</span>
                          {alert.trigger.cooldown_minutes ? ` · Cooldown: ${alert.trigger.cooldown_minutes}m` : ''}
                          {alert.trigger.once ? ' · One-shot' : ' · Recurring'}
                          {alert.trigger_count > 0 ? ` · Fired: ${alert.trigger_count}x` : ''}
                          {alert.last_triggered_at ? ` · Last: ${new Date(alert.last_triggered_at).toLocaleTimeString()}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {alert.symbol && onSendToChart && (
                        <button
                          onClick={() => onSendToChart(alert.symbol)}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: 'var(--text-muted, #94a3b8)',
                            fontSize: '9px',
                            padding: '3px 8px',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          CHART
                        </button>
                      )}

                      {alert.status === 'active' ? (
                        <button
                          onClick={() => handleAlertAction('pause', alert.alert_id)}
                          style={{
                            background: 'rgba(234, 179, 8, 0.1)',
                            border: '1px solid #eab308',
                            color: '#eab308',
                            fontSize: '9px',
                            padding: '3px 8px',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          PAUSE
                        </button>
                      ) : alert.status === 'paused' ? (
                        <button
                          onClick={() => handleAlertAction('resume', alert.alert_id)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid var(--neon-green, #10b981)',
                            color: 'var(--neon-green, #10b981)',
                            fontSize: '9px',
                            padding: '3px 8px',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          RESUME
                        </button>
                      ) : null}

                      <button
                        onClick={() => handleEvaluateAlertNow(alert)}
                        style={{
                          background: 'rgba(0, 240, 255, 0.1)',
                          border: '1px solid var(--neon-cyan, #00f0ff)',
                          color: 'var(--neon-cyan, #00f0ff)',
                          fontSize: '9px',
                          padding: '3px 8px',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        TEST EVAL
                      </button>

                      <button
                        onClick={() => handleAlertAction('delete', alert.alert_id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#ef4444',
                          fontSize: '9px',
                          padding: '3px 8px',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-PANEL 2: ROUTINES */}
      {activeSubTab === 'routines' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
            Scheduled desk routines execute timezone-aware workflows with overlap prevention. All routines run on America/New_York market time.
          </div>

          {routines.map(routine => (
            <div
              key={routine.routine_id}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: routine.enabled ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                    {routine.name}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: routine.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: routine.enabled ? 'var(--neon-green, #10b981)' : '#64748b',
                    border: `1px solid ${routine.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
                  }}>
                    {routine.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted, #94a3b8)' }}>
                    Workflow: {routine.workflow}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', lineHeight: '1.4' }}>
                  Schedule: <span style={{ color: '#cbd5e1' }}>{routine.schedule.time} ET ({routine.schedule.type})</span>
                  {' · '}Cron: <code style={{ color: 'var(--neon-cyan, #00f0ff)' }}>{routine.schedule.cron}</code>
                  {' · '}Timezone: <span style={{ color: '#cbd5e1' }}>{routine.schedule.timezone}</span>
                  {routine.last_run_at && (
                    <span>{' · '}Last Run: {new Date(routine.last_run_at).toLocaleString()}</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleToggleRoutine(routine.routine_id, routine.enabled)}
                  style={{
                    background: routine.enabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    border: `1px solid ${routine.enabled ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                    color: routine.enabled ? '#ef4444' : 'var(--neon-green, #10b981)',
                    fontSize: '10px',
                    padding: '4px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  {routine.enabled ? 'DISABLE' : 'ENABLE'}
                </button>

                <button
                  onClick={() => handleRunRoutineNow(routine.routine_id, routine.name)}
                  style={{
                    background: 'rgba(0, 240, 255, 0.2)',
                    border: '1px solid var(--neon-cyan, #00f0ff)',
                    color: 'var(--neon-cyan, #00f0ff)',
                    fontSize: '10px',
                    padding: '4px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ RUN NOW
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-PANEL 3: EVENT LOG */}
      {activeSubTab === 'events' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted, #94a3b8)', fontSize: '11px' }}>
              No alert triggers recorded yet.
            </div>
          ) : (
            events.map(ev => {
              const sevColor = ev.severity === 'critical' ? '#ef4444' : ev.severity === 'important' ? '#eab308' : 'var(--neon-cyan, #00f0ff)';
              return (
                <div
                  key={ev.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderLeft: `3px solid ${sevColor}`,
                    padding: '6px 12px',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px'
                  }}
                >
                  <div>
                    <span style={{ color: sevColor, fontWeight: 700, marginRight: '8px', textTransform: 'uppercase' }}>
                      [{ev.severity}]
                    </span>
                    <span style={{ color: '#f8fafc', fontWeight: 600, marginRight: '8px' }}>
                      {ev.message}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '10px' }}>
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick Alert Creation Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <form
            onSubmit={handleCreateSubmit}
            style={{
              background: '#091122',
              border: '1px solid var(--neon-cyan, #00f0ff)',
              borderRadius: '6px',
              padding: '20px 24px',
              width: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontFamily: 'var(--font-hud, monospace)'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--neon-cyan, #00f0ff)', letterSpacing: '1px' }}>
              ARM NEW WATCHTOWER ALERT
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                ALERT NAME
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                style={{ width: '100%', background: '#030712', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '3px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  SYMBOL (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={formSymbol}
                  onChange={e => setFormSymbol(e.target.value)}
                  style={{ width: '100%', background: '#030712', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '3px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  TYPE
                </label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  style={{ width: '100%', background: '#030712', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '3px' }}
                >
                  <option value="price">PRICE</option>
                  <option value="indicator">INDICATOR</option>
                  <option value="filing">FILING</option>
                  <option value="news">NEWS</option>
                  <option value="calendar">CALENDAR</option>
                  <option value="position_risk">POSITION RISK</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  OPERATOR
                </label>
                <select
                  value={formOperator}
                  onChange={e => setFormOperator(e.target.value)}
                  style={{ width: '100%', background: '#030712', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '3px' }}
                >
                  <option value="crosses_above">CROSSES ABOVE</option>
                  <option value="crosses_below">CROSSES BELOW</option>
                  <option value="equals">EQUALS</option>
                  <option value="percent_change">PERCENT CHANGE</option>
                  <option value="threshold">THRESHOLD</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  THRESHOLD / VALUE
                </label>
                <input
                  type="text"
                  value={formThreshold}
                  onChange={e => setFormThreshold(e.target.value)}
                  style={{ width: '100%', background: '#030712', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '3px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <label style={{ fontSize: '10px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  checked={formOnce}
                  onChange={e => setFormOnce(e.target.checked)}
                />
                ONE-SHOT ALERT
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)' }}>COOLDOWN (MIN):</span>
                <input
                  type="number"
                  value={formCooldown}
                  onChange={e => setFormCooldown(e.target.value)}
                  style={{ width: '50px', background: '#030712', border: '1px solid #334155', color: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '10px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '6px 14px', borderRadius: '3px', cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button
                type="submit"
                style={{ background: 'rgba(0, 240, 255, 0.25)', border: '1px solid var(--neon-cyan, #00f0ff)', color: 'var(--neon-cyan, #00f0ff)', padding: '6px 16px', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
              >
                ARM ALERT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
