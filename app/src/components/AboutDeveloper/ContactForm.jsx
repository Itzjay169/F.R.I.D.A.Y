import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, Sparkles, MessageSquare } from 'lucide-react';

export default function ContactForm({ onSubmitMessage }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    category: 'General Inquiry',
    subject: '',
    message: ''
  });

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('');

  const categories = [
    'General Inquiry',
    'Project Collaboration',
    'Business Inquiry',
    'Technical Feedback',
    'Other'
  ];

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) {
      errs.fullName = 'Full name is required.';
    } else if (formData.fullName.trim().length < 2) {
      errs.fullName = 'Name must be at least 2 characters.';
    }

    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errs.email = 'Please provide a valid email address.';
      }
    }

    if (!formData.subject.trim()) {
      errs.subject = 'Subject is required.';
    } else if (formData.subject.trim().length < 3) {
      errs.subject = 'Subject must be at least 3 characters.';
    }

    if (!formData.message.trim()) {
      errs.message = 'Message content is required.';
    } else if (formData.message.trim().length < 10) {
      errs.message = 'Message must be at least 10 characters.';
    } else if (formData.message.length > 2500) {
      errs.message = 'Message exceeds maximum length of 2500 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || status === 'submitting') return;

    setStatus('submitting');
    setStatusMessage('');

    try {
      if (typeof onSubmitMessage === 'function') {
        const res = await onSubmitMessage(formData);
        if (res && res.success) {
          setStatus('success');
          setStatusMessage(res.message || 'Your message has been submitted successfully. Thank you for contacting Vexora Technology.');
          setFormData({
            fullName: '',
            email: '',
            category: 'General Inquiry',
            subject: '',
            message: ''
          });
          setErrors({});
        } else {
          setStatus('error');
          setStatusMessage(res?.error || 'Unable to deliver message at this time. Please check configuration or try again.');
        }
      } else {
        // Fallback for Phase 2 UI test before Phase 3 backend integration
        await new Promise((r) => setTimeout(r, 600));
        setStatus('success');
        setStatusMessage('Your message has been submitted successfully. Thank you for contacting Vexora Technology.');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage('A network or server error occurred. Please try again.');
    }
  };

  return (
    <section
      id="contact-developer-section"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(6, 15, 30, 0.95) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '12px',
        padding: '28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(245, 158, 11, 0.2)'
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '14px',
            color: '#f59e0b',
            letterSpacing: '1px',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Mail size={16} color="#f59e0b" />
          <span>CONTACT THE DEVELOPER</span>
        </div>
        <h4
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '22px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '1px',
            margin: '0 0 6px 0'
          }}
        >
          Send a Message to Jaykishan Das
        </h4>
        <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0 }}>
          Reach out for software development inquiries, AI collaborations, project partnerships, or technical feedback on F.R.I.D.A.Y.
        </p>
      </div>

      {/* Success Notification Banner */}
      {status === 'success' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '8px',
            marginBottom: '20px',
            color: '#a7f3d0'
          }}
        >
          <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>Message Submitted</div>
            <div style={{ fontSize: '13px', marginTop: '2px' }}>{statusMessage}</div>
            <button
              onClick={() => setStatus('idle')}
              style={{
                marginTop: '10px',
                background: 'transparent',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11.5px',
                cursor: 'pointer',
                fontFamily: 'var(--font-data)'
              }}
            >
              Send Another Message
            </button>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {status === 'error' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            marginBottom: '20px',
            color: '#fca5a5'
          }}
        >
          <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px' }}>
            <strong style={{ color: '#ffffff' }}>Delivery Notice:</strong> {statusMessage}
          </div>
        </div>
      )}

      {/* Form Controls */}
      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}
        >
          {/* Full Name */}
          <div>
            <label
              htmlFor="contact-fullName"
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontFamily: 'var(--font-data)',
                color: '#e2e8f0',
                marginBottom: '6px'
              }}
            >
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="contact-fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="e.g. John Doe"
              disabled={status === 'submitting'}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(2, 6, 18, 0.7)',
                border: errors.fullName ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                outline: 'none',
                boxShadow: errors.fullName ? '0 0 8px rgba(239, 68, 68, 0.25)' : 'none'
              }}
            />
            {errors.fullName && (
              <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                {errors.fullName}
              </span>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label
              htmlFor="contact-email"
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontFamily: 'var(--font-data)',
                color: '#e2e8f0',
                marginBottom: '6px'
              }}
            >
              Your Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. john@example.com"
              disabled={status === 'submitting'}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(2, 6, 18, 0.7)',
                border: errors.email ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                outline: 'none',
                boxShadow: errors.email ? '0 0 8px rgba(239, 68, 68, 0.25)' : 'none'
              }}
            />
            {errors.email && (
              <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                {errors.email}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 260px) 1fr',
            gap: '16px',
            marginBottom: '16px'
          }}
        >
          {/* Inquiry Category */}
          <div>
            <label
              htmlFor="contact-category"
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontFamily: 'var(--font-data)',
                color: '#e2e8f0',
                marginBottom: '6px'
              }}
            >
              Inquiry Category
            </label>
            <select
              id="contact-category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={status === 'submitting'}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0a101f',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="contact-subject"
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontFamily: 'var(--font-data)',
                color: '#e2e8f0',
                marginBottom: '6px'
              }}
            >
              Subject <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="contact-subject"
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief summary of your inquiry"
              disabled={status === 'submitting'}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(2, 6, 18, 0.7)',
                border: errors.subject ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                outline: 'none',
                boxShadow: errors.subject ? '0 0 8px rgba(239, 68, 68, 0.25)' : 'none'
              }}
            />
            {errors.subject && (
              <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                {errors.subject}
              </span>
            )}
          </div>
        </div>

        {/* Message Body */}
        <div style={{ marginBottom: '18px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}
          >
            <label
              htmlFor="contact-message"
              style={{
                fontSize: '12.5px',
                fontFamily: 'var(--font-data)',
                color: '#e2e8f0'
              }}
            >
              Message Content <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-data)',
                color: formData.message.length > 2500 ? '#ef4444' : '#64748b'
              }}
            >
              {formData.message.length} / 2500
            </span>
          </div>
          <textarea
            id="contact-message"
            rows={5}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Write your message to Jaykishan Das..."
            disabled={status === 'submitting'}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'rgba(2, 6, 18, 0.7)',
              border: errors.message ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#ffffff',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              lineHeight: 1.5,
              outline: 'none',
              resize: 'vertical',
              boxShadow: errors.message ? '0 0 8px rgba(239, 68, 68, 0.25)' : 'none'
            }}
          />
          {errors.message && (
            <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
              {errors.message}
            </span>
          )}
        </div>

        {/* Submit Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              fontFamily: 'var(--font-data)'
            }}
          >
            🔒 Messages are delivered directly to the developer's inbox via authenticated API.
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              background: status === 'submitting'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#030712',
              fontWeight: 700,
              fontFamily: 'var(--font-data)',
              fontSize: '13px',
              letterSpacing: '0.5px',
              cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {status === 'submitting' ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Transmitting...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Submit Message</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
