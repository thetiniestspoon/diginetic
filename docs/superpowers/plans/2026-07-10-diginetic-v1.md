# Diginetic v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Diginetic — a digital-genetics evolution sim — as a static PixiJS game on GitHub Pages, backed by shared Family Core Supabase, registered as a card in the Oak Park Playroom Arcade.

**Architecture:** Client-authoritative genetics engine (60fps PixiJS loop, all evolution client-side) plus a single action-routed Supabase edge function for persistence checkpoints (ownership, snapshots, sharing, clone, genome import, LLM narration). Pure-logic modules (RNG, genome, selection, share-params, whispers) are ESM, unit-tested with Node's built-in test runner; rendering/loop/backend/deploy are browser- and CLI-verified.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), PixiJS v8 via CDN, Supabase (Family Core `ckjcieeccopqowlfljja`), Deno edge function, LLM Gateway (`api.llmgateway.io`), GitHub Pages, `gh` + `npx supabase` CLIs, `node --test`.

## Global Constraints

- Repo: `C:\Users\shawn\GitRepositories\diginetic` → GitHub `thetiniestspoon/diginetic` → `https://thetiniestspoon.github.io/diginetic/`.
- Static hosting only — no server-side routing. All asset paths relative (`./js/...`), never absolute (`/js/...`), so the `/diginetic/` Pages base resolves.
- Family Core Supabase: URL `https://ckjcieeccopqowlfljja.supabase.co`, publishable key `sb_publishable_IRcRu0nSCDCInd8XPpImaA_ztlZ2poj`, auth storage key `sb-ckjcieeccopqowlfljja-auth-token` (written by the porch; do not override `storageKey`).
- All Supabase objects prefixed `diginetic_` (tables) / `diginetic_` (enums). NEVER redefine `auth.uid()`.
- Family-only game: porch-gate bounce to `https://thetiniestspoon.github.io/command-center/porch.html?return=<url>` when no session.
- `"type": "module"` in package.json so `.js` files are ESM in both Node (tests) and browser (`<script type="module">`).
- Commit after every task. Commit trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Arcade card: icon `🧫`, tint `rgba(52,211,153,0.20)` (🧬 is taken by Tardigrades).

## File Structure

```
diginetic/
  index.html            # scroll-less mobile shell
  css/styles.css        # shell + HUD + whisper styles
  js/rng.js             # seeded PRNG + gaussian (pure)
  js/genome.js          # genome, phenotype, mutation, sha256 hash (pure)
  js/environment.js     # temperature/food field + fitness/selection (pure)
  js/share.js           # query-param parsing (pure) + backend-driven routing
  js/whispers.js        # local phrase bank (pure) + LLM narration client
  js/organism.js        # Organism: state + PixiJS sprite (browser)
  js/world.js           # World: sim loop, population, selection, HUD data (browser)
  js/hud.js             # HUD DOM rendering (browser)
  js/supabase.js        # client, porch-gate, edge-fn action wrappers (browser)
  js/main.js            # bootstrap + UI wiring (browser)
  test/rng.test.js
  test/genome.test.js
  test/environment.test.js
  test/share.test.js
  test/whispers.test.js
  package.json          # type:module, test script
  supabase/schema.sql   # adapted Family Core schema (operator runs)
  supabase/functions/diginetic/index.ts   # single edge function
  docs/superpowers/...  # spec + this plan
```

---

### Task 1: Repo scaffold, test harness, seeded RNG

**Files:**
- Create: `package.json`
- Create: `js/rng.js`
- Test: `test/rng.test.js`

**Interfaces:**
- Produces: `makeRng(seed: number) => () => number` (returns float in [0,1)); `gaussian(rng: () => number, sigma: number) => number`; `hashStringToSeed(s: string) => number`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "diginetic",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test** — `test/rng.test.js`

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /c/Users/shawn/GitRepositories/diginetic && npm test`
Expected: FAIL — cannot find module `../js/rng.js`.

- [ ] **Step 4: Write minimal implementation** — `js/rng.js`

```js
// Seeded PRNG (mulberry32) + Box-Muller gaussian. Pure, works in Node + browser.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng, sigma) {
  const u = 1 - rng(), v = 1 - rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

export function hashStringToSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (5 tests in rng.test.js).

- [ ] **Step 6: Commit**

```bash
git add package.json js/rng.js test/rng.test.js
git commit -m "feat: seeded RNG + gaussian with tests"
```

---

### Task 2: Genome, phenotype, mutation, hashing

**Files:**
- Create: `js/genome.js`
- Test: `test/genome.test.js`

**Interfaces:**
- Consumes: `makeRng`, `gaussian` from `rng.js`.
- Produces:
  - `GENE_KEYS = ['size','hue','speed','metabolism','fertility']`
  - `createStarterGenome(variant: 'A'|'B') => Genome` where `Genome = { version, genes: {size,hue,speed,metabolism,fertility}, per_locus_sigma }` (all genes in [0,1] except `hue` in [0,360)).
  - `derivePhenotype(genome) => { radius, colorHex, speed, metabolism, fertility }` (`radius` in px 3..14, `colorHex` a 0xRRGGBB int).
  - `mutate(genome, rng) => Genome` (gaussian per-gene, clamped).
  - `genomeHash(genome) => Promise<string>` sha256 hex over canonical JSON.
  - `canonicalGenomeString(genome) => string` (sorted-key stable JSON).

- [ ] **Step 1: Write the failing test** — `test/genome.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../js/genome.js`.

- [ ] **Step 3: Write implementation** — `js/genome.js`

