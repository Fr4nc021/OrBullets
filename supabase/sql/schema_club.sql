-- Clube: estoque e produção (PostgreSQL / Supabase).
-- NÃO use o ficheiro backend/schema-club.sql aqui — esse é só SQLite (AUTOINCREMENT, datetime).
-- Execute no SQL Editor do Supabase (uma vez).

create table if not exists public.club_calibers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists club_calibers_name_uidx
  on public.club_calibers (lower(trim(name)));

create table if not exists public.club_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('polvora', 'espoleta', 'ponta', 'municao')),
  created_at timestamptz not null default now()
);

create table if not exists public.club_production_batches (
  id uuid primary key default gen_random_uuid(),
  caliber_id uuid not null references public.club_calibers (id),
  municoes_produzidas integer not null,
  date timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Em PostgreSQL não existe AUTOINCREMENT; usa-se IDENTITY ou serial.
create table if not exists public.club_stock_movements (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.club_items (id),
  type text not null check (type in ('entrada', 'saida')),
  quantity double precision not null,
  date timestamptz not null,
  notes text,
  production_batch_id uuid references public.club_production_batches (id)
);

create index if not exists club_stock_movements_item_idx
  on public.club_stock_movements (item_id);
create index if not exists club_stock_movements_batch_idx
  on public.club_stock_movements (production_batch_id);

create table if not exists public.club_recipes (
  caliber_id uuid primary key references public.club_calibers (id),
  polvora_item_id uuid not null references public.club_items (id),
  espoleta_item_id uuid not null references public.club_items (id),
  ponta_item_id uuid not null references public.club_items (id),
  municao_output_item_id uuid references public.club_items (id),
  grains_polvora_por_municao double precision not null,
  espoletas_por_municao double precision not null default 1,
  pontas_por_municao double precision not null default 1,
  updated_at timestamptz not null default now()
);
