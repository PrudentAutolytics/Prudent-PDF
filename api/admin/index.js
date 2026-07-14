'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');

// ENTERPRISE HARDENING: allowlist configurable via ADMIN_EMAILS app
// setting (comma-separated), with the founder account as fallback.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kabileshvijayakumar@prudentautolytics.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

const crypto = require('crypto');

/** Best-effort audit trail — never blocks the admin action itself. */
async function audit(context, adminEmail, action, target, details) {
  try {
    await pool.query(
      `INSERT INTO audit_log (admin_email, action, target, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [adminEmail, action, target || null, details ? JSON.stringify(details).slice(0, 2000) : null]
    );
  } catch (e) {
    context.log('audit_log insert failed (non-fatal):', e.message);
  }
}

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  // Session auth — must be logged in AND be admin
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }

  // ENTERPRISE HARDENING: authorize on the VERIFIED session identity.
  const adminEmail = auth.email;
  if (!ADMIN_EMAILS.includes(adminEmail)) {
    context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Forbidden.' } };
    return;
  }

  const action = req.body?.action || 'list';
  const type   = req.body?.type   || 'users';

  try {

    /* ── Governance command center ── */
    if (type === 'governance') {
      const metrics = await pool.query(`
        SELECT
          COUNT(*)::int AS total_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('complete','completed'))::int AS completed_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('failed','error'))::int AS failed_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('queued','processing','pending'))::int AS active_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('queued','processing','pending') AND submitted_at < NOW() - INTERVAL '15 minutes')::int AS stuck_jobs,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at - submitted_at > INTERVAL '15 minutes')::int AS sla_breaches,
          COALESCE(SUM(page_count),0)::int AS total_pages,
          COALESCE(SUM(cost_total),0)::float AS total_cost,
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))/60) FILTER (WHERE completed_at IS NOT NULL),0)::float AS avg_minutes,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - submitted_at))/60) FILTER (WHERE completed_at IS NOT NULL),0)::float AS p95_minutes
        FROM jobs
        WHERE submitted_at > NOW() - INTERVAL '30 days'
      `);

      const queue = await pool.query(`
        SELECT j.id AS "jobId", j.file_name AS "fileName", j.status,
               j.page_count AS "pageCount", j.cost_total AS "costTotal",
               j.submitted_at AS "submittedAt", j.completed_at AS "completedAt",
               j.error_message AS "errorMessage", u.email
        FROM jobs j
        INNER JOIN users u ON u.id = j.user_id
        WHERE j.submitted_at > NOW() - INTERVAL '30 days'
          AND (
            LOWER(j.status) IN ('failed','error')
            OR (LOWER(j.status) IN ('queued','processing','pending') AND j.submitted_at < NOW() - INTERVAL '15 minutes')
            OR (j.completed_at IS NOT NULL AND j.completed_at - j.submitted_at > INTERVAL '15 minutes')
          )
        ORDER BY
          CASE WHEN LOWER(j.status) IN ('failed','error') THEN 0
               WHEN LOWER(j.status) IN ('queued','processing','pending') THEN 1 ELSE 2 END,
          j.submitted_at ASC
        LIMIT 50
      `);

      const volume = await pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('day', submitted_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS jobs,
               COUNT(*) FILTER (WHERE LOWER(status) IN ('failed','error'))::int AS failed,
               COALESCE(SUM(page_count),0)::int AS pages
        FROM jobs
        WHERE submitted_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE_TRUNC('day', submitted_at)
        ORDER BY DATE_TRUNC('day', submitted_at) ASC
      `);

      const users = await pool.query(`
        SELECT u.email, u.full_name AS "fullName", u.company, u.plan, u.is_active AS "isActive",
               COUNT(j.id)::int AS jobs,
               COUNT(j.id) FILTER (WHERE LOWER(j.status) IN ('failed','error'))::int AS failed,
               COALESCE(SUM(j.page_count),0)::int AS pages
        FROM users u
        LEFT JOIN jobs j ON j.user_id=u.id AND j.submitted_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id
        ORDER BY COUNT(j.id) DESC
        LIMIT 25
      `);

      let auditRows = [];
      try {
        const a = await pool.query(`SELECT admin_email AS "actor", action, target, details, created_at AS "createdAt" FROM audit_log ORDER BY created_at DESC LIMIT 30`);
        auditRows = a.rows;
      } catch (e) {
        context.log('governance audit query unavailable:', e.message);
      }

      context.res = { status:200, headers:getCorsHeaders(req), body:{
        metrics: metrics.rows[0],
        riskQueue: queue.rows,
        dailyVolume: volume.rows,
        userRisk: users.rows,
        audit: auditRows,
        policy: { slaMinutes:15, stuckMinutes:15, reviewRequired:true, callbackProtection:Boolean(process.env.PA_CALLBACK_SECRET), appUrlConfigured:Boolean(process.env.APP_URL) },
        generatedAt: new Date().toISOString()
      }};
      return;
    }

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
      await audit(context, adminEmail, 'setPlan', targetEmail, { plan });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Reset credits ── */
    if (action === 'resetCredits') {
      await pool.query(`UPDATE users SET credits_used=0 WHERE email=$1`, [req.body.targetEmail]);
      await audit(context, adminEmail, 'resetCredits', req.body.targetEmail);
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Toggle active ── */
    if (action === 'setActive') {
      await pool.query(`UPDATE users SET is_active=$1 WHERE email=$2`, [req.body.active, req.body.targetEmail]);
      await audit(context, adminEmail, 'setActive', req.body.targetEmail, { active: req.body.active });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Generate API key ── */
    if (action === 'generateApiKey') {
      const { targetEmail } = req.body;
      const userRes = await pool.query(`SELECT plan FROM users WHERE email=$1`, [targetEmail]);
      if (!userRes.rows.length) throw new Error('User not found.');
      const plan = userRes.rows[0].plan || 'trial';
      // ENTERPRISE HARDENING: cryptographically secure key material
      // (Math.random is predictable) and only the SHA-256 hash is
      // persisted — a database read can no longer be replayed as a key.
      // The plaintext key is shown exactly once in this response.
      const key    = 'ppk_' + crypto.randomBytes(30).toString('base64url');
      const prefix = key.substring(0, 12);
      const hash   = crypto.createHash('sha256').update(key).digest('hex');
      await pool.query(`
        INSERT INTO api_keys (email, plan, api_key, key_prefix, created_at, revoked)
        VALUES ($1,$2,$3,$4,NOW(),false)
      `, [targetEmail, plan, hash, prefix]);
      await audit(context, adminEmail, 'generateApiKey', targetEmail, { prefix });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ apiKey:key, keyPrefix:prefix } };
      return;
    }

    /* ── Revoke API key ── */
    if (action === 'revokeApiKey') {
      await pool.query(`UPDATE api_keys SET revoked=true WHERE id=$1`, [req.body.keyId]);
      await audit(context, adminEmail, 'revokeApiKey', String(req.body.keyId));
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Add new user ── */
    if (action === 'addUser') {
      const { targetEmail, fullName, company, plan: newPlan } = req.body;
      if (!targetEmail || !targetEmail.includes('@')) {
        context.res = { status:400, headers:getCorsHeaders(req), body:{ error:'Valid email required.' } };
        return;
      }
      const existing = await pool.query('SELECT id FROM users WHERE email=$1', [targetEmail]);
      if (existing.rows.length) {
        context.res = { status:409, headers:getCorsHeaders(req), body:{ error:'User already exists.' } };
        return;
      }
      const PLAN_LIMITS = {
        trial        : { credits_limit:5,    max_file_size_mb:10,  max_pages_per_file:50,   max_pages_per_month:50    },
        starter      : { credits_limit:50,   max_file_size_mb:25,  max_pages_per_file:100,  max_pages_per_month:500   },
        professional : { credits_limit:200,  max_file_size_mb:50,  max_pages_per_file:500,  max_pages_per_month:2000  },
        business     : { credits_limit:1000, max_file_size_mb:100, max_pages_per_file:1000, max_pages_per_month:10000 },
        enterprise   : { credits_limit:9999, max_file_size_mb:500, max_pages_per_file:9999, max_pages_per_month:50000 },
      };
      const p = newPlan || 'trial';
      const lim = PLAN_LIMITS[p] || PLAN_LIMITS.trial;
      await pool.query(`
        INSERT INTO users (email, full_name, company, plan, credits_used, credits_limit,
          max_file_size_mb, max_pages_per_file, max_pages_per_month, is_active)
        VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,true)
      `, [targetEmail, fullName||null, company||null, p, lim.credits_limit, lim.max_file_size_mb, lim.max_pages_per_file, lim.max_pages_per_month]);
      await audit(context, adminEmail, 'addUser', targetEmail, { plan: p });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    /* ── Set credits (used + limit) ── */
    if (action === 'setCredits') {
      const { targetEmail, creditsUsed, creditsLimit } = req.body;
      if (!targetEmail) { context.res = { status:400, headers:getCorsHeaders(req), body:{ error:'targetEmail required.' } }; return; }
      await pool.query(
        'UPDATE users SET credits_used=$1, credits_limit=$2 WHERE email=$3',
        [creditsUsed ?? 0, creditsLimit ?? 5, targetEmail]
      );
      await audit(context, adminEmail, 'setCredits', targetEmail, { creditsUsed, creditsLimit });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    context.res = { status:400, headers:getCorsHeaders(req), body:{ error:'Unknown action.' } };

  } catch (err) {
    context.log('admin ERROR:', err.message);
    context.res = { status:500, headers:getCorsHeaders(req), body:{ error: 'An internal error occurred. Please try again.' } };
  }
};