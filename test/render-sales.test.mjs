import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSales } from '../dashboard/render-sales.js';

const latest = {
  generatedAt: '2026-05-21T12:00:00Z',
  store: { metrics: [
    { name: 'Lifetime paid orders', value: '12', delta: '+0 in 11d' },
    { name: 'Lifetime revenue', value: '$2,009' },
    { name: 'EB units sold', value: '14' },
    { name: 'Conversion rate', value: '~0%', delta: '11 days dry' },
    { name: 'Active discount', value: 'EB25 (25%)', delta: '0 uses, ENDS TMRW' }
  ] },
  charts: [{ id: 'ordersByCountry', labels: ['Indonesia', 'USA'], datasets: [{ data: [4, 4] }] }],
  channels: [{ id: 'email', metrics: [{ name: 'Avg open rate', value: '36%' }] }],
  sources: { shopify: 'ok' }
};
const sales = {
  updated: '2026-05-21',
  orderLedger: [{ order: '#1017', date: '10 May', location: 'Australia', total: '$165.47', payment: 'Paid', lines: 3 }],
  unitsByProduct: [{ name: 'EB Unit', units: 14 }],
  cvrTrend: [{ week: 'Wk7', pct: 1.05 }],
  trafficLeak: [{ source: 'Organic Social', val: '−88%', tone: 'bad' }],
  pixels: [{ name: 'Meta', status: 'Firing', dot: 'green' }],
  conversionLevers: [{ lever: 'Reach', action: 'cadence' }]
};

test('renders live paid-order count from latest.store', () => {
  assert.match(renderSales(latest, sales), /12/);
});
test('renders live revenue from latest.store', () => {
  assert.match(renderSales(latest, sales), /\$2,009/);
});
test('renders geography from the live ordersByCountry chart', () => {
  assert.match(renderSales(latest, sales), /Indonesia/);
});
test('renders the order ledger from companion data', () => {
  assert.match(renderSales(latest, sales), /#1017/);
});
test('derives a demand-stall alert from the live conversion metric', () => {
  assert.match(renderSales(latest, sales), /Demand stall/);
});
test('safe on empty inputs', () => {
  assert.doesNotThrow(() => renderSales({}, {}));
});
test('is sealed — no back button or cross-page nav', () => {
  const html = renderSales(latest, sales);
  assert.doesNotMatch(html, /m-back/);
  assert.doesNotMatch(html, /class="drilldown"/);
});
