'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  const email         = (req.body?.email    || '').trim().toLowerCase();
  const fileName      = (req.body?.fileName || '').trim();
  const blobUrl       = (req.body?.blobUrl  || '').trim();
  const blobName      = (req.body?.blobName || '').trim();
  const jobId         = (req.body?.jobId    || '').trim();
  const fileSizeBytes = req.body?.fileSize  || 0;
  const estCost       = req.body?.estCost   || null;

  context.log('jobs-submit: received', { email, fileName, blobUrl: blobUrl ? 'SET' : 'MISSING', jobId });

  if (!email || !fileName || !blobUrl) {
    context.res = {
      status  : 400,
      headers : { 'Content-Type': 'application/json' },
      body    : { error: `Missing required fields: ${!email?'email ':''} ${!fileName?'fileName ':''} ${!blobUrl?'blobUrl':''}`.trim() },
    };
    return;
  }

  try {
    const userResult = await pool.query(`
      SELECT id, credits_used, credits_limit, is_active FROM users WHERE email = $1
    `, [email]);

    const user = userResult.rows[0];
    if (!user)           { context.res = { status: 404, headers: {'Content-Type':'application/json'}, body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Account inactive.' } }; return; }
    if (user.credits_used >= user.credits_limit) {
      context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Quota exceeded. Please upgrade your plan.' } };
      return;
    }

    // Insert job record
    const jobResult = await pool.query(`
      INSERT INTO jobs (id, user_id, file_name, blob_url, file_size_bytes, status, cost_total)
      VALUES ($1, $2, $3, $4, $5, 'queued', $6)
      ON CONFLICT (id) DO UPDATE SET status = 'queued'
      RETURNING id
    `, [jobId || null, user.id, fileName, blobUrl, fileSizeBytes, estCost]);

    // Increment credits used
    await pool.query(`UPDATE users SET credits_used = credits_used + 1 WHERE id = $1`, [user.id]);

    context.log('jobs-submit: job created', jobResult.rows[0].id);

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : {
        jobId   : jobResult.rows[0].id,
        status  : 'queued',
        blobUrl,
        blobName,
        message : 'Job queued successfully.',
      },
    };
  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    context.res = {
      status  : 500,
      headers : { 'Content-Type': 'application/json' },
      body    : { error: 'Failed to submit job: ' + err.message },
    };
  }
};