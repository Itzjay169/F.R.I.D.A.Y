import React from 'react';

export default function MarketPulse({ items = [] }) {
  return (
    <div className="hud-panel" style={{ padding: '10px 12px' }}>
      <div className="panel-header" style={{ margin: '-10px -12px 10px -12px' }}>
        <div className="panel-title">
          <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--neon-cyan)', display: 'inline-block' }} />
          MARKET PULSE
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span className="badge badge-streaming">FINNHUB LIVE</span>
          <span className="badge badge-live">LIVE</span>
        </div>
      </div>

      {/* 4 Circular Arc Meters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        alignItems: 'center',
        padding: '4px 0 8px 0'
      }}>
        {items.map((item) => {
          const hasValidPrice = typeof item.price === 'number' && item.price > 0;
          const hasValidChange = typeof item.changePct === 'number';
          const isNegative = hasValidChange ? item.changePct < 0 : false;
          const arcColor = !hasValidChange ? 'var(--text-dim)' : isNegative ? 'var(--neon-red)' : 'var(--neon-green)';
          const formattedVal = hasValidChange ? (item.changePct > 0 ? '+' : '') + item.changePct.toFixed(2) : '—';
          
          // SVG Circle calculations
          const radius = 24;
          const strokeWidth = 3;
          const circumference = 2 * Math.PI * radius;
          const absChange = hasValidChange ? Math.abs(item.changePct) : 0;
          const strokeDashoffset = circumference - (Math.min(absChange / 5, 1) * circumference * 0.75);

          return (
            <div key={item.symbol} style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '56px', height: '56px', margin: '0 auto' }}>
                <svg width="56" height="56" viewBox="0 0 56 56">
                  {/* Background Track */}
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    fill="rgba(10, 20, 35, 0.6)"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth={strokeWidth}
                  />
                  {/* Colored Meter Arc */}
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    fill="none"
                    stroke={arcColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={hasValidChange ? strokeDashoffset : circumference}
                    strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                    style={{
                      filter: `drop-shadow(0 0 4px ${arcColor})`,
                      transition: 'stroke-dashoffset 0.8s ease'
                    }}
                  />
                  {/* Subtle inner glow */}
                  <circle
                    cx="28"
                    cy="28"
                    r={radius - 4}
                    fill={!hasValidChange ? 'transparent' : isNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}
                  />
                </svg>

                {/* Centered Percentage Text */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-data)',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: !hasValidChange ? 'var(--text-muted)' : isNegative ? '#fca5a5' : '#86efac'
                }}>
                  {formattedVal}
                </div>
              </div>

              {/* Ticker Symbol & Live Price */}
              <div style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '1px',
                color: 'var(--text-muted)',
                marginTop: '4px'
              }}>
                {item.symbol}
              </div>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: '8px',
                color: 'var(--text-primary)',
                opacity: 0.8
              }}>
                {hasValidPrice ? `$${item.price.toFixed(item.price > 1000 ? 0 : 2)}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