```js
import { gaussian } from './rng.js';

export const GENE_KEYS = ['size', 'hue', 'speed', 'metabolism', 'fertility'];

const STARTERS = {
  A: { size: 0.35, hue: 150, speed: 0.6, metabolism: 0.4, fertility: 0.5 },
  B: { size: 0.7,  hue: 280, speed: 0.35, metabolism: 0.55, fertility: 0.45 },
};

export function createStarterGenome(variant) {
  const base = STARTERS[variant] ?? STARTERS.A;
  return { version: 1, genes: { ...base }, per_locus_sigma: 0.08 };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function derivePhenotype(genome) {
  const g = genome.genes;
  const radius = 3 + g.size * 11;                 // 3..14 px
  const colorHex = hslToHex(g.hue, 0.55, 0.55);
  const speed = 0.3 + g.speed * 1.7;              // px/tick base
  return { radius, colorHex, speed, metabolism: g.metabolism, fertility: g.fertility };
}

export function mutate(genome, rng) {
  const s = genome.per_locus_sigma ?? 0.05;
  const g = genome.genes;
  return {
    version: genome.version ?? 1,
    per_locus_sigma: s,
    genes: {
      size: clamp01(g.size + gaussian(rng, s)),
      hue: ((g.hue + gaussian(rng, s) * 60) % 360 + 360) % 360,
      speed: clamp01(g.speed + gaussian(rng, s)),
      metabolism: clamp01(g.metabolism + gaussian(rng, s)),
      fertility: clamp01(g.fertility + gaussian(rng, s)),
    },
  };
}

export function canonicalGenomeString(genome) {
  return JSON.stringify(genome, Object.keys(flatten(genome)).sort ? sortReplacer() : undefined);
}
function sortReplacer() {
  return (key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value).sort().reduce((o, k) => { o[k] = value[k]; return o; }, {})
      : value;
}
function flatten(o) { return o; }

export async function genomeHash(genome) {
  const data = new TextEncoder().encode(canonicalGenomeString(genome));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const R = Math.round((r + m) * 255), G = Math.round((g + m) * 255), B = Math.round((b + m) * 255);
  return (R << 16) | (G << 8) | B;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all genome tests). If `canonicalGenomeString` order test fails, simplify to the deterministic sorted-key serializer below and re-run:

```js
export function canonicalGenomeString(genome) {
  const sortDeep = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortDeep(v[k]); return o; }, {})
      : v;
  return JSON.stringify(sortDeep(genome));
}
```

- [ ] **Step 5: Commit**

```bash
git add js/genome.js test/genome.test.js
git commit -m "feat: genome/phenotype/mutation/sha256 with tests"
```

---

### Task 3: Environment field + selection/fitness

**Files:**
- Create: `js/environment.js`
- Test: `test/environment.test.js`

**Interfaces:**
- Produces:
  - `makeEnvironment(params) => Environment` where `params = { temperature: number[-1..1], food: number[0..1] }`; `Environment = { temperature, food, sampleTemp(x, y, w, h) }` (temperature varies with y: colder at top).
  - `fitness(phenotype, localTemp) => number` in ~[0,1]: organisms whose `size` matches the local temperature survive better (cold→small favored, warm→large favored); high metabolism costs fitness.
  - `energyDelta(phenotype, localTemp, food) => number` — per-tick net energy change (feed − metabolic burn), scaled by fitness.

- [ ] **Step 1: Write the failing test** — `test/environment.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../js/environment.js`.

- [ ] **Step 3: Write implementation** — `js/environment.js`

```js
// Environment: vertical temperature gradient + food scalar. Pure.
export function makeEnvironment(params) {
  const temperature = clamp(params?.temperature ?? 0, -1, 1);
  const food = clamp01(params?.food ?? 0.5);
  return {
    temperature,
    food,
    // colder at top (y small), warmer at bottom, biased by base temperature
    sampleTemp(x, y, w, h) {
      const vertical = (y / (h || 1)) * 2 - 1; // -1 top .. +1 bottom
      return clamp(vertical + temperature, -1, 1);
    },
  };
}

// Preferred size rises with temperature: cold (-1) prefers size 0, warm (+1) prefers size 1.
export function fitness(phenotype, localTemp) {
  const preferredSize = (localTemp + 1) / 2;            // 0..1
  const mismatch = Math.abs((phenotype.size ?? 0.5) - preferredSize);
  const sizeFit = 1 - mismatch;                          // 1 perfect .. 0 worst
  const metabolicCost = 0.25 * (phenotype.metabolism ?? 0.5);
  return clamp01(sizeFit - metabolicCost);
}

