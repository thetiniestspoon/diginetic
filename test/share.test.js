import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShareParams, routeShare } from '../js/share.js';

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

test('routeShare clones a world slug via injected invokeAction', async () => {
  const calls = [];
  const invoke = async (action, payload) => { calls.push([action, payload]); return { new_world_id: 'nw', seed: { label: 's' }, params: { temperature: 0.1, food: 0.5 } }; };
  const out = await routeShare('?w=abc', { invokeAction: invoke, currentWorldId: null });
  assert.equal(calls[0][0], 'clone_world_from_slug');
  assert.equal(out.action, 'clone');
  assert.deepEqual(out.result.params, { temperature: 0.1, food: 0.5 });
});

test('routeShare returns null with no share params', async () => {
  const out = await routeShare('', { invokeAction: async () => ({}), currentWorldId: null });
  assert.equal(out, null);
});
