# EB Dashboard — Professionalization & Monitoring — Design Spec

- **Date:** 2026-05-21
- **Status:** Approved (shape) — pending spec review
- **Repo:** `ashcrash/eb-daily-brief` (private) · live (gated) at https://eb-daily-brief.ashleyvisions.workers.dev
- **Author:** Claude (with Ash)

---

## 1. Context & problem

The EB Daily Brief is a Cloudflare Worker that gates a static dashboard behind Basic Auth and auto-deploys from GitHub on push. The **master** dashboard (`dashboard/index.html` + `app.js` + `briefs/latest.json`, schema-permissive) is live, data-driven, brand-correct, and good. The problems are in everything around it:

**The `/marketing-hub` drill-down (the trigger for this work):**
- A hand-coded **static snapshot** whose own banner says *"data as of 20 May 2026 … Being replaced by the live cloud dashboard."* It ships its own obituary.
- **Already drifting** from the live `latest.json` truth: IG 2,126 (live 2,158), YouTube 169K/36 (live 170,854/37), Brevo 327 (live 329), and a hardcoded `EB25 ends Fri 22 May` it cannot self-update.
- The "influencer tracker" tracks nothing — 12/12 rows are *Not contacted / —*; status can only change by editing HTML.
- No live data, charts, or interactivity (the master has all three).

**System-level / professionalism gaps:**
- **Two sources of truth** (3 static drill-downs vs the live master) → drift is structural.
- **Dead Netlify code** in a Cloudflare repo: `netlify.toml`, `netlify/edge-functions/auth.js`, `functions/_middleware.js`, `.netlify/state.json`; the master still embeds a hidden Netlify feedback `<form>` and `app.js` POSTs to a Netlify endpoint that no longer exists → the "Submit to Claude" feedback silently half-fails.
- **Worker auth:** single shared password, non-constant-time comparison, no security headers, no health endpoint.

**Monitoring — effectively zero:**
- No uptime check; **no data-freshness alarm** — a failed daily publish silently serves stale data, with only a timestamp nobody watches as the signal.
- `sources` / `toolIssues` health is captured *in* the JSON but never alerts.
- No view analytics, no client-error capture, no "which build is live" stamp.

## 2. Goals

1. Make `/marketing-hub` (and the other two drill-downs) **live and accurate** — numbers sourced only from `latest.json`, no drift, no self-deprecating banners.
2. Stand up a **self-contained monitoring layer**: uptime + freshness, source/pipeline health, view analytics, client errors + a live build stamp — with **Slack alerts** to Ash.
3. **Professionalize**: kill dead code, harden the Worker, make the feedback loop actually persist, ship a consistent DRY design.

## 3. Non-goals (this build)

- Multi-audience scoped views (Kevin/investor/supplier JSONs) — future, tracked in the parent dashboard-system spec.
- A forecast/projection engine — future.
- A full write-API for influencer editing — v1 reuses the existing review/comment loop (§5.9).
- Intraday refresh of business metrics — data stays once-daily; only monitoring is sub-daily.

## 4. Constraints

- **$0** beyond the existing Claude Code subscription. Only Cloudflare free-tier primitives (Workers, Static Assets, KV, Cron Triggers, version metadata) + a free Slack incoming webhook.
- **Single source of truth = `latest.json`** for all live numbers. Evergreen content lives in its own files.
- **Never-delete note:** Ash's archive-not-delete rule is a *vault* rule. The dead files live in this git repo, so they are removed with `git rm` (fully recoverable from history) rather than vault-archived.
- **Secrets, not plaintext vars:** every gating/alerting secret (`DASH_PASSWORD`, `SLACK_WEBHOOK_URL`) MUST be an encrypted Worker Secret — Workers Builds wipes plaintext vars on each deploy (documented prior incident).

## 5. Architecture & components

**Principle:** one source of truth, and the system watches itself. The same Worker that gates the site also self-monitors (cron) and records observability data (KV).

