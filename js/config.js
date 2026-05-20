'use strict';

const APP_CONFIG = Object.freeze({

  FLOWS: {
    AUTH_CHECK   : '/api/auth-check',
    AUTH_REQUEST : '/api/auth-request',
    AUTH_VERIFY  : '/api/auth-verify',
    QUOTA_GET    : '/api/quota-get',
    JOB_SUBMIT   : '/api/jobs-submit',
    JOB_STATUS   : '/api/jobs-status',
    JOB_LIST     : '/api/jobs-list',
    CONTACT_SEND : '/api/contact-send',
    BLOB_SAS     : '/api/blob-sas',
    ADMIN_USERS  : '/api/admin',
    ADMIN_UPDATE : '/api/admin',
    ADMIN_CONTACTS: '/api/admin',
    ADMIN_APIKEYS: '/api/admin',
  },

  BLOB: {
    ACCOUNT      : 'redacta01f',
    CONTAINER_URL: 'https://redacta01f.blob.core.windows.net/prudent-uploads',
  },

  // Plan UI config — fetched from server on login, this is display-only fallback
  PLANS: {
    trial:        { label:'Free Trial',   price:0,    filesPerMonth:5,    maxFileSizeMB:10,  maxPagesPerFile:50,   creditsLimit:5    },
    starter:      { label:'Starter',      price:19,   filesPerMonth:50,   maxFileSizeMB:25,  maxPagesPerFile:100,  creditsLimit:50   },
    professional: { label:'Professional', price:79,   filesPerMonth:200,  maxFileSizeMB:50,  maxPagesPerFile:500,  creditsLimit:200  },
    business:     { label:'Business',     price:399,  filesPerMonth:1000, maxFileSizeMB:100, maxPagesPerFile:1000, creditsLimit:1000 },
    enterprise:   { label:'Enterprise',   price:1499, filesPerMonth:999999,maxFileSizeMB:500,maxPagesPerFile:99999,creditsLimit:999999},
  },

  UPLOAD: {
    MAX_MB      : 10,
    MAX_BYTES   : 10 * 1024 * 1024,
    ALLOWED_TYPE: 'application/pdf',
  },

  APP: {
    POLL_INTERVAL_MS : 5000,
    HISTORY_DAYS     : 30,
    MAX_JOB_HISTORY  : 50,
    UPLOAD_CONTAINER : 'prudent-uploads',
    RESULTS_CONTAINER: 'prudent-results',
  },

  TRIAL: { MAX_FILES: 5, DAYS: 30, MAX_SIZE_MB: 10 },
});

function getPlanLimits(plan) {
  return APP_CONFIG.PLANS[plan] || APP_CONFIG.PLANS.trial;
}

function getPlanMaxBytes(plan) {
  return getPlanLimits(plan).maxFileSizeMB * 1024 * 1024;
}

function calcJobCost(pageCount = 1, fileSizeMB = 0.1) {
  const pages = Math.max(1, pageCount);
  const azure = pages * 0.0115 * 1.20;
  const price = azure * 3.5;
  return {
    azureCost    : +azure.toFixed(6),
    productPrice : +price.toFixed(6),
    total        : +price.toFixed(6),
    totalFmt     : '$' + price.toFixed(2),
    productFmt   : '$' + price.toFixed(2),
    azureFmt     : '$' + azure.toFixed(2),
    docIntel     : +(pages * 0.0115).toFixed(6),
    blob         : +(fileSizeMB * 0.00002).toFixed(6),
    paFlow       : 0.0012,
    email        : 0.00014,
    breakdown    : {},
  };
}

const Session = (() => {
  const KEY = 'pp_session';
  return {
    set(data)   { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} },
    get()       { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
    clear()     { try { localStorage.removeItem(KEY); } catch {} },
    valid() {
      const s = this.get();
      if (!s || !s.email || !s.token) return false;
      if (s.expiresAt && Date.now() > s.expiresAt) { this.clear(); return false; }
      return true;
    },
    patch(patch) { const s = this.get(); if (s) this.set({ ...s, ...patch }); },
  };
})();

async function paFetch(url, body = {}, timeoutMs = 55_000) {
  if (!url) throw new Error('Endpoint not configured.');
  const session = Session.get();
  if (session?.token && !body.token) body = { ...body, token: session.token };
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
      signal : ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      let msg = `HTTP error ${res.status}.`;
      try { const e = await res.json(); msg = e.error || msg; } catch {}
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    if (!navigator.onLine) throw new Error('No internet connection.');
    throw err;
  }
}

async function paGet(url, params = {}, timeoutMs = 30_000) {
  return paFetch(url, params, timeoutMs);
}

function requireAuth() {
  const s = Session.get();
  if (!s || !s.email || !s.token) { window.location.replace('/login'); return false; }
  if (s.expiresAt && Date.now() > s.expiresAt) {
    Session.clear();
    try { sessionStorage.setItem('pp_expired', '1'); } catch {}
    window.location.replace('/login');
    return false;
  }
  return true;
}

