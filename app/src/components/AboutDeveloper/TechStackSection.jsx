import React from 'react';
import { DEVELOPER_CONFIG } from '../../../../shared/developerConfig.js';
import { Code, Terminal, Database, Shield, Radio, BarChart3, CheckCircle } from 'lucide-react';

export default function TechStackSection() {
  const { techStack } = DEVELOPER_CONFIG;

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
      <div style={{ marginBottom: '18px' }}>
        <div
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '14px',
            color: '#38bdf8',
            letterSpacing: '1px',
            marginBottom: '4px'
          }}
        >
          VERIFIED PRODUCTION TECH STACK
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
          Strictly verified frameworks, runtime environments, and native protocols confirmed in the F.R.I.D.A.Y. codebase.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '14px'
        }}
      >
        {techStack.map((tech, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '10.5px',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {tech.category}
              </span>

              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '9.5px',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '1px 6px',
                  borderRadius: '3px'
                }}
              >
                {tech.badge}
              </span>
            </div>

            <h5
              style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '14px',
                fontWeight: 700,
                color: '#ffffff',
                margin: '2px 0 0 0'
              }}
            >
              {tech.name}
            </h5>

            <p
              style={{
                fontSize: '12px',
                color: '#cbd5e1',
                lineHeight: 1.5,
                margin: 0
              }}
            >
              {tech.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
