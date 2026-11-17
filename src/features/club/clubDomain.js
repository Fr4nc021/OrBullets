/** Sinal do movimento no cálculo de saldo (+ entrada, − saída). */
export function signedMovementQty(type, quantity) {
  return type === 'entrada' ? Number(quantity) : -Number(quantity)
}

/**
 * Saldo a partir de linhas de movimento (todas do item ou subset filtrado).
 * @param {Array<{ type: string, quantity: number }>} rows
 */
export function stockFromMovementRows(rows) {
  return (rows ?? []).reduce(
    (acc, m) => acc + signedMovementQty(m.type, m.quantity),
    0,
  )
}

/**
 * @param {string} [fromRaw] YYYY-MM-DD ou ISO
 * @param {string} [toRaw] YYYY-MM-DD ou ISO
 * @returns {{ fromIso: string|null, toIso: string|null, entire_history: boolean }}
 */
export function periodIsoBounds(fromRaw, toRaw) {
  let fromIso = fromRaw != null && String(fromRaw).trim() ? String(fromRaw).trim() : null
  let toIso = toRaw != null && String(toRaw).trim() ? String(toRaw).trim() : null
  if (fromIso && !fromIso.includes('T')) {
    fromIso = `${fromIso}T00:00:00.000Z`
  }
  if (toIso && !toIso.includes('T')) {
    toIso = `${toIso}T23:59:59.999Z`
  }
  return {
    fromIso,
    toIso,
    entire_history: !fromIso && !toIso,
  }
}

/** Data do movimento dentro do período (comparação por ISO string). */
export function movementInPeriod(dateIso, fromIso, toIso) {
  const d = String(dateIso ?? '')
  if (fromIso && d < fromIso) return false
  if (toIso && d > toIso) return false
  return true
}

/**
 * Novo type/quantity absoluto ao rescalar lote (N antigo → N novo).
 * @param {{ type: string, quantity: number }} mov
 * @param {number} oldN
 * @param {number} newN
 */
export function rescaleBatchMovement(mov, oldN, newN) {
  const oldSigned = signedMovementQty(mov.type, mov.quantity)
  const perUnit = oldSigned / oldN
  const newSigned = perUnit * newN
  const nextType = newSigned >= 0 ? 'entrada' : 'saida'
  const nextAbsQty = Math.abs(newSigned)
  return { type: nextType, quantity: nextAbsQty }
}

/**
 * Impacto líquido por item ao editar um lote.
 * @param {Array<{ item_id: string, type: string, quantity: number }>} batchMovs
 * @param {number} oldN
 * @param {number} newN
 * @returns {Map<string, { oldSigned: number, newSigned: number }>}
 */
export function batchEditImpactByItem(batchMovs, oldN, newN) {
  const impacted = new Map()
  for (const mov of batchMovs) {
    const oldSigned = signedMovementQty(mov.type, mov.quantity)
    const perUnit = oldSigned / oldN
    const newSigned = perUnit * newN
    const prev = impacted.get(mov.item_id) || { oldSigned: 0, newSigned: 0 }
    impacted.set(mov.item_id, {
      oldSigned: prev.oldSigned + oldSigned,
      newSigned: prev.newSigned + newSigned,
    })
  }
  return impacted
}

/**
 * Simula saldo após editar movimento (sem lote).
 * @param {number} currentStock
 * @param {{ item_id: string, type: string, quantity: number }} prev
 * @param {{ item_id: string, type: string, quantity: number }} next
 * @param {string} itemId — item cuja stock se verifica
 */
export function stockAfterMovementEdit(currentStock, prev, next, itemId) {
  let s = currentStock
  if (prev.item_id === itemId) {
    s -= signedMovementQty(prev.type, prev.quantity)
  }
  if (next.item_id === itemId) {
    s += signedMovementQty(next.type, next.quantity)
  }
  return s
}

const EPS = 1e-9

export function isNegativeStock(stock) {
  return stock < -EPS
}