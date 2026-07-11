import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, gaussian, hashStringToSeed } from '../js/rng.js';

test('makeRng is deterministic for the same seed', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('makeRng returns floats in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a(), b());
});

test('gaussian has ~0 mean and ~sigma stddev', () => {
  const r = makeRng(99);
  const n = 20000, sigma = 0.1;
  let sum = 0, sumsq = 0;
  for (let i = 0; i < n; i++) { const g = gaussian(r, sigma); sum += g; sumsq += g * g; }
  const mean = sum / n;
  const std = Math.sqrt(sumsq / n - mean * mean);
  assert.ok(Math.abs(mean) < 0.01, `mean ${mean}`);
  assert.ok(Math.abs(std - sigma) < 0.01, `std ${std}`);
});

test('hashStringToSeed is stable and integer', () => {
  const s1 = hashStringToSeed('moss-spiral');
  const s2 = hashStringToSeed('moss-spiral');
  assert.equal(s1, s2);
  assert.equal(Number.isInteger(s1), true);
});
