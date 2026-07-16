'use strict';

const MODEL_VERSION = '2026.07-op-v1';
const RATES = Object.freeze({
  BLOB_PER_MB: 0.00002,
  FUNCTIONS_PER_RUN: 0.000002,
  PA_FLOW_PER_RUN: 0.0006,
  OVERHEAD_MULTIPLIER: 1.20,
  PRODUCT_MARGIN: 3.5,
});
const FACTORS = Object.freeze({
  IMAGE_REDACTION:1.10, FACE_REDACTION:1.35,
  VIDEO_REDACTION:2.50, VIDEO_FACE_REDACTION:3.50,
  LICENCE_PLATE_REDACTION:2.50, SCREEN_BADGE_REDACTION:1.35,
});

function calculateOperationCost(operation, pageCount = 0, fileSizeMB = 0, sourceCount = 1) {
  const op = String(operation || '').toUpperCase();
  const factor = FACTORS[op] || 1;
  const pages = Math.max(0, Number(pageCount) || 0);
  const size = Math.max(0, Number(fileSizeMB) || 0);
  const sources = Math.max(1, Number(sourceCount) || 1);
  const functions = RATES.FUNCTIONS_PER_RUN * factor;
  const paFlow = RATES.PA_FLOW_PER_RUN;
  const storageEstimate = size * RATES.BLOB_PER_MB * 0.05;
  const workload = (pages * 0.000002 * factor) + ((sources - 1) * RATES.FUNCTIONS_PER_RUN * 0.25);
  const platformSubtotal = functions + paFlow + storageEstimate + workload;
  const platformCost = platformSubtotal * RATES.OVERHEAD_MULTIPLIER;
  const productPrice = platformCost * RATES.PRODUCT_MARGIN;
  return {
    modelVersion: MODEL_VERSION, operation: op, factor,
    breakdown: {
      functions:+functions.toFixed(6), paFlow:+paFlow.toFixed(6),
      storageEstimate:+storageEstimate.toFixed(6), workload:+workload.toFixed(6),
    },
    platformSubtotal:+platformSubtotal.toFixed(6),
    platformCost:+platformCost.toFixed(6),
    productPrice:+productPrice.toFixed(6),
  };
}
module.exports = { calculateOperationCost, MODEL_VERSION };
