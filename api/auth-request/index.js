'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml } = require('../email');

const pendingRequests = new Set();

module.exports = async function (context, req) {
  const email    = (req.body?.email    || '').trim().toLowerCase();
  const fullName = (req.body?.fullName || '').trim();
  const company  = (req.body?.company  || '').trim();
  const useCase  = (req.body?.useCase  || '').trim();

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
    context.log('auth-request: upserting for', email);

    // Upsert user — insert new or update OTP only, preserve existing name/company
    await pool.query(`
      INSERT INTO users (email, otp, otp_expires_at, full_name, company, use_case)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE
      SET otp            = EXCLUDED.otp,
          otp_expires_at = EXCLUDED.otp_expires_at,
          full_name      = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE users.full_name END,
          company        = CASE WHEN EXCLUDED.company   <> '' THEN EXCLUDED.company   ELSE users.company   END,
          use_case       = CASE WHEN EXCLUDED.use_case  <> '' THEN EXCLUDED.use_case  ELSE users.use_case  END
    `, [email, otp, expiresAt, fullName || null, company || null, useCase || null]);

    await sendEmail(email, 'Your Prudent PDF login code', otpEmailHtml(otp));

    context.log('auth-request: success for', email);
    context.res = { status: 200, headers: {'Content-Type':'application/json'}, body: { message: 'Code sent.' } };

  } catch (err) {
    context.log('auth-request ERROR:', err.message);
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: err.message || 'Failed to send code. Please try again.' } };
  } finally {
    pendingRequests.delete(email);
  }
};