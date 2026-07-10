'use strict';

const ALLOWED_ORIGINS = [
  'https://brave-cliff-0ceef0a00.4.azurestaticapps.net',
  'http://localhost:4280',
  'http://localhost:7071',
];

function getCorsHeaders(req) {
  const origin        = (req?.headers?.origin || '').toString();
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type'                : 'application/json',
    'Access-Control-Allow-Origin' : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age'      : '86400',
  };
}

function handleCors(context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: getCorsHeaders(req), body: '' };
    return true;
  }
  return false;
}

module.exports = { getCorsHeaders, handleCors };