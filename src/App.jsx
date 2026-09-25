import { useState } from 'react'
import './App.css'
import AppNavbar from './components/AppNavbar.jsx'
import AmmoPage from './features/ammo/AmmoPage.jsx'
import StockPage from './features/ammo/StockPage.jsx'
import MovementsPage from './features/ammo/MovementsPage.jsx'
import MonthlyMapPage from './features/mapmonthly/MonthlyMapPage.jsx'
import WeaponsPage from './features/weapons/WeaponsPage.jsx'
import ClubPage from './features/club/ClubPage.jsx'
import SettingsPage from './features/settings/SettingsPage.jsx'
import LowStockAlertModal from './features/settings/LowStockAlertModal.jsx'
import ConnectionStatus from './desktop/ConnectionStatus.jsx'
import SyncNowButton from './desktop/SyncNowButton.jsx'
import DesktopConnectionModal from './desktop/DesktopConnectionModal.jsx'
import ServerIpButton from './desktop/ServerIpButton.jsx'
import { isElectronApp, isDesktopLocalApi } from './services/dataMode.js'

function App() {
  const [tab, setTab] = useState('estoque')
  const [connModalOpen, setConnModalOpen] = useState(false)
  const [connKey, setConnKey] = useState(0)
  const showDesktop = isElectronApp() && isDesktopLocalApi()

  return (
    <div className="app-root">
      <div className="app-root__mesh" aria-hidden />
      <div className="app-root__glow app-root__glow--1" aria-hidden />
      <div className="app-root__glow app-root__glow--2" aria-hidden />
      <main className="app">
        <AppNavbar
          tab={tab}
          onTab={setTab}
          trailing={
            showDesktop ? (
              <>
                <ConnectionStatus key={connKey} />
                <SyncNowButton key={connKey} />
                <ServerIpButton key={connKey} />
                <button
                  type="button"
                  className="orb-nav-btn"
                  onClick={() => setConnModalOpen(true)}
                >
                  Conexão
                </button>
              </>
            ) : null
          }
        />
        <div className="app__main">
          {tab === 'cadastro' ? (
            <AmmoPage />
          ) : tab === 'estoque' ? (
            <StockPage />
          ) : tab === 'movimentacoes' ? (
            <MovementsPage />
          ) : tab === 'mapa' ? (
            <MonthlyMapPage />
          ) : tab === 'clube' ? (
            <ClubPage />
          ) : tab === 'armas' ? (
            <WeaponsPage />
          ) : tab === 'configuracoes' ? (
            <SettingsPage />
          ) : (
            <StockPage />
          )}
        </div>
      </main>
      {isDesktopLocalApi() ? <LowStockAlertModal /> : null}
      {showDesktop ? (
        <DesktopConnectionModal
          open={connModalOpen}
          onClose={() => setConnModalOpen(false)}
          onSaved={() => {
            setConnKey((k) => k + 1)
          }}
        />
      ) : null}
    </div>
  )
}

export default App
