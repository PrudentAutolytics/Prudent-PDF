'use strict';
/**
 * auth.js — Shared session token verification middleware
 *
 * Every protected API endpoint calls verifySession(req) before
 * touching any data. Returns { ok, email, userId, error, status }.
 *
 * The session token is a HMAC-SHA256 hex of "email:userId:issuedAt"
 * signed with SESSION_SECRET. It is stored in localStorage on the
 * client and sent in the request body as { token }.
 *
 * Endpoints that are intentionally public (auth-request, auth-verify,
 * auth-check) do NOT call this helper.
 */
const crypto = require('crypto');
const pool   = require('./db');

const SESSION_SECRET  = process.env.SESSION_SECRET || 'prudent-pdf-secret-change-in-production';
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Verify a session token sent in the request body.
 * Returns { ok: true, email, userId } or { ok: false, status, error }.
 */
async function verifySession(req) {
  const token  = (req.body?.token  || '').trim();
  const email  = (req.body?.email  || '').trim().toLowerCase();

  if (!token || !email) {
    return { ok: false, status: 401, error: 'Authentication required.' };
  }

  // Token format: "email:userId:issuedAt:hmac"
  const parts = token.split(':');
  if (parts.length !== 4) {
    return { ok: false, status: 401, error: 'Invalid session token.' };
  }

  const [tokEmail, tokUserId, tokIssuedAt, tokHmac] = parts;

  // 1. Email must match
  if (tokEmail.toLowerCase() !== email) {
    return { ok: false, status: 401, error: 'Session mismatch.' };
  }

  // 2. Token must not be expired
  const issuedAt = parseInt(tokIssuedAt, 10);
  if (!issuedAt || Date.now() - issuedAt > TOKEN_MAX_AGE_MS) {
    return { ok: false, status: 401, error: 'Session expired. Please log in again.' };
  }

  // 3. HMAC signature must be valid
  const payload  = `${tokEmail}:${tokUserId}:${tokIssuedAt}`;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  if (!/^[0-9a-f]{64}$/i.test(tokHmac)) {
    return { ok: false, status: 401, error: 'Invalid session signature.' };
  }
  const valid    = crypto.timingSafeEqual(
    Buffer.from(tokHmac,   'hex'),
    Buffer.from(expected,  'hex')
  );
  if (!valid) {
    return { ok: false, status: 401, error: 'Invalid session signature.' };
  }

  // 4. User must still be active in DB
  try {
    const result = await pool.query(
      'SELECT id, is_active FROM users WHERE id = $1 AND email = $2',
      [tokUserId, email]
    );
    const user = result.rows[0];
    if (!user)           return { ok: false, status: 401, error: 'User not found.' };
    if (!user.is_active) return { ok: false, status: 403, error: 'Account inactive.' };
    return { ok: true, email, userId: user.id };
  } catch (err) {
    return { ok: false, status: 500, error: 'Authentication check failed.' };
  }
}

/**
 * Generate a signed session token for a verified user.
 * Called by auth-verify after successful OTP check.
 */
function generateSessionToken(email, userId) {
  const issuedAt = Date.now().toString();
  const payload  = `${email.toLowerCase()}:${userId}:${issuedAt}`;
  const hmac     = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${email.toLowerCase()}:${userId}:${issuedAt}:${hmac}`;
}

module.exports = { verifySession, generateSessionToken };
