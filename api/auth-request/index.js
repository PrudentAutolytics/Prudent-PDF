'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml } = require('../email');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    context.res = { status: 400, body: { error: 'Please enter a valid email address.' } };
    return;
  }

  const otp       = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await pool.query(`
      INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING
    `, [email]);

    await pool.query(`
      UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3
    `, [otp, expiresAt, email]);

    await sendEmail(email, 'Your Prudent PDF login code', otpEmailHtml(otp));

    context.res = { status: 200, body: { message: 'Code sent.' } };
  } catch (err) {
    console.error('auth-request error:', err);
    context.res = { status: 400, body: { error: err.message || 'Failed to send code. Please try again.' } };
  }
};
