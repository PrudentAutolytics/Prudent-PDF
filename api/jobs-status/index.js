'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession }              = require('../auth');
const pool                           = require('../db');

/**
 * jobs-status serves two callers:
 *
 * 1. BROWSER (polling) — sends { jobId, email, token }
 *    Verified via HMAC session token. Returns job row.
 *
 * 2. POWER AUTOMATE (callback) — sends { jobId, status, paSecret, ... }
 *    Verified via PA_CALLBACK_SECRET shared secret.
 *    Writes status update into DB, no session token needed.
 */
module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const jobId  = (req.body?.jobId  || '').trim();
  const status = (req.body?.status || '').trim().toLowerCase();

  if (!jobId) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'jobId required.' } };
    return;
  }

  // ── Detect Power Automate callback ──────────────────────────────────────
  // PA sends paSecret (or no token at all). If paSecret present and valid,
  // treat as a status-update callback from the backend flow.
  const paSecret         = (req.body?.paSecret || '').trim();
  const expectedPaSecret = process.env.PA_CALLBACK_SECRET || 'prudent-pa-secret-change-me';
  const isCallback       = paSecret && paSecret === expectedPaSecret;

  if (isCallback) {
    // ── Power Automate callback — write status update to DB ───────────────
    const resultUrl       = req.body?.resultUrl       || req.body?.result_url       || null;
    const pageCount       = req.body?.pageCount       || req.body?.page_count       || null;
    const costTotal       = req.body?.costTotal       || req.body?.cost_total       || null;
    const errorMessage    = req.body?.errorMessage    || req.body?.error_message    || null;
    const extractedFields = req.body?.extractedFields || req.body?.extracted_fields || null;

    try {
      const updates = ['status = $2', 'completed_at = NOW()'];
      const params  = [jobId, status];
      let   idx     = 3;

      if (resultUrl)       { updates.push(`result_url = $${idx++}`);       params.push(resultUrl); }
      if (pageCount != null){ updates.push(`page_count = $${idx++}`);      params.push(pageCount); }
      if (costTotal != null){ updates.push(`cost_total = $${idx++}`);      params.push(costTotal); }
      if (errorMessage)    { updates.push(`error_message = $${idx++}`);    params.push(errorMessage); }
      if (extractedFields) { updates.push(`extracted_fields = $${idx++}`); params.push(
        typeof extractedFields === 'string' ? extractedFields : JSON.stringify(extractedFields)
      ); }

      await pool.query(
        `UPDATE jobs SET ${updates.join(', ')} WHERE id = $1`,
        params
      );

      context.log(`jobs-status PA callback: ${jobId} → ${status}`);
      context.res = { status: 200, headers: getCorsHeaders(req), body: { ok: true, jobId, status } };
    } catch (err) {
      context.log('jobs-status PA callback ERROR:', err.message);
      context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
    }
    return;
  }

  // ── Browser poll — requires valid session token ───────────────────────
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
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
    `, [jobId, auth.email]);

    if (!result.rows.length) {
      context.res = { status: 404, headers: getCorsHeaders(req), body: { error: 'Job not found.' } };
      return;
    }

    context.res = { status: 200, headers: getCorsHeaders(req), body: result.rows[0] };
  } catch (err) {
    context.log('jobs-status poll ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
  }
};
