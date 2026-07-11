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
  return { radius, colorHex, speed, metabolism: g.metabolism, fertility: g.fertility, size: g.size };
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
  const sortDeep = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortDeep(v[k]); return o; }, {})
      : v;
  return JSON.stringify(sortDeep(genome));
}

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
