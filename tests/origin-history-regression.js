'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const check = (ok, message) => {
  if (!ok) { console.error('FAIL:', message); process.exitCode = 1; }
  else console.log('PASS:', message);
};

const cors = read('api/cors.js');
check(cors.includes('x-forwarded-host'), 'CORS derives the current Azure deployment host');
check(cors.includes('requestHostOrigins'), 'CORS has same-origin runtime host validation');
check(cors.includes('brave-cliff-0ceef0a00.4.azurestaticapps.net'), 'locked previous deployment origin is preserved');

const history = read('api/jobs-list/index.js');
check(history.includes('j.user_id = $1'), 'Processing History is scoped directly by signed user ID');
check(history.includes('information_schema.columns'), 'Processing History tolerates optional job columns');
check(!history.includes('WHERE u.email = $1'), 'Processing History no longer depends on mutable profile email');

const governance = read('api/governance/index.js');
check(governance.includes('information_schema.columns'), 'Governance tolerates optional job columns');
check(governance.includes('j.user_id = $1'), 'Governance remains scoped by signed user ID');

const expected = '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803';
const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'api/jobs-submit/index.js'))).digest('hex');
check(actual === expected, 'locked Power Automate jobs-submit file is unchanged');

if (process.exitCode) process.exit(process.exitCode);
console.log('Origin and Processing History regression tests passed.');
