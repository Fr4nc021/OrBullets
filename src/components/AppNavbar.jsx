import { APP_TABS } from '../services/appTabs.js'

export default function AppNavbar({ tab, onTab, trailing }) {
  return (
    <header className="app-shell__header">
      <div className="app-shell__brand">
        <span className="app-shell__logo" aria-hidden>
          <span className="app-shell__logo-mark" />
          OrBullets
        </span>
        <span className="app-shell__tagline">Gestão de munição e armas</span>
      </div>
      <nav className="app-shell__nav" aria-label="Navegação principal">
        <div className="app-shell__nav-row">
          {trailing ? (
            <div className="app-shell__nav-trailing">{trailing}</div>
          ) : null}
          <div className="app-shell__nav-pills" role="tablist">
          {APP_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={
                tab === t.id
                  ? 'app-shell__pill app-shell__pill--active'
                  : 'app-shell__pill'
              }
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        </div>
      </nav>
    </header>
  )
}
