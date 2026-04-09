'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const pool = require('../db');

const PLAN_LABELS = {
  trial        : 'Free Trial',
  starter      : 'Starter — $19/mo',
  professional : 'Professional — $79/mo',
  business     : 'Business — $399/mo',
  enterprise   : 'Enterprise — $1,499/mo',
};

const PLAN_COLORS = {
  trial        : '#64748B',
  starter      : '#059669',
  professional : '#0891B2',
  business     : '#2563EB',
  enterprise   : '#7C3AED',
};

const SUBJECT_LABELS = {
  pricing    : 'Pricing Enquiry',
  demo       : 'Request a Demo',
  technical  : 'Technical Support',
  enterprise : 'Enterprise / Custom Integration',
  billing    : 'Billing Question',
  other      : 'General Enquiry',
};

function row(label, value, highlight) {
  return `
  <tr>
    <td style="padding:11px 16px;width:130px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;border-bottom:1px solid #F1F5F9;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:11px 16px;font-size:13.5px;color:${highlight||'#1E293B'};font-weight:${highlight?'700':'500'};border-bottom:1px solid #F1F5F9;line-height:1.5">${value}</td>
  </tr>`;
}

function buildEmail({ name, email, subject, plan, message, submittedAt }) {
  const subjectLabel = SUBJECT_LABELS[subject] || subject || 'General Enquiry';
  const planLabel    = PLAN_LABELS[plan]    || (plan ? plan : null);
  const planColor    = PLAN_COLORS[plan]    || '#64748B';
  const dateStr      = submittedAt
    ? new Date(submittedAt).toLocaleString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const planBadge = planLabel
    ? `<span style="display:inline-block;background:${planColor};color:#fff;font-size:11.5px;font-weight:700;padding:3px 12px;border-radius:99px;letter-spacing:.04em">${planLabel}</span>`
    : `<span style="color:#94A3B8;font-style:italic">Not specified</span>`;

  const safeMessage = (message || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;padding:32px 16px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%">

  <!-- Header -->
  <tr><td style="background:#1E3A8A;border-radius:16px 16px 0 0;padding:28px 32px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff">PRUDENT PDF · PRUDENT AUTOLYTICS</p>
          <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-.5px">New Contact Message</h1>
          <p style="margin:0;font-size:12.5px;color:#e0e7ff">${dateStr}</p>
        </td>
        <td align="right" valign="top">
          <span style="display:inline-block;background:rgba(255,255,255,.20);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;color:#FFFFFF;white-space:nowrap;border:1px solid rgba(255,255,255,.3)">${subjectLabel}</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:0;border:1px solid #E2E8F0;border-top:none">

    <!-- Sender section -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
      <tr><td style="padding:20px 32px 12px">
        <p style="margin:0;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8">Contact Details</p>
      </td></tr>
      <tr><td style="padding:0 32px 20px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden">
          ${row('Full Name', name)}
          ${row('Email', `<a href="mailto:${email}" style="color:#2563EB;text-decoration:none">${email}</a>`)}
          ${row('Subject', subjectLabel)}
          <tr>
            <td style="padding:11px 16px;width:130px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;border-bottom:1px solid #F1F5F9;white-space:nowrap;vertical-align:middle">Plan Interest</td>
            <td style="padding:11px 16px;border-bottom:1px solid #F1F5F9">${planBadge}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Message section -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:0 32px 12px">
        <p style="margin:0;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8">Message</p>
      </td></tr>
      <tr><td style="padding:0 32px 24px">
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px 20px;font-size:14px;color:#334155;line-height:1.75">${safeMessage}</div>
      </td></tr>
    </table>

    <!-- Reply CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #F1F5F9">
      <tr><td style="padding:20px 32px" align="left">
        <a href="mailto:${email}?subject=Re%3A%20${encodeURIComponent(subjectLabel)}%20%E2%80%94%20Prudent%20PDF"
           style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:13.5px;font-weight:700;letter-spacing:.01em">
          ↩&nbsp; Reply to ${name}
        </a>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F1F5F9;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:16px 32px">
    <p style="margin:0;font-size:11.5px;color:#94A3B8;line-height:1.6">
      Submitted via <strong style="color:#64748B">Prudent PDF</strong> contact form &nbsp;·&nbsp;
      <strong style="color:#64748B">Prudent Autolytics</strong> &nbsp;·&nbsp; Chennai, Tamil Nadu, India
    </p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const name        = (req.body?.name        || '').trim();
  const email       = (req.body?.email       || '').trim().toLowerCase();
  const subject     = (req.body?.subject     || '').trim();
  const plan        = (req.body?.plan        || '').trim();
  const message     = (req.body?.message     || '').trim();
  const submittedAt = req.body?.submittedAt  || new Date().toISOString();

  if (!name || !email || !message) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Name, email and message are required.' } };
    return;
  }

  try {
    // Save to DB
    try {
      await pool.query(`
        INSERT INTO contact_requests (name, email, subject, plan_interest, message, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [name, email, subject || null, plan || null, message, submittedAt]);
    } catch (dbErr) {
      context.log('contact-send DB error (non-fatal):', dbErr.message);
    }

    // Send email via PA
    const PA_EMAIL_URL = process.env.PA_EMAIL_SEND;
    if (PA_EMAIL_URL) {
      const subjectLabel = SUBJECT_LABELS[subject] || subject || 'General Enquiry';
      const htmlBody     = buildEmail({ name, email, subject, plan, message, submittedAt });

      const paRes = await fetch(PA_EMAIL_URL, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify({
          // Standard fields your PA email flow already uses
          to          : 'Kabileshvijayakumar@prudentautolytics.com',
          subject     : `[Prudent PDF] ${subjectLabel} from ${name}`,
          // HTML body — update PA flow body field to @{triggerBody()?['html']}
          html        : htmlBody,
          body        : htmlBody,
          // Structured fields as fallback if PA builds plain text
          senderName  : name,
          senderEmail : email,
          planInterest: PLAN_LABELS[plan] || plan || 'Not specified',
          subjectType : subjectLabel,
          userMessage : message,
          submittedAt : new Date(submittedAt).toLocaleString('en-GB', {
            weekday:'long', day:'numeric', month:'long', year:'numeric',
            hour:'2-digit', minute:'2-digit',
          }),
        }),
      });
      context.log('PA email status:', paRes.status);
    }

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : { success: true, message: 'Message received. We will get back to you within one business day.' },
    };
  } catch (err) {
    context.log('contact-send ERROR:', err.message);
    context.res = {
      status  : 500,
      headers : getCorsHeaders(req),
      body    : { error: 'Failed to send message. Please email us directly.' },
    };
  }
};