export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// "data N old" badge — good ≤24h, warn ≤26h, bad >26h or unparseable.
export function freshnessBadge(generatedAt, now = Date.now()) {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return `<span class="freshness bad" title="No timestamp">data age unknown</span>`;
  const hrs = (now - t) / 3.6e6;
  const level = hrs > 26 ? 'bad' : hrs > 24 ? 'warn' : 'good';
  const label = hrs < 1 ? 'just now' : hrs < 48 ? `${Math.round(hrs)}h old` : `${Math.round(hrs / 24)}d old`;
  return `<span class="freshness ${level}" title="Data generated ${esc(generatedAt)}">data ${esc(label)}</span>`;
}

// System status: source RAG chips + tool issues + live build stamp.
export function statusPanel(sources, toolIssues, build) {
  const src = sources || {};
  const chips = Object.keys(src).map(k =>
    `<span class="src ${src[k] === 'ok' ? 'ok' : 'bad'}">${esc(k)}${src[k] === 'ok' ? '' : ' ✕'}</span>`).join('');
  const issues = Array.isArray(toolIssues) && toolIssues.length
    ? `<ul class="notes">${toolIssues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
  const stamp = build && build.id
    ? `<div class="buildstamp">build ${esc(String(build.id).slice(0, 8))}${build.timestamp ? ` · ${esc(build.timestamp)}` : ''}</div>` : '';
  return `<section class="statuspanel"><div class="sp-head">System status</div>
    <div class="sp-srcs">${chips}</div>${issues}${stamp}</section>`;
}

// Browser-only: capture client errors → POST /__client-error (best-effort).
export function mountErrorCapture() {
  if (typeof window === 'undefined') return;
  const send = (msg, src, line, col, stack) => {
    try {
      const body = JSON.stringify({
        msg: String(msg).slice(0, 300), src: String(src || '').slice(0, 200),
        line, col, stack: String(stack || '').slice(0, 500),
        page: location.pathname, ua: navigator.userAgent.slice(0, 200)
      });
      navigator.sendBeacon('/__client-error', body);
    } catch { /* never let logging break the page */ }
  };
  window.addEventListener('error', e => send(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => send('unhandledrejection: ' + ((e.reason && e.reason.message) || e.reason), '', 0, 0, e.reason && e.reason.stack));
}

// ---- unified brand header (logo image + wordmark + page name) ----
const EB_LOGO = './eb-logo-white.png';
export function logoBlock(subtitle = '') {
  return `<div class="logo"><img class="logomark" src="${EB_LOGO}" alt="Easi Breezi" />`
    + `<span class="wordmark">Easi Breezi</span>`
    + `${subtitle ? `<span class="wm-sub">${esc(subtitle)}</span>` : ''}</div>`;
}

// ---- professional inline line-icons (stroke = currentColor, replaces emoji) ----
const ICONS = {
  overview: '<path d="M3 13h8V3H3zM13 21h8V8h-8zM3 21h8v-6H3zM13 5h8V3h-8z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>',
  bulb: '<path d="M9 18h6M10 21.5h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.7.6-1 1.3-1 2.2V17h-5v-.3c0-.9-.3-1.6-1-2.2z"/>',
  check: '<path d="M4 12.5l5 5 11-11"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 6.5 9 6 9-6"/>',
  cart: '<circle cx="9.5" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h2.2l2.3 12.2a1.8 1.8 0 0 0 1.8 1.5h8.6a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6"/>',
  globe: '<circle cx="12" cy="12" r="9.2"/><path d="M3 12h18"/><path d="M12 2.8c2.6 2.5 4 5.8 4 9.2s-1.4 6.7-4 9.2c-2.6-2.5-4-5.8-4-9.2s1.4-6.7 4-9.2z"/>',
  box: '<path d="M21 8.4 12 3 3 8.4v7.2L12 21l9-5.4z"/><path d="m3 8.4 9 5.4 9-5.4M12 13.8V21"/>',
  trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  sliders: '<path d="M4 21v-6M4 11V3M12 21v-9M12 8V3M20 21v-4M20 13V3M1.5 15h5M9.5 8h5M17.5 17h5"/>',
  megaphone: '<path d="m3 11 16-5v12L3 14z"/><path d="M19 8a3 3 0 0 1 0 6"/><path d="M7 15v3a2 2 0 0 0 4 0"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2 2 0 0 0 0 4H7M17 6h2.5a2 2 0 0 1 0 4H17M9 18.5h6M12 14v4.5M8 21.5h8"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v4.5M12 17h.01"/>',
  bars: '<path d="M3 3v18h18"/><path d="M7.5 17v-5M12 17V8M16.5 17v-8"/>',
  star: '<path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9-2.6.9-5.5-4-3.9 5.5-.8z"/>',
  mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M8.5 21h7"/>',
  wind: '<path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 16h15a2.5 2.5 0 1 1-2.5 2.5"/>'
};
export function svgIcon(name, size = 17) {
  const d = ICONS[name];
  if (!d) return '';
  return `<svg class="eb-ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

// ---- Chart.js mount (browser-only) — doughnut / bar / line from simple specs ----
export function mountCharts(specs) {
  if (typeof window === 'undefined' || !window.Chart) return;
  const C = window.Chart;
  C.defaults.color = '#93a3b8';
  C.defaults.font.family = "'Chakra Petch',system-ui,sans-serif";
  const palette = ['#20BCF3', '#19799B', '#5fd0f7', '#2f86ad', '#FA800E', '#8bd4ef', '#7c8cff'];
  (specs || []).forEach(s => {
    const el = document.getElementById(s.id); if (!el) return;
    const type = s.type || 'doughnut';
    const ds = {
      label: s.label || '', data: s.data,
      backgroundColor: type === 'line' ? 'rgba(32,188,243,.12)' : (s.colors || palette),
      borderColor: type === 'line' ? '#20BCF3' : (type === 'bar' ? (s.colors || '#20BCF3') : '#0e1320'),
      borderWidth: 2, pointRadius: 0, tension: .35, borderRadius: type === 'bar' ? 5 : 0, fill: type === 'line'
    };
    new C(el, {
      type, data: { labels: s.labels, datasets: [ds] },
      options: {
        plugins: { legend: { display: type === 'doughnut', position: 'right', labels: { boxWidth: 9, boxHeight: 9, padding: 10, font: { size: 11 } } } },
        scales: type === 'doughnut' ? {} : { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#1f2a3d' }, ticks: { font: { size: 11 } }, beginAtZero: true } },
        responsive: true, maintainAspectRatio: false, cutout: type === 'doughnut' ? '62%' : undefined
      }
    });
  });
}
