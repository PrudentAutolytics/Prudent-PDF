'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function check(ok, message) {
  if (!ok) { console.error('FAIL:', message); process.exitCode = 1; }
  else console.log('PASS:', message);
}

check(!fs.existsSync(path.join(root,'js/tools-catalog.js')), 'removed tools catalog is absent');

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
check(config.routes.some(r => r.route === '/media-redaction' && r.redirect === '/dashboard?feature=media-coming-soon'), 'media redaction route is disabled as Coming Soon');
check(config.globalHeaders['Content-Security-Policy'].includes("media-src 'self' blob:"), 'CSP permits same-origin and blob media only');


check(config.globalHeaders['Content-Security-Policy'].includes("img-src 'self' data: blob: https:"), 'CSP permits blob-backed uploaded image decoding');
check(read('pages/media-redaction.html').includes('video/mp4,video/webm'), 'media selector accepts video without requiring a mode switch');
check(media.includes('function classifyFile(file)'), 'media type is auto-detected from MIME type or extension');
check(media.includes('createImageBitmap'), 'image decoder uses createImageBitmap with fallback');
check(media.includes('state.image.naturalWidth || state.image.width'), 'image export supports ImageBitmap dimensions');
check(media.includes("video.addEventListener('ended',onEnded"), 'video export completes from the media ended event');
check(media.includes('canvasToBlob'), 'image export has a canvas Blob fallback path');

if (process.exitCode) process.exit(process.exitCode);
console.log('Media redaction regression tests passed.');
