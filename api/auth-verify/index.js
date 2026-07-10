'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { getCorsHeaders, handleCors }           = require('../cors');
const { generateSessionToken, sha256Hex }      = require('../auth');
const { checkRateLimit }                       = require('../ratelimit');

/**
 * ENTERPRISE HARDENING:
 *  - Brute-force protection: max 5 wrong codes per issued OTP
 *    (otp_attempts column), plus a PG-backed rate limit per email.
 *    Previously a 6-digit code could be guessed with unlimited tries
 *    inside the 10-minute window.
 *  - OTP comparison is constant-time against the stored SHA-256 hash.
 *  - Attempt counter increments atomically in the same UPDATE.
 */
const MAX_OTP_ATTEMPTS   = 5;
const VERIFY_RATE_LIMIT  = 20;
const VERIFY_WINDOW_MS   = 15 * 60 * 1000;

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email = (req.body?.email || '').trim().toLowerCase();
  const otp   = (req.body?.otp   || '').trim();

  if (!email || !otp || !/^\d{6}$/.test(otp)) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Email and a 6-digit code are required.' } };
    return;
  }

  const limited = await checkRateLimit(`verify:${email}`, VERIFY_RATE_LIMIT, VERIFY_WINDOW_MS, context);
  if (limited) {
    context.res = { status: 429, headers: getCorsHeaders(req), body: { error: 'Too many attempts. Please wait and request a new code.' } };
    return;
  }

  try {
    const result = await pool.query(`
      SELECT id, email, plan, credits_used, credits_limit,
             trial_expiry_date, otp, otp_expires_at, otp_attempts, is_active,
             full_name, company, use_case
      FROM users WHERE email = $1
    `, [email]);

    const user = result.rows[0];

    if (!user)           { context.res = { status: 404, headers: getCorsHeaders(req), body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Account inactive. Please contact support.' } }; return; }
    if (!user.otp)       { context.res = { status: 401, headers: getCorsHeaders(req), body: { error: 'No active code found. Please request a new one.' } }; return; }
    if (new Date() > new Date(user.otp_expires_at)) {
      context.res = { status: 401, headers: getCorsHeaders(req), body: { error: 'Code expired. Please request a new one.' } };
      return;
    }
    if ((user.otp_attempts || 0) >= MAX_OTP_ATTEMPTS) {
      await pool.query(`UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE email = $1`, [email]);
      context.res = { status: 401, headers: getCorsHeaders(req), body: { error: 'Too many incorrect attempts. Please request a new code.' } };
      return;
    }

    // Constant-time compare of the hashed submitted code vs stored hash.
    // Supports legacy plaintext rows created before this hardening.
    const submittedHash = sha256Hex(otp);
    const stored        = String(user.otp);
    const storedIsHash  = /^[0-9a-f]{64}$/i.test(stored);
    const expectedBuf   = Buffer.from(storedIsHash ? stored : sha256Hex(stored), 'hex');
    const submittedBuf  = Buffer.from(submittedHash, 'hex');
    const matches       = crypto.timingSafeEqual(submittedBuf, expectedBuf);

    if (!matches) {
      await pool.query(`UPDATE users SET otp_attempts = COALESCE(otp_attempts,0) + 1 WHERE email = $1`, [email]);
      context.res = { status: 401, headers: getCorsHeaders(req), body: { error: 'Invalid code. Please check and try again.' } };
      return;
    }

    // Clear OTP after successful verify
    await pool.query(`UPDATE users SET otp = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE email = $1`, [email]);

    // Issue a signed session token
    const token = generateSessionToken(user.email, user.id);

    context.log('auth-verify: SUCCESS for', email);

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : {
        status          : 'approved',
        email           : user.email,
        userId          : user.id,
        token,
        plan            : user.plan,
        creditsUsed     : user.credits_used,
        creditsLimit    : user.credits_limit,
        trialExpiryDate : user.trial_expiry_date,
        fullName        : user.full_name  || null,
        company         : user.company    || null,
        useCase         : user.use_case   || null,
      },
    };

  } catch (err) {
    context.log('auth-verify ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'Verification failed. Please try again.' } };
  }
};
