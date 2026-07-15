
'use strict';
const DEFAULT_ORIGINS = [
  ...(process.env.APP_URL ? [String(process.env.APP_URL).trim().replace(/\/$/, '')] : []),
  'http://localhost:4280',
  'http://localhost:7071',
];
const ALLOWED_ORIGINS = [...new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(o=>o.trim().replace(/\/$/, '')).filter(Boolean).concat(DEFAULT_ORIGINS))];
function getCorsHeaders(req){
  const origin=String(req?.headers?.origin||'').replace(/\/$/, '');
  const headers={'Content-Type':'application/json','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Cache-Control':'no-store, private, max-age=0','Pragma':'no-cache','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin && ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin']=origin;
  return headers;
}
function handleCors(context,req){
  const origin=String(req?.headers?.origin||'').replace(/\/$/, '');
  if(origin && !ALLOWED_ORIGINS.includes(origin)){context.res={status:403,headers:getCorsHeaders(req),body:{error:'Origin not allowed.'}};return true}
  if(req.method==='OPTIONS'){context.res={status:204,headers:getCorsHeaders(req),body:''};return true}
  return false;
}
module.exports={getCorsHeaders,handleCors,ALLOWED_ORIGINS};
