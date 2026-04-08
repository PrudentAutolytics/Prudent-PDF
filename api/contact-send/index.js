'use strict';
const pool = require('../db');
const { sendEmail } = require('../email');

module.exports = async function (context, req) {
  const name         = (req.body?.name        || '').trim();
  const email        = (req.body?.email       || '').trim().toLowerCase();
  const company      = (req.body?.company     || '').trim();
  const message      = (req.body?.message     || '').trim();
  const planInterest = (req.body?.planInterest|| '').trim();

  if (!name || !email || !message) {
    context.res = { status: 400, body: { error: 'Name, email and message required.' } };
    return;
  }

  try {
    await pool.query(`
      INSERT INTO contact_requests (name, email, company, message, plan_interest)
      VALUES ($1, $2, $3, $4, $5)
    `, [name, email, company, message, planInterest]);

    await sendEmail(
      'Kabileshvijayakumar@prudentautolytics.com',
      `New contact request from ${name}`,
      `
        <div style="font-family:sans-serif;max-width:480px;padding:32px">
          <h2 style="color:#111827;margin:0 0 20px">New Contact Request</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;font-weight:600;color:#374151;width:120px">Name</td><td style="color:#111827">${name}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#374151">Email</td><td style="color:#111827">${email}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#374151">Company</td><td style="color:#111827">${company || '—'}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#374151">Plan</td><td style="color:#111827">${planInterest || '—'}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#374151;vertical-align:top">Message</td><td style="color:#111827">${message}</td></tr>
          </table>
        </div>
      `
    );

    context.res = { status: 200, body: { message: 'Message sent successfully.' } };
  } catch (err) {
    console.error('contact-send error:', err);
    context.res = { status: 500, body: { error: 'Failed to send message.' } };
  }
};
