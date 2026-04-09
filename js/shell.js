/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT PDF — shell.js v7.2
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const Shell = (() => {

  const NAV = [
    {
      group : 'WORKSPACE',
      items : [
        { id: 'dashboard', label: 'Dashboard',        href: '/dashboard', icon: 'grid',    desc: 'Overview, stats, and quick upload' },
        { id: 'upload',    label: 'New Redaction',    href: '/dashboard#upload', icon: 'upload',  desc: 'Upload and process a PDF' },
        { id: 'history',   label: 'Job History',      href: '/history',   icon: 'clock',   desc: 'All processed jobs — last 30 days', badge: '30d' },
        { id: 'viewer',    label: 'Document Viewer',  href: '/viewer',    icon: 'eye',     desc: 'Side-by-side original vs redacted' },
      ],
    },
    {
      group : 'COMING SOON',
      items : [
        { id: 'compress', label: 'Compress PDF',  href: '#', icon: 'compress', desc: 'Reduce file size',            soon: true },
        { id: 'merge',    label: 'Merge PDFs',    href: '#', icon: 'merge',    desc: 'Combine multiple documents',  soon: true },
        { id: 'sign',     label: 'Sign PDF',      href: '#', icon: 'sign',     desc: 'Add digital signatures',      soon: true },
        { id: 'convert',  label: 'Convert PDF',   href: '#', icon: 'convert',  desc: 'PDF ↔ Word / Excel',         soon: true },
      ],
    },
    {
      group : 'ACCOUNT',
      items : [
        { id: 'pricing', label: 'Plans & Pricing', href: '/pricing', icon: 'star', desc: 'Compare plans and cost details' },
        { id: 'contact', label: 'Contact Us',      href: '/contact', icon: 'mail', desc: 'Talk to our team' },
      ],
    },
  ];

  const ICONS = {
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
    const initials = getInitials(email);
    const display  = getDisplayName(email);
    const isDark   = document.documentElement.getAttribute('data-theme') !== 'light';

    return `
<nav class="topbar" role="banner" aria-label="Top navigation">
  <a class="topbar-brand" href="/dashboard" aria-label="Prudent PDF home" style="display:flex;align-items:center;gap:12px;text-decoration:none;flex-shrink:0">
    <div style="width:42px;height:42px;border-radius:10px;overflow:hidden;flex-shrink:0;border:1.5px solid var(--border2);box-shadow:var(--s2)">
      <img src="/assets/logo.jpg" alt="Prudent Autolytics" style="width:100%;height:100%;object-fit:cover;display:block"/>
    </div>
    <div>
      <div class="brand-name" style="font-size:15px;font-weight:800;color:var(--ink);letter-spacing:-.3px;line-height:1.1">Prudent PDF</div>
      <div class="brand-tagline" style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--blue);margin-top:2px">Redaction Platform</div>
    </div>
  </a>

  <div class="topbar-search" role="search">
    <span class="topbar-search-icon" aria-hidden="true">${ICONS.search}</span>
    <input type="search" id="globalSearch" placeholder="Search jobs, files…" autocomplete="off" aria-label="Search jobs and files"/>
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
    const planLabel = s.plan === 'paid' ? 'PRO PLAN' : 'FREE TRIAL';

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

    const upgradeBtn = s.plan !== 'paid'
      ? `<button class="btn-upgrade" onclick="location.href='/pricing'">${ICONS.bolt} Upgrade to Pro</button>`
      : `<div class="flex-between mt-8"><span class="pill-paid">● Pro Active</span><span class="text-xs text-subtle">Unlimited</span></div>`;

    return `
<aside class="sidebar" role="navigation" aria-label="Main navigation">
  ${navHtml}
  <div class="sidebar-bottom">
    <div class="plan-box" role="region" aria-label="Usage quota">
      <div class="plan-tier">${ICONS.bolt} ${planLabel}</div>
      <div class="plan-count" id="sidebarUsed">${used}<span> / ${limit} files</span></div>
      <div class="plan-bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${pct}% of quota used">
        <div class="plan-bar-fill ${fillCls}" id="planBarFill" style="width:${pct}%"></div>
      </div>
      <div class="plan-meta">
        <span id="sidebarRemain">${remain} remaining</span>
        <span>${s.plan === 'paid' ? '∞ credits' : `${daysLeft}d left`}</span>
      </div>
      ${upgradeBtn}
    </div>
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

    // Append dropdown to body — avoids topbar overflow clipping
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

      // Fallback — search all jobs in history
      if (!results.find(r => r.href?.includes('history'))) {
        results.push({
          href: `/history?q=${encodeURIComponent(q)}`,
          label: `Search all jobs for "${q}"`,
          sub  : 'View full results in Job History',
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
        boxShadow:'var(--s4)', padding:'6px', minWidth:'190px',
        right:'18px', top:'68px', animation:'modalIn .14s ease',
      });
      menu.innerHTML = MENU_ITEMS.map(item => {
        if (item.sep) return `<div style="height:1px;background:var(--border);margin:4px 0"></div>`;
        return `<button role="menuitem" style="width:100%;text-align:left;padding:9px 12px;border-radius:var(--r8);font-size:13px;font-weight:500;font-family:var(--font);display:flex;align-items:center;gap:9px;color:${item.danger?'var(--red)':'var(--ink2)'};cursor:pointer;border:none;background:none;transition:background .12s" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">${item.icon} ${item.label}</button>`;
      }).join('');
      document.body.appendChild(menu);
      const btns = [...menu.querySelectorAll('button')];
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
    if (confirm('Sign out of Prudent PDF?')) { Session.clear(); location.replace('/login'); }
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
        };
        Session.set(updated);

        // Update greeting if fullName just arrived from Supabase
        const greetEl = document.getElementById('welcomeTitle');
        if (greetEl && updated.fullName) {
          const h = new Date().getHours();
          const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
          greetEl.textContent = `${greet}, ${updated.fullName} 👋`;
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
          showToast(`Only ${remain} credit${remain !== 1 ? 's' : ''} remaining — consider upgrading`, 'warn', 6000);
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

      // D → go to dashboard
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); location.href = '/dashboard'; return; }
    });
  }

  return {
    init(activeId) {
      if (!requireAuth()) return;
      applyTheme();
      // Inject favicon
      if (!document.querySelector('link[rel="icon"]')) {
        const link = document.createElement('link');
        link.rel = 'icon'; link.type = 'image/svg+xml'; link.href = '/favicon.svg';
        document.head.appendChild(link);
      }
      const wrap = document.getElementById('appShell');
      if (!wrap) { console.error('[Shell] #appShell not found.'); return; }
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
      requestAnimationFrame(() => { startClock(); setTimeout(refreshQuota, 1200); });
    },
    refreshQuota,
    NAV,
  };

})();