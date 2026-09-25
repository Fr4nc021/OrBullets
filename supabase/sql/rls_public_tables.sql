-- Execute no SQL Editor do Supabase (uma vez; pode reexecutar).
--
-- O app usa a anon key sem login → o JWT usa o papel `anon`. Estas políticas permitem
-- CRUD para `anon` e `authenticated` (equivalente prático ao que era "UNRESTRICTED",
-- mas com RLS ligado e políticas nomeadas).
--
-- Depois de adicionar Supabase Auth no app, substitua por políticas que usem
-- `authenticated` e, se quiser multi-tenant, colunas como `tenant_id = auth.uid()`.
--
-- `service_role` ignora RLS (scripts/admin no servidor).
--
-- `ammo_stock` é VIEW: RLS não se aplica na view; `security_invoker` está definido no
-- CREATE VIEW em `product_type_calibers.sql` / `fix_ammo_stock_product_type.sql`.
-- Se `weapons_in_stock` for VIEW no seu projeto, recrie-a com
--   WITH (security_invoker = true) ou rode: ALTER VIEW public.weapons_in_stock SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Munição / estoque
-- ---------------------------------------------------------------------------
alter table public.calibers enable row level security;
drop policy if exists calibers_anon_auth_full on public.calibers;
create policy calibers_anon_auth_full
  on public.calibers for all to anon, authenticated
  using (true) with check (true);

alter table public.ammo_types enable row level security;
drop policy if exists ammo_types_anon_auth_full on public.ammo_types;
create policy ammo_types_anon_auth_full
  on public.ammo_types for all to anon, authenticated
  using (true) with check (true);

alter table public.ammo_movements enable row level security;
drop policy if exists ammo_movements_anon_auth_full on public.ammo_movements;
create policy ammo_movements_anon_auth_full
  on public.ammo_movements for all to anon, authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Armas
-- ---------------------------------------------------------------------------
alter table public.weapon_types enable row level security;
drop policy if exists weapon_types_anon_auth_full on public.weapon_types;
create policy weapon_types_anon_auth_full
  on public.weapon_types for all to anon, authenticated
  using (true) with check (true);

alter table public.weapon_brands enable row level security;
drop policy if exists weapon_brands_anon_auth_full on public.weapon_brands;
create policy weapon_brands_anon_auth_full
  on public.weapon_brands for all to anon, authenticated
  using (true) with check (true);

alter table public.weapons enable row level security;
drop policy if exists weapons_anon_auth_full on public.weapons;
create policy weapons_anon_auth_full
  on public.weapons for all to anon, authenticated
  using (true) with check (true);

-- Comente o bloco inteiro se a tabela não existir no seu projeto.
alter table public.weapon_movements enable row level security;
drop policy if exists weapon_movements_anon_auth_full on public.weapon_movements;
create policy weapon_movements_anon_auth_full
  on public.weapon_movements for all to anon, authenticated
  using (true) with check (true);

-- `weapons_in_stock`: se for VIEW, veja comentário no topo do arquivo.
