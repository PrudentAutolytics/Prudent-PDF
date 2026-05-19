'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const pool = require('../db');

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) { context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Email required.' } }; return; }
  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    context.res = { status: 200, headers: getCorsHeaders(req), body: { exists: result.rows.length > 0 } };
  } catch (err) {
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'Check failed.' } };
  }
};
