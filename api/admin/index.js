'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');
const crypto = require('crypto');
const { isAdminUser } = require('../admin-access');

const PLAN_LIMITS = {
  trial        : { credits_limit:5,    max_file_size_mb:10,  max_pages_per_file:50,   max_pages_per_month:50    },
  starter      : { credits_limit:50,   max_file_size_mb:25,  max_pages_per_file:100,  max_pages_per_month:500   },
  professional : { credits_limit:200,  max_file_size_mb:50,  max_pages_per_file:500,  max_pages_per_month:2000  },
  business     : { credits_limit:1000, max_file_size_mb:100, max_pages_per_file:1000, max_pages_per_month:10000 },
  enterprise   : { credits_limit:9999, max_file_size_mb:500, max_pages_per_file:9999, max_pages_per_month:50000 },
};

async function tableExists(tableName) {
  const r = await pool.query(`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=$1
  ) AS exists`, [tableName]);
  return Boolean(r.rows[0]?.exists);
}

async function getColumns(tableName) {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1`, [tableName]);
  return new Set(r.rows.map(x => x.column_name));
}

function aliasOr(cols, name, fallbackSql, alias = name) {
  return cols.has(name) ? `"${name}"` : `${fallbackSql} AS "${alias}"`;
}

async function audit(context, adminEmail, action, target, details) {
  try {
    if (!(await tableExists('audit_log'))) return;
    await pool.query(
      `INSERT INTO audit_log (admin_email, action, target, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [adminEmail, action, target || null, details ? JSON.stringify(details).slice(0, 2000) : null]
    );
  } catch (e) {
    context.log('audit_log insert failed (non-fatal):', e.message);
  }
}

async function listUsers() {
  const cols = await getColumns('users');
  const select = [
    aliasOr(cols, 'id', 'NULL'),
    aliasOr(cols, 'email', "''::text"),
    aliasOr(cols, 'full_name', 'NULL', 'full_name'),
    aliasOr(cols, 'company', 'NULL'),
    aliasOr(cols, 'plan', "'trial'::text"),
    aliasOr(cols, 'credits_used', '0'),
    aliasOr(cols, 'credits_limit', '5'),
    aliasOr(cols, 'max_file_size_mb', '10'),
    aliasOr(cols, 'max_pages_per_file', '50'),
    aliasOr(cols, 'max_pages_per_month', '50'),
    aliasOr(cols, 'is_active', 'true'),
    aliasOr(cols, 'created_at', 'NOW()'),
  ].join(', ');
  const order = cols.has('created_at') ? 'created_at DESC' : 'email ASC';
  const users = await pool.query(`SELECT ${select} FROM users ORDER BY ${order}`);
  return { users: users.rows, cols };
}

async function listApiKeys() {
  if (!(await tableExists('api_keys'))) return [];
  const cols = await getColumns('api_keys');
  const select = [
    aliasOr(cols, 'id', 'NULL'),
    aliasOr(cols, 'email', "''::text"),
    aliasOr(cols, 'plan', "'trial'::text"),
    cols.has('key_prefix') ? 'key_prefix' : (cols.has('api_key') ? `LEFT(api_key, 12) AS key_prefix` : `NULL AS key_prefix`),
    aliasOr(cols, 'created_at', 'NOW()'),
    aliasOr(cols, 'last_used_at', 'NULL'),
  ].join(', ');
  const where = cols.has('revoked') ? 'WHERE revoked=false' : '';
  const order = cols.has('created_at') ? 'ORDER BY created_at DESC' : '';
  const r = await pool.query(`SELECT ${select} FROM api_keys ${where} ${order}`);
  return r.rows;
}

