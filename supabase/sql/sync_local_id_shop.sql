-- Replicação loja: chave estável para movimentações (id local SQLite INTEGER).
-- Execute no SQL Editor do Supabase após fazer backup.

alter table public.ammo_movements
  add column if not exists local_id bigint;

create unique index if not exists ammo_movements_local_id_uidx
  on public.ammo_movements (local_id)
  where local_id is not null;

comment on column public.ammo_movements.local_id is
  'Id da linha no SQLite (ammo_movements.id) no PC servidor; usado para upsert/delete idempotente.';

-- O app (a partir da 2.3) apaga sozinho as linhas sem local_id e as cópias
-- que não existem no SQLite do PC servidor. Não é preciso rodar o DELETE na mão.
