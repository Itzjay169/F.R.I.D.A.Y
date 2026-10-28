import React from 'react';
import { getCapabilities } from '../services/chartService.js';

export default function HealthModal({ onClose }) {
  const caps = getCapabilities();
  const c = caps?.capabilities || {};

  const capabilityList = [
    { key: 'symbol_control', label: 'Symbol Control', cap: c.symbol_control },
    { key: 'timeframe_control', label: 'Timeframe Control', cap: c.timeframe_control },
    { key: 'chart_type_control', label: 'Chart Type Control', cap: c.chart_type_control },
    { key: 'indicators', label: 'Indicators / Studies', cap: c.indicators },
    { key: 'drawings', label: 'Drawings & Overlays', cap: c.drawings },
    { key: 'layouts_panes', label: 'Layouts / Panes', cap: c.layouts_panes },
    { key: 'replay', label: 'Replay / Bar Replay', cap: c.replay },
    { key: 'alerts', label: 'Alerts Engine', cap: c.alerts },
    { key: 'pine_script', label: 'Pine Script', cap: c.pine_script },
    { key: 'screenshots', label: 'Screenshots / Export', cap: c.screenshots },
    { key: 'paper_order_mirroring', label: 'Paper-Order Mirroring', cap: c.paper_order_mirroring }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(2, 6, 18, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100000,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(8, 16, 32, 0.98) 0%, rgba(4, 10, 22, 0.99) 100%)',
        border: '1px solid var(--border-cyan)',
        borderRadius: '6px',
        width: '800px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 40px rgba(0, 240, 255, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-cyan)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 240, 255, 0.05)'
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '13px',
              fontWeight: 800,
              color: 'var(--neon-cyan)',
              letterSpacing: '1.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🛡️ SYSTEM HEALTH // CHART & DESK CAPABILITIES AUDIT</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-data)',
              fontSize: '9.5px',
              color: 'var(--text-muted)',
              marginTop: '2px'
            }}>
              PRIMARY TARGET: TRADINGVIEW MCP · ACTIVE PROVIDER: EMBEDDED ADVANCED CHARTS
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid var(--neon-red)',
              color: 'var(--neon-red)',
              fontFamily: 'var(--font-hud)',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '16px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Active Integration Status Banner */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            borderRadius: '4px',
            padding: '10px 14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px'
          }}>
            <div>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>ACTIVE CHART MODE</span>
              <div style={{ fontSize: '11px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', fontWeight: 700, marginTop: '2px' }}>
                PRIORITY 2: ADVANCED CHARTS
              </div>
            </div>
            <div>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>TRADINGVIEW DESKTOP MCP</span>
              <div style={{ fontSize: '11px', color: 'var(--neon-amber)', fontFamily: 'var(--font-hud)', fontWeight: 700, marginTop: '2px' }}>
                OFFLINE (FALLBACK 2 ACTIVE)
              </div>
            </div>
            <div>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>LEDGER SOURCE OF TRUTH</span>
              <div style={{ fontSize: '11px', color: 'var(--neon-green)', fontFamily: 'var(--font-hud)', fontWeight: 700, marginTop: '2px' }}>
                F.R.I.D.A.Y. LOCAL PAPER ENGINE
              </div>
            </div>
          </div>

          {/* Capabilities Grid */}
          <div>
            <div style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '10px',
              color: 'var(--neon-cyan)',
              letterSpacing: '1px',
              marginBottom: '8px'
            }}>
              CAPABILITY MATRIX // AUDITED STATUS
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              {capabilityList.map(({ key, label, cap }) => {
                const isOnline = cap?.status === 'ONLINE';
                const isSimulated = cap?.status === 'SIMULATED_FALLBACK';
                const isUnsupported = cap?.status === 'UNSUPPORTED_DISCLOSED';

                const statusColor = isOnline ? 'var(--neon-green)' : (isSimulated ? 'var(--neon-amber)' : 'var(--neon-red)');
                const statusBadgeBg = isOnline ? 'rgba(16, 185, 129, 0.2)' : (isSimulated ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)');

                return (
                  <div
                    key={key}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9.5px', color: '#ffffff', fontWeight: 700 }}>
                        {label}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: '8px',
                        padding: '1px 6px',
                        borderRadius: '2px',
                        fontWeight: 700,
                        background: statusBadgeBg,
                        color: statusColor,
                        border: `1px solid ${statusColor}`
                      }}>
                        {cap?.status || 'UNKNOWN'}
                      </span>
                    </div>

                    <div style={{ fontSize: '8.5px', color: '#94a3b8', fontFamily: 'var(--font-data)', lineHeight: 1.3 }}>
                      {cap?.description}
                    </div>

                    {cap?.limitation && (
                      <div style={{ fontSize: '8px', color: 'var(--neon-amber)', fontFamily: 'var(--font-data)', fontStyle: 'italic', marginTop: '2px' }}>
                        ⚠️ {cap.limitation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Important Honesty Disclosures Box */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '4px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9px', color: 'var(--neon-amber)', fontWeight: 700 }}>
              ⚖️ MANDATORY HONESTY PROTOCOL & SAFETY RULES
            </span>
            <ul style={{
              margin: '0',
              paddingLeft: '16px',
              fontSize: '8.5px',
              fontFamily: 'var(--font-data)',
              color: '#cbd5e1',
              lineHeight: 1.4
            }}>
              <li>TradingView official MCP supports market data and screener queries, but does not expose programmatic chart drawings or Pine Script execution.</li>
              <li>F.R.I.D.A.Y. embeds TradingView Advanced Charts with a dedicated trade overlay engine for support/resistance, Fibonacci, and bracket overlays.</li>
              <li>The local paper engine is the strict source of truth for positions, fills, stops, and P&L. Chart actions are visualization only.</li>
              <li>Analysis agents (Athena, Chartist, Oracle, Atlas) cannot place or modify orders. Only Pilot (with Sentinel cryptographic approval) can execute trades.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-cyan)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0, 0, 0, 0.4)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid var(--neon-cyan)',
              color: 'var(--neon-cyan)',
              fontFamily: 'var(--font-hud)',
              fontSize: '9.5px',
              padding: '6px 16px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            DISMISS HEALTH PANEL
          </button>
        </div>
      </div>
    </div>
  );
}
