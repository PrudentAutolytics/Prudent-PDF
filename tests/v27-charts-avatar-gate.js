'use strict';
/*
 * Prudent Redact v27 release gate.
 * Covers the two additions requested for this build:
 *   1. Advanced analytics charts on the operations dashboard, from real data.
 *   2. A prominent user image at the top right, wired across every page.
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

const chartsJs = read('js/charts.js');
const dashHtml = read('pages/dashboard.html');
const shellJs  = read('js/shell.js');
const quotaGet = read('api/quota-get/index.js');
const profile  = read('api/profile/index.js');
const jobsSubmit = read('api/jobs-submit/index.js');
const swaCfg   = read('staticwebapp.config.json');

/* ── 1. Charts module (1 to 14) ── */
check(fs.existsSync(path.join(root, 'js/charts.js')), 'charts module exists as a local asset');
check(/window\.Charts = Charts/.test(chartsJs), 'charts module exposes a Charts namespace');
check(/function donut\(/.test(chartsJs), 'donut chart is implemented');
check(/function stackedBars\(/.test(chartsJs), 'daily volume bar chart is implemented');
check(/function areaLine\(/.test(chartsJs), 'cumulative trend line chart is implemented');
check(/function buildDailyVolume\(/.test(chartsJs), 'daily volume is derived from job data');
check(/function buildCumulativeCost\(/.test(chartsJs), 'cumulative cost is derived from job data');
check(/emptyState\(/.test(chartsJs), 'charts have an honest empty state');
check(/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'|createElementNS\(NS/.test(chartsJs), 'charts render as native SVG');
const chartsNoSvgNs = chartsJs.split('http://www.w3.org/2000/svg').join('');
check(!/(require|import|src\s*=|from)\s*['"][^'"]*(cdn|unpkg|jsdelivr|chart\.js|d3)/i.test(chartsNoSvgNs) && !/https?:\/\//i.test(chartsNoSvgNs), 'charts use no external chart dependency');
check(/cssVar\(/.test(chartsJs), 'charts read theme colours from CSS variables');
check(/'aria-label'/.test(chartsJs), 'charts expose accessible labels');
check(/running \+= d\.value/.test(chartsJs), 'cumulative cost accumulates monotonically');
check(!/[\u2014\u2013]/.test(chartsJs), 'charts module has no em or en dash');

/* ── 2. Dashboard wiring (15 to 24) ── */
check(dashHtml.includes('id="chartVolume"'), 'dashboard has a daily volume chart host');
check(dashHtml.includes('id="chartStatus"'), 'dashboard has a status mix chart host');
check(dashHtml.includes('id="chartCost"'), 'dashboard has a cumulative cost chart host');
check(dashHtml.includes('<script src="/js/charts.js"></script>'), 'dashboard loads the charts module');
check(dashHtml.indexOf('/js/charts.js') < dashHtml.indexOf('/js/shell.js'), 'charts module loads before the shell');
check(/function renderCharts\(\)/.test(dashHtml), 'dashboard defines a chart renderer');
check(/renderCharts\(\);/.test(dashHtml), 'renderStats triggers chart rendering');
check(/Charts\.buildDailyVolume\(allJobs/.test(dashHtml), 'volume chart uses the real job cache');
check(/Charts\.buildCumulativeCost\(allJobs/.test(dashHtml), 'cost chart uses the real job cache');
check(/attributeFilter: \['data-theme'\]/.test(dashHtml), 'charts re-render when the colour theme changes');

/* ── 3. User image at top right (25 to 34) ── */
check(/class="user-chip"/.test(shellJs), 'top bar renders a user chip');
check(/class="user-avatar"/.test(shellJs), 'user chip contains an avatar element');
check(/session\.profilePicture/.test(shellJs), 'avatar renders the profile picture when present');
check(/getInitials\(/.test(shellJs), 'avatar falls back to initials without a picture');
check(/Profile & Settings/.test(shellJs), 'user menu links to profile and settings');
check(/border-bottom:1px solid var\(--border\)/.test(shellJs) && /avatarInner/.test(shellJs), 'user menu shows an identity header with the avatar');
check(/profilePicture\s*:\s*data\.profilePicture/.test(shellJs), 'session carries the profile picture from quota');
check(/profile_picture/.test(quotaGet) && /column_name='profile_picture'/.test(quotaGet), 'quota endpoint discovers the profile picture column');
check(/profilePicture\s*:\s*user\.profile_picture/.test(quotaGet), 'quota endpoint returns the profile picture');
check(/ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture/.test(profile), 'profile endpoint provisions the picture column safely');

/* ── 4. Profile picture safety (35 to 38) ── */
check(/data:image\\\/\(jpeg\|png\|webp\)/.test(profile) || /data:image\/\(jpeg\|png\|webp\)/.test(profile), 'profile picture upload is restricted to image types');
check(/length > 750000/.test(profile), 'profile picture upload is size limited');
check(/hasPicture \? ', profile_picture' : ''/.test(quotaGet), 'quota query stays schema aware for older databases');
check(/img\.src = session\.profilePicture/.test(shellJs) || /img\.src="\$\{sess\.profilePicture\}"|src="\$\{sess\.profilePicture\}"/.test(shellJs), 'avatar image source is bound to the stored picture');

/* ── 5. Locked contract and copy (39 to 42) ── */
const lockedFields = ['jobId','email','fileName','blobName','blobUrl','inputSasUrl','fileBase64','outputBlobName','outputBlobUrl','outputSasUrl','storageAccount','uploadContainer','resultsContainer','estimatedPageCount','fileSizeMB','costBreakdown','azureCost','productPrice','callbackUrl','paSecret'];
check(lockedFields.every(f => new RegExp(`\\b${f}\\b`).test(jobsSubmit)), 'all locked Power Automate fields remain present');
check(crypto.createHash('sha256').update(jobsSubmit).digest('hex') === '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803', 'locked jobs-submit file is byte for byte unchanged');
check([chartsJs, dashHtml, shellJs, quotaGet].every(s => !/[\u2014\u2013]/.test(s)), 'changed sources contain no em or en dash');
check(/script-src 'self'/.test(swaCfg) && !/script-src[^;]*https?:/.test(swaCfg), 'content security policy still forbids external scripts');

/* ── 6. Syntax (43 to 45) ── */
let syntaxOk = true;
for (const f of ['js/charts.js', 'js/shell.js', 'api/quota-get/index.js']) {
  try { cp.execSync(`node --check ${path.join(root, f)}`, { stdio: 'pipe' }); } catch { syntaxOk = false; }
}
check(syntaxOk, 'changed JavaScript passes syntax validation');
check(fs.existsSync(path.join(root, 'pages/profile.html')), 'profile page exists for picture upload');
check(/Shell\.syncProfileIdentity/.test(read('pages/profile.html')), 'saving a profile updates the shell avatar live');

console.log(`\nV27 RELEASE GATE: ${passed} OF ${passed + failed} CHECKS PASSED`);
process.exit(failed ? 1 : 0);
