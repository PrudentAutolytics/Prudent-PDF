'use strict';
const pool = require('../db');

const PA_FLOW_FALLBACK = 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc';

module.exports = async function (context, req) {
  const PA_JOB_FLOW_URL = process.env.PA_JOB_SUBMIT_FLOW || PA_FLOW_FALLBACK;

  const email         = (req.body?.email       || '').trim().toLowerCase();
  const fileName      = (req.body?.fileName    || '').trim();
  const blobUrl       = (req.body?.blobUrl     || '').trim();
  const blobName      = (req.body?.blobName    || '').trim();
  const jobId         = (req.body?.jobId       || '').trim();
  const fileSizeBytes = req.body?.fileSize     || 0;
  const estCost       = req.body?.estCost      || null;
  const fileBase64    = req.body?.fileBase64   || null; // base64 of the PDF

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

    await pool.query(`UPDATE users SET credits_used = credits_used + 1 WHERE id = $1`, [user.id]);

    // Construct output file naming convention
    // Input:  {jobId}_{emailPrefix}_{fileName}        in prudent-uploads
    // Output: {jobId}_redacted_{fileName}             in prudent-results
    const storageAccount   = process.env.AZURE_STORAGE_ACCOUNT   || 'redacta01f';
    const uploadContainer  = process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads';
    const resultsContainer = process.env.AZURE_RESULTS_CONTAINER || 'prudent-results';
    const outputBlobName   = `${finalJobId}_redacted_${fileName}`;
    const outputBlobUrl    = `https://${storageAccount}.blob.core.windows.net/${resultsContainer}/${outputBlobName}`;

    // Update DB with the expected result URL immediately
    await pool.query(`UPDATE jobs SET result_url = $1 WHERE id = $2`, [outputBlobUrl, finalJobId]);

    // Trigger Power Automate with everything it needs
    context.log('jobs-submit: triggering PA flow for job', finalJobId);
    let paStatus = 0;
    let paError  = null;

    try {
      const paPayload = {
        // Job identification
        jobId            : finalJobId,
        email            : email,

        // Input file details
        fileName         : fileName,
        blobName         : blobName,
        blobUrl          : blobUrl,
        fileBase64       : fileBase64,       // Base64 PDF — PA can use this directly
        fileSize         : fileSizeBytes,

        // Output file naming — PA should save redacted PDF with this exact name
        outputBlobName   : outputBlobName,   // e.g. "abc123_redacted_Contract.pdf"
        outputBlobUrl    : outputBlobUrl,    // full URL where result will be accessible
        outputContainer  : resultsContainer, // "prudent-results"

        // Storage details — PA needs these to save the output
        storageAccount   : storageAccount,
        uploadContainer  : uploadContainer,
        resultsContainer : resultsContainer,

        // Callback URL — PA calls this when done to update job status
        callbackUrl      : `https://brave-cliff-0ceef0a00.4.azurestaticapps.net/api/jobs-status`,
      };

      const paRes = await fetch(PA_JOB_FLOW_URL, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify(paPayload),
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
        jobId          : finalJobId,
        status         : 'queued',
        blobUrl,
        blobName,
        outputBlobName,
        outputBlobUrl,
        paTriggered    : paStatus >= 200 && paStatus < 300,
        paStatus,
        paError,
        message        : 'Job queued. Power Automate is processing your file.',
      },
    };
  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};