const LS_MODE = 'orb.mode'
const LS_HOST = 'orb.serverHost'
const LS_PORT = 'orb.serverPort'

/** Vite/browser: força API local (SQLite via Express), sem Supabase. */
export function useLocalApiEnv() {
  return import.meta.env.VITE_USE_LOCAL_API === 'true'
}

export function isElectronApp() {
  return typeof window !== 'undefined' && window.orbDesktop?.isElectron === true
}

/**
 * True when the UI should talk to the local Express/SQLite API
 * (Electron after setup, or browser with VITE_USE_LOCAL_API=true).
 */
export function isDesktopLocalApi() {
  if (useLocalApiEnv()) return true
  if (!isElectronApp()) return false
  const mode = localStorage.getItem(LS_MODE)
  return mode === 'server' || mode === 'client'
}

/** Garante localStorage do modo servidor para o browser em modo local. */
export function ensureBrowserLocalApiConfig(port = '3000') {
  if (!useLocalApiEnv() || isElectronApp()) return
  writeServerModeToLocalStorage(port)
}

export async function syncConfigToLocalStorage() {
  if (!window.orbDesktop?.getConfig) return
  const c = await window.orbDesktop.getConfig()
  if (c.mode) localStorage.setItem(LS_MODE, c.mode)
  if (c.serverHost != null) localStorage.setItem(LS_HOST, String(c.serverHost))
  const port = c.port != null ? String(c.port) : '3000'
  localStorage.setItem(LS_PORT, port)
}

/** Remove protocolo, porta e caminho — devolve só o host (IP ou nome). */
export function parseServerHost(input) {
  let s = String(input || '').trim()
  if (!s) return ''
  s = s.replace(/^https?:\/\//i, '')
  const slash = s.indexOf('/')
  if (slash >= 0) s = s.slice(0, slash)
  const colon = s.lastIndexOf(':')
  if (colon > 0 && /^\d+$/.test(s.slice(colon + 1))) {
    s = s.slice(0, colon)
  }
  return s.trim()
}

export function writeClientConnectionToLocalStorage(serverHost, port = '3000') {
  const host = parseServerHost(serverHost)
  localStorage.setItem(LS_MODE, 'client')
  localStorage.setItem(LS_HOST, host)
  localStorage.setItem(LS_PORT, String(port))
}

export function writeServerModeToLocalStorage(port = '3000') {
  localStorage.setItem(LS_MODE, 'server')
  localStorage.removeItem(LS_HOST)
  localStorage.setItem(LS_PORT, String(port))
}

export function getApiBaseFromStorage() {
  if (useLocalApiEnv() && !isElectronApp()) {
    const port =
      import.meta.env.VITE_LOCAL_API_PORT ||
      localStorage.getItem(LS_PORT) ||
      '3000'
    return `http://127.0.0.1:${port}`
  }
  const port = localStorage.getItem(LS_PORT) || '3000'
  const mode = localStorage.getItem(LS_MODE)
  if (mode === 'server') return `http://127.0.0.1:${port}`
  if (mode === 'client') {
    const host =
      parseServerHost(localStorage.getItem(LS_HOST) || '') || '127.0.0.1'
    return `http://${host}:${port}`
  }
  return ''
}

/** Ping da API local/rede. Sem servidor a correr devolve false. */
export async function pingApiHealth(timeoutMs = 2500) {
  const base = getApiBaseFromStorage()
  if (!base) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/api/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    return res.ok && data.ok === true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
