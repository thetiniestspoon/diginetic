import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLocalWhisper, narrate } from '../js/whispers.js';

test('births > deaths → life line', () => {
  assert.match(pickLocalWhisper({ births: 5, deaths: 1, diversity: 1, tempDrift: 0 }), /life|gather/i);
});
test('deaths > births → silence line', () => {
  assert.match(pickLocalWhisper({ births: 0, deaths: 4, diversity: 1, tempDrift: 0 }), /silence|still|shadow/i);
});
test('always returns a non-empty string', () => {
  assert.ok(pickLocalWhisper({ births: 0, deaths: 0, diversity: 1, tempDrift: 0 }).length > 0);
});

test('narrate returns LLM line when action succeeds', async () => {
  const invoke = async () => ({ line: 'The tide of code remembers.' });
  assert.equal(await narrate({ births: 1, deaths: 0 }, invoke), 'The tide of code remembers.');
});

test('narrate falls back to local bank on failure', async () => {
  const invoke = async () => { throw new Error('gateway down'); };
  const line = await narrate({ births: 3, deaths: 0 }, invoke);
  assert.match(line, /life|gather/i);
});
