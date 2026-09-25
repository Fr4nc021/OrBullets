/**
 * Aviso de estoque baixo — sync idempotente de episódios + helpers de config.
 * Falhas aqui não devem impedir movimentações de estoque.
 */

const STOCK_SQL = `SELECT
  at.id AS ammo_type_id,
  at.name AS ammo_name,
  c.name AS caliber,
  c.product_type AS product_type,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN m.type = 'entrada' THEN m.quantity
        WHEN m.type = 'saida' THEN -m.quantity
        ELSE 0
      END
    )
    FROM ammo_movements m
    WHERE m.ammo_type_id = at.id
  ), 0) AS stock
FROM ammo_types at
JOIN calibers c ON c.id = at.caliber_id
ORDER BY c.product_type COLLATE NOCASE, c.name COLLATE NOCASE, at.name COLLATE NOCASE`

/**
 * @param {import('sql.js').Database} db
 * @param {string} sql
 * @param {unknown[]} [params]
 */
function allRows(db, sql, params = []) {
  const stmt = db.prepare(sql)
  try {
    if (params.length) stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

/**
 * @param {import('sql.js').Database} db
 * @param {string} sql
 * @param {unknown[]} [params]
 */
function runDb(db, sql, params = []) {
  db.run(sql, params)
}

/**
 * @param {import('sql.js').Database} db
 */
function ensureConfigRow(db) {
  runDb(
    db,
    `INSERT OR IGNORE INTO alert_low_stock_config (id, enabled, threshold)
     VALUES (1, 0, 100)`,
  )
}

/**
 * @param {import('sql.js').Database} db
 * @returns {{ enabled: boolean, threshold: number }}
 */
function getConfig(db) {
  ensureConfigRow(db)
  const row = allRows(
    db,
    `SELECT enabled, threshold FROM alert_low_stock_config WHERE id = 1`,
  )[0]
  return {
    enabled: Boolean(row?.enabled),
    threshold: Math.max(0, Math.floor(Number(row?.threshold ?? 100))),
  }
}

/**
 * @param {import('sql.js').Database} db
 * @param {{ enabled: boolean, threshold: number }} payload
 * @param {() => void} save
 */
function saveConfig(db, payload, save) {
  ensureConfigRow(db)
  const enabled = payload.enabled ? 1 : 0
  const threshold = Math.max(0, Math.floor(Number(payload.threshold)))
  if (!Number.isFinite(threshold)) {
    throw new Error('Estoque mínimo inválido.')
  }
  runDb(
    db,
    `UPDATE alert_low_stock_config SET enabled = ?, threshold = ? WHERE id = 1`,
    [enabled, threshold],
  )
  save()
}

/**
 * Atualiza episódios ativos/fechados conforme o estoque atual.
 * Seguro chamar com aviso desligado (não altera state se disabled — ainda assim
 * fecha episódios se disabled? Plan: if enabled=0 return show false but still
 * could skip state updates when disabled to avoid noise. Plan step 1 says if
 * enabled=0 → show false; step 2-3 sync state. We'll sync only when enabled
 * so disabling doesn't leave stale "active" forever — actually better to still
 * sync when enabled only for opening; when disabled, don't open new ones.
 *
 * @param {import('sql.js').Database} db
 * @param {() => void} [save]
 * @returns {{
 *   config: { enabled: boolean, threshold: number },
 *   items: { ammoTypeId: string, name: string, caliber: string, productType: string, quantity: number }[],
 *   episodeKey: string | null
 * }}
 */
function syncLowStockState(db, save) {
  const config = getConfig(db)
  const now = new Date().toISOString()

  if (!config.enabled) {
    const active = allRows(
      db,
      `SELECT ammo_type_id FROM alert_low_stock_state WHERE active = 1`,
    )
    if (active.length) {
      for (const row of active) {
        runDb(
          db,
          `UPDATE alert_low_stock_state
           SET active = 0, closed_at = ?
           WHERE ammo_type_id = ?`,
          [now, String(row.ammo_type_id)],
        )
      }
      if (typeof save === 'function') {
        try {
          save()
        } catch {
          /* ignore */
        }
      }
    }
    return { config, items: [], episodeKey: null }
  }

  const stockRows = allRows(db, STOCK_SQL)
  const lowItems = []
  /** @type {string[]} */
  const openKeys = []

  const existing = new Map(
    allRows(
      db,
      `SELECT ammo_type_id, active, opened_at, closed_at FROM alert_low_stock_state`,
    ).map((r) => [String(r.ammo_type_id), r]),
  )

  let dirty = false

  for (const row of stockRows) {
    const ammoTypeId = String(row.ammo_type_id)
    const qty = Math.round(Number(row.stock ?? 0))
    // Abaixo do mínimo das configurações. Quantidade 0 (ou negativa) entra sempre.
    const isLow = qty < config.threshold || qty <= 0
    const prev = existing.get(ammoTypeId)
    const wasActive = Boolean(prev?.active)

    if (isLow) {
      lowItems.push({
        ammoTypeId,
        name: String(row.ammo_name ?? '—'),
        caliber: String(row.caliber ?? '—'),
        productType: String(row.product_type ?? 'municao'),
        quantity: qty,
      })
      if (!wasActive) {
        runDb(
          db,
          `INSERT INTO alert_low_stock_state (ammo_type_id, active, opened_at, closed_at)
           VALUES (?, 1, ?, NULL)
           ON CONFLICT(ammo_type_id) DO UPDATE SET
             active = 1,
             opened_at = excluded.opened_at,
             closed_at = NULL`,
          [ammoTypeId, now],
        )
        dirty = true
        openKeys.push(`${ammoTypeId}:${now}`)
      } else {
        openKeys.push(`${ammoTypeId}:${prev.opened_at || ''}`)
      }
    } else if (wasActive) {
      runDb(
        db,
        `UPDATE alert_low_stock_state
         SET active = 0, closed_at = ?
         WHERE ammo_type_id = ?`,
        [now, ammoTypeId],
      )
      dirty = true
    }
  }

  const stockIds = new Set(stockRows.map((r) => String(r.ammo_type_id)))
  for (const [ammoTypeId, prev] of existing) {
    if (!stockIds.has(ammoTypeId) && prev.active) {
      runDb(
        db,
        `UPDATE alert_low_stock_state
         SET active = 0, closed_at = ?
         WHERE ammo_type_id = ?`,
        [now, ammoTypeId],
      )
      dirty = true
    }
  }

  if (dirty && typeof save === 'function') {
    try {
      save()
    } catch {
      /* não rethrow — caller isolado */
    }
  }

  openKeys.sort()
  const episodeKey = openKeys.length ? openKeys.join('|') : null

  return { config, items: lowItems, episodeKey }
}

/**
 * Sync isolado após movimentação — nunca lança para o caller.
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 */
function safeSyncAfterStockChange(db, save) {
  try {
    syncLowStockState(db, save)
  } catch (e) {
    console.warn('[alerts] sync low stock failed:', e?.message || e)
  }
}

/**
 * Aviso visível em qualquer PC (servidor ou cliente) quando o estoque está baixo.
 * @param {import('sql.js').Database} db
 * @param {() => void} [save]
 */
function checkLowStock(db, save) {
  const result = syncLowStockState(db, save)
  const items = result.items.map((i) => ({
    name: i.name,
    caliber: i.caliber,
    productType: i.productType,
    quantity: i.quantity,
  }))
  const show = Boolean(result.config.enabled && items.length)
  return {
    show,
    items: show ? items : [],
    threshold: result.config.threshold,
    episodeKey: show ? result.episodeKey : null,
    enabled: result.config.enabled,
  }
}

module.exports = {
  getConfig,
  saveConfig,
  syncLowStockState,
  safeSyncAfterStockChange,
  checkLowStock,
  ensureConfigRow,
}
