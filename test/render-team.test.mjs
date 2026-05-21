import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTeam } from '../dashboard/render-team.js';

const latest = {
  generatedAt: '2026-05-21T12:00:00Z',
  northStar: { label: 'Pre-order revenue to the £200k milestone', current: 2009, goal: 200000, unit: '$', note: '12 paid pre-orders' },
  manufacturing: { cog: '$15.91/unit', margin: '90.6% @ $170' },
  sources: { shopify: 'ok' }
};
const team = {
  target: '£200K', adSpend: '$0', patent: { status: 'Filed', date: 'Jan 2, 2025' },
  people: [{ emoji: '🧑‍🔧', name: 'Ash', role: 'Founder & CEO', dot: 'green', status: 'Active', details: [['Focus', 'ship', 'ok']] }],
  adChannels: [{ platform: 'Meta', pct: 0, color: 'var(--eb-blue)', rows: [['Status', 'Not live', '']] }],
  milestones: [{ label: 'First revenue', progress: 'earned ✓', state: 'done', badge: ['green', 'Achieved'], live: 'revenue' }],
  risks: [{ title: 'Demand stall', desc: '0 orders in 11 days', sev: ['bad', 'High'] }]
};

test('renders live revenue from northStar', () => {
  assert.match(renderTeam(latest, team), /\$2,009/);
});
test('renders live COG from manufacturing', () => {
  assert.match(renderTeam(latest, team), /\$15\.91/);
});
test('renders live margin from manufacturing', () => {
  assert.match(renderTeam(latest, team), /90\.6%/);
});
test('renders a stakeholder card', () => {
  assert.match(renderTeam(latest, team), /Ash/);
});
test('renders the risk register', () => {
  assert.match(renderTeam(latest, team), /Demand stall/);
});
test('safe on empty inputs', () => {
  assert.doesNotThrow(() => renderTeam({}, {}));
});
test('is sealed — no back button or cross-page nav', () => {
  const html = renderTeam(latest, team);
  assert.doesNotMatch(html, /m-back/);
  assert.doesNotMatch(html, /class="drilldown"/);
});
