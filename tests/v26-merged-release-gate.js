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

const main = read('css/main.css');
const responsive = read('css/enterprise-responsive.css');
const mediaCss = read('css/media-redaction.css');
const mediaJs = read('js/media-redaction.js');
const mediaHtml = read('pages/media-redaction.html');
const dashboard = read('pages/dashboard.html');
const history = read('api/jobs-list/index.js');

check(main.includes('grid-template-rows: var(--topbar-h) minmax(0,1fr);'), 'fixed viewport scroll ownership model is preserved');
check(main.includes('position: relative;') && main.includes('height: 100%;'), 'sidebar full-height grid-row model is preserved');
check(responsive.includes('html,body{height:100%;overflow:hidden}'), 'desktop document scroll remains disabled');
check(responsive.includes('.main{') && responsive.includes('overflow-y:auto!important'), 'main workspace owns desktop scrolling');
check(responsive.includes('height:auto!important;min-height:100dvh!important;overflow:visible!important'), 'mobile shell returns to document flow');
check(mediaCss.includes('minmax(300px,400px)') && mediaCss.includes('max-width:1180px'), 'media command bar has hardened responsive typography');
check(mediaCss.includes('.btn-full{white-space:normal;height:auto;min-height:40px'), 'media action buttons cannot collapse text');
check(mediaJs.includes('localDetectOnCanvas(source,0,0,416,0.20)'), 'low-threshold full-frame face pass is present');
check(mediaJs.includes('localDetectOnCanvas(source,0,0,512,0.22)'), 'second full-frame face pass is present');
check(mediaJs.includes('overlap=0.34'), 'dense overlapping face scan is present');
check(mediaJs.includes('sourceW>=1500?4:sourceW>=1000?3:2'), 'face tile density scales with wide images');
check(mediaJs.includes('sourceH>=1500?4:sourceH>=1000?3:2'), 'face tile density scales with tall images');
check(mediaJs.includes('dedicated edge and corner bands'), 'face scan includes dedicated edge coverage');
check(mediaHtml.includes('id="facePaddingValue">28%</span>'), 'face safety margin defaults to 28 percent');
check(mediaHtml.includes('min="10" max="60" value="28"'), 'face safety margin range supports conservative coverage');
check(dashboard.includes('PDF documents submitted to the redaction workflow.'), 'redaction job section is explained');
check(!/Recent Document and Media Operations/.test(read('pages/dashboard.html')), 'general operations module is retired per the v35 redaction focus');
check(history.includes('j.user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($3))'), 'same verified email history recovery is present');
check(history.includes('[auth.userId, days || 365, auth.email]'), 'history recovery binds signed session identity');
check(!history.includes('req.body?.email'), 'history never trusts a client-supplied email');
check(!/[\u2013\u2014]/.test(main + responsive + mediaCss + mediaJs + mediaHtml + dashboard + history), 'merged maintained sources contain no en dash or em dash');

const locked = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'api/jobs-submit/index.js')))
  .digest('hex');
check(locked === '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803',
      'locked Power Automate submission file is unchanged');

if (process.exitCode) process.exit(process.exitCode);
console.log('V26 merged release gate passed.');
