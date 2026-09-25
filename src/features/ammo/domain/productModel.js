/**
 * Modelo de domínio do produto (camada de apresentação / API futura).
 * Compatível com linhas da view `ammo_stock` e opções de produto.
 */

/**
 * @param {object} row — linha de `ammo_stock` ou similar
 * @param {string | null} [createdAtIso]
 * @returns {{ tipo: string, calibre: string, nome: string, quantidade: number, dataCriacao: Date | null, id?: string }}
 */
export function mapStockRowToProduct(row, createdAtIso = null) {
  let dataCriacao = null
  if (createdAtIso) {
    const d = new Date(createdAtIso)
    dataCriacao = Number.isFinite(d.getTime()) ? d : null
  }
  return {
    id: row.ammo_type_id,
    tipo: row.product_type ?? 'municao',
    calibre: row.caliber ?? '',
    nome: row.ammo_name ?? '',
    quantidade: Number(row.stock) || 0,
    dataCriacao,
  }
}

/**
 * @param {object} opt — retorno de fetchProducts / fetchAmmoTypeOptions
 */
export function mapProductOptionToProduct(opt) {
  let dataCriacao = null
  if (opt.created_at) {
    const d = new Date(opt.created_at)
    dataCriacao = Number.isFinite(d.getTime()) ? d : null
  }
  return {
    id: opt.id,
    tipo: opt.product_type ?? 'municao',
    calibre: opt.caliber ?? '',
    nome: opt.ammo_name ?? '',
    quantidade: null,
    dataCriacao,
  }
}
