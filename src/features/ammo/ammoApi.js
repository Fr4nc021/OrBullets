/**
 * Compatibilidade: reexporta serviços centralizados.
 * Prefira importar de `src/services/produtosService.js` e `estoqueService.js`.
 */
export {
  fetchCalibers,
  createCaliber,
  fetchAmmoTypeOptions,
  fetchProducts,
  createAmmoType,
  createProduct,
  updateAmmoType,
  deleteAmmoType,
  updateProduct,
  deleteProduct,
} from '../../services/produtosService.js'

export {
  fetchAmmoStock,
  fetchAmmoMovementsForReport,
  fetchRecentAmmoMovements,
  searchAmmoMovements,
  createAmmoMovement,
  createStockMovement,
  deleteEntradaMovement,
  deleteSaidaMovement,
  updateAmmoMovement,
} from '../../services/estoqueService.js'
