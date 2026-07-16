'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};
const login=read('pages/login.html');
const dashboard=read('pages/dashboard.html');
const shell=read('js/shell.js');
const authRequest=read('api/auth-request/index.js');

check(login.includes('Add your details, then verify your work email'),'new users receive a clear account-details step');
check(login.includes("if (S.isNew) {\n      eOk();\n      return;"),'first new-user click stops before OTP submission');
check(login.includes("aria-label=\"New account details\""),'new-user details region is accessible');
check(login.includes("fullName: S.name || ''"),'registration full name is submitted');
check(login.includes("company: S.company || ''"),'registration company is submitted');
check(login.includes("useCase: S.useCase || ''"),'registration use case is submitted');
check(login.includes("$('emailInput').addEventListener('input'"),'changing email resets account discovery');
check(login.includes("S.checked = false"),'email changes invalidate stale lookup state');
check(login.includes("return false;")&&login.includes("return true;"),'email lookup returns explicit success state');
check(authRequest.includes('fullName')&&authRequest.includes('company')&&authRequest.includes('useCase'),'auth request API accepts registration fields');

check(shell.includes("prudent:open-redaction"),'shared navigation dispatches a same-page redaction event');
check(shell.includes("a[href=\"/dashboard#upload\"]"),'New Redaction navigation is explicitly wired');
check(dashboard.includes('function openUploadFromNavigation()'),'dashboard has a reusable navigation modal opener');
check(dashboard.includes("window.addEventListener('hashchange'"),'dashboard handles repeated hash navigation');
check(dashboard.includes("window.addEventListener('prudent:open-redaction'"),'dashboard handles same-page sidebar activation');
check(dashboard.includes("if (location.hash === '#upload') openUploadFromNavigation();"),'dashboard handles initial deep-link navigation');
check(dashboard.includes("$('dropzone')?.focus()"),'opened upload modal receives a useful focus target');
check(!/[\u2013\u2014]/.test(login+dashboard+shell),'changed v39 sources contain no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate contract remains unchanged');
if(process.exitCode)process.exit(process.exitCode);
console.log('V39 new-user and New Redaction navigation gate passed.');
