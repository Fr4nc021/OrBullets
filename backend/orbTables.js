/** Tabelas no Supabase (prefixo orbullets_ — o mesmo projeto também serve outros sistemas da loja). */
const ORB_TABLES = {
  calibers: 'orbullets_calibers',
  ammo_types: 'orbullets_ammo_types',
  ammo_movements: 'orbullets_ammo_movements',
  ammo_stock: 'orbullets_ammo_stock',
  weapon_types: 'orbullets_weapon_types',
  weapon_brands: 'orbullets_weapon_brands',
  weapons: 'orbullets_weapons',
  club_calibers: 'orbullets_club_calibers',
  club_items: 'orbullets_club_items',
  club_production_batches: 'orbullets_club_production_batches',
  club_stock_movements: 'orbullets_club_stock_movements',
  club_recipes: 'orbullets_club_recipes',
}

const DEFAULT_SUPABASE_URL = 'https://uofebqkmurbbpjqxhdxo.supabase.co'

function remoteTable(localName) {
  const n = ORB_TABLES[localName]
  if (!n) throw new Error(`Tabela remota OrBullets desconhecida: ${localName}`)
  return n
}

module.exports = { ORB_TABLES, DEFAULT_SUPABASE_URL, remoteTable }
