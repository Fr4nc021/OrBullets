/**
 * Ordem de aplicação no destino (FKs). Upserts: pais antes dos filhos.
 * Deletes: filhos antes dos pais.
 */
const SHOP_UPSERT_ORDER = [
  'calibers',
  'weapon_types',
  'weapon_brands',
  'ammo_types',
  'weapons',
  'ammo_movements',
]

const CLUB_UPSERT_ORDER = [
  'club_calibers',
  'club_items',
  'club_production_batches',
  'club_recipes',
  'club_stock_movements',
]

const SHOP_DELETE_ORDER = [...SHOP_UPSERT_ORDER].reverse()
const CLUB_DELETE_ORDER = [...CLUB_UPSERT_ORDER].reverse()

function orderIndex(table, orderedList) {
  const i = orderedList.indexOf(table)
  return i === -1 ? 999 : i
}

/**
 * @param {Array<{ entity_table: string, op: string, id: number }>} rows
 * @param {'shop' | 'club'} scope
 */
function sortOutboxRows(rows, scope) {
  const upsertOrder = scope === 'club' ? CLUB_UPSERT_ORDER : SHOP_UPSERT_ORDER
  const deleteOrder = scope === 'club' ? CLUB_DELETE_ORDER : SHOP_DELETE_ORDER
  return [...rows].sort((a, b) => {
    const da = a.op === 'DELETE'
    const db = b.op === 'DELETE'
    if (da !== db) return da ? -1 : 1
    const ord = da ? deleteOrder : upsertOrder
    const ia = orderIndex(a.entity_table, ord)
    const ib = orderIndex(b.entity_table, ord)
    if (ia !== ib) return ia - ib
    return a.id - b.id
  })
}

module.exports = {
  sortOutboxRows,
  SHOP_UPSERT_ORDER,
  CLUB_UPSERT_ORDER,
}
