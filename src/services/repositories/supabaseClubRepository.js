import { supabase as supabaseClient } from '../supabase.js'
import { ORB_TABLES as T } from '../orbTables.js'
import { formatSupabaseError } from './supabaseAmmoRepository.js'
import {
  batchEditImpactByItem,
  isNegativeStock,
  movementInPeriod,
  periodIsoBounds,
  rescaleBatchMovement,
  signedMovementQty,
  stockAfterMovementEdit,
  stockFromMovementRows,
} from '../../features/club/clubDomain.js'

const MOV_PAGE = 1000

function sb() {
  if (!supabaseClient) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_ANON_KEY no .env ou use o OrBullets desktop.',
    )
  }
  return supabaseClient
}

function normNameKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
}

function isDuplicateCaliberError(err) {
  if (!err) return false
  if (err.code === '23505') return true
  const msg = (err.message ?? '').toLowerCase()
  return msg.includes('orbullets_club_calibers') || msg.includes('unique')
}

function sortByNamePt(rows, nameKey = 'name') {
  return [...(rows ?? [])].sort((a, b) =>
    String(a[nameKey] ?? '').localeCompare(String(b[nameKey] ?? ''), 'pt-BR', {
      sensitivity: 'base',
    }),
  )
}

async function fetchAllMovements() {
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await sb()
      .from(T.club_stock_movements)
      .select(
        'id, local_id, item_id, type, quantity, date, notes, production_batch_id',
      )
      .order('id', { ascending: true })
      .range(from, from + MOV_PAGE - 1)
    if (error) throw new Error(formatSupabaseError(error))
    if (!data?.length) break
    all.push(...data)
    if (data.length < MOV_PAGE) break
    from += MOV_PAGE
  }
  return all
}

