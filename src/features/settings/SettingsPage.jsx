import { useEffect, useState } from 'react'
import {
  fetchLowStockAlertConfig,
  saveLowStockAlertConfig,
} from '../../services/alertsService.js'
import '../../desktop/desktop.css'
import './SettingsPage.css'

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false)
  const [threshold, setThreshold] = useState(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      try {
        const cfg = await fetchLowStockAlertConfig()
        if (cancelled) return
        setEnabled(Boolean(cfg.enabled))
        setThreshold(Number(cfg.threshold) || 100)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Não foi possível carregar as configurações.')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(ev) {
    ev.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const t = Math.floor(Number(threshold))
      if (!Number.isFinite(t) || t < 0) {
        throw new Error('Estoque mínimo deve ser um número ≥ 0.')
      }
      const saved = await saveLowStockAlertConfig({
        enabled,
        threshold: t,
      })
      setEnabled(Boolean(saved.enabled))
      setThreshold(Number(saved.threshold) || t)
      setNotice('Configuração de avisos guardada.')
    } catch (err) {
      setError(err?.message || 'Falha ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page__head">
        <h1>Configurações</h1>
        <p>
          Aviso de estoque baixo. Entra qualquer munição abaixo do estoque
          mínimo, inclusive quantidade 0. Quando ligado, aparece em qualquer
          computador ligado a este servidor.
        </p>
      </header>

      {error ? (
        <p className="orb-setup__error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="settings-page__ok">{notice}</p> : null}

      <form className="settings-page__section" onSubmit={handleSave}>
        <h2>Avisos de estoque</h2>

        <label className="settings-page__check">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(ev) => setEnabled(ev.target.checked)}
          />
          <span>Estoque baixo</span>
        </label>

        <div className="settings-page__threshold">
          <label className="orb-setup__label" htmlFor="orb-low-stock-min">
            Estoque mínimo
          </label>
          <div className="settings-page__threshold-row">
            <input
              id="orb-low-stock-min"
              className="orb-setup__input settings-page__threshold-input"
              type="number"
              min={0}
              step={1}
              value={threshold}
              disabled={busy || !enabled}
              onChange={(ev) => setThreshold(ev.target.value)}
            />
            <span className="settings-page__unit">munições</span>
          </div>
        </div>

        <div className="settings-page__actions">
          <button type="submit" className="orb-setup__btn" disabled={busy}>
            {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
