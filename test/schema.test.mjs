import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBrief } from '../shared/schema.mjs';

const valid = {
  edition: 1,
  date: '2026-05-20',
  generatedAt: '2026-05-20T00:05:00Z',
  headline: ['x'],
  sources: { ga4: 'ok' }
};

test('valid core brief passes', () => {
  const r = validateBrief(valid);
  assert.equal(r.valid, true, r.errors.join('; '));
});

test('missing date fails with date error', () => {
  const b = structuredClone(valid); delete b.date;
  const r = validateBrief(b);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('date')));
});

test('bad date format fails', () => {
  const b = structuredClone(valid); b.date = '20/05/2026';
  assert.equal(validateBrief(b).valid, false);
});

test('headline is optional (executiveSummary supersedes it)', () => {
  const b = structuredClone(valid); delete b.headline;
  assert.equal(validateBrief(b).valid, true);
});

test('non-object returns invalid not throw', () => {
  assert.equal(validateBrief(null).valid, false);
});

test('full v3 brief with all optional sections validates', () => {
  const b = structuredClone(valid);
  b.executiveSummary = ['x'];
  b.kpis = [{ label: 'x', value: '1' }];
  b.charts = [{ id: 'c', title: 't', type: 'bar', labels: [], datasets: [] }];
  b.channels = [{ id: 'instagram', name: 'Instagram' }];
  b.store = { title: 'Shopify', metrics: [] };
  b.onlinePresence = { title: 'Web', metrics: [] };
  b.manufacturing = { shipDate: '2026-06-25', daysToShip: 36 };
  b.competitors = [{ name: 'Zyon', price: '$935' }];
  b.northStar = { label: 'g', current: 1, goal: 10 };
  b.landscape = 'note';
  const r = validateBrief(b);
  assert.equal(r.valid, true, r.errors.join('; '));
});

test('kpis must be an array if present', () => {
  const b = structuredClone(valid); b.kpis = 'nope';
  assert.equal(validateBrief(b).valid, false);
});

test('store must be an object if present', () => {
  const b = structuredClone(valid); b.store = ['nope'];
  assert.equal(validateBrief(b).valid, false);
});

test('northStar must be an object if present', () => {
  const b = structuredClone(valid); b.northStar = 'nope';
  assert.equal(validateBrief(b).valid, false);
});
