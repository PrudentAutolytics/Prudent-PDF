/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT REDACT - charts.js
   Dependency-free analytics charts for the operations dashboard.

   WHY NO CHART LIBRARY
   The Content Security Policy is script-src 'self'. Pulling in Chart.js or
   similar from a CDN would either violate the policy or require vendoring a
   large bundle. These charts are hand-built SVG: a few hundred lines, no
   dependency, theme-aware, and accessible. They render from the same real
   job and operation data the KPI cards already use. No data is invented.

   EVERY chart degrades to an honest empty state when there is nothing to show.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const Charts = (() => {

  const NS = 'http://www.w3.org/2000/svg';

  /* Resolve a CSS custom property to a concrete colour so SVG gradients and
     fills work, and so the value re-resolves correctly under the dark theme. */
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function palette() {
    return {
      blue   : cssVar('--blue', '#2E75B6'),
      blueL  : cssVar('--blue-l', '#4A8CC7'),
      green  : cssVar('--green', '#059669'),
      amber  : cssVar('--amber', '#D97706'),
      red    : cssVar('--red', '#DC2626'),
      violet : cssVar('--violet', '#7C3AED'),
      ink    : cssVar('--ink', '#16233B'),
      ink3   : cssVar('--ink3', '#64748B'),
      grid   : cssVar('--border', '#E3E8F0'),
      surface: cssVar('--surface', '#FFFFFF'),
    };
  }

  function el(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(container) { while (container.firstChild) container.removeChild(container.firstChild); }

  function emptyState(container, message) {
    clear(container);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;min-height:150px;color:var(--ink3);font-size:12.5px;text-align:center;padding:20px;line-height:1.6';
    wrap.textContent = message;
    container.appendChild(wrap);
  }

  /* ── DONUT: status distribution ───────────────────────────────────────── */
  /* segments: [{ label, value, color }] */
  function donut(container, segments, centerLabel, centerSub) {
    clear(container);
    const data = segments.filter(s => s.value > 0);
    const total = data.reduce((a, s) => a + s.value, 0);
    if (!total) { emptyState(container, 'No jobs in the selected period yet.'); return; }

    const size = 168, stroke = 26, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;

    const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img',
      'aria-label': `Status distribution: ${data.map(s => `${s.label} ${s.value}`).join(', ')}` });
    svg.style.cssText = 'flex:none';

    // Track ring
    svg.appendChild(el('circle', { cx, cy, r, fill: 'none', stroke: cssVar('--surface2', '#F8F9FC'), 'stroke-width': stroke }));

    let offset = 0;
    data.forEach(seg => {
      const frac = seg.value / total;
      const dash = frac * circumference;
      const arc = el('circle', {
        cx, cy, r, fill: 'none', stroke: seg.color, 'stroke-width': stroke,
        'stroke-dasharray': `${dash} ${circumference - dash}`,
        'stroke-dashoffset': -offset,
        transform: `rotate(-90 ${cx} ${cy})`,
        'stroke-linecap': 'butt',
      });
      arc.style.transition = 'stroke-dasharray .6s ease';
      svg.appendChild(arc);
      offset += dash;
    });

    // Center label
    svg.appendChild(el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': '26', 'font-weight': '800', fill: cssVar('--ink', '#16233B'), 'font-family': cssVar('--font-d', 'inherit') }, centerLabel));
    if (centerSub) svg.appendChild(el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': '10.5', 'font-weight': '600', fill: cssVar('--ink3', '#64748B') }, centerSub));

    // Layout: donut + legend
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:22px;flex-wrap:wrap;justify-content:center';
    wrap.appendChild(svg);

    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;flex-direction:column;gap:9px;min-width:0';
    data.forEach(seg => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:9px;font-size:12.5px';
      const dot = document.createElement('span');
      dot.style.cssText = `width:10px;height:10px;border-radius:3px;background:${seg.color};flex:none`;
      const lab = document.createElement('span');
      lab.style.cssText = 'color:var(--ink2);font-weight:600';
      lab.textContent = seg.label;
      const val = document.createElement('span');
      val.style.cssText = 'color:var(--ink3);margin-left:auto;font-variant-numeric:tabular-nums';
      val.textContent = `${seg.value} (${Math.round(seg.value / total * 100)}%)`;
      row.append(dot, lab, val);
      legend.appendChild(row);
    });
    wrap.appendChild(legend);
    container.appendChild(wrap);
  }

  /* ── GROUPED BARS: daily volume ───────────────────────────────────────── */
  /* days: [{ label, values: { complete, failed, processing } }] */
  function stackedBars(container, days, series) {
    clear(container);
    const hasData = days.some(d => Object.values(d.values).some(v => v > 0));
    if (!hasData) { emptyState(container, 'No activity recorded in this window yet.'); return; }

    const W = 640, H = 220, padL = 34, padR = 12, padT = 14, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxVal = Math.max(1, ...days.map(d => Object.values(d.values).reduce((a, b) => a + b, 0)));
    const niceMax = niceCeil(maxVal);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: 'auto', preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': `Daily volume over ${days.length} days, peak ${maxVal}` });
    svg.style.cssText = 'display:block';

    const pal = palette();

    // Y gridlines + labels
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round(niceMax / ticks * i);
      const y = padT + plotH - (val / niceMax) * plotH;
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: pal.grid, 'stroke-width': 1, 'stroke-dasharray': i === 0 ? '0' : '3 3', opacity: i === 0 ? 1 : 0.55 }));
      svg.appendChild(el('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', 'font-size': '9.5', fill: pal.ink3 }, String(val)));
    }

    const slot = plotW / days.length;
    const barW = Math.min(26, slot * 0.62);

    days.forEach((d, i) => {
      const x = padL + slot * i + (slot - barW) / 2;
      let yCursor = padT + plotH;
      series.forEach(s => {
        const v = d.values[s.key] || 0;
        if (v <= 0) return;
        const h = (v / niceMax) * plotH;
        yCursor -= h;
        const rect = el('rect', { x, y: yCursor, width: barW, height: h, fill: s.color(pal), rx: 2 });
        const t = el('title', {}, `${d.label}: ${v} ${s.label}`);
        rect.appendChild(t);
        svg.appendChild(rect);
      });
      // X label every Nth to avoid crowding
      if (days.length <= 15 || i % 2 === 0) {
        svg.appendChild(el('text', { x: x + barW / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': '9', fill: pal.ink3 }, d.label));
      }
    });

    container.appendChild(svg);
    // Legend
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:10px';
    series.forEach(s => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink2)';
      const dot = document.createElement('span');
      dot.style.cssText = `width:9px;height:9px;border-radius:2px;background:${s.color(palette())};flex:none`;
      item.append(dot, document.createTextNode(s.label));
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  /* ── AREA LINE: cumulative trend ──────────────────────────────────────── */
  /* points: [{ label, value }]  formatY: fn */
  function areaLine(container, points, formatY) {
    clear(container);
    if (!points.length || points.every(p => p.value === 0)) { emptyState(container, 'No cost recorded in this window yet.'); return; }

    const W = 640, H = 200, padL = 44, padR = 14, padT = 14, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxVal = niceCeil(Math.max(...points.map(p => p.value)) || 1);
    const pal = palette();

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: 'auto', preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': `Cumulative trend, latest ${formatY(points[points.length - 1].value)}` });
    svg.style.cssText = 'display:block';

    // Gradient
    const defs = el('defs');
    const grad = el('linearGradient', { id: 'areaGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': pal.blue, 'stop-opacity': '0.28' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': pal.blue, 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = maxVal / ticks * i;
      const y = padT + plotH - (val / maxVal) * plotH;
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: pal.grid, 'stroke-width': 1, 'stroke-dasharray': i === 0 ? '0' : '3 3', opacity: i === 0 ? 1 : 0.55 }));
      svg.appendChild(el('text', { x: padL - 7, y: y + 3, 'text-anchor': 'end', 'font-size': '9', fill: pal.ink3 }, formatY(val)));
    }

    const xAt = i => padL + (points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * i);
    const yAt = v => padT + plotH - (v / maxVal) * plotH;

    let line = '', area = '';
    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(p.value);
      line += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      area += (i === 0 ? `M${x} ${padT + plotH} L` : 'L') + x + ' ' + y + ' ';
    });
    area += `L${xAt(points.length - 1)} ${padT + plotH} Z`;

    svg.appendChild(el('path', { d: area, fill: 'url(#areaGrad)' }));
    svg.appendChild(el('path', { d: line, fill: 'none', stroke: pal.blue, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(p.value);
      const dot = el('circle', { cx: x, cy: y, r: 3, fill: pal.surface, stroke: pal.blue, 'stroke-width': 2 });
      dot.appendChild(el('title', {}, `${p.label}: ${formatY(p.value)}`));
      svg.appendChild(dot);
      if (points.length <= 15 || i % 2 === 0) {
        svg.appendChild(el('text', { x, y: H - 9, 'text-anchor': 'middle', 'font-size': '9', fill: pal.ink3 }, p.label));
      }
    });

    container.appendChild(svg);
  }

  /* ── Data shaping helpers (real job data only) ────────────────────────── */

  function niceCeil(n) {
    if (n <= 5) return 5;
    const mag = Math.pow(10, Math.floor(Math.log10(n)));
    const norm = n / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function dayKey(d) { return d.toISOString().slice(0, 10); }
  function dayLabel(d) { return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }

  /* Build a windowed daily series from jobs, using submittedAt. */
  function buildDailyVolume(jobs, windowDays = 14) {
    const buckets = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      buckets.set(dayKey(d), { label: dayLabel(d), values: { complete: 0, failed: 0, processing: 0 } });
    }
    jobs.forEach(j => {
      const iso = j.submittedAt || j.completedAt;
      if (!iso) return;
      const key = dayKey(new Date(iso));
      const b = buckets.get(key);
      if (!b) return;
      const s = (j.status || '').toLowerCase();
      if (s === 'complete') b.values.complete++;
      else if (s === 'failed') b.values.failed++;
      else b.values.processing++;
    });
    return [...buckets.values()];
  }

  /* Cumulative cost across the same window, from real costTotal values. */
  function buildCumulativeCost(jobs, windowDays = 14) {
    const daily = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      daily.set(dayKey(d), { label: dayLabel(d), value: 0 });
    }
    jobs.forEach(j => {
      const iso = j.completedAt || j.submittedAt;
      if (!iso) return;
      const key = dayKey(new Date(iso));
      const b = daily.get(key);
      if (b) b.value += +(j.costTotal || 0);
    });
    let running = 0;
    return [...daily.values()].map(d => { running += d.value; return { label: d.label, value: running }; });
  }

  return { donut, stackedBars, areaLine, buildDailyVolume, buildCumulativeCost, palette };
})();

window.Charts = Charts;
