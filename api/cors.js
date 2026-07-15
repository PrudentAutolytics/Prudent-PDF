'use strict';

const normalizeOrigin = value => {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return '';
  }
};

const splitHeader = value => String(value || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const LOCKED_DEPLOYMENT_ORIGINS = [
  // Existing deployments are intentionally preserved for backward compatibility.
  'https://brave-cliff-0ceef0a00.4.azurestaticapps.net',
  'https://nice-grass-0f3d2db00.7.azurestaticapps.net',
  'https://redact.prudentautolytics.com',
];

const CONFIGURED_ORIGINS = [
  ...splitHeader(process.env.ALLOWED_ORIGINS),
  process.env.APP_URL,
  ...LOCKED_DEPLOYMENT_ORIGINS,
  'http://localhost:4280',
  'http://localhost:7071',
].map(normalizeOrigin).filter(Boolean);

const ALLOWED_ORIGINS = [...new Set(CONFIGURED_ORIGINS)];

function requestHostOrigins(req) {
  const headers = req?.headers || {};
  const forwardedHost = splitHeader(headers['x-forwarded-host'] || headers['X-Forwarded-Host'])[0];
  const host = forwardedHost || headers.host || headers.Host || '';
  if (!host) return [];

  const forwardedProto = splitHeader(headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'])[0];
  const proto = forwardedProto || (String(host).includes('localhost') ? 'http' : 'https');
  return [normalizeOrigin(`${proto}://${host}`)].filter(Boolean);
}

function isOriginAllowed(req) {
  const origin = normalizeOrigin(req?.headers?.origin);
  if (!origin) return true;

  const runtimeOrigins = requestHostOrigins(req);
  return ALLOWED_ORIGINS.includes(origin) || runtimeOrigins.includes(origin);
}

function getCorsHeaders(req) {
  const origin = normalizeOrigin(req?.headers?.origin);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store, private, max-age=0',
    'Pragma': 'no-cache',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };

  if (origin && isOriginAllowed(req)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function handleCors(context, req) {
  if (!isOriginAllowed(req)) {
    context.res = {
      status: 403,
      headers: getCorsHeaders(req),
      body: { error: 'Origin is not permitted.' },
    };
    return true;
  }

  if (String(req?.method || '').toUpperCase() === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: getCorsHeaders(req),
      body: '',
    };
    return true;
  }

  return false;
}

module.exports = {
  getCorsHeaders,
  handleCors,
  ALLOWED_ORIGINS,
  isOriginAllowed,
  normalizeOrigin,
  requestHostOrigins,
};
