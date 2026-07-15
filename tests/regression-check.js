'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const baselineHash = '5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803';
const lockedFields = [
  'jobId','email','fileName','blobName','blobUrl','inputSasUrl','fileBase64',
  'outputBlobName','outputBlobUrl','outputSasUrl','storageAccount','uploadContainer',
  'resultsContainer','estimatedPageCount','fileSizeMB','costBreakdown','azureCost',
  'productPrice','callbackUrl','paSecret'
];
function fail(msg){ console.error('FAIL:', msg); process.exitCode = 1; }
function ok(msg){ console.log('PASS:', msg); }
function walk(dir){ return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }

const jobs = fs.readFileSync(path.join(root,'api/jobs-submit/index.js'),'utf8');
const hash = crypto.createHash('sha256').update(jobs).digest('hex');
if(hash !== baselineHash) fail(`locked jobs-submit changed: ${hash}`); else ok('jobs-submit byte hash unchanged');
for(const field of lockedFields){ if(!new RegExp(`\\b${field}\\b(?:\\s*:|\\s*,)`).test(jobs)) fail(`locked PA field missing: ${field}`); }
if(!process.exitCode) ok('all locked Power Automate fields present');

const files = walk(root).filter(f=>!f.includes(`${path.sep}vendor${path.sep}`)&&!f.includes(`${path.sep}node_modules${path.sep}`)&&!f.endsWith('.zip'));
const textFiles = files.filter(f=>!f.includes(`${path.sep}tests${path.sep}`)&&/\.(js|html|css|json|md|sql|txt|svg)$/.test(f));
for(const f of textFiles){ const t=fs.readFileSync(f,'utf8'); if(t.includes('\u2014') || t.includes('\u2013') || t.includes('\\u2014') || t.includes('\\u2013')) fail(`prohibited dash character in ${path.relative(root,f)}`); }
if(!process.exitCode) ok('no em dash or en dash in maintained source');

for(const f of files.filter(f=>f.endsWith('.json'))){ try{JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){fail(`invalid JSON ${path.relative(root,f)}: ${e.message}`);} }
if(!process.exitCode) ok('JSON files parse');

for(const f of files.filter(f=>f.endsWith('.js'))){ if(f.includes(`${path.sep}tests${path.sep}`)) continue; try{cp.execFileSync(process.execPath,['--check',f],{stdio:'pipe'});}catch(e){fail(`JS syntax ${path.relative(root,f)}: ${String(e.stderr||e.message)}`);} }
if(!process.exitCode) ok('JavaScript syntax checks pass');

const requiredApis=['auth-check','auth-request','auth-verify','blob-sas','contact-send','health','jobs-list','jobs-status','jobs-submit','quota-get','admin'];
for(const api of requiredApis){ for(const file of ['index.js','function.json']){ if(!fs.existsSync(path.join(root,'api',api,file))) fail(`missing API file api/${api}/${file}`); } }
if(!process.exitCode) ok('required Azure Function routes present');

const health = fs.readFileSync(path.join(root,'api/health/index.js'),'utf8');
if(!health.includes('verifySession') || !health.includes('ADMIN_EMAILS')) fail('health endpoint is not administrator protected'); else ok('health endpoint is administrator protected');
const authReq = fs.readFileSync(path.join(root,'api/auth-request/index.js'),'utf8');
if(!authReq.includes("'sha256:' + crypto.createHash('sha256').update(otp).digest('hex')") || !authReq.includes('canStoreHashedOtp')) fail('schema-aware OTP at-rest hashing missing'); else ok('schema-aware OTP at-rest hashing present');


const htmlFiles = files.filter(f=>f.endsWith('.html'));
for(const f of htmlFiles){
  const html=fs.readFileSync(f,'utf8');
  const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
  scripts.forEach((code,i)=>{
    const temp=path.join(root,'tests',`.inline-${path.basename(f)}-${i}.js`);
    fs.writeFileSync(temp,code);
    try{cp.execFileSync(process.execPath,['--check',temp],{stdio:'pipe'});}catch(e){fail(`inline JS syntax ${path.relative(root,f)} script ${i+1}: ${String(e.stderr||e.message)}`);}
    finally{fs.rmSync(temp,{force:true});}
  });
}
if(!process.exitCode) ok('inline HTML JavaScript syntax checks pass');

