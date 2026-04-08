'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();
  const otp   = (req.body?.otp   || '').trim();

  context.log('auth-verify: email:', email, 'otp:', otp);

  if (!email || !otp) {
    context.res = { status: 400, body: { error: 'Email and code required.' } };
    return;
  }

  try {
    const result = await pool.query(`
      SELECT id, email, plan, credits_used, credits_limit,
             trial_expiry_date, otp, otp_expires_at, is_active
      FROM users WHERE email = $1
    `, [email]);

    const user = result.rows[0];

    context.log('auth-verify: user found:', !!user, 'stored otp:', user?.otp, 'active:', user?.is_active);

    if (!user)           { context.res = { status: 404, body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, body: { error: 'Account inactive. Please contact support.' } }; return; }

    if (!user.otp) {
      context.res = { status: 401, body: { error: 'No active code found. Please request a new one.' } };
      return;
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      context.res = { status: 401, body: { error: 'Code expired. Please request a new one.' } };
      return;
    }

    if (user.otp !== otp) {
      context.log('auth-verify: MISMATCH — stored:', user.otp, 'received:', otp);
      context.res = { status: 401, body: { error: 'Invalid code. Please check and try again.' } };
      return;
    }

    // Clear OTP after successful verify
    await pool.query(`
      UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE email = $1
    `, [email]);

    context.log('auth-verify: SUCCESS for', email);

    context.res = {
      status: 200,
      body: {
        status          : 'approved',
        email           : user.email,
        userId          : user.id,
        plan            : user.plan,
        creditsUsed     : user.credits_used,
        creditsLimit    : user.credits_limit,
        trialExpiryDate : user.trial_expiry_date,
      },
    };

  } catch (err) {
    context.log('auth-verify ERROR:', err.message);
    context.res = { status: 500, body: { error: 'Verification failed. Please try again.' } };
  }
};