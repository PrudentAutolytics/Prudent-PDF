/* ===========================================================================
   PRUDENT REDACT - public-shell.js (v43)
   Public header and footer for pages that are open to signed-out visitors
   (Plans and Pricing, Contact). Signed-in users keep the full app shell.
   Usage:  if (Session.valid()) { Shell.init('pricing'); } else { PublicShell.init('pricing'); }
   =========================================================================== */
'use strict';

const PublicShell = (() => {
  const LINKS = [
    { id: 'home',    label: 'Product', href: '/' },
    { id: 'pricing', label: 'Pricing', href: '/pricing' },
    { id: 'contact', label: 'Contact', href: '/contact' },
  ];

  function header(activeId) {
    const links = LINKS.map(l =>
      `<a class="pub-link${l.id === activeId ? ' active' : ''}" href="${l.href}"${l.id === activeId ? ' aria-current="page"' : ''}>${l.label}</a>`
    ).join('');
    return `
<header class="pub-header" role="banner">
  <div class="pub-header-inner">
    <a class="pub-logo" href="/" aria-label="Prudent Redact home"><img src="/assets/pa-logo-light.svg" alt="Prudent Autolytics"/></a>
    <nav class="pub-nav" aria-label="Main">${links}</nav>
    <div class="pub-actions">
      <a class="pub-signin" href="/login">Sign in</a>
      <a class="btn btn-primary btn-sm pub-cta" href="/login">Start free trial</a>
    </div>
  </div>
</header>`;
  }

  function footer() {
    const year = new Date().getFullYear();
    return `
<footer class="pub-footer" role="contentinfo">
  <div class="pub-footer-inner">
    <a href="/" aria-label="Prudent Redact home"><img src="/assets/pa-logo-light.svg" alt="Prudent Autolytics"/></a>
    <span>&copy; ${year} PRUDENT AUTOLYTICS LLP | Enterprise document privacy platform</span>
    <nav aria-label="Footer"><a href="/pricing">Pricing</a><a href="/contact">Contact</a><a href="/login">Sign in</a></nav>
  </div>
</footer>`;
  }

  return {
    init(activeId) {
      document.body.classList.add('public-mode');
      document.documentElement.setAttribute('data-theme', 'light');
      const wrap = document.getElementById('appShell');
      if (!wrap) return;
      wrap.insertAdjacentHTML('beforebegin', header(activeId));
      wrap.insertAdjacentHTML('afterend', footer());
    },
  };
})();
