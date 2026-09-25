-- SQLite schema for OrBullets local server (aligned with Supabase public tables)

CREATE TABLE IF NOT EXISTS calibers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'municao'
    CHECK (product_type IN ('municao', 'cartucho', 'insumo'))
);

CREATE UNIQUE INDEX IF NOT EXISTS calibers_name_product_type_uidx
  ON calibers (lower(trim(name)), product_type);

CREATE TABLE IF NOT EXISTS ammo_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  caliber_id TEXT NOT NULL REFERENCES calibers (id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ammo_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ammo_type_id TEXT NOT NULL REFERENCES ammo_types (id),
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  date TEXT NOT NULL,
  saida_group_id TEXT,
  nf_number TEXT
);

CREATE TABLE IF NOT EXISTS weapon_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weapon_brands (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weapons (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  weapon_type_id TEXT REFERENCES weapon_types (id),
  brand_id TEXT REFERENCES weapon_brands (id),
  caliber_id TEXT REFERENCES calibers (id),
  owner TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_estoque',
  type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fila offline-first: replicação SQLite → Supabase (processada pelo backend).
CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('INSERT', 'UPDATE', 'DELETE')),
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'syncing', 'synced', 'error')),
  synced_at TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT
);

CREATE INDEX IF NOT EXISTS sync_outbox_poll_idx
  ON sync_outbox (status, next_attempt_at, id);

-- Um único pendente por entidade (último evento ganha: INSERT→UPDATE→DELETE colapsado).
CREATE UNIQUE INDEX IF NOT EXISTS sync_outbox_one_pending_per_entity
  ON sync_outbox (entity_table, entity_id)
  WHERE status = 'pending';

-- Aviso de estoque baixo (local; não sincroniza com Supabase).
CREATE TABLE IF NOT EXISTS alert_low_stock_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 100
);

INSERT OR IGNORE INTO alert_low_stock_config (id, enabled, threshold)
VALUES (1, 0, 100);

CREATE TABLE IF NOT EXISTS alert_low_stock_state (
  ammo_type_id TEXT PRIMARY KEY NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  opened_at TEXT,
  closed_at TEXT
);
