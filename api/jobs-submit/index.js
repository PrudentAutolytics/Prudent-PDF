'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession }              = require('../auth');
const pool = require('../db');
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

/**
 * ENTERPRISE HARDENING:
 *  - Removed the hardcoded Power Automate SAS fallback URL from source
 *    (a live credential committed to git). PA_JOB_SUBMIT_FLOW must be
 *    set as an app setting; the endpoint fails closed if it is not.
 *  - Quota consumption is now ATOMIC (UPDATE ... WHERE credits_used <
 *    credits_limit RETURNING). Two concurrent submissions can no longer
 *    both pass the check.
 *  - The PA flow trigger is AWAITED before responding. The old
 *    fire-and-forget fetch could be killed when the Function invocation
 *    ended, leaving jobs stuck in "queued" forever. If the trigger
 *    fails, the job is marked failed and the credit refunded.
 *  - Identity is taken from the verified session (auth.email).
 *  - fileBase64 is no longer forwarded (the flow reads via inputSasUrl);
 *    this caps request payloads and removes double-handling of content.
 */

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

  const docIntelRead   = pages * 0.0015;  // Read/OCR: $1.50/1000 pages
  const docIntelCustom = pages * 0.010;   // Custom/Prebuilt PII: $10/1000 pages
  const blob           = mb   * 0.00002;
  const functions      = 0.000002 * 3;
  const paFlow         = 0.0006 * 2;
  const email          = 0.00014;

  const azureSubtotal = docIntelRead + docIntelCustom + blob + functions + paFlow + email;
  const azureCost     = azureSubtotal * 1.20;
  const productPrice  = azureCost * 3.5;

  return {
    breakdown: {
      docIntelRead   : +docIntelRead  .toFixed(6),
      docIntelCustom : +docIntelCustom.toFixed(6),
      blob           : +blob          .toFixed(6),
      functions      : +functions     .toFixed(6),
      paFlow         : +paFlow        .toFixed(6),
      email          : +email         .toFixed(6),
    },
    azureCost    : +azureCost   .toFixed(6),
    productPrice : +productPrice.toFixed(6),
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
  if (handleCors(context, req)) return;

  // ── Session auth ──
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }
  const email = auth.email; // trusted identity

  // Fail closed if the backend flow is not configured — never fall back
  // to a URL baked into source code.
  const PA_JOB_FLOW_URL = process.env.PA_JOB_SUBMIT_FLOW;
  if (!PA_JOB_FLOW_URL) {
    context.log('jobs-submit ERROR: PA_JOB_SUBMIT_FLOW app setting is missing.');
    context.res = { status: 503, headers: getCorsHeaders(req), body: { error: 'Processing service is not configured. Please contact support.' } };
    return;
  }

  const fileName      = (req.body?.fileName || '').trim().slice(0, 255);
  const blobUrl       = (req.body?.blobUrl  || '').trim();
  const jobId         = (req.body?.jobId    || '').trim();
  const fileSizeBytes = Number(req.body?.fileSize) || 0;
  const fileSizeMB    = Number(req.body?.fileSizeMB) || +(fileSizeBytes / 1_048_576).toFixed(3);
  const estPageCount  = Number(req.body?.estPageCount) || Math.max(1, Math.round(fileSizeBytes / 60_000));
  const actualBlobName = extractBlobName(blobUrl) || (req.body?.blobName || '').trim();

  if (!fileName || !blobUrl) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'fileName and blobUrl are required.' } };
    return;
  }

  // The blob URL must point at OUR storage account and upload container
  const storageAccount   = process.env.AZURE_STORAGE_ACCOUNT;
  const accountKey       = process.env.AZURE_STORAGE_KEY || '';
  const uploadContainer  = process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads';
  const resultsContainer = process.env.AZURE_RESULTS_CONTAINER || 'prudent-results';
  const expectedPrefix   = `https://${storageAccount}.blob.core.windows.net/${uploadContainer}/`;
  if (!storageAccount || !blobUrl.startsWith(expectedPrefix)) {
    context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Invalid file location.' } };
    return;
  }

  let creditConsumed = false;
  let user;

  try {
    // Get user + plan
    const userResult = await pool.query(`
      SELECT id, credits_used, credits_limit, is_active, plan,
             max_file_size_mb, max_pages_per_file, max_pages_per_month
      FROM users WHERE email = $1
    `, [email]);
    user = userResult.rows[0];
    if (!user)           { context.res = { status: 404, headers: getCorsHeaders(req), body: { error: 'User not found.' } }; return; }
    if (!user.is_active) { context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Account inactive.' } }; return; }

    // Plan limits — from DB columns or PLAN_LIMITS defaults
    const plan       = user.plan || 'trial';
    const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    const maxSizeMB  = user.max_file_size_mb    || planLimits.maxFileSizeMB;
    const maxPages   = user.max_pages_per_file  || planLimits.maxPagesPerFile;

    if (fileSizeMB > maxSizeMB) {
      context.res = { status: 413, headers: getCorsHeaders(req), body: { error: `File too large. Your ${plan} plan allows up to ${maxSizeMB} MB per file. Please upgrade to process larger files.` } };
      return;
    }
    if (estPageCount > maxPages) {
      context.res = { status: 422, headers: getCorsHeaders(req), body: { error: `Document too long. Your ${plan} plan allows up to ${maxPages} pages per file. Please upgrade for larger documents.` } };
      return;
    }

    // ── ATOMIC quota consume — eliminates the check/increment race ──
    const consume = await pool.query(`
      UPDATE users SET credits_used = credits_used + 1
      WHERE id = $1 AND credits_used < credits_limit
      RETURNING credits_used
    `, [user.id]);
    if (!consume.rows.length) {
      context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Monthly file limit reached. Please upgrade your plan.' } };
      return;
    }
    creditConsumed = true;

    // Costs
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

    // Output naming: {jobId}_redacted_{fileName}
    const outputBlobName = `${finalJobId}_redacted_${fileName}`;
    const outputBlobUrl  = `https://${storageAccount}.blob.core.windows.net/${resultsContainer}/${outputBlobName}`;
    await pool.query(`UPDATE jobs SET result_url = $1 WHERE id = $2`, [outputBlobUrl, finalJobId]);

    // SAS URLs for the flow
    const inputSasUrl  = actualBlobName ? generateSasUrl(storageAccount, accountKey, uploadContainer,  actualBlobName, 'r',  4) : null;
    const outputSasUrl = generateSasUrl(storageAccount, accountKey, resultsContainer, outputBlobName, 'cw', 4);

    // ── Trigger PA flow — AWAITED, with a 20s cap ──
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    let paOk = false;
    try {
      const paRes = await fetch(PA_JOB_FLOW_URL, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        signal  : ctrl.signal,
        body    : JSON.stringify({
          jobId            : finalJobId,
          email,
          fileName,
          blobName         : actualBlobName,
          blobUrl,
          inputSasUrl,
          outputBlobName,
          outputBlobUrl,
          outputSasUrl,
          storageAccount,
          uploadContainer,
          resultsContainer,
          estimatedPageCount : costs.pageCount,
          fileSizeMB         : costs.fileSizeMB,
          costBreakdown      : costs.breakdown,
          azureCost          : costs.azureCost,
          productPrice       : costs.productPrice,
          callbackUrl        : `${process.env.APP_URL || 'https://brave-cliff-0ceef0a00.4.azurestaticapps.net'}/api/jobs-status`,
          paSecret           : process.env.PA_CALLBACK_SECRET || '',
        }),
      });
      paOk = paRes.ok || paRes.status === 202;
      context.log('PA triggered, status:', paRes.status);
    } catch (paErr) {
      context.log('PA trigger ERROR:', paErr.message);
    } finally {
      clearTimeout(timer);
    }

    if (!paOk) {
      // Mark failed and refund the credit — no silent stuck-in-queued jobs
      await pool.query(`UPDATE jobs SET status = 'failed', error_message = 'Processing service unavailable.' WHERE id = $1`, [finalJobId]);
      await pool.query(`UPDATE users SET credits_used = GREATEST(0, credits_used - 1) WHERE id = $1`, [user.id]);
      context.res = { status: 502, headers: getCorsHeaders(req), body: { error: 'Processing service is temporarily unavailable. Your credit has not been used. Please try again.' } };
      return;
    }

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : { jobId: finalJobId, status: 'queued', message: 'Job queued.' },
    };

  } catch (err) {
    context.log('jobs-submit ERROR:', err.message);
    if (creditConsumed && user?.id) {
      try { await pool.query(`UPDATE users SET credits_used = GREATEST(0, credits_used - 1) WHERE id = $1`, [user.id]); } catch {}
    }
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
  }
};
