import { esc, freshnessBadge, statusPanel, mountErrorCapture } from './shared-ui.js';

function ch(latest, id) { return (((latest && latest.channels) || []).find(c => c.id === id)) || {}; }
function metric(c, p) { const m = ((c && c.metrics) || []).find(x => new RegExp(p, 'i').test(x.name || '')); return m ? m.value : ''; }
function storeM(latest, p) { const m = (((latest && latest.store) || {}).metrics || []).find(x => new RegExp(p, 'i').test(x.name || '')); return m || {}; }
function chart(latest, id) { return (((latest && latest.charts) || []).find(c => c.id === id)) || null; }
const TONE = { bad: 'var(--bad)', warn: 'var(--amber)', good: 'var(--good)' };

function statCard(label, value, sub, color) {
  return `<div class="m-stat"><div class="m-stat-label">${esc(label)}</div>
    <div class="m-stat-value"${color ? ` style="color:${color}"` : ''}>${esc(value || '—')}</div>
    <div class="m-stat-sub">${esc(sub || '')}</div></div>`;
}
function section(title, body) { return `<div class="m-section"><div class="m-section-title">${esc(title)}</div>${body}</div>`; }
function alertBox(tone, icon, strong, text) { return `<div class="m-alert ${tone}"><div>${icon}</div><div><strong>${esc(strong)}</strong>${esc(text)}</div></div>`; }
function barList(items) {
  return `<div class="m-bars">${items.map(b => `<div class="m-bar-item"><div class="m-bar-name">${esc(b.name)}</div>
    <div class="m-bar-track"><div class="m-bar-fill" style="width:${Math.max(2, Math.round(b.pct))}%${b.color ? `;background:${b.color}` : ''}"></div></div>
    <div class="m-bar-val"${b.valColor ? ` style="color:${b.valColor}"` : ''}>${esc(b.val)}</div></div>`).join('')}</div>`;
}