```
                         ┌───────────────────────── Cloudflare Worker (worker.js) ─────────────────────────┐
Browser ──HTTP──▶        │  1. /healthz  → unauth, returns freshness+build (no business data)               │
                         │  2. Basic Auth gate (constant-time) + security headers on every other request   │
authed ▼                 │  3. authed page load → increment KV view counter                                │
  static assets ◀────────│  4. POST /__client-error, /__feedback → write to KV (capped)                    │
  (dashboard/*)          │  5. GET /__stats.json → (authed) read KV aggregates                             │
                         │  scheduled() cron (~/30 min): read latest.json age → KV heartbeat               │
                         │                              → if stale/down & webhook set → Slack alert         │
                         └──────────────────────────────────────────────────────────────────────────────-─┘
                                            ▲                                   │
        daily CC task ──writes latest.json, marketing.json──┘                   ├──▶ Slack (incoming webhook): real-time critical
        + git push (auto-deploy)                                                └──▶ Slack (MCP, daily): rich health summary
```

### 5.1 Worker — auth & hardening (`worker.js`)
- **Purpose:** gate the site, set security headers, expose health, route observability POSTs, run the monitoring cron.
- **Interface:** `fetch(request, env)` + `scheduled(event, env)`.
- **Changes:**
  - Constant-time password comparison (length-checked XOR accumulate) replacing `password === expected`.
  - Security headers on all gated responses: `Content-Security-Policy` (allow self + fonts.googleapis/gstatic + cdn.jsdelivr for Chart.js + `'unsafe-inline'` for the inline styles/JSON-island), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (deny camera/mic/geo), `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'`. (`X-Robots-Tag: noindex` already present.)
  - Fail-closed behavior on missing `DASH_PASSWORD` retained.
- **Depends on:** `env.DASH_PASSWORD`, `env.ASSETS`, `env.KV`, `env.SLACK_WEBHOOK_URL` (optional), `env.CF_VERSION_METADATA`.

### 5.2 `/healthz` — unauth health endpoint
- **Purpose:** let monitors (the cron, or a future external service) check liveness + freshness without the password.
- **Output (JSON):** `{ status:"ok", briefDate, generatedAt, ageHours, fresh:bool, build:{id,timestamp} }`. **No business metrics** — only freshness/build meta.
- **Behavior:** always 200 when the Worker is reachable (uptime signal); `fresh` boolean carries staleness (separate signal). Reads `generatedAt`/`date` from `latest.json` via `env.ASSETS`; `build` from `env.CF_VERSION_METADATA`.

### 5.3 KV namespace (binding `env.KV`, namespace `eb-dash-kv`)
- **Purpose:** $0 self-hosted store for observability + light write-back.
- **Key schema:**
  - `views:<YYYY-MM-DD>:<path>` → integer counter (top-level page loads only).
  - `error:<ISO-ts>-<rand>` → JSON client-error record, TTL 30d, hard cap via count key.
  - `feedback:<ISO-ts>-<rand>` → JSON `{edition,page,comments[]}`, TTL 30d.
  - `monitor:lastCheck` / `monitor:lastStatus` / `monitor:lastAlertedAt` → cron heartbeat + alert de-dupe.
- **Free-tier fit:** single-user dashboard → well under 1k writes/day.

### 5.4 Monitoring cron (`scheduled()` in `worker.js`)
- **Trigger:** `wrangler.jsonc` cron `*/30 * * * *`.
- **Logic:** fetch `latest.json` age; write `monitor:lastCheck`/`lastStatus` to KV; if `ageHours > 26` (daily brief should be <24h old) **or** the asset fetch fails → if `SLACK_WEBHOOK_URL` set, POST a Slack alert, **de-duped** via `monitor:lastAlertedAt` (re-alert at most every 6h). Degrades gracefully to KV-only status if no webhook.

### 5.5 View analytics
- **Capture:** in `fetch()`, on authed requests for the 4 top-level pages (`/`, `/marketing-hub`, `/sales-funnel`, `/team-budget` and `.html` equivalents), `ctx.waitUntil` a KV increment. No cookies, no IP/PII stored (optional aggregate CF country only).
- **Read:** `GET /__stats.json` (authed) returns `{ views:{path:{date:count}}, errors:[…recent], feedback:[…recent] }`.

### 5.6 Client-error capture
- **Client:** shared bootstrap adds `window.addEventListener('error')` + `'unhandledrejection'` → `navigator.sendBeacon('/__client-error', payload)`.
- **Payload:** `{ msg, src, line, col, stack(≤500 chars), page, ua, ts }`.
- **Server:** `/__client-error` writes to KV with TTL + a daily count cap to prevent flooding.

