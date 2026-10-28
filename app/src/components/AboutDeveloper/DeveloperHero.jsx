import React from 'react';
import { DEVELOPER_CONFIG } from '../../../../shared/developerConfig.js';
import { Mail, ExternalLink, Terminal, Sparkles, MapPin } from 'lucide-react';

function GithubIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export default function DeveloperHero({ onScrollToContact }) {
  const { developer } = DEVELOPER_CONFIG;

  return (
    <section
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(6, 15, 30, 0.9) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '12px',
        padding: '28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(245, 158, 11, 0.2)',
        overflow: 'hidden'
      }}
    >
      {/* Background cyber accent glow */}
      <div
        style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          borderRadius: '50%'
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '28px',
          alignItems: 'center'
        }}
      >
        {/* Futuristic Developer Avatar */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              width: '130px',
              height: '130px',
              borderRadius: '20px',
              padding: '3px',
              background: 'linear-gradient(135deg, #f59e0b, #00f0ff, #0a1830)',
              boxShadow: '0 0 24px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '17px',
                background: 'radial-gradient(circle at 30% 30%, #1e293b 0%, #030712 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Monogram / Cyber Graphic */}
              <div
                style={{
                  fontFamily: 'var(--font-hud)',
                  fontSize: '42px',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #38bdf8 60%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 16px rgba(0, 240, 255, 0.4)'
                }}
              >
                JD
              </div>
              <div
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-data)',
                  color: '#f59e0b',
                  letterSpacing: '1px',
                  marginTop: '-4px'
                }}
              >
                DEVELOPER
              </div>
            </div>
          </div>

          {/* Active Status Beacon */}
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              background: '#030712',
              border: '2px solid #10b981',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px #10b981'
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981'
              }}
            />
          </div>
        </div>

        {/* Developer Info & Bio */}
        <div>
          {/* Tag / Identity Hierarchy */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '6px'
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '2px 10px',
                borderRadius: '4px',
                letterSpacing: '1px'
              }}
            >
              LEAD ARCHITECT
            </span>
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={12} color="#00f0ff" />
              Creator of F.R.I.D.A.Y.
            </span>
          </div>

          {/* Developer Name */}
          <h2
            style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '2px',
              color: '#ffffff',
              margin: '2px 0 6px 0',
              textShadow: '0 0 16px rgba(255, 255, 255, 0.3)'
            }}
          >
            {developer.name}
          </h2>

          {/* Roles & Subtitle */}
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '13px',
              color: '#38bdf8',
              letterSpacing: '0.8px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <span>{developer.role}</span>
          </div>

          {/* Professional Introduction */}
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.65,
              color: '#cbd5e1',
              maxWidth: '820px',
              margin: '0 0 18px 0',
              fontFamily: 'var(--font-ui)'
            }}
          >
            {developer.introduction}
          </p>

          {/* Social Links & Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            {/* GitHub */}
            <a
              href={developer.socialLinks.github}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                borderRadius: '6px',
                fontFamily: 'var(--font-data)',
                fontSize: '12px',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <GithubIcon size={15} />
              <span>GitHub / Itz30jay</span>
              <ExternalLink size={12} color="#94a3b8" />
            </a>

            {/* LinkedIn */}
            <a
              href={developer.socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 14px',
                background: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                color: '#38bdf8',
                borderRadius: '6px',
                fontFamily: 'var(--font-data)',
                fontSize: '12px',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <LinkedinIcon size={15} />
              <span>LinkedIn / jaykishandas</span>
              <ExternalLink size={12} color="#38bdf8" />
            </a>

            {/* Contact Action Button */}
            <button
              onClick={onScrollToContact}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.25) 100%)',
                border: '1px solid #f59e0b',
                color: '#fef3c7',
                borderRadius: '6px',
                fontFamily: 'var(--font-data)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <Mail size={14} color="#f59e0b" />
              <span>Contact Developer</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
