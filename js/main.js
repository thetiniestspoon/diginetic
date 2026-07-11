import { World } from './world.js';
import { mountHud } from './hud.js';
import { pickLocalWhisper } from './whispers.js';
import { requirePorchSession, invokeAction } from './supabase.js';
import { routeShare } from './share.js';

const host = document.getElementById('stage-host');
const whisperEl = document.getElementById('whisper');
const hud = mountHud(document.getElementById('hud'));

const app = new PIXI.Application();
let world = null;
let currentWorldId = null;

function whisper(text) {
  whisperEl.textContent = text;
  whisperEl.style.opacity = '0';
  requestAnimationFrame(() => { whisperEl.style.opacity = '0.9'; });
}

async function startWorld({ seed, params, starterGenomes }) {
  world = new World(app, { seed, params });
  world.onWhisper((m) => whisper(pickLocalWhisper(m)));
  world.begin(starterGenomes);
  try {
    const res = await invokeAction('spawn_initial_world', { name: seed.label, seed, params });
    currentWorldId = res?.world_id ?? null;
  } catch (e) { console.warn('spawn persist failed (playing local):', e.message); currentWorldId = null; }
}

async function boot() {
  const ok = await requirePorchSession();
  if (!ok) return;
  await app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0 });
  host.appendChild(app.canvas);
  const shared = await routeShare(location.search, { invokeAction, currentWorldId: null });
  if (shared?.action === 'clone') {
    const { seed, params } = shared.result;
    await startWorld({ seed, params });
    currentWorldId = shared.result.new_world_id;
    whisper('A world cloned. It is yours now.');
  } else {
    await startWorld({ seed: { label: 'genesis' }, params: { temperature: 0, food: 0.6 } });
  }
  app.ticker.add((ticker) => {
    world.update(ticker.deltaTime);
    hud({ tick: world.tick, population: world.population, generation: world.generation, diversity: world.metrics.diversity });
  });
}

function beginWorld() {
  startWorld({ seed: { label: 'genesis-' + Date.now() }, params: { temperature: (Math.random() * 2 - 1) * 0.6, food: 0.6 } });
}

document.getElementById('btn-begin').addEventListener('click', beginWorld);
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
document.getElementById('btn-share').addEventListener('click', async () => {
  if (!currentWorldId) { whisper('Begin a world first.'); return; }
  try {
    const res = await invokeAction('share_world', { world_id: currentWorldId, visibility: 'unlisted' });
    const link = location.origin + location.pathname + res.url;
    await navigator.clipboard?.writeText(link).catch(() => {});
    whisper('Share link copied.');
  } catch (e) { console.warn('share failed:', e.message); whisper('Could not share.'); }
});
document.getElementById('btn-overlays').addEventListener('click', () => whisper('Hidden currents reveal their paths.'));

boot();
