import {
  PRODUCT_TYPE_KEYS,
  productTypeLabel,
} from './productTypes.js'

/**
 * Início do dia local (00:00:00) a partir de YYYY-MM-DD.
 */
export function parseLocalDateStart(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return NaN
  const [y, m, d] = isoDateStr.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/**
 * Fim do dia local (23:59:59.999) a partir de YYYY-MM-DD.
 */
export function parseLocalDateEnd(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return NaN
  const [y, m, d] = isoDateStr.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

function movementTimeMs(dateValue) {
  const t = new Date(dateValue).getTime()
  return Number.isFinite(t) ? t : NaN
}

const KEY_SEP = '\u001f'

function stockKey(productType, caliber) {
  const pt = productType ?? 'municao'
  const c = caliber ?? '—'
  return `${pt}${KEY_SEP}${c}`
}

function parseStockKey(k) {
  const i = k.indexOf(KEY_SEP)
  if (i === -1) return { productType: 'municao', caliber: '—' }
  return { productType: k.slice(0, i), caliber: k.slice(i + KEY_SEP.length) }
}

function aggregateTypesToKey(byType, typeMetaByAmmoId) {
  const byKey = new Map()
  for (const [ammoId, qty] of byType) {
    const meta = typeMetaByAmmoId.get(ammoId)
    const k = stockKey(meta?.product_type, meta?.caliber)
    byKey.set(k, (byKey.get(k) ?? 0) + qty)
  }
  return byKey
}

/**
 * @param {object} p
 * @param {Array<{ ammo_type_id: string, quantity: number, type: string, date: string }>} p.movements
 * @param {Map<string, { caliber: string, product_type?: string }>} p.typeMetaByAmmoId
 * @param {Array<{ caliber?: string, stock?: number, product_type?: string }>} p.currentStockRows — view ammo_stock
 * @param {number} p.periodStartMs
 * @param {number} p.periodEndMs
 * @param {string | null} p.productTypeFilter — 'municao' | 'cartucho' | 'insumo' ou null
 * @param {string | null} p.caliberNameFilter — nome exato do calibre ou null para todos (respeita o filtro de tipo)
 */
export function computeStockReportByCaliber({
  movements,
  typeMetaByAmmoId,
  currentStockRows,
  periodStartMs,
  periodEndMs,
  productTypeFilter,
  caliberNameFilter,
}) {
  const currentByKey = new Map()
  for (const r of currentStockRows) {
    const k = stockKey(r.product_type, r.caliber)
    const n = Number(r.stock)
    const add = Number.isFinite(n) ? n : 0
    currentByKey.set(k, (currentByKey.get(k) ?? 0) + add)
  }

  const startByType = new Map()
  const entradaByKey = new Map()
  const saidaByKey = new Map()

  for (const m of movements) {
    const t = movementTimeMs(m.date)
    if (!Number.isFinite(t)) continue
    const q = Number(m.quantity)
    if (!Number.isFinite(q)) continue
    const ammoId = m.ammo_type_id
    const meta = typeMetaByAmmoId.get(ammoId)
    const k = stockKey(meta?.product_type, meta?.caliber)

    if (t < periodStartMs) {
      const delta = m.type === 'entrada' ? q : -q
      startByType.set(ammoId, (startByType.get(ammoId) ?? 0) + delta)
    } else if (t <= periodEndMs) {
      if (m.type === 'entrada') {
        entradaByKey.set(k, (entradaByKey.get(k) ?? 0) + q)
      } else if (m.type === 'saida') {
        saidaByKey.set(k, (saidaByKey.get(k) ?? 0) + q)
      }
    }
  }

  const startByKey = aggregateTypesToKey(startByType, typeMetaByAmmoId)

  const allKeys = new Set([
    ...startByKey.keys(),
    ...entradaByKey.keys(),
    ...saidaByKey.keys(),
    ...currentByKey.keys(),
  ])

  const sorted = [...allKeys].sort((a, b) => {
    const pa = parseStockKey(a)
    const pb = parseStockKey(b)
    const tl = productTypeLabel(pa.productType).localeCompare(
      productTypeLabel(pb.productType),
      'pt-BR',
    )
    if (tl !== 0) return tl
    return pa.caliber.localeCompare(pb.caliber, 'pt-BR', { sensitivity: 'base' })
  })

  let reportRows = sorted.map((k) => {
    const { productType: pt, caliber: cal } = parseStockKey(k)
    const startStock = startByKey.get(k) ?? 0
    const periodEntrada = entradaByKey.get(k) ?? 0
    const periodSaida = saidaByKey.get(k) ?? 0
    const currentStock = currentByKey.get(k) ?? 0
    const computedEnd = startStock + periodEntrada - periodSaida
    return {
      productType: pt,
      productTypeLabel: productTypeLabel(pt),
      caliber: cal,
      startStock,
      periodEntrada,
      periodSaida,
      currentStock,
      computedEnd,
    }
  })

  if (productTypeFilter) {
    reportRows = reportRows.filter((r) => r.productType === productTypeFilter)
  }

  if (caliberNameFilter) {
    const cal = caliberNameFilter.trim()
    reportRows = reportRows.filter((r) => r.caliber === cal)
    if (reportRows.length === 0 && productTypeFilter) {
      const rowKey = stockKey(productTypeFilter, cal)
      const startStock = startByKey.get(rowKey) ?? 0
      const periodEntrada = entradaByKey.get(rowKey) ?? 0
      const periodSaida = saidaByKey.get(rowKey) ?? 0
      const currentStock = currentByKey.get(rowKey) ?? 0
      reportRows = [
        {
          productType: productTypeFilter,
          productTypeLabel: productTypeLabel(productTypeFilter),
          caliber: cal,
          startStock,
          periodEntrada,
          periodSaida,
          currentStock,
          computedEnd: startStock + periodEntrada - periodSaida,
        },
      ]
    }
  }

  const totals = reportRows.reduce(
    (acc, r) => ({
      startStock: acc.startStock + r.startStock,
      periodEntrada: acc.periodEntrada + r.periodEntrada,
      periodSaida: acc.periodSaida + r.periodSaida,
      currentStock: acc.currentStock + r.currentStock,
      computedEnd: acc.computedEnd + r.computedEnd,
    }),
    {
      startStock: 0,
      periodEntrada: 0,
      periodSaida: 0,
      currentStock: 0,
      computedEnd: 0,
    },
  )

  return { rows: reportRows, totals }
}

function sumRowMetrics(rows) {
  return rows.reduce(
    (acc, r) => ({
      startStock: acc.startStock + r.startStock,
      periodEntrada: acc.periodEntrada + r.periodEntrada,
      periodSaida: acc.periodSaida + r.periodSaida,
      currentStock: acc.currentStock + r.currentStock,
      computedEnd: acc.computedEnd + r.computedEnd,
    }),
    {
      startStock: 0,
      periodEntrada: 0,
      periodSaida: 0,
      currentStock: 0,
      computedEnd: 0,
    },
  )
}

/**
 * Relatório hierárquico: tipo → calibre → produtos (métricas por item).
 * @param {object} p
 * @param {Array<{ id: string, ammo_name: string, caliber: string, product_type?: string }>} p.ammoOptions
 * @param {Array<{ ammo_type_id: string, stock?: number }>} p.currentStockRows
 */
export function computeStockReportHierarchy({
  movements,
  ammoOptions,
  currentStockRows,
  periodStartMs,
  periodEndMs,
  productTypeFilter,
  caliberNameFilter,
}) {
  const currentByAmmo = new Map()
  for (const r of currentStockRows) {
    const id = r.ammo_type_id
    const n = Number(r.stock)
    const add = Number.isFinite(n) ? n : 0
    currentByAmmo.set(id, (currentByAmmo.get(id) ?? 0) + add)
  }

  const startByAmmo = new Map()
  const entradaByAmmo = new Map()
  const saidaByAmmo = new Map()

  for (const m of movements) {
    const t = movementTimeMs(m.date)
    if (!Number.isFinite(t)) continue
    const q = Number(m.quantity)
    if (!Number.isFinite(q)) continue
    const ammoId = m.ammo_type_id

    if (t < periodStartMs) {
      const delta = m.type === 'entrada' ? q : -q
      startByAmmo.set(ammoId, (startByAmmo.get(ammoId) ?? 0) + delta)
    } else if (t <= periodEndMs) {
      if (m.type === 'entrada') {
        entradaByAmmo.set(ammoId, (entradaByAmmo.get(ammoId) ?? 0) + q)
      } else if (m.type === 'saida') {
        saidaByAmmo.set(ammoId, (saidaByAmmo.get(ammoId) ?? 0) + q)
      }
    }
  }

  let flatRows = (ammoOptions ?? []).map((o) => {
    const id = o.id
    const pt = o.product_type ?? 'municao'
    const startStock = startByAmmo.get(id) ?? 0
    const periodEntrada = entradaByAmmo.get(id) ?? 0
    const periodSaida = saidaByAmmo.get(id) ?? 0
    const currentStock = currentByAmmo.get(id) ?? 0
    const computedEnd = startStock + periodEntrada - periodSaida
    return {
      ammoTypeId: id,
      productType: pt,
      productTypeLabel: productTypeLabel(pt),
      caliber: o.caliber ?? '—',
      nome: o.ammo_name ?? '—',
      startStock,
      periodEntrada,
      periodSaida,
      currentStock,
      computedEnd,
    }
  })

  if (productTypeFilter) {
    flatRows = flatRows.filter((r) => r.productType === productTypeFilter)
  }

  if (caliberNameFilter) {
    const cal = caliberNameFilter.trim()
    flatRows = flatRows.filter((r) => r.caliber === cal)
  }

  const typesPresent = new Set(flatRows.map((r) => r.productType))
  const typeOrder = [
    ...PRODUCT_TYPE_KEYS.filter((k) => typesPresent.has(k)),
    ...[...typesPresent].filter((k) => !PRODUCT_TYPE_KEYS.includes(k)).sort(),
  ]

  const groups = []
  for (const typeKey of typeOrder) {
    const typeRows = flatRows.filter((r) => r.productType === typeKey)
    if (typeRows.length === 0) continue

    const caliberNames = [...new Set(typeRows.map((r) => r.caliber))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    )

    const caliberGroups = caliberNames.map((calName) => {
      const products = typeRows
        .filter((r) => r.caliber === calName)
        .sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
        )
      return {
        caliberName: calName,
        products,
        totals: sumRowMetrics(products),
      }
    })

    groups.push({
      typeKey,
      typeLabel: productTypeLabel(typeKey),
      caliberGroups,
      typeTotals: sumRowMetrics(typeRows),
    })
  }

  const grandTotals = sumRowMetrics(flatRows)

  return { groups, flatRows, grandTotals }
}
