'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession, generateSessionToken } = require('../auth');
const pool = require('../db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => String(v || '').trim().slice(0, max);

async function ensureProfileColumns() {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ');
}

module.exports = async function(context, req) {
  if (handleCors(context, req)) return;
  const auth = await verifySession(req);
  if (!auth.ok) { context.res={status:auth.status,headers:getCorsHeaders(req),body:{error:auth.error}}; return; }
  try {
    await ensureProfileColumns();
    const action=String(req.body?.action || 'get').toLowerCase();
    if (action === 'get') {
      const r=await pool.query('SELECT id,email,full_name,company,plan,credits_used,credits_limit,profile_picture,profile_updated_at FROM users WHERE id=$1',[auth.userId]);
      const u=r.rows[0];
      if(!u){context.res={status:404,headers:getCorsHeaders(req),body:{error:'Profile not found.'}};return;}
      context.res={status:200,headers:getCorsHeaders(req),body:{email:u.email,fullName:u.full_name||'',company:u.company||'',plan:u.plan||'trial',creditsUsed:u.credits_used||0,creditsLimit:u.credits_limit||0,profilePicture:u.profile_picture||null,profileUpdatedAt:u.profile_updated_at||null}};
      return;
    }
    if (action !== 'update') { context.res={status:400,headers:getCorsHeaders(req),body:{error:'Unsupported profile action.'}}; return; }
    const fullName=clean(req.body?.fullName,120);
    const company=clean(req.body?.company,160);
    const email=clean(req.body?.email,254).toLowerCase();
    const picture=req.body?.profilePicture == null ? null : String(req.body.profilePicture);
    if(!fullName){context.res={status:400,headers:getCorsHeaders(req),body:{error:'Name is required.'}};return;}
    if(!EMAIL_RE.test(email)){context.res={status:400,headers:getCorsHeaders(req),body:{error:'Enter a valid email address.'}};return;}
    if(picture && (!/^data:image\/(jpeg|png|webp);base64,/i.test(picture) || picture.length > 750000)){
      context.res={status:400,headers:getCorsHeaders(req),body:{error:'Profile picture must be JPG, PNG, or WebP and under 500 KB.'}};return;
    }
    const duplicate=await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) AND id<>$2 LIMIT 1',[email,auth.userId]);
    if(duplicate.rows.length){context.res={status:409,headers:getCorsHeaders(req),body:{error:'That email address is already in use.'}};return;}
    const r=await pool.query(`UPDATE users SET full_name=$1,company=$2,email=$3,profile_picture=$4,profile_updated_at=NOW() WHERE id=$5 RETURNING id,email,full_name,company,plan,credits_used,credits_limit,profile_picture,profile_updated_at`,[fullName,company,email,picture,auth.userId]);
    const u=r.rows[0];
    const token=generateSessionToken(u.email,u.id);
    context.res={status:200,headers:getCorsHeaders(req),body:{email:u.email,fullName:u.full_name,company:u.company||'',plan:u.plan||'trial',creditsUsed:u.credits_used||0,creditsLimit:u.credits_limit||0,profilePicture:u.profile_picture||null,profileUpdatedAt:u.profile_updated_at,token}};
  } catch(err) {
    context.log('profile ERROR:',err.message);
    context.res={status:500,headers:getCorsHeaders(req),body:{error:'Profile could not be loaded or saved. Please try again.'}};
  }
};