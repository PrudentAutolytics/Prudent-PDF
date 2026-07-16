/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT REDACT - premium.js (v36)
   Three micro-interactions, dependency-free and CSP-safe:
     1. Scroll reveal for elements carrying .reveal
     2. Count-up animation for KPI values carrying [data-countup]
     3. Cursor-tracked glow position on stat cards
   All respect prefers-reduced-motion. Nothing here touches data or APIs.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) document.documentElement.classList.add('premium-ready');

  /* ── 1. Scroll reveal ── */
  function initReveal() {
    var nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('reveal-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('reveal-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ── 2. KPI count-up ──
     An element opts in with data-countup. The runtime watches its text: when
     a plain number (optionally with $ , % .) lands in it, the value animates
     from zero once. Works with the existing renderStats without changing it. */
  function animateCount(el, finalText) {
    var m = String(finalText).match(/^([^0-9]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    var prefix = m[1], suffix = m[3];
    var target = parseFloat(m[2].replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    var decimals = (m[2].split('.')[1] || '').length;
    var useComma = m[2].indexOf(',') >= 0;
    var t0 = performance.now(), dur = 700;
    el.__counting = true;
    function frame(t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = (target * eased).toFixed(decimals);
      if (useComma) val = Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals });
      el.textContent = prefix + val + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = finalText; el.__counting = false; el.__counted = finalText; }
    }
    requestAnimationFrame(frame);
  }

  function initCountup() {
    var nodes = document.querySelectorAll('[data-countup]');
    if (!nodes.length || reduced || !('MutationObserver' in window)) return;
    nodes.forEach(function (el) {
      var mo = new MutationObserver(function () {
        var txt = el.textContent;
        if (el.__counting || el.__counted === txt) return;
        if (/\d/.test(txt)) animateCount(el, txt);
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
      if (/\d/.test(el.textContent) && el.textContent.trim() !== '0') animateCount(el, el.textContent);
    });
  }

  /* ── 3. Cursor-tracked glow on stat cards ── */
  function initGlow() {
    if (reduced) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target && e.target.closest ? e.target.closest('.stat-card') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    }, { passive: true });
  }

  /* -- 4. Workflow autoplay --
     Cycles the active state through [data-flow-step] cards once the section
     scrolls into view, pausing on hover or focus. Purely presentational:
     with reduced motion or no steps it does nothing. */
  function initFlow() {
    var steps = Array.prototype.slice.call(document.querySelectorAll('[data-flow-step]'));
    if (steps.length < 2 || reduced) return;
    var idx = -1, timer = null, paused = false;
    var board = steps[0].parentElement;
    function activate(n) {
      steps.forEach(function (s, i) { s.classList.toggle('active', i === n); });
      idx = n;
    }
    function tick() { if (!paused) activate((idx + 1) % steps.length); }
    function start() {
      if (timer) return;
      activate(0);
      timer = setInterval(tick, 3600);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { start(); io.disconnect(); } });
      }, { threshold: 0.35 });
      io.observe(board);
    } else { start(); }
    board.addEventListener('pointerenter', function () { paused = true; }, { passive: true });
    board.addEventListener('pointerleave', function () { paused = false; }, { passive: true });
    board.addEventListener('focusin', function () { paused = true; });
    board.addEventListener('focusout', function () { paused = false; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initReveal(); initCountup(); initGlow(); initFlow(); });
  } else { initReveal(); initCountup(); initGlow(); initFlow(); }
})();
