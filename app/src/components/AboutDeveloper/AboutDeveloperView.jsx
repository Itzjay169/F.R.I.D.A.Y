import React, { useRef } from 'react';
import DeveloperHero from './DeveloperHero.jsx';
import CompanyProfile from './CompanyProfile.jsx';
import ProductOverview from './ProductOverview.jsx';
import TechStackSection from './TechStackSection.jsx';
import PhilosophySection from './PhilosophySection.jsx';
import ContactForm from './ContactForm.jsx';
import { DEVELOPER_CONFIG } from '../../../../shared/developerConfig.js';
import { ArrowLeft, Mail, ExternalLink, ShieldAlert, Sparkles, Building2, User } from 'lucide-react';

export default function AboutDeveloperView({ onBackToHud, onSendContactMessage }) {
  const contactRef = useRef(null);
  const { developer, company } = DEVELOPER_CONFIG;

  const handleScrollToContact = () => {
    if (contactRef.current) {
      contactRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        paddingRight: '6px',
        paddingBottom: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}
    >
      {/* Top Navigation & Action Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(6, 15, 30, 0.85)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBackToHud}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'var(--font-hud)',
              cursor: 'pointer',
              letterSpacing: '0.8px',
              transition: 'background 0.2s ease'
            }}
          >
            <ArrowLeft size={14} />
            <span>RETURN TO HUD</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '15px',
                fontWeight: 700,
                color: '#f59e0b',
                letterSpacing: '1.5px'
              }}
            >
              ABOUT DEVELOPER
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>·</span>
            <span
              style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '13px',
                color: '#38bdf8',
                letterSpacing: '1px'
              }}
            >
              VEXORA TECHNOLOGY
            </span>
          </div>
        </div>

        {/* Quick jump to contact */}
        <button
          onClick={handleScrollToContact}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fef3c7',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'var(--font-data)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Mail size={13} color="#f59e0b" />
          <span>Quick Contact</span>
        </button>
      </div>

      {/* 1. Developer Hero Section */}
      <DeveloperHero onScrollToContact={handleScrollToContact} />

      {/* 2. Vexora Technology Company Identity & Vision */}
      <CompanyProfile />

      {/* 3. F.R.I.D.A.Y. Product Overview & Architecture */}
      <ProductOverview />

      {/* 4. Verified Technology Stack */}
      <TechStackSection />

      {/* 5. Development Philosophy */}
      <PhilosophySection />

      {/* 6. Functional Contact Form */}
      <div ref={contactRef}>
        <ContactForm onSubmitMessage={onSendContactMessage} />
      </div>

      {/* 7. Footer: Social Links, Copyright & Disclaimer */}
      <footer
        style={{
          marginTop: '12px',
          padding: '24px 20px',
          background: 'rgba(3, 7, 18, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            fontSize: '12px',
            fontFamily: 'var(--font-data)'
          }}
        >
          <a
            href={developer.socialLinks.github}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            GitHub: {developer.name} <ExternalLink size={11} />
          </a>
          <span style={{ color: '#334155' }}>|</span>
          <a
            href={developer.socialLinks.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            LinkedIn: {developer.name} <ExternalLink size={11} />
          </a>
          {company.websiteUrl && (
            <>
              <span style={{ color: '#334155' }}>|</span>
              <a
                href={company.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#f59e0b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Vexora Website <ExternalLink size={11} />
              </a>
            </>
          )}
        </div>

        <div
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            color: '#64748b',
            lineHeight: 1.6,
            maxWidth: '750px'
          }}
        >
          <div>
            © {new Date().getFullYear()} {company.name}. All rights reserved. Created and maintained by {developer.name}.
          </div>
          <div style={{ marginTop: '4px', color: '#475569' }}>
            F.R.I.D.A.Y. is an independent AI research desk developed by Vexora Technology. For educational and paper-trading simulation purposes only.
          </div>
        </div>
      </footer>
    </div>
  );
}
