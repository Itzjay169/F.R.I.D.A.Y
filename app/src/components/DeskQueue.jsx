import React from 'react';

export default function DeskQueue({ tasks }) {
  return (
    <div className="hud-panel" style={{ padding: '10px 12px' }}>
      <div className="panel-header" style={{ margin: '-10px -12px 10px -12px' }}>
        <div className="panel-title">
          <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--neon-cyan)', display: 'inline-block' }} />
          DESK QUEUE
        </div>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '10px',
          color: 'var(--neon-cyan)',
          letterSpacing: '1px'
        }}>
          6 OPEN
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '2px 0 6px 0',
        fontFamily: 'var(--font-data)',
        fontSize: '11px'
      }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: task.done ? 'var(--text-dim)' : 'var(--text-primary)',
              textDecoration: task.done ? 'line-through' : 'none',
              opacity: task.done ? 0.6 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                color: task.done ? 'var(--neon-cyan)' : 'var(--border-cyan-bright)',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {task.done ? '✓' : '—'}
              </span>
              <span>{task.title}</span>
            </div>

            {task.badge && (
              <span style={{
                fontSize: '9px',
                color: 'var(--neon-amber)',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                padding: '1px 5px',
                borderRadius: '2px',
                letterSpacing: '0.5px'
              }}>
                {task.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
