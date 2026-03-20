/* ═══════════════════════════════════════════════════════
   PRUDENT PDF — Shell Renderer
   Injects topbar + sidebar into every page.
   Call: Shell.init('dashboard') etc.
═══════════════════════════════════════════════════════ */
const Shell = (() => {

  const NAV = [
    {
      group: 'Workspace',
      items: [
        { id:'dashboard', label:'Dashboard',    icon:iconGrid,    href:'/dashboard' },
        { id:'upload',    label:'New Redaction', icon:iconUpload,  href:'/dashboard#upload', badge:'', badgeCls:'' },
        { id:'history',   label:'Job History',   icon:iconHistory, href:'/history', badge:'30d', badgeCls:'' },
        { id:'viewer',    label:'Document Viewer',icon:iconEye,    href:'/viewer' },
      ]
    },
    {
      group: 'Account',
      items: [
        { id:'pricing', label:'Plans & Pricing', icon:iconStar, href:'/pricing' },
        { id:'contact', label:'Contact Us',       icon:iconMail, href:'/contact' },
      ]
    }
  ];

  function iconGrid()    { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>`; }
  function iconUpload()  { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  function iconHistory() { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`; }
  function iconEye()     { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`; }
  function iconStar()    { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  function iconMail()    { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M2 4l10 9 10-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`; }
  function iconSearch()  { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`; }
  function iconTheme()   { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`; }
  function iconBell()    { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  function iconLogout()  { return `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }

  function buildTopbar(activeId) {
    const s = Session.get() || {};
    const initials = (s.email || 'U').slice(0,1).toUpperCase();
    return `
    <div class="topbar">
      <a class="brand" href="/dashboard">
        <div class="brand-mark">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#fff" stroke-width="2" fill="none"/>
            <path d="M14 2v6h6M9 13h6M9 17h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>
        Prudent PDF
      </a>
      <div class="topbar-mid">
        <div class="global-search">
          <span class="search-icon">${iconSearch()}</span>
          <input type="search" id="globalSearch" placeholder="Search jobs, files…" autocomplete="off"/>
        </div>
      </div>
      <div class="topbar-right">
        <button class="icon-btn" id="themeToggle" title="Toggle theme">${iconTheme()}</button>
        <button class="icon-btn" id="notifBtn" title="Notifications">
          ${iconBell()}
          <span class="notif-dot" id="notifDot" style="display:none"></span>
        </button>
        <div class="user-chip" id="userChip" title="${s.email || ''}">
          <div class="user-avatar">${initials}</div>
          <span class="truncate" style="max-width:120px">${s.email || 'Guest'}</span>
        </div>
      </div>
    </div>`;
  }

  function buildSidebar(activeId) {
    const s = Session.get() || {};
    const used  = s.creditsUsed  ?? 0;
    const limit = s.creditsLimit ?? 5;
    const pct   = Math.min(100, Math.round(used / Math.max(1, limit) * 100));
    const fillCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
    const daysLeft = s.trialExpiryDate
      ? Math.max(0, Math.ceil((new Date(s.trialExpiryDate) - Date.now()) / 86400000))
      : 30;

    const navHTML = NAV.map(group => `
      <div class="nav-section">
        <span class="nav-group-label">${group.group}</span>
        ${group.items.map(item => {
          const isActive = item.id === activeId;
          const badge = item.badge ? `<span class="nav-badge ${item.badgeCls}">${item.badge}</span>` : '';
          return `<a class="nav-item ${isActive ? 'active' : ''}" href="${item.href}" data-navid="${item.id}">
            ${item.icon()} ${item.label} ${badge}
          </a>`;
        }).join('')}
      </div>
    `).join('');

    return `
    <div class="sidebar">
      ${navHTML}
      <div class="sidebar-footer">
        <div class="plan-card">
          <div class="plan-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>
            ${s.plan === 'paid' ? 'Pro Plan' : 'Free Trial'}
          </div>
          <div class="plan-files">${used} <span>/ ${limit} files</span></div>
          <div class="usage-track"><div class="usage-fill ${fillCls}" style="width:${pct}%"></div></div>
          <div class="plan-meta">
            <span>${limit - used} remaining</span>
            <span>${s.plan === 'paid' ? 'Unlimited' : `${daysLeft}d left`}</span>
          </div>
          ${s.plan !== 'paid' ? `<button class="btn-upgrade" onclick="window.location='/pricing'">
            ⚡ Upgrade to Pro
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }

  function initTheme() {
    const saved = localStorage.getItem('pp_theme') ||
      (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pp_theme', next);
    });
  }

  function initUserChip() {
    document.getElementById('userChip')?.addEventListener('click', () => {
      if (confirm('Sign out?')) {
        Session.clear();
        window.location.href = '/login';
      }
    });
  }

  function initGlobalSearch() {
    const inp = document.getElementById('globalSearch');
    if (!inp) return;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && inp.value.trim()) {
        window.location.href = `/history?q=${encodeURIComponent(inp.value.trim())}`;
      }
    });
  }

  return {
    init(activeId) {
      if (!requireAuth()) return;

      // Inject shell
      const wrap = document.getElementById('appShell');
      if (!wrap) return;

      const topbarEl = document.createElement('div');
      topbarEl.innerHTML = buildTopbar(activeId);
      wrap.insertBefore(topbarEl.firstElementChild, wrap.firstChild);

      // Sidebar goes before main
      const sidebarEl = document.createElement('div');
      sidebarEl.innerHTML = buildSidebar(activeId);
      const main = wrap.querySelector('.main');
      wrap.insertBefore(sidebarEl.firstElementChild, main);

      initTheme();
      initUserChip();
      initGlobalSearch();

      // Refresh quota in background
      const s = Session.get();
      if (s?.email) {
        paFetch(APP_CONFIG.FLOWS.QUOTA_GET, { email: s.email })
          .then(d => {
            if (d && d.creditsUsed !== undefined) {
              const updated = { ...s, creditsUsed: d.creditsUsed, creditsLimit: d.creditsLimit, plan: d.plan };
              Session.set(updated);
            }
          }).catch(() => {});
      }
    }
  };
})();
