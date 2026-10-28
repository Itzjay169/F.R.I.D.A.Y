import React from 'react';

export default function SessionWidget({ session, quotes = [] }) {
  const spyQuote = quotes.find(q => q.symbol === 'SPY');
  const qqqQuote = quotes.find(q => q.symbol === 'QQQ');
  const btcQuote = quotes.find(q => q.symbol === 'BTC');

  const statusText = session?.status || 'MARKET OPEN';
  const countdownText = session?.countdownText || 'CLOSES IN 5H 30M';
  const isOpen = session?.isOpen ?? true;

  const renderPill = (q, defaultSym) => {
    const sym = q?.symbol || defaultSym;
    const hasChange = typeof q?.changePct === 'number';
    const isNeg = hasChange ? q.changePct < 0 : false;
    const changeStr = hasChange ? `${q.changePct > 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : '—';

    return (
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: '9px',
        background: isNeg ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        border: `1px solid ${isNeg ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
        color: isNeg ? 'var(--neon-red)' : 'var(--neon-green)',
        padding: '2px 6px',
        borderRadius: '2px'
      }}>
        {sym} {changeStr}
      </div>
    );
  };

  return (
    <div className="hud-panel" style={{ padding: '10px 12px' }}>
      <div className="panel-header" style={{ margin: '-10px -12px 10px -12px' }}>
        <div className="panel-title">
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isOpen ? 'var(--neon-green)' : 'var(--neon-amber)',
            display: 'inline-block',
            boxShadow: `0 0 6px ${isOpen ? 'var(--neon-green)' : 'var(--neon-amber)'}`
          }} />
          SESSION
        </div>
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize: '9px',
          color: 'var(--text-muted)',
          letterSpacing: '1px'
        }}>
          {session?.exchange || 'NYSE'}
        </div>
      </div>

      <div style={{ padding: '4px 0 6px 0' }}>
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize: '18px',
          fontWeight: 700,
          color: isOpen ? 'var(--neon-green)' : 'var(--neon-amber)',
          letterSpacing: '2px',
          textShadow: `0 0 10px ${isOpen ? 'rgba(16, 185, 129, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`
        }}>
          {statusText}
        </div>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          letterSpacing: '1px',
          marginTop: '2px'
        }}>
          {countdownText}
        </div>

        {/* Real Live Tickers */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginTop: '10px'
        }}>
          {renderPill(spyQuote, 'SPY')}
          {renderPill(qqqQuote, 'QQQ')}
          {renderPill(btcQuote, 'BTC')}
        </div>
      </div>
    </div>
  );
}
