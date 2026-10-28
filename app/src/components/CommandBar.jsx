import React, { useState } from 'react';

export default function CommandBar({
  orbState,
  setOrbState,
  onSubmitCommand,
  activeTab,
  setActiveTab
}) {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onSubmitCommand(inputVal);
    setInputVal('');
  };

  const states = ['idle', 'listening', 'thinking', 'speaking', 'focus'];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingTop: '6px'
    }}>
      {/* Command & Control Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-cyan)',
        borderRadius: '4px',
        padding: '6px 12px'
      }}>
        {/* State Toggle Buttons */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '9px',
            color: 'var(--text-muted)',
            letterSpacing: '1px',
            marginRight: '4px'
          }}>
            ORB:
          </span>
          {states.map((st) => (
            <button
              key={st}
              onClick={() => setOrbState(st)}
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '8.5px',
                padding: '2px 6px',
                background: orbState === st ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: orbState === st ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: orbState === st ? 'var(--neon-cyan)' : 'var(--text-muted)',
                borderRadius: '2px',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* View Switchers */}
        <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--border-cyan)', paddingLeft: '8px' }}>
          {['hud', 'chart', 'workflows', 'alerts', 'archive', 'portfolio', 'news', 'journal'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '9px',
                padding: '2px 8px',
                background: activeTab === tab ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                border: activeTab === tab ? '1px solid var(--border-cyan-bright)' : '1px solid transparent',
                color: activeTab === tab ? '#ffffff' : 'var(--text-muted)',
                borderRadius: '2px',
                cursor: 'pointer',
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 'bold' }}>
            &gt;_
          </span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type command (e.g. 'Should I buy NVDA?', 'Status report', 'Paper buy 50 AAPL')..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-data)',
              fontSize: '11.5px',
              color: '#ffffff',
              letterSpacing: '0.5px'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid var(--neon-cyan)',
              color: 'var(--neon-cyan)',
              fontFamily: 'var(--font-hud)',
              fontSize: '9px',
              padding: '3px 10px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '1px'
            }}
          >
            DISPATCH
          </button>
        </form>

        {/* Mic Toggle Button */}
        <button
          onClick={() => setOrbState(orbState === 'listening' ? 'idle' : 'listening')}
          style={{
            background: orbState === 'listening' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            border: orbState === 'listening' ? '1px solid var(--neon-amber)' : '1px solid rgba(255, 255, 255, 0.15)',
            color: orbState === 'listening' ? 'var(--neon-amber)' : 'var(--text-muted)',
            fontFamily: 'var(--font-hud)',
            fontSize: '9.5px',
            padding: '3px 10px',
            borderRadius: '2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '1px'
          }}
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: orbState === 'listening' ? 'var(--neon-amber)' : 'var(--text-muted)'
          }} />
          {orbState === 'listening' ? 'MIC ACTIVE' : 'PUSH TO TALK [SPACE]'}
        </button>
      </div>

      {/* Mandatory Disclaimer Footer */}
      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--font-data)',
        fontSize: '9px',
        letterSpacing: '1.5px',
        color: 'var(--text-dim)',
        textTransform: 'uppercase'
      }}>
        Educational only. Not financial advice. Paper trading only. Do your own research.
      </div>
    </div>
  );
}
