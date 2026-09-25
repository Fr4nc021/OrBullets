import {
  PRODUCT_TYPE_KEYS,
  productTypeLabel,
} from './productTypes.js'

/**
 * Agrupa estoque em hierarquia: tipo → calibre → itens.
 * @param {Array<{ id: string, name: string, product_type?: string }>} calibers
 * @param {Array<{ ammo_type_id: string, ammo_name: string, caliber?: string, product_type?: string, stock?: number }>} stockRows
 * @returns {Array<{ typeKey: string, typeLabel: string, caliberSections: Array<{ key: string, title: string, rows: typeof stockRows }> }>}
 */
export function buildProductHierarchySections(calibers, stockRows) {
  const caliberMetaByNameType = new Map()
  for (const c of calibers) {
    const pt = c.product_type ?? 'municao'
    caliberMetaByNameType.set(`${pt}::${c.name}`, { id: c.id, name: c.name, product_type: pt })
  }

  const byTypeThenCaliber = new Map()
  for (const row of stockRows) {
    const pt = row.product_type ?? 'municao'
    const calName = row.caliber ?? '—'
    const key = `${pt}::${calName}`
    if (!byTypeThenCaliber.has(key)) byTypeThenCaliber.set(key, [])
    byTypeThenCaliber.get(key).push(row)
  }
  for (const list of byTypeThenCaliber.values()) {
    list.sort((a, b) =>
      a.ammo_name.localeCompare(b.ammo_name, 'pt-BR', { sensitivity: 'base' }),
    )
  }

  const typesPresent = new Set()
  for (const c of calibers) {
    typesPresent.add(c.product_type ?? 'municao')
  }
  for (const row of stockRows) {
    typesPresent.add(row.product_type ?? 'municao')
  }

  const typeOrder = [
    ...PRODUCT_TYPE_KEYS.filter((k) => typesPresent.has(k)),
    ...[...typesPresent].filter((k) => !PRODUCT_TYPE_KEYS.includes(k)).sort(),
  ]

  const sections = []
  for (const typeKey of typeOrder) {
    const calNamesForType = new Set()
    for (const c of calibers) {
      if ((c.product_type ?? 'municao') === typeKey) calNamesForType.add(c.name)
    }
    for (const row of stockRows) {
      if ((row.product_type ?? 'municao') === typeKey) {
        calNamesForType.add(row.caliber ?? '—')
      }
    }

    const sortedCalNames = [...calNamesForType].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    )

    const caliberSections = sortedCalNames.map((calName) => {
      const mapKey = `${typeKey}::${calName}`
      const meta = caliberMetaByNameType.get(mapKey)
      const key = meta?.id ?? `extra-${typeKey}-${calName}`
      const rows = byTypeThenCaliber.get(mapKey) ?? []
      return { key: String(key), title: calName, rows }
    })

    sections.push({
      typeKey,
      typeLabel: productTypeLabel(typeKey),
      caliberSections,
    })
  }

  return sections
}
