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
