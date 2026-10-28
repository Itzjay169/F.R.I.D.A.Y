import React, { useState, useEffect, useCallback } from 'react';

export default function PortfolioRiskView({ onSendToChart, onNotify, onSpeak }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('market_down_2_percent');
  const [stressResult, setStressResult] = useState(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [reductionPlan, setReductionPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'positions' | 'correlation' | 'stress' | 'reduction'

  // Fetch complete risk telemetry from API
  const refreshRiskData = useCallback(async () => {
    try {
      const res = await fetch('/api/risk/portfolio');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load risk portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRiskData();
    const interval = setInterval(refreshRiskData, 5000);
    return () => clearInterval(interval);
  }, [refreshRiskData]);

  // Run stress test
  const executeStressTest = async (scenario) => {
    setStressLoading(true);
    try {
      const res = await fetch('/api/risk/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      if (res.ok) {
        const json = await res.json();
        setStressResult(json.result);
      }
    } catch (err) {
      console.error('Stress test failed:', err);
    } finally {
      setStressLoading(false);
    }
  };

  // Generate risk reduction plan
  const fetchReductionPlan = async (targetPct = 30, mode = 'defensive') => {
    setPlanLoading(true);
    try {
      const res = await fetch('/api/risk/reduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetReductionPercent: targetPct, mode })
      });
      if (res.ok) {
        const json = await res.json();
        setReductionPlan(json.plan);
      }
    } catch (err) {
      console.error('Reduction plan failed:', err);
    } finally {
      setPlanLoading(false);
    }
  };

  // Toggle kill switch
  const handleToggleKillSwitch = async () => {
    if (!data?.kill_switch?.active) {
      // Activate immediately
      try {
        const res = await fetch('/api/risk/kill-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'activate', reason: 'User manual override from HUD' })
        });
        if (res.ok) {
          const json = await res.json();
          setData(prev => ({ ...prev, kill_switch: json.state }));
          onNotify?.('SENTINEL-X', '🚨 KILL SWITCH ACTIVATED: New entries blocked.', 'var(--neon-red)');
          onSpeak?.('Portfolio kill switch activated. All new paper trade entries are now blocked. Existing stops remain active.');
        }
      } catch (err) {
        console.error('Failed to activate kill switch:', err);
      }
    } else {
      setShowDeactivateModal(true);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateReason || deactivateReason.trim().length < 4) return;
    try {
      const res = await fetch('/api/risk/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', reason: deactivateReason, confirmed: true })
      });
      if (res.ok) {
        const json = await res.json();
        setData(prev => ({ ...prev, kill_switch: json.state }));
        setShowDeactivateModal(false);
        setDeactivateReason('');
        onNotify?.('SENTINEL-X', 'Kill switch deactivated. Normal paper operations resumed.', 'var(--neon-green)');
        onSpeak?.('Kill switch deactivated. Normal operations resumed.');
      }
    } catch (err) {
      console.error('Failed to deactivate kill switch:', err);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)' }}>
        INITIALIZING SENTINEL-X PORTFOLIO RISK AUDIT...
      </div>
    );
  }

  const { snapshot, heat, budget, kill_switch } = data;
  const isKillSwitchActive = kill_switch?.active;

  // Determine Risk State Color
  const stateColors = {
    GREEN: '#10b981',
    YELLOW: '#eab308',
    ORANGE: '#f97316',
    RED: '#ef4444',
    BLACK: '#000000'
  };
  const currentStateColor = stateColors[budget.risk_state] || '#10b981';

  // Heat color coding: < 4% green, 4-6% yellow, >= 6% red
  const heatColor = heat.heat_percent_current_equity >= heat.hard_block_percent
    ? 'var(--neon-red)'
    : (heat.heat_percent_current_equity >= heat.soft_warning_percent ? '#eab308' : 'var(--neon-green)');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '12px',
      color: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* 1. TOP HEADER & KILL SWITCH BANNER */}
      <div style={{
        background: isKillSwitchActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(10, 18, 28, 0.85)',
        border: isKillSwitchActive ? '1px solid var(--neon-red)' : '1px solid var(--border-cyan)',
        borderRadius: '4px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: isKillSwitchActive ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '14px',
                fontWeight: 800,
                letterSpacing: '1.5px',
                color: isKillSwitchActive ? 'var(--neon-red)' : 'var(--neon-cyan)'
              }}>
                SENTINEL-X · PORTFOLIO RISK DESK
              </span>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-data)',
                padding: '2px 6px',
                borderRadius: '2px',
                background: currentStateColor,
                color: budget.risk_state === 'BLACK' ? '#ef4444' : '#000000',
                fontWeight: 700,
                border: budget.risk_state === 'BLACK' ? '1px solid #ef4444' : 'none'
              }}>
                STATE: {budget.risk_state}
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', marginTop: '2px' }}>
              {budget.reason} · Source: {snapshot.source} · As of: {new Date(snapshot.as_of).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Emergency Kill Switch Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleToggleKillSwitch}
            style={{
              padding: '6px 14px',
              fontFamily: 'var(--font-hud)',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '1px',
              cursor: 'pointer',
              borderRadius: '2px',
              background: isKillSwitchActive ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--neon-red)',
              color: isKillSwitchActive ? '#ffffff' : 'var(--neon-red)',
              boxShadow: isKillSwitchActive ? '0 0 15px rgba(239, 68, 68, 0.8)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {isKillSwitchActive ? '🚨 KILL SWITCH ACTIVE (CLICK TO DISARM)' : '🛡️ ACTIVATE KILL SWITCH'}
          </button>
        </div>
      </div>

      {/* 2. SUB-TAB SELECTOR */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(0, 240, 255, 0.2)', paddingBottom: '6px' }}>
        {[
          { id: 'overview', label: 'RISK OVERVIEW' },
          { id: 'positions', label: `OPEN POSITIONS (${snapshot.open_positions.length})` },
          { id: 'correlation', label: 'CORRELATION & CLUSTERS' },
          { id: 'stress', label: 'SCENARIO STRESS TEST' },
          { id: 'reduction', label: 'DEFENSIVE PLANNER' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '10px',
              letterSpacing: '0.8px',
              padding: '4px 10px',
              background: activeSubTab === tab.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
              border: activeSubTab === tab.id ? '1px solid var(--border-cyan-bright)' : '1px solid transparent',
              color: activeSubTab === tab.id ? '#ffffff' : 'var(--text-muted)',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. MAIN TAB CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {/* SUBTAB: OVERVIEW */}
        {activeSubTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Top 4 Core Metric Gauges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {/* Gauge 1: Portfolio Heat */}
              <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: `1px solid ${heatColor}`, borderRadius: '4px', padding: '12px' }}>
                <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-hud)', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                  PORTFOLIO HEAT (STOP RISK)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: heatColor, fontFamily: 'var(--font-data)', margin: '4px 0' }}>
                  {heat.heat_percent_current_equity}%
                </div>
                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-data)', color: '#ffffff' }}>
                  ${heat.total_heat_dollars.toLocaleString()} / ${(snapshot.current_equity * (heat.heat_limit_percent / 100)).toFixed(0)} limit
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Soft Warning: {heat.soft_warning_percent}% · Hard Block: {heat.hard_block_percent}%
                </div>
              </div>

              {/* Gauge 2: Daily Risk Budget */}
              <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-hud)', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                  DAILY RISK BUDGET
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: budget.daily_budget_remaining <= 0 ? 'var(--neon-red)' : 'var(--neon-cyan)', fontFamily: 'var(--font-data)', margin: '4px 0' }}>
                  ${budget.daily_budget_remaining.toLocaleString()}
                </div>
                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-data)', color: '#ffffff' }}>
                  ${budget.daily_risk_used.toLocaleString()} used of ${budget.daily_budget_dollars.toLocaleString()} ({budget.daily_budget_percent}%)
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Realized today: -${budget.daily_loss_realized.toLocaleString()}
                </div>
              </div>

              {/* Gauge 3: Weekly Risk Budget */}
              <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-hud)', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                  WEEKLY RISK BUDGET
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)', margin: '4px 0' }}>
                  ${budget.weekly_budget_remaining.toLocaleString()}
                </div>
                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-data)', color: '#ffffff' }}>
                  ${budget.weekly_risk_used.toLocaleString()} used of ${budget.weekly_budget_dollars.toLocaleString()} ({budget.weekly_budget_percent}%)
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Weekly limit: {budget.weekly_budget_percent}% of equity
                </div>
              </div>

              {/* Gauge 4: Peak Equity & Drawdown */}
              <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-hud)', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                  DRAWDOWN STATUS
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: snapshot.current_drawdown_percent > 8 ? 'var(--neon-red)' : 'var(--neon-green)', fontFamily: 'var(--font-data)', margin: '4px 0' }}>
                  {snapshot.current_drawdown_percent.toFixed(2)}%
                </div>
                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-data)', color: '#ffffff' }}>
                  -${snapshot.current_drawdown.toLocaleString()} from peak of ${snapshot.peak_equity.toLocaleString()}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Max Allowable Drawdown: {snapshot.max_drawdown_percent}%
                </div>
              </div>
            </div>

            {/* Account Capital & Exposure Details */}
            <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)', letterSpacing: '1px', marginBottom: '8px' }}>
                ACCOUNT CAPITAL & EXPOSURE ALLOCATION
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-data)' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>CURRENT EQUITY</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>${snapshot.current_equity.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>AVAILABLE CASH</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>${snapshot.cash.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>GROSS EXPOSURE</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>${snapshot.gross_exposure.toLocaleString()} ({((snapshot.gross_exposure / snapshot.current_equity) * 100).toFixed(1)}%)</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>NET EXPOSURE</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>${snapshot.net_exposure.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>LONG / SHORT</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>${snapshot.long_exposure.toLocaleString()} / ${snapshot.short_exposure.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>LEVERAGE</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{snapshot.leverage}x</div>
                </div>
              </div>
            </div>

            {/* Sector Heat Bars */}
            <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)', letterSpacing: '1px' }}>
                  SECTOR HEAT ALLOCATION (LIMIT: 3.0% PER SECTOR)
                </span>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                  Max 3.0% of equity ($48,125)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(heat.heat_by_sector).map(([sec, amount]) => {
                  const pct = ((amount / snapshot.current_equity) * 100);
                  const isOver = pct > 3.0;
                  return (
                    <div key={sec} style={{ fontSize: '11px', fontFamily: 'var(--font-data)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span>{sec}</span>
                        <span style={{ color: isOver ? 'var(--neon-red)' : 'var(--neon-cyan)' }}>
                          ${amount.toLocaleString()} ({pct.toFixed(2)}%)
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (pct / 3.0) * 100)}%`,
                          background: isOver ? 'var(--neon-red)' : 'var(--neon-cyan)',
                          borderRadius: '3px'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB: OPEN POSITIONS */}
        {activeSubTab === 'positions' && (
          <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-data)' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 240, 255, 0.08)', color: 'var(--neon-cyan)', textAlign: 'left', borderBottom: '1px solid var(--border-cyan)' }}>
                  <th style={{ padding: '8px' }}>SYMBOL</th>
                  <th style={{ padding: '8px' }}>DIR</th>
                  <th style={{ padding: '8px' }}>QTY</th>
                  <th style={{ padding: '8px' }}>ENTRY</th>
                  <th style={{ padding: '8px' }}>CURRENT</th>
                  <th style={{ padding: '8px' }}>STOP</th>
                  <th style={{ padding: '8px' }}>TARGET</th>
                  <th style={{ padding: '8px' }}>STOP RISK ($)</th>
                  <th style={{ padding: '8px' }}>RISK (% EQ)</th>
                  <th style={{ padding: '8px' }}>UNREALIZED</th>
                  <th style={{ padding: '8px' }}>SECTOR / THEME</th>
                  <th style={{ padding: '8px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.open_positions.map((p) => {
                  const isLong = p.direction === 'long';
                  return (
                    <tr key={p.symbol} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{p.symbol}</td>
                      <td style={{ padding: '8px', color: isLong ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                        {p.direction.toUpperCase()}
                      </td>
                      <td style={{ padding: '8px' }}>{p.quantity}</td>
                      <td style={{ padding: '8px' }}>${p.entry.toFixed(2)}</td>
                      <td style={{ padding: '8px' }}>${p.current_price.toFixed(2)}</td>
                      <td style={{ padding: '8px', color: 'var(--neon-red)' }}>${p.stop.toFixed(2)}</td>
                      <td style={{ padding: '8px', color: 'var(--neon-green)' }}>{p.target ? `$${p.target.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '8px', fontWeight: 700, color: p.risk_percent_equity > 2.0 ? 'var(--neon-red)' : '#ffffff' }}>
                        ${p.initial_risk.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px' }}>{p.risk_percent_equity}%</td>
                      <td style={{ padding: '8px', color: p.unrealized_pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                        {p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                        {p.sector} · {p.theme}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button
                          onClick={() => onSendToChart?.(p.symbol)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '9px',
                            background: 'rgba(0, 240, 255, 0.1)',
                            border: '1px solid var(--border-cyan)',
                            color: 'var(--neon-cyan)',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          CHART
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB: CORRELATION & CLUSTERS */}
        {activeSubTab === 'correlation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Disclaimer Alert Banner */}
            <div style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '8px 12px', fontSize: '10.5px', fontFamily: 'var(--font-data)' }}>
              ℹ️ <strong>STATISTICAL ESTIMATE:</strong> Estimated from historical rolling 60-day daily returns. Correlations can shift abruptly during stress regimes.
            </div>

            {/* Correlated Clusters */}
            <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)', letterSpacing: '1px', marginBottom: '8px' }}>
                DETECTED CORRELATED CLUSTERS (CLUSTER LIMIT: 4.0% HEAT)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {snapshot.open_positions.length >= 2 ? (
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--neon-cyan)' }}>Semiconductors & AI Hardware</span>
                      <span style={{ fontSize: '9.5px', color: '#eab308', background: 'rgba(234, 179, 8, 0.15)', padding: '2px 6px', borderRadius: '2px' }}>
                        CORR: 0.82
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Members: NVDA, AMD, SMCI · Factor: AI Hardware / Capex
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-data)' }}>
                      Combined Heat: <strong>$2,500.00 (1.56%)</strong> · Dominant: LONG
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    Fewer than 2 open positions. Cluster detection requires multiple active assets.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB: SCENARIO STRESS TEST */}
        {activeSubTab === 'stress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)', letterSpacing: '1px' }}>
                  SELECT SCENARIO:
                </span>
                <select
                  value={selectedScenario}
                  onChange={(e) => {
                    setSelectedScenario(e.target.value);
                    executeStressTest(e.target.value);
                  }}
                  style={{
                    background: '#0a121c',
                    border: '1px solid var(--border-cyan)',
                    color: '#ffffff',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-data)',
                    borderRadius: '2px'
                  }}
                >
                  <option value="market_down_1_percent">Market Down 1%</option>
                  <option value="market_down_2_percent">Market Down 2%</option>
                  <option value="market_down_5_percent">Market Down 5% (Severe Correction)</option>
                  <option value="market_down_10_percent">Market Down 10% (Flash Crash)</option>
                  <option value="tech_down_5_percent">Tech Sector Down 5%</option>
                  <option value="semiconductors_down_5_percent">Semiconductors Down 5%</option>
                  <option value="crypto_down_10_percent">Crypto Down 10%</option>
                  <option value="vix_spike_25_percent">VIX Spike +25% (Volatility Shock)</option>
                  <option value="liquidity_shock">Liquidity Shock (Widened Spreads)</option>
                  <option value="gap_through_stop">Gap Through Stop (-3% Overnight Gap)</option>
                </select>
                <button
                  onClick={() => executeStressTest(selectedScenario)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(0, 240, 255, 0.2)',
                    border: '1px solid var(--neon-cyan)',
                    color: 'var(--neon-cyan)',
                    fontSize: '10px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  {stressLoading ? 'SIMULATING...' : 'RUN STRESS SIMULATION'}
                </button>
              </div>

              {stressResult && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-data)',
                      color: stressResult.estimated_portfolio_pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'
                    }}>
                      PROJECTED IMPACT: {stressResult.estimated_portfolio_pnl >= 0 ? '+' : ''}${stressResult.estimated_portfolio_pnl.toLocaleString()} ({stressResult.estimated_portfolio_pnl_percent}%)
                    </span>
                    <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--neon-red)', color: 'var(--neon-red)', padding: '2px 6px', borderRadius: '2px' }}>
                      MODEL-ESTIMATED (NOT A PREDICTION)
                    </span>
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                    <strong>Assumptions:</strong> {stressResult.assumptions.join(' · ')}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                    <strong>Limitations:</strong> {stressResult.limitations.join(' · ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB: DEFENSIVE PLANNER */}
        {activeSubTab === 'reduction' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(10, 18, 28, 0.8)', border: '1px solid var(--border-cyan)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)', letterSpacing: '1px' }}>
                  DEFENSIVE RISK REDUCTION RECOMMENDATIONS
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => fetchReductionPlan(30, 'defensive')}
                    style={{ padding: '4px 8px', fontSize: '9.5px', background: 'rgba(0, 240, 255, 0.1)', border: '1px solid var(--border-cyan)', color: 'var(--neon-cyan)', borderRadius: '2px', cursor: 'pointer' }}
                  >
                    REDUCE RISK BY 30%
                  </button>
                  <button
                    onClick={() => fetchReductionPlan(50, 'cut_highest')}
                    style={{ padding: '4px 8px', fontSize: '9.5px', background: 'rgba(0, 240, 255, 0.1)', border: '1px solid var(--border-cyan)', color: 'var(--neon-cyan)', borderRadius: '2px', cursor: 'pointer' }}
                  >
                    CUT HIGHEST RISK
                  </button>
                </div>
              </div>

              {reductionPlan && (
                <div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', marginBottom: '8px' }}>
                    Current Heat: ${reductionPlan.current_heat.toLocaleString()} ➔ Projected: ${reductionPlan.projected_heat.toLocaleString()} (Saves ${reductionPlan.risk_saved_dollars.toLocaleString()})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {reductionPlan.actions.map((act, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', padding: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, color: 'var(--neon-cyan)' }}>
                            {act.action.toUpperCase()}: {act.symbol}
                          </span>
                          <span style={{ color: 'var(--neon-green)' }}>
                            Saves ${act.risk_saved.toFixed(2)} Risk
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#ffffff', marginTop: '4px' }}>
                          {act.impact_on_thesis}
                        </div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Tradeoff: {act.tradeoff}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {showDeactivateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#0a121c',
            border: '1px solid var(--neon-red)',
            borderRadius: '4px',
            padding: '20px',
            width: '420px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontFamily: 'var(--font-hud)', color: 'var(--neon-red)', fontSize: '14px', fontWeight: 800 }}>
              CONFIRM KILL SWITCH DEACTIVATION
            </div>
            <div style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-data)' }}>
              Deactivating the portfolio kill switch permits new paper trade entries. A documented rationale is mandatory for the audit ledger.
            </div>
            <input
              type="text"
              placeholder="Reason (e.g. Market stabilized post-CPI, risks contained)..."
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              style={{
                background: '#040910',
                border: '1px solid var(--border-cyan)',
                color: '#ffffff',
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-data)',
                borderRadius: '2px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowDeactivateModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-cyan)',
                  color: 'var(--text-muted)',
                  padding: '6px 12px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={deactivateReason.trim().length < 4}
                style={{
                  background: deactivateReason.trim().length >= 4 ? 'var(--neon-cyan)' : '#334155',
                  border: 'none',
                  color: '#000000',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '2px',
                  cursor: deactivateReason.trim().length >= 4 ? 'pointer' : 'not-allowed'
                }}
              >
                CONFIRM DEACTIVATION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
