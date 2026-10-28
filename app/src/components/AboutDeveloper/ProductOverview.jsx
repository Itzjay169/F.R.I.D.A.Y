import React from 'react';
import { DEVELOPER_CONFIG } from '../../../../shared/developerConfig.js';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Cpu } from 'lucide-react';

export default function ProductOverview() {
  const { product } = DEVELOPER_CONFIG;

  const getStatusBadge = (statusType, label) => {
    if (statusType === 'working') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontFamily: 'var(--font-data)',
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '2px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}
        >
          <CheckCircle2 size={11} color="#10b981" />
          {label}
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          fontFamily: 'var(--font-data)',
          color: '#f59e0b',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          padding: '2px 8px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.8px'
        }}
      >
        <Clock size={11} color="#f59e0b" />
        {label}
      </span>
    );
  };

  return (
    <section
      style={{
        background: 'rgba(6, 15, 30, 0.75)',
        border: '1px solid rgba(0, 240, 255, 0.18)',
        borderRadius: '12px',
        padding: '28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Product Header */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            color: '#f59e0b',
            letterSpacing: '1.5px',
            fontWeight: 600,
            marginBottom: '4px'
          }}
        >
          {product.subtitle}
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--neon-cyan)',
            letterSpacing: '3px',
            margin: '0 0 10px 0',
            textShadow: '0 0 16px rgba(0, 240, 255, 0.4)'
          }}
        >
          {product.name}
        </h3>

        <p
          style={{
            fontSize: '14.5px',
            lineHeight: 1.6,
            color: '#cbd5e1',
            margin: 0,
            maxWidth: '900px'
          }}
        >
          {product.description}
        </p>
      </div>

      {/* Architecture & Feature Verification Matrix */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '13px',
            color: '#ffffff',
            letterSpacing: '1px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Cpu size={15} color="var(--neon-cyan)" />
          <span>SYSTEM ARCHITECTURE & CAPABILITY STATUS</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '10px'
          }}
        >
          {product.architecture.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(240px, 320px) auto 1fr',
                gap: '16px',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '6px'
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#f8fafc'
                }}
              >
                {item.feature}
              </div>

              <div>{getStatusBadge(item.statusType, item.status)}</div>

              <div
                style={{
                  fontSize: '12.5px',
                  color: '#94a3b8',
                  lineHeight: 1.45
                }}
              >
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mandatory Regulatory / Educational Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '12.5px',
          fontFamily: 'var(--font-data)'
        }}
      >
        <ShieldAlert size={18} color="#ef4444" style={{ flexShrink: 0 }} />
        <span>
          <strong>DISCLAIMER:</strong> {product.disclaimer}
        </span>
      </div>
    </section>
  );
}
