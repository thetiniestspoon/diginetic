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
