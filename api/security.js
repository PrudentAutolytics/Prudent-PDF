'use strict';
const crypto = require('crypto');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validEmail(v){const s=String(v||'').trim().toLowerCase();return s.length<=254&&EMAIL_RE.test(s)}
function validUuid(v){return UUID_RE.test(String(v||'').trim())}
function safeFileName(v){const s=String(v||'').trim();return s.length>0&&s.length<=255&&!/[\x00-\x1f\x7f]/.test(s)&&!/[\\/]/.test(s)}
function getClientId(req){const raw=String(req?.headers?.['x-forwarded-for']||req?.headers?.['x-client-ip']||'unknown');return raw.split(',')[0].trim().slice(0,80)||'unknown'}
function timingSafeSecret(a,b){const ah=crypto.createHash('sha256').update(String(a||'')).digest();const bh=crypto.createHash('sha256').update(String(b||'')).digest();return crypto.timingSafeEqual(ah,bh)}
function noStore(headers={}){return {...headers,'Cache-Control':'no-store, private, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}}
function safeUrlForLog(v){try{const u=new URL(String(v));return `${u.protocol}//${u.host}${u.pathname}`}catch{return '[invalid-url]'}}
module.exports={validEmail,validUuid,safeFileName,getClientId,timingSafeSecret,noStore,safeUrlForLog};
