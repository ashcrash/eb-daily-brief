# EB Dashboard — Foundation, Hardening & Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the gating Worker, remove dead Netlify code, and stand up a self-contained ($0) monitoring layer (uptime + freshness, view analytics, client errors, build stamp) with Slack alerts — plus the shared-UI module the drill-down rebuilds (Plan 2) will consume.

**Architecture:** All decision logic lives in pure, dependency-free ES modules under `shared/` (testable with `node --test`, no Cloudflare runtime needed). `worker.js` wires those helpers and adds observability routes + a cron. Cloudflare KV stores view counts / errors / feedback; a Cron Trigger checks data freshness and alerts Slack. The dashboard gets a freshness badge, a system-status panel, and a gated `/stats` view via a new browser-loaded `dashboard/shared-ui.js`.

**Tech Stack:** Cloudflare Workers (Static Assets `run_worker_first`, KV, Cron Triggers, version_metadata), vanilla ESM (no build step), `node --test` (zero deps), Slack incoming webhook. Spec: `docs/specs/2026-05-21-dashboard-pro-monitoring-design.md`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `shared/auth.mjs` | Timing-safe password compare + Basic-Auth extraction | Create |
| `shared/security.mjs` | Response security-header set | Create |
| `shared/monitor.mjs` | Freshness math, health body, KV-key builders, alert gating, Slack text | Create |
| `dashboard/shared-ui.js` | Browser UI helpers: `esc`, `freshnessBadge`, `statusPanel`, `mountErrorCapture` | Create |
| `worker.js` | Wire auth + headers + `/healthz` + observability routes + view counters + `scheduled()` cron | Rewrite |
| `wrangler.jsonc` | Add KV / cron / version_metadata bindings | Modify |
| `dashboard/app.js` | Import `esc` from shared-ui (re-export), render badge + status panel, error capture, feedback→`/__feedback` | Modify |
| `dashboard/index.html` | Remove dead hidden Netlify form | Modify |
| `dashboard/styles.css` | Styles for `.freshness`, `.statuspanel`, `.buildstamp`, `.src.ok` | Modify |
| `dashboard/stats.html` + `dashboard/stats.js` | Gated stats view (views / errors / feedback) | Create |
| `publish/slack-summary.mjs` | Pure `buildDailySummary(brief, stats)` Slack text for the daily CC task | Create |
| `netlify.toml`, `netlify/edge-functions/auth.js`, `functions/_middleware.js`, `.netlify/state.json` | Dead (Cloudflare is the host) | `git rm` |
| `README.md` | Record live URL + monitoring/ops notes | Modify |
| `test/auth.test.mjs`, `test/security.test.mjs`, `test/monitor.test.mjs`, `test/shared-ui.test.mjs`, `test/slack-summary.test.mjs` | Unit tests | Create |

---

## Phase 0 — Hygiene & Hardening

### Task 1: Remove dead Netlify artifacts + hidden form + dead feedback POST

**Files:**
- Delete: `netlify.toml`, `netlify/edge-functions/auth.js`, `functions/_middleware.js`, `.netlify/state.json`
- Modify: `dashboard/index.html` (remove the hidden `<form>`)
- Modify: `dashboard/app.js` (remove the dead `fetch('/', …)` Netlify-form POST; keep the clipboard path)

- [ ] **Step 1: Confirm tests are green before touching anything**

Run: `cd C:\Users\ashle\eb-daily-brief && npm test`
Expected: existing suites (schema, render, publish) PASS.

- [ ] **Step 2: Remove the dead Netlify files (history-preserving)**

