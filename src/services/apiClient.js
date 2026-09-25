import { getApiBaseFromStorage, isDesktopLocalApi } from './dataMode.js'

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function apiFetch(path, options = {}) {
  if (!isDesktopLocalApi()) {
    throw new Error('API local não está ativa.')
  }
  const base = getApiBaseFromStorage()
  if (!base) throw new Error('Endereço da API não configurado.')

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${base}${path}`, { ...options, headers })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && data.error) ||
      (typeof data === 'string' ? data : null) ||
      res.statusText ||
      'Erro na API'
    throw new Error(msg)
  }
  return data
}
