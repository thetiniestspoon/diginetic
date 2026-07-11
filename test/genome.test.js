import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/rng.js';
import {
  createStarterGenome, derivePhenotype, mutate, genomeHash, canonicalGenomeString, GENE_KEYS
} from '../js/genome.js';

test('starter genomes have all genes in range', () => {
  for (const v of ['A', 'B']) {
    const g = createStarterGenome(v);
    for (const k of GENE_KEYS) assert.ok(k in g.genes, `missing ${k}`);
    for (const k of ['size','speed','metabolism','fertility']) {
      assert.ok(g.genes[k] >= 0 && g.genes[k] <= 1, `${k}=${g.genes[k]}`);
    }
    assert.ok(g.genes.hue >= 0 && g.genes.hue < 360);
    assert.ok(g.per_locus_sigma > 0);
  }
});

test('phenotype maps genes to render fields', () => {
  const g = createStarterGenome('A');
  const p = derivePhenotype(g);
  assert.ok(p.radius >= 3 && p.radius <= 14, `radius ${p.radius}`);
  assert.equal(Number.isInteger(p.colorHex), true);
  assert.ok(p.colorHex >= 0 && p.colorHex <= 0xFFFFFF);
  assert.ok(p.speed > 0);
});

test('mutate keeps genes clamped to range', () => {
  const rng = makeRng(3);
  let g = createStarterGenome('A');
  g.per_locus_sigma = 5; // absurdly high — force clamp
  for (let i = 0; i < 200; i++) g = mutate(g, rng);
  for (const k of ['size','speed','metabolism','fertility']) {
    assert.ok(g.genes[k] >= 0 && g.genes[k] <= 1, `${k}=${g.genes[k]}`);
  }
  assert.ok(g.genes.hue >= 0 && g.genes.hue < 360, `hue ${g.genes.hue}`);
});

test('mutate is deterministic under a seeded rng', () => {
  const g = createStarterGenome('B');
  const m1 = mutate(g, makeRng(42));
  const m2 = mutate(g, makeRng(42));
  assert.deepEqual(m1.genes, m2.genes);
});

test('canonical string is key-order independent', () => {
  const g1 = { version: 1, per_locus_sigma: 0.08, genes: { size: 0.5, hue: 10, speed: 0.4, metabolism: 0.3, fertility: 0.6 } };
  const g2 = { genes: { fertility: 0.6, metabolism: 0.3, speed: 0.4, hue: 10, size: 0.5 }, per_locus_sigma: 0.08, version: 1 };
  assert.equal(canonicalGenomeString(g1), canonicalGenomeString(g2));
});

test('genomeHash is stable sha256 hex', async () => {
  const g = createStarterGenome('A');
  const h1 = await genomeHash(g);
  const h2 = await genomeHash(g);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});
