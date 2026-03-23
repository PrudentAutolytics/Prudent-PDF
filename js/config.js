/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT PDF — config.js v7.0
   ─────────────────────────────────────────────────────────────────────────
   Single source of truth for:
     · Power Automate flow endpoints
     · Azure Blob config
     · Cost model
     · Trial plan limits
     · App constants
     · Session management (read/write localStorage)
     · HTTP wrapper (paFetch) with timeout + error classification
     · Auth guard (requireAuth)
     · Format helpers (dates, bytes, currency, duration)
     · Toast notification system
     · CSV export utility
     · Debounce / throttle helpers
   ─────────────────────────────────────────────────────────────────────────
   HOW TO UPDATE ENDPOINTS:
     Open this file, find the FLOWS section, paste your PA trigger URLs.
     That's the only file you ever touch for endpoint changes.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ── APP CONFIG ────────────────────────────────────────────────────────────── */
const APP_CONFIG = Object.freeze({

  /* ── Power Automate Flow Endpoints ──────────────────────────────────────── */
  FLOWS: {
    // ✅ Live
    AUTH_REQUEST : 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/23e2c998a84b4b73923ae583529f8e47/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QEyourHBk-W8NwSKhpj59GRmW85ij7UoVc0U_TX79rg',
    AUTH_VERIFY  : 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/23e2c998a84b4b73923ae583529f8e47/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QEyourHBk-W8NwSKhpj59GRmW85ij7UoVc0U_TX79rg',
    QUOTA_GET    : 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b3c15588b7594d4e834cc96ec1928dcb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=azighR_4vG-zfpQz4DNLFjaKciL19rLnePPtmYiQuKo',
    JOB_SUBMIT   : 'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f1b9fb734594602b3cdef26e0166ed6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7yVwfmA-5Aog_IJW3XN7Vz3uNnKcBE1NyoYwluTGlpc',

    // ⚠️  These need new PA flows — see README for schema
    JOB_STATUS   : '',   // POST { jobId, email }      → { status, resultUrl, … }
    JOB_LIST     : '',   // POST { email, days }        → [ job array ]
    CONTACT_SEND : '',   // POST { name, email, company, message, planInterest }
    BLOB_SAS     : '',   // POST { email, fileName }    → { sasUrl, blobPath }

    // ── Future capabilities (wire up when flows are built) ───────────────────
    // COMPRESS_JOB   : '',
    // MERGE_JOB      : '',
    // SPLIT_JOB      : '',
    // SIGN_JOB       : '',
    // CONVERT_JOB    : '',
    // PROTECT_JOB    : '',
    // WATERMARK_JOB  : '',
    // EXTRACT_JOB    : '',
  },

  /* ── Azure Blob ──────────────────────────────────────────────────────────── */
  BLOB: {
    CONTAINER_URL : 'https://YOUR_STORAGE.blob.core.windows.net/prudent-uploads',
  },

  /* ── Cost Model (per operation, USD) ─────────────────────────────────────── */
  COSTS: {
    DOC_INTEL_PER_PAGE  : 0.001,     // Azure Document Intelligence S0
    BLOB_PER_MB         : 0.00002,   // ~$0.02 / GB / month
    FUNCTIONS_PER_RUN   : 0.000002,  // negligible
    PA_FLOW_PER_RUN     : 0.0006,    // Standard connector
    SENDGRID_PER_EMAIL  : 0.00014,   // $14.95 / 100k
    OVERHEAD_MULTIPLIER : 1.20,      // 20 % buffer
  },

  /* ── Trial Plan ──────────────────────────────────────────────────────────── */
  TRIAL: {
    MAX_FILES    : 5,
    DAYS         : 30,
    MAX_SIZE_MB  : 50,
  },

  /* ── Upload constraints ──────────────────────────────────────────────────── */
  UPLOAD: {
    MAX_MB       : 50,
    MAX_BYTES    : 50 * 1024 * 1024,
    ALLOWED_TYPE : 'application/pdf',
  },

  /* ── App constants ───────────────────────────────────────────────────────── */
  APP: {
    NAME            : 'Prudent PDF',
    COMPANY         : 'Prudent Autolytics',
    TAGLINE         : 'AI-Powered Document Redaction',
    SUPPORT_EMAIL   : 'Kabileshvijayakumar@prudentautolytics.com',
    POLL_INTERVAL_MS: 5000,
    HISTORY_DAYS    : 30,
    MAX_JOB_HISTORY : 25,
  },
});


/* ── COST CALCULATOR ───────────────────────────────────────────────────────── */
/**
 * Estimate the processing cost for a single document.
 * @param {number} pageCount   Number of PDF pages
 * @param {number} fileSizeMB  File size in megabytes
 * @returns {{ docIntel, blob, functions, paFlow, email, subtotal, total, totalFmt }}
 */