### 5.7 Dashboard UI — freshness, status, stats
- **Freshness badge** (shared chrome on every page): reads `generatedAt`, renders "data N hrs old" — amber >24h, red >26h.
- **System-status panel** (master): renders `sources`/`toolIssues` from `latest.json` as RAG chips + the live build stamp (from `/healthz`).
- **`/stats` view** (gated, in-brand): renders `/__stats.json` — per-page view counts (7/30d), recent client errors, recent feedback. Linked from the master's drill-down nav.

### 5.8 Shared UI module (`dashboard/shared-ui.js`)
- **Purpose:** DRY the chrome across master + 3 drill-downs.
- **Exports:** `esc`, brand tokens, `topbar()`, `freshnessBadge(generatedAt)`, `drilldownNav(active)`, `statusPanel(sources,toolIssues,build)`, `mountErrorCapture()`.
- **Consumers:** `app.js` (master) + the 3 drill-down render modules. Pure functions are unit-tested headless (Node `--test`), matching the existing `buildBriefHTML`/`esc` pattern.

### 5.9 Marketing-hub live rebuild
- **Data:** live channel metrics from `latest.json.channels[]` (IG/YT/TikTok/Email) + **`dashboard/marketing.json`** (evergreen strategy + influencer tracker).
- **ManyChat** is not currently in `latest.json`; the daily brief task is extended to include a ManyChat channel/metric so its number is also single-source-of-truth live (small pipeline addition, §5.11).
- **Render:** pure `renderMarketing(latest, marketing)` → HTML, unit-tested. Composes live numbers + strategy; **removes the snapshot/"being replaced" banners**; adds the shared freshness badge + error capture.
- **Influencer status updates (v1):** statuses live in `marketing.json` as real data; updates are made through the existing **review/comment loop** (the dashboard's Review mode → comment → the CC daily task writes the change back to `marketing.json`). No new write-API.
- **Influencer status enum:** `not-contacted | contacted | replied | unit-sent | posted | declined`.

### 5.10 Sales-funnel + Team-budget rebuild
- Same pattern as §5.9: thin HTML shell + pure `renderSalesFunnel(latest)` / `renderTeamBudget(latest[, teamBudget.json])` render module + unit tests, sourcing live numbers from `latest.json` (funnel/store/manufacturing already present) and any evergreen bits from a small companion JSON. Shared chrome via §5.8.

### 5.11 Pipeline additions (`publish/`, daily CC task)
- **Feedback fix:** `app.js` `submitFeedback()` POSTs to `/__feedback` (KV) instead of the dead Netlify form; clipboard copy stays as the reliable primary. Remove the hidden Netlify `<form>` from `index.html`.
- **Slack summary (daily, tier 2):** the daily CC task, after publish, inspects `results` + `latest.json.sources`/`toolIssues` and reads `/__stats.json`; sends a **rich Slack summary** via the Slack MCP (deploy result, source health, views, any client errors/feedback). Documented in the `eb-daily-leadership-brief` task SOP.
- **ManyChat metric:** the brief generator adds ManyChat contacts to `latest.json` (channel or KPI) so marketing-hub reads it live.
- `publish.mjs` HANDLERS pattern is reused; no destination is added that can abort others (existing isolation preserved).

## 6. Data contracts

**`marketing.json`** (new, rarely edited):
```json
{
  "updated": "2026-05-21",
  "pillars": [{ "emoji": "😤", "name": "Problem", "pct": 30, "desc": "…" }],
  "cadence": [{ "day": "Mon", "platform": "TikTok", "type": "Problem / education hook" }],
  "ideas": { "high": [{ "icon":"🎬","text":"…","note":"…" }], "medium": [ … ] },
  "rules": ["Hook in 1–2 seconds — no slow intros", "…"],
  "influencers": [
    { "name":"FortNine (Ryan F9)","platform":"YouTube","audience":"2.3M subs",
      "region":"Global","tier":1,"fit":"…","status":"not-contacted","contactedDate":null,"notes":"" }
  ],
  "automations": [{ "name":"Comment-to-DM (AIR)","desc":"…","status":"live" }],
  "emailPlan": [{ "name":"Next send — EB25 last call","desc":"…","status":"queued" }]
}
```

**`/healthz` response:** `{ status, briefDate, generatedAt, ageHours, fresh, build:{id,timestamp} }`.

**Client-error payload:** `{ msg, src, line, col, stack, page, ua, ts }`.

**KV keys:** as in §5.3.

## 7. Error handling & failure modes

| Failure | Behavior |
|---|---|
| `DASH_PASSWORD` unset | Worker fail-closes 503 (unchanged). |
| `latest.json` unfetchable in `/healthz` or cron | `status:"degraded"`, `fresh:false`; cron Slacks (if webhook set). |
| Daily publish/deploy didn't run | `ageHours` climbs → cron alert + amber/red freshness badge. |
| A data source pull failed | `sources.<x] != "ok"` → status panel chip red + daily Slack summary flags it. |
| KV write fails (view/error/feedback) | Swallowed via `waitUntil`; never blocks page serving. |
| `SLACK_WEBHOOK_URL` unset | Real-time alerts degrade to KV status + the daily MCP summary. |
| Client-error flood | KV daily cap + TTL; excess dropped. |

## 8. Security

- Constant-time password compare; Basic Auth retained (single shared password — acceptable for a solo founder; per-user identity is a documented future).
- Observability POST routes (`/__client-error`, `/__feedback`) and `/__stats.json` run **behind** the auth gate (Worker runs first); `/healthz` is the only unauth route and leaks no business data.
- Full security-header set (§5.1). All routes `noindex`.
- Secrets (not plaintext vars) for `DASH_PASSWORD` + `SLACK_WEBHOOK_URL`.

## 9. Testing strategy

- **Unit (Node `--test`, zero deps — existing pattern):** `renderMarketing`, `renderSalesFunnel`, `renderTeamBudget`, and shared-ui pure helpers (esc, badge thresholds, status RAG mapping); freshness-age math; constant-time compare; `/healthz` body shaping (pure function extracted).
- **Worker logic:** extract pure helpers (auth check, age calc, header builder, KV-key builders) so they're testable without the runtime.
- **Manual smoke:** local `serve` of `dashboard/`; verify each page renders live numbers, freshness badge, status panel; verify 401 unauth + 200 authed + `/healthz` 200 unauth via curl.
- **No mocked-away drift:** marketing-hub numbers asserted to come from the injected `latest` object, not literals.

## 10. Phasing

| Phase | Scope | Ships |
|---|---|---|
| **0 — Hygiene & hardening** | `git rm` dead Netlify files; remove hidden Netlify form; Worker constant-time compare + security headers + `/healthz`. | Clean, hardened repo + health endpoint. |
| **1 — Monitoring layer** | KV + cron + version_metadata bindings; view counters; client-error + feedback ingest; `scheduled()` cron + Slack webhook; freshness badge; status panel; `/stats`; daily Slack summary in CC task. | "Monitor everything," Slack alerts. |
| **2 — Marketing-hub** | `marketing.json`; shared-ui module; `renderMarketing` + tests; live composition; banners removed; ManyChat into `latest.json`. | The page Ash sent, now live & accurate. |
| **3 — Sales-funnel + Team-budget** | Rebuild both on the live, tested, shared pattern. | All 3 drill-downs live, consistent, DRY. |

Each phase is independently shippable and leaves the dashboard working.

## 11. Manual prerequisites (Ash)

1. **Slack incoming webhook** (~2 min): create an incoming-webhook URL; it is stored as the `SLACK_WEBHOOK_URL` Worker **Secret**. Enables tier-1 real-time alerts. (Optional — without it, alerting degrades to the daily summary.)
2. **KV namespace + bindings:** created via the Cloudflare dashboard or `wrangler` and bound in `wrangler.jsonc` (KV id, cron, version_metadata). If `wrangler` isn't authed locally, Ash does the binding clicks once.

## 12. Vault sync

Per standing rules, after each phase: update `Task Log — Latest.md`; mirror the live config state into the relevant `90 Claude Memory` reference notes (Worker/monitoring config, dashboard architecture). The repo remains the code source of truth; the vault holds the operational state + history.

## 13. Open questions

None blocking. Per-user auth, scoped audience views, and a forecast engine are explicitly deferred (§3).
