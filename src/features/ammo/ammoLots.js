/** Lotes de munição — regras usadas nas telas (o servidor valida de novo). */

/** Tipos de produto em que a entrada exige número de lote. */
export const LOT_REQUIRED_PRODUCT_TYPES = new Set(['municao', 'cartucho'])

/** Valor do select para "sem lote". */
export const NO_LOT = '__sem_lote__'

/** @param {string} productType */
export function lotRequiredFor(productType) {
  return LOT_REQUIRED_PRODUCT_TYPES.has(productType ?? 'municao')
}

/**
 * Igual ao servidor: sem espaços nas pontas, em maiúsculas. Vazio = null.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeLotNumber(raw) {
  if (raw == null) return null
  const s = String(raw).trim().replace(/\s+/g, ' ').toUpperCase()
  return s === '' ? null : s
}

/** @param {string | null | undefined} lot */
export function lotDisplay(lot) {
  return lot ? lot : 'Sem lote'
}

/**
 * @param {Array<{ ammo_type_id: string, lot_number: string | null, stock: number }>} lots
 * @returns {Map<string, Array<{ lot_number: string | null, stock: number }>>}
 *   por produto: lotes nomeados em ordem, "sem lote" no fim
 */
export function buildLotIndex(lots) {
  /** @type {Map<string, Array<{ lot_number: string | null, stock: number }>>} */
  const out = new Map()
  for (const r of lots ?? []) {
    const id = String(r.ammo_type_id)
    if (!out.has(id)) out.set(id, [])
    out.get(id).push({
      lot_number: r.lot_number ?? null,
      stock: Math.round(Number(r.stock) || 0),
    })
  }
  for (const list of out.values()) {
    list.sort((a, b) => {
      if (a.lot_number == null) return 1
      if (b.lot_number == null) return -1
      return a.lot_number.localeCompare(b.lot_number, 'pt-BR', { numeric: true })
    })
  }
  return out
}

/**
 * Saldo de um lote (null = sem lote) num índice de `buildLotIndex`.
 * @param {Map<string, Array<{ lot_number: string | null, stock: number }>>} index
 * @param {string} ammoTypeId
 * @param {string | null} lot
 */
export function lotStock(index, ammoTypeId, lot) {
  const list = index.get(String(ammoTypeId)) ?? []
  return list.find((l) => (l.lot_number ?? null) === (lot ?? null))?.stock ?? 0
}
