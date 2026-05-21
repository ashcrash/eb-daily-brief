# EB Daily Brief — Cloud Dashboard

Private, login-gated static dashboard rendering the EB Daily Leadership Brief.

Spec: vault `10 Projects/Easi Breezi/EB Daily Brief — Cloud Dashboard — Design Spec — 2026-05-20`.
Plan: vault `10 Projects/Easi Breezi/EB Daily Brief — Cloud Dashboard — Plan — Phase 1 — 2026-05-20`.

- Run tests: `npm test`
- Served directory (Cloudflare Worker static assets): `dashboard/`
- Data file: `dashboard/briefs/latest.json` (written live by the publisher)

## Monitoring & ops
- **Live (gated):** https://eb-daily-brief.ashleyvisions.workers.dev · password = `DASH_PASSWORD` Secret.
- **Health (unauth):** `/healthz` → `{status, briefDate, generatedAt, ageHours, fresh, build}`.
- **Real-time alerts:** the Worker cron (`*/30`) checks freshness; if stale/down and `SLACK_WEBHOOK_URL` (Secret) is set, it posts to Slack (de-duped 6h).
- **Daily summary:** the `eb-daily-leadership-brief` CC task, after publish, calls `buildDailySummary(brief, stats, {deploy})` (`publish/slack-summary.mjs`), reads `/__stats.json`, and sends the result via the Slack MCP. It also includes a **ManyChat contacts** metric in `latest.json` so the marketing view reads it live.
- **Stats:** gated `/stats` → page views, recent client errors, recent feedback (from KV).
- **Secrets (never plaintext vars):** `DASH_PASSWORD`, `SLACK_WEBHOOK_URL`. **KV binding:** `KV` (namespace `eb-dash-kv`).
