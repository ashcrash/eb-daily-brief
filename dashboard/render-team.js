import { esc, freshnessBadge, statusPanel, mountErrorCapture, logoBlock, svgIcon } from './shared-ui.js';

function statCard(label, value, sub, color) {
  return `<div class="m-stat"><div class="m-stat-label">${esc(label)}</div>
    <div class="m-stat-value"${color ? ` style="color:${color}"` : ''}>${esc(value || '—')}</div>
    <div class="m-stat-sub">${esc(sub || '')}</div></div>`;
}
function section(title, body, icon) {
  return `<div class="m-section"><div class="m-section-title">${icon ? svgIcon(icon) : ''}<span>${esc(title)}</span></div>${body}</div>`;
}
function initial(name) { return esc((String(name || '?').trim()[0] || '?').toUpperCase()); }

function peopleHtml(people) {
  if (!Array.isArray(people) || !people.length) return '';
  return section('Stakeholder & supplier status', `<div class="m-people">${people.map(p => {
    const rows = (p.details || []).map(([k, v, cls]) => `<div class="m-drow"><span class="m-dkey">${esc(k)}</span><span class="m-dval ${cls || ''}">${esc(v)}</span></div>`).join('');
    return `<div class="m-person${p.needsInfo ? ' needs-info' : ''}"><div class="m-person-h"><div class="m-person-av">${initial(p.name)}</div>
      <div><div class="m-person-name">${esc(p.name)}</div><div class="m-person-role">${esc(p.role)}</div></div></div>
      <div>${rows}</div><div class="m-person-status"><span class="m-dot ${p.dot || 'muted'}"></span>${esc(p.status)}</div></div>`;
  }).join('')}</div>`, 'users');
}
function adHtml(channels) {
  if (!Array.isArray(channels) || !channels.length) return '';
  return section('Ad spend tracker', `<div class="m-ad">${channels.map(c => {
    const rows = (c.rows || []).map(([k, v, cls]) => `<div class="m-ad-stat"><span class="k">${esc(k)}</span><span class="v ${cls ? 'm-dval ' + cls : ''}">${esc(v)}</span></div>`).join('');
    return `<div class="m-ad-card"><div class="m-ad-plat">${esc(c.platform)}</div>${rows}<div class="m-prog"><div class="m-prog-fill" style="width:${Math.max(0, Math.min(100, c.pct || 0))}%${c.color ? `;background:${c.color}` : ''}"></div></div></div>`;
  }).join('')}</div>`, 'megaphone');
}
function milestonesHtml(ms, revenue) {
  if (!Array.isArray(ms) || !ms.length) return '';
  const mark = { done: '✓', active: '●', pending: '○' };
  return section('Revenue milestones', `<div class="m-ms">${ms.map(m => {
    const prog = m.live === 'revenue' && revenue ? `${revenue} ${m.progress}` : m.progress;
    const [bcls, blabel] = m.badge || ['muted', ''];
    return `<div class="m-ms-row"><div class="m-ms-check ${m.state}">${mark[m.state] || '○'}</div>
      <div style="flex:1"><div class="m-ms-label">${esc(m.label)}</div><div class="m-ms-prog">${esc(prog)}</div></div>
      <span class="m-badge ${bcls}">${esc(blabel)}</span></div>`;
  }).join('')}</div>`, 'trophy');
}
function risksHtml(risks) {
  if (!Array.isArray(risks) || !risks.length) return '';
  return section('Top risks right now', `<div class="m-risk">${risks.map((r, i) => {
    const [scls, slabel] = r.sev || ['muted', ''];
    return `<div class="m-risk-row"><div class="m-risk-num">${i + 1}</div>
      <div><div class="m-risk-title">${esc(r.title)}</div><div class="m-risk-desc">${esc(r.desc)}</div></div>
      <span class="m-badge ${scls}">${esc(slabel)}</span></div>`;
  }).join('')}</div>`, 'alert');
}

export function renderTeam(latest, team) {
  latest = latest || {}; team = team || {};
  const ns = latest.northStar || {};
  const mfg = latest.manufacturing || {};
  const revenue = ns.current != null ? `${ns.unit || ''}${Number(ns.current).toLocaleString()}` : '';

  const stats = [
    statCard('Revenue to date', revenue, ns.note || 'paid pre-orders', 'var(--eb-blue)'),
    statCard('Revenue target', team.target, 'first major milestone', 'var(--muted)'),
    statCard('Ad spend', team.adSpend, 'pre-launch — demand-first', 'var(--muted)'),
    statCard('Patent', team.patent ? team.patent.status : '', team.patent ? team.patent.date : '', 'var(--good)'),
    statCard('COG / unit', mfg.cog, 'confirmed', 'var(--good)'),
    statCard('Margin', mfg.margin, 'at list price', 'var(--good)')
  ].join('');

  return `
    <header class="topbar">
      ${logoBlock('Team & Budget')}
      <div class="controls">${freshnessBadge(latest.generatedAt)}</div>
    </header>
    <div class="m-stats">${stats}</div>
    ${peopleHtml(team.people)}
    ${adHtml(team.adChannels)}
    ${milestonesHtml(team.milestones, revenue)}
    ${risksHtml(team.risks)}
    ${statusPanel(latest.sources, latest.toolIssues, latest.__build)}
  `;
}

if (typeof document !== 'undefined') {
  mountErrorCapture();
  Promise.all([
    fetch('./briefs/latest.json', { cache: 'no-store' }).then(r => r.json()),
    fetch('./team-budget.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    fetch('/healthz', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([latest, team, health]) => {
    if (health && health.build) latest.__build = health.build;
    document.getElementById('app').innerHTML = renderTeam(latest, team);
  }).catch(() => { document.getElementById('app').innerHTML = '<p class="err">Failed to load team &amp; budget.</p>'; });
}
