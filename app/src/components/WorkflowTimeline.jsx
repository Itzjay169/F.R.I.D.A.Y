import React, { useState, useEffect } from 'react';

/**
 * WorkflowTimeline — Visual pipeline for multi-agent trade planning workflows.
 *
 * Requirements (Section 5):
 * - Goal
 * - Current step
 * - Step list with status icons
 * - Agent status
 * - Elapsed time
 * - Errors and timeouts
 * - “Waiting for you” state
 * - Pause / Resume / Cancel buttons
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
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!workflow?.created_at || workflow.status === 'completed' || workflow.status === 'cancelled') {
      return;
    }
    const start = new Date(workflow.created_at).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSec(Math.max(0, Math.floor((now - start) / 1000)));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [workflow?.created_at, workflow?.status]);

  if (!workflow) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px dashed rgba(255, 255, 255, 0.15)',
        borderRadius: '6px',
        padding: '28px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-data)',
        fontSize: '12px'
      }}>
        NO ACTIVE WORKFLOW · SELECT A TEMPLATE OR ISSUE COMMAND "Plan a swing trade in AAPL"
      </div>
    );
  }

  const steps = workflow.steps || [];
  const isAwaitingUser = workflow.awaiting_user || workflow.status === 'waiting_for_user' || workflow.status === 'awaiting-user';
  const isPaused = workflow.status === 'paused';
  const isCompleted = workflow.status === 'completed';
  const isCancelled = workflow.status === 'cancelled';
  const currentStepId = workflow.current_step || steps[workflow.currentStepIndex]?.id || '';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
      case 'completed':
        return { label: 'DONE', bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--neon-green)', border: 'var(--neon-green)' };
      case 'running':
        return { label: 'RUNNING', bg: 'rgba(0, 240, 255, 0.15)', color: 'var(--neon-cyan)', border: 'var(--neon-cyan)' };
      case 'timeout':
        return { label: 'TIMEOUT', bg: 'rgba(234, 179, 8, 0.2)', color: 'var(--neon-amber)', border: 'var(--neon-amber)' };
      case 'error':
      case 'failed':
        return { label: 'ERROR', bg: 'rgba(239, 68, 68, 0.2)', color: 'var(--neon-red)', border: 'var(--neon-red)' };
      case 'waiting_for_user':
      case 'awaiting-user':
        return { label: 'WAITING FOR YOU', bg: 'rgba(234, 179, 8, 0.25)', color: 'var(--neon-amber)', border: 'var(--neon-amber)' };
      default:
        return { label: 'PENDING', bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  return (
    <div style={{
      background: 'rgba(10, 15, 29, 0.90)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '8px',
      padding: '18px 22px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
    }}>
      {/* 1. Header Bar: Goal, Status, Elapsed Time, Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '14px',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '16px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: '#ffffff',
              letterSpacing: '0.8px'
            }}>
              {workflow.goal || workflow.name || 'Trade Planning Workflow'}
            </span>

            <span style={{
              fontSize: '9.5px',
              fontFamily: 'var(--font-data)',
              padding: '2px 8px',
              borderRadius: '3px',
              background: isAwaitingUser ? 'rgba(234, 179, 8, 0.25)' : isCompleted ? 'rgba(34, 197, 94, 0.2)' : isPaused ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 240, 255, 0.2)',
              color: isAwaitingUser ? 'var(--neon-amber)' : isCompleted ? 'var(--neon-green)' : isPaused ? '#94a3b8' : 'var(--neon-cyan)',
              border: `1px solid ${isAwaitingUser ? 'var(--neon-amber)' : isCompleted ? 'var(--neon-green)' : isPaused ? '#94a3b8' : 'var(--neon-cyan)'}`,
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              {isAwaitingUser ? 'WAITING FOR YOU' : (workflow.status || 'CREATED').toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
            <span>SYMBOL: <strong style={{ color: 'var(--neon-cyan)' }}>{workflow.symbol || 'AAPL'}</strong></span>
            <span>CURRENT STEP: <strong style={{ color: '#ffffff' }}>{currentStepId || '—'}</strong></span>
            <span>ELAPSED: <strong style={{ color: 'var(--neon-cyan)' }}>{elapsedSec}s</strong></span>
            <span>PROGRESS: <strong style={{ color: '#ffffff' }}>{steps.filter(s => s.status === 'done' || s.status === 'completed').length} / {steps.length} steps</strong></span>
          </div>
        </div>

        {/* Master Workflow Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isCompleted && !isCancelled && (
            <>
              {isPaused ? (
                <button
                  onClick={() => onResumeWorkflow && onResumeWorkflow(workflow.workflow_id || workflow.workflowId)}
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid var(--neon-green)',
                    color: 'var(--neon-green)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '5px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  ▶ RESUME
                </button>
              ) : (
                <button
                  onClick={() => onPauseWorkflow && onPauseWorkflow(workflow.workflow_id || workflow.workflowId)}
                  style={{
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid var(--neon-amber)',
                    color: 'var(--neon-amber)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '5px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  ⏸ PAUSE
                </button>
              )}

              <button
                onClick={() => onCancelWorkflow && onCancelWorkflow(workflow.workflow_id || workflow.workflowId, 'User requested cancellation')}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--neon-red)',
                  color: 'var(--neon-red)',
                  fontFamily: 'var(--font-data)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '5px 12px',
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

      {/* 2. "Waiting For You" State Banner */}
      {isAwaitingUser && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid var(--neon-amber)',
          borderRadius: '6px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'pulseGlow 2s infinite ease-in-out'
        }}>
          <div>
            <div style={{
              color: 'var(--neon-amber)',
              fontWeight: 800,
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              letterSpacing: '0.8px',
              textTransform: 'uppercase'
            }}>
              🛑 SAFETY GATE ACTIVE · WAITING FOR YOUR APPROVAL
            </div>
            <div style={{ color: '#ffffff', fontSize: '13px', marginTop: '3px', fontWeight: 600 }}>
              COMPASS has drafted the trade plan and SENTINEL has completed the risk review.
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px', fontFamily: 'var(--font-data)' }}>
              PILOT execution does not run without your explicit approval. Review the Trade Plan card below.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={confirming}
              onClick={async () => {
                setConfirming(true);
                try {
                  if (onConfirmStep) {
                    await onConfirmStep(workflow.workflow_id || workflow.workflowId, 'approve');
                  }
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
              {confirming ? 'CONFIRMING...' : '✓ APPROVE PLAN'}
            </button>

            <button
              onClick={() => onCancelWorkflow && onCancelWorkflow(workflow.workflow_id || workflow.workflowId, 'User rejected plan')}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--neon-red)',
                color: 'var(--neon-red)',
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                padding: '8px 14px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ✕ REJECT
            </button>
          </div>
        </div>
      )}

      {/* 3. Steps Pipeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {steps.map((st, idx) => {
          const badge = getStatusBadge(st.status);
          const isCurrent = st.id === currentStepId || (st.status === 'running');
          const hasError = st.status === 'error' || st.status === 'timeout';

          return (
            <div
              key={st.id || idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 130px 1fr 120px',
                alignItems: 'center',
                gap: '12px',
                background: isCurrent ? 'rgba(0, 240, 255, 0.06)' : hasError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isCurrent ? 'rgba(0, 240, 255, 0.35)' : hasError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderRadius: '5px',
                padding: '8px 12px',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Index */}
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                color: isCurrent ? 'var(--neon-cyan)' : 'var(--text-muted)',
                fontWeight: 700,
                textAlign: 'center'
              }}>
                #{idx + 1}
              </div>

              {/* Agent Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: (st.status === 'done' || st.status === 'completed') ? 'var(--neon-green)' : isCurrent ? 'var(--neon-cyan)' : hasError ? 'var(--neon-red)' : '#64748b'
                }} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.6px'
                }}>
                  {st.agent}
                </span>
              </div>

              {/* Task & Detail */}
              <div style={{ fontSize: '11.5px', color: (st.status === 'done' || st.status === 'completed') ? '#cbd5e1' : isCurrent ? '#ffffff' : 'var(--text-muted)' }}>
                <div>{st.task}</div>
                {st.response_ref && (
                  <div style={{ fontSize: '9.5px', color: 'var(--neon-green)', fontFamily: 'var(--font-data)', marginTop: '2px' }}>
                    ✓ {st.response_ref}
                  </div>
                )}
                {st.error && (
                  <div style={{ fontSize: '9.5px', color: 'var(--neon-red)', fontFamily: 'var(--font-data)', marginTop: '2px' }}>
                    ⚠ {st.error}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '9px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '2px',
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`
                }}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
