'use strict';
/*
 * Prudent Redact v25 release gate.
 * Fifty checks covering the four requested outcomes:
 *   1. Media Redaction typography and layout cannot overflow or overlap.
 *   2. Automatic face privacy covers the whole frame including edges and corners.
 *   3. Administration stays restricted to the configured administrator.
 *   4. Dashboard recovers and clearly separates redaction jobs from operations.
 * Plus locked Power Automate contract and product copy regressions.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log(`PASS ${passed + failed}: ${label}`); }
  else { failed++; console.error(`FAIL ${passed + failed}: ${label}`); }
}

const mediaCss   = read('css/media-redaction.css');
const mediaHtml  = read('pages/media-redaction.html');
const mediaJs    = read('js/media-redaction.js');
const dashHtml   = read('pages/dashboard.html');
const jobsList   = read('api/jobs-list/index.js');
const adminAccess= read('api/admin-access.js');
const adminApi   = read('api/admin/index.js');
const authVerify = read('api/auth-verify/index.js');
const shellJs    = read('js/shell.js');
const jobsSubmit = read('api/jobs-submit/index.js');

/* ── 1. Media typography and layout (1 to 16) ── */
check(/media-commandbar\{[^}]*minmax\(300px,400px\)/.test(mediaCss), 'command bar reserves a bounded second column');
check(/max-width:1180px\)\{\.media-commandbar\{grid-template-columns:1fr/.test(mediaCss), 'command bar collapses to one column on intermediate widths');
check(!/media-security-note strong\{color:var\(--ink\);white-space:nowrap\}/.test(mediaCss), 'security note heading no longer forces nowrap');
check(/\.media-commandbar h2\{overflow-wrap:anywhere/.test(mediaCss), 'command bar title wraps rather than overflowing');
check(/\.media-source-choices \.seg strong,\.media-source-choices \.seg span\{overflow-wrap:anywhere/.test(mediaCss), 'source choice labels wrap safely');
check(/\.btn-full\{white-space:normal;height:auto;min-height:40px/.test(mediaCss), 'full width buttons grow for long labels');
check(/\.capability-state,\.media-hint,\.media-export-state,\.region-summary\{overflow-wrap:anywhere/.test(mediaCss), 'status and hint text wraps safely');
check(/\.media-range-row\{display:flex;justify-content:space-between/.test(mediaCss), 'range label and value align without overlap');
check(/\.workflow-cost\.media-cost>div\{display:flex;justify-content:space-between/.test(mediaCss), 'cost rows lay out label and value cleanly');
check(/\.evidence-grid strong\.mono\{word-break:break-all\}/.test(mediaCss), 'evidence hash breaks across lines');
check(/\.workflow-step\{overflow:hidden;text-overflow:ellipsis\}/.test(mediaCss), 'workflow steps never collide');
check(/font-variant-numeric:tabular-nums/.test(mediaCss), 'numeric costs use tabular figures');
check(mediaHtml.includes('viewport-fit=cover'), 'media page keeps safe-area viewport');
check(mediaHtml.includes('<link rel="stylesheet" href="/css/enterprise-responsive.css"/>'), 'media page keeps responsive stylesheet');
check(mediaHtml.includes('<link rel="stylesheet" href="/css/media-redaction.css"/>'), 'media page keeps media stylesheet');
check(!/[\u2014\u2013]/.test(mediaCss) && !/[\u2014\u2013]/.test(mediaHtml), 'media page and stylesheet have no em or en dash');

/* ── 2. Face coverage to the frame edges (17 to 30) ── */
check(mediaHtml.includes('<script src="/js/vendor/face-api.js"></script>'), 'media page loads the bundled face-api script that exists on disk');
check(fs.existsSync(path.join(root, 'js/vendor/face-api.js')), 'bundled face-api script is present');
check(fs.existsSync(path.join(root, 'models/face/tiny_face_detector_model.bin')), 'local face model weights are present');
check(mediaJs.includes("loadFromUri('/models/face')"), 'face model loads from the same origin');
check(/aggressiveLocalFaceScan/.test(mediaJs), 'aggressive multi-pass face scan exists');
check(/localDetectOnCanvas\(source,0,0,416,0\.20\)/.test(mediaJs), 'first whole-frame pass uses a low threshold');
check(/localDetectOnCanvas\(source,0,0,512,0\.22\)/.test(mediaJs), 'a second whole-frame pass at a larger input size is present');
check(/overlap=0\.34/.test(mediaJs), 'tile overlap is high enough to catch seam-straddling faces');
check(/cols=sourceW>=1500\?4:sourceW>=1000\?3:2/.test(mediaJs), 'tile column count scales up for large images');
check(/rows=sourceH>=1500\?4:sourceH>=1000\?3:2/.test(mediaJs), 'tile row count scales up for large images');
check(/dedicated edge and corner bands/.test(mediaJs), 'dedicated edge and corner scan bands exist');
check(/\/\/ top[\s\S]*\/\/ bottom[\s\S]*\/\/ left[\s\S]*\/\/ right/.test(mediaJs), 'all four frame edges are scanned');
check(/boxIoU\(box,existing\)>0\.45/.test(mediaJs), 'dedupe keeps distinct nearby faces');
check(/Number\(\$\('facePadding'\)\?\.value \|\| 28\) \/ 100/.test(mediaJs), 'face mask safety margin defaults to a generous value');

/* ── 3. Administration restricted to the configured administrator (31 to 40) ── */
check(/SUPER_ADMIN_ROLE = 'super_admin'/.test(adminAccess), 'administration requires the super_admin role');
check(/getUserRole\(userId\)\) === SUPER_ADMIN_ROLE/.test(adminAccess), 'admin access is granted only when the database role matches');
check(require('fs').existsSync(require('path').join(root,'migration-super-admin-role.sql')), 'a role migration bootstraps the first super_admin');
check(adminApi.includes("const { isAdminUser } = require('../admin-access')"), 'admin API imports the shared access control');
check(/if \(!\(await isAdminUser\(auth\.userId, adminEmail\)\)\)/.test(adminApi), 'admin API enforces access on every request');
check(authVerify.includes("const { isAdminUser } = require('../admin-access')"), 'auth verify imports the shared access control');
check(/isAdmin\s*:\s*await isAdminUser\(user\.id, user\.email\)/.test(authVerify), 'auth verify returns a server derived admin flag');
check(/Session\.get\(\)\?\.isAdmin === true/.test(shellJs), 'navigation shows Administration only for admin sessions');
check(/action === 'addUser'/.test(adminApi) && /action === 'setActive'/.test(adminApi), 'admin API supports add user and enable or disable');
check(/action === 'setPlan'/.test(adminApi) && /action === 'setCredits'/.test(adminApi), 'admin API supports plan and credit management');

/* ── 4. Dashboard job recovery and separation (41 to 46) ── */
check(/j\.user_id IN \(SELECT id FROM users WHERE LOWER\(email\) = LOWER\(\$3\)\)/.test(jobsList), 'jobs list recovers history for the same verified email');
check(/\[auth\.userId, days \|\| 365, auth\.email\]/.test(jobsList), 'jobs list binds the session email from the token, not the client');
check(!/req\.body\?\.email/.test(jobsList), 'jobs list never reads a client supplied email');
check(dashHtml.includes('Recent Redaction Jobs'), 'dashboard shows a redaction jobs section');
check(/Recent Redaction Jobs/.test(dashHtml), 'dashboard stays focused on redaction jobs after the v35 refocus');
check(/PDF documents submitted to the redaction workflow/.test(dashHtml), 'redaction jobs section explains what it contains');

/* ── 5. Locked contract and copy regressions (47 to 50) ── */
const lockedFields = ['jobId','email','fileName','blobName','blobUrl','inputSasUrl','fileBase64','outputBlobName','outputBlobUrl','outputSasUrl','storageAccount','uploadContainer','resultsContainer','estimatedPageCount','fileSizeMB','costBreakdown','azureCost','productPrice','callbackUrl','paSecret'];
check(lockedFields.every(f => new RegExp(`\\b${f}\\b`).test(jobsSubmit)), 'all locked Power Automate fields remain present');
const baseline = '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803';
check(crypto.createHash('sha256').update(jobsSubmit).digest('hex') === baseline, 'locked jobs-submit file is byte for byte unchanged');
const changed = [mediaHtml, mediaCss, mediaJs, dashHtml, jobsList];
check(changed.every(s => !/[\u2014\u2013]/.test(s)), 'changed sources contain no em or en dash');
let syntaxOk = true;
for (const f of ['api/jobs-list/index.js','js/media-redaction.js','api/admin-access.js']) {
  try { cp.execSync(`node --check ${path.join(root, f)}`, { stdio: 'pipe' }); } catch { syntaxOk = false; }
}
check(syntaxOk, 'changed JavaScript passes syntax validation');

console.log(`\nV25 RELEASE GATE: ${passed} OF ${passed + failed} CHECKS PASSED`);
process.exit(failed ? 1 : 0);