export function energyDelta(phenotype, localTemp, food) {
  const f = fitness(phenotype, localTemp);
  const gain = food * (0.4 + 0.6 * f) * 0.08;            // feeding scaled by fit
  const burn = (0.02 + 0.06 * (phenotype.metabolism ?? 0.5));
  return gain - burn;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function clamp01(x) { return clamp(x, 0, 1); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all environment tests).

- [ ] **Step 5: Commit**

```bash
git add js/environment.js test/environment.test.js
git commit -m "feat: environment field + selection/fitness with tests"
```

---

### Task 4: Share-param parsing + local whisper phrase bank

**Files:**
- Create: `js/share.js` (parse function only in this task; backend routing added in Task 9)
- Create: `js/whispers.js` (local phrase bank in this task; LLM client added in Task 10)
- Test: `test/share.test.js`, `test/whispers.test.js`

**Interfaces:**
- Produces:
  - `parseShareParams(search: string) => { mode: 'world'|'genome'|null, slug: string|null }` (input like `?w=abc123` or `?genome=xy`).
  - `pickLocalWhisper(metrics) => string` where `metrics = { births, deaths, diversity, tempDrift }`.

- [ ] **Step 1: Write the failing tests**

`test/share.test.js`:

```js
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
```

`test/whispers.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `../js/share.js` and `../js/whispers.js`.

- [ ] **Step 3: Write implementations**

`js/share.js`:

```js
// Query-param share routing. parseShareParams is pure; backend routing added later.
export function parseShareParams(search) {
  const p = new URLSearchParams(search || '');
  if (p.get('w')) return { mode: 'world', slug: p.get('w') };
  if (p.get('genome')) return { mode: 'genome', slug: p.get('genome') };
  return { mode: null, slug: null };
}
```

`js/whispers.js`:

```js
// Poetic whispers. Local phrase bank (pure); LLM client added in Task 10.
export function pickLocalWhisper(metrics) {
  const m = metrics ?? {};
  if ((m.births ?? 0) > (m.deaths ?? 0)) return 'New life gathers at the edges.';
  if ((m.deaths ?? 0) > (m.births ?? 0)) return 'Silence spreads through hidden folds.';
  if ((m.tempDrift ?? 0) > 0.2) return 'Warm currents stir the restless.';
  if ((m.tempDrift ?? 0) < -0.2) return 'Cold shadows favor the still.';
  return 'Patterns sway beneath the surface.';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (share + whispers tests, all suites green).

- [ ] **Step 5: Commit**

```bash
git add js/share.js js/whispers.js test/share.test.js test/whispers.test.js
git commit -m "feat: share-param parsing + local whisper bank with tests"
```

---

### Task 5: Playable engine — Organism, World loop, HUD, shell (Phase 1 milestone)

**Files:**
- Create: `js/organism.js`, `js/world.js`, `js/hud.js`, `js/main.js`
- Create: `index.html`, `css/styles.css`

**Interfaces:**
- Consumes: `derivePhenotype`, `mutate` (genome.js); `makeRng`, `gaussian`, `hashStringToSeed` (rng.js); `makeEnvironment`, `energyDelta`, `fitness` (environment.js); `pickLocalWhisper` (whispers.js).
- Produces:
  - `class Organism { constructor(genome, x, y); genome; energy; ageTicks; sprite; step(env, w, h, rng); }`
  - `class World { constructor(app, { seed, params }); begin(); onWhisper(cb); metrics; generation; population; }`
  - `mountHud(el) => (state) => void` (updates tick/pop/generation/diversity).
- This task has no unit tests (PixiJS/DOM). **Verification is browser-run** at the end.

- [ ] **Step 1: Write `index.html`** (scroll-less shell, PixiJS v8 CDN, relative module path)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Diginetic</title>
    <link rel="stylesheet" href="./css/styles.css" />
  </head>
  <body>
    <div id="app">
      <header>
        <div class="brand">Diginetic</div>
        <div id="hud" class="hud" aria-live="polite"></div>
      </header>
      <main id="stage-host">
        <div class="whisper" id="whisper">Patterns sway beneath the surface.</div>
      </main>
      <footer>
        <button id="btn-begin">● Begin a World</button>
        <button id="btn-snapshot">Snapshot</button>
        <button id="btn-share">Share</button>
        <button id="btn-overlays">Overlays</button>
      </footer>
    </div>
    <script src="https://unpkg.com/pixi.js@8/dist/pixi.min.js"></script>
    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `css/styles.css`**

```css
html,body{margin:0;padding:0;height:100%;background:#0b0d10;color:#e6f2ff;
  font-family:ui-sans-serif,system-ui,-apple-system;overflow:hidden}
#app{position:fixed;inset:0;display:flex;flex-direction:column}
header{padding:12px 16px;display:flex;justify-content:space-between;align-items:center;font-weight:600}
.hud{font-size:12px;opacity:.8;display:flex;gap:12px;font-variant-numeric:tabular-nums}
main{flex:1;position:relative;overflow:hidden}
main canvas{position:absolute;inset:0}
footer{padding:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
button{border:0;padding:12px 16px;border-radius:999px;background:#ffffff10;color:#e6f2ff;
  font-weight:600;backdrop-filter:blur(6px)}
button:active{transform:scale(.98)}
.whisper{position:absolute;left:50%;transform:translateX(-50%);bottom:24px;
  opacity:.85;font-size:14px;text-align:center;max-width:80%;pointer-events:none;
  transition:opacity 800ms ease-out}
```

- [ ] **Step 3: Write `js/organism.js`**

```js
import { derivePhenotype, mutate } from './genome.js';
import { energyDelta } from './environment.js';

export class Organism {
  constructor(genome, x, y) {
    this.genome = genome;
    this.pheno = derivePhenotype(genome);
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.energy = 1;
    this.ageTicks = 0;
    this.sprite = null;
  }
  attach(app) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, this.pheno.radius).fill(this.pheno.colorHex);
    this.sprite = new PIXI.Sprite(app.renderer.generateTexture(g));
    this.sprite.anchor.set(0.5);
    this.sprite.x = this.x; this.sprite.y = this.y;
    app.stage.addChild(this.sprite);
    return this;
  }
  step(env, w, h, rng, delta) {
    // wander
    this.vx += (rng() - 0.5) * 0.4; this.vy += (rng() - 0.5) * 0.4;
    const sp = this.pheno.speed;
    const mag = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / mag) * sp; this.vy = (this.vy / mag) * sp;
    this.x += this.vx * delta; this.y += this.vy * delta;
    if (this.x < 0 || this.x > w) this.vx *= -1;
    if (this.y < 0 || this.y > h) this.vy *= -1;
    this.x = Math.max(0, Math.min(w, this.x)); this.y = Math.max(0, Math.min(h, this.y));
    const t = env.sampleTemp(this.x, this.y, w, h);
    this.energy += energyDelta(this.pheno, t, env.food) * delta;
    this.ageTicks += 1;
    if (this.sprite) { this.sprite.x = this.x; this.sprite.y = this.y; }
  }
  reproduce(rng) {
    const child = new Organism(mutate(this.genome, rng), this.x, this.y);
    this.energy *= 0.5; child.energy = 0.5;
    return child;
  }
  isDead() { return this.energy <= 0 || this.ageTicks > 1600; }
  destroy() { if (this.sprite) { this.sprite.destroy(); this.sprite = null; } }
}
```

- [ ] **Step 4: Write `js/world.js`**

```js
import { Organism } from './organism.js';
import { makeEnvironment } from './environment.js';
import { makeRng, hashStringToSeed } from './rng.js';
import { createStarterGenome } from './genome.js';

const MAX_POP = 400;
const REPRO_ENERGY = 1.6;

export class World {
  constructor(app, { seed, params }) {
    this.app = app;
    this.seed = seed ?? { label: 'genesis' };
    this.params = params ?? { temperature: 0, food: 0.6 };
    this.env = makeEnvironment(this.params);
    const seedInt = hashStringToSeed(JSON.stringify(this.seed));
    this.rng = makeRng(seedInt);
    this.organisms = [];
    this.tick = 0;
    this.generation = 1;
    this.metrics = { births: 0, deaths: 0, diversity: 1, tempDrift: 0 };
    this._whisperCb = null;
    this._acc = { births: 0, deaths: 0 };
  }
  onWhisper(cb) { this._whisperCb = cb; }
  get population() { return this.organisms.length; }

  begin(starterGenomes) {
    this.organisms.forEach((o) => o.destroy());
    const w = this.app.renderer.width, h = this.app.renderer.height;
    const genomes = starterGenomes ?? [createStarterGenome('A'), createStarterGenome('B')];
    this.organisms = [];
    for (let i = 0; i < 60; i++) {
      const g = genomes[i % genomes.length];
      const o = new Organism(structuredClone(g), this.rng() * w, this.rng() * h).attach(this.app);
      this.organisms.push(o);
    }
  }

  update(delta) {
    const w = this.app.renderer.width, h = this.app.renderer.height;
    const born = [];
    for (const o of this.organisms) {
      o.step(this.env, w, h, this.rng, delta);
      if (o.energy >= REPRO_ENERGY && this.organisms.length + born.length < MAX_POP
          && this.rng() < o.pheno.fertility * 0.05) {
        born.push(o.reproduce(this.rng).attach(this.app));
      }
    }
    let deaths = 0;
    this.organisms = this.organisms.filter((o) => {
      if (o.isDead()) { o.destroy(); deaths++; return false; }
      return true;
    });
    this.organisms.push(...born);
    this._acc.births += born.length; this._acc.deaths += deaths;
    this.tick += 1;
    if (this.tick % 120 === 0) this._rollMetrics();
  }

  _rollMetrics() {
    // diversity = stddev of size gene across population (0..~0.5) normalized
    const sizes = this.organisms.map((o) => o.genome.genes.size);
    const mean = sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1);
    const varc = sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / (sizes.length || 1);
    const diversity = Math.min(1, Math.sqrt(varc) * 3);
    this.metrics = {
      births: this._acc.births, deaths: this._acc.deaths,
      diversity, tempDrift: this.params.temperature,
    };
    if (this._acc.births > this.population) this.generation += 1;
    this._acc = { births: 0, deaths: 0 };
    if (this._whisperCb) this._whisperCb(this.metrics);
  }
}
```

- [ ] **Step 5: Write `js/hud.js`**

```js
export function mountHud(el) {
  return function render(state) {
    el.innerHTML =
      `<span>tick ${state.tick}</span>` +
      `<span>pop ${state.population}</span>` +
      `<span>gen ${state.generation}</span>` +
      `<span>div ${state.diversity.toFixed(2)}</span>`;
  };
}
```

- [ ] **Step 6: Write `js/main.js`** (engine-only wiring; backend wired in later tasks)

```js
import { World } from './world.js';
import { mountHud } from './hud.js';
import { pickLocalWhisper } from './whispers.js';

const host = document.getElementById('stage-host');
const whisperEl = document.getElementById('whisper');
const hud = mountHud(document.getElementById('hud'));

const app = new PIXI.Application();
let world = null;

function whisper(text) {
  whisperEl.textContent = text;
  whisperEl.style.opacity = '0';
  requestAnimationFrame(() => { whisperEl.style.opacity = '0.9'; });
}

async function boot() {
  await app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0 });
  host.appendChild(app.canvas);
  world = new World(app, { seed: { label: 'genesis' }, params: { temperature: 0, food: 0.6 } });
  world.onWhisper((m) => whisper(pickLocalWhisper(m)));
  world.begin();
  app.ticker.add((ticker) => {
    world.update(ticker.deltaTime);
    hud({ tick: world.tick, population: world.population, generation: world.generation, diversity: world.metrics.diversity });
  });
}

function beginWorld() {
  if (!world) return;
  world = new World(app, { seed: { label: 'genesis-' + Date.now() }, params: { temperature: (Math.random() * 2 - 1) * 0.6, food: 0.6 } });
  world.onWhisper((m) => whisper(pickLocalWhisper(m)));
  world.begin();
}

document.getElementById('btn-begin').addEventListener('click', beginWorld);
document.getElementById('btn-snapshot').addEventListener('click', () => whisper('A moment kept in amber.'));
document.getElementById('btn-share').addEventListener('click', () => whisper('Your world is ready to travel.'));
document.getElementById('btn-overlays').addEventListener('click', () => whisper('Hidden currents reveal their paths.'));

boot();
```

> Note: `Date.now()`/`Math.random()` are fine in the browser app; only the Workflow-script sandbox forbids them.

- [ ] **Step 7: Verify the full test suite still passes**

Run: `npm test`
Expected: PASS (rng, genome, environment, share, whispers — no regressions).

- [ ] **Step 8: Browser verification (the Phase 1 milestone)**

Run a static server and open it:
Run: `cd /c/Users/shawn/GitRepositories/diginetic && python -m http.server 8173`
Then drive with the webapp-testing skill (Playwright) OR Claude-in-Chrome:
- Navigate to `http://localhost:8173/`.
- Confirm: canvas renders colored organisms moving; HUD shows tick incrementing and pop changing; tapping **Begin a World** reseeds; whisper text updates on metric rolls.
- Screenshot for the record.
- **Success criterion:** over ~30s the population changes (births/deaths) and the size-gene distribution shifts toward the temperature-preferred size (visible evolution), no console errors.

- [ ] **Step 9: Commit**

```bash
git add index.html css/styles.css js/organism.js js/world.js js/hud.js js/main.js
git commit -m "feat: playable genetics engine (Pixi loop, HUD, shell)"
```

---

### Task 6: Adapted Family Core schema (SQL + operator handoff)

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces the `diginetic_*` tables/enums/RLS the edge function and client depend on.
- No unit test — verification is that the SQL is syntactically self-consistent and never touches `auth.uid()`. Actual run is an operator Dashboard step (handoff in Task 11/closeout).

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
-- Diginetic — Family Core schema (SHARED PROJECT: ckjcieeccopqowlfljja)
-- Safe to run on shared Family Core: all objects prefixed diginetic_.
-- NEVER redefine auth.uid() — Supabase provides it.

create type diginetic_visibility as enum ('private','unlisted','public');
create type diginetic_share_kind as enum ('world','genome');

create table if not exists public.diginetic_worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  seed jsonb not null,
  params jsonb not null,
  tick int not null default 0,
  visibility diginetic_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_dg_worlds_owner on public.diginetic_worlds(owner_id);
create index if not exists idx_dg_worlds_visibility on public.diginetic_worlds(visibility);

create table if not exists public.diginetic_genomes (
  id uuid primary key default gen_random_uuid(),
  hash text unique not null,
  payload jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.diginetic_organisms (
  id bigserial primary key,
  world_id uuid not null references public.diginetic_worlds(id) on delete cascade,
  genome_id uuid not null references public.diginetic_genomes(id),
  position jsonb not null,
  velocity jsonb not null,
  energy real not null default 1.0,
  age_ticks int not null default 0,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_dg_organisms_world on public.diginetic_organisms(world_id);

create table if not exists public.diginetic_snapshots (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.diginetic_worlds(id) on delete cascade,
  tick int not null,
  summary jsonb not null,
  thumb_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.diginetic_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  kind diginetic_share_kind not null,
  target_world_id uuid references public.diginetic_worlds(id) on delete cascade,
  target_genome_id uuid references public.diginetic_genomes(id) on delete cascade,
  slug text unique not null,
  permissions jsonb not null default jsonb_build_object('remix', true, 'import', true),
  created_at timestamptz not null default now(),
  check (
    (kind = 'world' and target_world_id is not null and target_genome_id is null) or
    (kind = 'genome' and target_genome_id is not null and target_world_id is null)
  )
);

create table if not exists public.diginetic_events (
  id bigserial primary key,
  world_id uuid not null references public.diginetic_worlds(id) on delete cascade,
  organism_id bigint,
  tick int not null,
  type text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_dg_events_world_tick on public.diginetic_events(world_id, tick);

create table if not exists public.diginetic_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diginetic_worlds enable row level security;
alter table public.diginetic_genomes enable row level security;
alter table public.diginetic_organisms enable row level security;
alter table public.diginetic_snapshots enable row level security;
alter table public.diginetic_shares enable row level security;
alter table public.diginetic_events enable row level security;
alter table public.diginetic_settings enable row level security;

create policy dg_worlds_owner_rw on public.diginetic_worlds for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dg_worlds_public_r on public.diginetic_worlds for select
  using (visibility in ('public','unlisted'));

create policy dg_genomes_r on public.diginetic_genomes for select using (true);
create policy dg_genomes_w on public.diginetic_genomes for insert with check (created_by = auth.uid());

create policy dg_organisms_owner_r on public.diginetic_organisms for select using (
  exists (select 1 from public.diginetic_worlds w
          where w.id = world_id and (w.owner_id = auth.uid() or w.visibility in ('public','unlisted')))
);

create policy dg_snapshots_r on public.diginetic_snapshots for select using (
  exists (select 1 from public.diginetic_worlds w
          where w.id = world_id and (w.owner_id = auth.uid() or w.visibility in ('public','unlisted')))
);

create policy dg_shares_by_slug_r on public.diginetic_shares for select using (true);
create policy dg_shares_owner_rw on public.diginetic_shares for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy dg_settings_owner_rw on public.diginetic_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Sanity-check the SQL for the forbidden pattern**

Run: `grep -n "auth.uid" supabase/schema.sql | grep -i "create or replace"`
Expected: **no output** (we never redefine auth.uid).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: adapted Family Core schema (diginetic_ prefixed, RLS)"
```

---

### Task 7: Single action-routed edge function

**Files:**
- Create: `supabase/functions/diginetic/index.ts`

**Interfaces:**
- Produces one Deno edge function invoked as `POST` with `{ action, ...payload }`.
- Actions: `spawn_initial_world`, `tick_reproduction`, `make_snapshot`, `share_world`, `clone_world_from_slug`, `import_genome_from_slug`, `summarize_world_tick`.
- Uses service-role client for writes; resolves `owner_id` from the caller's JWT.
- No unit test (Deno + network). Verified by deploy + client integration in Task 8/11.

- [ ] **Step 1: Write `supabase/functions/diginetic/index.ts`**

```ts
// Diginetic — single action-routed edge function (Deno) on Family Core.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function serverClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const sb = serverClient();
  const { data } = await sb.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

function shortSlug() { return Math.random().toString(36).slice(2, 8); }
function gaussianNoise(sigma: number) {
  const u = 1 - Math.random(), v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}
async function sha256Hex(obj: unknown) {
  const data = new TextEncoder().encode(canonical(obj));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function canonical(v: any): string {
  const sort = (x: any): any =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.keys(x).sort().reduce((o: any, k) => { o[k] = sort(x[k]); return o; }, {})
      : x;
  return JSON.stringify(sort(v));
}

const handlers: Record<string, (sb: any, body: any, ownerId: string | null) => Promise<Response>> = {
  async spawn_initial_world(sb, body, ownerId) {
    const { name, seed, params, starter_genomes } = body ?? {};
    if (!name || !seed || !params) return json({ error: 'Missing name/seed/params' }, 400);
    const { data: world, error } = await sb.from('diginetic_worlds')
      .insert({ name, seed, params, owner_id: ownerId, visibility: 'private' }).select().single();
    if (error || !world) return json({ error: error?.message ?? 'World create failed' }, 500);

    const genomes = Array.isArray(starter_genomes) && starter_genomes.length
      ? starter_genomes
      : [{ version: 1, genes: { size: 0.35, hue: 150, speed: 0.6, metabolism: 0.4, fertility: 0.5 }, per_locus_sigma: 0.08 }];
    const ids: string[] = [];
    for (const g of genomes) {
      const hash = await sha256Hex(g);
      await sb.from('diginetic_genomes').upsert({ hash, payload: g, created_by: ownerId }, { onConflict: 'hash' });
      const { data } = await sb.from('diginetic_genomes').select('id').eq('hash', hash).limit(1);
      if (data?.[0]?.id) ids.push(data[0].id);
    }
    return json({ world_id: world.id, genome_ids: ids });
  },

  async tick_reproduction(sb, body) {
    const { world_id, parent_organism_ids, tick } = body ?? {};
    if (!world_id || !Array.isArray(parent_organism_ids)) return json({ error: 'Missing world_id/parents' }, 400);
    const { data: parents } = await sb.from('diginetic_organisms')
      .select('id, genome_id, world_id').in('id', parent_organism_ids);
    let births = 0, mutations = 0;
    for (const p of parents ?? []) {
      const { data: gList } = await sb.from('diginetic_genomes').select('payload, hash').eq('id', p.genome_id).limit(1);
      if (!gList?.length) continue;
      const mutated = structuredClone(gList[0].payload);
      mutated.genes = mutated.genes ?? {};
      const sigma = mutated.per_locus_sigma ?? 0.05;
      mutated.genes.size = Math.max(0, Math.min(1, (mutated.genes.size ?? 0.5) + gaussianNoise(sigma)));
      const newHash = await sha256Hex(mutated);
      await sb.from('diginetic_genomes').upsert({ hash: newHash, payload: mutated }, { onConflict: 'hash' });
      const { data: ng } = await sb.from('diginetic_genomes').select('id').eq('hash', newHash).limit(1);
      const newGenomeId = ng?.[0]?.id;
      if (!newGenomeId) continue;
      const { error } = await sb.from('diginetic_organisms').insert({
        world_id: p.world_id, genome_id: newGenomeId,
        position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, energy: 0.5, age_ticks: 0, state: {},
      });
      if (!error) births++;
      await sb.from('diginetic_events').insert({
        world_id: p.world_id, organism_id: null, tick: tick ?? 0, type: 'mutation',
        data: { from_hash: gList[0].hash, to_hash: newHash },
      });
      mutations++;
    }
    return json({ births, mutations });
  },

  async make_snapshot(sb, body) {
    const { world_id, tick, summary, thumb_base64 } = body ?? {};
    if (!world_id || typeof tick !== 'number' || !summary) return json({ error: 'Missing fields' }, 400);
    let thumb_url: string | null = null;
    if (thumb_base64) {
      const binary = Uint8Array.from(atob(thumb_base64), (c) => c.charCodeAt(0));
      const path = `thumbs/${world_id}/${Date.now()}.webp`;
      const up = await sb.storage.from('diginetic').upload(path, binary, { contentType: 'image/webp', upsert: true });
      if (!up.error) thumb_url = sb.storage.from('diginetic').getPublicUrl(path).data.publicUrl;
    }
    const { data: snap, error } = await sb.from('diginetic_snapshots')
      .insert({ world_id, tick, summary, thumb_url }).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ snapshot_id: snap.id, thumb_url: snap.thumb_url });
  },

  async share_world(sb, body, ownerId) {
    const { world_id, visibility } = body ?? {};
    if (!world_id || !visibility) return json({ error: 'Missing world_id/visibility' }, 400);
    const { error: werr } = await sb.from('diginetic_worlds').update({ visibility }).eq('id', world_id);
    if (werr) return json({ error: werr.message }, 500);
    const slug = shortSlug();
    const { error: serr } = await sb.from('diginetic_shares')
      .insert({ kind: 'world', target_world_id: world_id, slug, owner_id: ownerId });
    if (serr) return json({ error: serr.message }, 500);
    return json({ slug, url: `?w=${slug}` });
  },

  async clone_world_from_slug(sb, body, ownerId) {
    const { slug } = body ?? {};
    if (!slug) return json({ error: 'Missing slug' }, 400);
    const { data: share } = await sb.from('diginetic_shares')
      .select('kind, target_world_id').eq('slug', slug).single();
    if (!share || share.kind !== 'world' || !share.target_world_id) return json({ error: 'Invalid world slug' }, 404);
    const { data: src } = await sb.from('diginetic_worlds')
      .select('name, seed, params').eq('id', share.target_world_id).single();
    if (!src) return json({ error: 'World not found' }, 404);
    const { data: nw, error } = await sb.from('diginetic_worlds').insert({
      name: (src.name ?? 'World') + ' (clone)', seed: src.seed, params: src.params,
      owner_id: ownerId, visibility: 'private',
    }).select().single();
    if (error || !nw) return json({ error: error?.message ?? 'Clone failed' }, 500);
    return json({ new_world_id: nw.id, seed: src.seed, params: src.params });
  },

  async import_genome_from_slug(sb, body) {
    const { world_id, slug } = body ?? {};
    if (!world_id || !slug) return json({ error: 'Missing world_id/slug' }, 400);
    const { data: share } = await sb.from('diginetic_shares')
      .select('kind, target_genome_id').eq('slug', slug).single();
    if (!share || share.kind !== 'genome' || !share.target_genome_id) return json({ error: 'Invalid genome slug' }, 404);
    const genome_id = share.target_genome_id;
    const { data: g } = await sb.from('diginetic_genomes').select('payload').eq('id', genome_id).limit(1);
    if (!g?.length) return json({ error: 'Genome not found' }, 404);
    const cohort = Array.from({ length: 3 }, () => ({
      world_id, genome_id, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, energy: 0.5, age_ticks: 0, state: {},
    }));
    const { error } = await sb.from('diginetic_organisms').insert(cohort);
    if (error) return json({ error: error.message }, 500);
    await sb.from('diginetic_events').insert({ world_id, organism_id: null, tick: 0, type: 'import', data: { slug } });
    return json({ genome_id, spawned: cohort.length, payload: g[0].payload });
  },

  async summarize_world_tick(_sb, body) {
    const m = body?.metrics ?? { births: 0, deaths: 0, diversity: 1, tempDrift: 0 };
    const key = Deno.env.get('LLM_GATEWAY_API_KEY');
    if (key) {
      try {
        const prompt = `You narrate a digital-life world in one short poetic sentence (max 12 words, no quotes). ` +
          `Signals — births:${m.births} deaths:${m.deaths} diversity:${(m.diversity ?? 0).toFixed(2)} tempDrift:${(m.tempDrift ?? 0).toFixed(2)}.`;
        const r = await fetch('https://api.llmgateway.io/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-2.0-flash',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 40, temperature: 0.9,
          }),
        });
        if (r.ok) {
          const data = await r.json();
          const line = data?.choices?.[0]?.message?.content?.trim();
          if (line) return json({ line: line.replace(/^["']|["']$/g, '') });
        }
      } catch (_e) { /* fall through to local */ }
    }
    let line = 'Patterns sway beneath the surface.';
    if (m.births > m.deaths) line = 'New life gathers at the edges.';
    else if (m.deaths > m.births) line = 'Silence spreads through hidden folds.';
    else if (m.tempDrift > 0.2) line = 'Warm currents stir the restless.';
    else if (m.tempDrift < -0.2) line = 'Cold shadows favor the still.';
    return json({ line });
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = body?.action;
  const fn = handlers[action];
  if (!fn) return json({ error: 'Unknown action', action }, 404);
  const sb = serverClient();
  const ownerId = await callerId(req);
  return fn(sb, body, ownerId);
});
```

- [ ] **Step 2: Deno syntax check (if Deno present) — else skip**

Run: `command -v deno >/dev/null 2>&1 && deno check supabase/functions/diginetic/index.ts || echo "deno not installed — will validate on deploy"`
Expected: check passes, or the skip message.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/diginetic/index.ts
git commit -m "feat: single action-routed edge function (CORS, JWT owner, sha256)"
```

---

### Task 8: Client Supabase layer + porch-gate + wire spawn/snapshot/share

**Files:**
- Create: `js/supabase.js`
- Modify: `index.html` (add supabase-js CDN), `js/main.js` (wire backend into Begin/Snapshot/Share)

**Interfaces:**
- Consumes: edge-function actions from Task 7; `parseShareParams` (Task 4).
- Produces:
  - `getClient() => SupabaseClient` (singleton; Family Core URL + publishable key; default storageKey).
  - `requirePorchSession() => Promise<boolean>` (bounce if no session).
  - `invokeAction(action, payload) => Promise<any>` (wraps `functions.invoke('diginetic', { body: { action, ...payload } })`).
- No unit test — browser integration verified in Task 11.

- [ ] **Step 1: Add supabase-js to `index.html`** (before `js/main.js`)

```html
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

- [ ] **Step 2: Write `js/supabase.js`**

```js
// Family Core Supabase client + porch-gate + edge-fn wrapper.
const SUPABASE_URL = 'https://ckjcieeccopqowlfljja.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IRcRu0nSCDCInd8XPpImaA_ztlZ2poj';
const PORCH_URL = 'https://thetiniestspoon.github.io/command-center/porch.html';

let _client = null;
export function getClient() {
  if (_client) return _client;
  // supabase UMD global is `supabase`
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return _client;
}

export async function requirePorchSession() {
  const { data: { session } } = await getClient().auth.getSession();
  if (!session) {
    window.location.replace(PORCH_URL + '?return=' + encodeURIComponent(window.location.href));
    return false;
  }
  return true;
}

export async function invokeAction(action, payload = {}) {
  const { data, error } = await getClient().functions.invoke('diginetic', {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Wire backend into `js/main.js`** — replace the `boot()` head and the snapshot/share handlers.

Add imports at top:

```js
import { requirePorchSession, invokeAction, getClient } from './supabase.js';
```

Guard at the very start of `boot()` (before `app.init`):

```js
async function boot() {
  const ok = await requirePorchSession();
  if (!ok) return;
  await app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0 });
  host.appendChild(app.canvas);
  await startWorld({ seed: { label: 'genesis' }, params: { temperature: 0, food: 0.6 } });
  app.ticker.add((ticker) => {
    world.update(ticker.deltaTime);
    hud({ tick: world.tick, population: world.population, generation: world.generation, diversity: world.metrics.diversity });
  });
}
```

Add a `startWorld` helper that persists the world server-side and keeps its id:

```js
let currentWorldId = null;

async function startWorld({ seed, params, starterGenomes }) {
  world = new World(app, { seed, params });
  world.onWhisper((m) => whisper(pickLocalWhisper(m)));
  world.begin(starterGenomes);
  try {
    const res = await invokeAction('spawn_initial_world', { name: seed.label, seed, params });
    currentWorldId = res?.world_id ?? null;
  } catch (e) { console.warn('spawn persist failed (playing local):', e.message); currentWorldId = null; }
}
```

Replace `beginWorld` body to call `startWorld`:

```js
function beginWorld() {
  startWorld({ seed: { label: 'genesis-' + Date.now() }, params: { temperature: (Math.random() * 2 - 1) * 0.6, food: 0.6 } });
}
```

Replace the snapshot handler:

```js
document.getElementById('btn-snapshot').addEventListener('click', async () => {
  whisper('A moment kept in amber.');
  if (!currentWorldId) return;
  try {
    const dataUrl = app.canvas.toDataURL('image/webp', 0.7);
    const thumb_base64 = dataUrl.split(',')[1];
    await invokeAction('make_snapshot', {
      world_id: currentWorldId, tick: world.tick,
      summary: world.metrics, thumb_base64,
    });
    whisper('Snapshot saved.');
  } catch (e) { console.warn('snapshot failed:', e.message); }
});
```

Replace the share handler:

```js
document.getElementById('btn-share').addEventListener('click', async () => {
  if (!currentWorldId) { whisper('Begin a world first.'); return; }
  try {
    const res = await invokeAction('share_world', { world_id: currentWorldId, visibility: 'unlisted' });
    const link = location.origin + location.pathname + res.url;
    await navigator.clipboard?.writeText(link).catch(() => {});
    whisper('Share link copied.');
  } catch (e) { console.warn('share failed:', e.message); whisper('Could not share.'); }
});
```

- [ ] **Step 4: Verify tests still green (no logic regressions)**

Run: `npm test`
Expected: PASS (no new tests, existing suites unaffected).

- [ ] **Step 5: Commit**

```bash
git add index.html js/supabase.js js/main.js
git commit -m "feat: Supabase client + porch-gate + wire spawn/snapshot/share"
```

---

### Task 9: Share/clone/import routing on load

**Files:**
- Modify: `js/share.js` (add `routeShare`), `js/main.js` (call it in boot)

**Interfaces:**
- Consumes: `parseShareParams` (Task 4); `invokeAction` (Task 8).
- Produces: `routeShare(search, { invokeAction, currentWorldId }) => Promise<{ action, result } | null>` — for a `?w=` slug clones and returns the new world's `{ seed, params }`; for `?genome=` imports a cohort into `currentWorldId`.

- [ ] **Step 1: Extend the test** — append to `test/share.test.js`

```js
import { routeShare } from '../js/share.js';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `routeShare` is not exported.

- [ ] **Step 3: Add `routeShare` to `js/share.js`**

```js
export async function routeShare(search, { invokeAction, currentWorldId }) {
  const { mode, slug } = parseShareParams(search);
  if (mode === 'world' && slug) {
    const result = await invokeAction('clone_world_from_slug', { slug });
    return { action: 'clone', result };
  }
  if (mode === 'genome' && slug && currentWorldId) {
    const result = await invokeAction('import_genome_from_slug', { world_id: currentWorldId, slug });
    return { action: 'import', result };
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS (share suite includes routeShare cases).

- [ ] **Step 5: Wire into `boot()` in `js/main.js`** — after `app.init` + append canvas, before starting the default world:

```js
  import { routeShare } from './share.js'; // add to top imports

  // inside boot(), replacing the unconditional startWorld:
  const shared = await routeShare(location.search, { invokeAction, currentWorldId: null });
  if (shared?.action === 'clone') {
    const { seed, params } = shared.result;
    await startWorld({ seed, params });
    currentWorldId = shared.result.new_world_id;
    whisper('A world cloned. It is yours now.');
  } else {
    await startWorld({ seed: { label: 'genesis' }, params: { temperature: 0, food: 0.6 } });
  }
```

- [ ] **Step 6: Commit**

```bash
git add js/share.js js/main.js test/share.test.js
git commit -m "feat: share/clone/import routing on load with tests"
```

---

### Task 10: Real LLM narration wiring + throttle

**Files:**
- Modify: `js/whispers.js` (add `narrate`), `js/main.js` (use throttled narrate in the whisper callback)

**Interfaces:**
- Consumes: `invokeAction` (Task 8); `pickLocalWhisper` (Task 4).
- Produces: `narrate(metrics, invokeAction) => Promise<string>` — calls `summarize_world_tick`; on any failure returns `pickLocalWhisper(metrics)`.

- [ ] **Step 1: Extend `test/whispers.test.js`**

```js
import { narrate } from '../js/whispers.js';

test('narrate returns LLM line when action succeeds', async () => {
  const invoke = async () => ({ line: 'The tide of code remembers.' });
  assert.equal(await narrate({ births: 1, deaths: 0 }, invoke), 'The tide of code remembers.');
});

test('narrate falls back to local bank on failure', async () => {
  const invoke = async () => { throw new Error('gateway down'); };
  const line = await narrate({ births: 3, deaths: 0 }, invoke);
  assert.match(line, /life|gather/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `narrate` not exported.

- [ ] **Step 3: Add `narrate` to `js/whispers.js`**

```js
export async function narrate(metrics, invokeAction) {
  try {
    const res = await invokeAction('summarize_world_tick', { metrics });
    if (res?.line) return res.line;
  } catch (_e) { /* fall through */ }
  return pickLocalWhisper(metrics);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Use throttled `narrate` in `js/main.js`** — update the whisper callback in `startWorld`. Replace `world.onWhisper((m) => whisper(pickLocalWhisper(m)));` with:

```js
  let lastNarrate = 0;
  world.onWhisper(async (m) => {
    const now = Date.now();
    if (now - lastNarrate < 12000) { whisper(pickLocalWhisper(m)); return; } // throttle LLM to ~12s
    lastNarrate = now;
    whisper(await narrate(m, invokeAction));
  });
```

Add `narrate` to the whispers import in `js/main.js`:

```js
import { pickLocalWhisper, narrate } from './whispers.js';
```

- [ ] **Step 6: Commit**

```bash
git add js/whispers.js js/main.js test/whispers.test.js
git commit -m "feat: real LLM narration with throttle + local fallback"
```

---

### Task 11: Deploy — GitHub repo, Pages, backend handoff, live verify

**Files:** none new — deploy + operator handoff.

**Interfaces:** Produces the live game at `https://thetiniestspoon.github.io/diginetic/` and the operator handoff for the three Dashboard steps + edge-function deploy.

- [ ] **Step 1: Create the GitHub repo and push**

Run:
```bash
cd /c/Users/shawn/GitRepositories/diginetic
gh repo create thetiniestspoon/diginetic --public --source=. --remote=origin --push
```
Expected: repo created, `main` pushed. (If the default branch is `master`, run `git branch -M main` first, then `git push -u origin main`.)

- [ ] **Step 2: Enable GitHub Pages (main branch, root)**

Run:
```bash
gh api -X POST repos/thetiniestspoon/diginetic/pages -f "source[branch]=main" -f "source[path]=/" 2>&1 || \
gh api -X PUT repos/thetiniestspoon/diginetic/pages -f "source[branch]=main" -f "source[path]=/"
```
Expected: Pages enabled (201/204). Wait ~1–2 min for first publish.

- [ ] **Step 3: Deploy the edge function to Family Core**

If the repo is linked and a Supabase access token is available:
```bash
cd /c/Users/shawn/GitRepositories/diginetic
npx supabase functions deploy diginetic --project-ref ckjcieeccopqowlfljja
```
Expected: function deployed. If CLI auth is missing, this becomes an operator step (handoff below).

- [ ] **Step 4: Operator handoff (Shawn's Dashboard, Family Core `ckjcieeccopqowlfljja`)**

Emit these three steps in the operator handoff format (destination-first deep link, one fenced block each):

1. **Run schema** — SQL Editor `https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/sql/new` — paste the contents of `supabase/schema.sql`, run.
2. **Create bucket** — Storage `https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/storage/buckets` — new bucket named `diginetic`, **Public** on.
3. **Set function secret** — Edge Functions settings `https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/settings/functions` — add secret `LLM_GATEWAY_API_KEY=<gateway key>`. (Without it, narration uses the local phrase bank — still fully playable.)

- [ ] **Step 5: Verify the deployed URL loads**

Wait for Pages, then check status + drive the page:
Run: `curl -s -o /dev/null -w "%{http_code}" https://thetiniestspoon.github.io/diginetic/` → expect `200`.
Then with Claude-in-Chrome / webapp-testing: navigate to `https://thetiniestspoon.github.io/diginetic/`.
- Cold (no porch session) → expect **bounce to porch**. This proves the gate.
- Authenticate at the porch with a known PIN → return to `/diginetic/` → canvas renders, HUD ticks, whispers appear.
- Check DevTools Network: `functions/v1/diginetic` calls succeed (200) once schema + function are live; if backend not yet provisioned, confirm the app still plays locally (spawn persist warns but sim runs).
- Screenshot.

- [ ] **Step 6: Commit any deploy-config tweaks** (e.g., `git branch -M main` already pushed). If nothing changed, skip.

---

### Task 12: Arcade card — art + GAMES entry + live launch verify

**Files:**
- Create: `command-center/workshop-oakpark/assets/games/diginetic.webp`
- Modify: `command-center/workshop-oakpark/rooms/playroom.js` (GAMES array in `renderArcade()`)

**Interfaces:** Produces the registered, launchable Playroom card.

- [ ] **Step 1: Generate `diginetic.webp` card art**

Create an evolutionary/organism-motif card matching sibling cards' vibe (dark, luminous, ~square). Options in order of preference:
  a. Generate via the project's image tooling / `/p` web-asset generator, export WebP.
  b. Fallback: capture a frame of the live evolved sim (`https://thetiniestspoon.github.io/diginetic/`) at a visually rich moment and convert to WebP (`cwebp frame.png -o diginetic.webp` or via an image lib).
Save to `command-center/workshop-oakpark/assets/games/diginetic.webp`. Confirm the file exists and is a valid image:
Run: `ls -la /c/Users/shawn/GitRepositories/command-center/workshop-oakpark/assets/games/diginetic.webp`

- [ ] **Step 2: Read the GAMES array, then add the entry**

Read `command-center/workshop-oakpark/rooms/playroom.js` around the `const GAMES = [` block (~line 494). Append after the `tales-by-lamplight` entry (mind the comma on the previous last line):

```js
    { slug: 'diginetic',         title: 'Diginetic',         icon: '🧫', tint: 'rgba(52,211,153,0.20)', url: 'https://thetiniestspoon.github.io/diginetic/' }
```

- [ ] **Step 3: Commit in command-center (its GSD workflow note)**

command-center's CLAUDE.md asks for GSD-routed edits; this is a one-line registry add — use `/gsd:quick` semantics (small ad-hoc change) and commit:
```bash
git -C /c/Users/shawn/GitRepositories/command-center add workshop-oakpark/rooms/playroom.js workshop-oakpark/assets/games/diginetic.webp
git -C /c/Users/shawn/GitRepositories/command-center commit -m "feat(playroom): add Diginetic arcade card"
```

- [ ] **Step 4: Push command-center so the live Playroom updates**

The Playroom is served from command-center's Pages. Push per the repo's normal branch/remote (verify with `git -C .../command-center remote -v` and `... status`). Watch for the OneDrive git-flakiness caveat — verify by SHA, not status text.
```bash
git -C /c/Users/shawn/GitRepositories/command-center push
```

- [ ] **Step 5: Verify the card launches from the live Playroom**

With Claude-in-Chrome: open the live Playroom Arcade (the workshop-oakpark playroom URL), navigate the card stack to **Diginetic**, confirm the `diginetic.webp` art renders on the card, click it, confirm it opens `https://thetiniestspoon.github.io/diginetic/` in a new tab and the game loads (post-porch). Screenshot both the card and the launched game.

- [ ] **Step 6: Final closeout**

Report: live game URL, arcade card live, backend status (schema/bucket/secret/function — done vs pending operator), and the three operator handoff steps if any remain. Update memory/log per `/l` if desired.

---

## Self-Review

**Spec coverage:**
- A (client-authoritative + checkpoints) → Tasks 5 (client loop) + 7/8 (checkpoints). ✓
- B (genetics engine) → Tasks 1–5. ✓
- C (schema surgery, prefixes, no auth.uid redef, RLS, bucket) → Task 6 (+ bucket in Task 11 handoff). ✓
- D (single action-routed fn, CORS, JWT owner, sha256, full thumb URL, tick from body) → Task 7. ✓
- E (real LLM + throttle + fallback + secret) → Tasks 7 (summarize) + 10 (client) + 11 (secret). ✓
- F (query-param share/clone/import) → Tasks 4 + 9. ✓
- G (static repo, relative paths, porch-gate, card art, GAMES entry, verify) → Tasks 8, 11, 12. ✓
- H (three operator handoffs, deep-linked) → Task 11 Step 4. ✓
- Build phasing 1–5 → Tasks 1–5 / 6–10 / 10 / 11 / 12. ✓

**Placeholder scan:** No TBD/TODO left as work; the `structuredClone` starter-genome fallback and canonical serializer are concrete. LLM model id `gemini-2.0-flash` is a concrete default (swap per LLM Gateway availability at deploy). ✓

**Type consistency:** `invokeAction(action, payload)`, `parseShareParams(search)→{mode,slug}`, `routeShare(search,{invokeAction,currentWorldId})`, `narrate(metrics,invokeAction)`, `World({seed,params})`, `Organism(genome,x,y)`, `derivePhenotype→{radius,colorHex,speed,metabolism,fertility}` used consistently across tasks. Genome shape `{version, genes:{size,hue,speed,metabolism,fertility}, per_locus_sigma}` matches client (genome.js) and edge function (spawn/tick). ✓

**Note for executor:** Tasks 6/11 include operator Dashboard steps (schema run, bucket, function secret) and CLI steps (`gh repo create`, `npx supabase functions deploy`) that may require Shawn's auth — the plan degrades gracefully (the game plays locally without the backend; narration falls back to the local bank without the secret).
