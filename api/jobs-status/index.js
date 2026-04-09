'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const jobId  = (req.body?.jobId  || '').trim();
  const email  = (req.body?.email  || '').trim().toLowerCase();
  const status = (req.body?.status || '').trim();

  if (!jobId) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'jobId required.' } };
    return;
  }

  try {
    // If status is provided — this is a PA callback to UPDATE job status
    if (status) {
      context.log('jobs-status UPDATE:', jobId, '->', status);

      const resultUrl    = (req.body?.resultUrl    || '').trim() || null;
      const pageCount    = req.body?.pageCount     || null;
      const costTotal    = req.body?.costTotal     || null;
      const errorMessage = (req.body?.errorMessage || '').trim() || null;
      const extractedFields = req.body?.extractedFields || null;

      await pool.query(`
        UPDATE jobs SET
          status           = $1,
          result_url       = COALESCE($2, result_url),
          page_count       = COALESCE($3, page_count),
          cost_total       = COALESCE($4, cost_total),
          error_message    = $5,
          extracted_fields = COALESCE($6, extracted_fields),
          completed_at     = CASE WHEN $1 IN ('complete','failed') THEN NOW() ELSE completed_at END
        WHERE id = $7
      `, [status, resultUrl, pageCount, costTotal, errorMessage,
          extractedFields ? JSON.stringify(extractedFields) : null,
          jobId]);

      context.log('jobs-status: updated job', jobId, 'to', status);

      context.res = {
        status  : 200,
        headers : { 'Content-Type': 'application/json' },
        body    : { success: true, jobId, status },
      };
      return;
    }

    // Otherwise — GET job status (polling from frontend)
    const whereClause = email
      ? `j.id = $1 AND u.email = $2`
      : `j.id = $1`;
    const params = email ? [jobId, email] : [jobId];

    const result = await pool.query(`
      SELECT j.id, j.status, j.result_url, j.page_count, j.cost_total,
             j.error_message, j.extracted_fields, j.submitted_at, j.completed_at,
             j.file_name, j.blob_url, j.file_size_bytes
      FROM jobs j
      ${email ? 'INNER JOIN users u ON u.id = j.user_id' : ''}
      WHERE ${whereClause}
    `, params);

    if (!result.rows[0]) {
      context.res = { status: 404, headers: {'Content-Type':'application/json'}, body: { error: 'Job not found.' } };
      return;
    }

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : result.rows[0],
    };

  } catch (err) {
    context.log('jobs-status ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};