function movementsByItem(allMovs) {
  const map = new Map()
  for (const m of allMovs) {
    const key = String(m.item_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(m)
  }
  return map
}

function stockForItem(itemId, byItem) {
  const rows = byItem.get(String(itemId)) ?? []
  return stockFromMovementRows(rows)
}

async function nextMovementLocalId() {
  const { data, error } = await sb()
    .from(T.club_stock_movements)
    .select('local_id')
    .not('local_id', 'is', null)
    .order('local_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(formatSupabaseError(error))
  const max = Number(data?.local_id ?? 0)
  return Number.isFinite(max) && max > 0 ? max + 1 : 1
}

async function insertMovement(row, attempt = 0) {
  let localId = row.local_id
  if (localId == null) {
    localId = await nextMovementLocalId()
  }
  const payload = { ...row, local_id: localId }
  const { data, error } = await sb()
    .from(T.club_stock_movements)
    .insert(payload)
    .select(
      'id, local_id, item_id, type, quantity, date, notes, production_batch_id',
    )
    .single()
  if (error) {
    if (error.code === '23505' && attempt < 2) {
      return insertMovement({ ...row, local_id: null }, attempt + 1)
    }
    throw new Error(formatSupabaseError(error))
  }
  return data
}

async function getItemOrThrow(itemId) {
  const { data, error } = await sb()
    .from(T.club_items)
    .select('id, name, kind, created_at')
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw new Error(formatSupabaseError(error))
  if (!data) throw new Error('Item não encontrado.')
  return data
}

async function assertItemKind(itemId, expectedKind) {
  const item = await getItemOrThrow(itemId)
  if (item.kind !== expectedKind) {
    throw new Error(`Item deve ser do tipo ${expectedKind}.`)
  }
  return item
}

async function itemReferencedInRecipe(itemId) {
  const { data, error } = await sb()
    .from(T.club_recipes)
    .select('caliber_id')
    .or(
      `polvora_item_id.eq.${itemId},espoleta_item_id.eq.${itemId},ponta_item_id.eq.${itemId},municao_output_item_id.eq.${itemId}`,
    )
    .limit(1)
  if (error) throw new Error(formatSupabaseError(error))
  return (data ?? []).length > 0
}

// ——— Calibres ———

export async function fetchClubCalibers() {
  const { data, error } = await sb()
    .from(T.club_calibers)
    .select('id, name, created_at')
  if (error) throw new Error(formatSupabaseError(error))
  return sortByNamePt(data ?? [])
}

export async function createClubCaliber(name) {
  const trimmed = name != null ? String(name).trim() : ''
  if (!trimmed) throw new Error('name é obrigatório.')

  const existing = await fetchClubCalibers()
  const key = normNameKey(trimmed)
  if (existing.some((c) => normNameKey(c.name) === key)) {
    const err = new Error('Já existe calibre com este nome.')
    err.status = 409
    throw err
  }

  const id = crypto.randomUUID()
  const { data, error } = await sb()
    .from(T.club_calibers)
    .insert({ id, name: trimmed })
    .select('id, name, created_at')
    .single()
  if (error) {
    if (isDuplicateCaliberError(error)) {
      const err = new Error('Já existe calibre com este nome.')
      err.status = 409
      throw err
    }
    throw new Error(formatSupabaseError(error))
  }
  return data
}

export async function updateClubCaliber(id, name) {
  const trimmed = name != null ? String(name).trim() : ''
  if (!trimmed) throw new Error('name é obrigatório.')

  const existing = await fetchClubCalibers()
  const key = normNameKey(trimmed)
  if (existing.some((c) => c.id !== id && normNameKey(c.name) === key)) {
    const err = new Error('Já existe calibre com este nome.')
    err.status = 409
    throw err
  }

  const { data, error } = await sb()
    .from(T.club_calibers)
    .update({ name: trimmed })
    .eq('id', id)
    .select('id, name, created_at')
    .maybeSingle()
  if (error) {
    if (isDuplicateCaliberError(error)) {
      const err = new Error('Já existe calibre com este nome.')
      err.status = 409
      throw err
    }
    throw new Error(formatSupabaseError(error))
  }
  if (!data) throw new Error('Calibre não encontrado.')
  return data
}

export async function deleteClubCaliber(id) {
  const { data: cal } = await sb()
    .from(T.club_calibers)
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!cal) throw new Error('Calibre não encontrado.')

  const { data: recipes } = await sb()
    .from(T.club_recipes)
    .select('caliber_id')
    .eq('caliber_id', id)
    .limit(1)
  if (recipes?.length) {
    throw new Error('Remova a receita deste calibre antes de excluir o calibre.')
  }

  const { data: batches } = await sb()
    .from(T.club_production_batches)
    .select('id')
    .eq('caliber_id', id)
    .limit(1)
  if (batches?.length) {
    throw new Error('Existem lotes de produção para este calibre; não é possível excluir.')
  }

  const { error } = await sb().from(T.club_calibers).delete().eq('id', id)
  if (error) throw new Error(formatSupabaseError(error))
}

// ——— Itens ———

export async function fetchClubItems(kind) {
  let q = sb().from(T.club_items).select('id, name, kind, created_at')
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) throw new Error(formatSupabaseError(error))
  const rows = data ?? []
  rows.sort((a, b) => {
    const k = String(a.kind).localeCompare(String(b.kind))
    if (k !== 0) return k
    return String(a.name).localeCompare(String(b.name), 'pt-BR', { sensitivity: 'base' })
  })
  return rows
}

export async function createClubItem(name, kind) {
  const trimmed = name != null ? String(name).trim() : ''
  if (!trimmed) throw new Error('name é obrigatório.')
  const k = kind != null ? String(kind).trim() : ''
  if (!['polvora', 'espoleta', 'ponta', 'municao'].includes(k)) {
    throw new Error('kind deve ser polvora, espoleta, ponta ou municao.')
  }
  const id = crypto.randomUUID()
  const { data, error } = await sb()
    .from(T.club_items)
    .insert({ id, name: trimmed, kind: k })
    .select('id, name, kind, created_at')
    .single()
  if (error) throw new Error(formatSupabaseError(error))
  return data
}

