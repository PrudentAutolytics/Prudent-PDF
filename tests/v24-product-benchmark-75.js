'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let count=0;
function check(ok,msg){count++;if(!ok){console.error(`FAIL ${count}: ${msg}`);process.exitCode=1}else console.log(`PASS ${count}: ${msg}`)}

const main=read('css/main.css');
const responsive=read('css/enterprise-responsive.css');
const shell=read('js/shell.js');
const runtime=read('js/enterprise-runtime.js');
const dashboard=read('pages/dashboard.html');
const governance=read('pages/governance.html');
const media=read('pages/media-redaction.html');
const admin=read('pages/admin.html');

check(shell.includes('class="sidebar-nav-scroll" data-sidebar-scroll'),'sidebar has an isolated navigation scroll region');
check(shell.includes('class="sidebar-footer"'),'sidebar has a dedicated fixed footer region');
check(shell.includes('class="sidebar-collapse-btn"'),'collapse control is part of shared sidebar markup');
check(main.includes('overflow: hidden;')&&main.includes('.sidebar-nav-scroll {'),'sidebar container no longer owns page-length scrolling');
check(main.includes('flex: 1 1 auto;')&&main.includes('overflow-y: auto;'),'navigation region owns sidebar scrolling');
check(main.includes('.sidebar-footer {')&&main.includes('flex: 0 0 auto;'),'sidebar footer cannot be pushed out by navigation height');
check(main.includes('border-top: 1px solid var(--border);'),'sidebar footer has a visual boundary');
check(main.includes('height: 100%;')&&main.includes('grid-template-rows: var(--topbar-h) minmax(0,1fr);'),'desktop sidebar fills the fixed viewport content row');
check(main.includes('min-height: 0;'),'sidebar flex children can shrink correctly');
check(main.includes('overscroll-behavior: contain;'),'sidebar navigation scroll is contained');
check(main.includes('scrollbar-gutter: stable;'),'sidebar scrollbar does not shift navigation text');
check(runtime.includes("navScroll.scrollTop=0"),'sidebar scroll starts from a deterministic position');
check(runtime.includes("active.scrollIntoView({block:'nearest'"),'active navigation item is kept visible');
check(runtime.includes("const collapse=side.querySelector('.sidebar-collapse-btn')"),'runtime wires the shared collapse control');
check(!runtime.includes("side.appendChild(collapse)"),'runtime no longer appends a floating collapse control after the quota card');
check(responsive.includes('.shell.sidebar-collapsed .sidebar-footer{border-top:0;box-shadow:none}'),'collapsed sidebar footer is visually cleaned');
check(responsive.includes('.shell.sidebar-collapsed .sidebar-nav-scroll{scrollbar-width:none}'),'collapsed navigation hides unnecessary scrollbar chrome');
check(responsive.includes('margin:8px auto 12px'),'desktop collapse control has stable footer spacing');
check(responsive.includes('overflow:hidden!important')&&responsive.includes('.sidebar-nav-scroll{padding-top:6px!important}'),'mobile drawer preserves isolated navigation scrolling');
check(responsive.includes('env(safe-area-inset-bottom)'),'mobile sidebar footer respects device safe area');
check(shell.includes('View plans and limits'),'sidebar plan action uses neutral product language');
check(shell.includes('id="sidebarPlanLabel"'),'plan label can be refreshed without rebuilding layout');
check(shell.includes('${daysLeft} days left'),'sidebar does not use compressed day wording');
check(!shell.includes('Upgrade to Pro'),'legacy Pro wording is removed');
check(!shell.includes('Pro Active'),'legacy Pro status wording is removed');
check(!shell.includes("'.nav-group-label'"),'navigation group labels are not automatic info-button targets');
check(shell.includes("el.closest('.sidebar')"),'automatic help injection excludes the entire sidebar');
check(!shell.includes(",'th',"),'table headers are not decorated with automatic info icons');
check(!shell.includes("'.page-title','.page-subtitle'"),'page subtitles are not modified by help-icon injection');
check(shell.includes("'.page-title','.section-title'"),'contextual help remains on meaningful headings');
check(shell.includes("location.reload();")&&shell.includes('priorAdmin !== (updated.isAdmin === true)'),'admin entitlement changes reload the shell once');
check(!shell.includes('wireSidebarDrawer'),'stale undefined sidebar rewiring call is removed');
check(dashboard.includes('Recent Redaction Jobs'),'dashboard redaction history is explicitly labelled');
check(dashboard.includes('Recent Document and Media Operations'),'dashboard operations remain explicitly separated');
check(dashboard.includes('Processing time depends on document size and workflow load.'),'dashboard onboarding avoids unsupported duration promises');
check(!dashboard.includes('AI-powered'),'dashboard avoids vague AI marketing claims');
check(!dashboard.includes('Prudent PDF'),'dashboard uses current product name');
check(governance.includes('what to do next, not just read reports'),'governance copy has correct punctuation and spacing');
check(governance.includes('End to end processing'),'governance copy uses normalized dash-free wording');
check(media.includes('no face detector can guarantee zero missed or false detections'),'media privacy wording remains technically honest');
check(admin.includes('Prudent Redact'),'administration uses current product name');
check(!admin.includes('Prudent PDF'),'administration has no legacy product name');
check(read('pages/history.html').includes('<title>Processing History | Prudent Redact</title>'),'Processing History document title is standardized');
check(read('pages/tools.html').includes('<title>Document Operations | Prudent Redact</title>'),'Document Operations title is standardized');
check(read('pages/viewer.html').includes('<title>Redaction Review | Prudent Redact</title>'),'Redaction Review title is standardized');
check(read('pages/login.html').includes('<title>Sign In | Prudent Redact</title>'),'Sign In title is standardized');
check(read('pages/pricing.html').includes('<title>Plans and Pricing | Prudent Redact</title>'),'Plans and Pricing title is standardized');

