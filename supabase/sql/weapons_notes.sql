-- Execute no SQL Editor do Supabase (uma vez).
-- Necessário para número de série (cadastro), observações e responsável na retirada.

alter table public.weapons
  add column if not exists notes text;

-- Opcional: se a coluna legada `type` for redundante com `weapon_type_id`, libere NOT NULL:
-- alter table public.weapons alter column type drop not null;
