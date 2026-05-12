'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const pool = require('../db');

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const email = (req.body?.email || '').trim().toLowerCase();
  const days  = parseInt(req.body?.days || '0', 10);

  if (!email) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Email required.' } };
    return;
  }

  try {
    // days=0 means all time — no date filter
    const dateFilter = days > 0
      ? `AND j.submitted_at > NOW() - INTERVAL '1 day' * ${parseInt(days, 10)}`
      : '';

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
        ${dateFilter}
      ORDER BY j.submitted_at DESC
      LIMIT 200
    `, [email]);

    context.log(`jobs-list: ${result.rows.length} jobs for ${email}`);

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : result.rows,
    };
  } catch (err) {
    context.log('jobs-list ERROR:', err.message);
    context.res = {
      status  : 500,
      headers : getCorsHeaders(req),
      body    : { error: err.message },
    };
  }
};
