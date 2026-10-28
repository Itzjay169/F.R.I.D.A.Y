/**
 * Contact Service — Secure Email Delivery & Input Sanitization
 * Handles visitor message dispatch to the developer (Jaykishan Das) via authenticated transactional API.
 *
 * Security Requirements:
 * - Keeps API keys exclusively in server / main process (never exposes to renderer).
 * - Strict field validation and email format verification.
 * - Header injection prevention (stripping CRLF from headers).
 * - Rate limiting & spam throttling.
 * - Fails safely with informative feedback when keys/recipient are unconfigured.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// Allowed inquiry categories
export const ALLOWED_CATEGORIES = [
  'General Inquiry',
  'Project Collaboration',
  'Business Inquiry',
  'Technical Feedback',
  'Other'
];

// In-Memory Rate Limiting & Cooldown Window
class ContactRateLimiter {
  constructor() {
    this.requests = new Map(); // clientKey -> Array of timestamps
    this.lastSubmission = new Map(); // clientKey -> last submission timestamp
    this.WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    this.MAX_PER_WINDOW = 3; // Maximum 3 messages per 10 minutes
    this.COOLDOWN_MS = 5 * 1000; // 5 seconds minimum between submits
  }

  check(clientKey = 'default') {
    const now = Date.now();

    // 1. Check minimum cooldown between submits
    const last = this.lastSubmission.get(clientKey);
    if (last && now - last < this.COOLDOWN_MS) {
      return {
        allowed: false,
        error: 'Please wait a few seconds before submitting again.'
      };
    }

    // 2. Sliding window check
    const timestamps = this.requests.get(clientKey) || [];
    const validTimestamps = timestamps.filter(ts => now - ts < this.WINDOW_MS);

    if (validTimestamps.length >= this.MAX_PER_WINDOW) {
      const oldest = validTimestamps[0];
      const waitMinutes = Math.ceil((this.WINDOW_MS - (now - oldest)) / 60000);
      return {
        allowed: false,
        error: `Submission limit reached. Please wait ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''} before sending another message.`
      };
    }

    return { allowed: true };
  }

  record(clientKey = 'default') {
    const now = Date.now();
    const timestamps = this.requests.get(clientKey) || [];
    const validTimestamps = timestamps.filter(ts => now - ts < this.WINDOW_MS);
    validTimestamps.push(now);
    this.requests.set(clientKey, validTimestamps);
    this.lastSubmission.set(clientKey, now);
  }

  reset() {
    this.requests.clear();
    this.lastSubmission.clear();
  }
}

export const contactRateLimiter = new ContactRateLimiter();

// In-Memory Operational Audit Log (Last 100 entries, no private message bodies stored)
export const operationalContactLog = [];

/**
 * Strips carriage returns and newlines to prevent email header injection
 */
export function sanitizeHeader(str = '') {
  return String(str).replace(/[\r\n\t]/g, ' ').trim();
}

/**
 * Basic HTML escaping for email template rendering
 */
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates and sanitizes raw contact form submission payload
 */
export function validateContactInput(payload = {}) {
  const errors = {};

  const fullName = sanitizeHeader(payload.fullName || '');
  const email = sanitizeHeader(payload.email || '');
  const subject = sanitizeHeader(payload.subject || '');
  const category = sanitizeHeader(payload.category || 'General Inquiry');
  const message = String(payload.message || '').trim();
  const honeypot = payload.website || payload.honeypot || ''; // Bot trap

  // 1. Bot honeypot check
  if (honeypot) {
    return {
      isValid: false,
      isSpam: true,
      errors: { bot: 'Spam detected.' }
    };
  }

  // 2. Full Name
  if (!fullName) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = 'Full name must be between 2 and 100 characters.';
  }

  // 3. Email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  if (!email) {
    errors.email = 'Email address is required.';
  } else if (email.length > 254 || email.includes('..') || !emailRegex.test(email)) {
    errors.email = 'Please provide a valid email address.';
  }

  // 4. Subject
  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length < 3 || subject.length > 200) {
    errors.subject = 'Subject must be between 3 and 200 characters.';
  }

  // 5. Category
  if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.category = `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`;
  }

  // 6. Message Body
  if (!message) {
    errors.message = 'Message content is required.';
  } else if (message.length < 10) {
    errors.message = 'Message must be at least 10 characters.';
  } else if (message.length > 2500) {
    errors.message = 'Message exceeds maximum length of 2500 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      fullName,
      email,
      subject,
      category: ALLOWED_CATEGORIES.includes(category) ? category : 'General Inquiry',
      message
    }
  };
}

