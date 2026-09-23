'use strict';
/*
 * Prudent Redact v40 release gate - animated workflow and FAQ.
 * Asserts the workflow section animates accessibly, the FAQ is native,
 * keyboard friendly and truthful, retired features are not advertised,
 * and the locked Power Automate contract remains unchanged.
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

const idx = read('index.html');
const js  = read('js/premium.js');
const jobsSubmit = read('api/jobs-submit/index.js');

/* -- animated workflow -- */
check((idx.match(/data-flow-step/g) || []).length === 5, 'workflow has exactly five animated steps');
check((idx.match(/class="flow-bar" aria-hidden="true"/g) || []).length === 5, 'each step carries exactly one progress bar');
check(!/proof-card[^\n]*flow-bar/.test(idx), 'progress bars did not leak into proof cards');
check(/\.flow-step\.active/.test(idx), 'active step styling is defined');
check(/initFlow/.test(js) && /data-flow-step/.test(js), 'premium script drives the workflow autoplay');
check(/pointerenter/.test(js) && /focusin/.test(js), 'autoplay pauses on hover and keyboard focus');
check(/if \(steps\.length < 2 \|\| reduced\) return/.test(js), 'autoplay is skipped under reduced motion');
check(/prefers-reduced-motion:reduce\)\{\.flow-step/.test(idx.replace(/\s/g, '')), 'workflow css respects reduced motion');

/* -- FAQ -- */
// v44 adds three search friendly questions (What is Prudent Redact, documents, scanned PDFs).
check((idx.match(/<details class="faq-item"/g) || []).length === 11, 'FAQ has eleven questions');
check(/<details class="faq-item" open>/.test(idx), 'the first FAQ answer is open by default');
check(/summary::-webkit-details-marker\{display:none\}/.test(idx), 'FAQ uses styled native summaries');
check(/summary:focus-visible/.test(idx), 'FAQ summaries are keyboard focusable');
check(/href="#faq"/.test(idx), 'navigation links to the FAQ');
check(/id="faq"/.test(idx), 'FAQ section is anchored');
check(/SHA 256/.test(idx) && /passwordless/i.test(idx) && /Azure AI Document Intelligence/.test(idx), 'FAQ claims are grounded in existing product claims');
check(!/auto.?delete|deleted after|\b7 days\b/i.test(idx), 'FAQ makes no unverified retention claim');

/* -- truthfulness of public surfaces -- */
check(!/Split PDF|Merge PDF|Scan to PDF/.test(idx), 'homepage does not advertise retired document tools');
check(!/Split PDF|Merge PDF|Scan to PDF/.test(read('pages/login.html')), 'login does not advertise retired document tools');

/* -- regression guards -- */
check(crypto.createHash('sha256').update(jobsSubmit).digest('hex') === '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803', 'locked jobs-submit file is byte for byte unchanged');
check(!/[\u2014\u2013]/.test(idx) && !/[\u2014\u2013]/.test(js), 'changed sources contain no em or en dash');
let syntaxOk = true;
try { cp.execSync(`node --check ${path.join(root, 'js/premium.js')}`, { stdio: 'pipe' }); } catch { syntaxOk = false; }
check(syntaxOk, 'premium script passes syntax validation');

console.log(`\nV40 RELEASE GATE: ${passed} OF ${passed + failed} CHECKS PASSED`);
process.exit(failed ? 1 : 0);
