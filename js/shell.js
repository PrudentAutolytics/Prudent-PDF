/* ═══════════════════════════════════════
   PRUDENT PDF — Shell (topbar + sidebar)
   Shell.init('dashboard') on each page
═══════════════════════════════════════ */
const Shell = (() => {

  /* ── NAV CONFIG ───────────────────── */
  const NAV = [
    { group:'WORKSPACE', items:[
      { id:'dashboard', label:'Dashboard',       href:'/dashboard',     icon:'grid'    },
      { id:'upload',    label:'New Redaction',   href:'/dashboard',     icon:'upload', badge:'NEW' },
      { id:'history',   label:'Job History',     href:'/history',       icon:'clock',  badge:'30d' },
      { id:'viewer',    label:'Document Viewer', href:'/viewer',        icon:'eye'     },
    ]},
    { group:'ACCOUNT', items:[
      { id:'pricing', label:'Plans & Pricing', href:'/pricing', icon:'star'  },
      { id:'contact', label:'Contact Us',      href:'/contact', icon:'mail'  },
    ]},
  ];

  /* ── ICONS ────────────────────────── */
  const icons = {
    grid:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.75"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.75"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.75"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.75"/></svg>`,
    upload: `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    clock:  `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path d="M12 7v5l3.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`,
    eye:    `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.75"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/></svg>`,
    star:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mail:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.75"/><path d="M2 7l10 8 10-8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`,
    search: `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" stroke="currentColor" stroke-width="1.75"/><path d="M21 21l-4.5-4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`,
    sun:    `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.75"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`,
    bell:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    logout: `<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    spark:  `<svg width="12" height="12" fill="none" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    pdf:    `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#fff" stroke-width="2"/><path d="M14 2v6h6M9 13h6M9 17h4" stroke="#fff" stroke-width="1.75" stroke-linecap="round"/></svg>`,
  };

  /* ── BUILD TOPBAR ─────────────────── */
  function buildTopbar() {
    const s = Session.get() || {};
    const email = s.email || 'Kabileshvijayakumar@prudentautolytics.com';
    const initials = email.slice(0,1).toUpperCase();
    const shortEmail = email.length > 28 ? email.slice(0,25)+'…' : email;

    return `<div class="topbar">
  <!-- BRAND — replace .brand-logo contents with <img src="data:image/...base64..." /> -->
  <a class="topbar-brand" href="/dashboard">
    <div class="brand-logo" id="brandLogoSlot">
      ${icons.pdf}
    </div>
    <div>
      <div class="brand-name">Prudent PDF</div>
      <div class="brand-tagline">AI-Powered Redaction</div>
    </div>
  </a>
  <!-- SEARCH -->
  <div class="topbar-search">
    <span class="topbar-search-icon">${icons.search}</span>
    <input type="search" id="globalSearch" placeholder="Search jobs, files…" autocomplete="off"/>
    <span class="topbar-search-kbd">⌘K</span>
  </div>
  <!-- RIGHT ACTIONS -->
  <div class="topbar-right">
    <button class="topbar-icon-btn" id="themeBtn" title="Toggle theme">${icons.sun}</button>
    <button class="topbar-icon-btn" id="notifBtn" title="Notifications">
      ${icons.bell}
      <span class="notif-dot" id="notifDot" style="display:none"></span>
    </button>
    <div class="user-chip" id="userChip" title="${email}">
      <div class="user-avatar">${initials}</div>
      <span>${shortEmail}</span>
    </div>
  </div>
</div>`;
  }

  /* ── BUILD SIDEBAR ────────────────── */
  function buildSidebar(activeId) {
    const s = Session.get() || {};
    const used  = s.creditsUsed  ?? 0;
    const limit = s.creditsLimit ?? 5;
    const pct   = Math.min(100, Math.round(used / Math.max(1, limit) * 100));
    const fillCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
    const plan  = s.plan === 'paid' ? 'PRO PLAN' : 'FREE TRIAL';
    const daysLeft = s.trialExpiryDate
      ? Math.max(0, Math.ceil((new Date(s.trialExpiryDate) - Date.now()) / 86400000)) : 30;

    const navHtml = NAV.map(g => `
      <div class="nav-section">
        <span class="nav-group-label">${g.group}</span>
        ${g.items.map(item => {
          const active = item.id === activeId;
          const badge = item.badge
            ? `<span class="nav-link-badge ${active?'blue':''}">${item.badge}</span>` : '';
          return `<a class="nav-link${active?' active':''}" href="${item.href}">
            <span class="nav-link-icon">${icons[item.icon]||''}</span>
            ${item.label}
            ${badge}
          </a>`;
        }).join('')}
      </div>`).join('<div class="nav-sep"></div>');

    return `<div class="sidebar">
  ${navHtml}
  <div class="sidebar-bottom">
    <div class="plan-box">
      <div class="plan-tier">${icons.spark} ${plan}</div>
      <div class="plan-count">${used} <span>/ ${limit} files</span></div>
      <div class="plan-bar-track"><div class="plan-bar-fill ${fillCls}" id="planBarFill" style="width:${pct}%"></div></div>
      <div class="plan-meta">
        <span>${limit - used} remaining</span>
        <span>${s.plan==='paid' ? 'Unlimited' : `${daysLeft}d left`}</span>
      </div>
      ${s.plan !== 'paid' ? `<button class="btn-upgrade" onclick="location.href='/pricing'">⚡ Upgrade to Pro</button>` : ''}
    </div>
  </div>
</div>`;
  }

  /* ── INIT ─────────────────────────── */
  return {
    init(activeId) {
      if (!requireAuth()) return;
      const wrap = document.getElementById('appShell');
      if (!wrap) return;

      /* inject topbar */
      const tb = document.createElement('div');
      tb.innerHTML = buildTopbar();
      wrap.insertBefore(tb.firstElementChild, wrap.firstChild);

      /* inject sidebar */
      const sb = document.createElement('div');
      sb.innerHTML = buildSidebar(activeId);
      const main = wrap.querySelector('.main');
      wrap.insertBefore(sb.firstElementChild, main);

      /* theme */
      const saved = localStorage.getItem('pp_theme') ||
        (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', saved);
      document.getElementById('themeBtn')?.addEventListener('click', () => {
        const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', n);
        localStorage.setItem('pp_theme', n);
      });

      /* search */
      document.getElementById('globalSearch')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.value.trim())
          location.href = '/history?q=' + encodeURIComponent(e.target.value.trim());
      });

      /* user chip → sign out */
      document.getElementById('userChip')?.addEventListener('click', () => {
        if (confirm('Sign out of Prudent PDF?')) {
          Session.clear();
          location.href = '/login';
        }
      });

      /* refresh quota silently */
      const s = Session.get();
      if (s?.email && APP_CONFIG.FLOWS.QUOTA_GET) {
        paFetch(APP_CONFIG.FLOWS.QUOTA_GET, { email: s.email }).then(d => {
          if (d?.creditsUsed !== undefined) {
            Session.set({ ...s, creditsUsed: d.creditsUsed, creditsLimit: d.creditsLimit, plan: d.plan });
            const pct = Math.min(100, Math.round(d.creditsUsed / Math.max(1, d.creditsLimit) * 100));
            const el = document.getElementById('planBarFill');
            if (el) el.style.width = pct + '%';
          }
        }).catch(() => {});
      }
    }
  };
})();
