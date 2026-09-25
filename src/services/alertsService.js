import { apiFetch } from './apiClient.js'

/**
 * @returns {Promise<{
 *   enabled: boolean,
 *   threshold: number
 * }>}
 */
export function fetchLowStockAlertConfig() {
  return apiFetch('/api/alerts/low-stock/config')
}

/**
 * @param {{
 *   enabled: boolean,
 *   threshold: number
 * }} payload
 */
export function saveLowStockAlertConfig(payload) {
  return apiFetch('/api/alerts/low-stock/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

/**
 * @returns {Promise<{
 *   show: boolean,
 *   items: { name: string, caliber: string, quantity: number }[],
 *   threshold: number,
 *   episodeKey: string | null
 * }>}
 */
export function checkLowStockAlert() {
  return apiFetch('/api/alerts/low-stock/check')
}

const LS_DISMISSED = 'orb.lowStockDismissed'

export function getDismissedLowStockEpisodeKey() {
  try {
    return localStorage.getItem(LS_DISMISSED) || ''
  } catch {
    return ''
  }
}

/** @param {string} episodeKey */
export function setDismissedLowStockEpisodeKey(episodeKey) {
  try {
    if (episodeKey) localStorage.setItem(LS_DISMISSED, episodeKey)
    else localStorage.removeItem(LS_DISMISSED)
  } catch {
    /* ignore */
  }
}
