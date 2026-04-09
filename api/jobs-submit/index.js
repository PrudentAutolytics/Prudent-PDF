'use strict';
const pool = require('../db');
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

const PA_FLOW_FALLBACK = 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc';

/* ── Cost calculator ── */
function calculateCosts(pageCount, fileSizeMB) {
  const pages = pageCount || 1;
  const sizeMB = fileSizeMB || 0.1;

  // Azure actual costs
  const docIntelCost  = pages   * 0.001;           // $0.001 per page
  const blobCost      = sizeMB  * 0.00002;          // $0.00002 per MB
  const functionsCost = 0.000002 * 3;               // 3 function calls
  const paFlowCost    = 0.0006  * 2;                // 2 PA flow runs
  const emailCost     = 0.00014;                    // 1 email notification
  const azureTotal    = docIntelCost + blobCost + functionsCost + paFlowCost + emailCost;
  const azureTotalWithOverhead = azureTotal * 1.20; // 20% overhead

  // Product price = 2x Azure cost (your margin)
  const productPrice  = azureTotalWithOverhead * 2;

  return {
    breakdown: {
      docIntelligence : +docIntelCost.toFixed(6),
      blobStorage     : +blobCost.toFixed(6),
      azureFunctions  : +functionsCost.toFixed(6),
      powerAutomate   : +paFlowCost.toFixed(6),
      notification    : +emailCost.toFixed(6),
    },
    azureCost    : +azureTotalWithOverhead.toFixed(6), // what it costs you
    productPrice : +productPrice.toFixed(6),           // what you charge (2x)
    pageCount    : pages,
    fileSizeMB   : +sizeMB.toFixed(3),
  };
}

function generateSasUrl(account, accountKey, container, blobName, permissions, hours = 4) {
  try {
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const sasToken   = generateBlobSASQueryParameters({
      containerName : container,
      blobName,
      permissions   : BlobSASPermissions.parse(permissions),
      expiresOn     : new Date(Date.now() + hours * 60 * 60 * 1000),
    }, credential).toString();
    return `https://${account}.blob.core.windows.net/${container}/${blobName}?${sasToken}`;
  } catch { return null; }
}

function extractBlobName(blobUrl) {
  try { return new URL(blobUrl).pathname.split('/').slice(2).join('/'); }
  catch { return null; }
}

module.exports = async function (context, req) {
  const PA_JOB_FLOW_URL = process.env.PA_JOB_SUBMIT_FLOW || PA_FLOW_FALLBACK;

  const email         = (req.body?.email    || '').trim().toLowerCase();
  const fileName      = (req.body?.fileName || '').trim();
  const blobUrl       = (req.body?.blobUrl  || '').trim();
  const fileBase64    = req.body?.fileBase64 || null;
  const jobId         = (req.body?.jobId    || '').trim();
  const fileSizeBytes = req.body?.fileSize  || 0;
  const fileSizeMB    = req.body?.fileSizeMB || +(fileSizeBytes / 1_048_576).toFixed(3);
  const estPageCount  = req.body?.estPageCount || Math.max(1, Math.round(fileSizeBytes / 60_000));
  const actualBlobName = extractBlobName(blobUrl) || (req.body?.blobName || '').trim();

  if (!email || !fileName || !blobUrl) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: `Missing: ${!email?'email ':''} ${!fileName?'fileName ':''} ${!blobUrl?'blobUrl':''}`.trim() } };
    return;
  }

  try {
    // Validate user
    const userResult = await pool.query(`SELECT id, credits_used, credits_limit, is_active FROM users WHERE email = $1`, [email]);
    const user = userResult.rows[0];
    if (!user)           { context.res = { status: 404, headers: {'Content-Type':'application/json'}, body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Account inactive.' } }; return; }
    if (user.credits_used >= user.credits_limit) { context.res = { status: 403, headers: {'Content-Type':'application/json'}, body: { error: 'Quota exceeded. Please upgrade.' } }; return; }

    // Calculate costs upfront
    const costs = calculateCosts(estPageCount, fileSizeMB);
    context.log('jobs-submit costs:', JSON.stringify(costs));

    // Insert job
    const jobResult = await pool.query(`
      INSERT INTO jobs (id, user_id, file_name, blob_url, file_size_bytes, status, cost_total)
      VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, 'queued', $6)
      ON CONFLICT (id) DO UPDATE SET status = 'queued', blob_url = EXCLUDED.blob_url
      RETURNING id
    `, [jobId || null, user.id, fileName, blobUrl, fileSizeBytes, costs.productPrice]);

    const finalJobId = jobResult.rows[0].id;
    await pool.query(`UPDATE users SET credits_used = credits_used + 1 WHERE id = $1`, [user.id]);

    // Storage config
    const storageAccount   = process.env.AZURE_STORAGE_ACCOUNT   || 'redacta01f';
    const accountKey       = process.env.AZURE_STORAGE_KEY        || '';
    const uploadContainer  = process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads';
    const resultsContainer = process.env.AZURE_RESULTS_CONTAINER || 'prudent-results';

    // Output naming
    const outputBlobName = `${finalJobId}_redacted_${fileName}`;
    const outputBlobUrl  = `https://${storageAccount}.blob.core.windows.net/${resultsContainer}/${outputBlobName}`;
    await pool.query(`UPDATE jobs SET result_url = $1 WHERE id = $2`, [outputBlobUrl, finalJobId]);

    // SAS URLs
    const inputSasUrl  = actualBlobName ? generateSasUrl(storageAccount, accountKey, uploadContainer,  actualBlobName, 'r',  4) : null;
    const outputSasUrl = generateSasUrl(storageAccount, accountKey, resultsContainer, outputBlobName, 'cw', 4);

    context.log('jobs-submit: job created', finalJobId);

    // ── Return 200 IMMEDIATELY ──
    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : {
        jobId          : finalJobId,
        status         : 'queued',
        blobUrl,
        blobName       : actualBlobName,
        outputBlobName,
        outputBlobUrl,
        costs,
        message        : 'Job queued. Power Automate is processing your file.',
      },
    };

    // ── FIRE AND FORGET — PA runs in background ──
    fetch(PA_JOB_FLOW_URL, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({
        // Job info
        jobId            : finalJobId,
        email,
        fileName,

        // Input file
        blobName         : actualBlobName,
        blobUrl,
        inputSasUrl,
        fileBase64,

        // Output file
        outputBlobName,
        outputBlobUrl,
        outputSasUrl,

        // Storage
        storageAccount,
        uploadContainer,
        resultsContainer,

        // Cost breakdown — both actual and product price
        estimatedPageCount : costs.pageCount,
        fileSizeMB         : costs.fileSizeMB,
        costBreakdown      : costs.breakdown,
        azureCost          : costs.azureCost,      // what it costs you (Azure)
        productPrice       : costs.productPrice,   // what to charge customer (2x)

        // Callback
        callbackUrl : 'https://brave-cliff-0ceef0a00.4.azurestaticapps.net/api/jobs-status',
      }),
    })
    .then(r => context.log('PA triggered, status:', r.status))
    .catch(e => context.log('PA error (non-fatal):', e.message));

  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};