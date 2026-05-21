import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, freshnessBadge, statusPanel } from '../dashboard/shared-ui.js';
import { renderStats } from '../dashboard/stats.js';

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
