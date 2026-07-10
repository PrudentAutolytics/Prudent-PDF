'use strict';
/**
 * cors.js — CORS headers, env-driven
 *
 * ENTERPRISE HARDENING: allowed origins come from the ALLOWED_ORIGINS
 * app setting (comma-separated) so promoting to a custom domain or a
 * staging slot never requires a code change. Falls back to the current
 * production SWA host + local dev.
 */
const DEFAULT_ORIGINS = [
  'https://brave-cliff-0ceef0a00.4.azurestaticapps.net',
  'http://localhost:4280',
  'http://localhost:7071',
];

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .concat(DEFAULT_ORIGINS);

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