function calcJobCost(pageCount = 1, fileSizeMB = 1) {
  const c = APP_CONFIG.COSTS;

  const docIntel  = pageCount   * c.DOC_INTEL_PER_PAGE;
  const blob      = fileSizeMB  * c.BLOB_PER_MB;
  const functions = c.FUNCTIONS_PER_RUN * 3; // submit + process + notify
  const paFlow    = c.PA_FLOW_PER_RUN   * 2; // submit + process flows
  const email     = c.SENDGRID_PER_EMAIL;
  const subtotal  = docIntel + blob + functions + paFlow + email;
  const total     = subtotal * c.OVERHEAD_MULTIPLIER;

  return {
    docIntel  : +docIntel .toFixed(6),
    blob      : +blob     .toFixed(6),
    functions : +functions.toFixed(6),
    paFlow    : +paFlow   .toFixed(6),
    email     : +email    .toFixed(6),
    subtotal  : +subtotal .toFixed(5),
    total     : +total    .toFixed(5),
    totalFmt  : '$' + total.toFixed(4),
  };
}


/* ── SESSION ────────────────────────────────────────────────────────────────── */
const Session = (() => {
  const KEY = 'pp_session';

  return {
    /**
     * Persist session data to localStorage.
     * @param {Object} data  { email, token, userId, plan, creditsUsed, creditsLimit, expiresAt, … }
     */
    set(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
    },

    /**
     * Read session from localStorage.
     * @returns {Object|null}
     */
    get() {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
    },

    /** Remove session from localStorage. */
    clear() {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    },

    /**
     * Check session validity (exists + not expired).
     * @returns {boolean}
     */
    valid() {
      const s = this.get();
      if (!s || !s.email || !s.token) return false;
      if (s.expiresAt && Date.now() > s.expiresAt) { this.clear(); return false; }
      return true;
    },

    /**
     * Merge partial data into the existing session without overwriting everything.
     * @param {Object} patch
     */
    patch(patch) {
      const s = this.get();
      if (s) this.set({ ...s, ...patch });
    },
  };
})();


/* ── HTTP WRAPPER ───────────────────────────────────────────────────────────── */
/**
 * POST to a Power Automate HTTP trigger with timeout + rich error messages.
 * @param {string}  url        PA flow trigger URL
 * @param {Object}  body       JSON request body
 * @param {number}  timeoutMs  Request timeout in milliseconds (default 55 s)
 * @returns {Promise<any>}     Parsed JSON or text response
 * @throws {Error}             Descriptive error for the calling UI
 */
async function paFetch(url, body = {}, timeoutMs = 55_000) {
  if (!url) throw new Error('Endpoint not configured. Please check your PA flow URLs in config.js.');

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(body),
      signal  : ctrl.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const status = res.status;
      if (status === 502)       throw new Error('The Power Automate flow returned 502. Verify the flow is enabled, not throttled, and the request body matches the trigger schema.');
      if (status === 504)       throw new Error('Gateway timeout (504). The flow took too long to respond — try again in a moment.');
      if (status === 408)       throw new Error('Request timeout (408). Power Automate did not respond in time — please retry.');
      if (status === 401)       throw new Error('Unauthorised (401). Your session may have expired — please sign in again.');
      if (status === 403)       throw new Error('Forbidden (403). You do not have permission to perform this action.');
      if (status === 429)       throw new Error('Rate limited (429). Too many requests — please wait a few seconds and try again.');
      throw new Error(`HTTP error ${status}. Check your PA flow configuration.`);
    }

    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. Power Automate flows can occasionally take longer than expected — please try again.`);
    }
    if (!navigator.onLine) {
      throw new Error('No internet connection detected. Please check your network and try again.');
    }
    throw err;
  }
}

/**
 * GET variant — wraps paFetch with method override for endpoints that use GET semantics.
 * Kept as POST for PA compatibility but named separately for clarity.
 */
async function paGet(url, params = {}, timeoutMs = 30_000) {
  return paFetch(url, params, timeoutMs);
}


/* ── AUTH GUARD ─────────────────────────────────────────────────────────────── */
/**
 * Redirect unauthenticated users to /login.
 * Call at the top of every protected page.
 * @returns {boolean} true if authenticated, false if redirected
 */
function requireAuth() {
  if (!Session.valid()) {
    window.location.replace('/login');
    return false;
  }
  return true;
}


/* ── FORMAT HELPERS ─────────────────────────────────────────────────────────── */
const fmt = {
  /** Format ISO date string → "12 Jan 2025" */
  date(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  /** Format ISO date string → "14:32" */
  time(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  },

  /** Format ISO date string → "12 Jan 2025, 14:32" */
  datetime(iso) {
    if (!iso) return '—';
    return `${fmt.date(iso)}, ${fmt.time(iso)}`;
  },

  /** Format timestamp into relative "2 min ago" / "just now" */
  relative(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 10_000)   return 'just now';
    if (diff < 60_000)   return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000)return `${Math.floor(diff / 3600_000)}h ago`;
    return fmt.date(iso);
  },

  /** Format bytes → "1.24 MB" */
  bytes(b) {
    if (b == null) return '—';
    if (b < 1024)       return `${b} B`;
    if (b < 1_048_576)  return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(2)} MB`;
  },

  /** Convert bytes → MB number */
  mb(b) { return b ? +(b / 1_048_576).toFixed(3) : 0; },

  /** Format milliseconds → "2.4s" or "1m 12s" */
  duration(ms) {
    if (!ms) return '—';
    if (ms < 1000)   return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  },

  /** "1 page" or "3 pages" */
  pages(n) { return n === 1 ? '1 page' : `${n} pages`; },

  /** "$0.0124" */
  usd(n) { return n != null ? `$${Number(n).toFixed(4)}` : '—'; },

  /** Truncate string with ellipsis */
  trunc(str, max = 40) {
    if (!str) return '—';
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  },
};


