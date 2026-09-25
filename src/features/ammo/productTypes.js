/** Valores persistidos em `calibers.product_type` e na view `ammo_stock`. */
export const PRODUCT_TYPE_KEYS = ['municao', 'cartucho', 'insumo']

export const PRODUCT_TYPE_LABEL = {
  municao: 'Munição',
  cartucho: 'Cartucho',
  insumo: 'Insumo',
}

export function productTypeLabel(key) {
  if (!key) return '—'
  return PRODUCT_TYPE_LABEL[key] ?? key
}

export function compareProductTypeKeys(a, b) {
  const ia = PRODUCT_TYPE_KEYS.indexOf(a)
  const ib = PRODUCT_TYPE_KEYS.indexOf(b)
  if (ia === -1 && ib === -1) return String(a).localeCompare(String(b), 'pt-BR')
  if (ia === -1) return 1
  if (ib === -1) return -1
  return ia - ib
}