export async function updateClubItem(id, body) {
  const existing = await getItemOrThrow(id)
  const name = body.name !== undefined ? String(body.name).trim() : existing.name
  const kind = body.kind !== undefined ? String(body.kind).trim() : existing.kind
  if (!name) throw new Error('name não pode ficar vazio.')
  if (!['polvora', 'espoleta', 'ponta', 'municao'].includes(kind)) {
    throw new Error('kind deve ser polvora, espoleta, ponta ou municao.')
  }
  if (kind !== existing.kind) {
    const inRecipe = await itemReferencedInRecipe(id)
    if (inRecipe) {
      throw new Error(
        'Não é possível alterar o tipo: o item está numa receita. Retire-o da receita primeiro.',
      )
    }
  }
  const { data, error } = await sb()
    .from(T.club_items)
    .update({ name, kind })
    .eq('id', id)
    .select('id, name, kind, created_at')
    .single()
  if (error) throw new Error(formatSupabaseError(error))
  return data
}

export async function setClubItemBalance(id, quantity) {
  await getItemOrThrow(id)
  const target = Number(quantity)
  if (!Number.isFinite(target) || target < 0) {
    throw new Error('quantity deve ser um número maior ou igual a zero.')
  }
  const allMovs = await fetchAllMovements()
  const byItem = movementsByItem(allMovs)
  const current = stockForItem(id, byItem)
  const delta = target - current
  if (Math.abs(delta) < 1e-9) {
    return { id, stock: current }
  }
  const type = delta > 0 ? 'entrada' : 'saida'
  const q = Math.abs(delta)
  const when = new Date().toISOString()
  await insertMovement({
    item_id: id,
    type,
    quantity: q,
    date: when,
    notes: 'Ajuste de saldo',
    production_batch_id: null,
  })
  const stock = stockForItem(id, movementsByItem(await fetchAllMovements()))
  return { id, stock }
}

export async function deleteClubItem(id) {
  await getItemOrThrow(id)
  if (await itemReferencedInRecipe(id)) {
    throw new Error('Não é possível excluir: o item está numa receita.')
  }
  const { error: movErr } = await sb()
    .from(T.club_stock_movements)
    .delete()
    .eq('item_id', id)
  if (movErr) throw new Error(formatSupabaseError(movErr))
  const { error: itemErr } = await sb().from(T.club_items).delete().eq('id', id)
  if (itemErr) throw new Error(formatSupabaseError(itemErr))
}

export async function clearClubItemMovements(id) {
  await getItemOrThrow(id)
  const { data: deleted, error } = await sb()
    .from(T.club_stock_movements)
    .delete()
    .eq('item_id', id)
    .select('id')
  if (error) throw new Error(formatSupabaseError(error))
  return { id, stock: 0, deleted_movements: (deleted ?? []).length }
}

// ——— Estoque e movimentos ———

export async function fetchClubStock() {
  const items = await fetchClubItems()
  const allMovs = await fetchAllMovements()
  const byItem = movementsByItem(allMovs)
  return items.map((it) => ({
    ...it,
    stock: stockForItem(it.id, byItem),
  }))
}

export async function createClubStockMovement(body) {
  const itemId = body?.item_id
  const type = body?.type
  const quantity = body?.quantity
  if (!itemId || !type || quantity == null) {
    throw new Error('item_id, type e quantity são obrigatórios.')
  }
  if (type !== 'entrada' && type !== 'saida') {
    throw new Error('type deve ser entrada ou saida.')
  }
  const q = Number(quantity)
  if (!Number.isFinite(q) || q <= 0) {
    throw new Error('quantity deve ser um número positivo.')
  }
  await getItemOrThrow(itemId)
  const when =
    body.date != null && String(body.date).trim()
      ? String(body.date).trim()
      : new Date().toISOString()
  const note =
    body.notes != null ? String(body.notes).trim() || null : null
  return insertMovement({
    item_id: itemId,
    type,
    quantity: q,
    date: when,
    notes: note,
    production_batch_id: null,
  })
}

async function enrichMovements(rows) {
  const items = await fetchClubItems()
  const byId = new Map(items.map((i) => [i.id, i]))
  return (rows ?? []).map((m) => {
    const it = byId.get(m.item_id)
    return {
      ...m,
      item_name: it?.name ?? m.item_id,
      item_kind: it?.kind,
    }
  })
}

export async function fetchClubStockMovements(limit = 200) {
  const lim = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 200))
  const { data, error } = await sb()
    .from(T.club_stock_movements)
    .select(
      'id, item_id, type, quantity, date, notes, production_batch_id',
    )
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(lim)
  if (error) throw new Error(formatSupabaseError(error))
  return enrichMovements(data ?? [])
}

