import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefHTML, esc } from '../dashboard/app.js';

const sample = {
  edition: 2, date: '2026-05-20', generatedAt: 'x',
  headline: ['Still 0 orders in 10 days'],
  needsDecision: [{ item: 'Decide EB25', lens: 'CMO', why: 'expires Friday' }],
  lenses: {
    cmo: { narrative: 'demand flat', metrics: [{ name: 'IG followers', value: '2,156', delta: '+30', flag: '' }] },
    cfo: { narrative: '', metrics: [] },
    cto: { narrative: '', metrics: [] },
    inbox: { items: [{ summary: 'Tapan reply', urgency: 'high' }] }
  },
  contentAngle: [], actionStack: ['Decide EB25'], sources: { ga4: 'ok' }
};

test('esc escapes html-significant chars', () => {
  assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
});
test('renders headline text', () => {
  assert.ok(buildBriefHTML(sample).includes('Still 0 orders in 10 days'));
});
test('renders a decision row', () => {
  assert.ok(buildBriefHTML(sample).includes('Decide EB25'));
});
test('renders a CMO metric and its delta', () => {
  const html = buildBriefHTML(sample);
  assert.ok(html.includes('IG followers') && html.includes('+30'));
});
test('renders an inbox item with urgency', () => {
  assert.ok(buildBriefHTML(sample).includes('Tapan reply'));
});
test('does not throw on empty lenses', () => {
  assert.doesNotThrow(() => buildBriefHTML({ ...sample, lenses: { cmo: {}, cfo: {}, cto: {}, inbox: {} } }));
});
