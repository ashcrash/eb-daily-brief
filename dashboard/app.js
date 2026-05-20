export function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function lensSection(key, title, lenses) {
  const l = (lenses || {})[key] || {};
  const metrics = (l.metrics || [])
    .map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.value)}</td><td>${esc(m.delta || '')}</td><td>${esc(m.flag || '')}</td></tr>`)
    .join('');
  const items = (l.items || [])
    .map(i => `<li><span class="u u-${esc(i.urgency || 'none')}">${esc(i.urgency || '')}</span> ${esc(i.summary)}</li>`)
    .join('');
  return `<section class="lens">
    <h2>${esc(title)}</h2>
    ${l.narrative ? `<p>${esc(l.narrative)}</p>` : ''}
    ${metrics ? `<table><thead><tr><th>Metric</th><th>Value</th><th>&Delta;</th><th>Flag</th></tr></thead><tbody>${metrics}</tbody></table>` : ''}
    ${items ? `<ul class="inbox">${items}</ul>` : ''}
  </section>`;
}

export function buildBriefHTML(b) {
  const headline = (b.headline || []).map(h => `<li>${esc(h)}</li>`).join('');
  const decisions = (b.needsDecision || [])
    .map(d => `<tr><td>${esc(d.item)}</td><td>${esc(d.lens)}</td><td>${esc(d.why)}</td></tr>`)
    .join('');
  const actions = (b.actionStack || []).map(a => `<li>${esc(a)}</li>`).join('');
  return `
    <header><h1>EB Daily Leadership Brief</h1>
      <p class="meta">Edition ${esc(b.edition)} &middot; ${esc(b.date)}</p></header>
    <section class="headline"><h2>Headline</h2><ul>${headline}</ul></section>
    ${decisions ? `<section class="decide"><h2>Needs a decision</h2>
      <table><thead><tr><th>Item</th><th>Lens</th><th>Why</th></tr></thead><tbody>${decisions}</tbody></table></section>` : ''}
    ${lensSection('cmo', 'CMO — Demand & Marketing', b.lenses)}
    ${lensSection('cfo', 'CFO — Money', b.lenses)}
    ${lensSection('cto', 'CTO — Product / Tech / Ops', b.lenses)}
    ${lensSection('inbox', 'Inbox & Comms', b.lenses)}
    <section class="actions"><h2>Action stack</h2><ol>${actions}</ol></section>
  `;
}

// Browser-only bootstrap (skipped under node:test where document is undefined)
if (typeof document !== 'undefined') {
  fetch('./briefs/latest.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(b => { document.getElementById('app').innerHTML = buildBriefHTML(b); })
    .catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load latest brief.</p>'; });
}
