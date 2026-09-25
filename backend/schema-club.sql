-- Estoque e produção do clube (SQLite separado da loja — não sincroniza com Supabase da loja).
-- Sintaxe SQLite: AUTOINCREMENT, datetime('now'), TEXT para ids.
-- Para PostgreSQL/Supabase use supabase/sql/schema_club.sql (não execute este ficheiro no SQL Editor do Supabase).

CREATE TABLE IF NOT EXISTS club_calibers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS club_calibers_name_uidx
  ON club_calibers (lower(trim(name)));

-- Insumos e munição pronta (apenas clube)
CREATE TABLE IF NOT EXISTS club_items (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('polvora', 'espoleta', 'ponta', 'municao')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_production_batches (
  id TEXT PRIMARY KEY NOT NULL,
  caliber_id TEXT NOT NULL REFERENCES club_calibers (id),
  municoes_produzidas INTEGER NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES club_items (id),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  quantity REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  production_batch_id TEXT REFERENCES club_production_batches (id)
);

CREATE INDEX IF NOT EXISTS club_stock_movements_item_idx ON club_stock_movements (item_id);
CREATE INDEX IF NOT EXISTS club_stock_movements_batch_idx ON club_stock_movements (production_batch_id);

-- Uma receita por calibre de munição produzida
CREATE TABLE IF NOT EXISTS club_recipes (
  caliber_id TEXT PRIMARY KEY NOT NULL REFERENCES club_calibers (id),
  polvora_item_id TEXT NOT NULL REFERENCES club_items (id),
  espoleta_item_id TEXT NOT NULL REFERENCES club_items (id),
  ponta_item_id TEXT NOT NULL REFERENCES club_items (id),
  municao_output_item_id TEXT REFERENCES club_items (id),
  grains_polvora_por_municao REAL NOT NULL,
  espoletas_por_municao REAL NOT NULL DEFAULT 1,
  pontas_por_municao REAL NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE UNIQUE INDEX IF NOT EXISTS sync_outbox_one_pending_per_entity
  ON sync_outbox (entity_table, entity_id)
  WHERE status = 'pending';
