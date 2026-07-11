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
