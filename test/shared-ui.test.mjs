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
