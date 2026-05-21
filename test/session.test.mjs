import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCookies, wantsHtml, loginPageHTML, COOKIE } from '../shared/session.mjs';

test('parseCookies parses + url-decodes values', () => {
  const c = parseCookies('a=1; eb_auth=p%40ss; b=2');
  assert.equal(c.a, '1');
  assert.equal(c.eb_auth, 'p@ss');
  assert.equal(c.b, '2');
});
test('parseCookies safe on empty/null', () => {
  assert.deepEqual(parseCookies(''), {});
  assert.deepEqual(parseCookies(null), {});
});
test('wantsHtml true only for html navigations', () => {
  assert.equal(wantsHtml('text/html,application/xhtml+xml'), true);
  assert.equal(wantsHtml('*/*'), false);
  assert.equal(wantsHtml(''), false);
  assert.equal(wantsHtml(null), false);
});
test('loginPageHTML renders a password form posting to /__login', () => {
  const h = loginPageHTML();
  assert.match(h, /name="password"/);
  assert.match(h, /action="\/__login"/);
  assert.match(h, /noindex/);
});
test('loginPageHTML surfaces an error message when provided', () => {
  assert.match(loginPageHTML('Incorrect password'), /Incorrect password/);
});
test('COOKIE constant', () => {
  assert.equal(COOKIE, 'eb_auth');
});
