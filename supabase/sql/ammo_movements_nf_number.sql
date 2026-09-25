-- Número da NF nas entradas de estoque. Execute no SQL Editor do Supabase.
alter table public.ammo_movements
  add column if not exists nf_number text;

comment on column public.ammo_movements.nf_number is
  'Número da nota fiscal; preenchido nas entradas (várias linhas da mesma NF repetem o valor).';

create index if not exists ammo_movements_nf_number_idx
  on public.ammo_movements (nf_number);
