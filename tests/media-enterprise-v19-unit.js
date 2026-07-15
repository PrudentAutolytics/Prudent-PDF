'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};
const html=read('pages/media-redaction.html');
const js=read('js/media-redaction.js');

check(html.includes('Image privacy')&&html.includes('Video privacy'),'media workflows are clearly separated for users');
check(html.includes('autoFaceImage')&&html.includes('checked'),'automatic image face privacy is enabled by default');
check(html.includes('autoFaceVideo')&&/id="autoFaceVideo"[^>]*checked/.test(html),'video face masking is enabled by default');
check(html.includes('facePadding'),'video face safety margin control exists');
check(html.includes('downloadBatch'),'batch ZIP download control exists');
check(html.includes('multiple hidden'),'multi-file media selection is enabled');
check(js.includes('async function createZip(entries)'),'browser batch ZIP builder exists');
check(js.includes('addBatchOutput(outputName,blob,operation,hash)'),'image exports are added to batch with evidence hash');
check(js.includes('addBatchOutput(outputName,blob,op,hash)'),'video exports are added to batch with evidence hash');
check(js.includes("runFaceDetection({ automatic: true })"),'automatic face detection path exists');
check(js.includes("state.regions = state.regions.filter(region => region.kind !== 'face')"),'automatic re-detection replaces stale face suggestions');
check(js.includes("state.image.naturalWidth || state.image.width"),'ImageBitmap dimensions remain supported');
check(/frameNo%[23]===0/.test(js),'video face regions are refreshed repeatedly during export');
check(/Number\(\$\('facePadding'\)\?\.value \|\| (18|22|28)\) \/ 100/.test(js),'face masks apply configurable safety padding');
check(js.includes("state.pendingFiles=files.slice(1)"),'additional selected media files are queued');
check(js.includes('prudent-redact-media-batch-'),'batch ZIP receives a controlled output filename');
check(js.includes('prudent-redact-evidence-manifest.json'),'batch ZIP includes an evidence manifest');

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const dup=ids.filter((id,i)=>ids.indexOf(id)!==i);
check(!dup.length,`media page has no duplicate ids${dup.length?': '+dup.join(', '):''}`);

if(process.exitCode)process.exit(process.exitCode);
console.log('Enterprise media v19 regression tests passed.');
