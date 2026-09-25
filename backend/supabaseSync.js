/**
 * Offline-first: SQLite (loja + clube) → Supabase. Só no PC servidor (Electron supabaseSync: true).
 * O banco deste PC é a única fonte. Cada ciclo grava o que existe aqui e apaga na nuvem
 * o que não existe aqui (incluindo cópias antigas sem local_id). Não soma as duas bases.
 */
const { createClient } = require('@supabase/supabase-js')
const syncOutbox = require('./syncOutbox.js')
const { sortOutboxRows } = require('./syncOrder.js')
const syncLogger = require('./syncLogger.js')
const { remoteTable } = require('./orbTables.js')

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const BATCH_UPSERT = 200
const OUTBOX_BATCH = 400

/** @type {ReturnType<typeof setInterval> | null} */
let syncTimer = null
let loggedActive = false
/** @type {boolean} */
let syncInFlight = false

/** @type {import('sql.js').Database | null} */
let shopDbRef = null
/** @type {(() => void) | null} */
let shopSaveRef = null
/** @type {import('sql.js').Database | null} */
let clubDbRef = null
/** @type {(() => void) | null} */
let clubSaveRef = null

/** @type {{ at: string, ok: boolean, message?: string } | null} */
let lastRunSummary = null

function isSyncConfigured() {
  const url = process.env.ORB_SUPABASE_SYNC_URL?.trim()
  const key = process.env.ORB_SUPABASE_SYNC_KEY?.trim()
  return Boolean(url && key)
}

function getClient() {
  const url = process.env.ORB_SUPABASE_SYNC_URL.trim()
  const key = process.env.ORB_SUPABASE_SYNC_KEY.trim()
  return createClient(url, key)
}

/**
 * Verifica reachability do projeto Supabase (não grava dados).
 */
