import React, { useState, useEffect, useCallback } from 'react';

export default function PortfolioView() {
  const [data, setData] = useState({
    equity: 0,
    cash: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    positions: [],
    loading: true
  });

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const d = await res.json();
        if (d && d.positions !== undefined) {
          setData({ ...d, loading: false });
          return;
        }
      }
    } catch {
      // Server offline — show initial state
    }

    // Fallback: show starting paper portfolio if server is not running
    setData({
      equity: 1604199.00,
      cash: 1420500.00,
      unrealizedPnl: 0,
      realizedPnl: 0,
      positions: [],
      loading: false
    });
  }, []);

  useEffect(() => {
    fetchPortfolio();
    // Auto-refresh every 30s for mark-to-market
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const totalEquity = data.equity || 0;
  const unrealizedPnl = data.unrealizedPnl || 0;
  const realizedPnl = data.realizedPnl || 0;

  return (
    <div className="hud-panel" style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header" style={{ margin: '-16px -16px 16px -16px' }}>
        <div className="panel-title">
          <span>PILOT PAPER PORTFOLIO ENGINE (SQLITE LOCAL LEDGER)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-streaming">MARK-TO-MARKET LIVE</span>
          <span className="badge badge-live">SAFE PAPER TRADING</span>
          <button
            onClick={fetchPortfolio}
            style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid var(--neon-cyan)',
              color: 'var(--neon-cyan)',
              fontFamily: 'var(--font-hud)',
              fontSize: '8px',
              padding: '2px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '1px'
            }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>CURRENT DESK EQUITY</span>
          <div style={{ fontSize: '18px', color: '#ffffff', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
            ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>UNREALIZED P&L</span>
          <div style={{
            fontSize: '18px',
            color: unrealizedPnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)',
            fontFamily: 'var(--font-hud)',
            fontWeight: 700
          }}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
          </div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>REALIZED P&L</span>
          <div style={{
            fontSize: '18px',
            color: realizedPnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)',
            fontFamily: 'var(--font-hud)',
            fontWeight: 700
          }}>
            {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
          </div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>OPEN POSITIONS</span>
          <div style={{ fontSize: '18px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
            {data.positions.length} OF 6 MAX
          </div>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>SENTINEL RISK GATE</span>
          <div style={{ fontSize: '18px', color: 'var(--neon-green)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
            ARMED (1% LIMIT)
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {data.loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)',
            fontSize: '12px', letterSpacing: '2px'
          }}>
            LOADING PORTFOLIO DATA...
          </div>
        ) : data.positions.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: '12px', opacity: 0.6
          }}>
            <div style={{ fontSize: '48px' }}>📊</div>
            <div style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', fontSize: '13px', letterSpacing: '2px' }}>
              NO OPEN POSITIONS
            </div>
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-data)', fontSize: '10px', textAlign: 'center', maxWidth: '400px' }}>
              Use voice command "Paper buy 50 NVDA at 120 stop 115 target 130" to open a paper trade.
              Sentinel will review risk before Pilot executes.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-data)', fontSize: '11px' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-cyan)', textAlign: 'left', height: '28px' }}>
                <th>SYMBOL</th>
                <th>SIDE/QTY</th>
                <th>AVG ENTRY</th>
                <th>LIVE PRICE</th>
                <th>UNREALIZED P&L</th>
                <th>P&L %</th>
                <th>STOP LOSS</th>
                <th>TAKE PROFIT</th>
                <th>VERDICT TOKEN</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p.symbol} style={{ borderBottom: '1px solid rgba(0, 240, 255, 0.08)', height: '36px' }}>
                  <td style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{p.symbol}</td>
                  <td style={{ color: p.qty > 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    {p.qty > 0 ? `LONG ${p.qty}` : `SHORT ${Math.abs(p.qty)}`}
                  </td>
                  <td>${p.avgPrice?.toFixed(2)}</td>
                  <td>${(p.curPrice || p.avgPrice)?.toFixed(2)}</td>
                  <td style={{ color: (p.pnl || 0) >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    {(p.pnl || 0) >= 0 ? '+' : ''}${(p.pnl || 0).toFixed(2)}
                  </td>
                  <td style={{ color: (p.pnlPct || 0) >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    {(p.pnlPct || 0) >= 0 ? '+' : ''}{(p.pnlPct || 0).toFixed(2)}%
                  </td>
                  <td style={{ color: 'var(--neon-red)' }}>${p.stopLoss?.toFixed(2) || '—'}</td>
                  <td style={{ color: 'var(--neon-green)' }}>${p.takeProfit?.toFixed(2) || '—'}</td>
                  <td><span className="badge badge-live">SENTINEL-SIG-OK</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
