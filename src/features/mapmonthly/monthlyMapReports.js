import {
  fetchAmmoMovementsForReport,
  fetchAmmoStock,
  fetchAmmoTypeOptions,
} from '../ammo/ammoApi.js'
import {
  computeStockReportHierarchy,
  parseLocalDateEnd,
  parseLocalDateStart,
} from '../ammo/ammoStockReport.js'
import { getStockReportHierarchyPdfBlob } from '../ammo/stockReportPdf.js'
import {
  fetchCalibers,
  fetchWeaponBrands,
  fetchWeaponTypes,
  fetchWeapons,
} from '../weapons/weaponsApi.js'
import {
  buildWeaponReportRows,
  isShopStockOwner,
} from '../weapons/weaponsReportHelpers.js'
import { productTypeLabel } from '../ammo/productTypes.js'
import { getWeaponsReportPdfBlob } from '../weapons/weaponsReportPdf.js'
import { formatMonthLabelPt, getFullMonthRange } from './monthlyMapMonth.js'

function buildNameById(rows) {
  const map = {}
  for (const r of rows) map[r.id] = r.name
  return map
}

/** Mesmo critério da página Armas para exibir calibre com tipo. */
function buildCaliberDisplayById(rows) {
  const map = {}
  for (const r of rows) {
    map[r.id] =
      r.product_type != null
        ? `${r.name} (${productTypeLabel(r.product_type)})`
        : r.name
  }
  return map
}

/**
 * Mesmo relatório de estoque (munições) da aba Estoque, período = mês civil inteiro.
 * @param {string} monthKey — YYYY-MM
 */
export async function generateEstoqueMonthlyPdf(monthKey) {
  const { from, to } = getFullMonthRange(monthKey)
  const startMs = parseLocalDateStart(from)
  const endMs = parseLocalDateEnd(to)
  const [movements, ammoOptions, stockRows] = await Promise.all([
    fetchAmmoMovementsForReport(),
    fetchAmmoTypeOptions(),
    fetchAmmoStock(),
  ])
  const reportData = computeStockReportHierarchy({
    movements,
    ammoOptions,
    currentStockRows: stockRows,
    periodStartMs: startMs,
    periodEndMs: endMs,
    productTypeFilter: null,
    caliberNameFilter: null,
  })
  const fn = `mapa-estoque-${monthKey}.pdf`
  return getStockReportHierarchyPdfBlob(
    {
      reportData,
      periodFrom: from,
      periodTo: to,
      filterDescription: `Mapa mensal — ${formatMonthLabelPt(monthKey)}`,
    },
    fn,
  )
}

/**
 * Mapa de armas do mês: estoque (loja + dono fixo) e retiradas no mês civil.
 * @param {string} monthKey
 */
export async function generateArmasMonthlyPdf(monthKey) {
  const { from, to } = getFullMonthRange(monthKey)
  const startMs = parseLocalDateStart(from)
  const endMs = parseLocalDateEnd(to)
  const [weapons, calibers, weaponTypes, brands] = await Promise.all([
    fetchWeapons(),
    fetchCalibers({ productTypes: ['municao', 'cartucho'] }),
    fetchWeaponTypes(),
    fetchWeaponBrands(),
  ])
  const caliberNameById = buildCaliberDisplayById(calibers)
  const typeNameById = buildNameById(weaponTypes)
  const brandNameById = buildNameById(brands)
  const reportRowsAll = buildWeaponReportRows(
    weapons,
    caliberNameById,
    typeNameById,
    brandNameById,
  )
  const inStockShopRows = reportRowsAll.filter(
    (r) => r.status === 'em_estoque' && isShopStockOwner(r.owner),
  )
  const inStockFixedOwnerRows = reportRowsAll.filter(
    (r) => r.status === 'em_estoque' && !isShopStockOwner(r.owner),
  )
  const soldRows = reportRowsAll.filter((r) => {
    if (r.status !== 'retirada') return false
    if (!Number.isFinite(r.withdrawalMs)) return false
    return r.withdrawalMs >= startMs && r.withdrawalMs <= endMs
  })
  const fn = `mapa-armas-${monthKey}.pdf`
  return getWeaponsReportPdfBlob(
    {
      inStockShopRows,
      inStockFixedOwnerRows,
      soldRows,
      periodFrom: from,
      periodTo: to,
    },
    fn,
  )
}
