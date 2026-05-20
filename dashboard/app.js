export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function northStar(ns) {
  if (!ns) return '';
  const pct = ns.goal ? Math.min(100, Math.round((Number(ns.current) / Number(ns.goal)) * 100)) : 0;
  const fmt = (n) => (ns.unit || '') + Number(n).toLocaleString();
  return `<section class="northstar">
    <div class="ns-top"><span class="ns-label">${esc(ns.label || 'Goal')}</span>
      <span class="ns-val">${esc(fmt(ns.current))} <span class="ns-goal">/ ${esc(fmt(ns.goal))}</span></span></div>
    <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
    <div class="ns-note">${esc(ns.note || '')}${ns.note ? ' &middot; ' : ''}${pct}% there</div></section>`;
}

function kpiTiles(kpis) {
  if (!Array.isArray(kpis) || !kpis.length) return '';
  const tiles = kpis.map(k => `<div class="kpi ${esc(k.status || 'neutral')}">
    <div class="kpi-label">${esc(k.label)}</div>
    <div class="kpi-val">${esc(k.value)}</div>
    <div class="kpi-delta">${esc(k.delta || '')}</div>
    ${Array.isArray(k.spark) && k.spark.length ? `<canvas class="spark" data-spark="${esc(JSON.stringify(k.spark))}"></canvas>` : ''}
  </div>`).join('');
  return `<h2 class="sec">Master overview</h2><section class="kpi-grid">${tiles}</section>`;
}

function chartsGrid(charts) {
  if (!Array.isArray(charts) || !charts.length) return '';
  const cards = charts.map(c => `<div class="chart-card"><h3>${esc(c.title)}</h3>
    <div class="chart-wrap"><canvas id="chart-${esc(c.id)}"></canvas></div></div>`).join('');
  return `<h2 class="sec">Trends &amp; breakdowns</h2><section class="charts-grid">${cards}</section>`;
}

function decisions(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const rows = items.map(d => `<tr><td><strong>${esc(d.item)}</strong></td><td>${esc(d.lens)}</td><td>${esc(d.why)}</td></tr>`).join('');
  return `<section class="card decide"><h2 class="sec">Needs a decision</h2>
    <table><thead><tr><th>Item</th><th>Lens</th><th>Why now</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function lensCard(key, title, lenses) {
  const l = (lenses || {})[key]; if (!l) return '';
  const metrics = (l.metrics || []).map(m =>
    `<tr><td>${esc(m.name)}</td><td>${esc(m.value)}</td><td>${esc(m.delta || '')}</td><td>${m.flag ? `<span class="flag ${esc(m.flag)}">${esc(m.flag)}</span>` : ''}</td></tr>`).join('');
  const items = (l.items || []).map(i =>
    `<li><span class="flag ${esc(i.urgency || '')}">${esc(i.urgency || '')}</span> ${esc(i.summary)}</li>`).join('');
  return `<section class="card lens ${esc(key)}"><h2 class="sec">${esc(title)}</h2>
    ${l.narrative ? `<p>${esc(l.narrative)}</p>` : ''}
    ${metrics ? `<table><thead><tr><th>Metric</th><th>Value</th><th>&Delta;</th><th></th></tr></thead><tbody>${metrics}</tbody></table>` : ''}
    ${items ? `<ul>${items}</ul>` : ''}</section>`;
}

function socials(list) {
  if (!Array.isArray(list) || !list.length) return '';
  const cards = list.map(s => `<div class="mini"><div class="t">${esc(s.platform)}</div>
    <div class="s">${esc(s.followers)}</div><div class="d">${esc(s.handle || '')} &middot; ${esc(s.delta || '')}</div>
    <div class="n">${esc(s.note || '')}</div></div>`).join('');
  return `<h2 class="sec">Social channels</h2><section class="grid3">${cards}</section>`;
}

function competitors(list, landscape) {
  if ((!Array.isArray(list) || !list.length) && !landscape) return '';
  const cards = (list || []).map(c => `<div class="mini comp">
    <div class="t">${esc(c.name)} <span class="threat ${esc(c.threat || 'med')}">${c.threat === '—' || !c.threat ? 'us' : esc(c.threat)}</span></div>
    <div class="s">${esc(c.price)}</div>
    <div class="d">${esc(c.preorders || '')} &middot; ${esc(c.form || '')}</div>
    <div class="n">${esc(c.cert || '')}${c.cert ? ' — ' : ''}${esc(c.note || '')}</div></div>`).join('');
  return `<h2 class="sec">Competitor landscape</h2>
    ${list && list.length ? `<section class="grid3">${cards}</section>` : ''}
    ${landscape ? `<section class="card landscape">${esc(landscape)}</section>` : ''}`;
}

function simpleList(title, arr, ordered) {
  if (!Array.isArray(arr) || !arr.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<section class="card ${ordered ? 'actions' : ''}"><h2 class="sec">${esc(title)}</h2>
    <${tag}>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</${tag}></section>`;
}

