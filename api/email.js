'use strict';

const PA_EMAIL_URL = process.env.PA_EMAIL_SEND;

async function sendEmail(to, subject, html) {
  if (!PA_EMAIL_URL) throw new Error('Email service not configured.');

  const res = await fetch(PA_EMAIL_URL, {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify({ to, subject, body: html }),
  });

  if (!res.ok) {
    if (res.status === 400) throw new Error('The email address appears to be invalid. Please check and try again.');
    if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
    if (res.status === 503) throw new Error('Email service temporarily unavailable. Please try again shortly.');
    throw new Error(`Failed to send email (${res.status}). Please try again.`);
  }
}

function otpEmailHtml(otp) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#111827;font-size:22px;font-weight:800;margin:0 0 8px">Your login code</h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 24px;line-height:1.6">
        Use this code to sign in to <strong>Prudent PDF</strong>. It expires in 10 minutes.
      </p>
      <div style="font-size:40px;font-weight:800;letter-spacing:10px;
                  color:#2E75B6;padding:24px;background:#EBF3FA;
                  border-radius:12px;text-align:center;
                  border:1px solid #C7DCEE;font-family:monospace">
        ${otp}
      </div>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;line-height:1.6">
        If you didn't request this code, you can safely ignore this email.<br/>
        This code is only valid for 10 minutes.
      </p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0"/>
      <p style="color:#9CA3AF;font-size:11px;margin:0">
        Prudent PDF · Prudent Autolytics · Chennai, India
      </p>
    </div>
  `;
}

module.exports = { sendEmail, otpEmailHtml };
