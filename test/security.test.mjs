import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from '../shared/security.mjs';

test('returns the full hardening header set', () => {
  const h = securityHeaders();
  for (const k of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','X-Robots-Tag']) {
    assert.ok(k in h, `missing ${k}`);
  }
});
test('CSP allows fonts + jsdelivr (Chart.js) and self connect, denies framing', () => {
  const csp = securityHeaders()['Content-Security-Policy'];
  assert.match(csp, /script-src[^;]*cdn\.jsdelivr\.net/);
  assert.match(csp, /font-src[^;]*fonts\.gstatic\.com/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});
test('noindex preserved', () => {
  assert.match(securityHeaders()['X-Robots-Tag'], /noindex/);
});
