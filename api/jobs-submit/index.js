'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const pool = require('../db');
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

const PA_FLOW_FALLBACK = 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc';

/* ── Plan tier limits ── */
const PLAN_LIMITS = {
  trial        : { maxFileSizeMB: 10,  maxPagesPerFile: 50,    maxPagesPerMonth: 50    },
  starter      : { maxFileSizeMB: 25,  maxPagesPerFile: 100,   maxPagesPerMonth: 500   },
  professional : { maxFileSizeMB: 50,  maxPagesPerFile: 500,   maxPagesPerMonth: 2000  },
  business     : { maxFileSizeMB: 100, maxPagesPerFile: 1000,  maxPagesPerMonth: 10000 },
  enterprise   : { maxFileSizeMB: 500, maxPagesPerFile: 999999,maxPagesPerMonth: 50000 },
};

/* ── Real Azure cost calculation ── */
function calculateCosts(pageCount, fileSizeMB) {
  const pages = Math.max(1, pageCount || 1);
  const mb    = fileSizeMB || 0.1;

  // Real Azure Document Intelligence pricing
  const docIntelRead   = pages * 0.0015;  // Read/OCR: $1.50/1000 pages
  const docIntelCustom = pages * 0.010;   // Custom/Prebuilt PII: $10/1000 pages
  const blob           = mb   * 0.00002;
  const functions      = 0.000002 * 3;
  const paFlow         = 0.0006 * 2;
  const email          = 0.00014;

  const azureSubtotal = docIntelRead + docIntelCustom + blob + functions + paFlow + email;
  const azureCost     = azureSubtotal * 1.20;  // +20% overhead
  const productPrice  = azureCost * 3.5;       // 3.5x margin ~72% gross margin

  return {
    breakdown: {
      docIntelRead   : +docIntelRead  .toFixed(6),
      docIntelCustom : +docIntelCustom.toFixed(6),
      blob           : +blob          .toFixed(6),
      functions      : +functions     .toFixed(6),
      paFlow         : +paFlow        .toFixed(6),
      email          : +email         .toFixed(6),
    },
    azureCost    : +azureCost   .toFixed(6), // your cost
    productPrice : +productPrice.toFixed(6), // what customer pays
    pageCount    : pages,
    fileSizeMB   : +mb.toFixed(3),
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
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: `Missing: ${!email?'email ':''} ${!fileName?'fileName ':''} ${!blobUrl?'blobUrl':''}`.trim() } };
    return;
  }

  try {
    // Get user + plan
    const userResult = await pool.query(`
      SELECT id, credits_used, credits_limit, is_active, plan,
             max_file_size_mb, max_pages_per_file, max_pages_per_month
      FROM users WHERE email = $1
    `, [email]);
    const user = userResult.rows[0];
    if (!user)           { context.res = { status: 404, headers: getCorsHeaders(req), body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Account inactive.' } }; return; }
    if (user.credits_used >= user.credits_limit) { context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Monthly file limit reached. Please upgrade your plan.' } }; return; }

    // Get plan limits — from DB columns or fall back to PLAN_LIMITS defaults
    const plan       = user.plan || 'trial';
    const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    const maxSizeMB  = user.max_file_size_mb    || planLimits.maxFileSizeMB;
    const maxPages   = user.max_pages_per_file  || planLimits.maxPagesPerFile;

    // Enforce file size limit
    if (fileSizeMB > maxSizeMB) {
      context.res = { status: 413, headers: getCorsHeaders(req), body: { error: `File too large. Your ${plan} plan allows up to ${maxSizeMB} MB per file. Please upgrade to process larger files.` } };
      return;
    }

    // Enforce estimated page limit (hard check after actual processing in PA)
    if (estPageCount > maxPages) {
      context.res = { status: 422, headers: getCorsHeaders(req), body: { error: `Document too long. Your ${plan} plan allows up to ${maxPages} pages per file. Please upgrade for larger documents.` } };
      return;
    }

    // Calculate costs with real Azure pricing
    const costs = calculateCosts(estPageCount, fileSizeMB);
    context.log('jobs-submit costs:', JSON.stringify(costs));

    // Insert job — store product price as cost_total
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

    // Output naming: {jobId}_redacted_{fileName}
    const outputBlobName = `${finalJobId}_redacted_${fileName}`;
    const outputBlobUrl  = `https://${storageAccount}.blob.core.windows.net/${resultsContainer}/${outputBlobName}`;
    await pool.query(`UPDATE jobs SET result_url = $1 WHERE id = $2`, [outputBlobUrl, finalJobId]);

    // SAS URLs
    const inputSasUrl  = actualBlobName ? generateSasUrl(storageAccount, accountKey, uploadContainer,  actualBlobName, 'r',  4) : null;
    const outputSasUrl = generateSasUrl(storageAccount, accountKey, resultsContainer, outputBlobName, 'cw', 4);

    // ── Return 200 immediately ──
    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : {
        jobId          : finalJobId,
        status         : 'queued',
        blobUrl,
        blobName       : actualBlobName,
        outputBlobName,
        outputBlobUrl,
        costs,
        message        : 'Job queued. Power Automate triggered.',
      },
    };

    // ── Fire and forget PA flow ──
    fetch(PA_JOB_FLOW_URL, {
      method  : 'POST',
      headers : getCorsHeaders(req),
      body    : JSON.stringify({
        jobId            : finalJobId,
        email,
        fileName,
        blobName         : actualBlobName,
        blobUrl,
        inputSasUrl,
        fileBase64,
        outputBlobName,
        outputBlobUrl,
        outputSasUrl,
        storageAccount,
        uploadContainer,
        resultsContainer,
        estimatedPageCount : costs.pageCount,
        fileSizeMB         : costs.fileSizeMB,
        costBreakdown      : costs.breakdown,
        azureCost          : costs.azureCost,     // your cost
        productPrice       : costs.productPrice,  // charge customer this
        callbackUrl        : 'https://brave-cliff-0ceef0a00.4.azurestaticapps.net/api/jobs-status',
      }),
    })
    .then(r => context.log('PA triggered, status:', r.status))
    .catch(e => context.log('PA error (non-fatal):', e.message));

  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: err.message } };
  }
};
