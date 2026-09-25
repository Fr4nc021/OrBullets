import { supabase as supabaseClient } from '../supabase.js'
import { ORB_TABLES as T } from '../orbTables.js'

function supabase() {
  if (!supabaseClient) {
    throw new Error(
      'Supabase não configurado. Use o modo local (VITE_USE_LOCAL_API=true + npm run api:local).',
    )
  }
  return supabaseClient
}

export function formatSupabaseError(err) {
  if (!err) return 'Erro desconhecido.'
  const msg = err.message ?? String(err)
  const parts = [msg]
  if (err.details) parts.push(err.details)
  if (err.hint) parts.push(err.hint)
  return parts.filter(Boolean).join(' — ')
}

export async function repoFetchCalibers(productType) {
  let q = supabase()
    .from(T.calibers)
    .select('id, name, product_type')
    .order('name', { ascending: true })
  if (productType) {
    q = q.eq('product_type', productType)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  rows.sort((a, b) => {
    const t = String(a.product_type ?? 'municao').localeCompare(
      String(b.product_type ?? 'municao'),
    )
    if (t !== 0) return t
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  })
  return rows
}

async function fetchAmmoStockWithProductTypeJoin(rows) {
  const [{ data: types, error: et }, { data: calRows, error: ec }] =
    await Promise.all([
      supabase.from(T.ammo_types).select('id, caliber_id'),
      supabase.from(T.calibers).select('id, product_type'),
    ])
  if (et) throw new Error(formatSupabaseError(et))
  if (ec) throw new Error(formatSupabaseError(ec))

  const ptByCaliberId = new Map(
    (calRows ?? []).map((c) => [c.id, c.product_type ?? 'municao']),
  )
  const caliberIdByAmmoTypeId = new Map(
    (types ?? []).map((t) => [t.id, t.caliber_id]),
  )

  return (rows ?? []).map((r) => {
    const calId = caliberIdByAmmoTypeId.get(r.ammo_type_id)
    const pt = calId ? ptByCaliberId.get(calId) : undefined
    return { ...r, product_type: pt ?? 'municao' }
  })
}

export async function repoFetchAmmoStock() {
  const res = await supabase
    .from(T.ammo_stock)
    .select('ammo_type_id, ammo_name, caliber, product_type, stock')
    .order('ammo_name', { ascending: true })

  if (!res.error) return res.data ?? []

  const msg = res.error.message ?? ''
  const missingColumn =
    res.error.code === 'PGRST204' ||
    /product_type|schema cache|does not exist/i.test(msg)

  if (!missingColumn) throw new Error(formatSupabaseError(res.error))

  const fallback = await supabase
    .from(T.ammo_stock)
    .select('ammo_type_id, ammo_name, caliber, stock')
    .order('ammo_name', { ascending: true })

  if (fallback.error) throw new Error(formatSupabaseError(fallback.error))

  return fetchAmmoStockWithProductTypeJoin(fallback.data)
}

const MOVEMENTS_PAGE = 1000

export async function repoFetchAmmoMovementsForReport() {
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(T.ammo_movements)
      .select('ammo_type_id, quantity, type, date')
      .order('date', { ascending: true })
      .range(from, from + MOVEMENTS_PAGE - 1)

    if (error) throw new Error(formatSupabaseError(error))
    if (!data?.length) break
    all.push(...data)
    if (data.length < MOVEMENTS_PAGE) break
    from += MOVEMENTS_PAGE
  }
  return all
}

export async function repoFetchAmmoTypesWithCalibers() {
  const { data: types, error: errTypes } = await supabase
    .from(T.ammo_types)
    .select('id, name, caliber_id, created_at')
    .order('name', { ascending: true })

  if (errTypes) {
    const msg = errTypes.message ?? ''
    if (
      errTypes.code === 'PGRST204' ||
      /created_at|schema cache|does not exist/i.test(msg)
    ) {
      const retry = await supabase
        .from(T.ammo_types)
        .select('id, name, caliber_id')
        .order('name', { ascending: true })
      if (retry.error) throw retry.error
      return { ammoTypes: retry.data ?? [], hasCreatedAt: false }
    }
    throw errTypes
  }

  const { data: calibers, error: errCalibers } = await supabase
    .from(T.calibers)
    .select('id, name, product_type')

  if (errCalibers) throw errCalibers

  const calMap = new Map((calibers ?? []).map((c) => [c.id, c]))

  const merged = (types ?? []).map((t) => {
    const cal = calMap.get(t.caliber_id)
    const caliberName = cal?.name ?? '—'
    const productType = cal?.product_type ?? 'municao'
    return {
      id: t.id,
      ammo_name: t.name,
      caliber: caliberName,
      product_type: productType,
      label: `${t.name} — ${caliberName}`,
      created_at: t.created_at ?? null,
    }
  })

  return { ammoTypes: merged, hasCreatedAt: true }
}

