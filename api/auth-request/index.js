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

  // Debug: log env vars (remove after testing)
  context.log('PG_HOST:', process.env.PG_HOST);
  context.log('PG_PORT:', process.env.PG_PORT);
  context.log('PG_USER:', process.env.PG_USER);
  context.log('PG_SSL:', process.env.PG_SSL);

  const otp       = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    context.log('Attempting DB upsert for:', email);

    await pool.query(`
      INSERT INTO users (email, otp, otp_expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
      SET otp = EXCLUDED.otp,
          otp_expires_at = EXCLUDED.otp_expires_at
    `, [email, otp, expiresAt]);

    context.log('DB upsert successful, OTP:', otp);

    await sendEmail(email, 'Your Prudent PDF login code', otpEmailHtml(otp));

    context.log('Email sent successfully');

    context.res = { status: 200, body: { message: 'Code sent.' } };

  } catch (err) {
    context.log('ERROR:', err.message);
    context.res = {
      status: 400,
      body: { error: err.message || 'Failed to send code. Please try again.' },
    };
  }
};