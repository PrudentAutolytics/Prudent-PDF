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
 * Fails OPEN on DB error by design: an outage of the rate-limit table
 * should not lock every user out of the product. The error is logged.
 */
const pool = require('./db');

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
    if (context?.log) context.log('ratelimit ERROR (failing open):', err.message);
    return false;
  }
}

module.exports = { checkRateLimit };
