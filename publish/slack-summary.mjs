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
