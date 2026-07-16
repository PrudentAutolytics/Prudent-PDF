'use strict';
/*
 * Prudent Redact v36 release gate — premium experience layer.
 * Asserts the motion/depth layer is wired everywhere, fails open without
 * JavaScript, respects reduced motion, uses no external assets, and that
 * the locked Power Automate contract remains byte for byte unchanged.
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

const css = read('css/premium.css');
const js  = read('js/premium.js');
const idx = read('index.html');
const login = read('pages/login.html');
const dash  = read('pages/dashboard.html');
const jobsSubmit = read('api/jobs-submit/index.js');

/* ── layer exists and is safe ── */
check(fs.existsSync(path.join(root, 'css/premium.css')), 'premium stylesheet exists');
check(fs.existsSync(path.join(root, 'js/premium.js')), 'premium script exists');
check(/@keyframes auroraDrift/.test(css), 'aurora ambience is defined');
check(/@keyframes scanSweep/.test(css), 'scan beam is defined');
check(/html\.premium-ready \.reveal \{ opacity: 0/.test(css), 'reveal hides content only when the script is running');
check(/classList\.add\('premium-ready'\)/.test(js), 'script marks the document as premium ready');
check(/prefers-reduced-motion: reduce/.test(css) && /prefers-reduced-motion: reduce/.test(js), 'layer respects reduced motion in css and js');
check(!/https?:\/\//.test(css) && !/https?:\/\//.test(js), 'layer uses no external assets');
check(/IntersectionObserver/.test(js) && /unobserve/.test(js), 'reveal observer disconnects after firing');
check(/passive: true/.test(js), 'pointer tracking is passive');

/* ── wiring ── */
const pages = ['index.html','pages/login.html','pages/dashboard.html','pages/history.html','pages/governance.html','pages/admin.html','pages/profile.html','pages/viewer.html','pages/contact.html','pages/pricing.html'];
check(pages.every(p => read(p).includes('/css/premium.css')), 'every page loads the premium stylesheet');
check(pages.every(p => read(p).includes('/js/premium.js')), 'every page loads the premium script');
check(/hero aurora-host/.test(idx), 'homepage hero carries ambient aurora');
check(/redact-demo scan-host/.test(idx), 'homepage redaction demo carries the scan beam');
check(/left-panel aurora-host/.test(login), 'login panel carries ambient aurora');
check(/login-command-center scan-host/.test(login), 'login command center carries the scan beam');
check((idx.match(/class="[^"]*reveal[^"]*"/g) || []).length >= 3, 'homepage sections use scroll reveal');
check(['sTotal','sDone','sCost','sCredits'].every(k => new RegExp(`id="${k}" data-countup`).test(dash)), 'dashboard KPIs animate with count up');

/* ── regression guards ── */
check(crypto.createHash('sha256').update(jobsSubmit).digest('hex') === '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803', 'locked jobs-submit file is byte for byte unchanged');
check(![css, js].some(s => /[\u2014\u2013]/.test(s)), 'new sources contain no em or en dash');
let syntaxOk = true;
try { cp.execSync(`node --check ${path.join(root, 'js/premium.js')}`, { stdio: 'pipe' }); } catch { syntaxOk = false; }
check(syntaxOk, 'premium script passes syntax validation');

console.log(`\nV36 RELEASE GATE: ${passed} OF ${passed + failed} CHECKS PASSED`);
process.exit(failed ? 1 : 0);
