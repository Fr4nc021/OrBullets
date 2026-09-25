/**
 * Estoque e produção do clube — API local (`/api/club/*`), ficheiro `club-database.db`.
 * Não usa o mesmo SQLite nem Supabase da loja.
 */
import { apiFetch } from './apiClient.js'

export async function fetchClubCalibers() {
  return (await apiFetch('/api/club/calibers')) ?? []
}

export async function createClubCaliber(name) {
  return apiFetch('/api/club/calibers', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function fetchClubItems(kind) {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  return (await apiFetch(`/api/club/items${q}`)) ?? []
}

export async function createClubItem(name, kind) {
  return apiFetch('/api/club/items', {
    method: 'POST',
    body: JSON.stringify({ name, kind }),
  })
}

/** @param {{ name?: string, kind?: string }} body */
export async function updateClubItem(id, body) {
  return apiFetch(`/api/club/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** Define o saldo absoluto do item (lança movimento de ajuste). */
export async function setClubItemBalance(id, quantity) {
  return apiFetch(`/api/club/items/${encodeURIComponent(id)}/balance`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  })
}

export async function deleteClubItem(id) {
  return apiFetch(`/api/club/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function clearClubItemMovements(id) {
  return apiFetch(`/api/club/items/${encodeURIComponent(id)}/movements`, {
    method: 'DELETE',
  })
}

export async function updateClubCaliber(id, name) {
  return apiFetch(`/api/club/calibers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export async function deleteClubCaliber(id) {
  return apiFetch(`/api/club/calibers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function fetchClubStock() {
  return (await apiFetch('/api/club/stock')) ?? []
}

export async function createClubStockMovement(body) {
  return apiFetch('/api/club/stock/movements', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchClubStockMovements(limit = 200) {
  const q = `?limit=${encodeURIComponent(String(limit))}`
  return (await apiFetch(`/api/club/stock/movements${q}`)) ?? []
}

/** @param {number|string} id @param {{ item_id?: string, type?: string, quantity?: number, date?: string, notes?: string|null }} body */
export async function updateClubStockMovement(id, body) {
  return apiFetch(`/api/club/stock/movements/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteClubStockMovement(id) {
  return apiFetch(`/api/club/stock/movements/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  })
}

/** Lista todas as receitas (com nomes de calibre e itens). */
export async function fetchClubRecipes() {
  return (await apiFetch('/api/club/recipes')) ?? []
}

/** @returns {Promise<object|null>} receita ou null se ainda não existir */
export async function fetchClubRecipe(caliberId) {
  return apiFetch(`/api/club/recipes/${encodeURIComponent(caliberId)}`)
}

export async function deleteClubRecipe(caliberId) {
  return apiFetch(`/api/club/recipes/${encodeURIComponent(caliberId)}`, {
    method: 'DELETE',
  })
}

export async function saveClubRecipe(caliberId, body) {
  return apiFetch(`/api/club/recipes/${encodeURIComponent(caliberId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function postClubProduction(body) {
  return apiFetch('/api/club/production', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchClubProductionBatches(limit = 50) {
  return (
    (await apiFetch(`/api/club/production/batches?limit=${encodeURIComponent(String(limit))}`)) ??
    []
  )
}

export async function updateClubProductionBatch(id, body) {
  return apiFetch(`/api/club/production/batches/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteClubProductionBatch(id) {
  return apiFetch(`/api/club/production/batches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** @param {string} [from] @param {string} [to] — YYYY-MM-DD ou ISO; omitir = histórico completo */
export async function fetchClubReportSummary(from, to) {
  const p = new URLSearchParams()
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  const q = p.toString() ? `?${p}` : ''
  return apiFetch(`/api/club/report/summary${q}`)
}
