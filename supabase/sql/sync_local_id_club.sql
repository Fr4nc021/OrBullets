-- Clube: mesma estratégia para movimentos com id auto no SQLite.
-- Execute no SQL Editor do Supabase.

alter table public.club_stock_movements
  add column if not exists local_id bigint;

create unique index if not exists club_stock_movements_local_id_uidx
  on public.club_stock_movements (local_id)
  where local_id is not null;

comment on column public.club_stock_movements.local_id is
  'Id da linha no SQLite club_stock_movements.id no PC servidor.';

-- O app (a partir da 2.3) apaga sozinho as linhas sem local_id e as cópias
-- que não existem no SQLite do PC servidor. Não é preciso rodar o DELETE na mão.