export async function updateClubStockMovement(id, body) {
  const movId = Math.floor(Number(id))
  if (!Number.isFinite(movId) || movId <= 0) {
    throw new Error('id de movimento inválido.')
  }
  const { data: prev, error: prevErr } = await sb()
    .from(T.club_stock_movements)
    .select('id, item_id, type, quantity, date, notes, production_batch_id')
    .eq('id', movId)
    .maybeSingle()
  if (prevErr) throw new Error(formatSupabaseError(prevErr))
  if (!prev) throw new Error('Movimento não encontrado.')

  const linkedBatch =
    prev.production_batch_id != null && String(prev.production_batch_id).trim()

  if (linkedBatch) {
    const noteOnly =
      body.item_id === undefined &&
      body.type === undefined &&
      body.quantity === undefined &&
      body.date === undefined &&
      body.notes !== undefined
    if (!noteOnly) {
      throw new Error(
        'Movimento ligado a um lote de produção: só é possível alterar as notas. Quantidade e data ajustam-se pelo lote.',
      )
    }
    const notes = body.notes != null ? String(body.notes).trim() || null : null
    const { data, error } = await sb()
      .from(T.club_stock_movements)
      .update({ notes })
      .eq('id', movId)
      .select(
        'id, item_id, type, quantity, date, notes, production_batch_id',
      )
      .single()
    if (error) throw new Error(formatSupabaseError(error))
    return data
  }

  const itemId = body.item_id !== undefined ? String(body.item_id).trim() : prev.item_id
  const type = body.type !== undefined ? String(body.type).trim() : prev.type
  const qty = body.quantity !== undefined ? Number(body.quantity) : Number(prev.quantity)
  const date =
    body.date !== undefined && String(body.date).trim()
      ? String(body.date).trim()
      : String(prev.date)
  const notes =
    body.notes !== undefined
      ? body.notes != null
        ? String(body.notes).trim() || null
        : null
      : prev.notes

  if (!itemId) throw new Error('item_id é obrigatório.')
  if (type !== 'entrada' && type !== 'saida') {
    throw new Error('type deve ser entrada ou saida.')
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('quantity deve ser um número positivo.')
  }
  await getItemOrThrow(itemId)

  const allMovs = await fetchAllMovements()
  const byItem = movementsByItem(allMovs)
  const affected = new Set([String(prev.item_id), String(itemId)])
  const prevMov = { item_id: prev.item_id, type: prev.type, quantity: prev.quantity }
  const nextMov = { item_id: itemId, type, quantity: qty }
  for (const iid of affected) {
  const s = stockAfterMovementEdit(stockForItem(iid, byItem), prevMov, nextMov, iid)
    if (isNegativeStock(s)) {
      throw new Error(
        'A alteração deixaria um item com saldo negativo. Ajuste valores ou o estoque.',
      )
    }
  }

  const { data, error } = await sb()
    .from(T.club_stock_movements)
    .update({
      item_id: itemId,
      type,
      quantity: qty,
      date,
      notes,
    })
    .eq('id', movId)
    .select(
      'id, item_id, type, quantity, date, notes, production_batch_id',
    )
    .single()
  if (error) throw new Error(formatSupabaseError(error))
  return data
}

export async function deleteClubStockMovement(id) {
  const movId = Math.floor(Number(id))
  if (!Number.isFinite(movId) || movId <= 0) {
    throw new Error('id de movimento inválido.')
  }
  const { data: prev, error: prevErr } = await sb()
    .from(T.club_stock_movements)
    .select('id, item_id, type, quantity, production_batch_id')
    .eq('id', movId)
    .maybeSingle()
  if (prevErr) throw new Error(formatSupabaseError(prevErr))
  if (!prev) throw new Error('Movimento não encontrado.')
  if (prev.production_batch_id != null && String(prev.production_batch_id).trim()) {
    throw new Error(
      'Movimento ligado a um lote de produção: exclua ou edite o lote em «Últimos lotes».',
    )
  }
  const allMovs = await fetchAllMovements()
  const byItem = movementsByItem(allMovs)
  const s =
    stockForItem(prev.item_id, byItem) - signedMovementQty(prev.type, prev.quantity)
  if (isNegativeStock(s)) {
    throw new Error('Remover este movimento deixaria saldo inconsistente.')
  }
  const { error } = await sb().from(T.club_stock_movements).delete().eq('id', movId)
  if (error) throw new Error(formatSupabaseError(error))
}

