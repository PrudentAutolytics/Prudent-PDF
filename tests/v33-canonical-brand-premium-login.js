'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};
const login=read('pages/login.html');

check(login.includes('v33 canonical Prudent premium identity gateway'),'v33 premium identity theme exists');
check(login.includes('#0A8CFF')&&login.includes('#4169F6')&&login.includes('#B218F4'),'canonical Prudent gradient tokens are used');
check(login.includes('/assets/prudent-brand-dark-800.png'),'canonical dark-surface horizontal logo is used on the premium panel');
check(login.includes('/assets/prudent-brand-light-800.png'),'canonical light-surface horizontal logo is used on the gateway stamp');
check(fs.existsSync(path.join(root,'assets/prudent-brand-dark-800.png')),'canonical dark lockup PNG exists');
check(fs.existsSync(path.join(root,'assets/prudent-brand-light-800.png')),'canonical light lockup PNG exists');
check(fs.existsSync(path.join(root,'assets/prudent-mark-gradient-256.png')),'canonical gradient mark PNG exists');
check(fs.existsSync(path.join(root,'favicon.ico')),'canonical favicon.ico exists');
check(fs.existsSync(path.join(root,'favicon-32.png')),'canonical 32px favicon exists');
check(fs.existsSync(path.join(root,'favicon-16.png')),'canonical 16px favicon exists');
check(fs.existsSync(path.join(root,'apple-touch-icon.png')),'canonical Apple touch icon exists');

check((login.includes('Private by design.')&&login.includes('Controlled by evidence.'))||(login.includes('Sensitive information in.')&&login.includes('Controlled document out.')),'premium product proposition is present');
check(login.includes('PRUDENT PRIVACY COMMAND CENTER')||login.includes('DOCUMENT REDACTION PREVIEW'),'premium command center branding is present');
check(login.includes('LIVE CONTROL')||login.includes('command-live">LIVE'),'premium live control state is present');
check(login.includes('Control posture')||login.includes('login-proof-list'),'premium control context is present');
check(login.includes('Motion privacy coverage')||login.includes('Black-box redaction applied'),'premium privacy action is present');
check(login.includes('Evidence follows every outcome')||login.includes('Output hash'),'premium evidence story is present');
check(login.includes('premium-brand-stamp'),'canonical brand stamp is present');
check(login.includes('Privacy operations control plane'),'brand stamp explains the product category');
check(login.includes('box-shadow:0 38px 110px'),'premium depth treatment exists');
check(login.includes('backdrop-filter:blur(22px)'),'premium glass treatment exists');
check(login.includes('@media(max-height:780px)'),'short desktop optimization exists');
check(login.includes('@media(max-width:480px)'),'narrow phone optimization exists');
check(login.includes('@media(prefers-reduced-motion:reduce)'),'reduced motion support exists');
check(!/[\u2013\u2014]/.test(login),'premium login source contains no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate jobs-submit contract remains unchanged');
if(process.exitCode)process.exit(process.exitCode);
console.log('V33 canonical brand premium login release gate passed.');
