# Diginetic — Operator Handoff

The game is **live and playable** at https://thetiniestspoon.github.io/diginetic/
(client-authoritative sim runs standalone). The five steps below activate the
backend (persistence, snapshots, world-sharing, LLM narration) and publish the
arcade card. Until then the game degrades gracefully — it plays locally and
narration uses the built-in phrase bank.

All Supabase steps target **Family Core** (`ckjcieeccopqowlfljja`) — the SHARED
project. The schema is prefixed `diginetic_` and never touches `auth.uid()`, so
it is safe alongside the sibling games.

---

## 1. Run the schema (Supabase SQL Editor)

Destination: https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/sql/new

Paste the full contents of `supabase/schema.sql` and run. Creates the seven
`diginetic_*` tables, two enums, and RLS policies.

## 2. Create the storage bucket

Destination: https://supabase.com/dashboard/project/ckjcieeccopqowlfljja/storage/buckets

New bucket named `diginetic`, **Public** enabled. (Holds snapshot thumbnails.)

## 3. Narration (nothing to set)

Nothing to configure. The edge function narrates keylessly: the
`summarize_world_tick` action calls Pollinations text
(`https://text.pollinations.ai/openai`) with no credential, and falls back to
the local phrase bank on any failure, so a whisper is always available. The
function reads only the project URL and service role that Supabase supplies to
every function.

## 4. Deploy the edge function (blocked in auto-mode — run manually)

The single action-routed `diginetic` function powers spawn/snapshot/share/
clone/import/narration. Auto-mode declined to deploy to shared prod on my
behalf. From `C:\Users\shawn\GitRepositories\diginetic`:

```
npx supabase functions deploy diginetic --project-ref ckjcieeccopqowlfljja
```

(The CLI is already authenticated. This is additive — a new, uniquely-named
function; it does not touch the sibling games' functions.)

## 5. Publish the arcade card (command-center)

The card art (`workshop-oakpark/assets/games/diginetic.webp`) and the GAMES
registry entry are already applied in your **command-center working tree**, but
the tree has unrelated WIP, so I did not commit/push it. Include these two
paths in a commit to command-center `master` and push — the `pages-deploy.yml`
workflow will publish them to gh-pages and the card goes live:

- `workshop-oakpark/rooms/playroom.js`  (one-line GAMES entry — patch also saved
  at `diginetic/docs/deploy/command-center-playroom-diginetic-card.patch` if you
  need to re-apply cleanly)
- `workshop-oakpark/assets/games/diginetic.webp`

The GAMES entry added:
```js
{ slug: 'diginetic', title: 'Diginetic', icon: '🧫', tint: 'rgba(52,211,153,0.20)', url: 'https://thetiniestspoon.github.io/diginetic/' }
```

---

## Verify after steps 1–4

Open https://thetiniestspoon.github.io/diginetic/ (from a device with a Family
Core porch session), Begin a World, then tap **Share** — a `?w=<slug>` link
should copy. Open that link in another tab → it should offer the cloned world.
Snapshot should upload a thumbnail (confirms the bucket + `preserveDrawingBuffer`
capture). Whispers should read richer if the LLM key is set.
