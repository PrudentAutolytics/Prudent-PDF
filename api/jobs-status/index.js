'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const jobId = (req.body?.jobId || '').trim();
  const email = (req.body?.email || '').trim().toLowerCase();

  if (!jobId || !email) { context.res = { status: 400, body: { error: 'jobId and email required.' } }; return; }

  try {
    const result = await pool.query(`
      SELECT j.id, j.status, j.result_url, j.page_count, j.cost_total,
             j.error_message, j.extracted_fields, j.submitted_at, j.completed_at
      FROM jobs j
      INNER JOIN users u ON u.id = j.user_id
      WHERE j.id = $1 AND u.email = $2
    `, [jobId, email]);

    if (!result.rows[0]) { context.res = { status: 404, body: { error: 'Job not found.' } }; return; }
    context.res = { status: 200, body: result.rows[0] };
  } catch (err) {
    console.error('jobs-status error:', err);
    context.res = { status: 500, body: { error: 'Failed to fetch job status.' } };
  }
};
