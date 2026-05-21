// Cloudflare Worker — gates the static dashboard, hardens responses, exposes
// /healthz, records observability to KV, and self-monitors via cron.
// Secrets: DASH_PASSWORD (required), SLACK_WEBHOOK_URL (optional).
// Bindings: ASSETS (static), KV (observability — optional until bound),
//           CF_VERSION_METADATA (build stamp).
// DASH_PASSWORD MUST be an encrypted Secret, not a plaintext var: Workers Builds
// runs `wrangler deploy` on every git push, which preserves Secrets but DROPS
// plaintext vars not declared in wrangler.jsonc (would 503 the next deploy).
import { basicAuthOk, timingSafeEqualStr } from './shared/auth.mjs';
import { securityHeaders } from './shared/security.mjs';
import { parseCookies, wantsHtml, loginPageHTML, COOKIE } from './shared/session.mjs';
import { buildHealthBody, isTopLevelPath, viewKey, errorKey, feedbackKey, shouldAlert, slackStaleText, slackDownText } from './shared/monitor.mjs';

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...securityHeaders(), ...extra }
  });
}

function buildInfo(env) {
  const m = env.CF_VERSION_METADATA;
  return m ? { id: m.id || m.versionId || null, timestamp: m.timestamp || null, tag: m.tag || null } : null;
}

async function readLatest(env) {
  try {
    const res = await env.ASSETS.fetch(new Request('https://assets.local/briefs/latest.json'));
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function serveAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  const h = new Headers(res.headers);
  const sec = securityHeaders();
  for (const k in sec) h.set(k, sec[k]);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// Best-effort KV ingest for client errors + feedback, with a per-day flood cap.
async function ingest(request, env, keyFn) {
  if (!env.KV) return new Response(null, { status: 204, headers: securityHeaders() });
  let payload = {};
  try { payload = await request.json(); } catch { payload = {}; }
  const day = new Date().toISOString().slice(0, 10);
  const capKey = `cap:${keyFn === errorKey ? 'error' : 'feedback'}:${day}`;
  const n = parseInt((await env.KV.get(capKey)) || '0', 10);
  if (n < 500) {
    await env.KV.put(keyFn(), JSON.stringify({ ...payload, ts: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 30 });
    await env.KV.put(capKey, String(n + 1), { expirationTtl: 60 * 60 * 24 * 2 });
  }
  return new Response(null, { status: 204, headers: securityHeaders() });
}

// Aggregated observability for the gated /stats view.
async function statsJson(env) {
  if (!env.KV) return json({ views: {}, errors: [], feedback: [], note: 'KV not bound' });
  const out = { views: {}, errors: [], feedback: [] };
  const v = await env.KV.list({ prefix: 'views:' });
  for (const k of v.keys) out.views[k.name] = parseInt((await env.KV.get(k.name)) || '0', 10);
  const e = await env.KV.list({ prefix: 'error:', limit: 50 });
  for (const k of e.keys) { try { out.errors.push(JSON.parse(await env.KV.get(k.name))); } catch {} }
  const f = await env.KV.list({ prefix: 'feedback:', limit: 50 });
  for (const k of f.keys) { try { out.feedback.push(JSON.parse(await env.KV.get(k.name))); } catch {} }
  return json(out);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1) Unauthenticated health endpoint — freshness/build only, no business data.
    if (path === '/healthz') {
      const latest = await readLatest(env);
      return json(buildHealthBody({ latest, build: buildInfo(env) }));
    }

    // 2) Auth gate (fail-closed). Accepts Basic Auth, a session cookie, OR a
    //    login-form POST — so it works in mobile in-app browsers that suppress
    //    the native Basic-Auth dialog. Basic Auth stays intact for curl/desktop.
    const expected = env.DASH_PASSWORD;
    if (!expected) {
      return new Response('Dashboard locked: DASH_PASSWORD is not configured.', {
        status: 503, headers: securityHeaders()
      });
    }

    // Login-form submission → set an HttpOnly session cookie, then redirect in.
    if (request.method === 'POST' && path === '/__login') {
      let pw = '';
      try { pw = (await request.formData()).get('password') || ''; } catch { pw = ''; }
      if (timingSafeEqualStr(pw, expected)) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/',
            'Set-Cookie': `${COOKIE}=${encodeURIComponent(expected)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
            ...securityHeaders()
          }
        });
      }
      return new Response(loginPageHTML('Incorrect password — try again.'), {
        status: 401, headers: { 'Content-Type': 'text/html; charset=UTF-8', ...securityHeaders() }
      });
    }

    const cookies = parseCookies(request.headers.get('Cookie'));
    const authed = basicAuthOk(request.headers.get('Authorization'), expected)
      || timingSafeEqualStr(cookies[COOKIE] || '', expected);

    if (!authed) {
      // Browser navigation → friendly login form; API/asset/curl → 401 (+ Basic).
      if (wantsHtml(request.headers.get('Accept'))) {
        return new Response(loginPageHTML(), {
          status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', ...securityHeaders() }
        });
      }
      return new Response('Authentication required.', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="EB Brief", charset="UTF-8"',
          'Content-Type': 'text/plain',
          ...securityHeaders()
        }
      });
    }

    // 3) Authed observability routes (KV-backed; inert until KV is bound).
    if (request.method === 'POST' && path === '/__client-error') return ingest(request, env, errorKey);
    if (request.method === 'POST' && path === '/__feedback') return ingest(request, env, feedbackKey);
    if (request.method === 'GET' && path === '/__stats.json') return statsJson(env);

    // 4) Authed asset serving + view counting.
    if (isTopLevelPath(path) && env.KV) {
      ctx.waitUntil((async () => {
        const date = new Date().toISOString().slice(0, 10);
        const key = viewKey(date, path);
        const cur = parseInt((await env.KV.get(key)) || '0', 10);
        await env.KV.put(key, String(cur + 1), { expirationTtl: 60 * 60 * 24 * 90 });
      })().catch(() => {}));
    }
    return serveAsset(request, env);
  },

  // Cron (wrangler triggers.crons): freshness watchdog → Slack alert (de-duped).
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const latest = await readLatest(env);
      const health = buildHealthBody({ latest, build: buildInfo(env) });
      const nowIso = new Date().toISOString();
      if (env.KV) {
        await env.KV.put('monitor:lastCheck', nowIso);
        await env.KV.put('monitor:lastStatus', JSON.stringify(health));
      }
      const problem = !latest || !health.fresh;
      if (!problem) return;
      const lastAlertedAt = env.KV ? await env.KV.get('monitor:lastAlertedAt') : null;
      if (!shouldAlert(lastAlertedAt, Date.parse(nowIso))) return;
      if (env.SLACK_WEBHOOK_URL) {
        const text = !latest ? slackDownText() : slackStaleText(health);
        try {
          await fetch(env.SLACK_WEBHOOK_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });
          if (env.KV) await env.KV.put('monitor:lastAlertedAt', nowIso);
        } catch { /* webhook failure must not throw the cron */ }
      }
    })().catch(() => {}));
  }
};