```bash
cd C:\Users\ashle\eb-daily-brief
git rm netlify.toml netlify/edge-functions/auth.js functions/_middleware.js
git rm --cached .netlify/state.json
```
(`.netlify/state.json` is local CLI state; `--cached` untracks it without erroring if already gitignored. If `git rm` reports a path doesn't exist, it was already gone — continue.)

- [ ] **Step 3: Add `.netlify/` to `.gitignore`**

Append to `.gitignore`:
```
.netlify/
```

- [ ] **Step 4: Remove the hidden Netlify form from `dashboard/index.html`**

Delete this entire block (lines 17–24):
```html
  <!-- Hidden static form so Netlify detects + provisions the feedback form (the live form is rendered by app.js and submits here via fetch). -->
  <form name="dashboard-feedback" data-netlify="true" netlify-honeypot="bot-field" hidden>
    <input type="hidden" name="form-name" value="dashboard-feedback">
    <input type="text" name="bot-field">
    <input type="text" name="edition">
    <input type="text" name="page">
    <textarea name="comments"></textarea>
  </form>
```

- [ ] **Step 5: Remove the dead Netlify-form POST in `dashboard/app.js`**

In `submitFeedback()`, delete this block (the "Bonus channel" Netlify fetch):
```js
    // Bonus channel: also submit to the Netlify form (auto-capture when available).
    try {
      const body = new URLSearchParams({ 'form-name': 'dashboard-feedback', 'bot-field': '', edition: String(ed), page: 'master', comments: JSON.stringify(comments) });
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }).catch(() => {});
    } catch { /* ignore */ }
```
Leave the clipboard logic intact. (Task 9 re-adds a real `/__feedback` POST.)

- [ ] **Step 6: Run tests + commit**

Run: `npm test`
Expected: all PASS (no behavior under test changed).
```bash
git add -A
git commit -m "chore: drop dead Netlify artifacts + hidden form + dead feedback POST"
```

---

### Task 2: Timing-safe auth helper (TDD)

**Files:**
- Create: `shared/auth.mjs`
- Test: `test/auth.test.mjs`

- [ ] **Step 1: Write the failing test** — `test/auth.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqualStr, basicAuthOk } from '../shared/auth.mjs';

test('equal strings compare true', () => {
  assert.equal(timingSafeEqualStr('hunter2', 'hunter2'), true);
});
test('different strings compare false', () => {
  assert.equal(timingSafeEqualStr('hunter2', 'hunter3'), false);
});
test('different lengths compare false', () => {
  assert.equal(timingSafeEqualStr('abc', 'abcd'), false);
});
test('null/undefined safe', () => {
  assert.equal(timingSafeEqualStr(null, undefined), true); // both coerce to ''
  assert.equal(timingSafeEqualStr('x', null), false);
});
test('basicAuthOk accepts the right password (username ignored)', () => {
  const header = 'Basic ' + Buffer.from('anyuser:s3cret').toString('base64');
  assert.equal(basicAuthOk(header, 's3cret'), true);
});
test('basicAuthOk rejects wrong password', () => {
  const header = 'Basic ' + Buffer.from('u:nope').toString('base64');
  assert.equal(basicAuthOk(header, 's3cret'), false);
});
test('basicAuthOk rejects when no expected configured', () => {
  const header = 'Basic ' + Buffer.from('u:anything').toString('base64');
  assert.equal(basicAuthOk(header, ''), false);
});
test('basicAuthOk rejects malformed / non-Basic headers', () => {
  assert.equal(basicAuthOk('', 's3cret'), false);
  assert.equal(basicAuthOk('Bearer xyz', 's3cret'), false);
  assert.equal(basicAuthOk('Basic !!!notbase64', 's3cret'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/auth.test.mjs`
Expected: FAIL — `Cannot find module '../shared/auth.mjs'`.

- [ ] **Step 3: Write minimal implementation** — `shared/auth.mjs`

```js
// Constant-time string comparison + Basic-Auth password extraction.
// Timing-safe to avoid leaking password length/prefix via response timing.
export function timingSafeEqualStr(a, b) {
  const sa = String(a ?? ''), sb = String(b ?? '');
  const len = Math.max(sa.length, sb.length);
  let diff = sa.length ^ sb.length;
  for (let i = 0; i < len; i++) {
    diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// True when the request's Basic-Auth password matches `expected`. Username ignored.
export function basicAuthOk(authHeader, expected) {
  if (!expected) return false;
  const [scheme, encoded] = String(authHeader || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  let decoded = '';
  try { decoded = atob(encoded); } catch { return false; }
  // Reject byte sequences that aren't valid base64 round-trips (atob is lenient).
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return timingSafeEqualStr(password, expected);
}
```
Note: `atob` is a global in Workers and in Node ≥18 (the project's runtime). For `!!!notbase64`, `atob` throws or yields garbage that won't equal the expected password — both paths return false.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/auth.test.mjs`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/auth.mjs test/auth.test.mjs
git commit -m "feat(worker): timing-safe Basic-Auth helper"
```

---

### Task 3: Security-headers helper (TDD)

**Files:**
- Create: `shared/security.mjs`
- Test: `test/security.test.mjs`

- [ ] **Step 1: Write the failing test** — `test/security.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from '../shared/security.mjs';

test('returns the full hardening header set', () => {
  const h = securityHeaders();
  for (const k of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','X-Robots-Tag']) {
    assert.ok(k in h, `missing ${k}`);
  }
});
test('CSP allows fonts + jsdelivr (Chart.js) and self connect, denies framing', () => {
  const csp = securityHeaders()['Content-Security-Policy'];
  assert.match(csp, /script-src[^;]*cdn\.jsdelivr\.net/);
  assert.match(csp, /font-src[^;]*fonts\.gstatic\.com/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});
test('noindex preserved', () => {
  assert.match(securityHeaders()['X-Robots-Tag'], /noindex/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/security.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `shared/security.mjs`

```js
// Security headers applied to every gated response (and /healthz).
export function securityHeaders() {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'"
    ].join('; '),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'X-Robots-Tag': 'noindex, nofollow'
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/security.test.mjs`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/security.mjs test/security.test.mjs
git commit -m "feat(worker): security-header set helper"
```

---

### Task 4: Monitoring logic module (TDD)

**Files:**
- Create: `shared/monitor.mjs`
- Test: `test/monitor.test.mjs`

- [ ] **Step 1: Write the failing test** — `test/monitor.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageHours, freshness, buildHealthBody, isTopLevelPath, viewKey, shouldAlert, STALE_BAD_HOURS } from '../shared/monitor.mjs';

const NOW = Date.parse('2026-05-21T12:00:00Z');

test('ageHours computes hours since generatedAt', () => {
  assert.equal(ageHours('2026-05-21T06:00:00Z', NOW), 6);
});
test('ageHours returns Infinity on bad input', () => {
  assert.equal(ageHours('not-a-date', NOW), Infinity);
});
test('freshness thresholds', () => {
  assert.equal(freshness(1), 'good');
  assert.equal(freshness(25), 'warn');
  assert.equal(freshness(40), 'bad');
});
test('buildHealthBody fresh', () => {
  const b = buildHealthBody({ latest: { date: '2026-05-21', generatedAt: '2026-05-21T06:00:00Z' }, build: { id: 'abc' }, now: NOW });
  assert.equal(b.status, 'ok');
  assert.equal(b.fresh, true);
  assert.equal(b.ageHours, 6);
  assert.equal(b.build.id, 'abc');
});
test('buildHealthBody degraded when no latest', () => {
  const b = buildHealthBody({ latest: null, build: null, now: NOW });
  assert.equal(b.status, 'degraded');
  assert.equal(b.fresh, false);
});
test('buildHealthBody stale when older than bad threshold', () => {
  const old = new Date(NOW - (STALE_BAD_HOURS + 2) * 3.6e6).toISOString();
  const b = buildHealthBody({ latest: { date: 'x', generatedAt: old }, now: NOW });
  assert.equal(b.fresh, false);
});
test('isTopLevelPath only matches dashboard pages', () => {
  assert.equal(isTopLevelPath('/marketing-hub'), true);
  assert.equal(isTopLevelPath('/marketing-hub.html'), true);
  assert.equal(isTopLevelPath('/briefs/latest.json'), false);
  assert.equal(isTopLevelPath('/styles.css'), false);
});
test('viewKey shape', () => {
  assert.equal(viewKey('2026-05-21', '/'), 'views:2026-05-21:/');
});
test('shouldAlert respects cooldown', () => {
  assert.equal(shouldAlert(null, NOW), true);
  assert.equal(shouldAlert(new Date(NOW - 1 * 3.6e6).toISOString(), NOW), false); // 1h ago < 6h cooldown
  assert.equal(shouldAlert(new Date(NOW - 7 * 3.6e6).toISOString(), NOW), true);  // 7h ago > cooldown
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/monitor.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `shared/monitor.mjs`

```js
export const STALE_WARN_HOURS = 24;
export const STALE_BAD_HOURS = 26;
export const ALERT_COOLDOWN_HOURS = 6;
export const TOP_LEVEL_PAGES = [
  '/', '/index.html',
  '/marketing-hub', '/marketing-hub.html',
  '/sales-funnel', '/sales-funnel.html',
  '/team-budget', '/team-budget.html',
  '/stats', '/stats.html'
];

export function ageHours(generatedAt, now = Date.now()) {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / 3.6e6;
}
export function freshness(hrs) {
  if (hrs > STALE_BAD_HOURS) return 'bad';
  if (hrs > STALE_WARN_HOURS) return 'warn';
  return 'good';
}
export function buildHealthBody({ latest, build = null, now = Date.now() }) {
  const gen = latest && latest.generatedAt ? latest.generatedAt : null;
  const hrs = gen ? ageHours(gen, now) : Infinity;
  return {
    status: latest ? 'ok' : 'degraded',
    briefDate: latest && latest.date ? latest.date : null,
    generatedAt: gen,
    ageHours: Number.isFinite(hrs) ? Math.round(hrs * 10) / 10 : null,
    fresh: Number.isFinite(hrs) ? hrs <= STALE_BAD_HOURS : false,
    build
  };
}
export function isTopLevelPath(p) { return TOP_LEVEL_PAGES.includes(p); }
export function viewKey(date, p) { return `views:${date}:${p}`; }
export function errorKey(ts = new Date().toISOString()) { return `error:${ts}-${Math.random().toString(36).slice(2, 8)}`; }
export function feedbackKey(ts = new Date().toISOString()) { return `feedback:${ts}-${Math.random().toString(36).slice(2, 8)}`; }
export function shouldAlert(lastAlertedAt, now = Date.now()) {
  if (!lastAlertedAt) return true;
  const t = Date.parse(lastAlertedAt);
  if (Number.isNaN(t)) return true;
  return (now - t) / 3.6e6 >= ALERT_COOLDOWN_HOURS;
}
const HEALTHZ_URL = 'https://eb-daily-brief.ashleyvisions.workers.dev/healthz';
export function slackStaleText(health) {
  const age = health.ageHours == null ? 'unknown' : `${health.ageHours}h`;
  return `:warning: *EB Dashboard data is stale* — last brief ${health.briefDate || '?'} (generated ${age} ago). The daily publish may have failed. ${HEALTHZ_URL}`;
}
export function slackDownText() {
  return `:rotating_light: *EB Dashboard health check failed* — latest.json unreachable. ${HEALTHZ_URL}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/monitor.test.mjs`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/monitor.mjs test/monitor.test.mjs
git commit -m "feat(worker): monitoring logic — freshness, health body, alert gating"
```

---

### Task 5: Wire the Worker (auth + headers + /healthz) and add bindings

**Files:**
- Rewrite: `worker.js`
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Update `wrangler.jsonc`** with KV / cron / version_metadata bindings

```jsonc
{
  // Cloudflare Workers Static Assets deploy for the EB master dashboard.
  // worker.js runs FIRST on every request (run_worker_first) to enforce Basic
  // Auth + security headers + observability, then serves ./dashboard via ASSETS.
  // Secrets (set in the CF dashboard, NOT here): DASH_PASSWORD, SLACK_WEBHOOK_URL.
  "name": "eb-daily-brief",
  "main": "worker.js",
  "compatibility_date": "2025-05-01",
  "assets": {
    "directory": "./dashboard",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "observability": { "enabled": true },
  "version_metadata": { "binding": "CF_VERSION_METADATA" },
  "triggers": { "crons": ["*/30 * * * *"] },
  "kv_namespaces": [
    { "binding": "KV", "id": "<KV_NAMESPACE_ID — Ash creates in CF dashboard → Workers & Pages → KV → paste id here>" }
  ]
}
```
> The KV `id` is a real Cloudflare-assigned value filled in once at setup (analogous to the assigned hostname in the Phase-1 deploy plan). Until it's set, the Worker degrades gracefully (KV writes are skipped — see Task 6). If `wrangler kv namespace create EB_DASH_KV` is available/authed, use the id it prints; otherwise Ash creates it in the dashboard.

- [ ] **Step 2: Rewrite `worker.js`** (fetch: auth + headers + /healthz; scheduled stub added in Task 7)

```js
// Cloudflare Worker — gates the static dashboard, hardens responses, exposes
// /healthz, records observability to KV, and self-monitors via cron.
// Secrets: DASH_PASSWORD (required), SLACK_WEBHOOK_URL (optional).
// Bindings: ASSETS (static), KV (observability), CF_VERSION_METADATA (build stamp).
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

    // 3) Authed observability routes are added in Task 6. For now, serve assets.
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
```

- [ ] **Step 3: Run the full unit suite (worker.js isn't unit-run, but imports must resolve for the helpers)**

Run: `npm test`
Expected: all PASS (auth/security/monitor/schema/render/publish).

- [ ] **Step 4: Commit**

```bash
git add worker.js wrangler.jsonc
git commit -m "feat(worker): timing-safe auth, security headers, /healthz, view counters + KV/cron/version bindings"
```

---

## Phase 1 — Monitoring routes, UI, cron, pipeline

### Task 6: Observability routes — client-error, feedback, stats (Worker)

**Files:**
- Modify: `worker.js` (add the three authed routes before the asset fallthrough)

- [ ] **Step 1: Add route handlers** in `worker.js` — insert these helpers above `export default`:

```js
import { errorKey, feedbackKey } from './shared/monitor.mjs';

async function ingest(request, env, keyFn) {
  if (!env.KV) return new Response(null, { status: 204, headers: securityHeaders() });
  let payload = {};
  try { payload = await request.json(); } catch { payload = {}; }
  // Daily flood cap (best-effort): skip writes past 500/day for the prefix.
  const day = new Date().toISOString().slice(0, 10);
  const capKey = `cap:${keyFn === errorKey ? 'error' : 'feedback'}:${day}`;
  const n = parseInt((await env.KV.get(capKey)) || '0', 10);
  if (n < 500) {
    await env.KV.put(keyFn(), JSON.stringify({ ...payload, ts: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 30 });
    await env.KV.put(capKey, String(n + 1), { expirationTtl: 60 * 60 * 24 * 2 });
  }
  return new Response(null, { status: 204, headers: securityHeaders() });
}

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
```

- [ ] **Step 2: Route them** — in `fetch`, immediately after the auth gate (before the view-counter/asset block):

```js
    if (request.method === 'POST' && path === '/__client-error') return ingest(request, env, errorKey);
    if (request.method === 'POST' && path === '/__feedback') return ingest(request, env, feedbackKey);
    if (request.method === 'GET' && path === '/__stats.json') return statsJson(env);
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all PASS (no new unit test; logic is thin glue over KV. Behavior verified post-deploy via Task 12).

- [ ] **Step 4: Commit**

```bash
git add worker.js
git commit -m "feat(worker): KV-backed client-error, feedback, and stats routes"
```

---

### Task 7: Self-monitoring cron (Worker `scheduled`)

**Files:**
- Modify: `worker.js` (add a `scheduled` export alongside `fetch`)

- [ ] **Step 1: Add the `scheduled` handler.** Change `export default { async fetch… }` to also include `scheduled`:

```js
import { buildHealthBody, isTopLevelPath, viewKey } from './shared/monitor.mjs';
import { shouldAlert, slackStaleText, slackDownText } from './shared/monitor.mjs';

// …inside export default, as a sibling of fetch():
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
```
(Consolidate the two `monitor.mjs` import lines into one if the linter prefers; both import from the same module.)

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all PASS (the alert-gating + text are already covered in `test/monitor.test.mjs`).

- [ ] **Step 3: Commit**

```bash
git add worker.js
git commit -m "feat(worker): cron self-monitor — freshness check + Slack alert (de-duped)"
```

---

### Task 8: Shared-UI module + master integration (TDD)

**Files:**
- Create: `dashboard/shared-ui.js`
- Test: `test/shared-ui.test.mjs`
- Modify: `dashboard/app.js` (import+re-export `esc`; render badge + status panel)
- Modify: `dashboard/styles.css` (badge / panel styles)

- [ ] **Step 1: Write the failing test** — `test/shared-ui.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, freshnessBadge, statusPanel } from '../dashboard/shared-ui.js';

const NOW = Date.parse('2026-05-21T12:00:00Z');

test('esc escapes html-significant chars', () => {
  assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
});
test('freshnessBadge good under 24h', () => {
  const html = freshnessBadge('2026-05-21T06:00:00Z', NOW);
  assert.match(html, /freshness good/);
  assert.match(html, /6h old/);
});
test('freshnessBadge bad over 26h', () => {
  const html = freshnessBadge('2026-05-19T00:00:00Z', NOW);
  assert.match(html, /freshness bad/);
});
test('freshnessBadge handles bad timestamp', () => {
  assert.match(freshnessBadge('nonsense', NOW), /freshness bad/);
});
test('statusPanel renders ok + bad source chips and build stamp', () => {
  const html = statusPanel({ shopify: 'ok', ga4: 'error' }, ['GA4 pull failed'], { id: 'abc12345', timestamp: '2026-05-21' });
  assert.match(html, /shopify/);
  assert.match(html, /src bad/);
  assert.match(html, /GA4 pull failed/);
  assert.match(html, /build abc12345/);
});
test('statusPanel safe with empty inputs', () => {
  assert.doesNotThrow(() => statusPanel(null, null, null));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/shared-ui.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `dashboard/shared-ui.js`**

```js
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
  window.addEventListener('unhandledrejection', e => send('unhandledrejection: ' + (e.reason && e.reason.message || e.reason), '', 0, 0, e.reason && e.reason.stack));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/shared-ui.test.mjs`
Expected: PASS — 6 tests.

- [ ] **Step 5: Integrate into `dashboard/app.js`** — at the top, replace the local `esc` definition with an import + re-export so existing `test/render.test.mjs` (which imports `esc` from `app.js`) still passes:

Replace lines 1–3 (the `export function esc…` block) with:
```js
import { esc, freshnessBadge, statusPanel, mountErrorCapture } from './shared-ui.js';
export { esc };
```

In `topbar(b)`, add the badge into `.controls` (after the `.ed` span):
```js
      <span class="ed num">Ed. ${esc(b.edition)} · ${esc(b.date)}</span>
      ${freshnessBadge(b.generatedAt)}
```

In `buildBriefHTML(b)`, render the status panel right before `${footer(b)}`:
```js
    ${statusPanel(b.sources, b.toolIssues, b.__build)}
    ${footer(b)}
```

In the browser `mount(b)` path, call `mountErrorCapture()` once. At the very top of the `if (typeof document !== 'undefined') {` block body, add:
```js
  mountErrorCapture();
```
And populate `b.__build` from `/healthz` before mount — in the initial fetch chain, replace:
```js
  fetch('./briefs/latest.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(b => mount(b, false))
    .catch(() => { $('#app').innerHTML = '<p class="err">Failed to load the brief.</p>'; });
```
with:
```js
  Promise.all([
    fetch('./briefs/latest.json', { cache: 'no-store' }).then(r => r.json()),
    fetch('/healthz', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([b, health]) => { if (health && health.build) b.__build = health.build; mount(b, false); })
    .catch(() => { $('#app').innerHTML = '<p class="err">Failed to load the brief.</p>'; });
```

- [ ] **Step 6: Add styles** — append to `dashboard/styles.css`:

```css
/* ---- monitoring: freshness badge + system status ---- */
.freshness{font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;border:1px solid var(--line2)}
.freshness.good{color:var(--good);background:rgba(53,192,138,.12);border-color:rgba(53,192,138,.3)}
.freshness.warn{color:var(--amber);background:rgba(230,178,62,.12);border-color:rgba(230,178,62,.3)}
.freshness.bad{color:var(--bad);background:rgba(240,98,90,.12);border-color:rgba(240,98,90,.3)}
.statuspanel{border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel);padding:14px 16px;margin:0 0 16px}
.statuspanel .sp-head{font-family:var(--display);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-bottom:10px}
.statuspanel .sp-srcs{display:flex;flex-wrap:wrap;gap:0}
.src.ok{color:var(--good)}
.buildstamp{color:var(--faint);font-size:11px;margin-top:10px;font-variant-numeric:tabular-nums}
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all PASS — including the existing `render.test.mjs` (esc still exported from app.js).

- [ ] **Step 8: Commit**

```bash
git add dashboard/shared-ui.js test/shared-ui.test.mjs dashboard/app.js dashboard/styles.css
git commit -m "feat(dash): shared-ui module + freshness badge + system-status panel + error capture"
```

---

### Task 9: Real feedback persistence (replace the clipboard-only path)

**Files:**
- Modify: `dashboard/app.js` (`submitFeedback` POSTs to `/__feedback`)

- [ ] **Step 1: In `submitFeedback()`**, after the clipboard block, add a real POST to the new endpoint:

```js
    // Persist server-side too (KV via the worker), best-effort. Clipboard stays primary.
    try {
      navigator.sendBeacon('/__feedback', JSON.stringify({ edition: ed, date, page: 'master', comments }));
    } catch { /* ignore */ }
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all PASS (render tests unaffected; `submitFeedback` is browser-only).

- [ ] **Step 3: Commit**

```bash
git add dashboard/app.js
git commit -m "feat(dash): persist feedback to /__feedback (KV) alongside clipboard"
```

---

### Task 10: Gated `/stats` view

**Files:**
- Create: `dashboard/stats.html`, `dashboard/stats.js`
- Modify: `dashboard/app.js` (`detailLinks()` adds a Stats link)
- Test: `test/shared-ui.test.mjs` (extend with a `renderStats` pure-function test) — OR a small `dashboard/stats.js` pure export.

- [ ] **Step 1: Write the failing test** — append to `test/shared-ui.test.mjs`:

```js
import { renderStats } from '../dashboard/stats.js';

test('renderStats groups views by page and lists errors', () => {
  const html = renderStats({
    views: { 'views:2026-05-21:/': 5, 'views:2026-05-21:/marketing-hub': 3 },
    errors: [{ msg: 'boom', page: '/marketing-hub', ts: '2026-05-21T10:00:00Z' }],
    feedback: [{ page: 'master', comments: [{ item: 'KPIs', note: 'love it' }], ts: '2026-05-21T11:00:00Z' }]
  });
  assert.match(html, /\/marketing-hub/);
  assert.match(html, /boom/);
  assert.match(html, /love it/);
});
test('renderStats safe on empty', () => {
  assert.doesNotThrow(() => renderStats({ views: {}, errors: [], feedback: [] }));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/shared-ui.test.mjs`
Expected: FAIL — `Cannot find module '../dashboard/stats.js'`.

- [ ] **Step 3: Write `dashboard/stats.js`**

```js
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
```

- [ ] **Step 4: Write `dashboard/stats.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Easi Breezi — Dashboard Stats</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Chakra+Petch:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main id="app"><p class="loading">Loading stats&hellip;</p></main>
  <script type="module" src="./stats.js"></script>
</body>
</html>
```

- [ ] **Step 5: Add the Stats link** in `dashboard/app.js` `detailLinks()` array:

```js
    { href: './team-budget.html', label: 'Team & Budget', icon: '👥' },
    { href: './stats.html', label: 'Dashboard Stats', icon: '📈' }
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS — including the two new `renderStats` tests.

- [ ] **Step 7: Commit**

```bash
git add dashboard/stats.html dashboard/stats.js dashboard/app.js test/shared-ui.test.mjs
git commit -m "feat(dash): gated /stats view — views, client errors, feedback"
```

---

### Task 11: Daily Slack summary helper (pure) + SOP note

**Files:**
- Create: `publish/slack-summary.mjs`
- Test: `test/slack-summary.test.mjs`
- Modify: `README.md` (document that the CC daily task calls this + sends via Slack MCP, and that the brief now includes a ManyChat metric)

- [ ] **Step 1: Write the failing test** — `test/slack-summary.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailySummary } from '../publish/slack-summary.mjs';

const brief = {
  edition: 6, date: '2026-05-21',
  sources: { shopify: 'ok', ga4: 'ok', gsc: 'error' },
  toolIssues: ['GSC token expired']
};
const stats = { views: { 'views:2026-05-21:/': 4 }, errors: [{ msg: 'x' }], feedback: [] };

test('summary names the edition + date', () => {
  assert.match(buildDailySummary(brief, stats, { deploy: 'ok' }), /Edition 6 · 2026-05-21/);
});
test('summary flags a failed source', () => {
  assert.match(buildDailySummary(brief, stats, { deploy: 'ok' }), /gsc/);
});
test('summary flags client errors count', () => {
  assert.match(buildDailySummary(brief, stats, { deploy: 'ok' }), /1 client error/);
});
test('summary clean when all ok', () => {
  const txt = buildDailySummary({ edition: 7, date: '2026-05-22', sources: { shopify: 'ok' }, toolIssues: [] }, { views: {}, errors: [], feedback: [] }, { deploy: 'ok' });
  assert.match(txt, /all sources ok/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/slack-summary.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `publish/slack-summary.mjs`**

```js
// Pure builder for the daily health summary the CC task sends via the Slack MCP.
export function buildDailySummary(brief, stats = {}, opts = {}) {
  const src = brief.sources || {};
  const bad = Object.keys(src).filter(k => src[k] !== 'ok');
  const issues = Array.isArray(brief.toolIssues) ? brief.toolIssues : [];
  const errs = Array.isArray(stats.errors) ? stats.errors.length : 0;
  const views = stats.views ? Object.values(stats.views).reduce((a, b) => a + Number(b || 0), 0) : 0;
  const lines = [
    `:bar_chart: *EB Dashboard published* — Edition ${brief.edition} · ${brief.date}`,
    `• Deploy: ${opts.deploy || 'unknown'}`,
    bad.length ? `• :red_circle: Sources failing: ${bad.join(', ')}` : `• :large_green_circle: all sources ok`,
    issues.length ? `• Tool issues: ${issues.join('; ')}` : null,
    `• ${errs} client error${errs === 1 ? '' : 's'} captured · ${views} page views (90d)`
  ].filter(Boolean);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/slack-summary.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Document the ops loop in `README.md`** — append:

```markdown

## Monitoring & ops
- **Live (gated):** https://eb-daily-brief.ashleyvisions.workers.dev · password = `DASH_PASSWORD` Secret.
- **Health (unauth):** `/healthz` → `{status, briefDate, generatedAt, ageHours, fresh, build}`.
- **Real-time alerts:** the Worker cron (`*/30`) checks freshness; if stale/down and `SLACK_WEBHOOK_URL` (Secret) is set, it posts to Slack (de-duped 6h).
- **Daily summary:** the `eb-daily-leadership-brief` CC task, after publish, calls `buildDailySummary(brief, stats, {deploy})` (`publish/slack-summary.mjs`), reads `/__stats.json`, and sends the result via the Slack MCP. It also includes a **ManyChat contacts** metric in `latest.json` so the marketing view reads it live.
- **Stats:** gated `/stats` → page views, recent client errors, recent feedback (from KV).
- **Secrets (never plaintext vars):** `DASH_PASSWORD`, `SLACK_WEBHOOK_URL`. **KV binding:** `KV` (namespace `eb-dash-kv`).
```

- [ ] **Step 6: Commit**

```bash
git add publish/slack-summary.mjs test/slack-summary.test.mjs README.md
git commit -m "feat(publish): daily Slack summary builder + ops docs"
```

---

### Task 12: Final verification + deploy gating

**Files:** none (verification) — plus a vault Task Log entry.

- [ ] **Step 1: Full unit suite green**

Run: `npm test`
Expected: ALL suites pass (auth, security, monitor, shared-ui, slack-summary, schema, render, publish).

- [ ] **Step 2: Pre-deploy prerequisites (Ash, one-time, in Cloudflare dashboard)**

1. **KV namespace:** Workers & Pages → KV → Create `eb-dash-kv` → copy its id into `wrangler.jsonc` `kv_namespaces[0].id`. Commit that change.
2. **Secrets:** Workers project → Settings → Variables and Secrets → confirm `DASH_PASSWORD` is a **Secret**; add `SLACK_WEBHOOK_URL` as a **Secret** (create a Slack incoming webhook first).
3. The cron + version_metadata bindings deploy automatically from `wrangler.jsonc` on the next push.

- [ ] **Step 3: Deploy** — push to `main` (Workers Builds auto-deploys)

```bash
git push
```
> This is the deploy. Do it only after Steps 1–2 are green and the KV id is set. (The Worker still functions if KV/webhook are absent — it just skips analytics + real-time alerts.)

- [ ] **Step 4: Post-deploy smoke (curl)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://eb-daily-brief.ashleyvisions.workers.dev/            # expect 401
curl -s https://eb-daily-brief.ashleyvisions.workers.dev/healthz                                      # expect JSON, fresh:true
curl -s -u x:WRONGPASS -o /dev/null -w "%{http_code}\n" https://eb-daily-brief.ashleyvisions.workers.dev/   # expect 401
curl -s -u x:$DASH_PASSWORD -I https://eb-daily-brief.ashleyvisions.workers.dev/ | grep -i "content-security-policy\|x-frame-options"  # expect headers present
```
Then in a browser (authed): open `/` → confirm the freshness badge + System status panel render and the build stamp shows; open `/stats` → confirm it loads.

- [ ] **Step 5: Update the vault**

Append to `Obsidian/90 Claude Memory/Task Log — Latest.md`: a dated entry recording Phase 0+1 live (commit range, the new `/healthz` + `/stats` + cron + KV, the Slack webhook prereq status). Add a reference note for the monitoring config under `90 Claude Memory` if one doesn't exist.

- [ ] **Step 6: Phase 0+1 done — tee up Plan 2**

Confirm the dashboard is hardened + monitored. The next plan (`docs/plans/2026-05-2x-live-drilldowns-plan.md`) rebuilds `marketing-hub` / `sales-funnel` / `team-budget` as tested render modules on the now-locked `shared-ui.js` interfaces (`esc`, `freshnessBadge`, `statusPanel`, `mountErrorCapture`) + a `marketing.json` data file + the ManyChat metric in `latest.json`.

---

## Self-Review

**1. Spec coverage:**
- §5.1 Worker hardening → Tasks 2,3,5. §5.2 `/healthz` → Task 5. §5.3 KV → Tasks 5,6. §5.4 cron → Task 7. §5.5 view analytics → Tasks 5 (counter) + 10 (read). §5.6 client errors → Tasks 6 (ingest) + 8 (capture). §5.7 freshness badge/status panel/stats → Tasks 8,10. §5.8 shared-ui → Task 8. §5.11 feedback fix → Tasks 1,9; daily Slack summary + ManyChat → Task 11 (ManyChat metric is a CC-task/SOP change documented in README + Task 6 of Plan 2's prerequisites). §8 security → Tasks 2,3,5. §9 testing → every TDD task. **§5.9/§5.10 (marketing-hub + the other drill-downs) are intentionally Plan 2** — they depend on the shared-ui interfaces locked here. No in-scope gap.
- Phase 2/3 of the spec are explicitly deferred to Plan 2 — flagged in the goal + Task 12 Step 6.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". The single non-literal value is `wrangler.jsonc` `kv_namespaces[0].id`, a real Cloudflare-assigned id filled at setup (Task 12 Step 2) — the same accepted convention as the assigned hostname in the original deploy plan; the Worker degrades gracefully until it's set.

**3. Type consistency:** `esc`, `freshnessBadge`, `statusPanel`, `mountErrorCapture` (shared-ui.js) used identically in app.js, stats.js, tests. `buildHealthBody`, `isTopLevelPath`, `viewKey`, `errorKey`, `feedbackKey`, `shouldAlert`, `slackStaleText`, `slackDownText` (monitor.mjs) match their worker.js call sites. `basicAuthOk`/`timingSafeEqualStr` (auth.mjs) and `securityHeaders` (security.mjs) match. `buildDailySummary(brief, stats, opts)` signature matches its test. `b.__build` is set in app.js from `/healthz` and read by `statusPanel`.
