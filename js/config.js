/* ═══════════════════════════════════════════════════════
   PRUDENT PDF — Central Configuration
   Update PA flow URLs here. All other files import this.
═══════════════════════════════════════════════════════ */
const APP_CONFIG = {

  /* ── Power Automate Flow Endpoints ─────────────────── */
  FLOWS: {
    // ✅ Mapped from original single-file app
    AUTH_REQUEST:  'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/23e2c998a84b4b73923ae583529f8e47/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QEyourHBk-W8NwSKhpj59GRmW85ij7UoVc0U_TX79rg',
    AUTH_VERIFY:   'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/23e2c998a84b4b73923ae583529f8e47/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QEyourHBk-W8NwSKhpj59GRmW85ij7UoVc0U_TX79rg',
    QUOTA_GET:     'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b3c15588b7594d4e834cc96ec1928dcb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=azighR_4vG-zfpQz4DNLFjaKciL19rLnePPtmYiQuKo',
    JOB_SUBMIT:    'https://default8633bc1414464b1ab39b9eab02755c.9a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3774048e2c6f42c996f356fa7a2d8318/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=oSVQ7qsCqYuDr7nbOpC_ssEsLdvBqezL4BYU-_0-BnI',
    // ⚠️ These 4 need new PA flows to be built (see README):
    JOB_STATUS:    '',   // POST { jobId, email } → { status, resultUrl }
    JOB_LIST:      '',   // POST { email, days } → [ job array ]
    CONTACT_SEND:  '',   // POST { name, email, company, message, planInterest }
    BLOB_SAS:      '',   // POST { email, fileName } → { sasUrl, blobPath }
  },

  /* ── Azure Blob (upload direct from browser via SAS) ─ */
  BLOB: {
    CONTAINER_URL: 'https://YOUR_STORAGE.blob.core.windows.net/prudent-uploads',
  },

  /* ── Cost Model (per operation, USD) ────────────────── */
  COSTS: {
    DOC_INTELLIGENCE_PER_PAGE: 0.001,   // $1.50 per 1000 pages
    BLOB_STORAGE_PER_MB:       0.00002, // ~$0.02/GB
    FUNCTION_PER_RUN:          0.000002,// negligible
    PA_FLOW_PER_RUN:           0.0006,  // ~$0.60/1000 runs standard connector
    SENDGRID_PER_EMAIL:        0.00014, // $14.95/mo ÷ 100k
    OVERHEAD_MULTIPLIER:       1.2,     // 20% buffer
  },

  /* ── Trial Plan ──────────────────────────────────────── */
  TRIAL: {
    MAX_FILES:   5,
    DAYS:        30,
    MAX_SIZE_MB: 50,
  },

  /* ── App ─────────────────────────────────────────────── */
  APP: {
    NAME:           'Prudent PDF',
    TAGLINE:        'Intelligent PDF Redaction',
    SUPPORT_EMAIL:  'Kabileshvijayakumar@prudentautolytics.com',
    POLL_INTERVAL:  5000,   // ms — job status polling
    HISTORY_DAYS:   30,
  }
};

/* ── Cost Calculator ──────────────────────────────────── */
function calcJobCost(pageCount = 1, fileSizeMB = 1) {
  const c = APP_CONFIG.COSTS;
  const docIntel  = pageCount   * c.DOC_INTELLIGENCE_PER_PAGE;
  const blob      = fileSizeMB  * c.BLOB_STORAGE_PER_MB;
  const functions = c.FUNCTION_PER_RUN * 3;   // submit + process + notify
  const paFlow    = c.PA_FLOW_PER_RUN   * 2;   // submit + process flows
  const email     = c.SENDGRID_PER_EMAIL;
  const subtotal  = docIntel + blob + functions + paFlow + email;
  const total     = subtotal * c.OVERHEAD_MULTIPLIER;
  return {
    docIntel:  +docIntel.toFixed(5),
    blob:      +blob.toFixed(5),
    functions: +functions.toFixed(5),
    paFlow:    +paFlow.toFixed(5),
    email:     +email.toFixed(5),
    subtotal:  +subtotal.toFixed(5),
    total:     +total.toFixed(5),
    totalFmt:  '$' + total.toFixed(4),
  };
}

/* ── Session helpers ──────────────────────────────────── */
const Session = {
  KEY: 'pp_session',
  set(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },
  get()     { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch { return null; } },
  clear()   { localStorage.removeItem(this.KEY); },
  valid()   {
    const s = this.get();
    if (!s || !s.email || !s.token) return false;
    if (s.expiresAt && Date.now() > s.expiresAt) { this.clear(); return false; }
    return true;
  }
};

/* ── API wrapper ──────────────────────────────────────── */
async function paFetch(url, body, timeoutMs = 55000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      if (res.status === 502) throw new Error('Power Automate flow returned 502 — the flow may be paused, throttled, or the request body is invalid. Check your PA flow is enabled and the trigger is configured correctly.');
      if (res.status === 408 || res.status === 504) throw new Error('Flow timed out (HTTP ' + res.status + '). PA flows can take up to 30s — please try again.');
      throw new Error('HTTP ' + res.status);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out after 55s. Power Automate flows occasionally take longer — please try again.');
    throw e;
  }
}

/* ── Guard: redirect to login if not authenticated ────── */
function requireAuth() {
  if (!Session.valid()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

/* ── Format helpers ───────────────────────────────────── */
const fmt = {
  date(iso)  { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); },
  time(iso)  { return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); },
  datetime(iso) { return `${fmt.date(iso)}, ${fmt.time(iso)}`; },
  bytes(b)   { if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(2) + ' MB'; },
  mb(b)      { return (b / 1048576).toFixed(2); },
  duration(ms){ if (ms < 1000) return ms + 'ms'; if (ms < 60000) return (ms/1000).toFixed(1) + 's'; return Math.floor(ms/60000) + 'm ' + Math.floor((ms%60000)/1000) + 's'; },
  pages(n)   { return n === 1 ? '1 page' : `${n} pages`; },
};

/* ── Toast notifications ──────────────────────────────── */
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  const colors = { info:'#4f8ef7', success:'#10b981', warn:'#f0b429', error:'#f43f5e' };
  t.style.cssText = `
    display:flex;align-items:center;gap:10px;
    padding:12px 18px;border-radius:10px;
    background:var(--surface,#151d2e);
    border:1px solid var(--border,rgba(255,255,255,.07));
    border-left:3px solid ${colors[type]||colors.info};
    box-shadow:0 8px 32px rgba(0,0,0,.4);
    font-family:'Syne',sans-serif;font-size:13px;font-weight:500;
    color:var(--ink,#e8edf5);
    animation:slideIn .25s ease;max-width:340px;
  `;
  t.innerHTML = `<span>${msg}</span>`;
  const style = document.createElement('style');
  style.textContent = `@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`;
  document.head.appendChild(style);
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, duration);
}

/* ── CSV Export ───────────────────────────────────────── */
function exportCSV(rows, filename = 'prudent-pdf-export.csv') {
  if (!rows || !rows.length) { showToast('No data to export', 'warn'); return; }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '').replace(/"/g, '""');
      return /[,"\n]/.test(v) ? `"${v}"` : v;
    }).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast(`Exported ${rows.length} records`, 'success');
}
