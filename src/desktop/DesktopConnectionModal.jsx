import { useState } from 'react'
import {
  parseServerHost,
  syncConfigToLocalStorage,
  writeClientConnectionToLocalStorage,
  writeServerModeToLocalStorage,
} from '../services/dataMode.js'
import './desktop.css'

const DEFAULT_PORT = '3000'

/**
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void }} props
 */
export default function DesktopConnectionModal({ open, onClose, onSaved }) {
  const [mode, setMode] = useState('server')
  const [clientHost, setClientHost] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'server') {
        await window.orbDesktop.setConfig({
          mode: 'server',
          port: Number(DEFAULT_PORT),
        })
        writeServerModeToLocalStorage(DEFAULT_PORT)
      } else {
        const host = parseServerHost(clientHost)
        if (!host) {
          setError('Informe o IP do servidor.')
          setBusy(false)
          return
        }
        const base = `http://${host}:${DEFAULT_PORT}`
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        let res
        try {
          res = await fetch(`${base}/api/health`, { signal: controller.signal })
        } finally {
          clearTimeout(timer)
        }
        if (!res.ok) throw new Error('Servidor não respondeu.')
        const data = await res.json().catch(() => ({}))
        if (!data.ok) throw new Error('Resposta inválida.')

        await window.orbDesktop.setConfig({
          mode: 'client',
          serverHost: host,
          port: Number(DEFAULT_PORT),
        })
        writeClientConnectionToLocalStorage(host, DEFAULT_PORT)
      }
      await syncConfigToLocalStorage()
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'Falha ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="orb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orb-conn-modal-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div className="orb-modal">
        <h2 id="orb-conn-modal-title">Conexão / modo</h2>
        {error ? (
          <p className="orb-setup__error" role="alert">
            {error}
          </p>
        ) : null}
        <form onSubmit={handleSave}>
          <div className="orb-setup__form" style={{ marginTop: 0 }}>
            <label className="orb-setup__label">Modo</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="orb-mode"
                  checked={mode === 'server'}
                  onChange={() => setMode('server')}
                />
                Servidor
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="orb-mode"
                  checked={mode === 'client'}
                  onChange={() => setMode('client')}
                />
                Cliente
              </label>
            </div>
            {mode === 'client' ? (
              <div>
                <label
                  className="orb-setup__label"
                  htmlFor="orb-modal-host"
                >
                  IP do servidor
                </label>
                <input
                  id="orb-modal-host"
                  className="orb-setup__input"
                  value={clientHost}
                  onChange={(ev) => setClientHost(ev.target.value)}
                  placeholder="192.168.x.x"
                  disabled={busy}
                />
              </div>
            ) : null}
          </div>
          <div className="orb-setup__actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="orb-setup__btn orb-setup__btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="orb-setup__btn" disabled={busy}>
              {busy ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
