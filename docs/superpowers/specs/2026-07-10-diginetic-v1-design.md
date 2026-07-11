# Diginetic v1 — Design Spec

*Date: 2026-07-10 · Status: approved (brainstorming gate passed)*

Diginetic is a digital-genetics simulation — Tamagotchi × evolutionary biology.
Spawn a world of organisms, watch them reproduce, mutate, and evolve under
environmental selection, capture poetic snapshots, and share worlds/genomes.
Ships as a static PixiJS game on GitHub Pages, backed by the shared Family Core
Supabase, and registered as a card in the Oak Park Studio Playroom Arcade.

Source material: the March-2026 shippable bundle
(`satellite-Inbox/Documents/Diginetics/Diginetic_Shippable/`) — schema.sql, a
single-file `edge_functions.ts` (7 functions), `index.html`, `main.js`,
`supabase_client.ts`. The bundle is a fast handoff scaffold, **not** a finished
game: `main.js` is 60 bouncing dots with zero genetics; `summarize_world_tick`
is rule-based, not LLM; and `schema.sql` targets a fresh solo project and is
unsafe to paste onto shared Family Core. This spec adapts and completes it.

## v1 scope (locked)

Full backend-wired v1 with real LLM narration and generated card art:

- Real genetics engine (genome → phenotype, reproduce / mutate / die, visible
  evolution under selection) — the core build.
- All 7 backend actions on shared Family Core Supabase.
- Real LLM narration via the LLM Gateway, with a local phrase-bank fallback.
- Generated `diginetic.webp` arcade card.
- Live at `https://thetiniestspoon.github.io/diginetic/`, launching from the
  live Playroom Arcade.

## A. Architecture — client-authoritative sim + server persistence checkpoints

The real-time evolution loop runs **entirely client-side** in PixiJS for 60fps
smoothness. The Supabase backend is **not in the hot loop** — it handles
ownership, snapshots, sharing, cloning, genome import, and LLM narration at
discrete moments.

- Rejected: server-authoritative (an edge-function tick per frame) — a network
  round-trip per tick is unplayable.
- `tick_reproduction` remains in the schema/functions for **lineage
  persistence**, but is **not** called every frame. It may be invoked at
  snapshot time to record notable births/mutations.
- The bundle's `main.js` is **replaced**. The genetics engine is the core v1
  build.

## B. Genetics engine (the soul)

- **Genome** = JSON gene vector → phenotype fields: `size`, `hue`, `speed`,
  `metabolism`, `fertility`, `per_locus_sigma` (per-genome mutation rate).
- **Phenotype**: each organism's PixiJS body derives size / color / shape from
  its genome, so evolution is *visible*.
- **Loop**: organisms move; burn energy (metabolism); feed on an ambient/food
  field; reproduce when energy passes a threshold (child = parent genome +
  gaussian mutation, `size`/others clamped to guardrails); die on energy = 0 or
  old age. Population cap with LOD downshift on FPS dip (per dev notes).
- **Selection pressure**: a temperature/food field creates **directional**
  evolution (e.g., cold favors small + slow), so generations visibly drift —
  not just random walk.
- **HUD**: tick, population, generation, diversity index.
- **Deterministic seeding**: the world `seed` (JSON) drives a seeded PRNG so a
  cloned world reproduces the same starting conditions.

## C. Backend on shared Family Core — schema surgery

Family Core project ref: `ckjcieeccopqowlfljja`
(`https://ckjcieeccopqowlfljja.supabase.co`). The bundle's `schema.sql` is
adapted before it touches the shared DB:

- **Drop** `create or replace function auth.uid()` — Family Core already has
  Supabase's built-in `auth.uid()`; redefining it in the `auth` schema would
  break every sibling game. Destructive; never run it.
- **Prefix every table** `diginetic_*` (`diginetic_worlds`, `diginetic_genomes`,
  `diginetic_organisms`, `diginetic_snapshots`, `diginetic_shares`,
  `diginetic_events`, `diginetic_settings`). Generic names (`settings`,
  `events`, `shares`, `snapshots`) would collide with sibling games on the
  shared project.
- **Prefix the enums** (`diginetic_visibility`, `diginetic_share_kind`) — global
  type names collide otherwise.
- **RLS**:
  - `diginetic_worlds`: owner read/write where `owner_id = auth.uid()`;
    `select` allowed where `visibility in ('public','unlisted')`.
  - `diginetic_genomes`: `select` true (readable by all); insert with
    `created_by = auth.uid()`.
  - `diginetic_organisms`, `diginetic_events`, `diginetic_snapshots`: writes go
    through the service-role edge function; reads scoped to worlds the caller
    owns or that are public/unlisted.
  - `diginetic_shares`: `select` true (resolve by slug); owner read/write.
  - `diginetic_settings`: owner read/write where `user_id = auth.uid()`.
- **Storage**: a public `diginetic` bucket for snapshot thumbnails.

## D. Edge function — one function, action-routed

Deploy a **single** `diginetic` edge function invoked as
`supabase.functions.invoke('diginetic', { body: { action, ... } })`, with an
internal action router. One deploy, one CORS handler, less orphaning risk than
seven separate functions.

