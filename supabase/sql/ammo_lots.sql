-- OrBullets — lotes de munição.
-- Rode no SQL Editor do Supabase ANTES de atualizar o app nos PCs. Pode rodar de novo sem problema.
--
-- Saldo de um lote = saldo inicial distribuído (orbullets_ammo_lot_openings)
--                    + entradas do lote − saídas do lote.
-- "Sem lote" (lot_number nulo) = movimentos sem lote − tudo que já foi distribuído.

alter table public.orbullets_ammo_movements
  add column if not exists lot_number text;

create index if not exists orbullets_ammo_movements_type_lot_idx
  on public.orbullets_ammo_movements (ammo_type_id, lot_number);

create table if not exists public.orbullets_ammo_lot_openings (
  id uuid primary key,
  ammo_type_id uuid not null references public.orbullets_ammo_types (id),
  lot_number text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists orbullets_ammo_lot_openings_type_idx
  on public.orbullets_ammo_lot_openings (ammo_type_id);

alter table public.orbullets_ammo_lot_openings enable row level security;
drop policy if exists orbullets_ammo_lot_openings_anon_auth_full
  on public.orbullets_ammo_lot_openings;
create policy orbullets_ammo_lot_openings_anon_auth_full
  on public.orbullets_ammo_lot_openings for all to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.orbullets_ammo_lot_openings
  to anon, authenticated;

drop view if exists public.orbullets_ammo_lot_stock;

create view public.orbullets_ammo_lot_stock with (security_invoker = true) as
with parts as (
  select m.ammo_type_id, m.lot_number,
    case when m.type = 'entrada' then m.quantity
         when m.type = 'saida' then -m.quantity
         else 0 end as qty
  from public.orbullets_ammo_movements m
  union all
  select o.ammo_type_id, o.lot_number, o.quantity
  from public.orbullets_ammo_lot_openings o
  union all
  select o.ammo_type_id, null, -o.quantity
  from public.orbullets_ammo_lot_openings o
)
select
  at.id as ammo_type_id,
  at.name as ammo_name,
  c.name as caliber,
  coalesce(c.product_type, 'municao')::text as product_type,
  p.lot_number,
  sum(p.qty)::integer as stock
from parts p
join public.orbullets_ammo_types at on at.id = p.ammo_type_id
join public.orbullets_calibers c on c.id = at.caliber_id
group by at.id, at.name, c.name, c.product_type, p.lot_number;

grant select on public.orbullets_ammo_lot_stock to anon, authenticated, service_role;
