'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();
  const days  = parseInt(req.body?.days || '30', 10);

  if (!email) { context.res = { status: 400, body: { error: 'Email required.' } }; return; }

  try {
    const result = await pool.query(`
      SELECT j.id, j.file_name, j.status, j.page_count, j.cost_total,
             j.submitted_at, j.completed_at, j.result_url, j.file_size_bytes
      FROM jobs j
      INNER JOIN users u ON u.id = j.user_id
      WHERE u.email = $1 AND j.submitted_at > NOW() - INTERVAL '1 day' * $2
      ORDER BY j.submitted_at DESC LIMIT 25
    `, [email, days]);

    context.res = { status: 200, body: result.rows };
  } catch (err) {
    console.error('jobs-list error:', err);
    context.res = { status: 500, body: { error: 'Failed to fetch job history.' } };
  }
};
