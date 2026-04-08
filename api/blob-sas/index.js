'use strict';
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  const email    = (req.body?.email    || '').trim().toLowerCase();
  const fileName = (req.body?.fileName || '').trim();

  if (!email || !fileName) {
    context.res = { status: 400, body: { error: 'Email and fileName required.' } };
    return;
  }

  try {
    const account    = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;
    const container  = process.env.AZURE_UPLOAD_CONTAINER;

    const credential = new StorageSharedKeyCredential(account, accountKey);
    const safeName   = email.split('@')[0].replace(/[^a-z0-9]/gi, '-');
    const blobName   = `${safeName}-${Date.now()}-${fileName}`;

    const sasToken = generateBlobSASQueryParameters({
      containerName : container,
      blobName      : blobName,
      permissions   : BlobSASPermissions.parse('cw'),
      expiresOn     : new Date(Date.now() + 10 * 60 * 1000),
    }, credential).toString();

    const sasUrl  = `https://${account}.blob.core.windows.net/${container}/${blobName}?${sasToken}`;
    const blobUrl = `https://${account}.blob.core.windows.net/${container}/${blobName}`;

    context.res = { status: 200, body: { sasUrl, blobUrl, blobName } };
  } catch (err) {
    console.error('blob-sas error:', err);
    context.res = { status: 500, body: { error: 'Failed to generate upload URL.' } };
  }
};
