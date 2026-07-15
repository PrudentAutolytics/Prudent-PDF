'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  // ── Session auth ──
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }
  // ENTERPRISE HARDENING: identity comes from the verified session,
  // never from a caller-supplied field.
  const days  = Math.min(365, Math.max(1, parseInt(req.body?.days || '30', 10) || 30));

  try {
    // History deliberately selects the stable core job schema first. Optional
    // columns are discovered and included only when they exist, so older
    // production databases do not make the entire history page fail.
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'jobs'
    `);
    const available = new Set(cols.rows.map(r => r.column_name));
    const optional = [
      ['result_url', 'resultUrl'], ['blob_url', 'blobUrl'],
      ['page_count', 'pageCount'], ['cost_total', 'costTotal'],
      ['file_size_bytes', 'fileSize'], ['completed_at', 'completedAt'],
      ['error_message', 'errorMessage'], ['extracted_fields', 'extractedFields']
    ].filter(([column]) => available.has(column))
     .map(([column, alias]) => `j.${column} AS "${alias}"`);
    const fields = [
      'j.id AS "jobId"', 'j.file_name AS "fileName"', 'j.status',
      'j.submitted_at AS "submittedAt"', ...optional
    ].join(',\n        ');
    // History is scoped to the signed session. We match the session user_id
    // AND any other users row that shares the same verified session email.
    // This recovers job history that was created under an earlier users row
    // for the same person (for example, if the users record was recreated),
    // without ever trusting a client-supplied identity: auth.userId and
    // auth.email both come from the verified session token. Foreign users can
    // never be matched because the email is not caller-controlled.
    const result = await pool.query(`
      SELECT ${fields}
      FROM jobs j
      WHERE (
              j.user_id = $1
              OR j.user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($3))
            )
        AND j.submitted_at > NOW() - INTERVAL '1 day' * $2
      ORDER BY j.submitted_at DESC
      LIMIT 250
    `, [auth.userId, days || 365, auth.email]);

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : result.rows,
    };
  } catch (err) {
    context.log('jobs-list ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
  }
};