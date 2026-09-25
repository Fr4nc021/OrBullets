/**
 * Outbox por base SQLite (loja ou clube). Último evento por entidade substitui pendentes anteriores.
 * @param {import('sql.js').Database} db
 * @param {string} sql
 * @param {unknown[]} [params]
 */
function allRows(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) {
    out.push(stmt.getAsObject())
  }
  stmt.free()
  return out
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
 * @param {() => void} save
 * @param {{
 *   entityTable: string,
 *   entityId: string,
 *   op: 'INSERT' | 'UPDATE' | 'DELETE',
 *   payload?: object | null
 * }} row
 */
function enqueueChange(db, save, { entityTable, entityId, op, payload = null }) {
  const now = new Date().toISOString()
  const id = String(entityId)
  const payloadJson = payload == null ? null : JSON.stringify(payload)

  runDb(db, 'BEGIN IMMEDIATE')
  try {
    runDb(
      db,
      `DELETE FROM sync_outbox WHERE entity_table = ? AND entity_id = ? AND status IN ('pending', 'error')`,
      [entityTable, id],
    )
    runDb(
      db,
      `INSERT INTO sync_outbox (
        entity_table, entity_id, op, payload_json, created_at, updated_at, status,
        attempt_count, next_attempt_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL)`,
      [entityTable, id, op, payloadJson, now, now],
    )
    runDb(db, 'COMMIT')
  } catch (e) {
    try {
      runDb(db, 'ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  }
  save()
}

/**
 * @param {import('sql.js').Database} db
 * @param {number} limit
 */
function fetchPendingForProcessing(db, limit = 500) {
  const now = new Date().toISOString()
  const rows = allRows(
    db,
    `SELECT id, entity_table, entity_id, op, payload_json, attempt_count
     FROM sync_outbox
     WHERE status IN ('pending', 'error')
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY id ASC
     LIMIT ?`,
    [now, limit],
  )
  return rows.map((r) => ({
    id: r.id,
    entity_table: r.entity_table,
    entity_id: r.entity_id,
    op: r.op,
    payload_json: r.payload_json,
    attempt_count: r.attempt_count,
  }))
}

/**
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {number} id
 */
function markSynced(db, save, id) {
  const now = new Date().toISOString()
  runDb(
    db,
    `UPDATE sync_outbox SET status = 'synced', synced_at = ?, error_message = NULL WHERE id = ?`,
    [now, id],
  )
  save()
}

/**
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {number} id
 * @param {string} message
 * @param {number} attemptCount
 */
function markErrorWithBackoff(db, save, id, message, attemptCount) {
  const nextMs = Math.min(300_000, 1000 * 2 ** Math.min(attemptCount, 8))
  const next = new Date(Date.now() + nextMs).toISOString()
  const now = new Date().toISOString()
  runDb(
    db,
    `UPDATE sync_outbox SET
      status = 'error',
      error_message = ?,
      attempt_count = ?,
      next_attempt_at = ?,
      updated_at = ?
     WHERE id = ?`,
    [message.slice(0, 2000), attemptCount, next, now, id],
  )
  save()
}

/**
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {number} id
 */
function resetPendingForRetry(db, save, id) {
  runDb(
    db,
    `UPDATE sync_outbox SET status = 'pending', error_message = NULL WHERE id = ? AND status = 'error'`,
    [id],
  )
  save()
}

/**
 * @param {import('sql.js').Database} db
 */
function countByStatus(db) {
  const rows = allRows(
    db,
    `SELECT status, COUNT(*) AS c FROM sync_outbox GROUP BY status`,
  )
  const o = { pending: 0, syncing: 0, synced: 0, error: 0 }
  for (const r of rows) {
    const k = r.status
    if (k in o) o[k] = Number(r.c)
  }
  return o
}

/**
 * Remove linhas já sincronizadas (mantém fila enxuta). Opcional.
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {number} [keepLastSynced]
 */
function pruneSynced(db, save, keepLastSynced = 2000) {
  const cntRow = allRows(db, `SELECT COUNT(*) AS c FROM sync_outbox WHERE status = 'synced'`)[0]
  const cnt = Number(cntRow?.c ?? 0)
  if (cnt <= keepLastSynced) return
  const excess = cnt - keepLastSynced
  const old = allRows(
    db,
    `SELECT id FROM sync_outbox WHERE status = 'synced' ORDER BY synced_at ASC LIMIT ?`,
    [excess],
  )
  if (!old.length) return
  const ph = old.map(() => '?').join(',')
  runDb(
    db,
    `DELETE FROM sync_outbox WHERE id IN (${ph})`,
    old.map((r) => r.id),
  )
  save()
}

module.exports = {
  enqueueChange,
  fetchPendingForProcessing,
  markSynced,
  markErrorWithBackoff,
  resetPendingForRetry,
  countByStatus,
  pruneSynced,
  allRows,
  runDb,
}
