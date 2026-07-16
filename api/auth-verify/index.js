'use strict';
const crypto = require('crypto');
const pool                              = require('../db');
const { getCorsHeaders, handleCors }    = require('../cors');
const { generateSessionToken }          = require('../auth');
const { checkRateLimit }                  = require('../ratelimit');
const { validEmail, getClientId }         = require('../security');
const { isAdminUser } = require('../admin-access');

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email = (req.body?.email || '').trim().toLowerCase();
  const otp   = (req.body?.otp   || '').trim();

  if (!validEmail(email) || !/^\d{6}$/.test(otp)) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Email and code required.' } };
    return;
  }

  const clientId = getClientId(req);
  const [emailLimited, clientLimited] = await Promise.all([
    checkRateLimit(`otp:verify:email:${email}`, 10, 15 * 60 * 1000, context),
    checkRateLimit(`otp:verify:client:${clientId}`, 30, 15 * 60 * 1000, context),
  ]);
  if (emailLimited || clientLimited) {
    context.res = { status: 429, headers: getCorsHeaders(req), body: { error: 'Too many verification attempts. Please request a new code later.' } };
    return;
  }

  try {
    const result = await pool.query(`
      SELECT id, email, plan, credits_used, credits_limit,
             trial_expiry_date, otp, otp_expires_at, is_active,
             full_name, company, use_case, COALESCE(role, 'user') AS role
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
    const storedOtp = String(user.otp || '');
    const providedHash = crypto.createHash('sha256').update(otp).digest('hex');
    const storedHash = storedOtp.startsWith('sha256:') ? storedOtp.slice(7) : '';
    const otpMatches = /^[0-9a-f]{64}$/i.test(storedHash)
      ? crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(providedHash, 'hex'))
      : storedOtp.length === otp.length && crypto.timingSafeEqual(Buffer.from(storedOtp), Buffer.from(otp));
    if (!otpMatches) {
      context.res = { status: 401, headers: getCorsHeaders(req), body: { error: 'Invalid code. Please check and try again.' } };
      return;
    }

    // Clear OTP after successful verify
    await pool.query(`UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE email = $1`, [email]);

    // Issue a signed session token
    const token = generateSessionToken(user.email, user.id);

    context.log('auth-verify: verification succeeded');

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : {
        status          : 'approved',
        email           : user.email,
        userId          : user.id,
        token,                          // <-- signed session token
        plan            : user.plan,
        creditsUsed     : user.credits_used,
        creditsLimit    : user.credits_limit,
        trialExpiryDate : user.trial_expiry_date,
        fullName        : user.full_name  || null,
        company         : user.company    || null,
        useCase         : user.use_case   || null,
        role            : String(user.role || 'user').toLowerCase(),
        isAdmin         : await isAdminUser(user.id, user.email),
      },
    };

  } catch (err) {
    context.log('auth-verify ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'Verification failed. Please try again.' } };
  }
};
