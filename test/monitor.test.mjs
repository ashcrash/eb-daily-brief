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
