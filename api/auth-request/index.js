'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml } = require('../email');

// In-memory lock to prevent duplicate requests within same second
const pendingRequests = new Set();

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    context.res = { status: 400, body: { error: 'Please enter a valid email address.' } };
    return;
  }

  // Prevent duplicate concurrent requests for same email
  if (pendingRequests.has(email)) {
    context.log('Duplicate request blocked for:', email);
    context.res = { status: 200, body: { message: 'Code already being sent.' } };
    return;
  }

  pendingRequests.add(email);

  const otp       = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    context.log('auth-request: upserting OTP for', email, 'otp:', otp);

    // Single atomic upsert — create user AND set OTP in one query
    const result = await pool.query(`
      INSERT INTO users (email, otp, otp_expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
      SET otp            = EXCLUDED.otp,
          otp_expires_at = EXCLUDED.otp_expires_at
      RETURNING email, otp
    `, [email, otp, expiresAt]);

    context.log('auth-request: DB result:', JSON.stringify(result.rows[0]));

    // Only send email if DB confirmed the OTP was stored
    if (result.rows[0]?.otp !== otp) {
      throw new Error('OTP storage verification failed.');
    }

    await sendEmail(email, 'Your Prudent PDF login code', otpEmailHtml(otp));
    context.log('auth-request: email sent successfully');

    context.res = { status: 200, body: { message: 'Code sent.' } };

  } catch (err) {
    context.log('auth-request ERROR:', err.message);
    context.res = {
      status: 400,
      body: { error: err.message || 'Failed to send code. Please try again.' },
    };
  } finally {
    // Always release the lock
    pendingRequests.delete(email);
  }
};