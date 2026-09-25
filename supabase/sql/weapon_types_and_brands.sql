-- Execute no SQL Editor do Supabase (uma vez).
-- Tipos e marcas de arma cadastráveis, referenciados por `weapons`.

create table if not exists public.weapon_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint weapon_types_name_unique unique (name)
);

create table if not exists public.weapon_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint weapon_brands_name_unique unique (name)
);

alter table public.weapons
  add column if not exists weapon_type_id uuid references public.weapon_types (id);

alter table public.weapons
  add column if not exists brand_id uuid references public.weapon_brands (id);

-- Se `weapons` ainda tiver coluna `type` (texto) com NOT NULL, o insert pelo app
-- não envia mais `type`. Libere a obrigatoriedade até migrar ou dropar a coluna:
-- alter table public.weapons alter column type drop not null;

-- Depois de preencher weapon_type_id a partir de `type`, pode remover a coluna legada:
-- alter table public.weapons drop column if exists type;

alter table public.weapons
  add column if not exists notes text;
