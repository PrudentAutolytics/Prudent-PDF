'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};
const cors=read('api/cors.js');
const home=read('index.html');
const login=read('pages/login.html');
const logo=read('assets/pa-logo-light.svg');

check(cors.includes('https://redact.prudentautolytics.com'),'custom production domain is explicitly permitted');
check(cors.includes('https://brave-cliff-0ceef0a00.4.azurestaticapps.net'),'previous Azure origin remains permitted');
check(cors.includes('https://nice-grass-0f3d2db00.7.azurestaticapps.net'),'current Azure origin remains permitted');
check(cors.includes('process.env.APP_URL')&&cors.includes('process.env.ALLOWED_ORIGINS'),'runtime origin configuration remains supported');
check(!cors.includes("'Access-Control-Allow-Origin': '*'"),'CORS remains explicit rather than wildcard');

check(logo.includes('fill="#10213B"'),'light-surface brand logo has a dark wordmark');
check(home.includes('/assets/pa-logo-light.svg'),'public home uses the light-surface full brand logo');
check(login.includes('/assets/pa-logo-light.svg')||login.includes('/assets/prudent-brand-dark-800.png'),'login uses the approved full brand logo for its surface');
check(home.includes('hero-rail'),'home has a dense operating capability rail');
check(home.includes('hero-system-strip'),'home has a control lifecycle and operational signal strip');
check(home.includes('Controlled privacy lifecycle'),'home adds compact lifecycle information');
check(home.includes('Operational signals'),'home adds compact operational signal information');
check(home.includes('grid-template-columns:repeat(4,minmax(0,1fr))'),'desktop hero capability density is four-up');
check(home.includes('min-height:auto;padding-top:108px'),'hero no longer consumes a forced empty viewport');
check(home.includes('@media(max-width:760px)')&&home.includes('.hero-rail{grid-template-columns:1fr}'),'home capability rail stacks on mobile');

check(login.includes('access-facts'),'login left panel includes operational density cards');
check(login.includes('Passwordless session'),'login explains identity establishment');
check(login.includes('Document and media controls'),'login explains processing scope');
check(login.includes('History and governance'),'login explains oversight scope');
check(login.includes('access-assurance'),'login right panel includes access assurance');
check(login.includes('TLS protected access'),'login explains transport assurance');
check(login.includes('Authenticated controls'),'login explains protected API access');
check(login.includes('.left-brand{margin-bottom:0'),'login no longer uses auto margin to create a large empty panel gap');
check(login.includes('.left-bottom{margin-top:auto'),'login trust footer still stays anchored');
check(login.includes('@media(max-width:580px)')&&login.includes('.access-assurance{grid-template-columns:1fr}'),'login assurance stacks on narrow phones');
check(!/[\u2013\u2014]/.test(cors+home+login+logo),'changed v30 sources contain no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate jobs-submit file is unchanged');
if(process.exitCode)process.exit(process.exitCode);
console.log('V30 brand density and custom domain release gate passed.');
