'use strict';
/**
 * ratelimit.js - PostgreSQL-backed rate limiting
 *
 * Azure Functions on the Consumption plan scale to multiple instances
 * and recycle on cold start, so in-memory Maps silently stop limiting.
 * This module stores counters in a small `rate_limits` table so the
 * limit holds across every instance.
 *
 * Table (see migration.sql):
 *   CREATE TABLE rate_limits (
 *     key       TEXT PRIMARY KEY,
 *     count     INT NOT NULL DEFAULT 1,
 *     reset_at  TIMESTAMPTZ NOT NULL
 *   );
 *
 * Usage:
 *   const { checkRateLimit } = require('../ratelimit');
 *   const limited = await checkRateLimit(`otp:${email}`, 5, 15 * 60 * 1000);
 *   if (limited) { ...429... }
 *
 * If the database-backed limiter is unavailable, an instance-local fallback
 * remains active so authentication and contact endpoints do not become fully
 * unthrottled. The database limiter is still preferred for scale-out safety.
 */
const pool = require('./db');
const memoryFallback = new Map();

function memoryLimited(key, maxCount, windowMs) {
  const now = Date.now();
  const current = memoryFallback.get(key);
  if (!current || current.resetAt <= now) {
    memoryFallback.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  if (memoryFallback.size > 5000) {
    for (const [k, v] of memoryFallback) { if (v.resetAt <= now) memoryFallback.delete(k); }
  }
  return current.count > maxCount;
}

async function checkRateLimit(key, maxCount, windowMs, context) {
  try {
    const result = await pool.query(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, NOW() + ($3 || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         count    = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN NOW() + ($3 || ' milliseconds')::interval ELSE rate_limits.reset_at END
       RETURNING count`,
      [key, maxCount, String(windowMs)]
    );
    return result.rows[0].count > maxCount;
  } catch (err) {
    if (context?.log) context.log('ratelimit database unavailable; using instance fallback');
    return memoryLimited(key, maxCount, windowMs);
  }
}

module.exports = { checkRateLimit };
