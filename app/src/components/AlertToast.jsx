import React, { useEffect } from 'react';

export default function AlertToast({ alertEvent, onDismiss, onViewSymbol }) {
  useEffect(() => {
    if (!alertEvent) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [alertEvent, onDismiss]);

  if (!alertEvent) return null;

  const severityColor = alertEvent.severity === 'critical'
    ? 'var(--neon-red, #ef4444)'
    : alertEvent.severity === 'important'
      ? '#eab308'
      : 'var(--neon-cyan, #00f0ff)';

  return (
    <div
      style={{
        position: 'fixed',
        top: '70px',
        right: '24px',
        zIndex: 9999,
        minWidth: '340px',
        maxWidth: '420px',
        background: 'rgba(8, 14, 26, 0.96)',
        border: `1px solid ${severityColor}`,
        boxShadow: `0 0 20px ${alertEvent.severity === 'critical' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 240, 255, 0.3)'}`,
        borderRadius: '4px',
        padding: '12px 16px',
        backdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-hud, monospace)',
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: severityColor,
              boxShadow: `0 0 8px ${severityColor}`
            }}
          />
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: severityColor
            }}
          >
            RELAY ALERT · {alertEvent.severity}
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '0 4px'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
        {alertEvent.alert_name}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px', lineHeight: '1.4' }}>
        {alertEvent.message}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)' }}>
          {alertEvent.source || 'RELAY Watchtower'}
        </span>
        {alertEvent.symbol && onViewSymbol && (
          <button
            onClick={() => {
              onViewSymbol(alertEvent.symbol);
              onDismiss();
            }}
            style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid var(--neon-cyan, #00f0ff)',
              color: 'var(--neon-cyan, #00f0ff)',
              fontSize: '9px',
              letterSpacing: '1px',
              padding: '2px 8px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            VIEW {alertEvent.symbol} →
          </button>
        )}
      </div>
    </div>
  );
}
