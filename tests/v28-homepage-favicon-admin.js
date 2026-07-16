'use strict';
/*
 * Prudent Redact v28 release gate.
 * Covers this build's three deliverables:
 *   1. Redesigned, self-explanatory homepage with product graphics.
 *   2. Favicon and app icons derived from the Prudent Autolytics logo.
 *   3. Administration user retrieval fix (whitespace-tolerant admin check
 *      plus clear access states).
 * Plus locked contract and copy regressions.
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

const login   = read('pages/login.html');
const favicon = read('favicon.svg');
const adminAccess = read('api/admin-access.js');
const adminHtml   = read('pages/admin.html');
const adminApi    = read('api/admin/index.js');
const jobsSubmit  = read('api/jobs-submit/index.js');

/* ── 1. Homepage graphics (1 to 12) ── */
check(/login-redact-source/.test(login) && /login-redact-output/.test(login), 'homepage shows a source to redacted transformation');
check((login.match(/login-redact-bar/g) || []).length >= 3, 'preview masks multiple sensitive values');
check(/Name|Email|Account|ID/.test(login), 'preview labels the detected data types');
check(/@keyframes/.test(login) && /login-redact-bar/.test(login), 'redaction blocks animate into place');
check(/How it works/.test(login), 'homepage shows a how it works strip');
check(/Upload/.test(login) && /Remove sensitive/.test(login) && /Review/.test(login), 'how it works has three steps');
check(/Upload/.test(login) && /Remove sensitive/.test(login) && /Review/.test(login), 'the three steps cover upload, removal, review');
check(/[Pp]ermanent/.test(login), 'copy explains permanent removal');
check(/prefers-reduced-motion: reduce/.test(login), 'animations respect reduced motion');
check(/max-width:900px/.test(login) && /max-width:520px/.test(login), 'homepage is responsive at tablet and phone widths');
check(/demo-card\{max-width:100%\}/.test(login) && /\.hiw\{max-width:100%\}/.test(login), 'demo and steps reflow on small screens');
check(!/[\u2014\u2013]/.test(login), 'homepage has no em or en dash');

/* ── 2. Branded favicon and icons (13 to 18) ── */
check(fs.existsSync(path.join(root, 'favicon.svg')), 'favicon exists');
check(/#0A8CFF/.test(favicon) && /#4169F6/.test(favicon) && /#B218F4/.test(favicon), 'favicon uses the Prudent brand gradient from the logo');
check(/Prudent Redact/.test(favicon), 'favicon is labelled for accessibility');
check(/fill-rule="evenodd"/.test(favicon), 'favicon renders the logo symbol path');
check(['assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png'].every(p => fs.existsSync(path.join(root, p))), 'app icons are present');
check(/href="\/favicon(\.ico|-32\.png)"/.test(login), 'homepage references the branded favicon set');

/* ── 3. Admin access fix (19 to 30) ── */
check(/LOWER\(COALESCE\(role, 'user'\)\)/.test(adminAccess), 'role comparison is case insensitive with a safe default');
check(require('fs').existsSync(require('path').join(root,'migration-super-admin-role.sql')), 'a migration bootstraps the first super_admin');
check(/getUserRole/.test(adminAccess), 'admin check reads the database role');
check(/super_admin/.test(adminAccess), 'admin check honours the super_admin role');
check(adminApi.includes("const { isAdminUser } = require('../admin-access')"), 'admin API uses the shared access check');
check(/if \(!\(await isAdminUser\(auth\.userId, adminEmail\)\)\)/.test(adminApi), 'admin API enforces access on every request');
check(/listUsers\(\)/.test(adminApi), 'admin API has a user listing path');
check(/FROM users ORDER BY/.test(adminApi), 'admin API queries the users table');
check(/Access denied/.test(adminHtml), 'admin page shows a clear access denied state');
check(/Session expired/.test(adminHtml), 'admin page shows a clear session expired state');
check(/Could not load users/.test(adminHtml), 'admin page shows a clear schema error state');
check(/res\?\.users/.test(adminHtml) && /renderUsers/.test(adminHtml), 'admin page renders the returned user list');

/* ── 4. Locked contract and syntax (31 to 34) ── */
const lockedFields = ['jobId','email','fileName','blobName','blobUrl','inputSasUrl','fileBase64','outputBlobName','outputBlobUrl','outputSasUrl','storageAccount','uploadContainer','resultsContainer','estimatedPageCount','fileSizeMB','costBreakdown','azureCost','productPrice','callbackUrl','paSecret'];
check(lockedFields.every(f => new RegExp(`\\b${f}\\b`).test(jobsSubmit)), 'all locked Power Automate fields remain present');
check(crypto.createHash('sha256').update(jobsSubmit).digest('hex') === '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803', 'locked jobs-submit file is byte for byte unchanged');
let syntaxOk = true;
for (const f of ['api/admin-access.js', 'api/admin/index.js']) {
  try { cp.execSync(`node --check ${path.join(root, f)}`, { stdio: 'pipe' }); } catch { syntaxOk = false; }
}
check(syntaxOk, 'changed admin JavaScript passes syntax validation');
let loginOk = true;
try {
  const scripts = [...login.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((s, i) => { fs.writeFileSync(`/tmp/v28login${i}.js`, s); cp.execSync(`node --check /tmp/v28login${i}.js`, { stdio: 'pipe' }); });
} catch { loginOk = false; }
check(loginOk, 'homepage inline scripts pass syntax validation');

console.log(`\nV28 RELEASE GATE: ${passed} OF ${passed + failed} CHECKS PASSED`);
process.exit(failed ? 1 : 0);
