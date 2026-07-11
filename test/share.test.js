import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShareParams } from '../js/share.js';

test('parses world slug', () => {
  assert.deepEqual(parseShareParams('?w=abc123'), { mode: 'world', slug: 'abc123' });
});
test('parses genome slug', () => {
  assert.deepEqual(parseShareParams('?genome=xy9'), { mode: 'genome', slug: 'xy9' });
});
test('no params → null mode', () => {
  assert.deepEqual(parseShareParams(''), { mode: null, slug: null });
  assert.deepEqual(parseShareParams('?foo=bar'), { mode: null, slug: null });
});
test('world takes precedence if both present', () => {
  assert.equal(parseShareParams('?w=a&genome=b').mode, 'world');
});
