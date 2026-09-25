-- OrBullets — schema completo para o projeto Supabase compartilhado da loja.
-- Cole e execute este ficheiro no SQL Editor (uma vez). Pode reexecutar.
-- Todas as tabelas usam o prefixo orbullets_ para não misturar com outros sistemas.

-- ---------------------------------------------------------------------------
-- Loja
-- ---------------------------------------------------------------------------
create table if not exists public.orbullets_calibers (
  id uuid primary key,
  name text not null,
  product_type text not null default 'municao'
    check (product_type in ('municao', 'cartucho', 'insumo'))
);

create unique index if not exists orbullets_calibers_name_product_type_uidx
  on public.orbullets_calibers (lower(trim(name)), product_type);

create table if not exists public.orbullets_ammo_types (
  id uuid primary key,
  name text not null,
  caliber_id uuid not null references public.orbullets_calibers (id),
  created_at timestamptz not null default now()
);

create table if not exists public.orbullets_weapon_types (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint orbullets_weapon_types_name_unique unique (name)
);

create table if not exists public.orbullets_weapon_brands (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint orbullets_weapon_brands_name_unique unique (name)
);

create table if not exists public.orbullets_weapons (
  id uuid primary key,
  name text not null,
  weapon_type_id uuid references public.orbullets_weapon_types (id),
  brand_id uuid references public.orbullets_weapon_brands (id),
  caliber_id uuid references public.orbullets_calibers (id),
  owner text not null,
  status text not null default 'em_estoque',
  type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.orbullets_ammo_movements (
  id bigint generated always as identity primary key,
  local_id bigint,
  ammo_type_id uuid not null references public.orbullets_ammo_types (id),
  quantity integer not null,
  type text not null check (type in ('entrada', 'saida')),
  date timestamptz not null,
  saida_group_id uuid,
  nf_number text
);

create unique index if not exists orbullets_ammo_movements_local_id_uidx
  on public.orbullets_ammo_movements (local_id)
  where local_id is not null;

create index if not exists orbullets_ammo_movements_nf_number_idx
  on public.orbullets_ammo_movements (nf_number);

drop view if exists public.orbullets_ammo_stock cascade;

create view public.orbullets_ammo_stock with (security_invoker = true) as
select
  at.id as ammo_type_id,
  at.name as ammo_name,
  c.name as caliber,
  coalesce(c.product_type, 'municao')::text as product_type,
  coalesce(
    (
      select sum(
        case
          when m.type = 'entrada' then m.quantity
          when m.type = 'saida' then -m.quantity
          else 0
        end
      )
      from public.orbullets_ammo_movements m
      where m.ammo_type_id = at.id
    ),
    0
  )::integer as stock
from public.orbullets_ammo_types at
join public.orbullets_calibers c on c.id = at.caliber_id;

grant select on public.orbullets_ammo_stock to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Clube
-- ---------------------------------------------------------------------------
create table if not exists public.orbullets_club_calibers (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists orbullets_club_calibers_name_uidx
  on public.orbullets_club_calibers (lower(trim(name)));

create table if not exists public.orbullets_club_items (
  id uuid primary key,
  name text not null,
  kind text not null check (kind in ('polvora', 'espoleta', 'ponta', 'municao')),
  created_at timestamptz not null default now()
);

create table if not exists public.orbullets_club_production_batches (
  id uuid primary key,
  caliber_id uuid not null references public.orbullets_club_calibers (id),
  municoes_produzidas integer not null,
  date timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.orbullets_club_recipes (
  caliber_id uuid primary key references public.orbullets_club_calibers (id),
  polvora_item_id uuid not null references public.orbullets_club_items (id),
  espoleta_item_id uuid not null references public.orbullets_club_items (id),
  ponta_item_id uuid not null references public.orbullets_club_items (id),
  municao_output_item_id uuid references public.orbullets_club_items (id),
  grains_polvora_por_municao double precision not null,
  espoletas_por_municao double precision not null default 1,
  pontas_por_municao double precision not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.orbullets_club_stock_movements (
  id bigint generated always as identity primary key,
  local_id bigint,
  item_id uuid not null references public.orbullets_club_items (id),
  type text not null check (type in ('entrada', 'saida')),
  quantity double precision not null,
  date timestamptz not null,
  notes text,
  production_batch_id uuid references public.orbullets_club_production_batches (id)
);

create unique index if not exists orbullets_club_stock_movements_local_id_uidx
  on public.orbullets_club_stock_movements (local_id)
  where local_id is not null;

create index if not exists orbullets_club_stock_movements_item_idx
  on public.orbullets_club_stock_movements (item_id);
create index if not exists orbullets_club_stock_movements_batch_idx
  on public.orbullets_club_stock_movements (production_batch_id);

-- ---------------------------------------------------------------------------
-- RLS: o app usa a anon key (papel anon) para copiar o SQLite → nuvem
-- ---------------------------------------------------------------------------
alter table public.orbullets_calibers enable row level security;
drop policy if exists orbullets_calibers_anon_auth_full on public.orbullets_calibers;
create policy orbullets_calibers_anon_auth_full
  on public.orbullets_calibers for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_ammo_types enable row level security;
drop policy if exists orbullets_ammo_types_anon_auth_full on public.orbullets_ammo_types;
create policy orbullets_ammo_types_anon_auth_full
  on public.orbullets_ammo_types for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_ammo_movements enable row level security;
drop policy if exists orbullets_ammo_movements_anon_auth_full on public.orbullets_ammo_movements;
create policy orbullets_ammo_movements_anon_auth_full
  on public.orbullets_ammo_movements for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_weapon_types enable row level security;
drop policy if exists orbullets_weapon_types_anon_auth_full on public.orbullets_weapon_types;
create policy orbullets_weapon_types_anon_auth_full
  on public.orbullets_weapon_types for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_weapon_brands enable row level security;
drop policy if exists orbullets_weapon_brands_anon_auth_full on public.orbullets_weapon_brands;
create policy orbullets_weapon_brands_anon_auth_full
  on public.orbullets_weapon_brands for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_weapons enable row level security;
drop policy if exists orbullets_weapons_anon_auth_full on public.orbullets_weapons;
create policy orbullets_weapons_anon_auth_full
  on public.orbullets_weapons for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_club_calibers enable row level security;
drop policy if exists orbullets_club_calibers_anon_auth_full on public.orbullets_club_calibers;
create policy orbullets_club_calibers_anon_auth_full
  on public.orbullets_club_calibers for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_club_items enable row level security;
drop policy if exists orbullets_club_items_anon_auth_full on public.orbullets_club_items;
create policy orbullets_club_items_anon_auth_full
  on public.orbullets_club_items for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_club_production_batches enable row level security;
drop policy if exists orbullets_club_production_batches_anon_auth_full
  on public.orbullets_club_production_batches;
create policy orbullets_club_production_batches_anon_auth_full
  on public.orbullets_club_production_batches for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_club_recipes enable row level security;
drop policy if exists orbullets_club_recipes_anon_auth_full on public.orbullets_club_recipes;
create policy orbullets_club_recipes_anon_auth_full
  on public.orbullets_club_recipes for all to anon, authenticated
  using (true) with check (true);

alter table public.orbullets_club_stock_movements enable row level security;
drop policy if exists orbullets_club_stock_movements_anon_auth_full
  on public.orbullets_club_stock_movements;
create policy orbullets_club_stock_movements_anon_auth_full
  on public.orbullets_club_stock_movements for all to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on
  public.orbullets_calibers,
  public.orbullets_ammo_types,
  public.orbullets_ammo_movements,
  public.orbullets_weapon_types,
  public.orbullets_weapon_brands,
  public.orbullets_weapons,
  public.orbullets_club_calibers,
  public.orbullets_club_items,
  public.orbullets_club_production_batches,
  public.orbullets_club_recipes,
  public.orbullets_club_stock_movements
  to anon, authenticated;

grant usage, select on sequence public.orbullets_ammo_movements_id_seq to anon, authenticated;
grant usage, select on sequence public.orbullets_club_stock_movements_id_seq to anon, authenticated;
