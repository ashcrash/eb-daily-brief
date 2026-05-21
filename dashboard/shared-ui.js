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
