import { esc, freshnessBadge, statusPanel, mountErrorCapture } from './shared-ui.js';

// ---- live-data helpers (numbers come from latest.json — never hardcoded here) ----
function chById(latest, id) { return (((latest && latest.channels) || []).find(c => c.id === id)) || {}; }
function metric(ch, namePattern) {
  const m = ((ch && ch.metrics) || []).find(x => new RegExp(namePattern, 'i').test(x.name || ''));
  return m ? m.value : '';
}

const STATUS = {
  'not-contacted': ['muted', 'Not contacted'],
  'contacted': ['blue', 'Contacted'],
  'replied': ['accent', 'Replied'],
  'unit-sent': ['purple', 'Unit sent'],
  'posted': ['green', 'Posted'],
  'declined': ['muted', 'Declined']
};
function statusBadge(s) {
  const [cls, label] = STATUS[s] || STATUS['not-contacted'];
  return `<span class="m-badge ${cls}">${esc(label)}</span>`;
}
const AUTO_DOT = { live: 'green', pending: 'yellow', off: 'muted' };
function autoBadge(s) {
  const map = { live: ['green', 'Live'], pending: ['yellow', 'Pending'], off: ['muted', 'Off'], done: ['green', 'Done'], queued: ['yellow', 'Queued'], always: ['blue', 'Always'] };
  const [cls, label] = map[s] || ['muted', s || ''];
  return `<span class="m-badge ${cls}">${esc(label)}</span>`;
}

function statCard(label, value, sub, color) {
  return `<div class="m-stat"><div class="m-stat-label">${esc(label)}</div>
    <div class="m-stat-value"${color ? ` style="color:${color}"` : ''}>${esc(value || '—')}</div>
    <div class="m-stat-sub">${esc(sub || '')}</div></div>`;
}
function section(title, body) { return `<div class="m-section"><div class="m-section-title">${esc(title)}</div>${body}</div>`; }

function pillarsHtml(p) {
  if (!Array.isArray(p) || !p.length) return '';
  return section('Content Pillars — What to Post', `<div class="m-pillars">${p.map(x =>
    `<div class="m-pillar"><div class="m-pillar-emoji">${esc(x.emoji)}</div><div class="m-pillar-name">${esc(x.name)}</div>
     <div class="m-pillar-pct">${esc(x.pct)}%</div><div class="m-pillar-desc">${esc(x.desc)}</div></div>`).join('')}</div>`);
}
function cadenceHtml(c, note) {
  if (!Array.isArray(c) || !c.length) return '';
  const days = c.map(d => `<div class="m-day"><div class="m-day-name">${esc(d.day)}</div>
    <div class="m-day-platform">${esc(d.platform)}</div><div class="m-day-type">${esc(d.type)}</div></div>`).join('');
  return section('Weekly Posting Cadence — Target', `<div class="m-week">${days}</div>${note ? `<p class="m-note">${esc(note)}</p>` : ''}`);
}
function ideasHtml(ideas) {
  if (!ideas) return '';
  const col = (items, cls, label) => `<div><p class="m-ideas-head ${cls}">${esc(label)}</p><div class="m-idea-list">${(items || []).map(i =>
    `<div class="m-idea ${cls}"><div class="m-idea-icon">${esc(i.icon)}</div><div><div class="m-idea-text">${esc(i.text)}</div><div class="m-idea-note">${esc(i.note)}</div></div></div>`).join('')}</div></div>`;
  return section('Upcoming Content Ideas', `<div class="m-ideas">${col(ideas.high, 'high', '🔥 High priority — film first')}${col(ideas.medium, 'medium', '🔵 Medium priority')}</div>`);
}
function rulesHtml(r) {
  if (!Array.isArray(r) || !r.length) return '';
  return section('Content Rules — Non-Negotiable', `<div class="m-rules">${r.map((x, i) =>
    `<div class="m-rule"><div class="m-rule-num">${i + 1}</div>${esc(x)}</div>`).join('')}</div>`);
}
function influencerTable(list, tier) {
  const rows = list.filter(i => i.tier === tier);
  if (!rows.length) return '';
  return `<div class="m-table-wrap"><table class="m-table"><thead><tr><th>Creator</th><th>Platform</th><th>Audience</th><th>Region / fit</th><th>Status</th></tr></thead><tbody>${rows.map(i =>
    `<tr><td class="m-strong">${esc(i.name)}</td><td>${esc(i.platform)}</td><td>${esc(i.audience)}</td><td>${esc(i.fit || i.region)}</td><td>${statusBadge(i.status)}</td></tr>`).join('')}</tbody></table></div>`;
}
function influencersHtml(m) {
  const list = m.influencers;
  if (!Array.isArray(list) || !list.length) return '';
  const t3 = m.tier3 || {};
  const t3card = t3.title ? `<div class="m-card"><h3>${esc(t3.title)}</h3><p class="m-note">${esc(t3.desc || '')}</p>
    <div class="m-tags">${(t3.criteria || []).map(c => `<span class="m-badge accent">${esc(c)}</span>`).join('')}</div></div>` : '';
  const note = m.influencerNote ? `<div class="m-alert blue"><div>💡</div><div><strong>Untapped channel</strong>${esc(m.influencerNote)}</div></div>` : '';
  return section('🤝 Influencer Outreach Tracker',
    `${note}<p class="m-ideas-head accent">Tier 1 — global gear review (send first)</p>${influencerTable(list, 1)}
     <p class="m-ideas-head blue">Tier 2 — Asia / urban commuter</p>${influencerTable(list, 2)}${t3card}`);
}
function automationsHtml(m, mcContacts) {
  const a = m.automations;
  if (!Array.isArray(a) || !a.length) return '';
  const head = `<div class="m-mc"><div class="m-mc-card"><div class="m-mc-label">ManyChat contacts</div><div class="m-mc-value">${esc(mcContacts || '—')}</div><div class="m-mc-sub">live · keyword AIR</div></div></div>`;
  const rows = a.map(x => `<div class="m-row"><div><div class="m-row-name">${esc(x.name)}</div><div class="m-row-desc">${esc(x.desc)}</div></div>
    <div class="m-row-right"><span class="m-dot ${AUTO_DOT[x.status] || 'muted'}"></span>${autoBadge(x.status)}</div></div>`).join('');
  return section('🤖 ManyChat — Automation Status', `${head}<div class="m-rows">${rows}</div>`);
}
function emailHtml(m, em) {
  const plan = m.emailPlan;
  if (!Array.isArray(plan) || !plan.length) return '';
  const open = metric(em, 'open rate'), sendsLeft = metric(em, 'Sends left'), click = metric(em, 'click rate');
  const live = `<div class="m-mc"><div class="m-mc-card"><div class="m-mc-label">Avg open</div><div class="m-mc-value">${esc(open || '—')}</div></div>
    <div class="m-mc-card"><div class="m-mc-label">Avg click</div><div class="m-mc-value">${esc(click || '—')}</div></div>
    <div class="m-mc-card"><div class="m-mc-label">Sends left (mo)</div><div class="m-mc-value">${esc(sendsLeft || '—')}</div></div></div>`;
  const rows = plan.map(x => `<div class="m-row"><div><div class="m-row-name">${esc(x.name)}</div><div class="m-row-desc">${esc(x.desc)}</div></div>
    <div class="m-row-right">${autoBadge(x.status)}</div></div>`).join('');
  return section('📧 Brevo Email — Live Stats & Plan', `${live}<div class="m-rows">${rows}</div>`);
}

