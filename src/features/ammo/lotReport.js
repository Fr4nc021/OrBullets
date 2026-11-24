import { PRODUCT_TYPE_KEYS, productTypeLabel } from './productTypes.js'

/**
 * Monta o relatório de estoque por lote: tipo → calibre → produto → lotes.
 * A soma dos lotes de cada produto é o estoque atual do produto.
 *
 * @param {object} p
 * @param {Array<{ ammo_type_id: string, ammo_name: string, caliber: string, product_type?: string, stock: number }>} p.stockRows
 * @param {Map<string, Array<{ lot_number: string | null, stock: number }>>} p.lotIndex
 * @param {string} [p.productType] — filtro opcional
 * @param {boolean} [p.hideZero] — esconde produtos com estoque 0
 */
export function buildLotReport({ stockRows, lotIndex, productType, hideZero = true }) {
  const products = (stockRows ?? [])
    .filter((r) => !productType || (r.product_type ?? 'municao') === productType)
    .filter((r) => !hideZero || Number(r.stock) !== 0)
    .map((r) => {
      const lots = (lotIndex.get(String(r.ammo_type_id)) ?? []).filter(
        (l) => l.stock !== 0,
      )
      const semLote = lots.find((l) => l.lot_number == null)?.stock ?? 0
      return {
        ammo_type_id: r.ammo_type_id,
        ammo_name: r.ammo_name,
        caliber: r.caliber ?? '—',
        product_type: r.product_type ?? 'municao',
        stock: Math.round(Number(r.stock) || 0),
        lots,
        semLote,
      }
    })

  const groups = []
  for (const typeKey of PRODUCT_TYPE_KEYS) {
    const ofType = products.filter((p) => p.product_type === typeKey)
    if (!ofType.length) continue
    const byCaliber = new Map()
    for (const p of ofType) {
      if (!byCaliber.has(p.caliber)) byCaliber.set(p.caliber, [])
      byCaliber.get(p.caliber).push(p)
    }
    const calibers = [...byCaliber.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
      .map(([caliber, list]) => ({
        caliber,
        products: list.sort((a, b) =>
          a.ammo_name.localeCompare(b.ammo_name, 'pt-BR', { sensitivity: 'base' }),
        ),
      }))
    groups.push({ typeKey, typeLabel: productTypeLabel(typeKey), calibers })
  }

  const totalStock = products.reduce((s, p) => s + p.stock, 0)
  const totalSemLote = products.reduce((s, p) => s + Math.max(0, p.semLote), 0)
  const pendingProducts = products.filter((p) => p.semLote > 0).length
  const lotCount = products.reduce(
    (s, p) => s + p.lots.filter((l) => l.lot_number != null).length,
    0,
  )
  return { groups, totalStock, totalSemLote, pendingProducts, lotCount, productCount: products.length }
}
