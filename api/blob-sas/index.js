'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession }              = require('../auth');
const pool                           = require('../db');
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

/**
 * ENTERPRISE HARDENING:
 *  - READ mode now enforces OWNERSHIP. Previously any logged-in user
 *    could request a read SAS for ANY blob name in ANY container,
 *    which on a redaction product means cross-tenant access to other
 *    customers' documents. The blob must now match a job row owned by
 *    the authenticated user (blob_url or result_url).
 *  - Identity is taken from the verified session (auth.email), never
 *    from a caller-supplied field.
 *  - SAS lifetime reduced to 30 minutes for reads / 1 hour for writes.
 */
const PLAN_LIMITS = {
  trial        : { maxFileSizeMB: 10  },
  starter      : { maxFileSizeMB: 25  },
  professional : { maxFileSizeMB: 50  },
  business     : { maxFileSizeMB: 100 },
  enterprise   : { maxFileSizeMB: 500 },
};

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  // ── Session auth ──
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }
  const email = auth.email; // trusted identity from the session token

  const fileName  = (req.body?.fileName  || '').trim();
  const jobId     = (req.body?.jobId     || '').trim();
  const blobName  = (req.body?.blobName  || '').trim();
  const container = (req.body?.container || '').trim();
  const mode      = (req.body?.mode      || 'write').trim();
  const fileSizeBytes = req.body?.fileSize || 0;

  try {
    const account    = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;
    if (!account || !accountKey) throw new Error('Storage not configured.');

    const uploadContainer  = process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads';
    const resultsContainer = process.env.AZURE_RESULTS_CONTAINER || 'prudent-results';
    const credential       = new StorageSharedKeyCredential(account, accountKey);

    let targetContainer, targetBlobName, permissions, expiryMinutes;

    if (mode === 'read') {
      if (!blobName) throw new Error('blobName required for read mode.');
      targetContainer = container || uploadContainer;

      // Only the two known containers are ever valid targets
      if (![uploadContainer, resultsContainer].includes(targetContainer)) {
        context.res = { status: 400, headers: getCorsHeaders(req), body: { error: 'Invalid container.' } };
        return;
      }

      // OWNERSHIP CHECK — the blob must belong to one of this user's jobs
      const requestedUrl = `https://${account}.blob.core.windows.net/${targetContainer}/${blobName}`;
      const owned = await pool.query(`
        SELECT j.id
        FROM jobs j
        INNER JOIN users u ON u.id = j.user_id
        WHERE u.email = $1 AND (j.blob_url = $2 OR j.result_url = $2)
        LIMIT 1
      `, [email, requestedUrl]);

      if (!owned.rows.length) {
        context.log(`blob-sas DENIED read: ${email} requested ${targetContainer}/${blobName}`);
        context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'You do not have access to this file.' } };
        return;
      }

      targetBlobName = blobName;
      permissions    = BlobSASPermissions.parse('r');
      expiryMinutes  = 30;

    } else {
      // Write SAS — enforce file size limit
      if (fileSizeBytes > 0) {
        const userResult = await pool.query(
          `SELECT plan, max_file_size_mb FROM users WHERE email = $1`, [email]
        );
        const user = userResult.rows[0];
        if (user) {
          const plan       = user.plan || 'trial';
          const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
          const maxBytes   = (user.max_file_size_mb || planLimits.maxFileSizeMB) * 1024 * 1024;
          if (fileSizeBytes > maxBytes) {
            context.res = {
              status  : 413,
              headers : getCorsHeaders(req),
              body    : { error: `File too large. Your ${plan} plan allows up to ${user.max_file_size_mb || planLimits.maxFileSizeMB} MB per file.` },
            };
            return;
          }
        }
      }

      targetContainer    = uploadContainer;
      const emailPrefix  = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const safeFileName = (fileName || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      const id           = jobId || Date.now().toString();
      targetBlobName     = `${id}_${emailPrefix}_${safeFileName}`;
      permissions        = BlobSASPermissions.parse('cw');
      expiryMinutes      = 60;
    }

    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const sasToken  = generateBlobSASQueryParameters({
      containerName : targetContainer,
      blobName      : targetBlobName,
      permissions,
      expiresOn,
    }, credential).toString();

    const sasUrl  = `https://${account}.blob.core.windows.net/${targetContainer}/${targetBlobName}?${sasToken}`;
    const blobUrl = `https://${account}.blob.core.windows.net/${targetContainer}/${targetBlobName}`;

    context.log(`blob-sas: ${mode} SAS for ${targetBlobName} (${email})`);

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : { sasUrl, blobUrl, blobName: targetBlobName, container: targetContainer },
    };
  } catch (err) {
    context.log('blob-sas ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
  }
};