const htmlFiles=['index.html',...fs.readdirSync(path.join(root,'pages')).filter(x=>x.endsWith('.html')).map(x=>'pages/'+x)];
for(const file of htmlFiles){
  const src=read(file);
  check(src.includes('viewport-fit=cover'),`${file} uses the standard safe-area viewport`);
}
const maintained=[];
function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const p=path.join(dir,name),st=fs.statSync(p);
    if(st.isDirectory()){
      if(!['vendor','tests','node_modules'].includes(name))walk(p);
    } else if(/\.(html|js|css|json)$/.test(name) && !/^V\d+-/.test(name)) maintained.push(p);
  }
}
walk(root);
const maintainedText=maintained.map(p=>fs.readFileSync(p,'utf8')).join('\n');
check(!/[\u2013\u2014]/.test(maintainedText),'maintained application source contains no en dash or em dash');
check(!maintainedText.includes('Prudent PDF'),'maintained application source contains no legacy Prudent PDF name');
check(!maintainedText.includes('Job History'),'maintained application source contains no legacy Job History label');
check(!maintainedText.includes('AI-powered'),'maintained application source contains no vague AI-powered copy');
check(!maintainedText.includes('next-not'),'maintained application source contains no malformed next-not wording');
check(!maintainedText.includes('Side-by-side'),'maintained application source uses normalized side by side wording');
check(main.includes('.nav-link-label {'),'navigation labels have explicit overflow handling');
check(main.includes('text-overflow: ellipsis;'),'long navigation labels cannot break the sidebar width');
check(main.includes('white-space: nowrap;'),'navigation labels stay on one controlled line');
check(responsive.includes('--product-title-size'),'shared product title typography token exists');
check(responsive.includes('--product-body-size'),'shared product body typography token exists');
check(responsive.includes('--product-label-tracking'),'shared label tracking token exists');
check(responsive.includes('.page-title,.gov-title'),'page and governance titles share typography controls');
check(responsive.includes('.page-subtitle,.gov-sub'),'page and governance subtitles share typography controls');
check(responsive.includes('@media(max-height:760px) and (min-width:1101px)'),'short desktop heights receive compact sidebar density');
check(responsive.includes('.nav-group-label{padding-top:11px}'),'short viewport navigation groups reduce excess gaps');
check(responsive.includes('.nav-sep{margin-block:6px}'),'short viewport navigation separators reduce excess gaps');
check(responsive.includes('.nav-link{padding-block:8px}'),'short viewport navigation links use compact vertical rhythm');
check(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/jobs-submit/index.js'))).digest('hex')==='5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803','locked Power Automate jobs-submit file is unchanged');

if(count!==80){console.error(`FAIL: v24 gate executed ${count} checks instead of 80`);process.exitCode=1}
if(process.exitCode)process.exit(process.exitCode);
console.log('V24 PRODUCT BENCHMARK GATE: 80 OF 80 CHECKS PASSED');
