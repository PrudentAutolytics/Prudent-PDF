'use strict';

const { Pool } = require('pg');

let pool;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.PG_CONNECTION_STRING;

  if (connectionString) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  } else {
    pool = new Pool({
      host     : process.env.PG_HOST,
      port     : parseInt(process.env.PG_PORT || '6543'),
      database : process.env.PG_DATABASE || 'postgres',
      user     : process.env.PG_USER,
      password : process.env.PG_PASSWORD,
      ssl      : { rejectUnauthorized: false },
      max      : 2,
      idleTimeoutMillis    : 30000,
      connectionTimeoutMillis : 10000,
    });
  }

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
    pool = null;
  });

  return pool;
}

module.exports = {
  query: (...args) => getPool().query(...args),
};