// ——— Receitas ———

export async function fetchClubRecipes() {
  const [{ data: recipes, error: er }, items, calibers] = await Promise.all([
    sb().from(T.club_recipes).select('*'),
    fetchClubItems(),
    fetchClubCalibers(),
  ])
  if (er) throw new Error(formatSupabaseError(er))
  const itemById = new Map(items.map((i) => [i.id, i]))
  const calById = new Map(calibers.map((c) => [c.id, c]))
  const rows = (recipes ?? []).map((r) => ({
    caliber_id: r.caliber_id,
    caliber_name: calById.get(r.caliber_id)?.name ?? r.caliber_id,
    polvora_item_id: r.polvora_item_id,
    polvora_name: itemById.get(r.polvora_item_id)?.name ?? r.polvora_item_id,
    espoleta_item_id: r.espoleta_item_id,
    espoleta_name: itemById.get(r.espoleta_item_id)?.name ?? r.espoleta_item_id,
    ponta_item_id: r.ponta_item_id,
    ponta_name: itemById.get(r.ponta_item_id)?.name ?? r.ponta_item_id,
    municao_output_item_id: r.municao_output_item_id,
    municao_output_name: r.municao_output_item_id
      ? itemById.get(r.municao_output_item_id)?.name ?? null
      : null,
    grains_polvora_por_municao: r.grains_polvora_por_municao,
    espoletas_por_municao: r.espoletas_por_municao,
    pontas_por_municao: r.pontas_por_municao,
    updated_at: r.updated_at,
  }))
  return sortByNamePt(rows, 'caliber_name')
}

export async function fetchClubRecipe(caliberId) {
  const { data, error } = await sb()
    .from(T.club_recipes)
    .select(
      'caliber_id, polvora_item_id, espoleta_item_id, ponta_item_id, municao_output_item_id, grains_polvora_por_municao, espoletas_por_municao, pontas_por_municao, updated_at',
    )
    .eq('caliber_id', caliberId)
    .maybeSingle()
  if (error) throw new Error(formatSupabaseError(error))
  return data ?? null
}

export async function deleteClubRecipe(caliberId) {
  const existing = await fetchClubRecipe(caliberId)
  if (!existing) throw new Error('Receita não encontrada para este calibre.')
  const { data: batches } = await sb()
    .from(T.club_production_batches)
    .select('id')
    .eq('caliber_id', caliberId)
    .limit(1)
  if (batches?.length) {
    throw new Error(
      'Não é possível remover a receita: já existem lotes de produção para este calibre.',
    )
  }
  const { error } = await sb().from(T.club_recipes).delete().eq('caliber_id', caliberId)
  if (error) throw new Error(formatSupabaseError(error))
}

export async function saveClubRecipe(caliberId, body) {
  const { data: cal, error: ce } = await sb()
    .from(T.club_calibers)
    .select('id')
    .eq('id', caliberId)
    .maybeSingle()
  if (ce) throw new Error(formatSupabaseError(ce))
  if (!cal) throw new Error('Calibre não encontrado.')

  const b = body || {}
  const polvoraItemId = b.polvora_item_id
  const espoletaItemId = b.espoleta_item_id
  const pontaItemId = b.ponta_item_id
  const municaoOutId = b.municao_output_item_id || null
  const grains = b.grains_polvora_por_municao
  const espPer = b.espoletas_por_municao != null ? b.espoletas_por_municao : 1
  const pontaPer = b.pontas_por_municao != null ? b.pontas_por_municao : 1

  if (!polvoraItemId || !espoletaItemId || !pontaItemId) {
    throw new Error('polvora_item_id, espoleta_item_id e ponta_item_id são obrigatórios.')
  }
  await assertItemKind(polvoraItemId, 'polvora')
  await assertItemKind(espoletaItemId, 'espoleta')
  await assertItemKind(pontaItemId, 'ponta')
  if (municaoOutId) await assertItemKind(municaoOutId, 'municao')

  const g = Number(grains)
  if (!Number.isFinite(g) || g <= 0) {
    throw new Error('grains_polvora_por_municao deve ser > 0.')
  }
  const e1 = Number(espPer)
  const e2 = Number(pontaPer)
  if (!Number.isFinite(e1) || e1 <= 0 || !Number.isFinite(e2) || e2 <= 0) {
    throw new Error('Quantidades por munição devem ser > 0.')
  }

  const now = new Date().toISOString()
  const row = {
    caliber_id: caliberId,
    polvora_item_id: polvoraItemId,
    espoleta_item_id: espoletaItemId,
    ponta_item_id: pontaItemId,
    municao_output_item_id: municaoOutId,
    grains_polvora_por_municao: g,
    espoletas_por_municao: e1,
    pontas_por_municao: e2,
    updated_at: now,
  }
  const { data, error } = await sb()
    .from(T.club_recipes)
    .upsert(row, { onConflict: 'caliber_id' })
    .select(
      'caliber_id, polvora_item_id, espoleta_item_id, ponta_item_id, municao_output_item_id, grains_polvora_por_municao, espoletas_por_municao, pontas_por_municao, updated_at',
    )
    .single()
  if (error) throw new Error(formatSupabaseError(error))
  return data
}

