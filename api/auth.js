'use strict';
/**
 * auth.js — Shared session token verification middleware
 *
 * Every protected API endpoint calls verifySession(req) before
 * touching any data. Returns { ok, email, userId, error, status }.
 *
 * The session token is a HMAC-SHA256 hex of "email:userId:issuedAt"
 * signed with SESSION_SECRET.
 *
 * ENTERPRISE HARDENING:
 *  - Fails CLOSED if SESSION_SECRET is not configured. No default
 *    fallback secret. A missing secret returns 500, never a forgeable
 *    token path.
 *  - HMAC length is validated before timingSafeEqual so a malformed
 *    token cannot crash the function with a RangeError.
 *  - Downstream handlers should trust auth.email / auth.userId, never
 *    re-read identity from the request body.
 */
const crypto = require('crypto');
const pool   = require('./db');

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const HMAC_HEX_LENGTH  = 64; // sha256 hex

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('CHANGE_ME')) return null;
  return secret;
}

/**
 * Verify a session token sent in the request body.
 * Returns { ok: true, email, userId } or { ok: false, status, error }.
 */
async function verifySession(req) {
  const secret = getSecret();
  if (!secret) {
    return { ok: false, status: 500, error: 'Server configuration error.' };
  }

  const token = (req.body?.token || '').trim();
  const email = (req.body?.email || '').trim().toLowerCase();

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

  // 3. HMAC signature must be valid. Validate shape first so
  //    timingSafeEqual never throws on mismatched buffer lengths.
  if (!/^[0-9a-f]{64}$/i.test(tokHmac)) {
    return { ok: false, status: 401, error: 'Invalid session signature.' };
  }
  const payload  = `${tokEmail}:${tokUserId}:${tokIssuedAt}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const valid    = crypto.timingSafeEqual(
    Buffer.from(tokHmac,  'hex'),
    Buffer.from(expected, 'hex')
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
 * Throws if SESSION_SECRET is not configured — the caller's try/catch
 * returns a 500 instead of ever issuing an unsigned/weakly signed token.
 */
function generateSessionToken(email, userId) {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured.');
  const issuedAt = Date.now().toString();
  const payload  = `${email.toLowerCase()}:${userId}:${issuedAt}`;
  const hmac     = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${email.toLowerCase()}:${userId}:${issuedAt}:${hmac}`;
}

/** SHA-256 hex helper shared by OTP + API key hashing. */
function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { verifySession, generateSessionToken, sha256Hex };
