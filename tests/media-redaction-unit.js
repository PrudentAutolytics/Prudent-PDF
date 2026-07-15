'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function check(ok, message) {
  if (!ok) { console.error('FAIL:', message); process.exitCode = 1; }
  else console.log('PASS:', message);
}

const catalog = read('js/tools-catalog.js');
[
  'Image Redaction','Face Redaction','Video Redaction','Video Face Redaction',
  'Licence Plate Redaction','Screen and Badge Redaction','Audio Redaction','Bulk Media Redaction'
].forEach(name => check(catalog.includes(name), `media workflow present: ${name}`));

const media = read('js/media-redaction.js');
check(media.includes('FaceDetector'), 'browser face assistance is capability gated');
check(media.includes('MediaRecorder'), 'browser video export uses MediaRecorder');
check(media.includes('captureStream'), 'video export uses canvas capture stream');
check(media.includes('exportCanvas.width=video.videoWidth'), 'video export preserves source resolution');
check(media.includes('IMAGE_REDACTION') && media.includes('VIDEO_REDACTION'), 'media usage operations are emitted');
check(media.includes('Media bytes are not included') || read('pages/media-redaction.html').includes('Media bytes are not included'), 'media privacy copy is present');

const usage = read('api/usage-track/index.js');
[
  'IMAGE_REDACTION','FACE_REDACTION','VIDEO_REDACTION','VIDEO_FACE_REDACTION',
  'LICENCE_PLATE_REDACTION','SCREEN_BADGE_REDACTION'
].forEach(op => check(usage.includes(`'${op}'`), `usage API allows ${op}`));

const config = JSON.parse(read('staticwebapp.config.json'));
check(config.routes.some(r => r.route === '/media-redaction' && r.rewrite === '/pages/media-redaction.html'), 'media redaction route exists');
check(config.globalHeaders['Content-Security-Policy'].includes("media-src 'self' blob:"), 'CSP permits same-origin and blob media only');

if (process.exitCode) process.exit(process.exitCode);
console.log('Media redaction regression tests passed.');
