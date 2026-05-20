import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefHTML, esc } from '../dashboard/app.js';

const sample = {
  edition: 5, date: '2026-05-20', generatedAt: 'x',
  executiveSummary: ['Demand is the constraint, not the product'],
  northStar: { label: 'Pre-orders to goal', current: 2009, goal: 200000, unit: '$', note: '12 paid' },
  needsDecision: [{ item: 'Decide EB25', lens: 'CMO', why: 'expires Friday' }],
  kpis: [{ label: 'Sessions (7d)', value: '183', delta: '+19', status: 'neutral', spark: [164, 183] }],
  charts: [
    { id: 'funnel', title: 'Funnel', type: 'bar', labels: ['LP'], datasets: [{ label: 'S', data: [83] }] },
    { id: 'igFollowers', title: 'Followers', type: 'line', labels: ['x'], datasets: [{ label: 'F', data: [2156] }] }
  ],
  store: { title: 'Shopify Store', metrics: [{ name: 'Orders', value: '12', delta: '' }], chartIds: ['funnel'], notes: ['note'] },
  onlinePresence: { title: 'Website & online presence', metrics: [{ name: 'Sessions', value: '183' }], chartIds: [], clarity: [{ name: 'Rage clicks', value: '0', status: 'good' }], notes: [] },
  channels: [{ id: 'instagram', name: 'Instagram', headline: '2,156 followers', metrics: [{ name: 'Followers', value: '2,156', delta: '+30' }], chartIds: ['igFollowers'], notes: ['viral'] }],
  competitors: [{ name: 'Zyon Helmets', price: '~$935', preorders: '4,000+', form: 'helmet', cert: 'ECE', threat: 'high', note: 'press' }],
  landscape: 'Category is real.',
  manufacturing: { shipDate: '2026-06-25', daysToShip: 36, status: 'amber', cog: '$15.91', margin: '90.6%', timeline: [{ item: 'Wires', eta: 'May 31', status: 'amber' }], notes: ['Minewing hold'] },
  inbox: { items: [{ summary: 'Tapan reply', urgency: 'high' }] },
  contentAngle: ['$935 vs $127.50'], actionStack: ['Decide EB25'], sources: { ga4: 'ok' }
};

const html = () => buildBriefHTML(sample);

test('esc escapes html-significant chars', () => assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;'));
test('renders the executive summary', () => assert.ok(html().includes('Demand is the constraint')));
test('renders the north star label', () => assert.ok(html().includes('Pre-orders to goal')));
test('renders a decision', () => assert.ok(html().includes('Decide EB25')));
test('renders a KPI tile + spark', () => { const h = html(); assert.ok(h.includes('Sessions (7d)') && h.includes('data-spark')); });
test('renders the Shopify section + its chart canvas', () => { const h = html(); assert.ok(h.includes('Shopify Store') && h.includes('chart-funnel')); });
test('renders a Clarity signal in online presence', () => assert.ok(html().includes('Rage clicks')));
test('renders a per-channel section + its chart', () => { const h = html(); assert.ok(h.includes('Instagram') && h.includes('chart-igFollowers')); });
test('renders a competitor with threat badge', () => { const h = html(); assert.ok(h.includes('Zyon Helmets') && h.includes('badge high')); });
test('renders the manufacturing countdown + timeline item', () => { const h = html(); assert.ok(h.includes('Manufacturing') && h.includes('36') && h.includes('Wires')); });
test('renders an inbox item', () => assert.ok(html().includes('Tapan reply')));
test('renders the action stack', () => assert.ok(html().includes('Action stack')));
test('renders the EB logo + brand wordmark', () => { const h = html(); assert.ok(h.includes('<svg') && h.includes('Easi Breezi')); });
test('renders the day picker + review toggle', () => { const h = html(); assert.ok(h.includes('daypick') && h.includes('reviewtoggle')); });
test('sections are commentable with comment boxes', () => { const h = html(); assert.ok(h.includes('commentable') && h.includes('data-item') && h.includes('cbox')); });
test('does not throw on a minimal core-only brief', () => {
  const core = { edition: 1, date: '2026-01-01', generatedAt: 'x', headline: ['h'], sources: { ga4: 'ok' } };
  assert.doesNotThrow(() => buildBriefHTML(core));
  assert.ok(buildBriefHTML(core).includes('Master Dashboard'));
});
