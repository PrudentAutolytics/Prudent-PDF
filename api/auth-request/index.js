'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml } = require('../email');
const { getCorsHeaders, handleCors } = require('../cors');

// In-memory rate limiting — per email and per IP
const pendingRequests = new Set();
const rateLimitMap    = new Map(); // email -> { count, resetAt }
const OTP_RATE_LIMIT  = 5;        // max requests per window
const OTP_WINDOW_MS   = 15 * 60 * 1000; // 15 minutes

function isRateLimited(key) {
  const now   = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + OTP_WINDOW_MS });
    return false;
  }
  if (entry.count >= OTP_RATE_LIMIT) return true;
  entry.count++;
  return false;
}

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email    = (req.body?.email    || '').trim().toLowerCase();
  const fullName = (req.body?.fullName || '').trim();
  const company  = (req.body?.company  || '').trim();
  const useCase  = (req.body?.useCase  || '').trim();

  if (!email || !email.includes('@') || email.length > 254) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Please enter a valid email address.' } };
    return;
  }

  // Rate limit by email
  if (isRateLimited(email)) {
    context.res = { status: 429, headers: getCorsHeaders(req), body: { error: 'Too many requests. Please wait 15 minutes before requesting another code.' } };
    return;
  }

  if (pendingRequests.has(email)) {
    context.res = { status: 200, headers: getCorsHeaders(req), body: { message: 'Code already being sent.' } };
    return;
  }

  pendingRequests.add(email);

  const otp       = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    context.log('auth-request: upserting for', email);

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
    context.res = { status: 200, headers: getCorsHeaders(req), body: { message: 'Code sent.' } };

  } catch (err) {
    context.log('auth-request ERROR:', err.message);
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: err.message || 'Failed to send code. Please try again.' } };
  } finally {
    pendingRequests.delete(email);
  }
};