export async function repoInsertCaliber({ name, productType }) {
  const { data, error } = await supabase
    .from(T.calibers)
    .insert({ name, product_type: productType })
    .select('id, name, product_type')
    .single()

  if (error) throw error
  return data
}

export async function repoInsertAmmoType({ caliberId, name }) {
  const { data, error } = await supabase
    .from(T.ammo_types)
    .insert({ caliber_id: caliberId, name })
    .select('id, name, caliber_id, created_at')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (
      error.code === 'PGRST204' ||
      /created_at|schema cache|does not exist/i.test(msg)
    ) {
      const retry = await supabase
        .from(T.ammo_types)
        .insert({ caliber_id: caliberId, name })
        .select('id, name, caliber_id')
        .single()
      if (retry.error) throw new Error(formatSupabaseError(retry.error))
      return { ...retry.data, created_at: null }
    }
    throw new Error(formatSupabaseError(error))
  }

  return data
}

/**
 * @param {string} ammoTypeId
 * @param {{ name: string }} patch
 */
export async function repoUpdateAmmoType(ammoTypeId, patch) {
  const trimmed = String(patch?.name ?? '').trim()
  if (!trimmed) throw new Error('Nome do produto é obrigatório.')

  const { data, error } = await supabase
    .from(T.ammo_types)
    .update({ name: trimmed })
    .eq('id', ammoTypeId)
    .select('id, name, caliber_id, created_at')
    .maybeSingle()

  if (error) throw new Error(formatSupabaseError(error))
  if (!data) throw new Error('Produto não encontrado.')
  return data
}

/**
 * Remove movimentações do produto e o registro em `ammo_types`.
 * @param {string} ammoTypeId
 */
export async function repoDeleteAmmoType(ammoTypeId) {
  const { error: movErr } = await supabase
    .from(T.ammo_movements)
    .delete()
    .eq('ammo_type_id', ammoTypeId)
  if (movErr) throw new Error(formatSupabaseError(movErr))

  const { error: typeErr, data: deleted } = await supabase
    .from(T.ammo_types)
    .delete()
    .eq('id', ammoTypeId)
    .select('id')
  if (typeErr) throw new Error(formatSupabaseError(typeErr))
  if (!deleted?.length) throw new Error('Produto não encontrado.')
}

export async function repoInsertAmmoMovement(payload) {
  const { error } = await supabase.from(T.ammo_movements).insert(payload)
  if (!error) return
  const msg = error.message ?? ''
  const unknownCol =
    error.code === 'PGRST204' ||
    /saida_group_id|nf_number|Could not find the .* column/i.test(msg)
  if (unknownCol) {
    let rest = { ...payload }
    if (
      rest.nf_number != null &&
      /nf_number|Could not find the .* column/i.test(msg)
    ) {
      const { nf_number: _n, ...withoutNf } = rest
      rest = withoutNf
    }
    if (
      rest.saida_group_id != null &&
      /saida_group_id|Could not find the .* column/i.test(msg)
    ) {
      const { saida_group_id: _g, ...withoutGroup } = rest
      rest = withoutGroup
    }
    if (Object.keys(rest).length < Object.keys(payload).length) {
      const { error: err2 } = await supabase.from(T.ammo_movements).insert(rest)
      if (!err2) return
      throw new Error(formatSupabaseError(err2))
    }
  }
  throw new Error(formatSupabaseError(error))
}

const RECENT_MOVEMENTS_MAX = 500
const MOVEMENTS_PAGE_SIZE = 1000

const MOVEMENT_SELECT_COLS = [
  'id, ammo_type_id, quantity, type, date, saida_group_id, nf_number',
  'id, ammo_type_id, quantity, type, date, saida_group_id',
  'id, ammo_type_id, quantity, type, date',
]

function isMissingMovementColumnError(error) {
  if (!error) return false
  const msg = error.message ?? ''
  return (
    error.code === 'PGRST204' ||
    /saida_group_id|nf_number|schema cache|does not exist|Could not find the .* column/i.test(
      msg,
    )
  )
}

