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
 * @param {{
 *   onComplete: (info?: {
 *     mode: string,
 *     addresses?: { name: string, address: string }[],
 *     port: number,
 *   }) => void
 *   hint?: string
 * }} props
 */
export default function DesktopSetupGate({ onComplete, hint }) {
  const [step, setStep] = useState('choose')
  const [clientHost, setClientHost] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [serverInfo, setServerInfo] = useState(null)
  const [copied, setCopied] = useState('')

  async function handleServer() {
    setError('')
    setBusy(true)
    try {
      await window.orbDesktop.setConfig({
        mode: 'server',
        port: Number(DEFAULT_PORT),
      })
      writeServerModeToLocalStorage(DEFAULT_PORT)
      await syncConfigToLocalStorage()
      const addresses = await window.orbDesktop.getLocalIPv4s()
      setServerInfo({
        addresses: addresses ?? [],
        port: Number(DEFAULT_PORT),
      })
      setStep('server-ready')
    } catch (e) {
      setError(e?.message || 'Não foi possível iniciar o servidor.')
    } finally {
      setBusy(false)
    }
  }

  async function copyIp(ip) {
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(ip)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  function finishServer() {
    onComplete({
      mode: 'server',
      addresses: serverInfo?.addresses ?? [],
      port: serverInfo?.port ?? Number(DEFAULT_PORT),
    })
  }

  async function handleClientSubmit(e) {
    e.preventDefault()
    setError('')
    const host = parseServerHost(clientHost)
    if (!host) {
      setError('Informe o IP do servidor.')
      return
    }
    setBusy(true)
    try {
      const base = `http://${host}:${DEFAULT_PORT}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      let res
      try {
        res = await fetch(`${base}/api/health`, { signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) throw new Error('Servidor não respondeu corretamente.')
      const data = await res.json().catch(() => ({}))
      if (!data.ok) throw new Error('Resposta inválida do servidor.')

      await window.orbDesktop.setConfig({
        mode: 'client',
        serverHost: host,
        port: Number(DEFAULT_PORT),
      })
      writeClientConnectionToLocalStorage(host, DEFAULT_PORT)
      await syncConfigToLocalStorage()
      onComplete({ mode: 'client', port: Number(DEFAULT_PORT) })
    } catch (e) {
      const aborted = e?.name === 'AbortError'
      setError(
        aborted
          ? 'Não foi possível conectar ao servidor. O tempo esgotou — verifique o IP e se o servidor está em execução.'
          : e?.message?.includes('Failed to fetch') ||
              e?.message?.includes('NetworkError') ||
              e?.message?.includes('fetch')
            ? 'Não foi possível conectar ao servidor. Verifique o IP informado e se o computador servidor está ligado e com o OrBullets em modo Servidor.'
            : e?.message ||
              'Não foi possível conectar ao servidor. Verifique o IP e se o servidor está em execução.',
      )
    } finally {
      setBusy(false)
    }
  }

  const primaryIp = serverInfo?.addresses?.[0]?.address || '127.0.0.1'
  const otherIps = (serverInfo?.addresses || [])
    .map((a) => a.address)
    .filter((ip) => ip && ip !== primaryIp)

  return (
    <div className="orb-setup">
      <div className="orb-setup__panel">
        <h1 className="orb-setup__title">Como este PC entra no sistema</h1>
        <p className="orb-setup__lead">
          {hint ||
            'No computador da loja escolha Servidor. Nos outros PCs escolha Cliente e use o IP desse servidor.'}
        </p>

        {error ? (
          <p className="orb-setup__error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 'choose' ? (
          <div className="orb-setup__choices">
            <button
              type="button"
              className="orb-setup__card"
              disabled={busy}
              onClick={() => void handleServer()}
            >
              <strong>Servidor</strong>
              <span>
                Este computador inicia o serviço e guarda os dados (porta{' '}
                {DEFAULT_PORT}).
              </span>
            </button>
            <button
              type="button"
              className="orb-setup__card"
              disabled={busy}
              onClick={() => {
                setStep('client')
                setError('')
              }}
            >
              <strong>Cliente</strong>
              <span>
                Conectar a um servidor OrBullets já em execução na rede.
              </span>
            </button>
          </div>
        ) : null}

        {step === 'server-ready' ? (
          <div className="orb-setup__server-ready">
            <p className="orb-setup__ok">Servidor iniciado com sucesso.</p>
            <p className="orb-setup__label">IP deste computador</p>
            <div className="orb-setup__ip-row">
              <span className="orb-setup__mono orb-setup__ip-value">
                {primaryIp}
              </span>
              <button
                type="button"
                className="orb-setup__btn orb-setup__btn--ghost"
                onClick={() => void copyIp(primaryIp)}
              >
                {copied === primaryIp ? 'Copiado' : 'Copiar IP'}
              </button>
            </div>
            {otherIps.length > 0 ? (
              <ul className="orb-setup__ip-list">
                {otherIps.map((ip) => (
                  <li key={ip}>
                    <span className="orb-setup__mono">{ip}</span>
                    <button
                      type="button"
                      className="orb-setup__btn orb-setup__btn--ghost"
                      onClick={() => void copyIp(ip)}
                    >
                      {copied === ip ? 'Copiado' : 'Copiar'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="orb-setup__hint">
              Envie este IP aos outros computadores. Neles, escolha Cliente e
              informe este endereço.
            </p>
            <div className="orb-setup__actions">
              <button
                type="button"
                className="orb-setup__btn"
                onClick={finishServer}
              >
                Continuar
              </button>
            </div>
          </div>
        ) : null}

        {step === 'client' ? (
          <form className="orb-setup__form" onSubmit={handleClientSubmit}>
            <div>
              <label className="orb-setup__label" htmlFor="orb-client-host">
                IP do servidor
              </label>
              <input
                id="orb-client-host"
                className="orb-setup__input"
                placeholder="ex.: 192.168.1.10"
                value={clientHost}
                onChange={(ev) => setClientHost(ev.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            </div>
            <div className="orb-setup__actions">
              <button
                type="button"
                className="orb-setup__btn orb-setup__btn--ghost"
                disabled={busy}
                onClick={() => {
                  setStep('choose')
                  setError('')
                }}
              >
                Voltar
              </button>
              <button type="submit" className="orb-setup__btn" disabled={busy}>
                {busy ? 'A conectar…' : 'Conectar'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}
