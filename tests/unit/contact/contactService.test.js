import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateContactInput,
  sanitizeHeader,
  escapeHtml,
  buildEmailTemplates,
  sendContactMessage,
  contactRateLimiter,
  ALLOWED_CATEGORIES
} from '../../../services/contactService.js';

describe('Contact Service — Input Validation & Sanitization (Phase 3)', () => {
  it('validates a completely valid contact payload', () => {
    const payload = {
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      category: 'Project Collaboration',
      subject: 'Building AI Agent Workflow',
      message: 'Hello Jaykishan, I would like to collaborate on an autonomous trading agent.'
    };

    const res = validateContactInput(payload);
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual({});
    expect(res.sanitized.fullName).toBe('Alice Smith');
    expect(res.sanitized.email).toBe('alice@example.com');
    expect(res.sanitized.category).toBe('Project Collaboration');
  });

  it('rejects missing required fields (fullName, email, subject, message)', () => {
    const res = validateContactInput({});
    expect(res.isValid).toBe(false);
    expect(res.errors.fullName).toBeDefined();
    expect(res.errors.email).toBeDefined();
    expect(res.errors.subject).toBeDefined();
    expect(res.errors.message).toBeDefined();
  });

  it('rejects an invalid email address', () => {
    const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', 'user@domain..com'];
    for (const email of invalidEmails) {
      const res = validateContactInput({
        fullName: 'Test User',
        email,
        subject: 'Valid Subject',
        message: 'This is a long enough message.'
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.email).toBe('Please provide a valid email address.');
    }
  });

  it('rejects excessively long messages (> 2500 characters)', () => {
    const longMessage = 'A'.repeat(2501);
    const res = validateContactInput({
      fullName: 'Test User',
      email: 'user@example.com',
      subject: 'Valid Subject',
      message: longMessage
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.message).toContain('exceeds maximum length');
  });

  it('rejects excessively short messages (< 10 characters)', () => {
    const res = validateContactInput({
      fullName: 'Test User',
      email: 'user@example.com',
      subject: 'Valid Subject',
      message: 'Too short'
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.message).toContain('at least 10 characters');
  });

  it('prevents email header injection by stripping carriage returns and newlines', () => {
    const maliciousHeader = 'Injected Subject\r\nBcc: victim@example.com\nTo: hacker@evil.com';
    const sanitized = sanitizeHeader(maliciousHeader);
    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).toBe('Injected Subject  Bcc: victim@example.com To: hacker@evil.com');
  });

  it('escapes HTML characters to prevent XSS and HTML injection in email templates', () => {
    const dirty = '<script>alert("xss")</script> & "quotes"';
    const clean = escapeHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('&lt;script&gt;');
    expect(clean).toContain('&amp;');
    expect(clean).toContain('&quot;');
  });

  it('detects and intercepts bot honeypot traps', () => {
    const res = validateContactInput({
      fullName: 'Bot User',
      email: 'bot@example.com',
      subject: 'Spam Subject',
      message: 'Buy cheap items now!',
      website: 'http://spam.evil.com' // Honeypot field filled by bot
    });
    expect(res.isValid).toBe(false);
    expect(res.isSpam).toBe(true);
  });
});

describe('Contact Rate Limiter & Spam Protection (Phase 3)', () => {
  beforeEach(() => {
    contactRateLimiter.reset();
  });

  it('enforces cooldown period between rapid submissions', () => {
    const client = 'client_192.168.1.1';
    // 1st submission
    const check1 = contactRateLimiter.check(client);
    expect(check1.allowed).toBe(true);
    contactRateLimiter.record(client);

    // Immediate 2nd submission (within 5 seconds)
    const check2 = contactRateLimiter.check(client);
    expect(check2.allowed).toBe(false);
    expect(check2.error).toContain('wait a few seconds');
  });

  it('enforces maximum 3 submissions per sliding window', () => {
    const client = 'client_192.168.1.2';

    // Simulate 3 allowed submissions spaced past cooldown
    contactRateLimiter.record(client);
    contactRateLimiter.lastSubmission.set(client, Date.now() - 6000); // simulate 6s elapsed
    contactRateLimiter.record(client);
    contactRateLimiter.lastSubmission.set(client, Date.now() - 6000);
    contactRateLimiter.record(client);
    contactRateLimiter.lastSubmission.set(client, Date.now() - 6000);

    // 4th submission in same window
    const check4 = contactRateLimiter.check(client);
    expect(check4.allowed).toBe(false);
    expect(check4.error).toContain('limit reached');
  });
});

describe('Email Delivery Dispatcher & Mock Delivery (Phase 3)', () => {
  beforeEach(() => {
    contactRateLimiter.reset();
  });

  it('delivers successfully in mock mode without needing live external credentials', async () => {
    const payload = {
      fullName: 'Jaykishan Test',
      email: 'tester@example.com',
      category: 'Technical Feedback',
      subject: 'Testing Mock Pipeline',
      message: 'Verifying end-to-end contact delivery flow.'
    };

    const res = await sendContactMessage(payload, 'test_runner', { mockProvider: true });
    expect(res.success).toBe(true);
    expect(res.messageId).toBeDefined();
    expect(res.message).toContain('Your message has been submitted successfully');
  });

  it('fails safely and honestly when recipient or credentials are not configured', async () => {
    const originalEnv = { ...process.env };
    delete process.env.CONTACT_RECEIVER_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_API_KEY;
    delete process.env.WEB_FORM_API_KEY;
    delete process.env.WEB3FORMS_ACCESS_KEY;
    delete process.env.WEB_FORM_API_URL;
    delete process.env.FORMSPREE_URL;

    try {
      const payload = {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        category: 'Business Inquiry',
        subject: 'Inquiry',
        message: 'This is a genuine business inquiry.'
      };

      const res = await sendContactMessage(payload, 'test_unconfigured');
      expect(res.success).toBe(false);
      expect(res.unconfigured).toBe(true);
      expect(res.error).toContain('CONTACT_RECEIVER_EMAIL');
    } finally {
      process.env = originalEnv;
    }
  });

  it('builds HTML & plaintext templates with proper submission ID and sender information', () => {
    const { textBody, htmlBody } = buildEmailTemplates({
      fullName: 'Alice Developer',
      email: 'alice@example.com',
      category: 'Project Collaboration',
      subject: 'Collaborative Trading Desk',
      message: 'Let us build something great together.',
      submissionId: 'VEX-TEST-123',
      timestamp: '2026-10-28T10:00:00.000Z'
    });

    expect(textBody).toContain('Vexora Technology');
    expect(textBody).toContain('Alice Developer');
    expect(textBody).toContain('alice@example.com');
    expect(textBody).toContain('VEX-TEST-123');
    expect(htmlBody).toContain('Vexora Technology');
    expect(htmlBody).toContain('Alice Developer');
    expect(htmlBody).toContain('VEX-TEST-123');
  });

  it('never exposes API keys or internal secrets in returned payload', async () => {
    const payload = {
      fullName: 'Security Auditor',
      email: 'auditor@example.com',
      category: 'Other',
      subject: 'Security Audit Check',
      message: 'Checking for secret exposure in response objects.'
    };

    const res = await sendContactMessage(payload, 'auditor_client', { mockProvider: true });
    const stringified = JSON.stringify(res);
    expect(stringified).not.toContain('AIzaSy');
    expect(stringified).not.toContain('re_');
    expect(stringified).not.toContain('sk_');
    expect(stringified).not.toContain('dbg5ou');
  });

  it('delivers via Web Form API (Web3Forms/Formspree) when configured', async () => {
    const originalEnv = { ...process.env };
    process.env.CONTACT_RECEIVER_EMAIL = 'magicianbusiness30@gmail.com';
    process.env.WEB_FORM_API_KEY = 'test_access_key_123';
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_API_KEY;

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Message submitted via Web3Forms' })
    });

    try {
      const payload = {
        fullName: 'Web Form Tester',
        email: 'tester@example.com',
        category: 'Business Inquiry',
        subject: 'Testing Web Form API Pipeline',
        message: 'Direct dispatch through web form endpoint.'
      };

      const res = await sendContactMessage(payload, 'web_form_client');
      expect(res.success).toBe(true);
      expect(res.message).toContain('submitted successfully');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.web3forms.com/submit',
        expect.objectContaining({
          method: 'POST'
        })
      );
    } finally {
      fetchSpy.mockRestore();
      process.env = originalEnv;
    }
  });
});
