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
