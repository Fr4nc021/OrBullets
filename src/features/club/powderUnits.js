/** 1 grama = 15,432358 grains (avoirdupois). O armazenamento na API continua em grains. */
export const GRAINS_PER_GRAM = 15.432358352941

export function gramsToGrains(grams) {
  return grams * GRAINS_PER_GRAM
}

export function grainsToGrams(grains) {
  return grains / GRAINS_PER_GRAM
}

export function parsePowderQty(raw) {
  const n = Number(String(raw).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function formatGrainsStock(grains) {
  if (typeof grains !== 'number' || !Number.isFinite(grains)) return String(grains)
  return grains.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function formatGramsHint(grains) {
  if (typeof grains !== 'number' || !Number.isFinite(grains)) return ''
  const g = grainsToGrams(grains)
  return g.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/** Valor a mostrar no campo consoante a unidade escolhida (entrada em grains na API). */
export function powderDisplayFromGrains(grains, unit) {
  if (!Number.isFinite(grains) || grains < 0) return ''
  if (unit === 'grams') {
    return grainsToGrams(grains).toLocaleString('pt-BR', { maximumFractionDigits: 6 })
  }
  return grains.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

/** Converte o valor do campo para grains antes de enviar à API. */
export function powderQtyToGrains(rawInput, unit) {
  const n = parsePowderQty(rawInput)
  if (!Number.isFinite(n) || n < 0) return NaN
  return unit === 'grams' ? gramsToGrains(n) : n
}
