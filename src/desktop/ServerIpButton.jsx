import { useEffect, useState } from 'react'
import './desktop.css'

export default function ServerIpButton() {
  const [isServer, setIsServer] = useState(false)
  const [port, setPort] = useState(3000)
  const [open, setOpen] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const config = await window.orbDesktop?.getConfig?.()
      if (cancelled || !config) return
      setIsServer(config.mode === 'server')
      setPort(Number(config.port) || 3000)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isServer) return null

  const ips = addresses.map((a) => a.address).filter(Boolean)
  const primary = ips[0] || '127.0.0.1'
  const others = ips.filter((ip) => ip !== primary)

  async function openPanel() {
    const list = await window.orbDesktop.getLocalIPv4s().catch(() => [])
    setAddresses(list ?? [])
    setCopied('')
    setOpen(true)
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

  return (
    <>
      <button type="button" className="orb-nav-btn" onClick={() => void openPanel()}>
        IP
      </button>
      {open ? (
        <div
          className="orb-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orb-ip-title"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setOpen(false)
          }}
        >
          <div className="orb-modal">
            <h2 id="orb-ip-title">IP deste PC</h2>
            <p className="orb-setup__hint" style={{ marginTop: 0 }}>
              Os outros computadores usam este endereço no modo Cliente.
            </p>
            <p className="orb-setup__label">IP</p>
            <div className="orb-setup__ip-row">
              <span className="orb-setup__mono orb-setup__ip-value">{primary}</span>
              <button
                type="button"
                className="orb-setup__btn orb-setup__btn--ghost"
                onClick={() => void copyIp(primary)}
              >
                {copied === primary ? 'Copiado' : 'Copiar IP'}
              </button>
            </div>
            {others.length > 0 ? (
              <ul className="orb-setup__ip-list">
                {others.map((ip) => (
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
              Porta: <span className="orb-setup__mono">{port}</span>
            </p>
            <div className="orb-setup__actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="orb-setup__btn"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
