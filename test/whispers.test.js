import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLocalWhisper } from '../js/whispers.js';

test('births > deaths → life line', () => {
  assert.match(pickLocalWhisper({ births: 5, deaths: 1, diversity: 1, tempDrift: 0 }), /life|gather/i);
});
test('deaths > births → silence line', () => {
  assert.match(pickLocalWhisper({ births: 0, deaths: 4, diversity: 1, tempDrift: 0 }), /silence|still|shadow/i);
});
test('always returns a non-empty string', () => {
  assert.ok(pickLocalWhisper({ births: 0, deaths: 0, diversity: 1, tempDrift: 0 }).length > 0);
});
