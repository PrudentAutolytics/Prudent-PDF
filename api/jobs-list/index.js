'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();
  const days  = parseInt(req.body?.days || '30', 10);

  if (!email) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'Email required.' } };
    return;
  }

  try {
    const result = await pool.query(`
      SELECT
        j.id           AS "jobId",
        j.file_name    AS "fileName",
        j.status,
        j.result_url   AS "resultUrl",
        j.blob_url     AS "blobUrl",
        j.page_count   AS "pageCount",
        j.cost_total   AS "costTotal",
        j.file_size_bytes AS "fileSize",
        j.submitted_at AS "submittedAt",
        j.completed_at AS "completedAt",
        j.error_message AS "errorMessage"
      FROM jobs j
      INNER JOIN users u ON u.id = j.user_id
      WHERE u.email = $1
        AND j.submitted_at > NOW() - INTERVAL '1 day' * $2
      ORDER BY j.submitted_at DESC
      LIMIT 50
    `, [email, days]);

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : result.rows,
    };
  } catch (err) {
    context.log('jobs-list ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};