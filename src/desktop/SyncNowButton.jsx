import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../services/apiClient.js'
import { isDesktopLocalApi } from '../services/dataMode.js'
import './desktop.css'

/**
 * Sincronização manual SQLite → Supabase (só no backend em modo servidor e com credenciais).
 */
export default function SyncNowButton() {
  const active = isDesktopLocalApi()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const loadStatus = useCallback(async () => {
    if (!active) return
    try {
      const s = await apiFetch('/api/sync/status')
      setStatus({ ok: true, ...s })
    } catch {
      setStatus({ ok: false })
    }
  }, [active])

  useEffect(() => {
    if (!active) return undefined
    loadStatus()
    const id = setInterval(loadStatus, 30_000)
    return () => clearInterval(id)
  }, [active, loadStatus])

  useEffect(() => {
    if (!flash) return undefined
    const t = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(t)
  }, [flash])

  const run = async () => {
    setBusy(true)
    setFlash(null)
    try {
      const summary = await apiFetch('/api/sync/run', { method: 'POST' })
      let detail = ''
      if (summary && typeof summary === 'object') {
        if (summary.outboxProcessed != null) {
          detail = ` (${summary.outboxProcessed} evento(s) na fila processados.)`
        } else if (summary.message === 'sync_desligado') {
          detail = ' (cópia remota desligada.)'
        }
      }
      setFlash({ type: 'ok', text: `Sincronização concluída.${detail}` })
      await loadStatus()
    } catch (e) {
      setFlash({ type: 'err', text: e?.message || 'Falha ao sincronizar.' })
    } finally {
      setBusy(false)
    }
  }

  if (!active) return null

  const apiDown = status && status.ok === false
  const configured = status?.configured === true
  const serverPush = status?.supabasePushEnabled === true
  const remoteBusy = status?.inFlight === true
  const canRun =
    !apiDown && configured && serverPush && !remoteBusy && !busy

  let title = 'Copiar dados locais para o Supabase agora'
  if (apiDown) {
    title = 'Sem ligação ao servidor ou rota /api/sync indisponível.'
  } else if (!configured) {
    title =
      'Supabase não configurado neste PC. Cole a anon key em ORB_SUPABASE_SYNC_KEY no arquivo .env e reinicie.'
  } else if (!serverPush) {
    title =
      'Cópia para a nuvem só roda no PC em modo servidor com o backend iniciado.'
  } else if (remoteBusy) {
    title = 'Uma sincronização já está em curso no servidor.'
  }

  return (
    <span className="orb-sync-wrap">
      <button
        type="button"
        className={
          canRun ? 'orb-sync-btn orb-sync-btn--active' : 'orb-sync-btn'
        }
        disabled={!canRun || status === null}
        title={title}
        onClick={run}
      >
        {busy || remoteBusy ? 'A sincronizar…' : 'Sincronizar agora'}
      </button>
      {flash ? (
        <span
          className={
            flash.type === 'ok' ? 'orb-sync-flash orb-sync-flash--ok' : 'orb-sync-flash orb-sync-flash--err'
          }
          role="status"
        >
          {flash.text}
        </span>
      ) : null}
    </span>
  )
}