async function checkSupabaseReachable(sb) {
  const { error } = await sb.from(remoteTable('calibers')).select('id', { count: 'exact', head: true })
  if (error) throw error
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function parsePayload(json) {
  if (json == null || json === '') return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {'shop' | 'club'} scope
 */
async function processOutboxScope(sb, db, save, scope) {
  const raw = syncOutbox.fetchPendingForProcessing(db, OUTBOX_BATCH)
  if (!raw.length) return { processed: 0, errors: 0 }
  const rows = sortOutboxRows(
    raw.map((r) => ({
      id: r.id,
      entity_table: r.entity_table,
      entity_id: r.entity_id,
      op: r.op,
      payload_json: r.payload_json,
      attempt_count: r.attempt_count,
    })),
    scope,
  )

  let processed = 0
  let errors = 0

  for (const r of rows) {
    const payload = parsePayload(r.payload_json)
    try {
      await applyOutboxRow(sb, scope, r.entity_table, r.op, r.entity_id, payload)
      syncOutbox.markSynced(db, save, r.id)
      processed += 1
      syncLogger.log('info', `outbox ${scope} ok`, {
        table: r.entity_table,
        op: r.op,
        id: r.entity_id,
      })
    } catch (e) {
      const msg = e?.message || String(e)
      syncOutbox.markErrorWithBackoff(db, save, r.id, msg, Number(r.attempt_count) + 1)
      errors += 1
      syncLogger.log('error', `outbox ${scope} falha`, {
        table: r.entity_table,
        op: r.op,
        id: r.entity_id,
        error: msg,
      })
    }
  }
  return { processed, errors }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function applyOutboxRow(sb, scope, table, op, entityId, payload) {
  if (op === 'DELETE') {
    await applyDelete(sb, scope, table, entityId)
    return
  }
  if (op !== 'INSERT' && op !== 'UPDATE') {
    throw new Error(`Operação inválida: ${op}`)
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload ausente para INSERT/UPDATE')
  }
  await applyUpsert(sb, scope, table, payload)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function applyDelete(sb, scope, table, entityId) {
  if (scope === 'shop') {
    if (table === 'ammo_movements') {
      const lid = Math.floor(Number(entityId))
      if (!Number.isFinite(lid)) throw new Error('entity_id movimento inválido')
      const { error } = await sb.from(remoteTable('ammo_movements')).delete().eq('local_id', lid)
      if (error) throw error
      return
    }
    const { error } = await sb.from(remoteTable(table)).delete().eq('id', entityId)
    if (error) throw error
    return
  }

  if (table === 'club_stock_movements') {
    const lid = Math.floor(Number(entityId))
    if (!Number.isFinite(lid)) throw new Error('entity_id movimento clube inválido')
    const { error } = await sb.from(remoteTable('club_stock_movements')).delete().eq('local_id', lid)
    if (error) throw error
    return
  }
  if (table === 'club_recipes') {
    const { error } = await sb.from(remoteTable('club_recipes')).delete().eq('caliber_id', entityId)
    if (error) throw error
    return
  }
  const { error } = await sb.from(remoteTable(table)).delete().eq('id', entityId)
  if (error) throw error
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function applyUpsert(sb, scope, table, payload) {
  if (scope === 'shop') {
    if (table === 'ammo_movements') {
      await writeMovementByLocalId(sb, 'ammo_movements', {
        local_id: payload.local_id,
        ammo_type_id: payload.ammo_type_id,
        quantity: payload.quantity,
        type: payload.type,
        date: payload.date,
        saida_group_id: payload.saida_group_id ?? null,
        nf_number: payload.nf_number ?? null,
      })
      return
    }
    const { error } = await sb.from(remoteTable(table)).upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (table === 'club_stock_movements') {
    await writeMovementByLocalId(sb, 'club_stock_movements', {
      local_id: payload.local_id,
      item_id: payload.item_id,
      type: payload.type,
      quantity: payload.quantity,
      date: payload.date,
      notes: payload.notes ?? null,
      production_batch_id: payload.production_batch_id ?? null,
    })
    return
  }

  const conflictCol = table === 'club_recipes' ? 'caliber_id' : 'id'
  const { error } = await sb.from(remoteTable(table)).upsert(payload, { onConflict: conflictCol })
  if (error) throw error
}

/**
 * @param {import('sql.js').Database} db
 */
function allRowsLocal(db, sql, params = []) {
  return syncOutbox.allRows(db, sql, params)
}

function countLocal(db, sql) {
  return Number(allRowsLocal(db, sql)[0]?.c ?? 0)
}

function shopHasSourceData(db) {
  return (
    countLocal(db, 'SELECT COUNT(*) AS c FROM calibers') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM ammo_types') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM ammo_movements') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM weapons') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM weapon_types') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM weapon_brands') >
    0
  )
}

function clubHasSourceData(db) {
  return (
    countLocal(db, 'SELECT COUNT(*) AS c FROM club_calibers') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM club_items') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM club_stock_movements') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM club_production_batches') +
      countLocal(db, 'SELECT COUNT(*) AS c FROM club_recipes') >
    0
  )
}

function normText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function normTime(value) {
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : normText(value)
}

function normQty(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sameShopMovement(remote, payload) {
  return (
    String(remote.ammo_type_id) === String(payload.ammo_type_id) &&
    normQty(remote.quantity) === normQty(payload.quantity) &&
    remote.type === payload.type &&
    normTime(remote.date) === normTime(payload.date) &&
    normText(remote.saida_group_id) === normText(payload.saida_group_id) &&
    normText(remote.nf_number) === normText(payload.nf_number)
  )
}

function sameClubMovement(remote, payload) {
  return (
    String(remote.item_id) === String(payload.item_id) &&
    remote.type === payload.type &&
    normQty(remote.quantity) === normQty(payload.quantity) &&
    normTime(remote.date) === normTime(payload.date) &&
    normText(remote.notes) === normText(payload.notes) &&
    normText(remote.production_batch_id) === normText(payload.production_batch_id)
  )
}

async function runPool(items, limit, fn) {
  if (!items.length) return
  let cursor = 0
  const workers = Math.min(limit, items.length)
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const idx = cursor
        cursor += 1
        if (idx >= items.length) return
        await fn(items[idx])
      }
    }),
  )
}

