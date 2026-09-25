import { apiFetch } from '../apiClient.js'

export async function fetchWeaponTypes() {
  return (await apiFetch('/api/weapon-types')) ?? []
}

export async function createWeaponTypeRow(name) {
  return apiFetch('/api/weapon-types', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function fetchWeaponBrands() {
  return (await apiFetch('/api/weapon-brands')) ?? []
}

export async function createWeaponBrandRow(name) {
  return apiFetch('/api/weapon-brands', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function fetchWeaponsRows() {
  return (await apiFetch('/api/weapons')) ?? []
}

export async function createWeaponRow(row) {
  return apiFetch('/api/weapons', {
    method: 'POST',
    body: JSON.stringify(row),
  })
}

/**
 * @param {string} weaponId
 * @param {{ responsible?: string, withdrawnAt?: string }} body
 */
export async function checkoutWeaponRow(weaponId, body) {
  return apiFetch(
    `/api/weapons/${encodeURIComponent(weaponId)}/checkout`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
}

/**
 * @param {string} weaponId
 * @param {{ owner: string, status: string, responsible?: string, withdrawnAt?: string }} body
 */
export async function updateWeaponRow(weaponId, body) {
  return apiFetch(
    `/api/weapons/${encodeURIComponent(weaponId)}/update`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

/**
 * @param {string} weaponId
 * @param {{ name: string, weapon_type_id: string, brand_id: string, caliber_id: string, owner: string, type?: string, serial?: string }} body
 */
export async function updateWeaponDetailsRow(weaponId, body) {
  return apiFetch(
    `/api/weapons/${encodeURIComponent(weaponId)}/details`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
}

/**
 * @param {string} weaponId
 * @param {{ owner: string, responsible?: string, withdrawnAt: string, termoEntrega?: object }} body
 */
export async function updateWeaponDeliveryRow(weaponId, body) {
  return apiFetch(
    `/api/weapons/${encodeURIComponent(weaponId)}/delivery`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
}

export async function deleteWeaponRow(weaponId) {
  return apiFetch(`/api/weapons/${encodeURIComponent(weaponId)}`, {
    method: 'DELETE',
  })
}

/**
 * @param {string} weaponId
 * @param {{ serial: string, destination: 'estoque' | 'dono' }} body
 */
export async function acquireWeaponSaleRow(weaponId, body) {
  return apiFetch(
    `/api/weapons/${encodeURIComponent(weaponId)}/acquire-sale`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
}

/**
 * @param {string} weaponId
 */
export async function markWeaponPurchasedRow(weaponId) {
  return apiFetch(
    `/api/weapons/${encodeURIComponent(weaponId)}/mark-purchased`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    },
  )
}
