'use strict';
const pool = require('../db');

module.exports = async function (context, req) {
  // Read env var inside handler — not at module load time
  const PA_JOB_FLOW_URL = process.env.PA_JOB_SUBMIT_FLOW;

  const email         = (req.body?.email    || '').trim().toLowerCase();
  const fileName      = (req.body?.fileName || '').trim();
  const blobUrl       = (req.body?.blobUrl  || '').trim();
  const blobName      = (req.body?.blobName || '').trim();
  const jobId         = (req.body?.jobId    || '').trim();
  const fileSizeBytes = req.body?.fileSize  || 0;
  const estCost       = req.body?.estCost   || null;

  context.log('jobs-submit:', { email, fileName, hasBlob: !!blobUrl, jobId, paConfigured: !!PA_JOB_FLOW_URL });

  if (!email || !fileName || !blobUrl) {
    context.res = {
      status  : 400,
      headers : { 'Content-Type': 'application/json' },
      body    : { error: `Missing: ${!email?'email ':''} ${!fileName?'fileName ':''} ${!blobUrl?'blobUrl':''}`.trim() },
    };
    return;
  }

  try {
    const userResult = await pool.query(
      `SELECT id, credits_used, credits_limit, is_active FROM users WHERE email = $1`, [email]
    );
    const user = userResult.rows[0];
    if (!user)           { context.res = { status: 404, headers: {'Content-Type':'application/json'}, body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Account inactive.' } }; return; }
    if (user.credits_used >= user.credits_limit) {
      context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Quota exceeded. Please upgrade.' } };
      return;
    }

    // Insert job record
    const jobResult = await pool.query(`
      INSERT INTO jobs (id, user_id, file_name, blob_url, file_size_bytes, status, cost_total)
      VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, 'queued', $6)
      ON CONFLICT (id) DO UPDATE SET status = 'queued', blob_url = EXCLUDED.blob_url
      RETURNING id, status
    `, [jobId || null, user.id, fileName, blobUrl, fileSizeBytes, estCost]);

    const finalJobId = jobResult.rows[0].id;

    // Increment credits
    await pool.query(`UPDATE users SET credits_used = credits_used + 1 WHERE id = $1`, [user.id]);

    // Trigger Power Automate — await it so we can log the response
    if (PA_JOB_FLOW_URL) {
      context.log('jobs-submit: triggering PA flow for job', finalJobId);
      try {
        const paRes = await fetch(PA_JOB_FLOW_URL, {
          method  : 'POST',
          headers : { 'Content-Type': 'application/json' },
          body    : JSON.stringify({
            jobId            : finalJobId,
            email            : email,
            fileName         : fileName,
            blobName         : blobName,
            blobUrl          : blobUrl,
            fileSize         : fileSizeBytes,
            uploadContainer  : process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads',
            resultsContainer : process.env.AZURE_RESULTS_CONTAINER || 'prudent-results',
            storageAccount   : process.env.AZURE_STORAGE_ACCOUNT,
          }),
        });
        context.log('PA flow response status:', paRes.status);
      } catch (paErr) {
        context.log('PA flow trigger error (non-fatal):', paErr.message);
      }
    } else {
      context.log('jobs-submit: PA_JOB_SUBMIT_FLOW not set — skipping PA trigger');
    }

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : {
        jobId   : finalJobId,
        status  : 'queued',
        blobUrl,
        blobName,
        paTriggered : !!PA_JOB_FLOW_URL,
        message : 'Job queued successfully.',
      },
    };
  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};