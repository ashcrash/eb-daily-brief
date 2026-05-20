import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefHTML, esc } from '../dashboard/app.js';

const sample = {
  edition: 4, date: '2026-05-20', generatedAt: 'x',
  northStar: { label: 'Pre-orders to goal', current: 2009, goal: 200000, unit: '$', note: '12 orders' },
  headline: ['Still 0 orders in 10 days'],
  needsDecision: [{ item: 'Decide EB25', lens: 'CMO', why: 'expires Friday' }],
  kpis: [{ label: 'Sessions (7d)', value: '183', delta: '+19', status: 'neutral', spark: [164, 183] }],
  charts: [{ id: 'channels', title: 'Sessions by channel', type: 'doughnut', labels: ['Direct'], datasets: [{ label: 'Sessions', data: [129] }] }],
  lenses: {
    cmo: { narrative: 'demand flat', metrics: [{ name: 'IG followers', value: '2,156', delta: '+30', flag: '' }] },
    cfo: { narrative: '', metrics: [] },
    cto: { narrative: '', metrics: [] },
    inbox: { items: [{ summary: 'Tapan reply', urgency: 'high' }] }
  },
  socials: [{ platform: 'Instagram', handle: '@easi.breezi', followers: '2,156', delta: '+30', note: 'viral reels' }],
  competitors: [{ name: 'Zyon Helmets', price: '~$935', preorders: '4,000+', form: 'whole helmet', cert: 'ECE', threat: 'high', note: 'press' }],
  landscape: 'The category is real.',
  contentAngle: ['$935 vs $127.50'], actionStack: ['Decide EB25'], sources: { ga4: 'ok' }
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
test('renders the north star with its label', () => {
  assert.ok(buildBriefHTML(sample).includes('Pre-orders to goal'));
});
test('renders a KPI tile + spark data', () => {
  const html = buildBriefHTML(sample);
  assert.ok(html.includes('Sessions (7d)'));
  assert.ok(html.includes('data-spark'));
});
test('renders a chart canvas with the chart id', () => {
  assert.ok(buildBriefHTML(sample).includes('chart-channels'));
});
test('renders a CMO metric and its delta', () => {
  const html = buildBriefHTML(sample);
  assert.ok(html.includes('IG followers') && html.includes('+30'));
});
test('renders an inbox item', () => {
  assert.ok(buildBriefHTML(sample).includes('Tapan reply'));
});
test('renders a social platform', () => {
  assert.ok(buildBriefHTML(sample).includes('Instagram'));
});
test('renders a competitor name + threat', () => {
  const html = buildBriefHTML(sample);
  assert.ok(html.includes('Zyon Helmets'));
  assert.ok(html.includes('threat high'));
});
test('does not throw on a core-only brief (no rich sections)', () => {
  const core = {
    edition: 1, date: '2026-01-01', generatedAt: 'x',
    headline: ['h'], needsDecision: [],
    lenses: { cmo: {}, cfo: {}, cto: {}, inbox: {} },
    actionStack: [], sources: { ga4: 'ok' }
  };
  assert.doesNotThrow(() => buildBriefHTML(core));
  assert.ok(buildBriefHTML(core).includes('EB Master Dashboard'));
});
