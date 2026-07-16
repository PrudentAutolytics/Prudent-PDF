'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};

const governance=read('api/governance/index.js');
const adminService=read('api/admin-service.js');
const adminRoute=read('api/admin/index.js');
const adminPage=read('pages/admin.html');
const config=read('js/config.js');
const login=read('pages/login.html');

check(governance.includes("req.body?.adminBridge === true"),'Governance exposes an explicit administration bridge');
check(governance.includes("require('../admin-service')"),'Governance delegates to the shared admin service');
check(adminService.includes('isAdminUser'),'shared admin service retains administrator entitlement checks');
check(adminService.includes('verifySession'),'shared admin service retains signed-session verification');
check(adminService.includes("status: 403"),'shared admin service retains forbidden response');
check(adminService.includes("type === 'contacts'"),'shared admin service retains contact administration');
check(adminService.includes("type === 'apikeys'"),'shared admin service retains API key administration');
check(adminService.includes("action === 'addUser'"),'shared admin service retains add-user capability');
check(adminRoute.includes("require('../admin-service')")||adminRoute.includes('await isAdminUser(auth.userId, adminEmail)'),'legacy admin function remains protected or delegates to the shared service');
check(config.includes("ADMIN_USERS    : '/api/governance'"),'admin client uses the deployed Governance route');
check(config.includes("ADMIN_UPDATE   : '/api/governance'"),'admin updates use the deployed Governance route');
check(adminPage.includes('adminBridge: true'),'every Administration client call is explicitly bridged');
check(!adminPage.includes("paFetch('/api/admin',payload)"),'Administration no longer depends on the missing admin route');
check(!fs.existsSync(path.join(root,'api/admin-users')),'failed experimental admin-users route is removed');

check(login.includes('v32 premium identity gateway'),'premium login theme exists');
check(login.includes('login-command-center'),'login contains a dense privacy command center');
check(login.includes('LIVE PRIVACY WORKFLOW')||login.includes('PRUDENT PRIVACY COMMAND CENTER')||login.includes('DOCUMENT REDACTION PREVIEW'),'login visual has a live workflow header');
check(login.includes('command-doc'),'login visual contains document privacy motion');
check(login.includes('command-media')||login.includes('login-redact-source'),'login visual contains privacy motion');
check(login.includes('command-mask')||login.includes('login-sensitive'),'login visual contains animated privacy masking');
check(login.includes('command-evidence')||login.includes('login-proof-list'),'login visual contains evidence cards');
check(login.includes('CONTROL POSTURE')||login.includes('login-proof-list'),'login presents governance context');
check(login.includes('MEDIA MOTION')||login.includes('Remove sensitive text'),'login presents primary privacy context');
check(login.includes('EVIDENCE CHAIN')||login.includes('Output hash'),'login presents evidence context');
check(login.includes('Secure identity gateway'),'login form is positioned as an identity gateway');
check(login.includes('short lived code')||login.includes('verification code'),'login explains OTP identity verification');
check(login.includes('Session</div>'),'login does not render GDPR as a certification badge');
check(login.includes('@media(max-height:760px)'),'login adapts to short desktop displays');
check(login.includes('@media(max-width:480px)'),'login adapts to narrow phones');
check(login.includes('@media(prefers-reduced-motion:reduce)'),'login respects reduced motion');
check(!/[\u2013\u2014]/.test(governance+adminService+adminRoute+adminPage+config+login),'changed v32 sources contain no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate jobs-submit contract is unchanged');

if(process.exitCode)process.exit(process.exitCode);
console.log('V32 administration bridge and premium login release gate passed.');
