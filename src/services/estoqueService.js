import { localDateEndIso, localDateStartIso } from './localDateBounds.js'
import * as supabaseAmmoRepo from './repositories/supabaseAmmoRepository.js'
import * as apiAmmoRepo from './repositories/apiAmmoRepository.js'
import { isDesktopLocalApi } from './dataMode.js'

function ammoRepo() {
  return isDesktopLocalApi() ? apiAmmoRepo : supabaseAmmoRepo
}

export async function fetchAmmoStock() {
  return ammoRepo().repoFetchAmmoStock()
}

export async function fetchAmmoMovementsForReport() {
  return ammoRepo().repoFetchAmmoMovementsForReport()
}

/**
 * @param {number} [limit]
 */
export async function fetchRecentAmmoMovements(limit) {
  return ammoRepo().repoFetchRecentAmmoMovementsWithDetails(limit)
}

/**
 * Pesquisa em todo o histórico de movimentações (sem limite de registros recentes).
 * @param {{ caliber?: string, dateFrom?: string, dateTo?: string, nfNumber?: string }} [filters] — datas YYYY-MM-DD (dia local)
 */
export async function searchAmmoMovements(filters = {}) {
  const caliber =
    filters.caliber != null ? String(filters.caliber).trim() : ''
  const dateFrom =
    filters.dateFrom != null ? String(filters.dateFrom).trim() : ''
  const dateTo = filters.dateTo != null ? String(filters.dateTo).trim() : ''
  const nfNumber =
    filters.nfNumber != null ? String(filters.nfNumber).trim() : ''

  return ammoRepo().repoSearchAmmoMovementsWithDetails({
    caliber: caliber || undefined,
    dateFromIso: dateFrom ? localDateStartIso(dateFrom) : undefined,
    dateToIso: dateTo ? localDateEndIso(dateTo) : undefined,
    nfNumber: nfNumber || undefined,
  })
}

/**
 * @param {string} ammoTypeId
 * @param {'entrada'|'saida'} type
 * @param {number} quantity
 * @param {{ saidaGroupId?: string, nfNumber?: string }} [opts] — `saidaGroupId` vincula linhas da mesma saída (termo); `nfNumber` nas entradas.
 */
export async function createAmmoMovement(ammoTypeId, type, quantity, opts) {
  if (!ammoTypeId) throw new Error('Tipo de munição inválido.')
  if (type !== 'entrada' && type !== 'saida') {
    throw new Error('Tipo de movimentação inválido.')
  }
  const q = Number(quantity)
  if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
    throw new Error('Quantidade deve ser um inteiro positivo.')
  }

  const payload = {
    ammo_type_id: ammoTypeId,
    type,
    quantity: q,
    date: new Date().toISOString(),
  }
  if (type === 'saida' && opts?.saidaGroupId) {
    payload.saida_group_id = opts.saidaGroupId
  }
  if (type === 'entrada') {
    const nf =
      opts?.nfNumber != null ? String(opts.nfNumber).trim() : ''
    if (nf) payload.nf_number = nf
  }

  await ammoRepo().repoInsertAmmoMovement(payload)
}

/**
 * Exclui uma entrada; a quantidade é descontada do estoque (saldo = soma das movimentações).
 * @param {number|string} movementId — id da linha em `ammo_movements` (retorno de movimentações recentes).
 */
export async function deleteEntradaMovement(movementId) {
  await ammoRepo().repoDeleteEntradaMovement(movementId)
}

/**
 * Exclui uma saída; as quantidades voltam ao estoque (saldo = soma das movimentações).
 * @param {number|string} movementId — id da linha em `ammo_movements` (retorno de movimentações recentes).
 */
export async function deleteSaidaMovement(movementId) {
  await ammoRepo().repoDeleteSaidaMovement(movementId)
}

/**
 * Atualiza quantidade, data e/ou número da NF de uma movimentação já lançada.
 * @param {number|string} movementId
 * @param {{ quantity?: number, date?: string, nf_number?: string | null }} patch
 */
export async function updateAmmoMovement(movementId, patch) {
  await ammoRepo().repoUpdateAmmoMovement(movementId, patch)
}

export const createStockMovement = createAmmoMovement
