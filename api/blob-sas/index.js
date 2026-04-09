'use strict';
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

const PLAN_LIMITS = {
  trial        : { maxFileSizeMB: 10  },
  starter      : { maxFileSizeMB: 25  },
  professional : { maxFileSizeMB: 50  },
  business     : { maxFileSizeMB: 100 },
  enterprise   : { maxFileSizeMB: 500 },
};

module.exports = async function (context, req) {
  const email     = (req.body?.email     || '').trim().toLowerCase();
  const fileName  = (req.body?.fileName  || '').trim();
  const jobId     = (req.body?.jobId     || '').trim();
  const blobName  = (req.body?.blobName  || '').trim();
  const container = (req.body?.container || '').trim();
  const mode      = (req.body?.mode      || 'write').trim();
  const fileSizeBytes = req.body?.fileSize || 0;

  if (!email) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'Email required.' } };
    return;
  }

  try {
    const account    = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;
    if (!account || !accountKey) throw new Error('Storage not configured.');

    const uploadContainer  = process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads';
    const resultsContainer = process.env.AZURE_RESULTS_CONTAINER || 'prudent-results';
    const credential       = new StorageSharedKeyCredential(account, accountKey);

    let targetContainer, targetBlobName, permissions;

    if (mode === 'read') {
      // Read SAS for viewing existing blobs
      targetContainer = container || uploadContainer;
      targetBlobName  = blobName;
      permissions     = BlobSASPermissions.parse('r');
      if (!targetBlobName) throw new Error('blobName required for read mode.');
    } else {
      // Write SAS — enforce file size limit
      if (fileSizeBytes > 0) {
        const pool = require('../db');
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
              headers : { 'Content-Type': 'application/json' },
              body    : { error: `File too large. Your ${plan} plan allows up to ${user.max_file_size_mb || planLimits.maxFileSizeMB} MB per file.` },
            };
            return;
          }
        }
      }

      targetContainer = uploadContainer;
      const emailPrefix  = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const safeFileName = (fileName || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      const id           = jobId || Date.now().toString();
      targetBlobName     = `${id}_${emailPrefix}_${safeFileName}`;
      permissions        = BlobSASPermissions.parse('cw');
    }

    const expiresOn = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const sasToken  = generateBlobSASQueryParameters({
      containerName : targetContainer,
      blobName      : targetBlobName,
      permissions,
      expiresOn,
    }, credential).toString();

    const sasUrl  = `https://${account}.blob.core.windows.net/${targetContainer}/${targetBlobName}?${sasToken}`;
    const blobUrl = `https://${account}.blob.core.windows.net/${targetContainer}/${targetBlobName}`;

    context.log(`blob-sas: ${mode} SAS for ${targetBlobName}`);

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : { sasUrl, blobUrl, blobName: targetBlobName, container: targetContainer },
    };
  } catch (err) {
    context.log('blob-sas ERROR:', err.message);
    context.res = { status: 500, headers: {'Content-Type':'application/json'}, body: { error: err.message } };
  }
};