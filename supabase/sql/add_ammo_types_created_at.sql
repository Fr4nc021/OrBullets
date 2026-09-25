-- Opcional: data de criação do produto (ammo_types) para o modelo { dataCriacao }.
alter table public.ammo_types
  add column if not exists created_at timestamptz not null default now();
