import React, { useState } from 'react';
import { DEVELOPER_CONFIG } from '../../../../shared/developerConfig.js';
import {
  Globe,
  Smartphone,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import VexoraLogo from '../../assets/vexora-logo.svg';

export default function CompanyProfile() {
  const { company } = DEVELOPER_CONFIG;
  const [isVisionExpanded, setIsVisionExpanded] = useState(false);

  const getFocusIcon = (iconName) => {
    switch (iconName) {
      case 'Globe':
        return <Globe size={24} color="#38bdf8" />;
      case 'Smartphone':
        return <Smartphone size={24} color="#a855f7" />;
      case 'Cpu':
        return <Cpu size={24} color="#00f0ff" />;
      case 'Layers':
        return <Layers size={24} color="#f59e0b" />;
      default:
        return <Sparkles size={24} color="#00f0ff" />;
    }
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
      {/* Company Identity Header Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '24px',
          alignItems: 'center',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Official Vexora Technology Logo */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '24px',
            background: 'radial-gradient(circle at 30% 30%, #161c2b 0%, #06080e 100%)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            boxShadow: '0 0 24px rgba(14, 165, 233, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px'
          }}
        >
          <img
            src={VexoraLogo}
            alt="Vexora Technology Official Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.5))'
            }}
          />
        </div>

        {/* Company Title, Tagline, Slogan */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              color: '#38bdf8',
              letterSpacing: '1.5px',
              fontWeight: 600,
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}
          >
            OFFICIAL COMPANY PROFILE
          </div>

          <h3
            style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '26px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '3px',
              margin: '0 0 4px 0',
              textShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
            }}
          >
            {company.name}
          </h3>

          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              color: '#94a3b8',
              letterSpacing: '0.5px',
              marginBottom: '6px'
            }}
          >
            <strong style={{ color: '#e2e8f0' }}>Tagline:</strong> “{company.tagline}”
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '3px 10px',
              borderRadius: '4px',
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              color: '#f59e0b'
            }}
          >
            <span>Slogan:</span>
            <strong>{company.slogan}</strong>
          </div>
        </div>
      </div>

      {/* Company Vision Section */}
      <div style={{ padding: '24px 0 20px 0' }}>
        <div
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '14px',
            color: '#f59e0b',
            letterSpacing: '1px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Award size={16} color="#f59e0b" />
          <span>COMPANY VISION</span>
        </div>

        <blockquote
          style={{
            margin: '0 0 16px 0',
            padding: '16px 20px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '0 8px 8px 0',
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#f8fafc',
            fontStyle: 'italic',
            fontFamily: 'var(--font-ui)'
          }}
        >
          “{company.vision}”
        </blockquote>

        {/* Expandable Extended Vision Button */}
        <button
          onClick={() => setIsVisionExpanded(!isVisionExpanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            fontFamily: 'var(--font-data)',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            padding: '4px 0',
            letterSpacing: '0.5px'
          }}
        >
          <span>{isVisionExpanded ? 'Hide Extended Vision' : 'Read Extended Company Vision'}</span>
          {isVisionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Collapsible Extended Vision Statement */}
        {isVisionExpanded && (
          <div
            style={{
              marginTop: '14px',
              padding: '18px 22px',
              background: 'rgba(2, 6, 18, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              fontSize: '13.5px',
              lineHeight: 1.7,
              color: '#cbd5e1'
            }}
          >
            {company.extendedVision.map((paragraph, index) => (
              <p key={index} style={{ margin: index === 0 ? '0 0 12px 0' : '0 0 12px 0' }}>
                {paragraph}
              </p>
            ))}

            <div
              style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontFamily: 'var(--font-hud)',
                fontSize: '13px',
                color: '#f59e0b',
                letterSpacing: '1px',
                textAlign: 'right'
              }}
            >
              {company.closingSlogan}
            </div>
          </div>
        )}
      </div>

      {/* Focus Areas Section */}
      <div style={{ paddingTop: '10px' }}>
        <div
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '14px',
            color: '#00f0ff',
            letterSpacing: '1px',
            marginBottom: '14px'
          }}
        >
          COMPANY FOCUS AREAS
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px'
          }}
        >
          {company.focusAreas.map((area) => (
            <div
              key={area.id}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                position: 'relative'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                {getFocusIcon(area.icon)}
              </div>

              <h4
                style={{
                  fontFamily: 'var(--font-hud)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.8px',
                  margin: '4px 0 0 0'
                }}
              >
                {area.title}
              </h4>

              <p
                style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                  lineHeight: 1.55,
                  margin: 0
                }}
              >
                {area.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
