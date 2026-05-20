export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function section(title, sub, body, opts = {}) {
  if (!body) return '';
  const cls = opts.cls ? ` ${opts.cls}` : '';
  const open = opts.open === false ? '' : ' open';
  return `<details class="section${cls}"${open}>
    <summary class="section-head"><span class="chev">&rsaquo;</span><span class="ttl">${title}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</summary>
    <div class="section-body">${body}</div></details>`;
}

function metricsTable(metrics) {
  if (!Array.isArray(metrics) || !metrics.length) return '';
  const rows = metrics.map(m =>
    `<tr><td>${esc(m.name)}</td><td>${esc(m.value)}</td><td>${esc(m.delta || '')}</td></tr>`).join('');
  return `<table class="metrics"><thead><tr><th>Metric</th><th>Value</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function notesList(notes) {
  if (!Array.isArray(notes) || !notes.length) return '';
  return `<ul class="notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
}

function chartRow(chartIds, charts) {
  if (!Array.isArray(chartIds) || !chartIds.length) return '';
  const byId = Object.fromEntries((charts || []).map(c => [c.id, c]));
  const cards = chartIds.map(id => {
    const c = byId[id]; if (!c) return '';
    return `<div class="chart-card"><h4>${esc(c.title)}</h4><div class="chart-wrap"><canvas id="chart-${esc(c.id)}"></canvas></div></div>`;
  }).join('');
  return cards ? `<div class="chart-row">${cards}</div>` : '';
}

function execSummary(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<section class="exec"><div class="eyebrow">Executive summary</div>
    <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
}

function northStar(ns) {
  if (!ns) return '';
  const pct = ns.goal ? Math.min(100, Math.round((Number(ns.current) / Number(ns.goal)) * 100)) : 0;
  const fmt = n => (ns.unit || '') + Number(n).toLocaleString();
  return `<section class="northstar">
    <div class="ns-top"><span class="ns-label">${esc(ns.label || 'Goal')}</span>
      <span class="ns-val"><span class="num">${esc(fmt(ns.current))}</span> <span class="ns-goal">/ ${esc(fmt(ns.goal))}</span></span></div>
    <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
    <div class="ns-note">${esc(ns.note || '')}${ns.note ? ' · ' : ''}${pct}% there</div></section>`;
}

function kpiStrip(kpis) {
  if (!Array.isArray(kpis) || !kpis.length) return '';
  return `<section class="kpis">${kpis.map(k => `<div class="kpi ${esc(k.status || 'neutral')}">
    <div class="label">${esc(k.label)}</div><div class="value num">${esc(k.value)}</div><div class="delta">${esc(k.delta || '')}</div>
    ${Array.isArray(k.spark) && k.spark.length ? `<canvas class="spark" data-spark="${esc(JSON.stringify(k.spark))}"></canvas>` : ''}
  </div>`).join('')}</section>`;
}

function decisionsSection(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const rows = items.map(d => `<tr><td><strong>${esc(d.item)}</strong></td><td>${esc(d.lens || '')}</td><td>${esc(d.why || '')}</td></tr>`).join('');
  const body = `<table class="metrics"><thead><tr><th>Decision</th><th>Area</th><th>Why now</th></tr></thead><tbody>${rows}</tbody></table>`;
  return section('Needs your decision', `${items.length} open`, body, { cls: 'decide' });
}

function storeSection(store, charts) {
  if (!store) return '';
  const body = metricsTable(store.metrics) + chartRow(store.chartIds, charts) + notesList(store.notes);
  return section(store.title || 'Shopify Store', store.sub || '', body);
}

function onlineSection(op, charts) {
  if (!op) return '';
  const signals = Array.isArray(op.clarity) && op.clarity.length
    ? `<div class="signals">${op.clarity.map(s => `<div class="sig ${esc(s.status || '')}"><div class="v num">${esc(s.value)}</div><div class="l">${esc(s.name)}</div></div>`).join('')}</div>`
    : '';
  const body = metricsTable(op.metrics) + chartRow(op.chartIds, charts) + signals + notesList(op.notes);
  return section(op.title || 'Website & online presence', op.sub || '', body);
}

function channelSection(ch, charts) {
  const body = (ch.headline ? `<div class="ch-headline num">${esc(ch.headline)}</div>` : '')
    + metricsTable(ch.metrics) + chartRow(ch.chartIds, charts) + notesList(ch.notes);
  return section(ch.name || ch.id, ch.sub || '', body);
}

function competitorsSection(list, landscape) {
  if ((!Array.isArray(list) || !list.length) && !landscape) return '';
  const cards = (list || []).map(c => `<div class="cardlet">
    <div class="t">${esc(c.name)} <span class="badge ${c.threat === '—' || !c.threat ? 'us' : esc(c.threat)}">${c.threat === '—' || !c.threat ? 'us' : esc(c.threat)}</span></div>
    <div class="p num">${esc(c.price)}</div><div class="d">${esc(c.preorders || '')} · ${esc(c.form || '')}</div>
    <div class="n">${esc(c.cert || '')}${c.cert ? ' — ' : ''}${esc(c.note || '')}</div></div>`).join('');
  const body = (cards ? `<div class="cards">${cards}</div>` : '') + (landscape ? `<p class="note">${esc(landscape)}</p>` : '');
  return section('Competitor landscape', '', body);
}

