/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT REDACT - shell.js v8.0
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const Shell = (() => {

  let currentActiveId = 'dashboard';

  const NAV = [
    {
      group : 'WORKSPACE',
      items : [
        { id: 'dashboard', label: 'Dashboard',        href: '/dashboard', icon: 'grid',    desc: 'Overview, stats, and quick upload' },
        { id: 'upload',    label: 'New Redaction',    href: '/dashboard#upload', icon: 'upload',  desc: 'Upload and process a PDF' },
        { id: 'history',   label: 'Processing History',      href: '/history',   icon: 'clock',   desc: 'Redaction jobs from the last 30 days', badge: '30d' },
        { id: 'viewer',    label: 'Document Viewer',  href: '/viewer',    icon: 'eye',     desc: 'Secure original and redacted PDF preview with integrity details' },
      ],
    },
    {
      group : 'COMING SOON',
      items : [
        { id: 'media-redaction', label: 'Media Redaction', href: '', icon: 'shield', desc: 'Image and video privacy workflows are in controlled preview', badge: 'Coming Soon', disabled: true },
      ],
    },
    {
      group : 'OPERATIONS',
      items : [
        { id: 'governance', label: 'Governance', href: '/governance', icon: 'shield', desc: 'Risk queue, SLA, policy health, and operator actions' },
      ],
    },
    {
      group : 'ACCOUNT',
      items : [
        { id: 'profile', label: 'My Profile', href: '/profile', icon: 'user', desc: 'Profile photo, name, email, and account settings' },
        { id: 'pricing', label: 'Plans & Pricing', href: '/pricing', icon: 'star', desc: 'Compare plans, limits, and cost details' },
        { id: 'contact', label: 'Contact Us',      href: '/contact', icon: 'mail', desc: 'Talk to our team' },
        // Administration is shown only when the session was issued with the
        // super_admin role returned by the server at OTP verification. The admin API independently enforces access, so
        // this controls visibility, not authorization.
        ...(String(Session.get()?.role || '').toLowerCase() === 'super_admin'
          ? [{ id: 'admin', label: 'Administration', href: '/admin', icon: 'settings', desc: 'Users, tenant access, plans, credits, and API keys' }]
          : []),
      ],
    },
  ];

  const ICONS = {
    user     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M4 21c.7-4.4 3.4-7 8-7s7.3 2.6 8 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    grid     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/></svg>`,
    upload   : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    clock    : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    eye      : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>`,
    compress : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    merge    : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M8 6H5a2 2 0 00-2 2v8a2 2 0 002 2h3M16 6h3a2 2 0 012 2v8a2 2 0 01-2 2h-3M12 3v18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sign     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    convert  : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    star     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mail     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M2 7l10 8 10-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    search   : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" stroke="currentColor" stroke-width="1.7"/><path d="M21 21l-4.5-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    moon     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sun      : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    bell     : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bolt     : `<svg width="12" height="12" fill="none" viewBox="0 0 24 24"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    logout   : `<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    star2    : `<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" stroke-width="1.7"/></svg>`,
    shield   : `<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.7"/></svg>`,
    tools    : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 015.3 4.9l-1.6-1.6-2.1.5-.5 2.1 1.6 1.6a4 4 0 01-4.9-5.3M11 13l-6.5 6.5a2.1 2.1 0 01-3-3L8 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    settings : `<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.7"/></svg>`,
  };

  /* ── Helper: get display name from email ── */
  function getDisplayName(email) {
    if (!email) return 'User';
    const local = email.split('@')[0];
    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  function getInitials(email) {
    if (!email) return 'U';
    const name  = getDisplayName(email);
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }

  /* ── Build topbar HTML ── */
  function buildTopbar(activeId) {
    const s        = Session.get() || {};
    const email    = s.email || '';
    const profileName = String(s.fullName || '').trim();
    const initials = getInitials(profileName || email);
    const display  = profileName || getDisplayName(email);
    const isDark   = document.documentElement.getAttribute('data-theme') !== 'light';

    return `
<nav class="topbar" role="banner" aria-label="Top navigation">
  <a class="topbar-brand" href="/dashboard" aria-label="Prudent Redact home" style="display:flex;align-items:center;gap:12px;text-decoration:none;flex-shrink:0">
    <div style="width:120px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;border:1px solid rgba(255,255,255,.10);background:#07111f">
      <img src="/assets/pa-logo.svg" alt="Prudent Autolytics" style="width:100%;height:100%;object-fit:contain;display:block;padding:3px;box-sizing:border-box"/>
    </div>
  </a>

  <div class="topbar-search" role="search">
    <span class="topbar-search-icon" aria-hidden="true">${ICONS.search}</span>
    <input type="search" id="globalSearch" placeholder="Search jobs, files..." autocomplete="off" aria-label="Search jobs and files"/>
    <span class="topbar-search-kbd" aria-hidden="true">⌘K</span>
  </div>

  <div class="topbar-right">
    <div id="liveClock" class="topbar-clock hidden" aria-live="off"></div>
    <button class="topbar-icon-btn" id="themeBtn" aria-label="Toggle colour theme" title="Toggle theme">
      ${isDark ? ICONS.sun : ICONS.moon}
    </button>
    <button class="topbar-icon-btn" id="notifBtn" aria-label="Notifications" title="Notifications">
      ${ICONS.bell}
      <span class="notif-dot hidden" id="notifDot" aria-label="New notification"></span>
    </button>
    <div class="user-chip" id="userChip" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" title="${email}">
      <div class="user-avatar" aria-hidden="true">${initials}</div>
      <span class="user-name">${display}</span>
    </div>
  </div>
</nav>`;
  }

  /* ── Build sidebar HTML ── */
  function buildSidebar(activeId) {
    const s      = Session.get() || {};
    const used   = s.creditsUsed  ?? 0;
    const limit  = s.creditsLimit ?? APP_CONFIG.TRIAL.MAX_FILES;
    const pct    = Math.min(100, limit > 0 ? Math.round(used / limit * 100) : 0);
    const remain = Math.max(0, limit - used);
    const fillCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
    const planLabel = s.planLabel || (s.plan && s.plan !== 'trial' ? s.plan.toUpperCase() : 'FREE TRIAL');

    let daysLeft = APP_CONFIG.TRIAL.DAYS;
    if (s.trialExpiryDate) {
      daysLeft = Math.max(0, Math.ceil((new Date(s.trialExpiryDate) - Date.now()) / 86_400_000));
    }

    const navHtml = NAV.map(group => {
      const items = group.items.map(item => {
        const isActive = item.id === activeId;
        if (item.soon) {
          return `<a class="nav-link" href="${item.href}" style="pointer-events:none;opacity:.45" title="${item.desc}" tabindex="-1" aria-disabled="true">
            <span class="nav-link-icon" aria-hidden="true">${ICONS[item.icon] || ''}</span>
            ${item.label}
            <span class="nav-badge-soon">Soon</span>
          </a>`;
        }
        const badge = item.badge ? `<span class="nav-link-badge${isActive ? ' blue' : ''}">${item.badge}</span>` : '';
        return `<a class="nav-link${isActive ? ' active' : ''}" href="${item.href}" title="${item.desc}"${isActive ? ' aria-current="page"' : ''}>
          <span class="nav-link-icon" aria-hidden="true">${ICONS[item.icon] || ''}</span>
          ${item.label}${badge}
        </a>`;
      }).join('');
      return `<div class="nav-section"><span class="nav-group-label">${group.group}</span>${items}</div><div class="nav-sep" role="separator"></div>`;
    }).join('');

    const upgradeBtn = `<button class="btn-upgrade" onclick="location.href='/pricing'">${ICONS.bolt} View plans and limits</button>`;

    return `
<aside class="sidebar" role="navigation" aria-label="Main navigation">
  <div class="sidebar-nav-scroll" data-sidebar-scroll>
    ${navHtml}
  </div>
  <div class="sidebar-footer">
    <div class="sidebar-bottom">
      <div class="plan-box" role="region" aria-label="Usage quota">
        <div class="plan-tier" id="sidebarPlanLabel">${ICONS.bolt} ${planLabel}</div>
        <div class="plan-count" id="sidebarUsed">${used}<span> / ${limit} files</span></div>
        <div class="plan-bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${pct}% of quota used">
          <div class="plan-bar-fill ${fillCls}" id="planBarFill" style="width:${pct}%"></div>
        </div>
        <div class="plan-meta">
          <span id="sidebarRemain">${remain} remaining</span>
          <span>${s.plan === 'paid' ? 'Unlimited' : `${daysLeft} days left`}</span>
        </div>
        ${upgradeBtn}
      </div>
    </div>
    <button class="sidebar-collapse-btn" type="button" aria-label="Collapse navigation"><span aria-hidden="true">‹</span></button>
  </div>
</aside>`;
  }

  function applyTheme() {
    const saved = localStorage.getItem('pp_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function wireThemeBtn() {
    document.getElementById('themeBtn')?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pp_theme', next);
      document.getElementById('themeBtn').innerHTML = next === 'dark' ? ICONS.sun : ICONS.moon;
    });
  }

  function startClock() {
    const el = document.getElementById('liveClock');
    if (!el || window.innerWidth < 1280) return;
    el.classList.remove('hidden');
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    tick();
    setInterval(tick, 1000);
  }

  function wireSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;

    // Append dropdown to body to avoid topbar overflow clipping
    const dropdown = document.createElement('div');
    dropdown.id = 'searchDropdown';
    Object.assign(dropdown.style, {
      position   : 'fixed',
      zIndex     : '9998',
      background : 'var(--surface)',
      border     : '1px solid var(--border2)',
      borderRadius : 'var(--r12)',
      boxShadow  : 'var(--s4)',
      maxHeight  : '340px',
      overflowY  : 'auto',
      display    : 'none',
      minWidth   : '320px',
    });
    document.body.appendChild(dropdown);

    function positionDropdown() {
      const rect = input.getBoundingClientRect();
      dropdown.style.top  = (rect.bottom + 6) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = Math.max(rect.width, 320) + 'px';
    }

    function closeDropdown() { dropdown.style.display = 'none'; }

    function showDropdown(results) {
      if (!results.length) { closeDropdown(); return; }
      dropdown.innerHTML = results.map(r => `
        <div class="search-result-item" data-href="${r.href}"
          style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s"
          onmouseover="this.style.background='var(--surface2)'"
          onmouseout="this.style.background='transparent'">
          <div style="flex-shrink:0;width:28px;height:28px;border-radius:6px;background:${r.color||'var(--blue-bg)'};display:grid;place-items:center;color:${r.iconColor||'var(--blue)'}">${r.icon}</div>
          <div style="min-width:0;flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
            <div style="font-size:11.5px;color:var(--ink3)">${r.sub}</div>
          </div>
          ${r.badge ? `<span style="flex-shrink:0;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${r.badgeBg};color:${r.badgeColor}">${r.badge}</span>` : ''}
        </div>`).join('');
      positionDropdown();
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => { closeDropdown(); location.href = el.dataset.href; });
      });
    }

    function search(q) {
      if (!q || q.length < 1) { closeDropdown(); return; }
      const results = [];

      // Search nav items
      const navItems = NAV.flatMap(g => g.items);
      navItems.filter(i => !i.soon && (i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)))
        .slice(0, 3)
        .forEach(i => results.push({
          href: i.href, label: i.label, sub: i.desc,
          icon: `<svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
          color: 'var(--blue-bg)', iconColor: 'var(--blue)',
        }));

      // Search recent jobs from localStorage / window cache
      try {
        const session = Session.get();
        const jobKey  = `pp_jobs_${session?.userId || session?.email || 'anon'}`;
        const jobs    = JSON.parse(localStorage.getItem(jobKey) || '[]');
        jobs.filter(j => j.fileName?.toLowerCase().includes(q))
          .slice(0, 4)
          .forEach(j => {
            const s = (j.status || '').toLowerCase();
            results.push({
              href      : `/viewer?jobId=${j.jobId}`,
              label     : j.fileName,
              sub       : `${s} · ${j.submittedAt ? new Date(j.submittedAt).toLocaleDateString('en-GB') : ''}`,
              icon      : `<svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.8"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8"/></svg>`,
              color     : s === 'complete' ? 'var(--green-bg)' : 'var(--surface2)',
              iconColor : s === 'complete' ? 'var(--green)' : 'var(--ink3)',
              badge     : s === 'complete' ? 'Complete' : s === 'queued' ? 'Queued' : s,
              badgeBg   : s === 'complete' ? 'var(--green-bg)' : 'var(--surface3)',
              badgeColor: s === 'complete' ? 'var(--green)' : 'var(--ink3)',
            });
          });
      } catch {}

      // Fallback search across processing history
      if (!results.find(r => r.href?.includes('history'))) {
        results.push({
          href: `/history?q=${encodeURIComponent(q)}`,
          label: `Search all jobs for "${q}"`,
          sub  : 'View full results in Processing History',
          icon : `<svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M21 21l-4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
          color: 'var(--surface2)', iconColor: 'var(--ink3)',
        });
      }

      showDropdown(results);
    }

    let searchTimer;
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => search(input.value.trim().toLowerCase()), 180);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        closeDropdown();
        if (q) location.href = `/history?q=${encodeURIComponent(q)}`;
      }
      if (e.key === 'Escape') { closeDropdown(); input.blur(); }
    });

    // ⌘K / Ctrl+K to focus
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); input.focus(); input.select(); }
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== input) closeDropdown();
    }, true);
  }

  function wireUserChip() {
    const chip = document.getElementById('userChip');
    if (!chip) return;
    const MENU_ITEMS = [
      { label: 'Profile & Settings', icon: ICONS.settings, fn: () => location.href = '/profile' },
      { label: 'View Pricing', icon: ICONS.star2,  fn: () => location.href = '/pricing' },
      { label: 'Contact Us',   icon: ICONS.mail,   fn: () => location.href = '/contact' },
      { sep: true },
      { label: 'Sign Out',     icon: ICONS.logout, fn: signOut, danger: true },
    ];
    chip.addEventListener('click', () => {
      let menu = document.getElementById('userMenu');
      if (menu) { closeMenu(menu); return; }
      chip.setAttribute('aria-expanded', 'true');
      menu = document.createElement('div');
      menu.id = 'userMenu';
      menu.setAttribute('role', 'menu');
      Object.assign(menu.style, {
        position:'fixed', zIndex:'9999', background:'var(--surface)',
        border:'1px solid var(--border2)', borderRadius:'var(--r12)',
        boxShadow:'var(--s4)', padding:'6px', minWidth:'232px',
        right:'18px', top:'68px', animation:'modalIn .14s ease',
      });
      // Identity header: avatar image (or initials), name, email, plan.
      const sess = Session.get() || {};
      const disp = String(sess.fullName || '').trim() || getDisplayName(sess.email || '');
      const plan = (sess.planLabel || sess.plan || 'Free trial');
      const avatarInner = sess.profilePicture
        ? `<img src="${sess.profilePicture}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`
        : getInitials(sess.fullName || sess.email || '');
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:11px;padding:11px 11px 12px;margin-bottom:4px;border-bottom:1px solid var(--border)';
      header.innerHTML = `
        <div style="width:40px;height:40px;flex:none;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--navy-d,#16294B),var(--blue));color:#fff;display:grid;place-items:center;font:800 15px var(--font-d,inherit)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${disp}</div>
          <div style="font-size:11px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sess.email || ''}</div>
          <div style="display:inline-flex;margin-top:4px;padding:2px 7px;border-radius:999px;background:var(--blue-bg,var(--blue-pale));color:var(--blue);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em">${plan}</div>
        </div>`;
      menu.appendChild(header);
      const list = document.createElement('div');
      list.innerHTML = MENU_ITEMS.map(item => {
        if (item.sep) return `<div style="height:1px;background:var(--border);margin:4px 0"></div>`;
        return `<button role="menuitem" style="width:100%;text-align:left;padding:9px 12px;border-radius:var(--r8);font-size:13px;font-weight:500;font-family:var(--font);display:flex;align-items:center;gap:9px;color:${item.danger?'var(--red)':'var(--ink2)'};cursor:pointer;border:none;background:none;transition:background .12s" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">${item.icon} ${item.label}</button>`;
      }).join('');
      menu.appendChild(list);
      document.body.appendChild(menu);
      const btns = [...list.querySelectorAll('button')];
      MENU_ITEMS.filter(i => !i.sep).forEach((item, idx) => {
        btns[idx]?.addEventListener('click', () => { closeMenu(menu); item.fn(); });
      });
      setTimeout(() => {
        document.addEventListener('click', function handler(e) {
          if (!menu.contains(e.target) && e.target !== chip) { closeMenu(menu); document.removeEventListener('click', handler); }
        }, { capture: true });
      }, 50);
    });
    chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') chip.click(); });
  }

  function closeMenu(menu) {
    document.getElementById('userChip')?.setAttribute('aria-expanded', 'false');
    menu.remove();
  }

  function signOut() {
    if (confirm('Sign out of Prudent Redact?')) { Session.clear(); location.replace('/login'); }
  }

  function syncProfileIdentity(session = Session.get() || {}) {
    const email = session.email || '';
    const name = String(session.fullName || '').trim();
    const display = name || getDisplayName(email);
    const chip = document.getElementById('userChip');
    const nameEl = chip?.querySelector('.user-name');
    const avatar = chip?.querySelector('.user-avatar');
    if (nameEl) nameEl.textContent = display;
    if (avatar) {
      avatar.textContent = '';
      if (session.profilePicture) {
        const img = document.createElement('img');
        img.src = session.profilePicture; img.alt = ''; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit';
        avatar.appendChild(img);
      } else avatar.textContent = getInitials(name || email);
    }
    if (chip) chip.title = email;
  }

  function refreshQuota() {
    const s = Session.get();
    if (!s?.email || !APP_CONFIG.FLOWS.QUOTA_GET) return;
    paFetch(APP_CONFIG.FLOWS.QUOTA_GET, { email: s.email })
      .then(data => {
        if (!data) return;
        // Store ALL plan limits in session so dashboard/upload modal can use them
        const updated = {
          ...s,
          creditsUsed      : data.creditsUsed      ?? s.creditsUsed,
          creditsLimit     : data.creditsLimit      ?? s.creditsLimit,
          creditsRemaining : data.creditsRemaining  ?? null,
          plan             : data.plan              ?? s.plan,
          planLabel        : data.planLabel         ?? s.planLabel,
          maxFileSizeMB    : data.maxFileSizeMB     ?? s.maxFileSizeMB,
          maxFileSizeBytes : data.maxFileSizeBytes  ?? s.maxFileSizeBytes,
          maxPagesPerFile  : data.maxPagesPerFile   ?? s.maxPagesPerFile,
          maxPagesPerMonth : data.maxPagesPerMonth  ?? s.maxPagesPerMonth,
          fullName         : data.fullName          ?? s.fullName,
          profilePicture   : data.profilePicture     ?? s.profilePicture,
          role             : String(data.role || s.role || 'user').toLowerCase(),
          isAdmin          : data.isAdmin === true,
        };
        const priorAdmin = Session.get()?.isAdmin === true;
        Session.set(updated);
        syncProfileIdentity(updated);
        if (priorAdmin !== (updated.isAdmin === true)) {
          location.reload();
          return;
        }

        // Update greeting when the profile name is refreshed
        const greetEl = document.getElementById('welcomeTitle');
        if (greetEl && updated.fullName) {
            greetEl.textContent = `${greeting()}, ${updated.fullName} 👋`;
        }

        const used    = updated.creditsUsed  ?? 0;
        const limit   = updated.creditsLimit ?? APP_CONFIG.TRIAL.MAX_FILES;
        const pct     = Math.min(100, limit > 0 ? Math.round(used / limit * 100) : 0);
        const remain  = Math.max(0, limit - used);
        const fillCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';

        const bar = document.getElementById('planBarFill');
        if (bar) { bar.style.width = pct + '%'; bar.className = 'plan-bar-fill ' + fillCls; bar.parentElement?.setAttribute('aria-valuenow', pct); }

        const usedEl   = document.getElementById('sidebarUsed');
        const remainEl = document.getElementById('sidebarRemain');
        if (usedEl)   usedEl.innerHTML    = `${used}<span> / ${limit} files</span>`;
        if (remainEl) remainEl.textContent = `${remain} remaining`;

        // Update plan label in sidebar
        const planLabelEl = document.getElementById('sidebarPlanLabel');
        if (planLabelEl) planLabelEl.textContent = updated.planLabel || updated.plan || 'Free Trial';

        if (pct >= 90) {
          document.getElementById('notifDot')?.classList.remove('hidden');
          showToast(`Only ${remain} credit${remain !== 1 ? 's' : ''} remaining. Review your plan limits.`, 'warn', 6000);
        }
      })
      .catch(() => {});
  }

  function wireEscape() {
    document.addEventListener('keydown', e => {
      // Skip if typing in an input
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-bg.open').forEach(m => { m.classList.remove('open'); document.body.style.overflow = ''; });
        const menu = document.getElementById('userMenu');
        if (menu) closeMenu(menu);
        return;
      }

      if (isInput) return;

      // N → open New Redaction modal
      if (e.key === 'n' || e.key === 'N') {
        const btn = document.getElementById('openUploadBtn');
        if (btn) { e.preventDefault(); btn.click(); return; }
        // If not on dashboard, navigate there
        if (!location.pathname.includes('dashboard')) location.href = '/dashboard';
        return;
      }

      // H → go to history
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); location.href = '/history'; return; }

      // V → go to viewer
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); location.href = '/viewer'; return; }

      // G → governance command center
      if (e.key === 'g' || e.key === 'G') { e.preventDefault(); location.href = '/governance'; return; }

      // D → go to dashboard
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); location.href = '/dashboard'; return; }
    });
  }


  /* ── Contextual information buttons ───────────────────────────────────── */
  const INFO_COPY = {
    'dashboard':'A live operational summary of redaction activity, usage, processing health, and your quickest next actions.',
    'new redaction':'Upload a PDF for the existing Power Automate redaction workflow. File and page limits follow the active plan.',
    'processing history':'Search and investigate recent redaction jobs, their state, duration, output, and failure context.',
    'document viewer':'Inspect original and redacted outputs using the protected in-browser PDF preview and document integrity details.',
    'governance command':'Prioritises failures, stuck jobs, SLA exposure, configuration health, and operational concentration from live platform data.',
    'administration':'Restricted administration for users, access, plans, credits, API keys, and enterprise configuration capabilities.',
    'success rate':'Percentage of completed jobs that finished successfully within the selected governance window.',
    'critical failures':'Jobs in a failed state that require operator investigation or workflow remediation.',
    'stuck processing':'Queued or processing jobs that have exceeded the governance age threshold and may need intervention.',
    'p95 turnaround':'95% of measured jobs complete at or below this duration. Useful for detecting tail-latency degradation.',
    'sla exposure':'Jobs that exceeded the current operational processing target. This is an internal control indicator, not a contractual SLA unless separately agreed.',
    'priority risk queue':'A ranked work queue built from failed, stuck, and slow jobs so operators can focus on the highest operational risk first.',
    'control posture':'Configuration-presence checks for critical platform dependencies. Secrets are never displayed by the health endpoint.',
    'administrative evidence':'Privileged administrative actions recorded in the available audit store. Coverage depends on backend audit persistence.',
    'release readiness':'Reviewer-side quality checks across document availability, integrity, entity metadata, and review decisions.',
    'sha-256':'A cryptographic fingerprint calculated from the loaded PDF bytes to help identify unexpected document changes.',
    'confidence':'The model-provided confidence for a detected entity. Lower-confidence detections deserve additional human scrutiny.',
    'credits':'Processing allowance tracked for the current account or plan.',
    'api key':'A credential for approved programmatic access. Plaintext keys should be shown once and stored securely.',
    'plan':'Controls commercial limits and available processing capacity for the user.',
    'active users':'Users whose account is not explicitly disabled.',
    'contact requests':'Secure enquiries submitted through the product contact workflow.',
    'page count':'Estimated or recorded PDF page volume associated with a redaction job.',
    'cost':'Processing cost context derived from available job cost fields; use it for operational analysis rather than formal invoicing without reconciliation.'
  };

  function helpText(label) {
    const key=(label||'').toLowerCase().replace(/\s+/g,' ').trim();
    if (INFO_COPY[key]) return INFO_COPY[key];
    for (const [k,v] of Object.entries(INFO_COPY)) if (key.includes(k)) return v;
    if (key.includes('email')) return 'The work email associated with the account or request. Sensitive recipient routing is handled by the backend and is not exposed here.';
    if (key.includes('status')) return 'The current operational state recorded for this item. Use the surrounding page to investigate transitions and exceptions.';
    if (key.includes('risk')) return 'An operational prioritisation signal used to surface items that need attention. It is not a legal or regulatory determination.';
    if (key.includes('audit') || key.includes('evidence')) return 'Evidence intended to support investigation and internal control review. Immutable audit guarantees require persistent server-side audit storage.';
    if (key.includes('security') || key.includes('control')) return 'A platform control or configuration indicator. The interface avoids exposing secret values.';
    if (key.includes('upload') || key.includes('file')) return 'Document input handled by the secure processing workflow. Only supported PDF files within plan limits should be submitted.';
    return `Information about “${label}”. This control or metric is part of the Prudent Redact operating workspace and should be interpreted in the context of the current page.`;
  }

  function showHelp(btn) {
    let tip=document.getElementById('globalInfoTooltip');
    if (!tip) { tip=document.createElement('div'); tip.id='globalInfoTooltip'; tip.className='info-help-tooltip'; document.body.appendChild(tip); }
    const label=btn.dataset.infoLabel||'Information';
    tip.replaceChildren(); const strong=document.createElement('strong'); strong.textContent=label; const copy=document.createElement('span'); copy.textContent=btn.dataset.infoText||helpText(label); tip.append(strong,copy);
    const r=btn.getBoundingClientRect();
    tip.style.left=Math.max(16,Math.min(window.innerWidth-346,r.left-150+r.width/2))+'px';
    tip.style.top=Math.min(window.innerHeight-tip.offsetHeight-18,r.bottom+9)+'px';
    requestAnimationFrame(()=>tip.classList.add('show'));
  }
  function hideHelp(){ document.getElementById('globalInfoTooltip')?.classList.remove('show'); }

  function injectInfoHelp(root=document) {
    const selectors=[
      '.page-title','.section-title','.card-title','.panel-title','.modal-title',
      '.stat-label','.metric-label','.kpi-label','.contact-info-label',
      'label:not(.switch):not(.checkbox-label)', '.tab-btn','.viewer-tab','.gov-label',
      '.control-title','.risk-title','.admin-kpi-label','.sla-label'
    ];
    root.querySelectorAll(selectors.join(',')).forEach(el=>{
      if (el.dataset.infoEnhanced==='1' || el.closest('.topbar-search') || el.closest('.topbar') || el.closest('.sidebar') || el.closest('.info-help-tooltip')) return;
      const label=(el.textContent||'').replace(/\s+/g,' ').trim();
      if (!label || label.length>85 || /^[\d\W]+$/.test(label)) return;
      el.dataset.infoEnhanced='1';
      const btn=document.createElement('button');
      btn.type='button'; btn.className='info-help-btn'; btn.textContent='i';
      btn.dataset.infoLabel=label; btn.dataset.infoText=helpText(label);
      btn.setAttribute('aria-label',`Information about ${label}`);
      btn.addEventListener('mouseenter',()=>showHelp(btn));
      btn.addEventListener('mouseleave',hideHelp);
      btn.addEventListener('focus',()=>showHelp(btn));
      btn.addEventListener('blur',hideHelp);
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showHelp(btn);});
      el.appendChild(btn);
    });
  }

  function startInfoObserver() {
    injectInfoHelp();
    let queued=false;
    const observer=new MutationObserver(()=>{
      if (queued) return; queued=true;
      requestAnimationFrame(()=>{queued=false;injectInfoHelp();});
    });
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('scroll',hideHelp,true);
    window.addEventListener('resize',hideHelp);
  }

  return {
    init(activeId) {
      currentActiveId = activeId || 'dashboard';
      if (!requireAuth()) return;
      applyTheme();
      // Inject favicon
      if (!document.querySelector('link[rel="icon"]')) {
        const link = document.createElement('link');
        link.rel = 'icon'; link.type = 'image/svg+xml'; link.href = '/favicon.svg';
        document.head.appendChild(link);
      }
      const wrap = document.getElementById('appShell');
      if (!wrap) { return; }
      const tbEl = document.createElement('div');
      tbEl.innerHTML = buildTopbar(activeId);
      wrap.insertBefore(tbEl.firstElementChild, wrap.firstChild);
      const sbEl = document.createElement('div');
      sbEl.innerHTML = buildSidebar(activeId);
      const main = wrap.querySelector('.main') || wrap.querySelector('main');
      wrap.insertBefore(sbEl.firstElementChild, main);
      wireThemeBtn();
      wireSearch();
      wireUserChip();
      wireEscape();
      requestAnimationFrame(() => { startClock(); startInfoObserver(); setTimeout(refreshQuota, 1200); });
    },
    refreshQuota,
    syncProfileIdentity,
    NAV,
  };

})();