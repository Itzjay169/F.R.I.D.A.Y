import React, { useState, useEffect } from 'react';

export default function JournalView() {
  const [journalEntries, setJournalEntries] = useState([
    {
      id: 'JRN-1042',
      timestamp: '2026-09-15 03:45:12',
      symbol: 'NVDA',
      action: 'PAPER BUY 50 @ $118.80',
      thesis: 'Breakout above 20d EMA with volume expansion. Athena confirmed data center backlog growth. Oracle gave 68% probability of retesting $124.',
      sentinelCheck: 'APPROVED: Risk = 0.8% of equity ($800 risk on $115 stop). R:R = 1.8.',
      outcome: 'OPEN (+3.03%)',
      mistakesNotes: 'Entry slightly late by 1.2% due to waiting on newsroom confirmation.'
    },
    {
      id: 'JRN-1041',
      timestamp: '2026-09-14 11:20:04',
      symbol: 'AMD',
      action: 'PAPER BUY 75 @ $142.10 [VETOED]',
      thesis: 'Momentum continuation trade.',
      sentinelCheck: 'VETOED: Stop-loss was not defined. Required stop mandatory on every desk order.',
      outcome: 'REJECTED (0 RISK INCURRED)',
      mistakesNotes: 'Desk correctly blocked execution due to unhedged tail risk.'
    }
  ]);

  useEffect(() => {
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(d => {
        if (d && d.journal && d.journal.length > 0) {
          setJournalEntries(prev => [...d.journal, ...prev]);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="hud-panel" style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header" style={{ margin: '-16px -16px 16px -16px' }}>
        <div className="panel-title">
          <span>LEDGER THE BOOK // TRADE JOURNAL & PERFORMANCE AUDIT</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-streaming">AUDIT ACTIVE</span>
          <span className="badge badge-live">ZERO BREAKS</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>WIN RATE (LAST 30)</span>
          <div style={{ fontSize: '18px', color: 'var(--neon-green)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>64.2%</div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>AVERAGE R-MULTIPLE</span>
          <div style={{ fontSize: '18px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>+1.92 R</div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>MAX DRAWDOWN</span>
          <div style={{ fontSize: '18px', color: 'var(--neon-red)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>-2.1%</div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>SENTINEL VETO SAVINGS</span>
          <div style={{ fontSize: '18px', color: 'var(--neon-amber)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>$14,200 (28.5% Veto)</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {journalEntries.map((j) => (
          <div
            key={j.id}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-cyan)',
              borderRadius: '4px',
              padding: '12px',
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{j.id} // {j.action}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>{j.timestamp}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>THESIS: </span>
              <span style={{ color: 'var(--text-primary)' }}>{j.thesis}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SENTINEL VERDICT: </span>
              <span style={{ color: j.sentinelCheck?.startsWith('APPROVED') || j.sentinelToken ? 'var(--neon-green)' : 'var(--neon-amber)' }}>
                {j.sentinelCheck || `APPROVED (Token: ${j.sentinelToken})`}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>POST-TRADE AUDIT / MISTAKE REVIEW: </span>
              <span style={{ color: '#ffffff' }}>{j.mistakesNotes || 'Systematic entry confirmed.'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