/**
 * Grava um movimento pelo id do SQLite. Se a nuvem já tem essa linha, atualiza.
 * Cópias repetidas do mesmo local_id são apagadas. Nunca cria uma segunda linha.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} table
 * @param {object} payload
 */
async function writeMovementByLocalId(sb, table, payload) {
  const lid = Number(payload.local_id)
  if (!Number.isFinite(lid)) throw new Error('local_id inválido')
  const remote = remoteTable(table)
  const { data, error } = await sb.from(remote).select('id').eq('local_id', lid)
  if (error) throw error
  const ids = (data ?? [])
    .map((row) => row.id)
    .filter((id) => id != null)
    .sort((a, b) => Number(a) - Number(b))
  if (!ids.length) {
    const { error: insErr } = await sb.from(remote).insert(payload)
    if (insErr) throw insErr
    return
  }
  const { error: updErr } = await sb.from(remote).update(payload).eq('id', ids[0])
  if (updErr) throw updErr
  if (ids.length > 1) {
    const { error: delErr } = await sb.from(remote).delete().in('id', ids.slice(1))
    if (delErr) throw delErr
  }
}

/**
 * Deixa a tabela de movimentos da nuvem igual à lista do PC.
 * Apaga linha sem local_id, local_id que não existe no PC e cópias do mesmo local_id.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} table
 * @param {object[]} payloads
 * @param {string} columns
 * @param {(remote: object, payload: object) => boolean} sameRow
 */
async function mirrorMovementsFromLocal(sb, table, payloads, columns, sameRow) {
  const remote = remoteTable(table)
  const pageSize = 1000
  const remoteRows = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from(remote)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    remoteRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  const wanted = new Set(payloads.map((row) => Number(row.local_id)))
  /** @type {Map<number, object[]>} */
  const byLocal = new Map()
  const deleteIds = []
  for (const row of remoteRows) {
    const lid = row.local_id == null ? NaN : Number(row.local_id)
    if (!Number.isFinite(lid) || !wanted.has(lid)) {
      deleteIds.push(row.id)
      continue
    }
    const list = byLocal.get(lid) ?? []
    list.push(row)
    byLocal.set(lid, list)
  }

  /** @type {{ id: number, payload: object }[]} */
  const updates = []
  /** @type {object[]} */
  const inserts = []
  for (const payload of payloads) {
    const lid = Number(payload.local_id)
    const matches = byLocal.get(lid) ?? []
    if (!matches.length) {
      inserts.push(payload)
      continue
    }
    matches.sort((a, b) => Number(a.id) - Number(b.id))
    if (!sameRow(matches[0], payload)) {
      updates.push({ id: matches[0].id, payload })
    }
    for (let i = 1; i < matches.length; i += 1) deleteIds.push(matches[i].id)
  }

  for (const part of chunk(deleteIds, 100)) {
    const { error } = await sb.from(remote).delete().in('id', part)
    if (error) throw error
  }
  for (const part of chunk(inserts, BATCH_UPSERT)) {
    const { error } = await sb.from(remote).insert(part)
    if (error) throw error
  }
  await runPool(updates, 8, async (item) => {
    const { error } = await sb.from(remote).update(item.payload).eq('id', item.id)
    if (error) throw error
  })

  if (deleteIds.length || inserts.length || updates.length) {
    syncLogger.log('info', `nuvem alinhada ao PC (${remote})`, {
      removed: deleteIds.length,
      inserted: inserts.length,
      updated: updates.length,
      local: payloads.length,
    })
  }
}

/**
 * Remove linhas no Supabase cujo `id` não existe mais no SQLite (fonte da verdade).
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} table
 * @param {Set<string>} localIds
 */