Fixes over the bundle:

- **CORS** + OPTIONS preflight (bundle has none — browser calls would be
  blocked by CORS).
- **Resolve `owner_id` from the caller's JWT** server-side via
  `supabase.auth.getUser(jwt)` (bundle never set `owner_id` → every world was
  ownerless).
- **Real SHA-256** genome hashing via Web Crypto `crypto.subtle.digest` over the
  canonical genome payload (bundle used a random UUID placeholder, defeating
  genome dedup by hash).
- **Full public thumb URL** stored in `diginetic_snapshots.thumb_url` (bundle
  stored a bare storage path).
- **Accept `tick` from the body** on event/snapshot writes (bundle hardcoded
  `tick: 0`).
- All 7 actions preserved: `spawn_initial_world`, `tick_reproduction`,
  `make_snapshot`, `share_world`, `clone_world_from_slug`,
  `import_genome_from_slug`, `summarize_world_tick`.

## E. LLM narration — real LLM with fallback

`summarize_world_tick` calls the **LLM Gateway** (`api.llmgateway.io`) with a
compact prompt built from tick deltas (births, deaths, diversity, temp drift) →
one poetic one-liner. Fast **non-reasoning** model (per LLM Gateway guidance for
narrative). **Throttled**: invoked every ~15 ticks or on a major event, not
every frame. On slow/failed calls, fall back to the bundle's local phrase bank
so a whisper is always available and never blocks the sim. Gateway API key
stored as a function secret (`LLM_GATEWAY_API_KEY`).

## F. Sharing — query params (GitHub Pages is static, no routing)

Share/clone/import ride on URL query params:

- `?w=<slug>` — open a shared world: preview → **Clone** (`clone_world_from_slug`
  → new owned world) or **Watch only** (read-only view). Matches wireframe 3.3.
- `?genome=<slug>` — import a genome cohort into the current world
  (`import_genome_from_slug`).

On load the app inspects the query string and routes accordingly.

## G. Deploy & arcade wiring

- New **static** repo `thetiniestspoon/diginetic` — vanilla HTML/CSS/JS, PixiJS
  via CDN, **relative asset paths** (`./main.js`) so the `/diginetic/` Pages
  base resolves. GitHub Pages → `https://thetiniestspoon.github.io/diginetic/`.
- **Porch-gate guard** on load (family-only, like the siblings): if
  `supabase.auth.getSession()` is null, bounce to
  `https://thetiniestspoon.github.io/command-center/porch.html?return=<url>`.
  supabase-js configured with Family Core URL + publishable key
  `sb_publishable_IRcRu0nSCDCInd8XPpImaA_ztlZ2poj` and the default storage key
  `sb-ckjcieeccopqowlfljja-auth-token` (written by the porch), so the session is
  shared across the `thetiniestspoon.github.io` origin.
- Generate **`diginetic.webp`** card art (evolutionary/organism motif matching
  sibling cards) → `command-center/workshop-oakpark/assets/games/diginetic.webp`.
- Add to `renderArcade()` GAMES array
  (`command-center/workshop-oakpark/rooms/playroom.js`):
  `{ slug: 'diginetic', title: 'Diginetic', icon: '🧫', tint: 'rgba(52,211,153,0.20)', url: 'https://thetiniestspoon.github.io/diginetic/' }`
  (🧫 petri-dish — 🧬 is taken by Tardigrades).
- **Verify** the live URL loads and the card launches from the live Playroom
  before claiming done.

## H. Operator handoffs (Shawn's Supabase Dashboard, deep-linked)

Three steps need Shawn's Family Core Dashboard; handed off per the operator
handoff format (destination-first, deep-linked, PowerShell-clean where a command
is involved):

1. Run the adapted schema SQL in the SQL Editor
   (`https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/sql/new`).
2. Create the public `diginetic` storage bucket
   (`https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/storage/buckets`).
3. Set the `LLM_GATEWAY_API_KEY` function secret
   (`https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/settings/functions`).

The edge-function deploy and the GitHub repo creation/push are done via CLI
where access allows (`npx supabase functions deploy`, `gh repo create`).

## Build phasing (verifiable slices)

1. **Engine playable locally** — genome/phenotype/loop/selection/HUD, no
   backend. Verify visible evolution in a local browser.
2. **Backend** — adapted schema + single edge function (CORS, JWT owner,
   SHA-256), client wiring for spawn/snapshot/share/clone/import.
3. **LLM narration** — gateway wiring + fallback.
4. **Deploy** — GitHub repo + Pages; porch-gate; live-URL verify.
5. **Arcade card** — generate `diginetic.webp`; add GAMES entry; verify launch
   from the live Playroom.

## Non-goals (explicit v1 exclusions)

- Server-authoritative per-tick simulation.
- Offline-first IndexedDB sync / account-upgrade flow (bundle "Should Have").
- Gallery view, lineage inspector, creator profiles (bundle "Nice to Have").
- Multiplayer / shared live worlds.
