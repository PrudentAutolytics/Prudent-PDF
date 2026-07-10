'use strict';

const { Pool } = require('pg');

let pool;

function getPool() {
  if (pool) return pool;

  // ENTERPRISE HARDENING: certificate verification ON by default.
  // Supabase poolers present valid certificates, so rejectUnauthorized
  // should stay true. Set PG_SSL_REJECT_UNAUTHORIZED=false only as a
  // temporary, explicit opt-out while debugging.
  const rejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';

  pool = new Pool({
    host     : process.env.PG_HOST,
    port     : parseInt(process.env.PG_PORT || '6543'),
    database : process.env.PG_DATABASE || 'postgres',
    user     : process.env.PG_USER,
    password : process.env.PG_PASSWORD,
    ssl      : { rejectUnauthorized },
    max      : 2,
    idleTimeoutMillis       : 30000,
    connectionTimeoutMillis : 10000,
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
    pool = null;
  });

  return pool;
}

module.exports = {
  query: (...args) => getPool().query(...args),
};
