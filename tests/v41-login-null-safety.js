'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};
const login=read('pages/login.html');

check(login.includes('function setText(id, value)'), 'login has a null-safe text helper');
check(login.includes('function setAttr(id, name, value)'), 'login has a null-safe attribute helper');
check(login.includes('function setClass(id, className, enabled)'), 'login has a null-safe class helper');
check(!login.includes("$('contBtnTxt').textContent"), 'temporary Continue button child is never directly dereferenced');
check(login.includes("setText('stepTitle', 'Welcome back')"), 'returning-user title uses safe text assignment');
check(login.includes("setText('stepTitle', 'Create your account')"), 'new-user title uses safe text assignment');
check(login.includes("setClass('regSlide', 'open', true)"), 'new-user details panel opens safely');
check(login.includes("setClass('regSlide', 'open', false)"), 'registration panel closes safely');
check(login.includes("$('regSlide')?.scrollIntoView"), 'registration panel scrolling is optional-safe');
check(login.includes("$('continueBtn')?.addEventListener"), 'Continue event binding is optional-safe');
check(login.includes("$('verifyBtn')?.addEventListener"), 'Verify event binding is optional-safe');
check(login.includes(".map(i => $('d'+i)).filter(Boolean)"), 'OTP inputs are filtered before wiring');
check(login.includes("!ds.length || !ds.every(d => d.value)"), 'OTP validation handles absent fields safely');
check(!/Cannot set properties of null/.test(login), 'login does not embed the observed runtime error');
check(!/[\u2013\u2014]/.test(login), 'changed login source contains no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate contract remains unchanged');
if(process.exitCode)process.exit(process.exitCode);
console.log('V41 login null-safety gate passed.');
