'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
module.exports = async function(context, req) {
  if (handleCors(context, req)) return;
  const checks = {
    database: !!(process.env.PG_HOST && process.env.PG_DATABASE && process.env.PG_USER && process.env.PG_PASSWORD),
    storage: !!(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY && process.env.AZURE_UPLOAD_CONTAINER && process.env.AZURE_RESULTS_CONTAINER),
    otpWorkflow: !!process.env.PA_EMAIL_SEND,
    redactionWorkflow: !!process.env.PA_JOB_SUBMIT_FLOW,
    callbackProtection: !!process.env.PA_CALLBACK_SECRET,
    applicationUrl: !!process.env.APP_URL
  };
  const ready = Object.values(checks).every(Boolean);
  context.res = { status: ready ? 200 : 503, headers: { ...getCorsHeaders(req), 'Cache-Control':'no-store' }, body: { service:'Prudent Redact', version:'8.0-enterprise-review', status:ready?'ready':'configuration_required', checks, timestamp:new Date().toISOString() } };
};
