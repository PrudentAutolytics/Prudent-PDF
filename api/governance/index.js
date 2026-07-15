'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');

module.exports = async function(context, req) {
  if (handleCors(context, req)) return;

  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }

  try {
    const columns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'jobs'
    `);
    const available = new Set(columns.rows.map(r => r.column_name));

    const optional = [
      ['page_count', 'pageCount'],
      ['cost_total', 'costTotal'],
      ['completed_at', 'completedAt'],
      ['error_message', 'errorMessage'],
    ].filter(([column]) => available.has(column))
     .map(([column, alias]) => `j.${column} AS "${alias}"`);

    const fields = [
      'j.id AS "jobId"',
      'j.file_name AS "fileName"',
      'j.status',
      'j.submitted_at AS "submittedAt"',
      ...optional,
    ].join(',\n        ');

    const jobs = await pool.query(`
      SELECT ${fields}
      FROM jobs j
      WHERE j.user_id = $1
        AND j.submitted_at > NOW() - INTERVAL '30 days'
      ORDER BY j.submitted_at DESC
      LIMIT 500
    `, [auth.userId]);

    const rows = jobs.rows;
    const now = Date.now();
    const statusOf = row => String(row.status || '').toLowerCase();
    const complete = rows.filter(row => statusOf(row) === 'complete');
    const failed = rows.filter(row => ['failed', 'error'].includes(statusOf(row)));
    const active = rows.filter(row => ['queued', 'processing', 'pending'].includes(statusOf(row)));
    const stuck = active.filter(row => now - new Date(row.submittedAt).getTime() > 30 * 60_000);
    const sla = complete.filter(row =>
      row.completedAt &&
      new Date(row.completedAt).getTime() - new Date(row.submittedAt).getTime() > 15 * 60_000
    );
    const durations = complete
      .filter(row => row.completedAt)
      .map(row => (new Date(row.completedAt).getTime() - new Date(row.submittedAt).getTime()) / 60_000)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const p95 = durations.length
      ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)]
      : 0;

    const days = {};
    for (const job of rows) {
      const submitted = new Date(job.submittedAt);
      if (!Number.isFinite(submitted.getTime())) continue;
      const key = submitted.toISOString().slice(0, 10);
      days[key] ||= { day: key, jobs: 0, failed: 0, pages: 0 };
      days[key].jobs += 1;
      days[key].pages += Number(job.pageCount || 0);
      if (['failed', 'error'].includes(statusOf(job))) days[key].failed += 1;
    }

    const riskQueue = [...failed, ...stuck, ...sla]
      .filter((row, index, all) => all.findIndex(item => item.jobId === row.jobId) === index)
      .slice(0, 50);

    context.res = {
      status: 200,
      headers: getCorsHeaders(req),
      body: {
        generatedAt: new Date().toISOString(),
        scope: 'current_user',
        metrics: {
          total_jobs: rows.length,
          completed_jobs: complete.length,
          failed_jobs: failed.length,
          active_jobs: active.length,
          stuck_jobs: stuck.length,
          sla_breaches: sla.length,
          total_pages: rows.reduce((sum, row) => sum + Number(row.pageCount || 0), 0),
          total_cost: rows.reduce((sum, row) => sum + Number(row.costTotal || 0), 0),
          avg_minutes: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
          p95_minutes: p95,
        },
        policy: {
          callbackProtection: !!process.env.PA_CALLBACK_SECRET,
          appUrlConfigured: !!process.env.APP_URL,
        },
        riskQueue,
        dailyVolume: Object.values(days).sort((a, b) => a.day.localeCompare(b.day)).slice(-30),
        userRisk: [],
        audit: [],
      },
    };
  } catch (err) {
    context.log('governance ERROR:', err.message);
    context.res = {
      status: 500,
      headers: getCorsHeaders(req),
      body: { error: 'Governance data could not be loaded. Please try again.' },
    };
  }
};
