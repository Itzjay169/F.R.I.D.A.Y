import React, { useState } from 'react';

/**
 * WorkflowTimeline — Visual pipeline for multi-agent workflows.
 *
 * Sequence:
 *   ATLAS → SCOUT → ATHENA → CHARTIST → ORACLE → COMPASS → SENTINEL → USER → PILOT → LEDGER
 *
 * Mandatory safety gates:
 * - Workflow MUST stop for user confirmation before:
 *   - Placing any paper trade
 *   - Enabling an optional integration
 *   - Running a long backtest
 *   - Deleting journal data
 *   - Changing risk limits
 */
export default function WorkflowTimeline({
  workflow,
  onConfirmStep,
  onAdvanceStep,
  onPauseWorkflow,
  onResumeWorkflow,
  onCancelWorkflow
}) {
  const [confirming, setConfirming] = useState(false);

  if (!workflow) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px dashed rgba(255, 255, 255, 0.15)',
        borderRadius: '6px',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-data)',
        fontSize: '12px'
      }}>
        NO ACTIVE WORKFLOW · SELECT A TEMPLATE OR ISSUE A PLANNING COMMAND
      </div>
    );
  }

  const steps = workflow.steps || [];
  const currentStep = steps[workflow.currentStepIndex] || null;
  const isAwaitingUser = workflow.status === 'awaiting-user';
  const isPaused = workflow.status === 'paused';
  const isCompleted = workflow.status === 'completed';
  const isCancelled = workflow.status === 'cancelled';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return { label: 'DONE', bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--neon-green)', border: 'var(--neon-green)' };
      case 'running':
        return { label: 'RUNNING', bg: 'rgba(0, 240, 255, 0.15)', color: 'var(--neon-cyan)', border: 'var(--neon-cyan)' };
      case 'awaiting-user':
        return { label: 'GATED (USER)', bg: 'rgba(234, 179, 8, 0.2)', color: 'var(--neon-amber)', border: 'var(--neon-amber)' };
      case 'blocked':
        return { label: 'BLOCKED', bg: 'rgba(239, 68, 68, 0.2)', color: 'var(--neon-red)', border: 'var(--neon-red)' };
      case 'failed':
        return { label: 'FAILED', bg: 'rgba(239, 68, 68, 0.2)', color: 'var(--neon-red)', border: 'var(--neon-red)' };
      default:
        return { label: 'QUEUED', bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  return (
    <div style={{
      background: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '8px',
      padding: '16px 20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '15px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: '#ffffff',
              letterSpacing: '0.8px'
            }}>
              {workflow.name || 'Trading Workflow'}
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-data)',
              padding: '2px 8px',
              borderRadius: '3px',
              background: isAwaitingUser ? 'rgba(234, 179, 8, 0.2)' : isCompleted ? 'rgba(34, 197, 94, 0.2)' : isPaused ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 240, 255, 0.2)',
              color: isAwaitingUser ? 'var(--neon-amber)' : isCompleted ? 'var(--neon-green)' : isPaused ? '#94a3b8' : 'var(--neon-cyan)',
              border: `1px solid ${isAwaitingUser ? 'var(--neon-amber)' : isCompleted ? 'var(--neon-green)' : isPaused ? '#94a3b8' : 'var(--neon-cyan)'}`,
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {workflow.status}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', marginTop: '4px' }}>
            ID: <span style={{ color: 'var(--neon-cyan)' }}>{workflow.workflowId}</span>
            {workflow.params?.symbol && (
              <span style={{ marginLeft: '12px' }}>
                Symbol: <strong style={{ color: '#ffffff' }}>{workflow.params.symbol}</strong>
              </span>
            )}
            <span style={{ marginLeft: '12px' }}>
              Progress: <strong style={{ color: '#ffffff' }}>
                {steps.filter(s => s.status === 'completed').length} / {steps.length} steps
              </strong>
            </span>
          </div>
        </div>

        {/* Master Workflow Controls */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {!isCompleted && !isCancelled && (
            <>
              {isPaused ? (
                <button
                  onClick={() => onResumeWorkflow && onResumeWorkflow(workflow.workflowId)}
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid var(--neon-green)',
                    color: 'var(--neon-green)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '10px',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  ▶ RESUME
                </button>
              ) : (
                <button
                  onClick={() => onPauseWorkflow && onPauseWorkflow(workflow.workflowId)}
                  style={{
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid var(--neon-amber)',
                    color: 'var(--neon-amber)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '10px',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  ⏸ PAUSE
                </button>
              )}

              <button
                onClick={() => onCancelWorkflow && onCancelWorkflow(workflow.workflowId, 'User requested cancel')}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--neon-red)',
                  color: 'var(--neon-red)',
                  fontFamily: 'var(--font-data)',
                  fontSize: '10px',
                  padding: '4px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                ✕ CANCEL
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mandatory User Confirmation Alert Gate */}
      {isAwaitingUser && currentStep && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid var(--neon-amber)',
          borderRadius: '6px',
          padding: '14px',
          marginBottom: '16px',
          animation: 'pulseGlow 2s infinite ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                color: 'var(--neon-amber)',
                fontWeight: 800,
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>🛑 SAFETY GATE ACTIVE · USER CONFIRMATION MANDATORY</span>
              </div>
              <div style={{ color: '#ffffff', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>
                Step {workflow.currentStepIndex + 1}: {currentStep.task}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px', fontFamily: 'var(--font-data)' }}>
                Agent: <strong style={{ color: 'var(--neon-cyan)' }}>{currentStep.agent}</strong> · F.R.I.D.A.Y. safety rules forbid autonomous execution without explicit human approval.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={confirming}
                onClick={async () => {
                  setConfirming(true);
                  try {
                    await onConfirmStep(workflow.workflowId, workflow.currentStepIndex, { approved: true, confirmedBy: 'USER' });
                  } finally {
                    setConfirming(false);
                  }
                }}
                style={{
                  background: 'rgba(34, 197, 94, 0.25)',
                  border: '1px solid var(--neon-green)',
                  color: '#ffffff',
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: confirming ? 'wait' : 'pointer',
                  letterSpacing: '0.8px'
                }}
              >
                {confirming ? 'CONFIRMING...' : '✓ CONFIRM & PROCEED'}
              </button>

              <button
                onClick={() => onCancelWorkflow && onCancelWorkflow(workflow.workflowId, 'User rejected step approval')}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--neon-red)',
                  color: 'var(--neon-red)',
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕ REJECT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steps Pipeline */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {steps.map((st, idx) => {
          const badge = getStatusBadge(st.status);
          const isCurrent = idx === workflow.currentStepIndex;

          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 120px 1fr 110px 90px',
                alignItems: 'center',
                gap: '12px',
                background: isCurrent ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isCurrent ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderRadius: '5px',
                padding: '8px 12px',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Step Number */}
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                color: isCurrent ? 'var(--neon-cyan)' : 'var(--text-muted)',
                fontWeight: 700,
                textAlign: 'center'
              }}>
                #{idx + 1}
              </div>

              {/* Agent Node */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: st.status === 'completed' ? 'var(--neon-green)' : isCurrent ? 'var(--neon-cyan)' : '#64748b'
                }} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.5px'
                }}>
                  {st.agent}
                </span>
                {st.requiresUser && (
                  <span style={{
                    fontSize: '8px',
                    color: 'var(--neon-amber)',
                    fontFamily: 'var(--font-data)',
                    background: 'rgba(234, 179, 8, 0.1)',
                    padding: '1px 3px',
                    borderRadius: '2px'
                  }}>
                    GATE
                  </span>
                )}
              </div>

              {/* Task Description */}
              <div style={{
                fontSize: '11.5px',
                color: st.status === 'completed' ? '#cbd5e1' : isCurrent ? '#ffffff' : 'var(--text-muted)',
                lineHeight: '1.3'
              }}>
                {st.task}
                {st.result && (
                  <div style={{ fontSize: '9.5px', color: 'var(--neon-green)', fontFamily: 'var(--font-data)', marginTop: '2px' }}>
                    ✓ {typeof st.result === 'string' ? st.result : 'Result captured and validated.'}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div>
                <span style={{
                  display: 'inline-block',
                  fontSize: '9px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '2px',
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Individual Advance Button (for testing / manual stepping) */}
              <div style={{ textAlign: 'right' }}>
                {isCurrent && st.status === 'running' && !st.requiresUser && (
                  <button
                    onClick={() => onAdvanceStep && onAdvanceStep(workflow.workflowId, { summary: `${st.agent} completed task` })}
                    style={{
                      background: 'rgba(0, 240, 255, 0.1)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      color: 'var(--neon-cyan)',
                      fontFamily: 'var(--font-data)',
                      fontSize: '9.5px',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    ADVANCE ▶
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
