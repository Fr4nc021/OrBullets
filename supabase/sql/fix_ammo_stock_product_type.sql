-- Corrige o erro: ammo_stock.product_type does not exist
-- Execute no SQL Editor do Supabase (pode rodar várias vezes).

-- Garante coluna na tabela de calibres (necessária para a view)
alter table public.calibers
  add column if not exists product_type text not null default 'municao';

update public.calibers
set product_type = 'municao'
where product_type is null or trim(product_type) = '';

-- Recria a view para incluir product_type (substitui definição antiga)
drop view if exists public.ammo_stock cascade;

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

-- Permite leitura via API (ajuste se usar roles diferentes)
grant select on public.ammo_stock to anon, authenticated, service_role;
