import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { publish, publishDashboard, publishGit } from '../publish/publish.mjs';

const brief = {
  edition: 3, date: '2026-05-21', generatedAt: 'x',
  headline: ['h'], needsDecision: [],
  lenses: { cmo: {}, cfo: {}, cto: {}, inbox: {} },
  actionStack: [], sources: { ga4: 'ok' }
};

test('publishDashboard writes latest.json + dated history', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ebpub-'));
  publishDashboard(brief, { repoRoot: tmp });
  const latest = JSON.parse(readFileSync(resolve(tmp, 'dashboard/briefs/latest.json'), 'utf8'));
  assert.equal(latest.edition, 3);
  assert.ok(existsSync(resolve(tmp, 'dashboard/briefs/history/2026-05-21.json')));
});

test('publish runs enabled, skips disabled, flags unknown, isolates failures', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ebpub2-'));
  const config = {
    destinations: [
      { type: 'dashboard', enabled: true, options: { repoRoot: tmp } },
      { type: 'git', enabled: false },
      { type: 'mystery', enabled: true }
    ]
  };
  const r = publish(brief, config);
  assert.ok(r.dashboard.wrote, 'dashboard ran');
  assert.equal(r.git, 'skipped');
  assert.equal(r.mystery, 'no-handler');
});

test('publish rejects an invalid brief', () => {
  assert.throws(() => publish({ edition: 'nope' }, { destinations: [] }), /Invalid brief/);
});

test('publishGit issues add/commit/push via injected runner', () => {
  const cmds = [];
  const r = publishGit(brief, { repoRoot: '/x', run: (c) => cmds.push(c) });
  assert.equal(r.pushed, true);
  assert.equal(cmds.length, 3);
  assert.ok(cmds[0].startsWith('git add'));
  assert.ok(cmds[1].includes('commit'));
  assert.equal(cmds[2], 'git push');
});

test('publish isolates a destination that throws', () => {
  const config = { destinations: [{ type: 'git', enabled: true }] };
  // No injected runner + bogus repoRoot → git handler throws → caught, not rethrown
  const r = publish(brief, config, { repoRoot: join(tmpdir(), 'definitely-not-a-repo-xyz') });
  assert.ok(String(r.git).startsWith('error:'), 'git failure is captured, not thrown');
});
