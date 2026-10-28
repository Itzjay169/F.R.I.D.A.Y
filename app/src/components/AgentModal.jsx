import React from 'react';

export default function AgentModal({ agent, onClose, onPing }) {
  if (!agent) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 18, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}
    onClick={onClose}
    >
      <div
        className="hud-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '460px',
          background: 'rgba(6, 15, 30, 0.95)',
          border: `1px solid ${agent.color}`,
          boxShadow: `0 0 30px ${agent.color}33`,
          padding: '16px'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-cyan)',
          paddingBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: agent.color,
              boxShadow: `0 0 10px ${agent.color}`
            }} />
            <div>
              <h3 style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '18px',
                color: '#ffffff',
                letterSpacing: '2px',
                margin: 0
              }}>
                {agent.name}
              </h3>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: '9.5px',
                color: agent.color,
                letterSpacing: '1px'
              }}>
                {agent.wing.toUpperCase()} WING // {agent.role}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-data)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Details */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px 0',
          fontFamily: 'var(--font-data)',
          fontSize: '11px'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>DESCRIPTION</span>
            <span style={{ color: 'var(--text-primary)' }}>{agent.description}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>TTS VOICE PROFILE</span>
              <span style={{ color: 'var(--neon-cyan)' }}>{agent.voice}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>CURRENT LOAD</span>
              <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{agent.load}%</span>
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>STATUS & LAST ACTION</span>
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '6px 10px',
              borderRadius: '2px',
              border: '1px solid var(--border-cyan)',
              color: '#ffffff',
              marginTop: '4px'
            }}>
              "{agent.lastAction || 'Standby for desk routing'}"
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>VERIFIABLE SOURCE FEEDS</span>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <span className="badge badge-streaming">finnhub:quote</span>
              <span className="badge badge-streaming">sec-edgar:v1</span>
              <span className="badge badge-mock">local-cache</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          borderTop: '1px solid var(--border-cyan)',
          paddingTop: '12px'
        }}>
          <button
            onClick={() => onPing(agent)}
            style={{
              background: `${agent.color}22`,
              border: `1px solid ${agent.color}`,
              color: agent.color,
              fontFamily: 'var(--font-hud)',
              fontSize: '10px',
              padding: '5px 12px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '1px'
            }}
          >
            PING AGENT
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-hud)',
              fontSize: '10px',
              padding: '5px 12px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
