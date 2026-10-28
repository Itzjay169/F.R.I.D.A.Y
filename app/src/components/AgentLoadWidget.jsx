import React from 'react';

export default function AgentLoadWidget({ agents }) {
  // Ordered explicitly to match reference layout
  const order = ['athena', 'chartist', 'oracle', 'atlas', 'capitol', 'scout', 'sentinel', 'pilot', 'ledger'];
  const specialists = order
    .map(id => agents.find(a => a.id === id))
    .filter(Boolean);

  return (
    <div className="hud-panel" style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header" style={{ margin: '-10px -12px 10px -12px' }}>
        <div className="panel-title">
          <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--neon-cyan)', display: 'inline-block' }} />
          AGENT LOAD
        </div>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '9px',
          color: 'var(--text-muted)'
        }}>
          MEAN
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flex: 1,
        padding: '4px 0 2px 0',
        fontFamily: 'var(--font-data)',
        fontSize: '9.5px'
      }}>
        {specialists.map((agent) => (
          <div key={agent.id} style={{ display: 'grid', gridTemplateColumns: '62px 1fr 28px', alignItems: 'center', gap: '8px' }}>
            <span style={{
              color: 'var(--text-primary)',
              letterSpacing: '0.5px',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px'
            }}>
              {agent.name}
            </span>

            {/* Load Bar Track */}
            <div style={{
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: `${agent.load}%`,
                height: '100%',
                backgroundColor: agent.color,
                boxShadow: `0 0 6px ${agent.color}`,
                transition: 'width 0.5s ease'
              }} />
            </div>

            {/* Percentage */}
            <span style={{
              textAlign: 'right',
              color: 'var(--text-muted)',
              fontSize: '9px'
            }}>
              {agent.load}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
