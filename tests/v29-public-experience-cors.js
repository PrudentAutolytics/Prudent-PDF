'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};

const cors=read('api/cors.js');
const home=read('index.html');
const login=read('pages/login.html');

check(cors.includes('https://brave-cliff-0ceef0a00.4.azurestaticapps.net'),'previous brave-cliff origin remains allowed');
check(cors.includes('https://nice-grass-0f3d2db00.7.azurestaticapps.net'),'new nice-grass origin is allowed');
check(cors.includes('process.env.ALLOWED_ORIGINS'),'configured origin list remains supported');
check(cors.includes('process.env.APP_URL'),'configured APP_URL remains supported');
check(cors.includes('runtimeOrigins.includes(origin)'),'same-origin runtime host validation remains supported');
check(!cors.includes("'Access-Control-Allow-Origin': '*'"),'CORS is not opened to every origin');

check(home.includes('Privacy operations control plane'),'home establishes privacy operations positioning');
check(home.includes('control-plane'),'home contains the animated control plane');
check(home.includes('privacy-frame'),'home contains animated media privacy stage');
check(home.includes('scan-line'),'home contains moving scan visualization');
check(home.includes('ribbon-track'),'home contains moving workflow ribbon');
check(home.includes('Recent Document')===false,'public home does not expose authenticated dashboard data');
check(home.includes('@media(max-width:760px)'),'home has tablet and mobile responsiveness');
check(home.includes('@media(max-width:460px)'),'home has narrow phone responsiveness');
check(home.includes('@media(prefers-reduced-motion:reduce)'),'home respects reduced motion');
check(home.includes('SHA 256 evidence'),'home accurately presents existing evidence capability');
check(home.includes('Metered operations'),'home accurately presents operation metering');
check(!home.includes('enterprise AI'),'home avoids generic enterprise AI headline');
check(!home.includes('Automatically detect and remove PII from PDFs in seconds'),'home avoids unsupported speed and scope promise');

check(login.includes('v29 light motion access experience'),'login uses the new light motion design');
check(login.includes('access-visual'),'login contains animated privacy workspace');
check(login.includes('access-scan'),'login contains moving scan visualization');
check(login.includes('Multi pass local scan'),'login describes the current media scan architecture');
check(login.includes('No password is required.'),'login uses normalized passwordless copy');
check(login.includes('Trial access is configured after verification.'),'login avoids a hard-coded trial capacity promise');
check(!login.includes('GDPR Compliant'),'login does not make an unsupported compliance certification claim');
check(!login.includes('Auto-deleted 7 days'),'login does not make a global deletion claim');
check(login.includes('@media(max-width:420px)'),'login handles narrow phone layouts');

const changed=home+login+cors;
check(!/[\u2013\u2014]/.test(changed),'changed sources contain no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate jobs-submit contract is unchanged');

if(process.exitCode)process.exit(process.exitCode);
console.log('V29 public experience and CORS release gate passed.');
