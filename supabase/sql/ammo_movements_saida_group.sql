-- Agrupa linhas de uma mesma saída (mesmo termo PDF). Execute no SQL Editor do Supabase.
alter table public.ammo_movements
  add column if not exists saida_group_id uuid;

comment on column public.ammo_movements.saida_group_id is
  'Identificador comum às linhas registradas numa única confirmação de saída com termo.';
