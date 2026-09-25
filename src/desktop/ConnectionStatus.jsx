import { useEffect, useState } from 'react'
import { getApiBaseFromStorage, isDesktopLocalApi } from '../services/dataMode.js'
import './desktop.css'

export default function ConnectionStatus() {
  const active = isDesktopLocalApi()
  const [ok, setOk] = useState(null)

  useEffect(() => {
    if (!active) return undefined

    let cancelled = false

    async function ping() {
      const base = getApiBaseFromStorage()
      if (!base) {
        if (!cancelled) setOk(false)
        return
      }
      try {
        const res = await fetch(`${base}/api/health`, {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setOk(res.ok && data.ok === true)
      } catch {
        if (!cancelled) setOk(false)
      }
    }

    ping()
    const id = setInterval(ping, 8000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [active])

  if (!active) return null

  const base = getApiBaseFromStorage()
  const label =
    ok === true ? 'Ligado ao servidor' : ok === false ? 'Sem ligação' : '…'

  return (
    <div
      className={
        ok === true
          ? 'orb-conn orb-conn--ok'
          : ok === false
            ? 'orb-conn orb-conn--bad'
            : 'orb-conn'
      }
      title={base || 'API não configurada'}
    >
      <span className="orb-conn__dot" aria-hidden />
      {label}
    </div>
  )
}
