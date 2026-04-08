'use strict';
const { Pool } = require('pg');

module.exports = async function (context, req) {
  const email = (req.body?.email || '').trim().toLowerCase();

  // Test connection directly
  const pool = new Pool({
    connectionString: process.env.PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query('SELECT NOW() as time, $1 as email', [email || 'test']);
    context.res = {
      status: 200,
      body: {
        connected: true,
        time: result.rows[0].time,
        email: result.rows[0].email,
        pgConnString: process.env.PG_CONNECTION_STRING ? 'SET' : 'NOT SET',
        pgHost: process.env.PG_HOST || 'NOT SET',
      },
    };
  } catch (err) {
    context.res = {
      status: 200,
      body: {
        connected: false,
        error: err.message,
        pgConnString: process.env.PG_CONNECTION_STRING ? 'SET' : 'NOT SET',
        pgHost: process.env.PG_HOST || 'NOT SET',
      },
    };
  } finally {
    await pool.end();
  }
};