'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');

const ADMIN_EMAILS = ['kabileshvijayakumar@prudentautolytics.com'];

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  // Session auth — must be logged in AND be admin
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }

  const adminEmail = (req.body?.email || req.body?.adminEmail || '').trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(adminEmail)) {
    context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Forbidden.' } };
    return;
  }

  const action = req.body?.action || 'list';
  const type   = req.body?.type   || 'users';

  try {

    /* ── List users ── */
    if (action === 'list' || !action || req.body?.adminMode) {

      if (type === 'contacts') {
        const r = await pool.query(`SELECT * FROM contact_requests ORDER BY submitted_at DESC LIMIT 100`);
        context.res = { status:200, headers:getCorsHeaders(req), body:{ contacts: r.rows } };
        return;
      }

      if (type === 'apikeys') {
        const r = await pool.query(`SELECT id, email, plan, key_prefix, created_at, last_used_at FROM api_keys WHERE revoked=false ORDER BY created_at DESC`);
        context.res = { status:200, headers:getCorsHeaders(req), body:{ apiKeys: r.rows } };
        return;
      }

      // Default: list users + aggregate job stats
      const users = await pool.query(`
        SELECT id, email, full_name, company, plan, credits_used, credits_limit,
               max_file_size_mb, max_pages_per_file, max_pages_per_month,
               is_active, created_at
        FROM users ORDER BY created_at DESC
      `);
      const jobs = await pool.query(`SELECT COUNT(*) as total, SUM(cost_total) as total_cost FROM jobs`);
      context.res = {
        status:200, headers:getCorsHeaders(req),
        body:{
          users     : users.rows,
          totalJobs : parseInt(jobs.rows[0].total || 0),
          totalCost : parseFloat(jobs.rows[0].total_cost || 0),
        },
      };
      return;
    }

    /* ── Update plan ── */
    if (action === 'setPlan') {
      const { targetEmail, plan } = req.body;
      const PLAN_LIMITS = {
        trial        : { credits_limit:5,    max_file_size_mb:10,  max_pages_per_file:50,   max_pages_per_month:50    },
        starter      : { credits_limit:50,   max_file_size_mb:25,  max_pages_per_file:100,  max_pages_per_month:500   },
        professional : { credits_limit:200,  max_file_size_mb:50,  max_pages_per_file:500,  max_pages_per_month:2000  },
        business     : { credits_limit:1000, max_file_size_mb:100, max_pages_per_file:1000, max_pages_per_month:10000 },
        enterprise   : { credits_limit:9999, max_file_size_mb:500, max_pages_per_file:9999, max_pages_per_month:50000 },
      };
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
      await pool.query(`
        UPDATE users SET plan=$1, credits_limit=$2, max_file_size_mb=$3,
        max_pages_per_file=$4, max_pages_per_month=$5 WHERE email=$6
      `, [plan, limits.credits_limit, limits.max_file_size_mb, limits.max_pages_per_file, limits.max_pages_per_month, targetEmail]);
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Reset credits ── */
    if (action === 'resetCredits') {
      await pool.query(`UPDATE users SET credits_used=0 WHERE email=$1`, [req.body.targetEmail]);
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Toggle active ── */
    if (action === 'setActive') {
      await pool.query(`UPDATE users SET is_active=$1 WHERE email=$2`, [req.body.active, req.body.targetEmail]);
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Generate API key ── */
    if (action === 'generateApiKey') {
      const { targetEmail } = req.body;
      const userRes = await pool.query(`SELECT plan FROM users WHERE email=$1`, [targetEmail]);
      if (!userRes.rows.length) throw new Error('User not found.');
      const plan = userRes.rows[0].plan || 'trial';
      const key  = 'ppk_' + Array.from({length:40}, () => Math.random().toString(36)[2]).join('');
      const prefix = key.substring(0,12);
      await pool.query(`
        INSERT INTO api_keys (email, plan, api_key, key_prefix, created_at, revoked)
        VALUES ($1,$2,$3,$4,NOW(),false)
      `, [targetEmail, plan, key, prefix]);
      context.res = { status:200, headers:getCorsHeaders(req), body:{ apiKey:key, keyPrefix:prefix } };
      return;
    }

    /* ── Revoke API key ── */
    if (action === 'revokeApiKey') {
      await pool.query(`UPDATE api_keys SET revoked=true WHERE id=$1`, [req.body.keyId]);
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    context.res = { status:400, headers:getCorsHeaders(req), body:{ error:'Unknown action.' } };

  } catch (err) {
    context.log('admin ERROR:', err.message);
    context.res = { status:500, headers:getCorsHeaders(req), body:{ error: 'An internal error occurred. Please try again.' } };
  }
};