async function purgeRemoteRowsNotInLocal(sb, table, localIds) {
  const remote = remoteTable(table)
  const pageSize = 1000
  const extras = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from(remote)
      .select('id')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    for (const row of data) {
      if (row.id != null && !localIds.has(String(row.id))) extras.push(row.id)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  for (const part of chunk(extras, 100)) {
    const { error: delErr } = await sb.from(remote).delete().in('id', part)
    if (delErr) throw delErr
  }
  if (extras.length) {
    syncLogger.log('warn', `Supabase: removidas linhas extra em ${remote}`, {
      count: extras.length,
    })
  }
}

/**
 * Reconciliação: dimensões + movimentos com local_id; remove órfãos no remoto (origem local).
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {import('sql.js').Database} db
 */
async function reconcileShopSnapshot(sb, db) {
  if (!shopHasSourceData(db)) {
    syncLogger.log(
      'warn',
      'banco local da loja está vazio — a nuvem não foi alterada',
    )
    return
  }

  const calibers = allRowsLocal(db, 'SELECT id, name, product_type FROM calibers')
  for (const part of chunk(calibers, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('calibers')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const weaponTypes = allRowsLocal(db, 'SELECT id, name, created_at FROM weapon_types')
  for (const part of chunk(weaponTypes, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('weapon_types')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const weaponBrands = allRowsLocal(db, 'SELECT id, name, created_at FROM weapon_brands')
  for (const part of chunk(weaponBrands, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('weapon_brands')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const ammoTypes = allRowsLocal(
    db,
    'SELECT id, name, caliber_id, created_at FROM ammo_types',
  )
  for (const part of chunk(ammoTypes, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('ammo_types')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const weapons = allRowsLocal(db, 'SELECT * FROM weapons')
  for (const part of chunk(weapons, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('weapons')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const movements = allRowsLocal(
    db,
    `SELECT id, ammo_type_id, quantity, type, date, saida_group_id, nf_number FROM ammo_movements ORDER BY id`,
  )
  await mirrorMovementsFromLocal(
    sb,
    'ammo_movements',
    movements.map((row) => ({
      local_id: row.id,
      ammo_type_id: row.ammo_type_id,
      quantity: row.quantity,
      type: row.type,
      date: row.date,
      saida_group_id: row.saida_group_id ?? null,
      nf_number: row.nf_number ?? null,
    })),
    'id, local_id, ammo_type_id, quantity, type, date, saida_group_id, nf_number',
    sameShopMovement,
  )

  await purgeRemoteRowsNotInLocal(
    sb,
    'weapons',
    new Set(allRowsLocal(db, 'SELECT id FROM weapons').map((r) => String(r.id))),
  )
  await purgeRemoteRowsNotInLocal(
    sb,
    'ammo_types',
    new Set(allRowsLocal(db, 'SELECT id FROM ammo_types').map((r) => String(r.id))),
  )
  await purgeRemoteRowsNotInLocal(
    sb,
    'weapon_types',
    new Set(allRowsLocal(db, 'SELECT id FROM weapon_types').map((r) => String(r.id))),
  )
  await purgeRemoteRowsNotInLocal(
    sb,
    'weapon_brands',
    new Set(allRowsLocal(db, 'SELECT id FROM weapon_brands').map((r) => String(r.id))),
  )
  await purgeRemoteRowsNotInLocal(
    sb,
    'calibers',
    new Set(allRowsLocal(db, 'SELECT id FROM calibers').map((r) => String(r.id))),
  )
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {import('sql.js').Database} db
 */
async function reconcileClubSnapshot(sb, db) {
  if (!clubHasSourceData(db)) {
    syncLogger.log(
      'warn',
      'banco local do clube está vazio — a nuvem do clube não foi alterada',
    )
    return
  }

  const cal = allRowsLocal(db, 'SELECT id, name, created_at FROM club_calibers')
  for (const part of chunk(cal, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('club_calibers')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const items = allRowsLocal(db, 'SELECT id, name, kind, created_at FROM club_items')
  for (const part of chunk(items, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('club_items')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const batches = allRowsLocal(
    db,
    'SELECT id, caliber_id, municoes_produzidas, date, notes, created_at FROM club_production_batches',
  )
  for (const part of chunk(batches, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('club_production_batches')).upsert(part, { onConflict: 'id' })
    if (error) throw error
  }

  const recipes = allRowsLocal(
    db,
    `SELECT caliber_id, polvora_item_id, espoleta_item_id, ponta_item_id, municao_output_item_id,
            grains_polvora_por_municao, espoletas_por_municao, pontas_por_municao, updated_at
     FROM club_recipes`,
  )
  for (const part of chunk(recipes, BATCH_UPSERT)) {
    if (!part.length) continue
    const { error } = await sb.from(remoteTable('club_recipes')).upsert(part, { onConflict: 'caliber_id' })
    if (error) throw error
  }

  const movs = allRowsLocal(
    db,
    `SELECT id, item_id, type, quantity, date, notes, production_batch_id FROM club_stock_movements ORDER BY id`,
  )
  await mirrorMovementsFromLocal(
    sb,
    'club_stock_movements',
    movs.map((row) => ({
      local_id: row.id,
      item_id: row.item_id,
      type: row.type,
      quantity: row.quantity,
      date: row.date,
      notes: row.notes ?? null,
      production_batch_id: row.production_batch_id ?? null,
    })),
    'id, local_id, item_id, type, quantity, date, notes, production_batch_id',
    sameClubMovement,
  )

  await purgeRemoteRowsNotInLocal(
    sb,
    'club_production_batches',
    new Set(allRowsLocal(db, 'SELECT id FROM club_production_batches').map((r) => String(r.id))),
  )

  const recipeKeys = new Set(
    allRowsLocal(db, 'SELECT caliber_id FROM club_recipes').map((r) => String(r.caliber_id)),
  )
  const extraRecipes = []
  let rFrom = 0
  const rPage = 500
  for (;;) {
    const { data, error } = await sb
      .from(remoteTable('club_recipes'))
      .select('caliber_id')
      .order('caliber_id', { ascending: true })
      .range(rFrom, rFrom + rPage - 1)
    if (error) throw error
    if (!data?.length) break
    for (const row of data) {
      if (row.caliber_id && !recipeKeys.has(String(row.caliber_id))) {
        extraRecipes.push(row.caliber_id)
      }
    }
    if (data.length < rPage) break
    rFrom += rPage
  }
  for (const part of chunk(extraRecipes, 100)) {
    const { error: derr } = await sb.from(remoteTable('club_recipes')).delete().in('caliber_id', part)
    if (derr) throw derr
  }
  if (extraRecipes.length) {
    syncLogger.log('warn', 'Supabase: removidas receitas extra (clube)', {
      count: extraRecipes.length,
    })
  }

  await purgeRemoteRowsNotInLocal(
    sb,
    'club_items',
    new Set(allRowsLocal(db, 'SELECT id FROM club_items').map((r) => String(r.id))),
  )
  await purgeRemoteRowsNotInLocal(
    sb,
    'club_calibers',
    new Set(allRowsLocal(db, 'SELECT id FROM club_calibers').map((r) => String(r.id))),
  )
}

/**
 * Contagens locais para verificação básica (sem bater no remoto).
 */
function integrityLocalCounts(shopDb, clubDb) {
  const shop = {
    calibers: syncOutbox.allRows(shopDb, 'SELECT COUNT(*) AS c FROM calibers')[0]?.c,
    ammo_types: syncOutbox.allRows(shopDb, 'SELECT COUNT(*) AS c FROM ammo_types')[0]?.c,
    ammo_movements: syncOutbox.allRows(shopDb, 'SELECT COUNT(*) AS c FROM ammo_movements')[0]?.c,
    weapons: syncOutbox.allRows(shopDb, 'SELECT COUNT(*) AS c FROM weapons')[0]?.c,
    outbox: syncOutbox.countByStatus(shopDb),
  }
  const club = clubDb
    ? {
        club_calibers: syncOutbox.allRows(clubDb, 'SELECT COUNT(*) AS c FROM club_calibers')[0]?.c,
        club_items: syncOutbox.allRows(clubDb, 'SELECT COUNT(*) AS c FROM club_items')[0]?.c,
        club_stock_movements: syncOutbox.allRows(
          clubDb,
          'SELECT COUNT(*) AS c FROM club_stock_movements',
        )[0]?.c,
        outbox: syncOutbox.countByStatus(clubDb),
      }
    : null
  return { shop, club }
}

/**
 * @param {import('sql.js').Database} shopDb
 * @param {() => void} shopSave
 * @param {import('sql.js').Database} [clubDb]
 * @param {() => void} [clubSave]
 */
async function pushOnce(shopDb, shopSave, clubDb, clubSave) {
  if (!isSyncConfigured()) {
    lastRunSummary = { at: new Date().toISOString(), ok: true, message: 'sync_desligado' }
    return lastRunSummary
  }

  const sb = getClient()
  await checkSupabaseReachable(sb)

  let outProc = 0
  let outErr = 0

  const r1 = await processOutboxScope(sb, shopDb, shopSave, 'shop')
  outProc += r1.processed
  outErr += r1.errors

  if (clubDb && clubSave) {
    const r2 = await processOutboxScope(sb, clubDb, clubSave, 'club')
    outProc += r2.processed
    outErr += r2.errors
  }

  await reconcileShopSnapshot(sb, shopDb)
  if (clubDb) {
    await reconcileClubSnapshot(sb, clubDb)
  }

  syncOutbox.pruneSynced(shopDb, shopSave, 2500)
  if (clubDb && clubSave) {
    syncOutbox.pruneSynced(clubDb, clubSave, 2500)
  }

  syncLogger.log('info', 'ciclo sync concluído', {
    outboxProcessed: outProc,
    outboxErrors: outErr,
  })

  lastRunSummary = {
    at: new Date().toISOString(),
    ok: outErr === 0,
    message: outErr ? `outbox_errors:${outErr}` : 'ok',
    outboxProcessed: outProc,
    outboxErrors: outErr,
  }
  return lastRunSummary
}

async function tick() {
  if (!shopDbRef || !shopSaveRef || !isSyncConfigured()) return
  if (syncInFlight) {
    syncLogger.log('warn', 'sync ignorado: ciclo anterior ainda em execução')
    return
  }
  syncInFlight = true
  try {
    await pushOnce(shopDbRef, shopSaveRef, clubDbRef, clubSaveRef)
  } catch (e) {
    const msg = e?.message || String(e)
    syncLogger.log('error', 'ciclo sync falhou', { error: msg })
    lastRunSummary = { at: new Date().toISOString(), ok: false, message: msg }
  } finally {
    syncInFlight = false
  }
}

/**
 * @param {import('sql.js').Database} shopDb
 * @param {() => void} shopSave
 * @param {{ clubDb?: import('sql.js').Database, clubSave?: () => void, logPath?: string }} [opts]
 */
function startSupabaseSync(shopDb, shopSave, opts = {}) {
  stopSupabaseSync()
  shopDbRef = shopDb
  shopSaveRef = shopSave
  clubDbRef = opts.clubDb ?? null
  clubSaveRef = opts.clubSave ?? null

  if (opts.logPath) {
    syncLogger.setLogPath(opts.logPath)
  }

  if (!isSyncConfigured()) return

  if (!loggedActive) {
    console.info(`OrBullets: cópia para Supabase ativa (a cada ${SYNC_INTERVAL_MS / 60000} min).`)
    loggedActive = true
  }

  syncTimer = setInterval(tick, SYNC_INTERVAL_MS)
  setTimeout(tick, 8000)
}

function stopSupabaseSync() {
  if (syncTimer != null) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  shopDbRef = null
  shopSaveRef = null
  clubDbRef = null
  clubSaveRef = null
}

function getLastRunSummary() {
  return lastRunSummary
}

function getSyncState() {
  return {
    configured: isSyncConfigured(),
    inFlight: syncInFlight,
    lastRun: lastRunSummary,
    intervalMs: SYNC_INTERVAL_MS,
  }
}

module.exports = {
  startSupabaseSync,
  stopSupabaseSync,
  pushOnce,
  isSyncConfigured,
  SYNC_INTERVAL_MS,
  integrityLocalCounts,
  getLastRunSummary,
  getSyncState,
  checkSupabaseReachable,
}