// ——— Produção ———

export async function postClubProduction(body) {
  const caliberId = body?.caliber_id
  const nRaw = body?.municoes_produzidas
  if (!caliberId) throw new Error('caliber_id é obrigatório.')
  const n = Math.floor(Number(nRaw))
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('municoes_produzidas deve ser um inteiro positivo.')
  }

  const r = await fetchClubRecipe(caliberId)
  if (!r) {
    throw new Error('Cadastre a receita deste calibre antes de registrar produção.')
  }

  const needPolvora = n * Number(r.grains_polvora_por_municao)
  const needEsp = n * Number(r.espoletas_por_municao)
  const needPonta = n * Number(r.pontas_por_municao)

  const allMovs = await fetchAllMovements()
  const byItem = movementsByItem(allMovs)
  if (stockForItem(r.polvora_item_id, byItem) + 1e-9 < needPolvora) {
    throw new Error('Pólvora insuficiente no estoque do clube.')
  }
  if (stockForItem(r.espoleta_item_id, byItem) + 1e-9 < needEsp) {
    throw new Error('Espoletas insuficientes no estoque do clube.')
  }
  if (stockForItem(r.ponta_item_id, byItem) + 1e-9 < needPonta) {
    throw new Error('Pontas insuficientes no estoque do clube.')
  }

  const batchId = crypto.randomUUID()
  const when =
    body.date != null && String(body.date).trim()
      ? String(body.date).trim()
      : new Date().toISOString()
  const note = body.notes != null ? String(body.notes).trim() || null : null

  const { error: batchErr } = await sb().from(T.club_production_batches).insert({
    id: batchId,
    caliber_id: caliberId,
    municoes_produzidas: n,
    date: when,
    notes: note,
  })
  if (batchErr) throw new Error(formatSupabaseError(batchErr))

  const insumoNote = `Produção ${n} munições (lote ${batchId.slice(0, 8)})`
  const outs = [
    { item_id: r.polvora_item_id, quantity: needPolvora },
    { item_id: r.espoleta_item_id, quantity: needEsp },
    { item_id: r.ponta_item_id, quantity: needPonta },
  ]
  try {
    for (const o of outs) {
      await insertMovement({
        item_id: o.item_id,
        type: 'saida',
        quantity: o.quantity,
        date: when,
        notes: insumoNote,
        production_batch_id: batchId,
      })
    }
    if (r.municao_output_item_id) {
      await insertMovement({
        item_id: r.municao_output_item_id,
        type: 'entrada',
        quantity: n,
        date: when,
        notes: insumoNote,
        production_batch_id: batchId,
      })
    }
  } catch (e) {
    await sb().from(T.club_stock_movements).delete().eq('production_batch_id', batchId)
    await sb().from(T.club_production_batches).delete().eq('id', batchId)
    throw e
  }

  const { data: batch } = await sb()
    .from(T.club_production_batches)
    .select('id, caliber_id, municoes_produzidas, date, notes, created_at')
    .eq('id', batchId)
    .single()

  const afterMovs = await fetchAllMovements()
  const afterByItem = movementsByItem(afterMovs)

  return {
    batch,
    consumo: {
      polvora_grains: needPolvora,
      espoletas: needEsp,
      pontas: needPonta,
    },
    saldos_apos: {
      polvora: stockForItem(r.polvora_item_id, afterByItem),
      espoleta: stockForItem(r.espoleta_item_id, afterByItem),
      ponta: stockForItem(r.ponta_item_id, afterByItem),
      municao: r.municao_output_item_id
        ? stockForItem(r.municao_output_item_id, afterByItem)
        : null,
    },
  }
}

