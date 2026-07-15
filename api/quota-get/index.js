'use strict';
const { getCorsHeaders, handleCors } = require('../cors');
const { verifySession }              = require('../auth');
const pool = require('../db');
const { isAdminUser } = require('../admin-access');

const PLAN_LIMITS = {
  trial        : { label:'Free Trial',    price:0,    filesPerMonth:5,      maxFileSizeMB:10,  maxPagesPerFile:50,    maxPagesPerMonth:50    },
  starter      : { label:'Starter',       price:19,   filesPerMonth:50,     maxFileSizeMB:25,  maxPagesPerFile:100,   maxPagesPerMonth:500   },
  professional : { label:'Professional',  price:79,   filesPerMonth:200,    maxFileSizeMB:50,  maxPagesPerFile:500,   maxPagesPerMonth:2000  },
  business     : { label:'Business',      price:399,  filesPerMonth:1000,   maxFileSizeMB:100, maxPagesPerFile:1000,  maxPagesPerMonth:10000 },
  enterprise   : { label:'Enterprise',    price:1499, filesPerMonth:999999, maxFileSizeMB:500, maxPagesPerFile:99999, maxPagesPerMonth:50000 },
};

module.exports = async function (context, req) {
  if (handleCors(context, req)) return;

  // ── Session auth ──
  const auth = await verifySession(req);
  if (!auth.ok) {
    context.res = { status: auth.status, headers: getCorsHeaders(req), body: { error: auth.error } };
    return;
  }

  // ENTERPRISE HARDENING: identity comes from the verified session.
  const email = auth.email;

  try {
    const result = await pool.query(`
      SELECT id, email, plan, credits_used, credits_limit,
             max_file_size_mb, max_pages_per_file, max_pages_per_month,
             trial_expiry_date, is_active, full_name, company
      FROM users WHERE email = $1
    `, [email]);

    const user = result.rows[0];
    if (!user) {
      context.res = { status: 404, headers: getCorsHeaders(req), body: { error: 'User not found.' } };
      return;
    }

    const isAdmin    = await isAdminUser(user.id, user.email);
    const plan       = user.plan || 'trial';
    const planDef    = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;

    // Use DB-stored limits if set, otherwise fall back to plan defaults
    const maxFileSizeMB    = user.max_file_size_mb    || planDef.maxFileSizeMB;
    const maxPagesPerFile  = user.max_pages_per_file  || planDef.maxPagesPerFile;
    const maxPagesPerMonth = user.max_pages_per_month || planDef.maxPagesPerMonth;
    const creditsLimit     = user.credits_limit       || planDef.filesPerMonth;
    const creditsUsed      = user.credits_used        || 0;
    const creditsRemaining = Math.max(0, creditsLimit - creditsUsed);

    context.res = {
      status  : 200,
      headers : getCorsHeaders(req),
      body    : {
        // User info
        email            : user.email,
        fullName         : user.full_name  || null,
        company          : user.company    || null,
        isActive         : user.is_active,
        isAdmin,

        // Plan
        plan,
        planLabel        : planDef.label,
        planPrice        : planDef.price,

        // Credits / file quota
        creditsUsed,
        creditsLimit,
        creditsRemaining,

        // Limits
        maxFileSizeMB,
        maxFileSizeBytes : maxFileSizeMB * 1024 * 1024,
        maxPagesPerFile,
        maxPagesPerMonth,

        // Trial
        trialExpiryDate  : user.trial_expiry_date || null,
      },
    };
  } catch (err) {
    context.log('quota-get ERROR:', err.message);
    context.res = { status: 500, headers: getCorsHeaders(req), body: { error: 'An internal error occurred. Please try again.' } };
  }
};