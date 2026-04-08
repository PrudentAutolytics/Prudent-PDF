'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) { context.res = { status: 400, body: { error: 'Email required.' } }; return; }

  try {
    const result = await pool.query(`
      SELECT credits_used, credits_limit, plan, trial_expiry_date
      FROM users WHERE email = $1
    `, [email]);

    if (!result.rows[0]) { context.res = { status: 404, body: { error: 'User not found.' } }; return; }

    const { credits_used, credits_limit, plan, trial_expiry_date } = result.rows[0];
    context.res = {
      status: 200,
      body: { creditsUsed: credits_used, creditsLimit: credits_limit, plan, trialExpiryDate: trial_expiry_date },
    };
  } catch (err) {
    console.error('quota-get error:', err);
    context.res = { status: 500, body: { error: 'Failed to fetch quota.' } };
  }
};
