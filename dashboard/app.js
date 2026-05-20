export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const EB_LOGO = `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><g>
<path d="M22 14 Q14 14 14 22 L14 38 Q14 46 22 46 L42 46 Q46 46 46 42 L46 22 Q46 14 38 14 Z"/>
<path d="M58 14 Q54 14 54 18 L54 42 Q54 46 58 46 L78 46 Q86 46 86 38 L86 22 Q86 14 78 14 Z"/>
<rect x="14" y="48" width="72" height="4" rx="1"/>
<path d="M22 54 Q14 54 14 62 L14 78 Q14 86 22 86 L38 86 Q46 86 46 78 L46 58 Q46 54 42 54 Z"/>
<path d="M58 54 Q54 54 54 58 L54 78 Q54 86 62 86 L78 86 Q86 86 86 78 L86 62 Q86 54 78 54 Z"/>
<rect x="48" y="14" width="4" height="72" rx="1"/></g></svg>`;

function cbox(item) {
  return `<div class="cbox"><textarea data-item="${esc(item)}" placeholder="Note on ${esc(item)}…" rows="1"></textarea></div>`;
}

function section(title, sub, body, opts = {}) {
  if (!body) return '';
  const cls = opts.cls ? ` ${opts.cls}` : '';
  const open = opts.open === false ? '' : ' open';
  return `<details class="section commentable${cls}"${open}>
    <summary class="section-head"><span class="chev">&rsaquo;</span><span class="ttl">${title}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</summary>
    <div class="section-body">${body}${cbox(title)}</div></details>`;
}

