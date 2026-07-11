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
