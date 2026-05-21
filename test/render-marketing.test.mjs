import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarketing } from '../dashboard/render-marketing.js';

const latest = {
  generatedAt: '2026-05-21T12:00:00Z',
  channels: [
    { id: 'manychat', headline: '562 contacts', metrics: [{ name: 'Total contacts', value: '562' }] },
    { id: 'instagram', metrics: [{ name: 'Followers', value: '2,158' }], notes: ['3 viral Reels drove 1.6M reach'] },
    { id: 'youtube', metrics: [{ name: 'Total views', value: '170,854' }, { name: 'Subscribers', value: '37' }] },
    { id: 'email', metrics: [{ name: 'Avg open rate', value: '36%' }, { name: 'Sends left (May)', value: '53' }] }
  ],
  store: { metrics: [{ name: 'Active discount', value: 'EB25 (25%)', delta: '0 uses' }] },
  sources: { shopify: 'ok' }
};
const marketing = {
  pillars: [{ emoji: '😤', name: 'Problem', pct: 30, desc: 'x' }],
  cadence: [{ day: 'Mon', platform: 'TikTok', type: 'hook' }],
  ideas: { high: [{ icon: '🎬', text: 'idea A', note: 'n' }], medium: [] },
  rules: ['Hook fast'],
  influencers: [{ name: 'FortNine (Ryan F9)', platform: 'YouTube', audience: '2.3M', region: 'Global', tier: 1, fit: 'trusted', status: 'not-contacted' }],
  tier3: { title: 'TIER 3', desc: 'd', criteria: ['Urban'] },
  automations: [{ name: 'AIR', desc: 'comment to DM', status: 'live' }],
  emailPlan: [{ name: 'Next send', desc: 'last call', status: 'queued' }]
};

test('renders LIVE instagram number sourced from latest', () => {
  assert.match(renderMarketing(latest, marketing), /2,158/);
});
test('renders live ManyChat contacts', () => {
  assert.match(renderMarketing(latest, marketing), /562/);
});
test('renders a content pillar', () => {
  assert.match(renderMarketing(latest, marketing), /Problem/);
});
test('renders an influencer with status', () => {
  const html = renderMarketing(latest, marketing);
  assert.match(html, /FortNine/);
  assert.match(html, /Not contacted/);
});
test('renders the active discount from store', () => {
  assert.match(renderMarketing(latest, marketing), /EB25/);
});
test('does NOT contain the old hardcoded drift number 2,126', () => {
  assert.doesNotMatch(renderMarketing(latest, marketing), /2,126/);
});
test('safe on empty inputs', () => {
  assert.doesNotThrow(() => renderMarketing({}, {}));
});
