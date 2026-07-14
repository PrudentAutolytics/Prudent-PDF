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
  const email = auth.email;
  const days  = Math.min(365, Math.max(1, parseInt(req.body?.days || '30', 10) || 30));

  try {
    const result = await pool.query(`
      SELECT
        j.id                AS "jobId",
        j.file_name         AS "fileName",
        j.status,
        j.result_url        AS "resultUrl",
        j.blob_url          AS "blobUrl",
        j.page_count        AS "pageCount",
        j.cost_total        AS "costTotal",
        j.file_size_bytes   AS "fileSize",
        j.submitted_at      AS "submittedAt",
        j.completed_at      AS "completedAt",
        j.error_message     AS "errorMessage",
        j.extracted_fields  AS "extractedFields"
      FROM jobs j
      INNER JOIN users u ON u.id = j.user_id
      WHERE u.email = $1
        AND j.submitted_at > NOW() - INTERVAL '1 day' * $2
      ORDER BY j.submitted_at DESC
      LIMIT 50
    `, [email, days || 365]);

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