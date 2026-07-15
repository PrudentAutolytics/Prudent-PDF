'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};

const responsive=read('css/enterprise-responsive.css');
check(!responsive.includes('.card,.panel{padding:16px!important}'),'mobile responsive layer no longer applies destructive generic card padding');
check(responsive.includes('.card-bd{padding:14px!important}'),'mobile card body spacing is explicit');
check(/\.catalog-command\s*\{display:grid!important;grid-template-columns:1fr!important/.test(responsive),'document catalog command bar stacks on mobile');
check(responsive.includes('.viewer-toolbar{height:auto!important'),'viewer toolbar adapts on mobile');
check(responsive.includes('.ops-grid{grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))!important}'),'workflow catalog grid cannot overflow narrow screens');

const advanced=read('js/advanced-tools.js');
const advancedPage=read('pages/advanced-tool.html');
check(advanced.includes("op==='scanPdf'?'Create scanned PDF'"),'Scan to PDF has a task-specific primary action');
check(advanced.includes("id=\"scanCamera\"")&&advanced.includes("id=\"scanFiles\""),'Scan to PDF has separate camera and device buttons');
check(advanced.includes('function moveSource(index,delta)'),'Scan to PDF supports page reordering');
check(advanced.includes('data-remove'),'Scan to PDF supports page removal');
check(advancedPage.includes('.mobile-run{position:fixed!important'),'workflow primary action is a safe mobile bottom action');
check(!advanced.includes("else if(op==='flatten')h="),'broken flatten execution branch is removed');
check(advanced.includes('calcOperationCost(operation,pages,sizeMB'),'advanced workflows show operation cost estimates');

const config=read('js/config.js');
check(config.includes('OPERATION_COST_MODEL_VERSION'),'client operation cost model exists');
check(config.includes('function calcOperationCost'),'client operation cost calculator exists');
const serverCost=read('api/operation-cost.js');
check(serverCost.includes('calculateOperationCost'),'server operation cost calculator exists');
const usage=read('api/usage-track/index.js');
check(usage.includes('operation_usage'),'usage tracking records operation cost ledger entries');
check(usage.includes('estimatedPlatformCost')&&usage.includes('estimatedProductPrice'),'Power Automate usage events receive additive cost estimates');
check(usage.includes('costAnalysis'),'usage API returns server-calculated cost analysis');
const summary=read('api/operation-summary/index.js');
check(summary.includes('SUM(product_price)'),'30 day operation cost summary is calculated');
const dashboard=read('pages/dashboard.html');
check(dashboard.includes('operationSummary.totalProductPrice'),'dashboard combines document operation cost');
check(dashboard.includes('redactionCost + operationCost'),'dashboard combines redaction and operation costs');
const governance=read('api/governance/index.js');
check(governance.includes('operation_cost')&&governance.includes('redaction_cost'),'governance exposes separated cost components');
const media=read('pages/media-redaction.html')+read('js/media-redaction.js');
check(media.includes('mediaPlatformCost')&&media.includes('mediaProductCost'),'media redaction shows operation cost estimates');

for(const page of ['dashboard.html','tools.html','advanced-tool.html','tool.html','history.html','viewer.html','governance.html','profile.html','media-redaction.html']){
 const source=read('pages/'+page);
 check(source.includes('name="viewport"'),`${page} declares a mobile viewport`);
}

check(advanced.includes("A4, automatic orientation"),'Scan to PDF supports standardized A4 automatic orientation');
check(advanced.includes("scanMargin"),'Scan to PDF supports configurable page margin');
check(advanced.includes("unsupported image"),'Scan to PDF reports unsupported mobile image selections');
const dashboardPage=read('pages/dashboard.html');
check(dashboardPage.includes('redactionCostInsight')&&dashboardPage.includes('operationCostInsight'),'dashboard visually separates redaction and operation cost');
check(read('pages/history.html').includes('history-jobs-table'),'Processing History has a mobile card table pattern');
check(read('pages/admin.html').includes('admin-users-table'),'Administration users have a mobile card table pattern');
check(read('pages/dashboard.html').includes('recent-jobs-table'),'Dashboard recent jobs have a mobile card table pattern');
check(read('pages/viewer.html').includes('min-height:68dvh!important'),'mobile document viewer assigns usable pane heights');

if(process.exitCode)process.exit(process.exitCode);
console.log('v22 enterprise QA, responsive, scan, and cost tests passed.');
