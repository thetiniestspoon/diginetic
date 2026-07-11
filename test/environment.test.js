import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnvironment, fitness, energyDelta } from '../js/environment.js';
import { createStarterGenome, derivePhenotype } from '../js/genome.js';

test('sampleTemp is colder at top (small y), warmer at bottom', () => {
  const env = makeEnvironment({ temperature: 0, food: 0.5 });
  const top = env.sampleTemp(50, 0, 100, 100);
  const bottom = env.sampleTemp(50, 100, 100, 100);
  assert.ok(bottom > top, `top ${top} bottom ${bottom}`);
});

test('small organisms are fitter in cold, large in warm', () => {
  const small = derivePhenotype(createStarterGenome('A')); // size 0.35
  const large = derivePhenotype(createStarterGenome('B')); // size 0.7
  // fitness takes phenotype size via radius; pass genes' size proxy through phenotype
  const coldFitSmall = fitness({ ...small, size: 0.35 }, -0.8);
  const coldFitLarge = fitness({ ...large, size: 0.7 }, -0.8);
  const warmFitSmall = fitness({ ...small, size: 0.35 }, 0.8);
  const warmFitLarge = fitness({ ...large, size: 0.7 }, 0.8);
  assert.ok(coldFitSmall > coldFitLarge, 'cold favors small');
  assert.ok(warmFitLarge > warmFitSmall, 'warm favors large');
});

test('fitness stays within [0,1]', () => {
  for (const size of [0, 0.5, 1]) for (const t of [-1, 0, 1]) {
    const f = fitness({ size, metabolism: 0.5 }, t);
    assert.ok(f >= 0 && f <= 1, `f=${f}`);
  }
});

test('energyDelta positive with plentiful food + good fit, negative when starved', () => {
  const p = { size: 0.5, metabolism: 0.5 };
  const good = energyDelta(p, 0, 1);   // matched temp, full food
  const bad = energyDelta(p, 0, 0);    // no food
  assert.ok(good > 0, `good ${good}`);
  assert.ok(bad < 0, `bad ${bad}`);
});

test('real phenotypes: small favored in cold, large in warm (guards C1)', () => {
  const base = createStarterGenome('A');
  const small = derivePhenotype({ ...base, genes: { ...base.genes, size: 0.2 } });
  const large = derivePhenotype({ ...base, genes: { ...base.genes, size: 0.8 } });
  // sanity: phenotype actually carries the size gene now
  assert.equal(small.size, 0.2);
  assert.equal(large.size, 0.8);
  const cold = -0.8, warm = 0.8, food = 0.6;
  assert.ok(energyDelta(small, cold, food) > energyDelta(large, cold, food), 'cold favors small');
  assert.ok(energyDelta(large, warm, food) > energyDelta(small, warm, food), 'warm favors large');
});
