'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const pool = require('../db');
const { checkRateLimit } = require('../ratelimit');
const { validEmail, getClientId } = require('../security');

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email = (req.body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) { context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Valid email required.' } }; return; }
  const limited = await checkRateLimit(`auth:check:client:${getClientId(req)}`, 30, 15 * 60 * 1000, context);
  if (limited) { context.res = { status: 429, headers: getCorsHeaders(req), body: { error: 'Too many authentication checks. Please wait and try again.' } }; return; }
  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    context.res = { status: 200, headers: getCorsHeaders(req), body: { exists: result.rows.length > 0 } };
  } catch (err) {
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'Check failed.' } };
  }
};
