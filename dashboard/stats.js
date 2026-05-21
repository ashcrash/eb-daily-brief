import { esc } from './shared-ui.js';

export function renderStats(data) {
  const views = data && data.views ? data.views : {};
  const errors = data && Array.isArray(data.errors) ? data.errors : [];
  const feedback = data && Array.isArray(data.feedback) ? data.feedback : [];

  // collapse "views:<date>:<path>" → per-path totals
  const byPath = {};
  for (const k of Object.keys(views)) {
    const path = k.split(':').slice(2).join(':') || '(unknown)';
    byPath[path] = (byPath[path] || 0) + Number(views[k] || 0);
  }
  const viewRows = Object.entries(byPath).sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `<tr><td>${esc(p)}</td><td class="num">${esc(n)}</td></tr>`).join('') || `<tr><td colspan="2">No views recorded yet.</td></tr>`;
  const errRows = errors.slice(0, 50).map(e => `<tr><td>${esc(e.ts || '')}</td><td>${esc(e.page || '')}</td><td>${esc(e.msg || '')}</td></tr>`).join('') || `<tr><td colspan="3">No client errors. 🎉</td></tr>`;
  const fbRows = feedback.slice(0, 50).map(f => {
    const notes = Array.isArray(f.comments) ? f.comments.map(c => `${esc(c.item)}: ${esc(c.note)}`).join('; ') : '';
    return `<tr><td>${esc(f.ts || '')}</td><td>${esc(f.page || '')}</td><td>${notes}</td></tr>`;
  }).join('') || `<tr><td colspan="3">No feedback submitted yet.</td></tr>`;

  return `
    <section class="statuspanel"><div class="sp-head">Page views (last 90 days)</div>
      <table class="metrics"><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>${viewRows}</tbody></table></section>
    <section class="statuspanel"><div class="sp-head">Recent client errors</div>
      <table class="metrics"><thead><tr><th>When</th><th>Page</th><th>Error</th></tr></thead><tbody>${errRows}</tbody></table></section>
    <section class="statuspanel"><div class="sp-head">Recent feedback</div>
      <table class="metrics"><thead><tr><th>When</th><th>Page</th><th>Notes</th></tr></thead><tbody>${fbRows}</tbody></table></section>`;
}

if (typeof document !== 'undefined') {
  fetch('/__stats.json', { cache: 'no-store' }).then(r => r.json())
    .then(d => { document.getElementById('app').innerHTML = renderStats(d); })
    .catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load stats.</p>'; });
}