const routeConfig=JSON.parse(fs.readFileSync(path.join(root,'staticwebapp.config.json'),'utf8'));
for(const route of routeConfig.routes||[]){
  if(route.rewrite && route.rewrite.startsWith('/')){
    const target=path.join(root,route.rewrite.slice(1));
    if(!fs.existsSync(target)) fail(`route target missing: ${route.route} -> ${route.rewrite}`);
  }
}
if(!process.exitCode) ok('Static Web App route targets exist');

for(const f of htmlFiles){
  const html=fs.readFileSync(f,'utf8');
  for(const m of html.matchAll(/(?:src|href)=["'](\/(?:css|js|assets|vendor)\/[^"'#?]+)["']/g)){
    const target=path.join(root,m[1].slice(1));
    if(!fs.existsSync(target)) fail(`local asset missing in ${path.relative(root,f)}: ${m[1]}`);
  }
}
if(!process.exitCode) ok('referenced local assets exist');

const config=fs.readFileSync(path.join(root,'js/config.js'),'utf8');
const lockedStaticValues=['redacta01f','https://redacta01f.blob.core.windows.net/prudent-uploads','Service.Account@prudentautolytics.com','PRUDENT AUTOLYTICS LLP','JAL 1403, 14-Floor, Unicca Emporis'];
for(const value of lockedStaticValues){ if(!config.includes(value)) fail(`locked static value missing: ${value}`); }
const fallback='https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc';
if(!jobs.includes(fallback)) fail('locked static Power Automate fallback URL changed or removed');
if(!process.exitCode) ok('locked static values and Power Automate fallback preserved');

const contact=fs.readFileSync(path.join(root,'pages/contact.html'),'utf8');
if(/Session\.get\(\)[\s\S]{0,500}(cEmail|cName)\.value/.test(contact)) fail('contact form appears to prefill session identity');
if(contact.includes('Service.Account@prudentautolytics.com')) fail('service mailbox is publicly rendered in contact page source');
if(!process.exitCode) ok('contact page remains blank and does not render service mailbox');

const forbiddenFiles=['api/.env','api/local.settings.json'];
for(const rel of forbiddenFiles){if(fs.existsSync(path.join(root,rel))) fail(`secret-bearing deployment file packaged: ${rel}`);}
if(!process.exitCode) ok('secret-bearing local deployment files are absent');


for(const f of htmlFiles){
  const html=fs.readFileSync(f,'utf8').replace(/<script[\s\S]*?<\/script>/gi,'');
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  if(duplicates.length) fail(`duplicate static ids in ${path.relative(root,f)}: ${duplicates.join(', ')}`);
}
if(!process.exitCode) ok('no duplicate static HTML ids');

const protectedApis=['admin','blob-sas','health','jobs-list','jobs-submit','quota-get'];
for(const api of protectedApis){
  const code=fs.readFileSync(path.join(root,'api',api,'index.js'),'utf8');
  if(!code.includes('verifySession')) fail(`protected API lacks session verification: ${api}`);
}
const jobsStatus=fs.readFileSync(path.join(root,'api/jobs-status/index.js'),'utf8');
if(!jobsStatus.includes('verifySession') || !jobsStatus.includes('PA_CALLBACK_SECRET')) fail('jobs-status dual authorization controls missing');
if(!jobsStatus.includes('expectedPaSecret.length > 0')) fail('callback validation may reject previously configured static secret values');
if(!process.exitCode) ok('protected API authorization markers present');

const responsive=fs.readFileSync(path.join(root,'css/enterprise-responsive.css'),'utf8');
for(const marker of ['@media (max-width: 1100px)','@media (max-width: 760px)','@media (max-width: 430px)','44px','100dvh','safe-area-inset-bottom']){
  if(!responsive.includes(marker)) fail(`responsive P0 marker missing: ${marker}`);
}
if(!process.exitCode) ok('responsive mobile, tablet, touch, viewport, and safe-area controls present');

if(process.exitCode) process.exit(process.exitCode);
console.log('All regression checks passed.');