export async function fetchClubProductionBatches(limit = 50) {
  const lim = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 100))
  const { data, error } = await sb()
    .from(T.club_production_batches)
    .select('id, caliber_id, municoes_produzidas, date, notes, created_at')
    .order('date', { ascending: false })
    .limit(lim)
  if (error) throw new Error(formatSupabaseError(error))
  return data ?? []
}

export async function updateClubProductionBatch(id, body) {
  const { data: batch, error: be } = await sb()
    .from(T.club_production_batches)
    .select('id, caliber_id, municoes_produzidas, date, notes, created_at')
    .eq('id', id)
    .maybeSingle()
  if (be) throw new Error(formatSupabaseError(be))
  if (!batch) throw new Error('Lote não encontrado.')

  const nextQtyRaw =
    body?.municoes_produzidas != null ? body.municoes_produzidas : batch.municoes_produzidas
  const nextQty = Math.floor(Number(nextQtyRaw))
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    throw new Error('municoes_produzidas deve ser um inteiro positivo.')
  }
  const nextDate =
    body?.date != null && String(body.date).trim()
      ? String(body.date).trim()
      : batch.date
  const nextNotes =
    body?.notes !== undefined
      ? body.notes != null
        ? String(body.notes).trim() || null
        : null
      : batch.notes

  const { data: batchMovs, error: me } = await sb()
    .from(T.club_stock_movements)
    .select('id, item_id, type, quantity, date, notes, production_batch_id')
    .eq('production_batch_id', id)
  if (me) throw new Error(formatSupabaseError(me))
  if (!batchMovs?.length) {
    throw new Error(
      'Este lote não possui movimentos de estoque vinculados para ajustar.',
    )
  }

  const oldQty = Number(batch.municoes_produzidas)
  if (!Number.isFinite(oldQty) || oldQty <= 0) {
    throw new Error('O lote atual está inválido para edição.')
  }

  const impact = batchEditImpactByItem(batchMovs, oldQty, nextQty)
  const allMovs = await fetchAllMovements()
  const byItem = movementsByItem(allMovs)

  for (const [itemId, imp] of impact.entries()) {
    const current = stockForItem(itemId, byItem)
    const nextStock = current - imp.oldSigned + imp.newSigned
    if (isNegativeStock(nextStock)) {
      throw new Error(
        'A edição deixaria um item com saldo negativo. Ajuste a quantidade do lote.',
      )
    }
  }

  const { error: updBatchErr } = await sb()
    .from(T.club_production_batches)
    .update({
      municoes_produzidas: nextQty,
      date: nextDate,
      notes: nextNotes,
    })
    .eq('id', id)
  if (updBatchErr) throw new Error(formatSupabaseError(updBatchErr))

  for (const mov of batchMovs) {
    const scaled = rescaleBatchMovement(mov, oldQty, nextQty)
    const { error: ue } = await sb()
      .from(T.club_stock_movements)
      .update({
        type: scaled.type,
        quantity: scaled.quantity,
        date: nextDate,
      })
      .eq('id', mov.id)
    if (ue) throw new Error(formatSupabaseError(ue))
  }

  const { data: updated, error: re } = await sb()
    .from(T.club_production_batches)
    .select('id, caliber_id, municoes_produzidas, date, notes, created_at')
    .eq('id', id)
    .single()
  if (re) throw new Error(formatSupabaseError(re))
  return updated
}

