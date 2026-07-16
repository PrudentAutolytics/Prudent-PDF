'use strict';
const pool = require('./db');

const SUPER_ADMIN_ROLE = 'super_admin';

async function getUserRole(userId) {
  const result = await pool.query(
    `SELECT LOWER(COALESCE(role, 'user')) AS role FROM users WHERE id=$1 LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.role || 'user';
}

async function isAdminUser(userId) {
  try {
    return (await getUserRole(userId)) === SUPER_ADMIN_ROLE;
  } catch {
    return false;
  }
}

module.exports = { isAdminUser, getUserRole, SUPER_ADMIN_ROLE };
