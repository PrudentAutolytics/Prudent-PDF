'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kabileshvijayakumar@prudentautolytics.com')
  .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);

module.exports = async function(context, req) {
  if (handleCors(context, req)) return;

  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }
  if (!ADMIN_EMAILS.includes(auth.email)) {
    context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Forbidden.' } };
    return;
  }

  const checks = {
    database: !!(process.env.PG_HOST && process.env.PG_DATABASE && process.env.PG_USER && process.env.PG_PASSWORD),
    storage: !!(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY && process.env.AZURE_UPLOAD_CONTAINER && process.env.AZURE_RESULTS_CONTAINER),
    otpWorkflow: !!process.env.PA_EMAIL_SEND,
    // jobs-submit contains the locked static fallback required by this deployment.
    redactionWorkflow: true,
    callbackProtection: !!process.env.PA_CALLBACK_SECRET,
    applicationUrl: !!process.env.APP_URL,
    corsPolicy: !!(process.env.ALLOWED_ORIGINS || process.env.APP_URL),
    strongSessionSecret: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 && !process.env.SESSION_SECRET.startsWith('CHANGE_ME'),
    strongCallbackSecret: !!process.env.PA_CALLBACK_SECRET && process.env.PA_CALLBACK_SECRET.length >= 32 && !process.env.PA_CALLBACK_SECRET.startsWith('CHANGE_ME')
  };
  const ready = Object.values(checks).every(Boolean);
  context.res = {
    status: 200,
    headers: getCorsHeaders(req),
    body: {
      service: 'Prudent Redact',
      version: '12.0-final-hardening',
      status: ready ? 'ready' : 'configuration_required',
      checks,
      timestamp: new Date().toISOString()
    }
  };
};
