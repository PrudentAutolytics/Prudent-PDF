'use strict';
const pool = require('./db');

const FALLBACK_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kabileshvijayakumar@prudentautolytics.com')
  .split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);

async function isAdminUser(userId, email) {
  // Normalize defensively: trim AND lowercase. A stray leading or trailing
  // space in a stored or session email must never lock an administrator out.
  const normalized = String(email || '').trim().toLowerCase();
  try {
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users'
    `);
    const names = new Set(columns.rows.map(r=>r.column_name));
    const flags = [];
    if (names.has('is_admin')) flags.push('COALESCE(is_admin,false)');
    if (names.has('isAdmin')) flags.push('COALESCE("isAdmin",false)');
    if (names.has('role')) flags.push(`LOWER(COALESCE(role,'')) IN ('admin','administrator','owner')`);
    if (flags.length) {
      const r = await pool.query(`SELECT (${flags.join(' OR ')}) AS allowed FROM users WHERE id=$1 LIMIT 1`,[userId]);
      if (r.rows[0]?.allowed === true) return true;
    }
  } catch {}
  return FALLBACK_ADMIN_EMAILS.includes(normalized);
}
module.exports = { isAdminUser, FALLBACK_ADMIN_EMAILS };
