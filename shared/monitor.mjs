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
