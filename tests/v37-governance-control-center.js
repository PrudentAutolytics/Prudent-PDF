'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};
const gov=read('pages/governance.html');
const home=read('index.html');
const dash=read('pages/dashboard.html');
const shell=read('js/shell.js');

check(gov.includes('Governance Control Center'),'governance uses the new control center title');
check(gov.includes('Microsoft Azure'),'governance explicitly identifies Microsoft Azure');
check(gov.includes('Azure AI Document Intelligence'),'governance explicitly identifies Azure AI Document Intelligence');
check(gov.includes('Azure Blob Storage'),'governance explicitly identifies Azure Blob Storage');
check(gov.includes('Power Automate'),'governance explicitly identifies Power Automate');
check(gov.includes('Platform trust and service posture'),'governance contains a platform trust section');
check(gov.includes('Security control posture'),'governance contains a security control section');
check(gov.includes('Priority risk queue'),'governance contains an operational risk queue');
check(gov.includes('Administrative evidence timeline'),'governance contains an audit timeline');
check(gov.includes('Cost and throughput'),'governance contains cost and throughput context');
check(gov.includes('Operator commands'),'governance contains focused operator actions');
check(gov.includes('Open redaction review'),'governance links to redaction review');
check(gov.includes('Investigate redaction jobs'),'governance commands focus on redaction jobs');
check(gov.includes('grid-template-columns:repeat(6'),'governance has a deliberate desktop metric grid');
check(gov.includes('@media(max-width:760px)'),'governance has a mobile layout');
check(gov.includes('aiStatus')&&gov.includes('storageStatus')&&gov.includes('powerStatus'),'governance binds platform status indicators');

const retired=['Split PDF','Merge PDF','Scan to PDF','Image face privacy','Video face privacy'];
for(const term of retired){
  check(!gov.includes(term),`governance excludes retired workflow ${term}`);
  check(!home.includes(term),`homepage excludes retired workflow ${term}`);
  check(!dash.includes(term),`dashboard excludes retired workflow ${term}`);
}
check(!home.includes('ribbon-track'),'homepage removes the retired workflow ribbon');
check(!dash.includes('No document or media operations yet'),'dashboard removes the retired operations empty state');
check(!shell.includes('compress :')&&!shell.includes('merge    :')&&!shell.includes('sign     :')&&!shell.includes('convert  :')&&!shell.includes('tools    :'),'unused retired operation icons are removed');
check(!/[\u2013\u2014]/.test(gov+home+dash+shell),'changed v37 sources contain no en dash or em dash');

const locked=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex');
check(locked==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate contract remains unchanged');
if(process.exitCode)process.exit(process.exitCode);
console.log('V37 Governance Control Center gate passed.');
