'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');

module.exports = async function(context, req) {
  if (handleCors(context, req)) return;
  const headers = { ...getCorsHeaders(req), 'Cache-Control': 'no-store, private, max-age=0' };
  const auth = await verifySession(req);
  if (!auth.ok) { context.res={status:auth.status,headers,body:{error:auth.error}}; return; }
  try {
    const exists = await pool.query(`SELECT to_regclass('public.operation_usage') AS table_name`);
    if (!exists.rows[0]?.table_name) {
      context.res={status:200,headers,body:{available:false,days:30,totalOperations:0,totalPlatformCost:0,totalProductPrice:0,byOperation:[]}};
      return;
    }
    const summary = await pool.query(`
      SELECT
        COUNT(*)::int AS "totalOperations",
        COALESCE(SUM(platform_cost),0)::float8 AS "totalPlatformCost",
        COALESCE(SUM(product_price),0)::float8 AS "totalProductPrice"
      FROM operation_usage
      WHERE user_id=$1 AND created_at > NOW()-INTERVAL '30 days'
    `,[auth.userId]);
    const byOperation = await pool.query(`
      SELECT operation_type AS operation,
             COUNT(*)::int AS count,
             COALESCE(SUM(platform_cost),0)::float8 AS "platformCost",
             COALESCE(SUM(product_price),0)::float8 AS "productPrice"
      FROM operation_usage
      WHERE user_id=$1 AND created_at > NOW()-INTERVAL '30 days'
      GROUP BY operation_type
      ORDER BY "productPrice" DESC, count DESC
      LIMIT 50
    `,[auth.userId]);
    context.res={status:200,headers,body:{available:true,days:30,...summary.rows[0],byOperation:byOperation.rows}};
  } catch(err) {
    context.log.warn('operation-summary unavailable',{reason:err?.code||'query_error'});
    context.res={status:200,headers,body:{available:false,days:30,totalOperations:0,totalPlatformCost:0,totalProductPrice:0,byOperation:[]}};
  }
};
