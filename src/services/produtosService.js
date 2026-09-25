/**
 * Produtos: calibres e itens de estoque (ammo_types).
 * Único ponto de acesso — troque a implementação ao migrar para API REST.
 */
import { PRODUCT_TYPE_KEYS } from '../features/ammo/productTypes.js'
import * as supabaseAmmoRepo from './repositories/supabaseAmmoRepository.js'
import * as apiAmmoRepo from './repositories/apiAmmoRepository.js'
import { isDesktopLocalApi } from './dataMode.js'
import { createAmmoMovement } from './estoqueService.js'

function ammoRepo() {
  return isDesktopLocalApi() ? apiAmmoRepo : supabaseAmmoRepo
}

function assertProductType(productType) {
  if (!PRODUCT_TYPE_KEYS.includes(productType)) {
    throw new Error('Tipo de produto inválido.')
  }
}

function sortCaliberRows(rows) {
  const list = [...rows]
  list.sort((a, b) => {
    const t = String(a.product_type ?? 'municao').localeCompare(
      String(b.product_type ?? 'municao'),
    )
    if (t !== 0) return t
    return String(a.name).localeCompare(String(b.name), 'pt-BR', {
      sensitivity: 'base',
    })
  })
  return list
}

/**
 * @param {{ productType?: string, productTypes?: string[] }} [opts]
 * — `productTypes`: vários tipos (ex.: munição e cartucho); faz merge e ordena.
 */
export async function fetchCalibers(opts = {}) {
  const { productType, productTypes } = opts
  if (Array.isArray(productTypes) && productTypes.length > 0) {
    const lists = await Promise.all(
      productTypes.map((pt) => ammoRepo().repoFetchCalibers(pt)),
    )
    return sortCaliberRows(lists.flat())
  }
  return ammoRepo().repoFetchCalibers(productType)
}

/**
 * Lista produtos com calibre e tipo (movimentação, relatórios).
 * Mantém o nome `fetchAmmoTypeOptions` por compatibilidade.
 */
export async function fetchAmmoTypeOptions() {
  const { ammoTypes } = await ammoRepo().repoFetchAmmoTypesWithCalibers()
  return ammoTypes
}

export async function fetchProducts() {
  return fetchAmmoTypeOptions()
}

export async function createCaliber(name, productType) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nome do calibre é obrigatório.')
  assertProductType(productType)
  return ammoRepo().repoInsertCaliber({ name: trimmed, productType })
}

function parseNonNegativeInt(raw) {
  if (raw == null || String(raw).trim() === '') return 0
  const n = Number(String(raw).replace(',', '.').trim())
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}

/**
 * Cria produto (nome) vinculado ao calibre; quantidade inicial gera entrada.
 */
export async function createAmmoType(caliberId, name, initialQuantityRaw = 0) {
  const trimmed = name.trim()
  if (!caliberId) throw new Error('Selecione um calibre.')
  if (!trimmed) throw new Error('Nome do produto é obrigatório.')

  const initialQty = parseNonNegativeInt(initialQuantityRaw)
  if (initialQty === null) {
    throw new Error('Quantidade inicial deve ser um número inteiro ≥ 0.')
  }

  const data = await ammoRepo().repoInsertAmmoType({
    caliberId,
    name: trimmed,
  })

  if (initialQty > 0) {
    await createAmmoMovement(data.id, 'entrada', initialQty, {
      nfNumber: 'INICIAL',
    })
  }

  return data
}

/** Alias semântico */
export const createProduct = createAmmoType

/**
 * Atualiza apenas o nome do produto (`ammo_types`).
 * @param {string} ammoTypeId
 * @param {string} name
 */
export async function updateAmmoType(ammoTypeId, name) {
  const trimmed = String(name ?? '').trim()
  if (!ammoTypeId) throw new Error('Produto inválido.')
  if (!trimmed) throw new Error('Nome do produto é obrigatório.')
  return ammoRepo().repoUpdateAmmoType(ammoTypeId, { name: trimmed })
}

/**
 * Exclui o produto e todas as movimentações associadas.
 * @param {string} ammoTypeId
 */
export async function deleteAmmoType(ammoTypeId) {
  if (!ammoTypeId) throw new Error('Produto inválido.')
  return ammoRepo().repoDeleteAmmoType(ammoTypeId)
}

export const updateProduct = updateAmmoType
export const deleteProduct = deleteAmmoType
