'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host     : process.env.PG_HOST,
  port     : parseInt(process.env.PG_PORT || '6543'),
  database : process.env.PG_DATABASE || 'postgres',
  user     : process.env.PG_USER,
  password : process.env.PG_PASSWORD,
  ssl      : { rejectUnauthorized: false },
  max      : 3,
  idleTimeoutMillis    : 30000,
  connectionTimeoutMillis : 10000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = pool;