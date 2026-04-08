'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email         = (req.body?.email    || '').trim().toLowerCase();
  const fileName      = (req.body?.fileName || '').trim();
  const blobUrl       = (req.body?.blobUrl  || '').trim();
  const fileSizeBytes = req.body?.fileSizeBytes || 0;

  if (!email || !fileName || !blobUrl) {
    context.res = { status: 400, body: { error: 'Email, fileName and blobUrl required.' } };
    return;
  }

  try {
    const userResult = await pool.query(`
      SELECT id, credits_used, credits_limit, is_active FROM users WHERE email = $1
    `, [email]);

    const user = userResult.rows[0];
    if (!user)           { context.res = { status: 404, body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, body: { error: 'Account inactive.' } }; return; }
    if (user.credits_used >= user.credits_limit) {
      context.res = { status: 403, body: { error: 'Quota exceeded. Please upgrade your plan.' } };
      return;
    }

    const jobResult = await pool.query(`
      INSERT INTO jobs (user_id, file_name, blob_url, file_size_bytes, status)
      VALUES ($1, $2, $3, $4, 'queued') RETURNING id
    `, [user.id, fileName, blobUrl, fileSizeBytes]);

    await pool.query(`UPDATE users SET credits_used = credits_used + 1 WHERE id = $1`, [user.id]);

    context.res = { status: 200, body: { jobId: jobResult.rows[0].id, status: 'queued' } };
  } catch (err) {
    console.error('jobs-submit error:', err);
    context.res = { status: 500, body: { error: 'Failed to submit job.' } };
  }
};
