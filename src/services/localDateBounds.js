/**
 * Limites do dia local (YYYY-MM-DD) em ISO UTC para filtros de movimentação.
 */

export function localDateStartIso(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return null
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

export function localDateEndIso(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return null
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}
