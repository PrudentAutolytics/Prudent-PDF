'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml }    = require('../email');
const { getCorsHeaders, handleCors } = require('../cors');
const { checkRateLimit }             = require('../ratelimit');
const { sha256Hex }                  = require('../auth');

/**
 * ENTERPRISE HARDENING:
 *  - Rate limiting moved to PostgreSQL (survives cold starts and
 *    multi-instance scale-out; the old in-memory Map did not).
 *  - Limited per email AND per client IP.
 *  - OTP is stored as a SHA-256 hash. A read of the users table can
 *    no longer be replayed as a login.
 *  - otp_attempts reset on every new code issue.
 *  - Internal error details are logged, never returned to the client.
 */
const OTP_RATE_LIMIT = 5;             // max requests per window
const OTP_WINDOW_MS  = 15 * 60 * 1000; // 15 minutes

function getClientIp(req) {
  const fwd = (req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers?.['x-client-ip'] || 'unknown';
}

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email    = (req.body?.email    || '').trim().toLowerCase();
  const fullName = (req.body?.fullName || '').trim().slice(0, 120);
  const company  = (req.body?.company  || '').trim().slice(0, 120);
  const useCase  = (req.body?.useCase  || '').trim().slice(0, 500);

  if (!email || !email.includes('@') || email.length > 254) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Please enter a valid email address.' } };
    return;
  }

  // Rate limit by email and by IP (PG-backed, cross-instance)
  const ip = getClientIp(req);
  const [emailLimited, ipLimited] = await Promise.all([
    checkRateLimit(`otp:email:${email}`, OTP_RATE_LIMIT, OTP_WINDOW_MS, context),
    checkRateLimit(`otp:ip:${ip}`,       OTP_RATE_LIMIT * 3, OTP_WINDOW_MS, context),
  ]);
  if (emailLimited || ipLimited) {
    context.res = { status: 429, headers: getCorsHeaders(req), body: { error: 'Too many requests. Please wait 15 minutes before requesting another code.' } };
    return;
  }

  const otp       = crypto.randomInt(100000, 999999).toString();
  const otpHash   = sha256Hex(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    context.log('auth-request: upserting for', email);

    await pool.query(`
      INSERT INTO users (email, otp, otp_expires_at, otp_attempts, full_name, company, use_case)
      VALUES ($1, $2, $3, 0, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE
      SET otp            = EXCLUDED.otp,
          otp_expires_at = EXCLUDED.otp_expires_at,
          otp_attempts   = 0,
          full_name      = CASE WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE users.full_name END,
          company        = CASE WHEN EXCLUDED.company   IS NOT NULL AND EXCLUDED.company   <> '' THEN EXCLUDED.company   ELSE users.company   END,
          use_case       = CASE WHEN EXCLUDED.use_case  IS NOT NULL AND EXCLUDED.use_case  <> '' THEN EXCLUDED.use_case  ELSE users.use_case  END
    `, [email, otpHash, expiresAt, fullName || null, company || null, useCase || null]);

    await sendEmail(email, 'Your Prudent PDF login code', otpEmailHtml(otp));

    context.log('auth-request: success for', email);
    context.res = { status: 200, headers: getCorsHeaders(req), body: { message: 'Code sent.' } };

  } catch (err) {
    context.log('auth-request ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'Failed to send code. Please try again.' } };
  }
};
