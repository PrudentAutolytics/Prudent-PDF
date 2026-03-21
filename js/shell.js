/* ═══════════════════════════════════════════════════════════════
   PRUDENT PDF — Premium Shell v5.1
   Pre-rendered placeholders in HTML, JS fills innerHTML.
   This prevents the CSS grid from collapsing before JS fires.
═══════════════════════════════════════════════════════════════ */
const Shell = (() => {

  const NAV = [
    { group:'WORKSPACE', items:[
      { id:'dashboard', label:'Dashboard',       href:'/dashboard', icon:'grid',   desc:'Overview & stats'    },
      { id:'upload',    label:'New Redaction',   href:'/dashboard', icon:'upload', desc:'Upload & process PDF' },
      { id:'history',   label:'Job History',     href:'/history',   icon:'clock',  desc:'All processed jobs',  badge:'30d' },
      { id:'viewer',    label:'Document Viewer', href:'/viewer',    icon:'eye',    desc:'Side-by-side viewer'  },
    ]},
    { group:'ACCOUNT', items:[
      { id:'pricing', label:'Plans & Pricing', href:'/pricing', icon:'star', desc:'Compare plans'    },
      { id:'contact', label:'Contact Us',      href:'/contact', icon:'mail', desc:'Talk to the team' },
    ]},
  ];

  const I = {
    grid:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/></svg>`,
    upload: `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    clock:  `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    eye:    `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>`,
    star:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mail:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M2 7l10 8 10-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    search: `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" stroke="currentColor" stroke-width="1.7"/><path d="M21 21l-4.5-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    moon:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sun:    `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    bell:   `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    shield: `<svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bolt:   `<svg width="12" height="12" fill="none" viewBox="0 0 24 24"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    pdf:    `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#fff" stroke-width="1.8"/><path d="M14 2v6h6M9 13h6M9 17h4" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    logout: `<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  function buildTopbar(activeId) {
    const s = Session.get() || {};
    const email = s.email || APP_CONFIG.APP.SUPPORT_EMAIL;
    const initials = email.slice(0,2).toUpperCase();
    const shortName = email.split('@')[0];
    const displayName = shortName.length > 18 ? shortName.slice(0,16)+'…' : shortName;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    return `
      <a class="topbar-brand" href="/dashboard">
        <div class="brand-logo" id="brandLogoSlot">${I.pdf}</div>
        <div>
          <div class="brand-name">Prudent PDF</div>
          <div class="brand-tagline">AI Redaction Platform</div>
        </div>
      </a>
      <div class="topbar-search">
        <span class="topbar-search-icon">${I.search}</span>
        <input type="search" id="globalSearch" placeholder="Search jobs, files, docs…" autocomplete="off"/>
        <span class="topbar-search-kbd">⌘K</span>
      </div>
      <div class="topbar-right">
        <div id="liveClock" style="font-family:var(--mono);font-size:11.5px;color:var(--ink3);padding:0 8px;white-space:nowrap;display:none"></div>
        <button class="topbar-icon-btn" id="themeBtn" title="Toggle theme">${isDark ? I.sun : I.moon}</button>
        <button class="topbar-icon-btn" id="notifBtn" title="Notifications">${I.bell}<span class="notif-dot hidden" id="notifDot"></span></button>
        <div class="user-chip" id="userChip" title="${email}" tabindex="0">
          <div class="user-avatar">${initials}</div>
          <span class="user-name">${displayName}</span>
        </div>
      </div>`;
  }

  function buildSidebar(activeId) {
    const s = Session.get() || {};
    const used   = s.creditsUsed  ?? 0;
    const limit  = s.creditsLimit ?? 5;
    const pct    = Math.min(100, limit > 0 ? Math.round(used / limit * 100) : 0);
    const remain = limit - used;
    const fillCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
    const planLabel = s.plan === 'paid' ? 'PRO PLAN' : 'FREE TRIAL';
    let daysLeft = 30;
    if (s.trialExpiryDate) daysLeft = Math.max(0, Math.ceil((new Date(s.trialExpiryDate) - Date.now()) / 86400000));

    const navHtml = NAV.map(group => `
      <div class="nav-section">
        <span class="nav-group-label">${group.group}</span>
        ${group.items.map(item => {
          const isActive = item.id === activeId;
          const badge = item.badge ? `<span class="nav-link-badge ${isActive?'blue':''}">${item.badge}</span>` : '';
          return `<a class="nav-link${isActive?' active':''}" href="${item.href}" title="${item.desc}">
            <span class="nav-link-icon">${I[item.icon]||''}</span>
            ${item.label}${badge}
          </a>`;
        }).join('')}
      </div>`).join('<div class="nav-sep"></div>');

    const upgradeBtn = s.plan !== 'paid'
      ? `<button class="btn-upgrade" onclick="location.href='/pricing'">${I.bolt} Upgrade to Pro</button>`
      : `<div class="flex-between mt-8"><span class="pill pill-paid" style="font-size:10px">● Pro Active</span><span class="text-xs text-subtle">Unlimited</span></div>`;

    return `
      ${navHtml}
      <div class="nav-sep"></div>
      <div class="sidebar-bottom">
        <div class="plan-box">
          <div class="plan-tier">${I.bolt} ${planLabel}</div>
          <div class="plan-count">${used}<span> / ${limit} files used</span></div>
          <div class="plan-bar-track">
            <div class="plan-bar-fill ${fillCls}" id="planBarFill" style="width:${pct}%"></div>
          </div>
          <div class="plan-meta">
            <span>${remain} remaining</span>
            <span>${s.plan==='paid'?'∞ credits':`${daysLeft}d left`}</span>
          </div>
          ${upgradeBtn}
        </div>
      </div>`;
  }

  function applyTheme() {
    const saved = localStorage.getItem('pp_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('themeBtn')?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pp_theme', next);
      document.getElementById('themeBtn').innerHTML = next === 'dark' ? I.sun : I.moon;
    });
  }

  function startClock() {
    const el = document.getElementById('liveClock');
    if (!el || window.innerWidth < 1200) return;
    el.style.display = 'block';
    const tick = () => { el.textContent = new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit',second:'2-digit'}); };
    tick(); setInterval(tick, 1000);
  }

  function initSearch() {
    document.getElementById('globalSearch')?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim().toLowerCase();
      if (!q) return;
      const match = NAV.flatMap(g => g.items).find(i => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
      location.href = match ? match.href : `/history?q=${encodeURIComponent(q)}`;
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); document.getElementById('globalSearch')?.focus(); }
    });
  }

  function initUserMenu() {
    document.getElementById('userChip')?.addEventListener('click', () => {
      let menu = document.getElementById('userMenu');
      if (menu) { menu.remove(); return; }
      menu = document.createElement('div');
      menu.id = 'userMenu';
      menu.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border2);border-radius:12px;box-shadow:var(--s4);padding:6px;min-width:180px;animation:modalIn .15s ease;right:20px;top:66px';
      const actions = [
        { label:'View Pricing',  fn: () => location.href='/pricing' },
        { label:'Contact Us',    fn: () => location.href='/contact' },
        { sep: true },
        { label:'Sign Out', danger:true, fn: () => { if(confirm('Sign out?')) { Session.clear(); location.href='/login'; } } },
      ];
      menu.innerHTML = actions.map(a => a.sep
        ? '<div style="height:1px;background:var(--border);margin:4px 0"></div>'
        : `<button style="width:100%;text-align:left;padding:9px 13px;border-radius:8px;font-family:var(--display);font-size:13px;font-weight:500;color:${a.danger?'var(--red)':'var(--ink)'};cursor:pointer;border:none;background:none;transition:background .12s" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">${a.label}</button>`
      ).join('');
      document.body.appendChild(menu);
      const btns = menu.querySelectorAll('button');
      actions.filter(a => !a.sep).forEach((a,i) => btns[i]?.addEventListener('click', () => { menu.remove(); a.fn(); }));
      setTimeout(() => document.addEventListener('click', function h(e) {
        if (!menu.contains(e.target) && e.target.id !== 'userChip') { menu.remove(); document.removeEventListener('click', h); }
      }, { capture: true }), 50);
    });
  }

  function refreshQuota() {
    const s = Session.get();
    if (!s?.email || !APP_CONFIG.FLOWS.QUOTA_GET) return;
    paFetch(APP_CONFIG.FLOWS.QUOTA_GET, { email: s.email }).then(d => {
      if (!d) return;
      const updated = { ...s, creditsUsed: d.creditsUsed ?? s.creditsUsed, creditsLimit: d.creditsLimit ?? s.creditsLimit, plan: d.plan ?? s.plan };
      Session.set(updated);
      const pct = Math.min(100, updated.creditsLimit > 0 ? Math.round(updated.creditsUsed / updated.creditsLimit * 100) : 0);
      const bar = document.getElementById('planBarFill');
      if (bar) { bar.style.width = pct + '%'; bar.className = 'plan-bar-fill ' + (pct>=90?'danger':pct>=70?'warn':''); }
      if (pct >= 90) { document.getElementById('notifDot')?.classList.remove('hidden'); showToast(`Only ${updated.creditsLimit-updated.creditsUsed} credits left`, 'warn', 5000); }
    }).catch(() => {});
  }

  return {
    init(activeId) {
      if (!requireAuth()) return;

      // Apply theme first — prevents flash
      const saved = localStorage.getItem('pp_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', saved);

      // Fill pre-rendered placeholders (these must exist in the HTML)
      const tb = document.getElementById('topbarPlaceholder');
      const sb = document.getElementById('sidebarPlaceholder');
      if (tb) tb.innerHTML = buildTopbar(activeId);
      if (sb) sb.innerHTML = buildSidebar(activeId);

      // Wire up
      applyTheme();
      startClock();
      initSearch();
      initUserMenu();

      // Quota after paint
      setTimeout(refreshQuota, 1000);

      // Escape closes overlays
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
          document.getElementById('userMenu')?.remove();
          document.body.style.overflow = '';
        }
      });
    }
  };
})();
