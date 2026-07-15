'use strict';
const assert = require('assert');
const path = require('path');
process.env.APP_URL='https://portal.example.com';
process.env.ALLOWED_ORIGINS='https://custom.example.com';
const cors=require(path.resolve(__dirname,'../api/cors.js'));

let req={method:'POST',headers:{origin:'https://portal.example.com'}};
let headers=cors.getCorsHeaders(req);
assert.equal(headers['Access-Control-Allow-Origin'],'https://portal.example.com');
assert.match(headers['Cache-Control'],/no-store/);
let context={};
assert.equal(cors.handleCors(context,{method:'POST',headers:{origin:'https://evil.example.com'}}),true);
assert.equal(context.res.status,403);
context={};
assert.equal(cors.handleCors(context,{method:'OPTIONS',headers:{origin:'https://custom.example.com'}}),true);
assert.equal(context.res.status,204);
console.log('CORS unit tests passed.');

// Azure Static Web Apps same-origin requests must be accepted even when
// APP_URL/ALLOWED_ORIGINS were not updated for a newly created deployment.
{
  const req = {
    method: 'POST',
    headers: {
      origin: 'https://new-prudent-app.4.azurestaticapps.net',
      'x-forwarded-host': 'new-prudent-app.4.azurestaticapps.net',
      'x-forwarded-proto': 'https'
    }
  };
  const context = {};
  assert.strictEqual(cors.handleCors(context, req), false, 'same-origin Azure request should be allowed');
  assert.strictEqual(
    cors.getCorsHeaders(req)['Access-Control-Allow-Origin'],
    'https://new-prudent-app.4.azurestaticapps.net',
    'same-origin Azure response should echo the validated origin'
  );
}

// A foreign origin must still be rejected even if it targets the same API.
{
  const req = {
    method: 'POST',
    headers: {
      origin: 'https://attacker.example',
      'x-forwarded-host': 'new-prudent-app.4.azurestaticapps.net',
      'x-forwarded-proto': 'https'
    }
  };
  const context = {};
  assert.strictEqual(cors.handleCors(context, req), true, 'foreign origin should be rejected');
  assert.strictEqual(context.res.status, 403, 'foreign origin should receive 403');
}