/**
 * Builds HTML and Plaintext email templates with Vexora Technology branding
 */
export function buildEmailTemplates({ fullName, email, category, subject, message, submissionId, timestamp }) {
  const cleanName = escapeHtml(fullName);
  const cleanEmail = escapeHtml(email);
  const cleanCategory = escapeHtml(category);
  const cleanSubject = escapeHtml(subject);
  const cleanMessage = escapeHtml(message).replace(/\n/g, '<br/>');

  const textBody = `
======================================================
  NEW MESSAGE FROM F.R.I.D.A.Y. CONTACT FORM
  Vexora Technology — Developer Inbox
======================================================

Sender: ${fullName}
Reply-To: ${email}
Category: ${category}
Subject: ${subject}
Date: ${timestamp}
Submission ID: ${submissionId}

------------------------------------------------------
MESSAGE:
------------------------------------------------------
${message}

------------------------------------------------------
Delivered securely via F.R.I.D.A.Y. – The Trading Desk
Developer: Jaykishan Das | Vexora Technology
======================================================
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Message — Vexora Technology</title>
</head>
<body style="background-color: #030712; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #0b1329; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 2px solid #f59e0b; padding: 20px 24px;">
      <h2 style="margin: 0; color: #f59e0b; font-size: 18px; letter-spacing: 1.5px; text-transform: uppercase;">Vexora Technology</h2>
      <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">F.R.I.D.A.Y. — Trading Desk Developer Portal</div>
    </div>
    <div style="padding: 24px;">
      <div style="margin-bottom: 20px; padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid #1e293b; border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tr>
            <td style="color: #94a3b8; padding: 4px 0; width: 110px;"><strong>Sender:</strong></td>
            <td style="color: #ffffff; padding: 4px 0;">${cleanName}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;"><strong>Reply-To:</strong></td>
            <td style="color: #38bdf8; padding: 4px 0;"><a href="mailto:${cleanEmail}" style="color: #38bdf8; text-decoration: none;">${cleanEmail}</a></td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;"><strong>Category:</strong></td>
            <td style="color: #f59e0b; padding: 4px 0;">${cleanCategory}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;"><strong>Subject:</strong></td>
            <td style="color: #ffffff; padding: 4px 0;">${cleanSubject}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;"><strong>Timestamp:</strong></td>
            <td style="color: #64748b; padding: 4px 0;">${timestamp}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <h4 style="color: #e2e8f0; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Message Content:</h4>
        <div style="background: #030712; border: 1px solid #1e293b; border-radius: 6px; padding: 16px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          ${cleanMessage}
        </div>
      </div>

      <div style="border-top: 1px solid #1e293b; padding-top: 16px; font-size: 11.5px; color: #64748b; text-align: center;">
        Submission ID: <code style="color: #94a3b8;">${submissionId}</code> · Developer: Jaykishan Das
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

  return { textBody, htmlBody };
}

/**
 * Master contact submission handler
 */
export async function sendContactMessage(payload = {}, clientIdentifier = 'local_client', options = {}) {
  // 1. Validate payload
  const validation = validateContactInput(payload);
  if (!validation.isValid) {
    if (validation.isSpam) {
      // Return a simulated success to waste bot resources without dispatching
      return {
        success: true,
        message: 'Your message has been submitted successfully. Thank you for contacting Vexora Technology.'
      };
    }
    return {
      success: false,
      error: Object.values(validation.errors)[0] || 'Invalid submission data.',
      errors: validation.errors
    };
  }

  // 2. Check rate limit
  if (!options.bypassRateLimit) {
    const rateCheck = contactRateLimiter.check(clientIdentifier);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: rateCheck.error
      };
    }
  }

  const { fullName, email, category, subject, message } = validation.sanitized;
  const submissionId = `VEX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const timestamp = new Date().toISOString();

  // 3. Resolve Environment Configuration
  const recipientEmail = process.env.CONTACT_RECEIVER_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || 'Vexora Contact <onboarding@resend.dev>';
  const resendApiKey = process.env.RESEND_API_KEY;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const genericApiKey = process.env.EMAIL_API_KEY;

  // Check for test mock mode
  if (options.mockProvider || process.env.CONTACT_SERVICE_MOCK === 'true') {
    contactRateLimiter.record(clientIdentifier);
    const mockId = `mock_msg_${Date.now()}`;
    recordOperationalLog({ submissionId, timestamp, status: 'mock_delivered', category, clientIdentifier });
    return {
      success: true,
      messageId: mockId,
      message: 'Your message has been submitted successfully. Thank you for contacting Vexora Technology.'
    };
  }

  // 4. Verify Recipient is configured
  if (!recipientEmail) {
    return {
      success: false,
      error: 'The developer recipient email (CONTACT_RECEIVER_EMAIL) is not configured in .env. Please configure this setting before messages can be delivered.',
      unconfigured: true
    };
  }

  // 5. Build templates
  const { textBody, htmlBody } = buildEmailTemplates({
    fullName,
    email,
    category,
    subject,
    message,
    submissionId,
    timestamp
  });

  // 6. Dispatch via configured provider
  try {
    // Provider Option A: Resend API (Native HTTPS fetch)
    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipientEmail],
          reply_to: email,
          subject: `[VEXORA] ${category}: ${subject}`,
          text: textBody,
          html: htmlBody
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.id) {
        contactRateLimiter.record(clientIdentifier);
        recordOperationalLog({ submissionId, timestamp, status: 'delivered', provider: 'resend', category, clientIdentifier });
        return {
          success: true,
          messageId: data.id,
          message: 'Your message has been submitted successfully. Thank you for contacting Vexora Technology.'
        };
      }

      console.error('[CONTACT SERVICE] Resend API error response:', data);
      return {
        success: false,
        error: data?.message || 'Email delivery provider rejected the request. Please verify provider credentials.'
      };
    }

    // Provider Option B: SendGrid API (Native HTTPS fetch)
    if (sendgridApiKey) {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipientEmail }] }],
          from: { email: fromEmail.includes('<') ? fromEmail.match(/<([^>]+)>/)[1] : fromEmail },
          reply_to: { email, name: fullName },
          subject: `[VEXORA] ${category}: ${subject}`,
          content: [
            { type: 'text/plain', value: textBody },
            { type: 'text/html', value: htmlBody }
          ]
        })
      });

      if (res.status === 202 || res.ok) {
        contactRateLimiter.record(clientIdentifier);
        recordOperationalLog({ submissionId, timestamp, status: 'delivered', provider: 'sendgrid', category, clientIdentifier });
        return {
          success: true,
          messageId: submissionId,
          message: 'Your message has been submitted successfully. Thank you for contacting Vexora Technology.'
        };
      }

      const data = await res.json().catch(() => ({}));
      console.error('[CONTACT SERVICE] SendGrid API error response:', data);
      return {
        success: false,
        error: data?.errors?.[0]?.message || 'Email delivery service rejected the request. Please verify credentials.'
      };
    }

    // Provider Option C: Generic API Key / Webhook
    if (genericApiKey && process.env.EMAIL_API_URL) {
      const res = await fetch(process.env.EMAIL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${genericApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: recipientEmail,
          senderName: fullName,
          senderEmail: email,
          category,
          subject,
          message,
          textBody,
          htmlBody,
          submissionId,
          timestamp
        })
      });

      if (res.ok) {
        contactRateLimiter.record(clientIdentifier);
        recordOperationalLog({ submissionId, timestamp, status: 'delivered', provider: 'custom_api', category, clientIdentifier });
        return {
          success: true,
          messageId: submissionId,
          message: 'Your message has been submitted successfully. Thank you for contacting Vexora Technology.'
        };
      }
    }

    // No valid API key configured
    return {
      success: false,
      error: 'Email delivery credentials are not configured in .env (RESEND_API_KEY, SENDGRID_API_KEY, or EMAIL_API_KEY).',
      unconfigured: true
    };
  } catch (err) {
    console.error('[CONTACT SERVICE] Network or delivery failure:', err);
    return {
      success: false,
      error: 'An internal error occurred while communicating with the email delivery service. Please try again later.'
    };
  }
}

/**
 * Record limited operational metadata (no message bodies stored)
 */
function recordOperationalLog(entry) {
  operationalContactLog.unshift(entry);
  if (operationalContactLog.length > 100) {
    operationalContactLog.pop();
  }
}
