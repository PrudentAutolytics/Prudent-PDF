'use strict';
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  const email     = (req.body?.email     || '').trim().toLowerCase();
  const fileName  = (req.body?.fileName  || '').trim();
  const jobId     = (req.body?.jobId     || '').trim();
  const blobName  = (req.body?.blobName  || '').trim(); // for read SAS on existing blob
  const container = (req.body?.container || '').trim(); // which container
  const mode      = (req.body?.mode      || 'write').trim(); // 'write' or 'read'

  if (!email) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'Email required.' } };
    return;
  }

  try {
    const account    = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;

    if (!account || !accountKey) throw new Error('Storage not configured.');

    const credential     = new StorageSharedKeyCredential(account, accountKey);
    const uploadContainer  = process.env.AZURE_UPLOAD_CONTAINER  || 'prudent-uploads';
    const resultsContainer = process.env.AZURE_RESULTS_CONTAINER || 'prudent-results';

    let targetContainer, targetBlobName, permissions;

    if (mode === 'read') {
      // Read SAS — for viewing existing blobs
      targetContainer = container || uploadContainer;
      targetBlobName  = blobName;
      permissions     = BlobSASPermissions.parse('r'); // read only
      if (!targetBlobName) throw new Error('blobName required for read mode.');
    } else {
      // Write SAS — for uploading new files
      targetContainer = uploadContainer;
      const emailPrefix  = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const safeFileName = (fileName || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      const id           = jobId || Date.now().toString();
      targetBlobName     = `${id}_${emailPrefix}_${safeFileName}`;
      permissions        = BlobSASPermissions.parse('cw'); // create + write
    }

    const expiresOn = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const sasToken = generateBlobSASQueryParameters({
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