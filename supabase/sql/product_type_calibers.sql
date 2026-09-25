-- Execute no SQL Editor do Supabase (uma vez).
-- Hierarquia: tipo de produto (Munição, Cartucho, Insumo) → calibre → produto (ammo_types).

-- 1) Coluna `product_type` em calibres
alter table public.calibers
  add column if not exists product_type text not null default 'municao';

update public.calibers set product_type = 'municao' where product_type is null or trim(product_type) = '';

alter table public.calibers
  drop constraint if exists calibers_product_type_check;

alter table public.calibers
  add constraint calibers_product_type_check
  check (product_type in ('municao', 'cartucho', 'insumo'));

-- Permite o mesmo nome de calibre em tipos diferentes (ex.: 9mm em Munição e em Cartucho).
alter table public.calibers drop constraint if exists calibers_name_key;
alter table public.calibers drop constraint if exists calibers_name_unique;

drop index if exists public.calibers_name_uidx;

create unique index if not exists calibers_name_product_type_uidx
  on public.calibers (lower(trim(name)), product_type);

-- 2) View `ammo_stock` com `product_type` (DROP garante recriação se CREATE OR REPLACE não atualizar colunas).
drop view if exists public.ammo_stock cascade;

-- security_invoker (PG15+): consultas à view respeitam RLS das tabelas base.
create view public.ammo_stock with (security_invoker = true) as
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
      from public.ammo_movements m
      where m.ammo_type_id = at.id
    ),
    0
  )::integer as stock
from public.ammo_types at
join public.calibers c on c.id = at.caliber_id;

grant select on public.ammo_stock to anon, authenticated, service_role;
