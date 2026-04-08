'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();

  if (!email) {
    context.res = { status: 400, body: { error: 'Email required.' } };
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { exists: result.rows.length > 0 },
    };
  } catch (err) {
    console.error('auth-check error:', err.message);
    context.res = { status: 500, body: { error: 'Check failed.' } };
  }
};