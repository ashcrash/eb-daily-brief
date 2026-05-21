import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqualStr, basicAuthOk } from '../shared/auth.mjs';

test('equal strings compare true', () => {
  assert.equal(timingSafeEqualStr('hunter2', 'hunter2'), true);
});
test('different strings compare false', () => {
  assert.equal(timingSafeEqualStr('hunter2', 'hunter3'), false);
});
test('different lengths compare false', () => {
  assert.equal(timingSafeEqualStr('abc', 'abcd'), false);
});
test('null/undefined safe', () => {
  assert.equal(timingSafeEqualStr(null, undefined), true); // both coerce to ''
  assert.equal(timingSafeEqualStr('x', null), false);
});
test('basicAuthOk accepts the right password (username ignored)', () => {
  const header = 'Basic ' + Buffer.from('anyuser:s3cret').toString('base64');
  assert.equal(basicAuthOk(header, 's3cret'), true);
});
test('basicAuthOk rejects wrong password', () => {
  const header = 'Basic ' + Buffer.from('u:nope').toString('base64');
  assert.equal(basicAuthOk(header, 's3cret'), false);
});
test('basicAuthOk rejects when no expected configured', () => {
  const header = 'Basic ' + Buffer.from('u:anything').toString('base64');
  assert.equal(basicAuthOk(header, ''), false);
});
test('basicAuthOk rejects malformed / non-Basic headers', () => {
  assert.equal(basicAuthOk('', 's3cret'), false);
  assert.equal(basicAuthOk('Bearer xyz', 's3cret'), false);
  assert.equal(basicAuthOk('Basic !!!notbase64', 's3cret'), false);
});