async function ensureApiKeysTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'trial',
    api_key TEXT NOT NULL,
    key_prefix TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
  )`);
}

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }

  const adminEmail = auth.email;
  if (!(await isAdminUser(auth.userId, adminEmail))) {
    context.res = { status: 403, headers: getCorsHeaders(req), body: { error: 'Forbidden.' } };
    return;
  }

  const action = req.body?.action || 'list';
  const type = req.body?.type || 'users';

  try {
    if (action === 'me') {
      context.res = { status:200, headers:getCorsHeaders(req), body:{ isAdmin:true, email:adminEmail } };
      return;
    }

    if (type === 'governance') {
      const metrics = await pool.query(`
        SELECT COUNT(*)::int AS total_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('complete','completed'))::int AS completed_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('failed','error'))::int AS failed_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('queued','processing','pending'))::int AS active_jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('queued','processing','pending') AND submitted_at < NOW() - INTERVAL '15 minutes')::int AS stuck_jobs,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at - submitted_at > INTERVAL '15 minutes')::int AS sla_breaches,
          COALESCE(SUM(page_count),0)::int AS total_pages,
          COALESCE(SUM(cost_total),0)::float AS total_cost,
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))/60) FILTER (WHERE completed_at IS NOT NULL),0)::float AS avg_minutes,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - submitted_at))/60) FILTER (WHERE completed_at IS NOT NULL),0)::float AS p95_minutes
        FROM jobs WHERE submitted_at > NOW() - INTERVAL '30 days'`);

      const jobCols = await getColumns('jobs');
      const errorExpr = jobCols.has('error_message') ? 'j.error_message' : 'NULL::text';
      const queue = await pool.query(`
        SELECT j.id AS "jobId", j.file_name AS "fileName", j.status,
          j.page_count AS "pageCount", j.cost_total AS "costTotal",
          j.submitted_at AS "submittedAt", j.completed_at AS "completedAt",
          ${errorExpr} AS "errorMessage", u.email
        FROM jobs j INNER JOIN users u ON u.id=j.user_id
        WHERE j.submitted_at > NOW() - INTERVAL '30 days' AND (
          LOWER(j.status) IN ('failed','error') OR
          (LOWER(j.status) IN ('queued','processing','pending') AND j.submitted_at < NOW() - INTERVAL '15 minutes') OR
          (j.completed_at IS NOT NULL AND j.completed_at - j.submitted_at > INTERVAL '15 minutes'))
        ORDER BY CASE WHEN LOWER(j.status) IN ('failed','error') THEN 0 WHEN LOWER(j.status) IN ('queued','processing','pending') THEN 1 ELSE 2 END,
          j.submitted_at ASC LIMIT 50`);

      const volume = await pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('day',submitted_at),'YYYY-MM-DD') AS day,
          COUNT(*)::int AS jobs,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('failed','error'))::int AS failed,
          COALESCE(SUM(page_count),0)::int AS pages
        FROM jobs WHERE submitted_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE_TRUNC('day',submitted_at) ORDER BY DATE_TRUNC('day',submitted_at) ASC`);

      const userCols = await getColumns('users');
      const nameExpr = userCols.has('full_name') ? 'u.full_name' : 'NULL::text';
      const companyExpr = userCols.has('company') ? 'u.company' : 'NULL::text';
      const planExpr = userCols.has('plan') ? 'u.plan' : `'trial'::text`;
      const activeExpr = userCols.has('is_active') ? 'u.is_active' : 'true';
      const users = await pool.query(`
        SELECT u.email, ${nameExpr} AS "fullName", ${companyExpr} AS company,
          ${planExpr} AS plan, ${activeExpr} AS "isActive",
          COUNT(j.id)::int AS jobs,
          COUNT(j.id) FILTER (WHERE LOWER(j.status) IN ('failed','error'))::int AS failed,
          COALESCE(SUM(j.page_count),0)::int AS pages
        FROM users u LEFT JOIN jobs j ON j.user_id=u.id AND j.submitted_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id ORDER BY COUNT(j.id) DESC LIMIT 25`);

      let auditRows = [];
      try {
        if (await tableExists('audit_log')) {
          const a = await pool.query(`SELECT admin_email AS "actor", action, target, details, created_at AS "createdAt" FROM audit_log ORDER BY created_at DESC LIMIT 30`);
          auditRows = a.rows;
        }
      } catch (e) { context.log('governance audit query unavailable:', e.message); }

      context.res = { status:200, headers:getCorsHeaders(req), body:{
        metrics:metrics.rows[0], riskQueue:queue.rows, dailyVolume:volume.rows,
        userRisk:users.rows, audit:auditRows,
        policy:{ slaMinutes:15, stuckMinutes:15, callbackProtection:Boolean(process.env.PA_CALLBACK_SECRET), appUrlConfigured:Boolean(process.env.APP_URL) },
        generatedAt:new Date().toISOString()
      }};
      return;
    }

    if (action === 'list' || !action || req.body?.adminMode) {
      if (type === 'contacts') {
        if (!(await tableExists('contact_requests'))) {
          context.res = { status:200, headers:getCorsHeaders(req), body:{ contacts:[], warning:'contact_requests table is not available.' } };
          return;
        }
        const cols = await getColumns('contact_requests');
        const order = cols.has('submitted_at') ? 'ORDER BY submitted_at DESC' : '';
        const r = await pool.query(`SELECT * FROM contact_requests ${order} LIMIT 100`);
        context.res = { status:200, headers:getCorsHeaders(req), body:{ contacts:r.rows } };
        return;
      }

      if (type === 'apikeys') {
        const keys = await listApiKeys();
        context.res = { status:200, headers:getCorsHeaders(req), body:{ apiKeys:keys } };
        return;
      }

      const { users, cols } = await listUsers();
      let totalJobs = 0, totalCost = 0;
      if (await tableExists('jobs')) {
        const jobCols = await getColumns('jobs');
        const costExpr = jobCols.has('cost_total') ? 'COALESCE(SUM(cost_total),0)' : '0';
        const jobs = await pool.query(`SELECT COUNT(*) AS total, ${costExpr} AS total_cost FROM jobs`);
        totalJobs = parseInt(jobs.rows[0]?.total || 0, 10);
        totalCost = parseFloat(jobs.rows[0]?.total_cost || 0);
      }
      context.res = { status:200, headers:getCorsHeaders(req), body:{
        users, totalJobs, totalCost,
        capabilities:{
          plan:cols.has('plan'), credits:cols.has('credits_used') && cols.has('credits_limit'),
          active:cols.has('is_active'), fileLimits:cols.has('max_file_size_mb') && cols.has('max_pages_per_file') && cols.has('max_pages_per_month')
        }
      }};
      return;
    }

    if (action === 'setPlan') {
      const { targetEmail, plan } = req.body;
      const cols = await getColumns('users');
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
      const sets = [], values = [];
      const add = (col,val) => { if (cols.has(col)) { values.push(val); sets.push(`${col}=$${values.length}`); } };
      add('plan', plan); add('credits_limit', limits.credits_limit); add('max_file_size_mb', limits.max_file_size_mb);
      add('max_pages_per_file', limits.max_pages_per_file); add('max_pages_per_month', limits.max_pages_per_month);
      if (!sets.length) throw new Error('Current users table does not support plan administration.');
      values.push(targetEmail);
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE email=$${values.length}`, values);
      await audit(context, adminEmail, 'setPlan', targetEmail, { plan });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    if (action === 'resetCredits' || action === 'setCredits') {
      const cols = await getColumns('users');
      if (!cols.has('credits_used')) throw new Error('Current users table does not support credit administration.');
      const targetEmail = req.body.targetEmail;
      if (action === 'resetCredits') {
        await pool.query(`UPDATE users SET credits_used=0 WHERE email=$1`, [targetEmail]);
        await audit(context, adminEmail, 'resetCredits', targetEmail);
      } else {
        const sets = ['credits_used=$1'];
        const values = [req.body.creditsUsed ?? 0];
        if (cols.has('credits_limit')) { values.push(req.body.creditsLimit ?? 5); sets.push(`credits_limit=$${values.length}`); }
        values.push(targetEmail);
        await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE email=$${values.length}`, values);
        await audit(context, adminEmail, 'setCredits', targetEmail, { creditsUsed:req.body.creditsUsed, creditsLimit:req.body.creditsLimit });
      }
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    if (action === 'setActive') {
      const cols = await getColumns('users');
      if (!cols.has('is_active')) throw new Error('Current users table does not support account enable/disable.');
      await pool.query(`UPDATE users SET is_active=$1 WHERE email=$2`, [req.body.active, req.body.targetEmail]);
      await audit(context, adminEmail, 'setActive', req.body.targetEmail, { active:req.body.active });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    if (action === 'generateApiKey') {
      const { targetEmail } = req.body;
      const userCols = await getColumns('users');
      const planExpr = userCols.has('plan') ? 'plan' : `'trial'::text AS plan`;
      const userRes = await pool.query(`SELECT ${planExpr} FROM users WHERE email=$1`, [targetEmail]);
      if (!userRes.rows.length) throw new Error('User not found.');
      await ensureApiKeysTable();
      const cols = await getColumns('api_keys');
      const plan = userRes.rows[0].plan || 'trial';
      const key = 'ppk_' + crypto.randomBytes(30).toString('base64url');
      const prefix = key.substring(0, 12);
      const hash = crypto.createHash('sha256').update(key).digest('hex');
      const fields=['email','plan','api_key'], values=[targetEmail,plan,hash], params=['$1','$2','$3'];
      if (cols.has('key_prefix')) { fields.push('key_prefix'); values.push(prefix); params.push(`$${values.length}`); }
      if (cols.has('created_at')) { fields.push('created_at'); params.push('NOW()'); }
      if (cols.has('revoked')) { fields.push('revoked'); params.push('false'); }
      await pool.query(`INSERT INTO api_keys (${fields.join(',')}) VALUES (${params.join(',')})`, values);
      await audit(context, adminEmail, 'generateApiKey', targetEmail, { prefix });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ apiKey:key, keyPrefix:prefix } };
      return;
    }

    if (action === 'revokeApiKey') {
      if (!(await tableExists('api_keys'))) throw new Error('API key store is not configured.');
      const cols = await getColumns('api_keys');
      if (cols.has('revoked')) await pool.query(`UPDATE api_keys SET revoked=true WHERE id=$1`, [req.body.keyId]);
      else await pool.query(`DELETE FROM api_keys WHERE id=$1`, [req.body.keyId]);
      await audit(context, adminEmail, 'revokeApiKey', String(req.body.keyId));
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    if (action === 'addUser') {
      const { targetEmail, fullName, company, plan:newPlan } = req.body;
      if (!targetEmail || !targetEmail.includes('@')) {
        context.res = { status:400, headers:getCorsHeaders(req), body:{ error:'Valid email required.' } }; return;
      }
      const existing = await pool.query('SELECT id FROM users WHERE email=$1', [targetEmail]);
      if (existing.rows.length) {
        context.res = { status:409, headers:getCorsHeaders(req), body:{ error:'User already exists.' } }; return;
      }
      const cols = await getColumns('users');
      const p = newPlan || 'trial'; const lim = PLAN_LIMITS[p] || PLAN_LIMITS.trial;
      const map = { email:targetEmail, full_name:fullName||null, company:company||null, plan:p, credits_used:0,
        credits_limit:lim.credits_limit, max_file_size_mb:lim.max_file_size_mb, max_pages_per_file:lim.max_pages_per_file,
        max_pages_per_month:lim.max_pages_per_month, is_active:true };
      const fields=[], values=[], params=[];
      for (const [col,val] of Object.entries(map)) if (cols.has(col)) { fields.push(col); values.push(val); params.push(`$${values.length}`); }
      if (!fields.includes('email')) throw new Error('Users table does not contain an email column.');
      await pool.query(`INSERT INTO users (${fields.join(',')}) VALUES (${params.join(',')})`, values);
      await audit(context, adminEmail, 'addUser', targetEmail, { plan:p });
      context.res = { status:200, headers:getCorsHeaders(req), body:{ success:true } };
      return;
    }

    context.res = { status:400, headers:getCorsHeaders(req), body:{ error:'Unknown action.' } };
  } catch (err) {
    context.log('admin ERROR:', err.stack || err.message);
    context.res = { status:500, headers:getCorsHeaders(req), body:{ error:err.message || 'Administration request failed.' } };
  }
};