/* ── TOAST NOTIFICATIONS ─────────────────────────────────────────────────────── */
/**
 * Show a non-blocking toast notification.
 * @param {string} message   Notification text
 * @param {'info'|'success'|'warn'|'error'} type  Colour variant
 * @param {number} duration  Auto-dismiss ms (default 3 800)
 */
function showToast(message, type = 'info', duration = 3800) {
  const COLORS = {
    info   : 'var(--blue)',
    success: 'var(--green)',
    warn   : 'var(--amber)',
    error  : 'var(--red)',
  };
  const ICONS = {
    info   : '●',
    success: '✓',
    warn   : '⚠',
    error  : '✕',
  };

  // Container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Notifications');
    Object.assign(container.style, {
      position      : 'fixed',
      bottom        : '24px',
      right         : '24px',
      zIndex        : '9999',
      display       : 'flex',
      flexDirection : 'column',
      gap           : '8px',
      maxWidth      : '380px',
    });
    document.body.appendChild(container);
  }

  // Toast element
  const toast = document.createElement('div');
  const color = COLORS[type] || COLORS.info;
  Object.assign(toast.style, {
    display       : 'flex',
    alignItems    : 'flex-start',
    gap           : '10px',
    padding       : '12px 16px',
    borderRadius  : '12px',
    background    : 'var(--surface)',
    border        : `1px solid var(--border2)`,
    borderLeft    : `3px solid ${color}`,
    boxShadow     : 'var(--s4)',
    fontFamily    : 'var(--font)',
    fontSize      : '13px',
    color         : 'var(--ink)',
    animation     : 'toastIn .22s ease both',
    maxWidth      : '380px',
    lineHeight    : '1.55',
    wordBreak     : 'break-word',
  });

  toast.innerHTML = `
    <span style="color:${color};font-size:14px;flex-shrink:0;margin-top:1px">${ICONS[type]}</span>
    <span>${message}</span>
  `;

  // Inject animation style once
  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = `
      @keyframes toastIn  { from { transform:translateX(12px); opacity:0 } to { transform:none; opacity:1 } }
      @keyframes toastOut { to   { transform:translateX(16px); opacity:0 } }
    `;
    document.head.appendChild(s);
  }

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.style.animation = 'toastOut .28s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}


/* ── CSV EXPORT ─────────────────────────────────────────────────────────────── */
/**
 * Download an array of objects as a CSV file.
 * @param {Object[]} rows      Data rows (array of flat objects)
 * @param {string}   filename  Output filename (default: prudent-export.csv)
 */
function exportCSV(rows, filename = 'prudent-pdf-export.csv') {
  if (!rows || !rows.length) {
    showToast('No data to export', 'warn');
    return;
  }

  const headers = Object.keys(rows[0]);
  const escape  = v => {
    const str = String(v ?? '').replace(/"/g, '""');
    return /[,"\n\r]/.test(str) ? `"${str}"` : str;
  };

  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), {
    href     : URL.createObjectURL(blob),
    download : filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  showToast(`Exported ${rows.length} records`, 'success');
}


/* ── UTILITY HELPERS ────────────────────────────────────────────────────────── */

/**
 * Generate a UUID (uses crypto.randomUUID when available, falls back gracefully).
 * @returns {string}
 */
function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Compute SHA-256 of a File/Blob and return hex string.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
async function sha256(file) {
  try {
    const buf  = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/**
 * Debounce — delay fn execution until after `wait` ms of inactivity.
 * @param {Function} fn
 * @param {number}   wait
 * @returns {Function}
 */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/**
 * Throttle — guarantee fn is called at most once per `wait` ms.
 * @param {Function} fn
 * @param {number}   wait
 * @returns {Function}
 */
function throttle(fn, wait = 300) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn(...args); }
  };
}

/**
 * Convert a File to base64 string (data URI stripped of prefix).
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('File read failed'));
    r.readAsDataURL(file);
  });
}

/**
 * Greet the user based on current hour.
 * @returns {string} "Good morning", "Good afternoon", or "Good evening"
 */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Safely access nested object properties without throw.
 * @param {Object} obj
 * @param {...string} keys
 * @returns {*}
 */
function get(obj, ...keys) {
  return keys.reduce((o, k) => (o != null ? o[k] : undefined), obj);
}