export function renderMarketing(latest, marketing) {
  latest = latest || {}; marketing = marketing || {};
  const ig = chById(latest, 'instagram'), yt = chById(latest, 'youtube'), mc = chById(latest, 'manychat'), em = chById(latest, 'email');
  const store = latest.store || {};
  const disc = (store.metrics || []).find(m => /discount/i.test(m.name || ''));
  const mcContacts = metric(mc, 'contacts') || (mc.headline || '');

  const stats = [
    statCard('Instagram', metric(ig, 'Followers'), 'followers', 'var(--eb-orange)'),
    statCard('YouTube', metric(yt, 'Total views') || metric(yt, 'views'), (metric(yt, 'Subscribers') ? `views · ${metric(yt, 'Subscribers')} subs` : 'views'), 'var(--bad)'),
    statCard('ManyChat', mcContacts, 'contacts · AIR keyword', 'var(--good)'),
    statCard('Email (active)', metric(em, 'Engaged') || metric(em, 'list'), (metric(em, 'open rate') ? `active · ${metric(em, 'open rate')} open` : 'active'), 'var(--good)'),
    statCard('Pre-order code', disc ? disc.value : 'EB25', disc ? (disc.delta || '') : '', 'var(--eb-blue)')
  ].join('');

  const igNote = Array.isArray(ig.notes) && ig.notes.length ? ig.notes[0] : '';
  const highlight = igNote ? `<div class="m-alert green"><div>✅</div><div><strong>Proven hooks are working — sustain the cadence</strong>${esc(igNote)}</div></div>` : '';

  return `
    <header class="topbar">
      <div class="logo"><span class="m-logo">🎯 Easi Breezi</span><span class="wm-sub">Marketing Hub</span></div>
      <div class="controls">
        <a class="m-back" href="./index.html">← Master</a>
        ${freshnessBadge(latest.generatedAt)}
      </div>
    </header>
    <nav class="drilldown"><span class="dd-label">Drill into detail</span>
      <a class="dd-link" href="./sales-funnel.html">🛒 Sales &amp; Shopify</a>
      <a class="dd-link" href="./team-budget.html">👥 Team &amp; Budget</a>
      <a class="dd-link" href="./stats.html">📈 Stats</a>
    </nav>
    <div class="m-stats">${stats}</div>
    ${highlight}
    ${pillarsHtml(marketing.pillars)}
    ${cadenceHtml(marketing.cadence, marketing.cadenceNote)}
    ${ideasHtml(marketing.ideas)}
    ${rulesHtml(marketing.rules)}
    ${influencersHtml(marketing)}
    ${automationsHtml(marketing, mcContacts)}
    ${emailHtml(marketing, em)}
    ${statusPanel(latest.sources, latest.toolIssues, latest.__build)}
  `;
}

// ---- browser bootstrap ----
if (typeof document !== 'undefined') {
  mountErrorCapture();
  Promise.all([
    fetch('./briefs/latest.json', { cache: 'no-store' }).then(r => r.json()),
    fetch('./marketing.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    fetch('/healthz', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([latest, marketing, health]) => {
    if (health && health.build) latest.__build = health.build;
    document.getElementById('app').innerHTML = renderMarketing(latest, marketing);
  }).catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load the marketing hub.</p>'; });
}