function sourcesFooter(b) {
  const src = b.sources || {};
  const chips = Object.keys(src).map(k => `<span class="src ${src[k] === 'ok' ? 'ok' : 'bad'}">${esc(k)}</span>`).join('');
  const issues = (b.toolIssues || []).length ? ` &middot; issues: ${(b.toolIssues || []).map(esc).join('; ')}` : '';
  return `<footer>Sources: ${chips}${issues}<br>Generated ${esc(b.generatedAt || '')}</footer>`;
}

export function buildBriefHTML(b) {
  const headline = (b.headline || []).map(h => `<li>${esc(h)}</li>`).join('');
  return `
    <header class="top"><h1>EB Master Dashboard</h1>
      <span class="meta">Edition ${esc(b.edition)} &middot; ${esc(b.date)}</span></header>
    ${northStar(b.northStar)}
    ${headline ? `<section class="card"><h2 class="sec">Headline</h2><ul>${headline}</ul></section>` : ''}
    ${decisions(b.needsDecision)}
    ${kpiTiles(b.kpis)}
    ${chartsGrid(b.charts)}
    ${lensCard('cmo', 'CMO — Demand &amp; Marketing', b.lenses)}
    ${lensCard('cfo', 'CFO — Money', b.lenses)}
    ${lensCard('cto', 'CTO — Product / Tech / Ops', b.lenses)}
    ${lensCard('inbox', 'Inbox &amp; Comms', b.lenses)}
    ${socials(b.socials)}
    ${competitors(b.competitors, b.landscape)}
    ${simpleList('Today’s content angle', b.contentAngle, false)}
    ${simpleList('Action stack', b.actionStack, true)}
    ${sourcesFooter(b)}
  `;
}

// ---- browser-only chart rendering (skipped under node:test) ----
function renderCharts(brief) {
  if (typeof window === 'undefined' || !window.Chart) return;
  const palette = ['#58a6ff', '#3fb950', '#e3b341', '#f85149', '#bc8cff', '#39c5cf'];

  document.querySelectorAll('canvas.spark').forEach(cv => {
    let data = []; try { data = JSON.parse(cv.dataset.spark || '[]'); } catch { data = []; }
    new window.Chart(cv, {
      type: 'line',
      data: { labels: data.map((_, i) => i), datasets: [{ data, borderColor: '#58a6ff', borderWidth: 2, pointRadius: 0, tension: .35, fill: false }] },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, responsive: true, maintainAspectRatio: false }
    });
  });

  (brief.charts || []).forEach(c => {
    const el = document.getElementById('chart-' + c.id); if (!el) return;
    const datasets = (c.datasets || []).map((d, i) => ({
      label: d.label, data: d.data,
      backgroundColor: c.type === 'doughnut' ? palette : (d.color || palette[i % palette.length]),
      borderColor: d.color || palette[i % palette.length], borderWidth: 2,
      pointRadius: c.type === 'line' ? 2 : 0, tension: .3, fill: false
    }));
    new window.Chart(el, {
      type: c.type || 'line',
      data: { labels: c.labels, datasets },
      options: {
        plugins: { legend: { display: c.type === 'doughnut' || (c.datasets || []).length > 1, labels: { color: '#93a0b4' } } },
        scales: c.type === 'doughnut' ? {} : { x: { ticks: { color: '#93a0b4' }, grid: { color: '#27303f' } }, y: { ticks: { color: '#93a0b4' }, grid: { color: '#27303f' } } },
        responsive: true, maintainAspectRatio: false
      }
    });
  });
}

if (typeof document !== 'undefined') {
  fetch('./briefs/latest.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(b => { document.getElementById('app').innerHTML = buildBriefHTML(b); renderCharts(b); })
    .catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load latest brief.</p>'; });
}