export function renderSales(latest, sales) {
  latest = latest || {}; sales = sales || {};
  const store = latest.store || {};
  const disc = (store.metrics || []).find(m => /discount/i.test(m.name || ''));
  const cvr = storeM(latest, 'Conversion');
  const orders = storeM(latest, 'paid orders');

  const stats = [
    statCard('Paid pre-orders', orders.value, orders.delta, 'var(--good)'),
    statCard('Revenue', storeM(latest, 'revenue').value, storeM(latest, 'revenue').delta, 'var(--good)'),
    statCard('EB units', storeM(latest, 'units').value, '', null),
    statCard('Conversion rate', cvr.value, cvr.delta, 'var(--amber)'),
    statCard('Pre-order code', disc ? disc.value : 'EB25', disc ? (disc.delta || '') : '', 'var(--eb-blue)')
  ].join('');

  // alerts derived from live data
  const alerts = [];
  if (cvr.delta && /dry|0/.test(cvr.delta)) alerts.push(alertBox('red', '🚨', 'Demand stall', `Conversion ${cvr.value} — ${cvr.delta}. The funnel is fixed; the gap is qualified demand reaching the page (top of funnel, not checkout).`));
  if (disc && /0 uses|ENDS/i.test(disc.delta || '')) alerts.push(alertBox('warn', '⏳', 'Pre-order code decision', `${disc.value} — ${disc.delta}. Decide: extend, relaunch with a sharper hook, or let it lapse.`));

  // CVR trend (companion) → bars scaled to the max
  const cv = Array.isArray(sales.cvrTrend) ? sales.cvrTrend : [];
  const maxCv = Math.max(0.01, ...cv.map(x => x.pct));
  const cvrBars = cv.length ? section('Conversion rate — 7-week trend',
    barList(cv.map((x, i) => ({ name: x.week, pct: (x.pct / maxCv) * 100, val: `${x.pct}%`, color: i === cv.length - 1 ? 'var(--good)' : 'var(--eb-blue)', valColor: i === cv.length - 1 ? 'var(--good)' : null })))) : '';

  // geography from the LIVE ordersByCountry chart
  const geo = chart(latest, 'ordersByCountry');
  const geoBars = geo ? (() => {
    const max = Math.max(1, ...(geo.datasets[0].data || []));
    const items = (geo.labels || []).map((l, i) => ({ name: l, pct: ((geo.datasets[0].data[i] || 0) / max) * 100, val: String(geo.datasets[0].data[i] || 0) }));
    return section('🌍 Paid orders by geography (live)', `<div class="m-card">${barList(items)}</div>`);
  })() : '';

  // order ledger (companion snapshot)
  const led = Array.isArray(sales.orderLedger) ? sales.orderLedger : [];
  const ledger = led.length ? section(`📋 Order ledger — snapshot ${sales.updated || ''}`,
    `<div class="m-card"><div class="m-table-wrap"><table class="m-table"><thead><tr><th>Order</th><th>Date</th><th>Location</th><th>Total</th><th>Payment</th><th>Lines</th></tr></thead><tbody>${led.map(o =>
      `<tr><td class="m-strong">${esc(o.order)}</td><td>${esc(o.date)}</td><td>${esc(o.location)}</td><td>${esc(o.total)}</td><td><span class="m-badge ${o.payment === 'Paid' ? 'green' : 'muted'}">${esc(o.payment)}</span></td><td>${esc(o.lines)}</td></tr>`).join('')}</tbody></table></div></div>`) : '';

  // units by product (companion)
  const up = Array.isArray(sales.unitsByProduct) ? sales.unitsByProduct : [];
  const maxU = Math.max(1, ...up.map(x => x.units));
  const units = up.length ? section('📦 Units sold by product',
    `<div class="m-card">${barList(up.map(x => ({ name: x.name, pct: (x.units / maxU) * 100, val: String(x.units) })))}</div>`) : '';

  // traffic leak (companion)
  const tl = Array.isArray(sales.trafficLeak) ? sales.trafficLeak : [];
  const leak = tl.length ? section('📣 Where demand is leaking',
    `<div class="m-card"><div class="m-rows">${tl.map(t => `<div class="m-row"><div class="m-row-name">${esc(t.source)}</div><div class="m-row-right" style="color:${TONE[t.tone] || 'var(--muted)'};font-weight:600">${esc(t.val)}</div></div>`).join('')}</div></div>`) : '';

  // email (live)
  const em = ch(latest, 'email');
  const email = em.metrics ? section('📧 Email / Brevo (live)',
    `<div class="m-mc">${(em.metrics || []).map(m => `<div class="m-mc-card"><div class="m-mc-label">${esc(m.name)}</div><div class="m-mc-value">${esc(m.value)}</div><div class="m-stat-sub">${esc(m.delta || '')}</div></div>`).join('')}</div>`) : '';

  // pixels (companion)
  const px = Array.isArray(sales.pixels) ? sales.pixels : [];
  const pixels = px.length ? section('🎯 Pixels & tracking',
    `<div class="m-rows">${px.map(p => `<div class="m-row"><div class="m-row-name"><span class="m-dot ${p.dot}"></span> ${esc(p.name)}</div><div class="m-row-right m-row-desc">${esc(p.status)}</div></div>`).join('')}</div>`) : '';

  // conversion levers (companion)
  const lv = Array.isArray(sales.conversionLevers) ? sales.conversionLevers : [];
  const levers = lv.length ? section('🔍 Conversion levers',
    `<div class="m-card"><div class="m-table-wrap"><table class="m-table"><thead><tr><th>Lever</th><th>Action</th></tr></thead><tbody>${lv.map(x =>
      `<tr><td class="m-row-desc">${esc(x.lever)}</td><td>${esc(x.action)}</td></tr>`).join('')}</tbody></table></div></div>`) : '';

  return `
    <header class="topbar">
      <div class="logo"><span class="m-logo">🛒 Easi Breezi</span><span class="wm-sub">Sales &amp; Shopify</span></div>
      <div class="controls"><a class="m-back" href="./index.html">← Master</a>${freshnessBadge(latest.generatedAt)}</div>
    </header>
    <nav class="drilldown"><span class="dd-label">Drill into detail</span>
      <a class="dd-link" href="./marketing-hub.html">🎯 Marketing Hub</a>
      <a class="dd-link" href="./team-budget.html">👥 Team &amp; Budget</a>
      <a class="dd-link" href="./stats.html">📈 Stats</a>
    </nav>
    <div class="m-stats">${stats}</div>
    ${alerts.join('')}
    ${cvrBars}${geoBars}${ledger}${units}${leak}${email}${pixels}${levers}
    ${statusPanel(latest.sources, latest.toolIssues, latest.__build)}
  `;
}

if (typeof document !== 'undefined') {
  mountErrorCapture();
  Promise.all([
    fetch('./briefs/latest.json', { cache: 'no-store' }).then(r => r.json()),
    fetch('./sales-funnel.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    fetch('/healthz', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([latest, sales, health]) => {
    if (health && health.build) latest.__build = health.build;
    document.getElementById('app').innerHTML = renderSales(latest, sales);
  }).catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load the sales funnel.</p>'; });
}