if (!window._prudentFetchPatched) {
  window._prudentFetchPatched = true;
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const res = await _origFetch(...args);
    if (res.status === 401) {
      const url = (args[0] || '').toString();
      if (url.includes(window.location.hostname)) {
        Session.clear();
        try { sessionStorage.setItem('pp_expired', '1'); } catch {}
        window.location.replace('/login');
      }
    }
    return res;
  };
}

const fmt = {
  date(iso)     { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); },
  time(iso)     { if (!iso) return '—'; return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); },
  datetime(iso) { if (!iso) return '—'; return `${fmt.date(iso)}, ${fmt.time(iso)}`; },
  relative(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 10_000)    return 'just now';
    if (diff < 60_000)    return `${Math.floor(diff/1000)}s ago`;
    if (diff < 3600_000)  return `${Math.floor(diff/60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff/3600_000)}h ago`;
    return fmt.date(iso);
  },
  bytes(b)   { if (b == null) return '—'; if (b < 1024) return `${b} B`; if (b < 1_048_576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1_048_576).toFixed(2)} MB`; },
  mb(b)      { return b ? +(b/1_048_576).toFixed(3) : 0; },
  duration(ms){ if (!ms) return '—'; if (ms < 1000) return `${ms}ms`; if (ms < 60_000) return `${(ms/1000).toFixed(1)}s`; return `${Math.floor(ms/60_000)}m ${Math.floor((ms%60_000)/1000)}s`; },
  pages(n)   { return n === 1 ? '1 page' : `${n || 0} pages`; },
  usd(n)     { return n != null ? `$${Number(n).toFixed(2)}` : '—'; },
  trunc(str, max=40) { if (!str) return '—'; return str.length > max ? str.slice(0, max-1) + '…' : str; },
};

function showToast(message, type = 'info', duration = 3800) {
  const COLORS = { info:'var(--blue)', success:'var(--green)', warn:'var(--amber)', error:'var(--red)' };
  const ICONS  = { info:'●', success:'✓', warn:'⚠', error:'✕' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, { position:'fixed', bottom:'24px', right:'24px', zIndex:'9999', display:'flex', flexDirection:'column', gap:'8px', maxWidth:'380px' });
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const color = COLORS[type] || COLORS.info;
  Object.assign(toast.style, { display:'flex', alignItems:'flex-start', gap:'10px', padding:'12px 16px', borderRadius:'12px', background:'var(--surface)', border:`1px solid var(--border2)`, borderLeft:`3px solid ${color}`, boxShadow:'var(--s4)', fontFamily:'var(--font)', fontSize:'13px', color:'var(--ink)', animation:'toastIn .22s ease both', maxWidth:'380px', lineHeight:'1.55', wordBreak:'break-word' });
  toast.innerHTML = `<span style="color:${color};font-size:14px;flex-shrink:0;margin-top:1px">${ICONS[type]}</span><span>${message}</span>`;
  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style'); s.id = 'toast-style';
    s.textContent = `@keyframes toastIn{from{transform:translateX(12px);opacity:0}to{transform:none;opacity:1}}@keyframes toastOut{to{transform:translateX(16px);opacity:0}}`;
    document.head.appendChild(s);
  }
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'toastOut .28s ease forwards'; setTimeout(() => toast.remove(), 300); }, duration);
}

function exportCSV(rows, filename = 'export.csv') {
  if (!rows?.length) { showToast('No data to export', 'warn'); return; }
  const headers = Object.keys(rows[0]);
  const escape  = v => { const str = String(v ?? '').replace(/"/g, '""'); return /[,"\n\r]/.test(str) ? `"${str}"` : str; };
  const lines   = [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))];
  const blob    = new Blob(['\uFEFF' + lines.join('\r\n')], { type:'text/csv;charset=utf-8;' });
  const a       = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${rows.length} records`, 'success');
}

function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); });
}

async function sha256(file) {
  try { const buf=await file.arrayBuffer(); const hash=await crypto.subtle.digest('SHA-256',buf); return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join(''); } catch { return ''; }
}

function debounce(fn, wait=300) { let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args),wait); }; }
function throttle(fn, wait=300) { let last=0; return (...args) => { const now=Date.now(); if(now-last>=wait){last=now;fn(...args);} }; }
function fileToBase64(file) { return new Promise((resolve,reject) => { const r=new FileReader(); r.onload=()=>resolve(r.result.split(',')[1]); r.onerror=()=>reject(new Error('File read failed')); r.readAsDataURL(file); }); }
function greeting() { const h=new Date().getHours(); if(h>=5&&h<12) return 'Good morning'; if(h>=12&&h<17) return 'Good afternoon'; if(h>=17&&h<21) return 'Good evening'; return 'Working late'; }
function get(obj,...keys) { return keys.reduce((o,k)=>(o!=null?o[k]:undefined),obj); }
