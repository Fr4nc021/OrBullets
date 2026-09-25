import { useEffect, useState } from 'react'
import App from './App.jsx'
import splashLogo from './assets/splash-logo.png'
import DesktopSetupGate from './desktop/DesktopSetupGate.jsx'
import {
  ensureBrowserLocalApiConfig,
  isElectronApp,
  pingApiHealth,
  syncConfigToLocalStorage,
  useLocalApiEnv,
} from './services/dataMode.js'
import './desktop/desktop.css'

export default function AppRoot() {
  const [phase, setPhase] = useState(() => {
    if (useLocalApiEnv() && !isElectronApp()) {
      ensureBrowserLocalApiConfig(
        import.meta.env.VITE_LOCAL_API_PORT || '3000',
      )
      return 'app'
    }
    return isElectronApp() ? 'loading' : 'app'
  })
  const [setupHint, setSetupHint] = useState('')

  useEffect(() => {
    if (useLocalApiEnv() && !isElectronApp()) {
      ensureBrowserLocalApiConfig(
        import.meta.env.VITE_LOCAL_API_PORT || '3000',
      )
    }
  }, [])

  useEffect(() => {
    if (!isElectronApp()) return undefined

    let cancelled = false
    ;(async () => {
      try {
        await syncConfigToLocalStorage()
        const c = await window.orbDesktop.getConfig()
        if (cancelled) return
        if (!c.mode) {
          setSetupHint('')
          setPhase('setup')
          return
        }
        const ok = await pingApiHealth()
        if (cancelled) return
        if (!ok) {
          setSetupHint(
            'Não foi possível ligar ao servidor gravado. Neste PC da loja escolha Servidor — o banco local continua aqui. Nos outros computadores escolha Cliente e use o IP deste PC.',
          )
          setPhase('setup')
          return
        }
        setPhase('app')
      } catch {
        if (!cancelled) {
          setSetupHint(
            'Não foi possível ler a configuração deste computador.',
          )
          setPhase('setup')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (phase === 'loading') return undefined
    window.orbDesktop?.notifyUiReady?.()
    return undefined
  }, [phase])

  if (phase === 'loading') {
    return (
      <div className="orb-loading" role="status" aria-label="A carregar OrBullets">
        <img src={splashLogo} alt="" />
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <DesktopSetupGate
        hint={setupHint}
        onComplete={() => {
          setSetupHint('')
          setPhase('app')
        }}
      />
    )
  }

  return <App />
}
