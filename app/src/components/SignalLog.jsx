import React, { useRef, useEffect } from 'react';

export default function SignalLog({ signals }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [signals]);

  return (
    <div className="hud-panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header" style={{ margin: '-10px -12px 10px -12px' }}>
        <div className="panel-title">
          <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--neon-cyan)', display: 'inline-block' }} />
          SIGNAL LOG
        </div>
        <span className="badge badge-streaming">STREAMING</span>
      </div>

      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflowY: 'auto',
          flex: 1,
          fontFamily: 'var(--font-data)',
          fontSize: '10.5px',
          paddingRight: '4px'
        }}
      >
        {signals.map((sig, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', lineHeight: 1.3 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '9.5px', flexShrink: 0 }}>
              {sig.time}
            </span>
            <span
              style={{
                color: sig.color || 'var(--neon-cyan)',
                border: `1px solid ${sig.color || 'var(--neon-cyan)'}44`,
                background: `${sig.color || 'var(--neon-cyan)'}15`,
                padding: '0 4px',
                borderRadius: '2px',
                fontSize: '9px',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {sig.agent}
            </span>
            <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {sig.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
