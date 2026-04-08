'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();
  const otp   = (req.body?.otp   || '').trim();

  if (!email || !otp) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'Email and code required.' } };
    return;
  }

  try {
    const result = await pool.query(`
      SELECT id, email, plan, credits_used, credits_limit,
             trial_expiry_date, otp, otp_expires_at, is_active
      FROM users WHERE email = $1
    `, [email]);

    const user = result.rows[0];

    if (!user)           { context.res = { status: 404, headers: {'Content-Type':'application/json'}, body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Account inactive.' } }; return; }
    if (!user.otp)       { context.res = { status: 401, headers: {'Content-Type':'application/json'}, body: { error: 'No active code found. Please request a new one.' } }; return; }
    if (new Date() > new Date(user.otp_expires_at)) { context.res = { status: 401, headers: {'Content-Type':'application/json'}, body: { error: 'Code expired. Please request a new one.' } }; return; }
    if (user.otp !== otp) { context.res = { status: 401, headers: {'Content-Type':'application/json'}, body: { error: 'Invalid code. Please check and try again.' } }; return; }

    await pool.query(`UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE email = $1`, [email]);

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : {
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
    context.log('auth-verify error:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: 'Verification failed. Please try again.' } };
  }
};