function mapMovementRows(movements, byId) {
  return (movements ?? []).map((m) => {
    const t = byId.get(m.ammo_type_id)
    return {
      id: m.id,
      date: m.date,
      type: m.type,
      quantity: m.quantity,
      ammo_type_id: m.ammo_type_id,
      saida_group_id: m.saida_group_id ?? null,
      nf_number: m.nf_number ?? null,
      productName: t?.ammo_name ?? '—',
      caliber: t?.caliber ?? '—',
      product_type: t?.product_type ?? 'municao',
    }
  })
}

async function fetchAmmoMovementRowsPaged(buildQuery) {
  const all = []
  let offset = 0
  let colIdx = 0

  for (;;) {
    let query = buildQuery(MOVEMENT_SELECT_COLS[colIdx])
      .order('date', { ascending: false })
      .range(offset, offset + MOVEMENTS_PAGE_SIZE - 1)

    let { data, error } = await query

    if (error && isMissingMovementColumnError(error) && colIdx < MOVEMENT_SELECT_COLS.length - 1) {
      colIdx += 1
      offset = 0
      all.length = 0
      continue
    }

    if (error) throw new Error(formatSupabaseError(error))

    const chunk = data ?? []
    all.push(...chunk)
    if (chunk.length < MOVEMENTS_PAGE_SIZE) break
    offset += MOVEMENTS_PAGE_SIZE
  }

  return { movements: all }
}

/**
 * Últimas movimentações (entrada/saída) com nome do produto e calibre.
 * @param {number} [limit]
 */
export async function repoFetchRecentAmmoMovementsWithDetails(limit = 200) {
  const lim = Math.min(
    RECENT_MOVEMENTS_MAX,
    Math.max(1, Math.floor(Number(limit)) || 200),
  )
  let movements = null
  let lastErr = null
  for (const cols of MOVEMENT_SELECT_COLS) {
    const { data, error } = await supabase
      .from(T.ammo_movements)
      .select(cols)
      .order('date', { ascending: false })
      .limit(lim)
    if (!error) {
      movements = data
      lastErr = null
      break
    }
    lastErr = error
    if (!isMissingMovementColumnError(error)) break
  }
  if (lastErr) throw new Error(formatSupabaseError(lastErr))

  const { ammoTypes } = await repoFetchAmmoTypesWithCalibers()
  const byId = new Map(ammoTypes.map((t) => [t.id, t]))

  return mapMovementRows(movements, byId)
}

/**
 * Pesquisa em todo o histórico de movimentações com filtros opcionais.
 * @param {{ caliber?: string, dateFromIso?: string, dateToIso?: string, nfNumber?: string }} [filters]
 */
export async function repoSearchAmmoMovementsWithDetails(filters = {}) {
  const caliberQ = filters.caliber?.trim().toLowerCase() ?? ''
  const dateFromIso = filters.dateFromIso ?? null
  const dateToIso = filters.dateToIso ?? null
  const nfNumberQ = filters.nfNumber?.trim() ?? ''

  const { ammoTypes } = await repoFetchAmmoTypesWithCalibers()
  const byId = new Map(ammoTypes.map((t) => [t.id, t]))

  let ammoTypeIds = null
  if (caliberQ) {
    ammoTypeIds = ammoTypes
      .filter((t) => (t.caliber ?? '').toLowerCase().includes(caliberQ))
      .map((t) => t.id)
    if (ammoTypeIds.length === 0) return []
  }

  const { movements } = await fetchAmmoMovementRowsPaged((cols) => {
    let q = supabase.from(T.ammo_movements).select(cols)
    if (ammoTypeIds) q = q.in('ammo_type_id', ammoTypeIds)
    if (dateFromIso) q = q.gte('date', dateFromIso)
    if (dateToIso) q = q.lte('date', dateToIso)
    if (nfNumberQ) {
      if (!cols.includes('nf_number')) {
        return q.eq('ammo_type_id', '__nf_column_missing__')
      }
      q = q.ilike('nf_number', `%${nfNumberQ}%`)
    }
    return q
  })

  return mapMovementRows(movements, byId)
}

/**
 * @param {number|string} movementId
 */
export async function repoDeleteEntradaMovement(movementId) {
  const id = movementId
  const { data: row, error: fetchErr } = await supabase
    .from(T.ammo_movements)
    .select('id, type, ammo_type_id, quantity')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) throw new Error(formatSupabaseError(fetchErr))
  if (!row) throw new Error('Movimentação não encontrada.')
  if (row.type !== 'entrada') {
    throw new Error('Só é possível excluir entradas.')
  }

  const stockRows = await repoFetchAmmoStock()
  const s =
    stockRows.find((r) => r.ammo_type_id === row.ammo_type_id)?.stock ?? 0
  if (s - row.quantity < 0) {
    throw new Error('Saldo não permite excluir esta entrada.')
  }

  const { error } = await supabase.from(T.ammo_movements).delete().eq('id', id)
  if (error) throw new Error(formatSupabaseError(error))
}