function metricsTable(metrics) {
  if (!Array.isArray(metrics) || !metrics.length) return '';
  const rows = metrics.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.value)}</td><td>${esc(m.delta || '')}</td></tr>`).join('');
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

function topbar(b) {
  return `<header class="topbar">
    <div class="logo">${EB_LOGO}<div class="wm">Easi Breezi<small>Master Dashboard</small></div></div>
    <div class="controls">
      <select class="daypick" aria-label="Choose day"></select>
      <button class="reviewtoggle" type="button" aria-pressed="false">💬 Review</button>
      <span class="ed num">Ed. ${esc(b.edition)} · ${esc(b.date)}</span>
    </div></header>`;
}

function execSummary(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<section class="exec commentable"><div class="eyebrow">Executive summary</div>
    <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>${cbox('Executive summary')}</section>`;
}
function northStar(ns) {
  if (!ns) return '';
  const pct = ns.goal ? Math.min(100, Math.round((Number(ns.current) / Number(ns.goal)) * 100)) : 0;
  const fmt = n => (ns.unit || '') + Number(n).toLocaleString();
  return `<section class="northstar commentable">
    <div class="ns-top"><span class="ns-label">${esc(ns.label || 'Goal')}</span>
      <span class="ns-val"><span class="num">${esc(fmt(ns.current))}</span> <span class="ns-goal">/ ${esc(fmt(ns.goal))}</span></span></div>
    <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
    <div class="ns-note">${esc(ns.note || '')}${ns.note ? ' · ' : ''}${pct}% there</div>${cbox('North star')}</section>`;
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
function storeSection(s, charts) {
  if (!s) return '';
  return section(s.title || 'Shopify Store', s.sub || '', metricsTable(s.metrics) + chartRow(s.chartIds, charts) + notesList(s.notes));
}
function onlineSection(op, charts) {
  if (!op) return '';
  const signals = Array.isArray(op.clarity) && op.clarity.length
    ? `<div class="signals">${op.clarity.map(x => `<div class="sig ${esc(x.status || '')}"><div class="v num">${esc(x.value)}</div><div class="l">${esc(x.name)}</div></div>`).join('')}</div>` : '';
  return section(op.title || 'Website & online presence', op.sub || '', metricsTable(op.metrics) + chartRow(op.chartIds, charts) + signals + notesList(op.notes));
}
function channelSection(ch, charts) {
  const body = (ch.headline ? `<div class="ch-headline num">${esc(ch.headline)}</div>` : '') + metricsTable(ch.metrics) + chartRow(ch.chartIds, charts) + notesList(ch.notes);
  return section(ch.name || ch.id, ch.sub || '', body);
}
function competitorsSection(list, landscape) {
  if ((!Array.isArray(list) || !list.length) && !landscape) return '';
  const cards = (list || []).map(c => `<div class="cardlet">
    <div class="t">${esc(c.name)} <span class="badge ${c.threat === '—' || !c.threat ? 'us' : esc(c.threat)}">${c.threat === '—' || !c.threat ? 'us' : esc(c.threat)}</span></div>
    <div class="p num">${esc(c.price)}</div><div class="d">${esc(c.preorders || '')} · ${esc(c.form || '')}</div>
    <div class="n">${esc(c.cert || '')}${c.cert ? ' — ' : ''}${esc(c.note || '')}</div></div>`).join('');
  return section('Competitor landscape', '', (cards ? `<div class="cards">${cards}</div>` : '') + (landscape ? `<p class="note">${esc(landscape)}</p>` : ''));
}
function manufacturingSection(m) {
  if (!m) return '';
  const tl = Array.isArray(m.timeline) && m.timeline.length
    ? `<ul class="timeline">${m.timeline.map(t => `<li><span class="dot ${esc(t.status || '')}"></span><span class="it">${esc(t.item)}</span><span class="eta num">${esc(t.eta)}</span></li>`).join('')}</ul>` : '';
  const cd = (m.daysToShip != null) ? `<div class="countdown"><span class="big num">${esc(m.daysToShip)}</span><span class="lbl">days to ship · target ${esc(m.shipDate || '')}</span></div>` : '';
  const cost = (m.cog || m.margin) ? `<p class="note">COG ${esc(m.cog || '')} · margin ${esc(m.margin || '')}</p>` : '';
  return section('Manufacturing', m.status ? `${m.status} · ship ${m.shipDate || ''}` : '', cd + tl + cost + notesList(m.notes));
}
function inboxSection(inbox) {
  const items = inbox && Array.isArray(inbox.items) ? inbox.items : null;
  if (!items || !items.length) return '';
  return section('Inbox & comms', '', `<ul class="notes">${items.map(i => `<li><strong>${esc(i.urgency || '')}</strong> — ${esc(i.summary)}</li>`).join('')}</ul>`);
}
function listSection(title, arr, ordered) {
  if (!Array.isArray(arr) || !arr.length) return '';
  const body = ordered ? `<ol class="actions">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : `<ul class="angle">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return section(title, '', body);
}
function footer(b) {
  const src = b.sources || {};
  const chips = Object.keys(src).map(k => `<span class="src ${src[k] === 'ok' ? 'ok' : 'bad'}">${esc(k)}</span>`).join('');
  return `<footer>Sources ${chips}<br>Edition ${esc(b.edition)} · generated ${esc(b.generatedAt || '')}</footer>`;
}

export function buildBriefHTML(b) {
  const channels = (b.channels || []).map(ch => channelSection(ch, b.charts)).join('');
  return `
    ${topbar(b)}
    ${execSummary(b.executiveSummary || b.headline)}
    ${northStar(b.northStar)}
    ${decisionsSection(b.needsDecision)}
    ${kpiStrip(b.kpis)}
    ${storeSection(b.store, b.charts)}
    ${onlineSection(b.onlinePresence, b.charts)}
    ${channels}
    ${competitorsSection(b.competitors, b.landscape)}
    ${manufacturingSection(b.manufacturing)}
    ${inboxSection(b.inbox || (b.lenses && b.lenses.inbox))}
    ${listSection('Today’s content angle', b.contentAngle, false)}
    ${listSection('Action stack', b.actionStack, true)}
    ${footer(b)}
  `;
}

// ---------- browser only ----------
function renderCharts(brief) {
  if (typeof window === 'undefined' || !window.Chart) return;
  const C = window.Chart;
  C.defaults.color = '#93a3b8';
  C.defaults.font.family = "'Chakra Petch',system-ui,sans-serif";
  // brand palette: blue family + one orange standout (cohesive, colorblind-safe)
  const palette = ['#20BCF3', '#19799B', '#5fd0f7', '#2f86ad', '#FA800E', '#8bd4ef'];
  document.querySelectorAll('canvas.spark').forEach(cv => {
    let d = []; try { d = JSON.parse(cv.dataset.spark || '[]'); } catch { d = []; }
    new C(cv, { type: 'line', data: { labels: d.map((_, i) => i), datasets: [{ data: d, borderColor: '#20BCF3', borderWidth: 1.5, pointRadius: 0, tension: .4 }] },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, responsive: true, maintainAspectRatio: false } });
  });
  (brief.charts || []).forEach(c => {
    const el = document.getElementById('chart-' + c.id); if (!el) return;
    const ds = (c.datasets || []).map((d, i) => ({
      label: d.label, data: d.data,
      backgroundColor: c.type === 'doughnut' ? palette : (d.color || palette[i % palette.length]),
      borderColor: c.type === 'doughnut' ? '#0e1320' : (d.color || palette[i % palette.length]),
      borderWidth: c.type === 'doughnut' ? 2 : 2, pointRadius: 0, tension: .35, borderRadius: c.type === 'bar' ? 5 : 0
    }));
    new C(el, { type: c.type || 'line', data: { labels: c.labels, datasets: ds },
      options: {
        plugins: { legend: { display: c.type === 'doughnut' || (c.datasets || []).length > 1, position: c.type === 'doughnut' ? 'right' : 'top', labels: { boxWidth: 9, boxHeight: 9, padding: 12, font: { size: 11 } } } },
        scales: c.type === 'doughnut' ? {} : { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#1f2a3d' }, ticks: { font: { size: 11 } }, beginAtZero: true } },
        responsive: true, maintainAspectRatio: false, cutout: c.type === 'doughnut' ? '64%' : undefined } });
  });
}

if (typeof document !== 'undefined') {
  let current = null;
  const $ = s => document.querySelector(s);

  function ensureChrome() {
    if (!$('.submitbar')) {
      const bar = document.createElement('div'); bar.className = 'submitbar';
      bar.innerHTML = `<span class="cnt">0 comments</span><button type="button" disabled>Submit to Claude</button>`;
      document.body.appendChild(bar);
      const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = 'Feedback sent ✓';
      document.body.appendChild(toast);
      bar.querySelector('button').addEventListener('click', submitFeedback);
    }
  }
  function collect() {
    return [...document.querySelectorAll('.cbox textarea')].map(t => ({ item: t.dataset.item, note: t.value.trim() })).filter(c => c.note);
  }
  function refreshBar() {
    const n = collect().length, bar = $('.submitbar');
    bar.querySelector('.cnt').textContent = `${n} comment${n === 1 ? '' : 's'}`;
    bar.querySelector('button').disabled = n === 0;
    bar.classList.toggle('show', document.body.classList.contains('review') && n > 0);
  }
  async function submitFeedback() {
    const comments = collect(); if (!comments.length) return;
    const body = new URLSearchParams({ 'form-name': 'dashboard-feedback', 'bot-field': '', edition: String(current?.edition ?? ''), page: 'master', comments: JSON.stringify(comments) });
    try {
      await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      document.querySelectorAll('.cbox textarea').forEach(t => { t.value = ''; t.classList.remove('filled'); });
      refreshBar();
      const toast = $('.toast'); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200);
    } catch { alert('Could not send feedback — check your connection and try again.'); }
  }
  function bind() {
    $('.reviewtoggle')?.addEventListener('click', e => {
      const on = !document.body.classList.contains('review');
      document.body.classList.toggle('review', on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      refreshBar();
    });
    document.querySelectorAll('.cbox textarea').forEach(t => {
      t.addEventListener('input', () => { t.classList.toggle('filled', !!t.value.trim()); refreshBar(); });
    });
  }
  async function loadDaypicker() {
    const sel = $('.daypick'); if (!sel) return;
    let hist = [];
    try { hist = await (await fetch('./briefs/history/index.json', { cache: 'no-store' })).json(); } catch { hist = []; }
    const opts = [`<option value="latest">Latest — Ed. ${current?.edition ?? ''} (${current?.date ?? ''})</option>`]
      .concat((Array.isArray(hist) ? hist : []).filter(h => h.date !== current?.date).map(h => `<option value="${esc(h.date)}">${esc(h.date)} — Ed. ${esc(h.edition)}</option>`));
    sel.innerHTML = opts.join('');
    sel.addEventListener('change', async () => {
      const v = sel.value;
      const url = v === 'latest' ? './briefs/latest.json' : `./briefs/history/${v}.json`;
      try { mount(await (await fetch(url, { cache: 'no-store' })).json(), true); } catch { /* keep current */ }
    });
  }
  function mount(b, keepReview) {
    current = b;
    $('#app').innerHTML = buildBriefHTML(b);
    renderCharts(b);
    ensureChrome(); bind(); loadDaypicker();
    if (keepReview && document.body.classList.contains('review')) { $('.reviewtoggle')?.setAttribute('aria-pressed', 'true'); }
    refreshBar();
  }
  fetch('./briefs/latest.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(b => mount(b, false))
    .catch(() => { $('#app').innerHTML = '<p class="err">Failed to load the brief.</p>'; });
}
