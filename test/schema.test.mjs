import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBrief } from '../shared/schema.mjs';

const valid = {
  edition: 1,
  date: '2026-05-20',
  generatedAt: '2026-05-20T00:05:00Z',
  headline: ['x'],
  needsDecision: [],
  lenses: {
    cmo: { metrics: [], narrative: '' },
    cfo: { metrics: [], narrative: '' },
    cto: { metrics: [], narrative: '' },
    inbox: { items: [] }
  },
  contentAngle: [],
  actionStack: [],
  toolIssues: [],
  sources: { ga4: 'ok' }
};

test('valid brief passes', () => {
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

test('missing inbox lens fails', () => {
  const b = structuredClone(valid); delete b.lenses.inbox;
  const r = validateBrief(b);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('inbox')));
});

test('non-object returns invalid not throw', () => {
  assert.equal(validateBrief(null).valid, false);
});

test('brief with rich optional fields validates', () => {
  const b = structuredClone(valid);
  b.kpis = [{ label: 'x', value: '1' }];
  b.charts = [{ id: 'c', title: 't', type: 'line', labels: [], datasets: [] }];
  b.socials = [{ platform: 'IG', followers: '1' }];
  b.competitors = [{ name: 'Zyon', price: '$935' }];
  b.northStar = { label: 'goal', current: 1, goal: 10 };
  b.landscape = 'note';
  const r = validateBrief(b);
  assert.equal(r.valid, true, r.errors.join('; '));
});

test('kpis must be an array if present', () => {
  const b = structuredClone(valid); b.kpis = 'nope';
  assert.equal(validateBrief(b).valid, false);
});

test('northStar must be an object if present', () => {
  const b = structuredClone(valid); b.northStar = 'nope';
  assert.equal(validateBrief(b).valid, false);
});
