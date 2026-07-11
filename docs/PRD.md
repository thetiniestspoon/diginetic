# Diginetic — Product Requirements (aspirational aim)

*Version 2.0 · 2026-07-11 · supersedes the v1 population-sim framing*

> **The one-line aim:** a creature you raise from an undifferentiated stem-cell
> blob into something niche, differentiated, and utterly *bespoke* — shaped by how
> you care for it and the world it lives in — where the evolution isn't a scripted
> branch to one of N preset forms (Tamagotchi/Digimon) but a **living genome that
> drifts continuously**. That genetics layer is the leap that takes the
> care-and-evolve handheld game to another level.

This PRD is the north star. It describes the whole aspiration; the **Phased
Roadmap** at the end draws the shippable slices. v1 (the live population sim at
https://thetiniestspoon.github.io/diginetic/) is retired as the game's shape but
its infrastructure carries forward wholesale.

---

## 1. The player fantasy

You are handed a nameless blob of pure potential. Over real days, by feeding it,
playing with it, training it, choosing the world it lives in, and exposing it to
other creatures, you watch it **become** — not into a form you selected from a
menu, but into a one-of-a-kind creature that is legibly the product of *your*
choices and *its* world. You grow attached the way you grow attached to a
Tamagotchi or a Digimon partner — except this one is genetically *yours*, and no
one else's will ever look or behave the same. Its life leaves you a **growth
album** of portraits and, at the end, a **legacy** you can carry forward or share.

**Emotional core:** attachment to a bespoke *becoming*. The magic is that the
creature is irreplaceable and unrepeatable.

## 2. The innovation (why this is "another level")

Classic Tamagotchi/Digimon evolution = discrete, scripted branches: care meters +
training → one of a fixed tree of preset forms. Finite, deterministic, shared
across all players.

Diginetic's leap: the creature carries a **live genome** — a vector of expressive
genes. Every interaction and every environmental exposure **writes to that genome
continuously**, applying selection pressure, epigenetic expression, and mutation.
The creature differentiates as an emergent, continuous consequence — so the result
is *bespoke, unrepeatable, and truly yours.* The "digivolution" feeling is
preserved as **quiet becoming moments** (a re-rendered portrait when the genome has
drifted enough), but the destination is never preset.

## 3. The creature model

- **One creature.** Not a population. The whole game is your bond with a single
  organism (with a lineage across legacies — see §8).
- **Stem-cell start.** Begins undifferentiated: a broad, unexpressed genome — all
  potential, no specialization. Visually a soft, generic blob.
- **Persistent + fragile.** Lives on between sessions in real time. It ages,
  hungers, and its genome drifts **whether or not you're watching**. Neglect has
  real stakes (Tamagotchi-classic): hunger → illness → **stalled differentiation**
  → death. Death yields a legacy (§8) — a beginning, not just an end.
- **Continuous becoming.** No stage gates (no egg/baby/adult machine). The genome
  drifts smoothly; the body is a continuous slow reshaping toward its niche.

## 4. The genome (expressive gene vector)

The genome is richer than v1's five genes — it maps to *visible, characterful*
traits so differentiation is legible:

- **body_plan** (amorphous ↔ serpentine ↔ quadruped ↔ avian ↔ radial …)
- **size**, **build** (gracile ↔ robust)
- **covering** (slime / scale / fur / chitin / feather)
- **locomotion** (limbs / fins / wings / none) + counts
- **features** (horns, spines, eyes count, tail, crest)
- **pigment** (palette + pattern)
- **metabolism**, **temperament** (docile ↔ fierce, shy ↔ social, curious ↔ wary)
- **resilience**, **speed**, **strength**, **stamina**
- **per-locus mutation sigma** (its own drift rate)
- **niche-bias** (hidden accumulators that pull the whole genome toward a coherent
  niche once enough pressure points the same way — so differentiation *converges*
  into something coherent, not noise)

Genes carry **expression state** (epigenetic): recent care/environment can express
or suppress a gene before it's written permanently, so the creature responds
visibly to a change of care within a day, while permanent drift accrues slowly.

## 5. The five shaping forces

Each interaction biases specific genes (and moves meters, §6):

1. **Feed** — diet *type* (not just hunger) biases metabolism, size, temperament,
   covering. Meat → fierce/robust/carnivore niche; plant → docile/gracile; mineral
   → armored/slow. Overfeeding/starving have consequences.
2. **Train** — deliberate sessions write speed / strength / stamina / resilience.
   Digimon's stat-training, but it edits the genome.
3. **Play / bond** — raises the **bond** meter (gates healthier drift and better
   outcomes) and biases sociability / curiosity. The emotional core verb.
4. **Biome** — place it in tundra / reef / swamp / volcano / meadow …; the world
   applies **real selection pressure over time** (cold favors small+furred+robust;
   reef favors fins+streamlined; etc.). The "environmental interaction" half.
5. **Exposure to other creatures** — encounters with **wild** creatures and,
   crucially, **creatures grown from shared genomes** (yours-past and other
   players') push adaptation genes: mimicry, defense, display, sociability. This is
   where genome-sharing earns its gameplay purpose — shared creatures become the
   encounter pool.

## 6. Meters & lifecycle

- **Meters:** hunger · health · bond · energy. Glanceable, Tamagotchi-legible.
- **Decay:** meters fall in real time. Low hunger → health drops → illness →
  **differentiation stalls** (the genome stops drifting — it can't become) →
  eventually death.
- **Care restores** meters and *unlocks* healthy drift; a well-tended creature
  differentiates faster and toward richer niches.
- **Illness** is recoverable with attention; sustained neglect is not.
- **Death → legacy** (§8).

## 7. The visible becoming (genome → portrait → growth album)

- A **bespoke portrait** is generated from the genome via the **free, keyless
  Pollinations image endpoint** (same provider already wired for card art +
  narration). A **genome hash seeds** the image so identity is stable — the same
  genome always yields the same creature; as the genome drifts, the portrait
  drifts with it.
- **Genome → prompt** is the creative heart: the gene vector is translated into a
  descriptive creature prompt (body plan, covering, features, palette, temperament,
  on a dark habitat background, consistent art direction).
- **Re-render on "molt":** when cumulative drift since the last portrait crosses a
  threshold, a new portrait is generated — a quiet *"it's becoming something…"*
  moment. Not a gameplay gate; a visual capture along the continuum.
- **Growth album:** every portrait is kept (in the `diginetic` storage bucket), so
  the creature's whole life is a scrollable sequence of likenesses. **The album is
  the attachment.**

## 8. Death, legacy & lineage

- On death, the final genome becomes a **legacy egg**: start a new creature seeded
  from it (carry the lineage forward, with fresh mutation), or **share** it (its
  genome enters the shared encounter/adoption pool).
- Lineage gives the persistent-fragile model its meaning: loss is real, but it
  seeds a continuation shaped by everything the last one became. Closes the loop
  with genome-sharing.

## 9. Architecture

**Carries over from v1 (do not rebuild):**
- Genome + mutation + hashing math (expand the gene set).
- Supabase on shared **Family Core** (`ckjcieeccopqowlfljja`); the single
  action-routed `diginetic` edge function pattern (CORS, JWT-owner, service-role
  writes); the `diginetic_`-prefixed, shared-safe schema convention.
- **Porch-gate identity** (the creature is tied to the family user).
- The public **`diginetic` storage bucket** (now holds portraits + album).
- **Pollinations** wiring (free, keyless) — already used for card art and
  narration; now also portraits.
- GitHub Pages deploy, PixiJS shell, scroll-less mobile frame.

**Retired:** the population simulation loop (the world is now one creature's
habitat, not a swarm).

**New:**
- **Per-user creature state** persisted server-side (genome, meters, drift
  accumulators, portrait history, timestamps).
- **Offline progression:** on load, advance real elapsed time deterministically —
  decay meters, drift the genome, resolve illness/possible death — so returning
  after days shows a truthfully-advanced creature. Server-authoritative for the
  away-time math (anti-cheat-adjacent, and consistent across devices).
- **Genome → prompt → portrait** pipeline + album.
- The five interaction verbs, meters UI, encounters, legacy.

**Data model (new `diginetic_` tables, shared-safe):**
- `diginetic_creatures` (id, owner_id, name, genome, expression, meters,
  drift_accum, biome, born_at, last_tick_at, stage_of_life, alive, created_at)
- `diginetic_portraits` (id, creature_id, tick, genome_hash, image_url,
  created_at) — the growth album
- `diginetic_events` (care/train/feed/encounter/illness/molt/death log)
- `diginetic_legacies` (id, owner_id, source_creature_id, genome, slug, shared)
- reuse `diginetic_genomes` / `diginetic_shares` for the sharing pool.

## 10. What "another level" means (success signals)

- A player names their creature and checks in across multiple real days.
- Two players compare creatures and they are visibly, characterfully different.
- A player keeps the growth album / mourns a death / starts a legacy.
- The sentence "it became this *because* I raised it that way" is true and felt.

## 11. Non-goals (for now)

- Real-time multiplayer / live battles (encounters are asynchronous via shared
  genomes).
- Live-animated procedural bodies (we chose generated portraits per the becoming).
- A marketplace / trading economy.
- Leaderboards / competitive ranking (this is a bond game, not a ladder).

## 12. Phased roadmap (shippable slices)

- **Phase 1 — the core bond loop (v1 of the game):** one persistent, fragile
  creature; **Feed + Train + Play**; continuous genetic drift; hunger/health decay
  + **offline progression**; genome → portrait + **growth album**. A complete,
  novel loop you bond with. *Open decision: how harsh is "fragile" in Phase 1 —
  can it truly die yet, or does death/illness soften until the legacy loop lands in
  Phase 4? (Lean: illness + stalled drift in P1; true death arrives with P4 legacy
  so loss always has a forward door.)*
- **Phase 2 — Biomes:** environmental selection pressure; choose/change habitat.
- **Phase 3 — Exposure & genome-sharing:** wild + shared-genome encounters as the
  differentiation-driver; the sharing pool.
- **Phase 4 — Death → legacy → lineage:** the full loop closes; loss seeds
  continuation; sharing becomes adoption.

## 13. Open decisions (resolve at spec time)

- Fragility harshness in Phase 1 (above).
- Drift cadence: how fast does a well-tended creature visibly differentiate — hours
  of care, or days? (Tune for "checks in over real days" without feeling stalled.)
- Portrait art direction: one consistent style prompt-suffix so the album feels
  coherent across renders (and stays on the house's aesthetic).
- Encounter source in Phase 3: purely shared genomes, procedural wild, or both.
- Tick authority: fully server-side offline math vs. a client estimate reconciled
  server-side.
