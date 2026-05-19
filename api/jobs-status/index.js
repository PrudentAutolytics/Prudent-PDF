'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession }              = require('../auth');
const pool                           = require('../db');

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  // ── Session auth ──
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }

  const jobId = (req.body?.jobId || '').trim();
  const email = auth.email;

  if (!jobId) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'jobId required.' } };
    return;
  }

  try {
    const result = await pool.query(`
      SELECT
        j.id               AS "jobId",
        j.status,
        j.result_url       AS "resultUrl",
        j.page_count       AS "pageCount",
        j.cost_total       AS "costTotal",
        j.error_message    AS "errorMessage",
        j.extracted_fields AS "extractedFields",
        j.completed_at     AS "completedAt"
      FROM jobs j
      INNER JOIN users u ON u.id = j.user_id
      WHERE j.id = $1 AND u.email = $2
    `, [jobId, email]);

    if (!result.rows.length) {
      context.res = { status: 404, headers: getCorsHeaders(req), body: { error: 'Job not found.' } };
      return;
    }

    context.res = { status: 200, headers: getCorsHeaders(req), body: result.rows[0] };
  } catch (err) {
    context.log('jobs-status ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'Failed to get job status.' } };
  }
};
