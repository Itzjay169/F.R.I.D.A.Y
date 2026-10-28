import React, { useState } from 'react';

export default function CentralOrb({
  agents,
  orbState = 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking' | 'focus'
  onSelectAgent
}) {
  const [hoveredAgent, setHoveredAgent] = useState(null);

  // Filter out Friday master to place the 9 specialists
  const specialists = agents.filter(a => a.id !== 'friday');

  // Node position coordinates matching screenshot layout
  const nodePositions = {
    capitol: { top: '10%', left: '50%', transform: 'translate(-50%, -50%)', labelSide: 'top' },
    scout: { top: '20%', left: '80%', transform: 'translate(-50%, -50%)', labelSide: 'right' },
    sentinel: { top: '46%', left: '86%', transform: 'translate(-50%, -50%)', labelSide: 'right' },
    pilot: { top: '65%', left: '74%', transform: 'translate(-50%, -50%)', labelSide: 'right', group: 'EXECUTION' },
    ledger: { top: '70%', left: '59%', transform: 'translate(-50%, -50%)', labelSide: 'bottom' },
    oracle: { top: '70%', left: '41%', transform: 'translate(-50%, -50%)', labelSide: 'bottom' },
    chartist: { top: '65%', left: '26%', transform: 'translate(-50%, -50%)', labelSide: 'left' },
    athena: { top: '46%', left: '14%', transform: 'translate(-50%, -50%)', labelSide: 'left', group: 'ANALYSIS' },
    atlas: { top: '20%', left: '20%', transform: 'translate(-50%, -50%)', labelSide: 'left', group: 'INTELLIGENCE' }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      overflow: 'hidden'
    }}>
      {/* Background Orbit Track Guidelines (Subtle radar grid) */}
      <svg
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '580px',
          height: '420px',
          pointerEvents: 'none',
          opacity: 0.25
        }}
        viewBox="0 0 580 420"
      >
        <ellipse cx="290" cy="210" rx="260" ry="170" fill="none" stroke="var(--neon-cyan)" strokeWidth="1" strokeDasharray="3 6" />
        <ellipse cx="290" cy="210" rx="190" ry="120" fill="none" stroke="var(--neon-cyan)" strokeWidth="0.8" strokeDasharray="2 4" />
        <ellipse cx="290" cy="210" rx="120" ry="80" fill="none" stroke="var(--border-cyan)" strokeWidth="0.5" />
      </svg>

      {/* Main Orb Canvas in Center */}
      <div style={{
        position: 'absolute',
        top: '38%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '160px',
        height: '160px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Outer Rotating Arc Ring 1 */}
        <div style={{
          position: 'absolute',
          width: '190px',
          height: '190px',
          borderRadius: '50%',
          border: '1.5px solid transparent',
          borderTopColor: 'var(--neon-cyan)',
          borderRightColor: 'rgba(0, 240, 255, 0.4)',
          animation: orbState === 'thinking' ? 'ring-spin-clockwise 1.5s linear infinite' : 'ring-spin-clockwise 12s linear infinite'
        }} />

        {/* Outer Rotating Arc Ring 2 (Counter) */}
        <div style={{
          position: 'absolute',
          width: '210px',
          height: '210px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 240, 255, 0.3)',
          animation: orbState === 'thinking' ? 'ring-spin-counter 2s linear infinite' : 'ring-spin-counter 24s linear infinite'
        }} />

        {/* Acoustic Wave Ripple (Listening State) */}
        {orbState === 'listening' && (
          <div style={{
            position: 'absolute',
            width: '230px',
            height: '230px',
            borderRadius: '50%',
            border: '2px solid var(--neon-amber)',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)',
            animation: 'listening-wave 1.2s ease-out infinite'
          }} />
        )}

        {/* Target Reticle (Focus State) */}
        {orbState === 'focus' && (
          <div style={{
            position: 'absolute',
            width: '220px',
            height: '220px',
            border: '1px solid var(--neon-cyan)',
            borderRadius: '4px',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)'
          }}>
            <div style={{ position: 'absolute', top: '-6px', left: '-6px', width: '12px', height: '12px', borderTop: '2px solid var(--neon-cyan)', borderLeft: '2px solid var(--neon-cyan)' }} />
            <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', borderTop: '2px solid var(--neon-cyan)', borderRight: '2px solid var(--neon-cyan)' }} />
            <div style={{ position: 'absolute', bottom: '-6px', left: '-6px', width: '12px', height: '12px', borderBottom: '2px solid var(--neon-cyan)', borderLeft: '2px solid var(--neon-cyan)' }} />
            <div style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '12px', height: '12px', borderBottom: '2px solid var(--neon-cyan)', borderRight: '2px solid var(--neon-cyan)' }} />
          </div>
        )}

        {/* The Core Radiant Glowing Sphere */}
        <div style={{
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #a5f3fc 20%, #06b6d4 50%, #083344 85%, #020617 100%)',
          boxShadow: '0 0 70px rgba(0, 240, 255, 0.65), 0 0 120px rgba(6, 182, 212, 0.35), inset 0 0 35px rgba(255, 255, 255, 0.8)',
          animation: 'orb-breathe 4s ease-in-out infinite',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          {/* Subtle Equalizer bars when Speaking */}
          {orbState === 'speaking' && (
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '36px' }}>
              {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '3px',
                    height: `${h * 32}px`,
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 6px #ffffff',
                    borderRadius: '2px',
                    animation: `listening-wave ${0.4 + i * 0.1}s ease infinite alternate`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 9 Satellite Specialist Agent Nodes */}
      {specialists.map((agent) => {
        const pos = nodePositions[agent.id] || { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        const isHovered = hoveredAgent === agent.id;

        return (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            onMouseEnter={() => setHoveredAgent(agent.id)}
            onMouseLeave={() => setHoveredAgent(null)}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: pos.transform,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'transform 0.2s ease, filter 0.2s ease',
              filter: isHovered ? 'drop-shadow(0 0 12px ' + agent.color + ')' : 'none'
            }}
          >
            {/* Wing Group Indicator Header if present */}
            {pos.group && (
              <div style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '8px',
                letterSpacing: '1.5px',
                color: 'var(--text-muted)',
                marginBottom: '2px',
                textTransform: 'uppercase'
              }}>
                {pos.group}
              </div>
            )}

            {/* Glowing Agent Dot */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: agent.color,
              boxShadow: `0 0 12px ${agent.color}, 0 0 24px ${agent.color}`,
              border: '1.5px solid #ffffff',
              position: 'relative'
            }}>
              {/* Pulse Ring */}
              <div style={{
                position: 'absolute',
                top: '-4px',
                left: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: `1px solid ${agent.color}`,
                opacity: 0.7,
                animation: 'pulse-dot 3s infinite'
              }} />
            </div>

            {/* Agent Name */}
            <div style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              color: isHovered ? '#ffffff' : agent.color,
              marginTop: '4px',
              textShadow: `0 0 8px ${agent.color}`
            }}>
              {agent.name}
            </div>

            {/* Role Subtitle */}
            <div style={{
              fontFamily: 'var(--font-data)',
              fontSize: '8.5px',
              color: 'var(--text-muted)',
              letterSpacing: '0.8px',
              textTransform: 'uppercase'
            }}>
              {agent.role}
            </div>
          </div>
        );
      })}

      {/* Spacer to push typography cleanly to the bottom */}
      <div style={{ flex: 1 }} />

      {/* Bottom Center Typography & Metrics Display */}
      <div style={{
        textAlign: 'center',
        paddingBottom: '8px',
        zIndex: 5
      }}>
        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-hud)',
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '8px',
          color: '#ffffff',
          textShadow: '0 0 20px rgba(0, 240, 255, 0.7)',
          margin: 0
        }}>
          F R I D A Y
        </h2>

        {/* Subtitle */}
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize: '9.5px',
          letterSpacing: '2.5px',
          color: 'var(--text-muted)',
          marginTop: '3px'
        }}>
          MASTER · STRATEGY SYNTHESIS · RISK ROUTER
        </div>

        {/* Desk Equity Section */}
        <div style={{ marginTop: '8px' }}>
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: '9px',
            letterSpacing: '1.5px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase'
          }}>
            DESK EQUITY
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '2px'
          }}>
            <span style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: 'var(--neon-cyan)',
              textShadow: '0 0 16px rgba(0, 240, 255, 0.8)'
            }}>
              $1,604,199
            </span>
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 5px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: 'var(--neon-amber)',
              borderRadius: '2px',
              letterSpacing: '0.5px'
            }}>
              PAPER
            </span>
          </div>
        </div>

        {/* 5 Bottom Counter Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '8px',
          fontFamily: 'var(--font-data)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', display: 'block', letterSpacing: '1px' }}>IN PLAY</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>6</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', display: 'block', letterSpacing: '1px' }}>WATCHING</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>231</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', display: 'block', letterSpacing: '1px' }}>SIGNALS</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>61</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', display: 'block', letterSpacing: '1px' }}>SCANS TODAY</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>167</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', display: 'block', letterSpacing: '1px' }}>ALERTS</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--neon-amber)' }}>4</span>
          </div>
        </div>
      </div>
    </div>
  );
}
