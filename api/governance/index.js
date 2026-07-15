'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');

module.exports=async function(context,req){
  if(handleCors(context,req))return;
  const auth=await verifySession(req);
  if(!auth.ok){context.res={status:auth.status,headers:getCorsHeaders(req),body:{error:auth.error}};return;}
  try{
    const jobs=await pool.query(`SELECT j.id AS "jobId",j.file_name AS "fileName",j.status,j.page_count AS "pageCount",j.cost_total AS "costTotal",j.submitted_at AS "submittedAt",j.completed_at AS "completedAt",j.error_message AS "errorMessage" FROM jobs j WHERE j.user_id=$1 AND j.submitted_at>NOW()-INTERVAL '30 days' ORDER BY j.submitted_at DESC LIMIT 500`,[auth.userId]);
    const rows=jobs.rows; const now=Date.now();
    const complete=rows.filter(x=>String(x.status).toLowerCase()==='complete');
    const failed=rows.filter(x=>['failed','error'].includes(String(x.status).toLowerCase()));
    const active=rows.filter(x=>['queued','processing','pending'].includes(String(x.status).toLowerCase()));
    const stuck=active.filter(x=>now-new Date(x.submittedAt).getTime()>30*60000);
    const sla=complete.filter(x=>x.completedAt && new Date(x.completedAt)-new Date(x.submittedAt)>15*60000);
    const durations=complete.filter(x=>x.completedAt).map(x=>(new Date(x.completedAt)-new Date(x.submittedAt))/60000).sort((a,b)=>a-b);
    const p95=durations.length?durations[Math.min(durations.length-1,Math.ceil(durations.length*.95)-1)]:0;
    const days={}; for(const j of rows){const k=new Date(j.submittedAt).toISOString().slice(0,10);days[k]??={day:k,jobs:0,failed:0,pages:0};days[k].jobs++;days[k].pages+=Number(j.pageCount||0);if(['failed','error'].includes(String(j.status).toLowerCase()))days[k].failed++;}
    const risk=[...failed,...stuck,...sla].filter((x,i,a)=>a.findIndex(y=>y.jobId===x.jobId)===i).slice(0,50);
    context.res={status:200,headers:getCorsHeaders(req),body:{generatedAt:new Date().toISOString(),scope:'current_user',metrics:{total_jobs:rows.length,completed_jobs:complete.length,failed_jobs:failed.length,active_jobs:active.length,stuck_jobs:stuck.length,sla_breaches:sla.length,total_pages:rows.reduce((s,x)=>s+Number(x.pageCount||0),0),total_cost:rows.reduce((s,x)=>s+Number(x.costTotal||0),0),avg_minutes:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0,p95_minutes:p95},policy:{callbackProtection:!!process.env.PA_CALLBACK_SECRET,appUrlConfigured:!!process.env.APP_URL},riskQueue:risk,dailyVolume:Object.values(days).sort((a,b)=>a.day.localeCompare(b.day)).slice(-30),userRisk:[],audit:[]}};
  }catch(err){context.log('governance ERROR:',err.message);context.res={status:500,headers:getCorsHeaders(req),body:{error:'Governance data could not be loaded. Please try again.'}};}
};