function manufacturingSection(m) {
  if (!m) return '';
  const tl = Array.isArray(m.timeline) && m.timeline.length
    ? `<ul class="timeline">${m.timeline.map(t => `<li><span class="dot ${esc(t.status || '')}"></span><span class="it">${esc(t.item)}</span><span class="eta num">${esc(t.eta)}</span></li>`).join('')}</ul>`
    : '';
  const cd = (m.daysToShip != null)
    ? `<div class="countdown"><span class="big num">${esc(m.daysToShip)}</span><span class="lbl">days to ship · target ${esc(m.shipDate || '')}</span></div>` : '';
  const cost = (m.cog || m.margin)
    ? `<p class="note">COG ${esc(m.cog || '')} · margin ${esc(m.margin || '')}</p>` : '';
  const body = cd + tl + cost + notesList(m.notes);
  return section('Manufacturing', m.status ? m.status + ' · ship ' + (m.shipDate || '') : '', body);
}

function inboxSection(inbox) {
  const items = inbox && Array.isArray(inbox.items) ? inbox.items : null;
  if (!items || !items.length) return '';
  const body = `<ul class="notes">${items.map(i => `<li><strong>${esc(i.urgency || '')}</strong> — ${esc(i.summary)}</li>`).join('')}</ul>`;
  return section('Inbox & comms', '', body);
}

function listSection(title, arr, ordered) {
  if (!Array.isArray(arr) || !arr.length) return '';
  const body = ordered
    ? `<ol class="actions">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`
    : `<ul class="angle">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return section(title, '', body);
}

function footer(b) {
  const src = b.sources || {};
  const chips = Object.keys(src).map(k => `<span class="src ${src[k] === 'ok' ? 'ok' : 'bad'}">${esc(k)}</span>`).join('');
  return `<footer>Sources ${chips}<br>Edition ${esc(b.edition)} · generated ${esc(b.generatedAt || '')}</footer>`;
}

export function buildBriefHTML(b) {
  const channels = (b.channels || []).map(ch => channelSection(ch, b.charts)).join('');
  // back-compat: render legacy lenses only if the new sections are absent
  const legacy = (!b.store && !b.channels && b.lenses)
    ? ['cmo', 'cfo', 'cto'].map(k => b.lenses[k] ? section(k.toUpperCase(), '', (b.lenses[k].narrative ? `<p class="note">${esc(b.lenses[k].narrative)}</p>` : '') + metricsTable(b.lenses[k].metrics)) : '').join('')
    : '';
  return `
    <header class="brand"><h1><span class="mark">Easi Breezi</span> · Master Dashboard</h1>
      <span class="ed num">Edition ${esc(b.edition)} · ${esc(b.date)}</span></header>
    ${execSummary(b.executiveSummary || b.headline)}
    ${northStar(b.northStar)}
    ${decisionsSection(b.needsDecision)}
    ${kpiStrip(b.kpis)}
    ${storeSection(b.store, b.charts)}
    ${onlineSection(b.onlinePresence, b.charts)}
    ${channels}
    ${legacy}
    ${competitorsSection(b.competitors, b.landscape)}
    ${manufacturingSection(b.manufacturing)}
    ${inboxSection(b.inbox || (b.lenses && b.lenses.inbox))}
    ${listSection('Today’s content angle', b.contentAngle, false)}
    ${listSection('Action stack', b.actionStack, true)}
    ${footer(b)}
  `;
}

// ---- browser-only chart rendering (skipped under node:test) ----
function renderCharts(brief) {
  if (typeof window === 'undefined' || !window.Chart) return;
  const C = window.Chart;
  C.defaults.color = '#9aa3af';
  C.defaults.font.family = "-apple-system,BlinkMacSystemFont,Segoe UI,Inter,sans-serif";
  const palette = ['#5b9bf0', '#3fb8b0', '#c9a227', '#9b8cf0', '#3aa675', '#e0524b'];

  document.querySelectorAll('canvas.spark').forEach(cv => {
    let data = []; try { data = JSON.parse(cv.dataset.spark || '[]'); } catch { data = []; }
    new C(cv, { type: 'line', data: { labels: data.map((_, i) => i), datasets: [{ data, borderColor: '#5b9bf0', borderWidth: 1.5, pointRadius: 0, tension: .4, fill: false }] },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, responsive: true, maintainAspectRatio: false } });
  });

  (brief.charts || []).forEach(c => {
    const el = document.getElementById('chart-' + c.id); if (!el) return;
    const datasets = (c.datasets || []).map((d, i) => ({
      label: d.label, data: d.data,
      backgroundColor: c.type === 'doughnut' ? palette : (d.color || palette[i % palette.length]),
      borderColor: d.color || palette[i % palette.length], borderWidth: 2,
      pointRadius: c.type === 'line' ? 0 : 0, tension: .35, fill: false, borderRadius: c.type === 'bar' ? 4 : 0
    }));
    new C(el, { type: c.type || 'line', data: { labels: c.labels, datasets },
      options: {
        plugins: { legend: { display: c.type === 'doughnut' || (c.datasets || []).length > 1, position: c.type === 'doughnut' ? 'right' : 'top', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } } } },
        scales: c.type === 'doughnut' ? {} : { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#20242b' }, ticks: { font: { size: 11 } }, beginAtZero: true } },
        responsive: true, maintainAspectRatio: false, cutout: c.type === 'doughnut' ? '62%' : undefined } });
  });
}

if (typeof document !== 'undefined') {
  fetch('./briefs/latest.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(b => { document.getElementById('app').innerHTML = buildBriefHTML(b); renderCharts(b); })
    .catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load latest brief.</p>'; });
}