export async function deleteClubProductionBatch(id) {
  const { data: batch } = await sb()
    .from(T.club_production_batches)
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!batch) throw new Error('Lote não encontrado.')
  await sb().from(T.club_stock_movements).delete().eq('production_batch_id', id)
  const { error } = await sb().from(T.club_production_batches).delete().eq('id', id)
  if (error) throw new Error(formatSupabaseError(error))
}

// ——— Relatório ———

export async function fetchClubReportSummary(from, to) {
  const { fromIso, toIso, entire_history } = periodIsoBounds(from, to)

  const [items, calibers, batches, allMovs] = await Promise.all([
    fetchClubItems(),
    fetchClubCalibers(),
    (async () => {
      const { data, error } = await sb()
        .from(T.club_production_batches)
        .select('id, caliber_id, municoes_produzidas, date, notes, created_at')
      if (error) throw new Error(formatSupabaseError(error))
      return data ?? []
    })(),
    fetchAllMovements(),
  ])

  const calById = new Map(calibers.map((c) => [c.id, c]))
  const itemById = new Map(items.map((i) => [i.id, i]))

  const batchesInPeriod = batches.filter((b) => movementInPeriod(b.date, fromIso, toIso))
  const municoesProduzidasTotal = batchesInPeriod.reduce(
    (acc, b) => acc + Number(b.municoes_produzidas ?? 0),
    0,
  )

  const byCaliber = new Map()
  for (const b of batchesInPeriod) {
    const prev = byCaliber.get(b.caliber_id) ?? 0
    byCaliber.set(b.caliber_id, prev + Number(b.municoes_produzidas ?? 0))
  }
  const porCalibre = [...byCaliber.entries()]
    .map(([caliber_id, municoes]) => ({
      caliber_id,
      caliber_name: calById.get(caliber_id)?.name ?? caliber_id,
      municoes,
    }))
    .sort((a, b) =>
      String(a.caliber_name).localeCompare(String(b.caliber_name), 'pt-BR', {
        sensitivity: 'base',
      }),
    )

  const insumoKinds = new Set(['polvora', 'espoleta', 'ponta'])
  const insumoAgg = new Map()
  for (const m of allMovs) {
    if (m.type !== 'saida') continue
    const it = itemById.get(m.item_id)
    if (!it || !insumoKinds.has(it.kind)) continue
    if (!movementInPeriod(m.date, fromIso, toIso)) continue
    const prev = insumoAgg.get(m.item_id) ?? {
      item_id: m.item_id,
      name: it.name,
      kind: it.kind,
      total_saida: 0,
      saida_em_producao: 0,
      saida_manual: 0,
    }
    const q = Number(m.quantity ?? 0)
    prev.total_saida += q
    if (m.production_batch_id) prev.saida_em_producao += q
    else prev.saida_manual += q
    insumoAgg.set(m.item_id, prev)
  }
  const insumoSaidas = [...insumoAgg.values()].sort((a, b) => {
    const k = String(a.kind).localeCompare(String(b.kind))
    if (k !== 0) return k
    return String(a.name).localeCompare(String(b.name), 'pt-BR', { sensitivity: 'base' })
  })

  let municaoEntradaProducao = 0
  let municaoSaidaDistribuicao = 0
  for (const m of allMovs) {
    const it = itemById.get(m.item_id)
    if (!it || it.kind !== 'municao') continue
    if (!movementInPeriod(m.date, fromIso, toIso)) continue
    if (m.type === 'entrada' && m.production_batch_id) {
      municaoEntradaProducao += Number(m.quantity ?? 0)
    }
    if (m.type === 'saida') {
      municaoSaidaDistribuicao += Number(m.quantity ?? 0)
    }
  }

  const byItem = movementsByItem(allMovs)
  const estoqueAtual = items.map((it) => ({
    id: it.id,
    name: it.name,
    kind: it.kind,
    stock: stockForItem(it.id, byItem),
  }))

  return {
    period: {
      entire_history,
      from: fromIso,
      to: toIso,
    },
    producao: {
      municoes_total: municoesProduzidasTotal,
      por_calibre: porCalibre,
    },
    insumos_saidas_no_periodo: insumoSaidas,
    municao_no_periodo: {
      entrada_por_producao: municaoEntradaProducao,
      saida_distribuicao: municaoSaidaDistribuicao,
    },
    estoque_atual: estoqueAtual,
  }
}