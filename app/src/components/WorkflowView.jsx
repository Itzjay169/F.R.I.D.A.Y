import React, { useState, useEffect, useCallback } from 'react';
import WorkflowTimeline from './WorkflowTimeline.jsx';
import TradePlanCard from './TradePlanCard.jsx';

/**
 * WorkflowView — Comprehensive Workflows & COMPASS Trade Plans Center.
 *
 * Provides:
 * 1. Template Launchpad (Swing, Breakout, Pre-Market, Catalyst)
 * 2. Active Workflows Pipeline (interactive step execution & confirmation gates)
 * 3. COMPASS Trade Plans Dossier (validated parameters, R:R math, risk levels)
 */
export default function WorkflowView({
  onSendToChart,
  onNotify,
  onSpeak
}) {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [templates, setTemplates] = useState({});
  const [tradePlans, setTradePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activeSection, setActiveSection] = useState('workflows'); // 'workflows' | 'plans'
  const [selectedSymbol, setSelectedSymbol] = useState('NVDA');
  const [loading, setLoading] = useState(false);

  // 1. Fetch Workflows & Templates
  const loadWorkflows = useCallback(async () => {
    try {
      const [wfRes, tplRes, plansRes] = await Promise.all([
        fetch('/api/workflows').then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch('/api/workflows/templates').then(r => r.json()).catch(() => ({ templates: {} })),
        fetch('/api/compass/plans').then(r => r.json()).catch(() => ({ plans: [] }))
      ]);

      if (Array.isArray(wfRes.workflows)) {
        setWorkflows(wfRes.workflows);
        if (wfRes.workflows.length > 0 && !selectedWorkflowId) {
          setSelectedWorkflowId(wfRes.workflows[0].workflowId);
        }
      }

      if (tplRes.templates) {
        setTemplates(tplRes.templates);
      }

      if (Array.isArray(plansRes.plans)) {
        setTradePlans(plansRes.plans);
        if (plansRes.plans.length > 0 && !selectedPlanId) {
          setSelectedPlanId(plansRes.plans[0].planId);
        }
      }
    } catch (err) {
      console.warn('[WORKFLOW VIEW] Fetch error:', err.message);
    }
  }, [selectedWorkflowId, selectedPlanId]);

  useEffect(() => {
    loadWorkflows();
    const interval = setInterval(loadWorkflows, 4000);
    return () => clearInterval(interval);
  }, [loadWorkflows]);

  // 2. Launch New Workflow from Template
  const handleLaunchTemplate = async (templateId) => {
    setLoading(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          params: { symbol: selectedSymbol }
        })
      });
      const data = await res.json();
      if (data.workflow) {
        setWorkflows(prev => [data.workflow, ...prev]);
        setSelectedWorkflowId(data.workflow.workflowId);
        const msg = `Launched workflow "${data.workflow.name}" for ${selectedSymbol}. Initializing step 1.`;
        if (onNotify) onNotify('COMPASS', msg, 'var(--neon-cyan)');
        if (onSpeak) onSpeak(msg);
      }
    } catch (err) {
      console.error('Launch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Draft New Trade Plan via COMPASS
  const handleDraftTradePlan = async (setupType = 'swing') => {
    setLoading(true);
    try {
      const res = await fetch('/api/compass/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          setupType,
          command: `Plan a ${setupType} trade in ${selectedSymbol}`
        })
      });
      const data = await res.json();
      if (data.plan) {
        setTradePlans(prev => [data.plan, ...prev]);
        setSelectedPlanId(data.plan.planId);
        setActiveSection('plans');
        const msg = `COMPASS drafted ${setupType} plan for ${selectedSymbol} with ${data.plan.rewardRisk}R.`;
        if (onNotify) onNotify('COMPASS', msg, 'var(--neon-green)');
        if (onSpeak) onSpeak(msg);
      }
    } catch (err) {
      console.error('Draft plan failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Workflow Actions (Confirm, Advance, Pause, Resume, Cancel)
  const handleWorkflowAction = async (action, workflowId, payload = {}) => {
    try {
      const res = await fetch('/api/workflow/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          workflowId,
          ...payload
        })
      });
      const data = await res.json();
      if (data.success && data.workflow) {
        setWorkflows(prev => prev.map(w => w.workflowId === workflowId ? data.workflow : w));
        if (action === 'confirm') {
          const msg = `User confirmation verified. Workflow ${workflowId.slice(0, 8)} advanced.`;
          if (onNotify) onNotify('PILOT', msg, 'var(--neon-green)');
          if (onSpeak) onSpeak(msg);
        }
      }
    } catch (err) {
      console.error('Workflow action failed:', err);
    }
  };

  const selectedWorkflow = workflows.find(w => w.workflowId === selectedWorkflowId) || workflows[0] || null;
  const selectedPlan = tradePlans.find(p => p.planId === selectedPlanId) || tradePlans[0] || null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '14px',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Left Sidebar: Templates & Navigation */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Quick Launcher Card */}
        <div style={{
          background: 'rgba(10, 15, 29, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          padding: '14px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            color: 'var(--neon-cyan)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: '10px'
          }}>
            ⚡ WORKFLOW LAUNCHER & TICKER
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['NVDA', 'SPY', 'QQQ', 'AAPL', 'TSLA'].map(sym => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                style={{
                  flex: 1,
                  background: selectedSymbol === sym ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${selectedSymbol === sym ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: selectedSymbol === sym ? 'var(--neon-cyan)' : '#cbd5e1',
                  fontFamily: 'var(--font-data)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '4px 0',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                {sym}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              disabled={loading}
              onClick={() => handleLaunchTemplate('plan-swing-trade')}
              style={{
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                color: '#ffffff',
                fontFamily: 'var(--font-data)',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>📈 Plan Swing Trade</span>
              <span style={{ fontSize: '9px', color: 'var(--neon-cyan)' }}>10-STEP ▶</span>
            </button>

            <button
              disabled={loading}
              onClick={() => handleLaunchTemplate('plan-breakout-trade')}
              style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                color: '#ffffff',
                fontFamily: 'var(--font-data)',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>🚀 Plan Breakout Trade</span>
              <span style={{ fontSize: '9px', color: 'var(--neon-amber)' }}>8-STEP ▶</span>
            </button>

            <button
              disabled={loading}
              onClick={() => handleDraftTradePlan('swing')}
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#ffffff',
                fontFamily: 'var(--font-data)',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>🧭 COMPASS Draft Plan</span>
              <span style={{ fontSize: '9px', color: 'var(--neon-green)' }}>DRAFT ▶</span>
            </button>
          </div>
        </div>

        {/* Workflows / Plans Switcher Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '6px',
          padding: '2px'
        }}>
          <button
            onClick={() => setActiveSection('workflows')}
            style={{
              flex: 1,
              background: activeSection === 'workflows' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
              border: 'none',
              color: activeSection === 'workflows' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              fontFamily: 'var(--font-data)',
              fontSize: '10px',
              fontWeight: 700,
              padding: '6px 0',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ACTIVE WORKFLOWS ({workflows.length})
          </button>
          <button
            onClick={() => setActiveSection('plans')}
            style={{
              flex: 1,
              background: activeSection === 'plans' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
              border: 'none',
              color: activeSection === 'plans' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              fontFamily: 'var(--font-data)',
              fontSize: '10px',
              fontWeight: 700,
              padding: '6px 0',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            TRADE PLANS ({tradePlans.length})
          </button>
        </div>

        {/* List of items */}
        <div style={{
          flex: 1,
          background: 'rgba(10, 15, 29, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '8px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {activeSection === 'workflows' ? (
            workflows.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
                No active workflows. Click a launcher button above.
              </div>
            ) : (
              workflows.map(wf => {
                const isSelected = wf.workflowId === selectedWorkflowId;
                const isGated = wf.status === 'awaiting-user';
                return (
                  <div
                    key={wf.workflowId}
                    onClick={() => setSelectedWorkflowId(wf.workflowId)}
                    style={{
                      background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? 'var(--neon-cyan)' : isGated ? 'var(--neon-amber)' : 'rgba(255, 255, 255, 0.06)'}`,
                      borderRadius: '5px',
                      padding: '8px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
                        {wf.name}
                      </span>
                      <span style={{
                        fontSize: '8.5px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '2px',
                        background: isGated ? 'rgba(234, 179, 8, 0.2)' : 'rgba(0, 240, 255, 0.1)',
                        color: isGated ? 'var(--neon-amber)' : 'var(--neon-cyan)'
                      }}>
                        {wf.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-data)' }}>
                      Step {wf.currentStepIndex + 1} of {wf.steps?.length || 0} · {wf.params?.symbol || 'SPY'}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            tradePlans.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
                No trade plans yet. Issue a planning command to generate one.
              </div>
            ) : (
              tradePlans.map(pl => {
                const isSelected = pl.planId === selectedPlanId;
                return (
                  <div
                    key={pl.planId}
                    onClick={() => setSelectedPlanId(pl.planId)}
                    style={{
                      background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.06)'}`,
                      borderRadius: '5px',
                      padding: '8px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
                        {pl.symbol} · {pl.setupType.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: pl.rewardRisk >= 2.0 ? 'var(--neon-green)' : 'var(--neon-amber)',
                        fontFamily: 'var(--font-data)'
                      }}>
                        {pl.rewardRisk}R
                      </span>
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {pl.direction?.toUpperCase()} · Entry ${pl.entryPrice || '—'} · SL ${pl.stopLoss || '—'}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Right Main Panel: Detail Viewer */}
      <div style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {activeSection === 'workflows' ? (
          <WorkflowTimeline
            workflow={selectedWorkflow}
            onConfirmStep={(wfId, stepIdx, data) => handleWorkflowAction('confirm', wfId, { stepIndex: stepIdx, confirmationData: data })}
            onAdvanceStep={(wfId, res) => handleWorkflowAction('advance', wfId, { result: res })}
            onPauseWorkflow={(wfId) => handleWorkflowAction('pause', wfId)}
            onResumeWorkflow={(wfId) => handleWorkflowAction('resume', wfId)}
            onCancelWorkflow={(wfId, reason) => handleWorkflowAction('cancel', wfId, { reason })}
          />
        ) : (
          <TradePlanCard
            plan={selectedPlan}
            onSendToChart={(plan) => onSendToChart && onSendToChart(plan.symbol)}
            onRiskCheck={(plan) => {
              const msg = `Dispatching Sentinel risk check for ${plan.symbol}. Reward-to-risk ratio is ${plan.rewardRisk}R.`;
              if (onNotify) onNotify('SENTINEL', msg, 'var(--neon-amber)');
              if (onSpeak) onSpeak(msg);
            }}
            onExecuteClick={(plan) => {
              handleLaunchTemplate('plan-swing-trade');
              setActiveSection('workflows');
            }}
          />
        )}
      </div>
    </div>
  );
}
