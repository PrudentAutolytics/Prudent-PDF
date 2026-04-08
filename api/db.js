'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host     : process.env.PG_HOST     || 'localhost',
  port     : process.env.PG_PORT     || 5432,
  database : process.env.PG_DATABASE || 'prudent_pdf',
  user     : process.env.PG_USER     || 'postgres',
  password : process.env.PG_PASSWORD || '',
  ssl      : process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = pool;
