// Cloudflare Worker — gates the static dashboard, hardens responses, exposes
// /healthz, records observability to KV, and self-monitors via cron.
// Secrets: DASH_PASSWORD (required), SLACK_WEBHOOK_URL (optional).
// Bindings: ASSETS (static), KV (observability — optional until bound),
//           CF_VERSION_METADATA (build stamp).
// DASH_PASSWORD MUST be an encrypted Secret, not a plaintext var: Workers Builds
// runs `wrangler deploy` on every git push, which preserves Secrets but DROPS
// plaintext vars not declared in wrangler.jsonc (would 503 the next deploy).
import { basicAuthOk } from './shared/auth.mjs';
import { securityHeaders } from './shared/security.mjs';
import { buildHealthBody, isTopLevelPath, viewKey } from './shared/monitor.mjs';

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1) Unauthenticated health endpoint — freshness/build only, no business data.
    if (path === '/healthz') {
      const latest = await readLatest(env);
      return json(buildHealthBody({ latest, build: buildInfo(env) }));
    }

    // 2) Auth gate (fail-closed).
    const expected = env.DASH_PASSWORD;
    if (!expected) {
      return new Response('Dashboard locked: DASH_PASSWORD is not configured.', {
        status: 503, headers: securityHeaders()
      });
    }
    if (!basicAuthOk(request.headers.get('Authorization'), expected)) {
      return new Response('Authentication required.', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="EB Brief", charset="UTF-8"',
          'Content-Type': 'text/plain',
          ...securityHeaders()
        }
      });
    }

    // 3) Authed observability routes are added in a later task. For now, serve assets.
    if (isTopLevelPath(path) && env.KV) {
      ctx.waitUntil((async () => {
        const date = new Date().toISOString().slice(0, 10);
        const key = viewKey(date, path);
        const cur = parseInt((await env.KV.get(key)) || '0', 10);
        await env.KV.put(key, String(cur + 1), { expirationTtl: 60 * 60 * 24 * 90 });
      })().catch(() => {}));
    }
    return serveAsset(request, env);
  }
};