/**
 * @param {number|string} movementId
 */
export async function repoDeleteSaidaMovement(movementId) {
  const id = movementId
  const { data: row, error: fetchErr } = await supabase
    .from(T.ammo_movements)
    .select('id, type, saida_group_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) throw new Error(formatSupabaseError(fetchErr))
  if (!row) throw new Error('Movimentação não encontrada.')
  if (row.type !== 'saida') {
    throw new Error('Só é possível excluir saídas.')
  }

  if (row.saida_group_id != null && row.saida_group_id !== '') {
    const { error } = await supabase
      .from(T.ammo_movements)
      .delete()
      .eq('type', 'saida')
      .eq('saida_group_id', row.saida_group_id)
    if (error) throw new Error(formatSupabaseError(error))
  } else {
    const { error } = await supabase.from(T.ammo_movements).delete().eq('id', id)
    if (error) throw new Error(formatSupabaseError(error))
  }
}

/**
 * Atualiza quantidade, data e/ou número da NF de uma movimentação já registrada.
 * Valida saldo ao alterar a quantidade de entrada ou saída.
 * @param {number|string} movementId
 * @param {{ quantity?: number, date?: string, nf_number?: string | null }} patch
 */
export async function repoUpdateAmmoMovement(movementId, patch) {
  const id = movementId
  const { quantity: qIn, date: dateIn, nf_number: nfIn } = patch ?? {}
  if (qIn === undefined && dateIn === undefined && nfIn === undefined) {
    throw new Error('Informe quantidade, data e/ou número da NF para alterar.')
  }

  const { data: row, error: fetchErr } = await supabase
    .from(T.ammo_movements)
    .select('id, ammo_type_id, quantity, type, date, nf_number')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) {
    if (isMissingMovementColumnError(fetchErr) && nfIn === undefined) {
      const retry = await supabase
        .from(T.ammo_movements)
        .select('id, ammo_type_id, quantity, type, date')
        .eq('id', id)
        .maybeSingle()
      if (retry.error) throw new Error(formatSupabaseError(retry.error))
      if (!retry.data) throw new Error('Movimentação não encontrada.')
      return repoUpdateAmmoMovementCore(id, retry.data, qIn, dateIn, undefined)
    }
    throw new Error(formatSupabaseError(fetchErr))
  }
  if (!row) throw new Error('Movimentação não encontrada.')
  return repoUpdateAmmoMovementCore(id, row, qIn, dateIn, nfIn)
}

async function repoUpdateAmmoMovementCore(id, row, qIn, dateIn, nfIn) {
  let newQty = row.quantity
  if (qIn !== undefined) {
    const q = Number(qIn)
    if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
      throw new Error('Quantidade deve ser um inteiro positivo.')
    }
    newQty = q
  }

  let newDate = row.date
  if (dateIn !== undefined) {
    const d = new Date(dateIn)
    if (Number.isNaN(d.getTime())) {
      throw new Error('Data inválida.')
    }
    newDate = d.toISOString()
  }

  let newNf = row.nf_number ?? null
  if (nfIn !== undefined) {
    if (row.type !== 'entrada') {
      throw new Error('Número da NF só se aplica a entradas.')
    }
    newNf =
      nfIn != null && String(nfIn).trim() !== '' ? String(nfIn).trim() : null
  }

  if (newQty !== row.quantity) {
    const stockRows = await repoFetchAmmoStock()
    const s =
      stockRows.find((r) => r.ammo_type_id === row.ammo_type_id)?.stock ?? 0
    const q1 = row.quantity
    const q2 = newQty
    if (row.type === 'entrada') {
      if (s + (q2 - q1) < 0) {
        throw new Error('Saldo não permite reduzir esta entrada.')
      }
    } else if (row.type === 'saida') {
      if (s + (q1 - q2) < 0) {
        throw new Error('Saldo insuficiente para aumentar esta saída.')
      }
    }
  }

  const updatePayload = { quantity: newQty, date: newDate }
  if (nfIn !== undefined) updatePayload.nf_number = newNf

  const { error: updErr } = await supabase
    .from(T.ammo_movements)
    .update(updatePayload)
    .eq('id', id)
  if (updErr) throw new Error(formatSupabaseError(updErr))
}
