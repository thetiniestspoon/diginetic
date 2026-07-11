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
create index if not exists diginetic_worlds_owner_idx on public.diginetic_worlds(owner_id);
create index if not exists diginetic_worlds_visibility_idx on public.diginetic_worlds(visibility);

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
create index if not exists diginetic_organisms_world_idx on public.diginetic_organisms(world_id);

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
create index if not exists diginetic_events_world_tick_idx on public.diginetic_events(world_id, tick);

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
