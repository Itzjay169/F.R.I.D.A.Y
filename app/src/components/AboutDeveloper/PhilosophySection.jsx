import React from 'react';
import { DEVELOPER_CONFIG } from '../../../../shared/developerConfig.js';
import { ShieldCheck, CheckCircle, Boxes, Sparkles } from 'lucide-react';

export default function PhilosophySection() {
  const { philosophy } = DEVELOPER_CONFIG;

  const getPhilosophyIcon = (iconName) => {
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck size={24} color="#f59e0b" />;
      case 'CheckCircle':
        return <CheckCircle size={24} color="#10b981" />;
      case 'Boxes':
        return <Boxes size={24} color="#38bdf8" />;
      case 'Sparkles':
        return <Sparkles size={24} color="#a855f7" />;
      default:
        return <ShieldCheck size={24} color="#f59e0b" />;
    }
  };

  return (
    <section
      style={{
        background: 'rgba(6, 15, 30, 0.75)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
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
            color: '#f59e0b',
            letterSpacing: '1px',
            marginBottom: '4px'
          }}
        >
          ENGINEERING & DEVELOPMENT PHILOSOPHY
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
          Core architectural principles guiding Jaykishan Das and Vexora Technology.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}
      >
        {philosophy.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(6, 15, 30, 0.7) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'transform 0.2s ease, border-color 0.2s ease'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {getPhilosophyIcon(item.icon)}
            </div>

            <div>
              <h4
                style={{
                  fontFamily: 'var(--font-hud)',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.5px',
                  margin: '0 0 2px 0'
                }}
              >
                {item.title}
              </h4>
              <div
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  color: '#f59e0b',
                  letterSpacing: '0.5px'
                }}
              >
                {item.tagline}
              </div>
            </div>

            <p
              style={{
                fontSize: '13px',
                color: '#cbd5e1',
                lineHeight: 1.55,
                margin: 0
              }}
            >
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
