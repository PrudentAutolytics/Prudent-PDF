'use strict';
const crypto = require('crypto');
const pool   = require('../db');
const { sendEmail, otpEmailHtml } = require('../email');
const { getCorsHeaders, handleCors } = require('../cors');
const { checkRateLimit } = require('../ratelimit');
const { validEmail, getClientId } = require('../security');

// In-memory rate limiting - per email and per IP
const pendingRequests = new Set();
const rateLimitMap    = new Map(); // email -> { count, resetAt }
const OTP_RATE_LIMIT  = 5;        // max requests per window
const OTP_WINDOW_MS   = 15 * 60 * 1000; // 15 minutes

let otpStorageModePromise;
async function canStoreHashedOtp() {
  if (!otpStorageModePromise) {
    otpStorageModePromise = pool.query(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='otp'
      LIMIT 1
    `).then(r => {
      const c = r.rows[0];
      if (!c) return false;
      return c.data_type === 'text' || c.character_maximum_length == null || Number(c.character_maximum_length) >= 71;
    }).catch(() => false);
  }
  return otpStorageModePromise;
}

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
  const fullName = (req.body?.fullName || '').trim().slice(0, 120);
  const company  = (req.body?.company  || '').trim().slice(0, 160);
  const useCase  = (req.body?.useCase  || '').trim().slice(0, 500);

  if (!validEmail(email)) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Please enter a valid email address.' } };
    return;
  }

  // Distributed limiter with the in-memory limiter retained as a compatibility backstop.
  const clientId = getClientId(req);
  const [emailLimited, clientLimited] = await Promise.all([
    checkRateLimit(`otp:request:email:${email}`, 5, 15 * 60 * 1000, context),
    checkRateLimit(`otp:request:client:${clientId}`, 20, 15 * 60 * 1000, context),
  ]);
  if (emailLimited || clientLimited || isRateLimited(email)) {
    context.res = { status: 429, headers: getCorsHeaders(req), body: { error: 'Too many verification requests. Please wait before trying again.' } };
    return;
  }

  if (pendingRequests.has(email)) {
    context.res = { status: 200, headers: getCorsHeaders(req), body: { message: 'Code already being sent.' } };
    return;
  }

  pendingRequests.add(email);

  const otp       = crypto.randomInt(100000, 999999).toString();
  const useHashedOtp = await canStoreHashedOtp();
  const otpStored = useHashedOtp
    ? 'sha256:' + crypto.createHash('sha256').update(otp).digest('hex')
    : otp;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    context.log('auth-request: creating verification challenge');

    await pool.query(`
      INSERT INTO users (email, otp, otp_expires_at, full_name, company, use_case)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE
      SET otp            = EXCLUDED.otp,
          otp_expires_at = EXCLUDED.otp_expires_at,
          full_name      = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE users.full_name END,
          company        = CASE WHEN EXCLUDED.company   <> '' THEN EXCLUDED.company   ELSE users.company   END,
          use_case       = CASE WHEN EXCLUDED.use_case  <> '' THEN EXCLUDED.use_case  ELSE users.use_case  END
    `, [email, otpStored, expiresAt, fullName || null, company || null, useCase || null]);

    await sendEmail(email, 'Your Prudent Redact login code', otpEmailHtml(otp));

    context.log('auth-request: verification challenge sent');
    context.res = { status: 200, headers: getCorsHeaders(req), body: { message: 'Code sent.' } };

  } catch (err) {
    context.log('auth-request ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'We could not process the verification request. Please try again.' } };
  } finally {
    pendingRequests.delete(email);
  }
};
