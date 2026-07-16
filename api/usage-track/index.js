
'use strict';
const crypto = require('crypto');
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession } = require('../auth');
const pool = require('../db');
const { safeFileName } = require('../security');
const { calculateOperationCost } = require('../operation-cost');

// Locked to the same existing Power Automate trigger used by the redaction workflow.
// Do not rotate or normalize this static fallback without an explicit owner instruction.
const PA_FLOW_FALLBACK = 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc';

const ALLOWED_OPERATIONS = new Set([
  'IMAGE_REDACTION','FACE_REDACTION','VIDEO_REDACTION','VIDEO_FACE_REDACTION',
  'LICENCE_PLATE_REDACTION','SCREEN_BADGE_REDACTION'
]);

function bounded(value, max) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max); }

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;
  const headers = { ...getCorsHeaders(req), 'Cache-Control': 'no-store', Pragma: 'no-cache' };
  const auth = await verifySession(req);
  if (!auth.ok) { context.res = { status: auth.status, headers, body: { error: auth.error } }; return; }

  const operation = bounded(req.body?.operation, 64).toUpperCase();
  if (!ALLOWED_OPERATIONS.has(operation)) { context.res = { status: 400, headers, body: { error: 'Unsupported media operation.' } }; return; }

  const sourceName = bounded(req.body?.sourceName, 255);
  const outputName = bounded(req.body?.outputName, 255);
  if ((sourceName && !safeFileName(sourceName)) || (outputName && !safeFileName(outputName))) { context.res = { status: 400, headers, body: { error: 'Invalid media name.' } }; return; }

  const pageCount = Math.max(0, Math.min(1000000, Number(req.body?.pageCount) || 0));
  const fileSizeMB = Math.max(0, Math.min(5000, Number(req.body?.fileSizeMB) || 0));
  const sourceCount = Math.max(1, Math.min(1000, Number(req.body?.sourceCount) || 1));
  const costAnalysis = calculateOperationCost(operation, pageCount, fileSizeMB, sourceCount);
  const eventId = crypto.randomUUID();
  const event = {
    eventType: 'MEDIA_REDACTION_USAGE',
    eventId,
    operationType: operation,
    usageIncrement: 1,
    email: auth.email,
    sourceFileName: sourceName || null,
    outputFileName: outputName || null,
    pageCount,
    fileSizeMB: +fileSizeMB.toFixed(3),
    sourceCount,
    estimatedPlatformCost: costAnalysis.platformCost,
    estimatedProductPrice: costAnalysis.productPrice,
    costModelVersion: costAnalysis.modelVersion,
    occurredAt: new Date().toISOString(),
    product: 'Prudent Redact',
    source: 'media-redaction-preview'
  };

  try {
    const used = await pool.query(`
      UPDATE users SET credits_used = credits_used + 1
      WHERE email = $1 AND is_active = true AND credits_used < credits_limit
      RETURNING credits_used, credits_limit
    `, [auth.email]);
    if (!used.rows.length) { context.res = { status: 403, headers, body: { error: 'Monthly operation limit reached. Please review your plan capacity.' } }; return; }

    let ledgerRecorded = false;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS operation_usage (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          operation_type VARCHAR(64) NOT NULL,
          source_file_name VARCHAR(255),
          output_file_name VARCHAR(255),
          page_count INTEGER NOT NULL DEFAULT 0,
          file_size_mb NUMERIC(14,3) NOT NULL DEFAULT 0,
          source_count INTEGER NOT NULL DEFAULT 1,
          platform_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
          product_price NUMERIC(18,6) NOT NULL DEFAULT 0,
          cost_model_version VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        INSERT INTO operation_usage
          (id,user_id,operation_type,source_file_name,output_file_name,page_count,file_size_mb,source_count,platform_cost,product_price,cost_model_version)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [eventId, auth.userId, operation, sourceName || null, outputName || null, pageCount, fileSizeMB, sourceCount, costAnalysis.platformCost, costAnalysis.productPrice, costAnalysis.modelVersion]);
      ledgerRecorded = true;
    } catch (ledgerError) {
      context.log.warn('usage-track: operation cost ledger unavailable', { operation, eventId, reason: ledgerError?.code || 'ledger_error' });
    }

    let flowTriggered = false;
    let flowStatus = null;
    try {
      const flowUrl = process.env.PA_JOB_SUBMIT_FLOW || PA_FLOW_FALLBACK;
      const response = await fetch(flowUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), signal: AbortSignal.timeout(30000) });
      flowTriggered = response.ok;
      flowStatus = response.status;
      if (!response.ok) context.log.warn('usage-track: Power Automate usage event rejected', { operation, status: response.status, eventId });
    } catch (err) {
      context.log.warn('usage-track: Power Automate usage event failed', { operation, eventId, reason: err?.name || 'request_error' });
    }

    context.res = { status: 200, headers, body: { tracked: true, flowTriggered, flowStatus, ledgerRecorded, eventId, costAnalysis, creditsUsed: used.rows[0].credits_used, creditsLimit: used.rows[0].credits_limit } };
  } catch (err) {
    context.log.error('usage-track: database usage tracking failed', { operation, eventId, reason: err?.code || 'database_error' });
    context.res = { status: 500, headers, body: { error: 'Operation usage could not be recorded.' } };
  }
};
