// publish/publish.mjs — config-driven fan-out for the daily brief.
// Validates a brief, then runs each ENABLED destination from
// publish/config/brief-destinations.json. Flexibility-first: add a new
// destination by writing a handler + adding a config entry. Failures in one
// destination never abort the others.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBrief } from '../shared/schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(HERE, '..');

export function loadConfig(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Destination: dashboard — write latest.json + history/<date>.json
export function publishDashboard(brief, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const briefsDir = resolve(repoRoot, 'dashboard', 'briefs');
  const historyDir = resolve(briefsDir, 'history');
  mkdirSync(historyDir, { recursive: true });
  const json = JSON.stringify(brief, null, 2) + '\n';
  writeFileSync(resolve(briefsDir, 'latest.json'), json);
  writeFileSync(resolve(historyDir, `${brief.date}.json`), json);
  // maintain history/index.json — newest first, deduped by date (powers the day picker)
  const idxPath = resolve(historyDir, 'index.json');
  let idx = [];
  try { idx = JSON.parse(readFileSync(idxPath, 'utf8')); } catch { idx = []; }
  if (!Array.isArray(idx)) idx = [];
  idx = idx.filter(e => e && e.date !== brief.date);
  idx.unshift({ date: brief.date, edition: brief.edition });
  idx.sort((a, b) => (a.date < b.date ? 1 : -1));
  writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
  return { wrote: ['dashboard/briefs/latest.json', `dashboard/briefs/history/${brief.date}.json`, 'dashboard/briefs/history/index.json'] };
}

// Destination: git — commit + push the dashboard data (triggers host redeploy)
export function publishGit(brief, {
  repoRoot = DEFAULT_REPO_ROOT,
  run = (cmd) => execSync(cmd, { cwd: repoRoot, stdio: 'pipe' })
} = {}) {
  run('git add dashboard/briefs');
  run(`git commit -m "data: brief ${brief.date} (edition ${brief.edition})"`);
  run('git push');
  return { pushed: true };
}

const HANDLERS = { dashboard: publishDashboard, git: publishGit };

export function publish(brief, config, opts = {}) {
  const v = validateBrief(brief);
  if (!v.valid) throw new Error('Invalid brief: ' + v.errors.join('; '));
  const results = {};
  for (const dest of (config.destinations || [])) {
    if (!dest.enabled) { results[dest.type] = 'skipped'; continue; }
    const handler = HANDLERS[dest.type];
    if (!handler) { results[dest.type] = 'no-handler'; continue; }
    try {
      results[dest.type] = handler(brief, { ...opts, ...(dest.options || {}) });
    } catch (e) {
      results[dest.type] = 'error: ' + e.message; // isolate; keep going
    }
  }
  return results;
}
