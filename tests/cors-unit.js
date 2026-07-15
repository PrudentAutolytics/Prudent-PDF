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
