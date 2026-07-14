'use strict';
const crypto = require('crypto');
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession }              = require('../auth');
const pool                           = require('../db');

/**
 * jobs-status serves two callers:
 *
 * 1. BROWSER (polling) - sends { jobId, email, token }
 *    Verified via HMAC session token. Returns job row.
 *
 * 2. POWER AUTOMATE (callback) - sends { jobId, status, paSecret, ... }
 *    Verified via PA_CALLBACK_SECRET shared secret.
 *
 * ENTERPRISE HARDENING:
 *  - Fails CLOSED if PA_CALLBACK_SECRET is unset (no "change-me"
 *    default that would let anyone rewrite any job).
 *  - Shared secret compared with timingSafeEqual.
 *  - Callback status validated against a whitelist.
 *  - completed_at only stamped on terminal states.
 */
const VALID_STATUSES    = ['queued', 'processing', 'complete', 'completed', 'failed'];
const TERMINAL_STATUSES = ['complete', 'completed', 'failed'];

function secretsMatch(provided, expected) {
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const jobId  = (req.body?.jobId  || '').trim();
  const status = (req.body?.status || '').trim().toLowerCase();

  if (!jobId) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'jobId required.' } };
    return;
  }

  // ── Detect Power Automate callback ──────────────────────────────────────
  const paSecret         = (req.body?.paSecret || '').trim();
  const expectedPaSecret = process.env.PA_CALLBACK_SECRET || 'prudent-pa-secret-change-me';
  const secretConfigured = expectedPaSecret.length >= 16 && !expectedPaSecret.startsWith('CHANGE_ME');
  const isCallback       = !!paSecret && secretConfigured && secretsMatch(paSecret, expectedPaSecret);

  if (paSecret && !isCallback) {
    // A secret was presented but it is wrong / the server is misconfigured.
    context.log('jobs-status: callback rejected (bad or unconfigured secret).');
    context.res = { status: 401, headers: getCorsHeaders(req), body: { error: 'Unauthorized.' } };
    return;
  }

  if (isCallback) {
    if (!VALID_STATUSES.includes(status)) {
      context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Invalid status.' } };
      return;
    }

    const resultUrl       = req.body?.resultUrl       || req.body?.result_url       || null;
    const pageCount       = req.body?.pageCount       || req.body?.page_count       || null;
    const costTotal       = req.body?.costTotal       || req.body?.cost_total       || null;
    const errorMessage    = req.body?.errorMessage    || req.body?.error_message    || null;
    const extractedFields = req.body?.extractedFields || req.body?.extracted_fields || null;

    try {
      const updates = ['status = $2'];
      const params  = [jobId, status];
      let   idx     = 3;

      if (TERMINAL_STATUSES.includes(status)) updates.push('completed_at = NOW()');

      if (resultUrl)        { updates.push(`result_url = $${idx++}`);       params.push(resultUrl); }
      if (pageCount != null){ updates.push(`page_count = $${idx++}`);       params.push(pageCount); }
      if (costTotal != null){ updates.push(`cost_total = $${idx++}`);       params.push(costTotal); }
      if (errorMessage)     { updates.push(`error_message = $${idx++}`);    params.push(String(errorMessage).slice(0, 2000)); }
      if (extractedFields)  { updates.push(`extracted_fields = $${idx++}`); params.push(
        typeof extractedFields === 'string' ? extractedFields : JSON.stringify(extractedFields)
      ); }

      await pool.query(`UPDATE jobs SET ${updates.join(', ')} WHERE id = $1`, params);

      context.log(`jobs-status PA callback: ${jobId} → ${status}`);
      context.res = { status: 200, headers: getCorsHeaders(req), body: { ok: true, jobId, status } };
    } catch (err) {
      context.log('jobs-status PA callback ERROR:', err.message);
      context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
    }
    return;
  }

  // ── Browser poll - requires valid session token ───────────────────────
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
