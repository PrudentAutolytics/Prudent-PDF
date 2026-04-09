'use strict';
const pool = require('../db');

// Fallback hardcoded URL in case env var is not available
const PA_FLOW_FALLBACK = 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc';

module.exports = async function (context, req) {
  const PA_JOB_FLOW_URL = process.env.PA_JOB_SUBMIT_FLOW || PA_FLOW_FALLBACK;

  const email         = (req.body?.email    || '').trim().toLowerCase();
  const fileName      = (req.body?.fileName || '').trim();
  const blobUrl       = (req.body?.blobUrl  || '').trim();
  const blobName      = (req.body?.blobName || '').trim();
  const jobId         = (req.body?.jobId    || '').trim();
  const fileSizeBytes = req.body?.fileSize  || 0;
  const estCost       = req.body?.estCost   || null;

  context.log('jobs-submit:', { email, fileName, hasBlob: !!blobUrl, jobId, paUrl: PA_JOB_FLOW_URL ? 'SET' : 'MISSING' });

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

    // Trigger Power Automate
    context.log('jobs-submit: triggering PA flow for job', finalJobId);
    let paStatus = 0;
    let paError  = null;
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
          storageAccount   : process.env.AZURE_STORAGE_ACCOUNT   || 'redacta01f',
        }),
      });
      paStatus = paRes.status;
      context.log('PA flow response status:', paStatus);
    } catch (paErr2) {
      paError = paErr2.message;
      context.log('PA flow trigger error:', paErr2.message);
    }

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : {
        jobId      : finalJobId,
        status     : 'queued',
        blobUrl,
        blobName,
        paTriggered : paStatus >= 200 && paStatus < 300,
        paStatus,
        paError,
        message    : 'Job queued successfully.',
      },
    };
  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};