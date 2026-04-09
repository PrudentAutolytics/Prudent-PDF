'use strict';
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  const email    = (req.body?.email    || '').trim().toLowerCase();
  const fileName = (req.body?.fileName || '').trim();

  if (!email || !fileName) {
    context.res = { status: 400, headers: {'Content-Type':'application/json'}, body: { error: 'Email and fileName required.' } };
    return;
  }

  try {
    const account    = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;
    const container  = process.env.AZURE_UPLOAD_CONTAINER || 'prudent-uploads';

    if (!account || !accountKey) {
      throw new Error('Storage account not configured.');
    }

    const credential = new StorageSharedKeyCredential(account, accountKey);
    const safeName   = email.split('@')[0].replace(/[^a-z0-9]/gi, '-');
    const blobName   = `${safeName}-${Date.now()}-${fileName}`;

    const sasToken = generateBlobSASQueryParameters({
      containerName : container,
      blobName      : blobName,
      permissions   : BlobSASPermissions.parse('cw'),
      expiresOn     : new Date(Date.now() + 15 * 60 * 1000), // 15 min
    }, credential).toString();

    const sasUrl  = `https://${account}.blob.core.windows.net/${container}/${blobName}?${sasToken}`;
    const blobUrl = `https://${account}.blob.core.windows.net/${container}/${blobName}`;

    context.log('blob-sas: generated for', blobName);

    context.res = {
      status  : 200,
      headers : { 'Content-Type': 'application/json' },
      body    : { sasUrl, blobUrl, blobName, container },
    };
  } catch (err) {
    context.log('blob-sas ERROR:', err.message);
    context.res = {
      status  : 500,
      headers : { 'Content-Type': 'application/json' },
      body    : { error: 'Failed to generate upload URL: ' + err.message },
    };
  }
};