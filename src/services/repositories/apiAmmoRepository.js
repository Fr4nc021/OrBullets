import { apiFetch } from '../apiClient.js'

export function formatApiError(err) {
  if (!err) return 'Erro desconhecido.'
  return err.message ?? String(err)
}

/**
 * @param {string} [productType]
 */
export async function repoFetchCalibers(productType) {
  const q = productType
    ? `?product_type=${encodeURIComponent(productType)}`
    : ''
  const rows = await apiFetch(`/api/calibers${q}`)
  const list = rows ?? []
  list.sort((a, b) => {
    const t = String(a.product_type ?? 'municao').localeCompare(
      String(b.product_type ?? 'municao'),
    )
    if (t !== 0) return t
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  })
  return list
}

export async function repoFetchAmmoStock() {
  return (await apiFetch('/api/ammo-stock')) ?? []
}

export async function repoFetchAmmoMovementsForReport() {
  return (await apiFetch('/api/ammo-movements/report')) ?? []
}

export async function repoFetchAmmoTypesWithCalibers() {
  const data = await apiFetch('/api/ammo-types-with-calibers')
  return {
    ammoTypes: data.ammoTypes ?? [],
    hasCreatedAt: data.hasCreatedAt !== false,
  }
}

export async function repoInsertCaliber({ name, productType }) {
  return apiFetch('/api/calibers', {
    method: 'POST',
    body: JSON.stringify({ name, product_type: productType }),
  })
}

export async function repoInsertAmmoType({ caliberId, name }) {
  return apiFetch('/api/ammo-types', {
    method: 'POST',
    body: JSON.stringify({ caliber_id: caliberId, name }),
  })
}

/**
 * @param {string} ammoTypeId
 * @param {{ name: string }} patch
 */
export async function repoUpdateAmmoType(ammoTypeId, patch) {
  return apiFetch(`/api/ammo-types/${encodeURIComponent(ammoTypeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch ?? {}),
  })
}

/**
 * @param {string} ammoTypeId
 */
export async function repoDeleteAmmoType(ammoTypeId) {
  return apiFetch(`/api/ammo-types/${encodeURIComponent(ammoTypeId)}`, {
    method: 'DELETE',
  })
}

export async function repoInsertAmmoMovement(payload) {
  await apiFetch('/api/ammo-movements', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * @param {number} [limit]
 */
export async function repoFetchRecentAmmoMovementsWithDetails(limit = 200) {
  const lim = Math.min(
    500,
    Math.max(1, Math.floor(Number(limit)) || 200),
  )
  return (await apiFetch(`/api/ammo-movements/recent?limit=${lim}`)) ?? []
}

/**
 * Pesquisa movimentações em todo o histórico.
 * @param {{ caliber?: string, dateFromIso?: string, dateToIso?: string, nfNumber?: string }} [filters]
 */
export async function repoSearchAmmoMovementsWithDetails(filters = {}) {
  const params = new URLSearchParams()
  const caliber = filters.caliber?.trim()
  if (caliber) params.set('caliber', caliber)
  if (filters.dateFromIso) params.set('dateFrom', filters.dateFromIso)
  if (filters.dateToIso) params.set('dateTo', filters.dateToIso)
  const nfNumber = filters.nfNumber?.trim()
  if (nfNumber) params.set('nfNumber', nfNumber)
  const q = params.toString()
  return (await apiFetch(`/api/ammo-movements/search${q ? `?${q}` : ''}`)) ?? []
}

/**
 * Exclui entrada pelo id da linha; valida saldo antes de remover.
 * @param {number} movementId
 */
export async function repoDeleteEntradaMovement(movementId) {
  const id = Math.floor(Number(movementId))
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Id de movimentação inválido.')
  }
  await apiFetch(`/api/ammo-movements/entrada/${id}`, { method: 'DELETE' })
}

/**
 * Exclui saída pelo id da linha; se pertencer a um termo (saida_group_id), remove o grupo inteiro.
 * @param {number} movementId
 */
export async function repoDeleteSaidaMovement(movementId) {
  const id = Math.floor(Number(movementId))
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Id de movimentação inválido.')
  }
  await apiFetch(`/api/ammo-movements/saida/${id}`, { method: 'DELETE' })
}

/**
 * @param {number|string} movementId
 * @param {{ quantity?: number, date?: string, nf_number?: string | null }} patch
 */
export async function repoUpdateAmmoMovement(movementId, patch) {
  const id = Math.floor(Number(movementId))
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Id de movimentação inválido.')
  }
  await apiFetch(`/api/ammo-movements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch ?? {}),
  })
}
