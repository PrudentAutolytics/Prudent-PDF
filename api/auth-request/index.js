'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml } = require('../email');

const pendingRequests = new Set();

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'Please enter a valid email address.' } };
    return;
  }

  if (pendingRequests.has(email)) {
    context.res = { status: 200, headers: {'Content-Type':'application/json'}, body: { message: 'Code already being sent.' } };
    return;
  }

  pendingRequests.add(email);
  const otp       = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await pool.query(`
      INSERT INTO users (email, otp, otp_expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
      SET otp = EXCLUDED.otp, otp_expires_at = EXCLUDED.otp_expires_at
    `, [email, otp, expiresAt]);

    await sendEmail(email, 'Your Prudent PDF login code', otpEmailHtml(otp));
    context.res = { status: 200, headers: {'Content-Type':'application/json'}, body: { message: 'Code sent.' } };
  } catch (err) {
    context.log('auth-request error:', err.message);
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: err.message || 'Failed to send code.' } };
  } finally {
    pendingRequests.delete(email);
  }
};