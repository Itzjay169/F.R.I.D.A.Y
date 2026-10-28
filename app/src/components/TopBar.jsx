import React, { useState, useEffect } from 'react';

export default function TopBar({ onOpenHealth, onOpenAbout }) {
  const [timeStr, setTimeStr] = useState('04:38:16');
  const [dateStr, setDateStr] = useState('TUESDAY 15 SEPTEMBER // MELBOURNE');
  const [uptimeStr, setUptimeStr] = useState('09:13');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0]);
      
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      const dayNum = now.getDate();
      const monthName = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
      setDateStr(`${dayName} ${dayNum} ${monthName} // MELBOURNE`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'start',
      paddingBottom: '8px',
      position: 'relative'
    }}>
      {/* Left Branding */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px'
        }}>
          <h1 style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '5px',
            color: 'var(--neon-cyan)',
            textShadow: '0 0 15px rgba(0, 240, 255, 0.7)',
            margin: 0
          }}>
            F R I D A Y
          </h1>
        </div>
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize: '11px',
          letterSpacing: '2px',
          color: 'var(--text-muted)',
          marginTop: '2px'
        }}>
          THE TRADING DESK
        </div>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '10px',
          letterSpacing: '1px',
          color: 'var(--neon-cyan)',
          opacity: 0.8,
          marginTop: '2px'
        }}>
          DESK ACTIVE // CLAP x2 TO BEGIN
        </div>
      </div>

      {/* Middle Status Counters & Demo Tag */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '11px',
          letterSpacing: '1.5px',
          color: 'var(--text-primary)',
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(0, 240, 255, 0.05)',
          padding: '4px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(0, 240, 255, 0.15)'
        }}>
          <span><strong style={{ color: 'var(--neon-cyan)' }}>9</strong> AGENTS</span>
          <span style={{ color: 'var(--border-cyan)' }}>·</span>
          <span><strong style={{ color: 'var(--neon-cyan)' }}>6</strong> VOICES</span>
          <span style={{ color: 'var(--border-cyan)' }}>·</span>
          <span><strong style={{ color: 'var(--neon-cyan)' }}>367</strong> SCANS</span>
          <span style={{ color: 'var(--border-cyan)' }}>·</span>
          <span><strong style={{ color: 'var(--neon-cyan)' }}>61</strong> SIGNALS</span>
          <span style={{ color: 'var(--border-cyan)' }}>·</span>
          <span><strong style={{ color: 'var(--neon-cyan)' }}>{uptimeStr}</strong> UPTIME</span>
        </div>
      </div>

      {/* Right Clock & Connected Status */}
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize: '30px',
          fontWeight: 700,
          color: 'var(--neon-cyan)',
          letterSpacing: '3px',
          textShadow: '0 0 15px rgba(0, 240, 255, 0.6)',
          lineHeight: 1
        }}>
          {timeStr}
        </div>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '10px',
          letterSpacing: '1px',
          color: 'var(--text-muted)',
          marginTop: '4px'
        }}>
          {dateStr}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '6px',
          marginTop: '3px',
          fontFamily: 'var(--font-data)',
          fontSize: '10px',
          color: 'var(--neon-green)'
        }}>
          <button
            onClick={onOpenAbout}
            title="About Developer (Jaykishan Das) & Vexora Technology"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 7px',
              borderRadius: '2px',
              fontFamily: 'var(--font-data)',
              fontSize: '10px',
              letterSpacing: '0.5px'
            }}
          >
            <span style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 5px #f59e0b'
            }} />
            ABOUT DEVELOPER · VEXORA
          </button>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>·</span>
          <button
            onClick={onOpenHealth}
            title="Inspect Machine-Readable Health & TradingView MCP Capabilities"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--neon-green)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 4px',
              borderRadius: '2px',
              fontFamily: 'var(--font-data)',
              fontSize: '10px'
            }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--neon-green)',
              boxShadow: '0 0 6px var(--neon-green)'
            }} />
            DESK SERVICES · HEALTH AUDIT [MCP]
          </button>
        </div>
      </div>
    </header>
  );
}
