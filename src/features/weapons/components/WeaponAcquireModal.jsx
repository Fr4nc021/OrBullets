/**
 * Adquire arma da lista "para compra": S/N + destino.
 */
export function WeaponAcquireModal({
  weapon,
  weaponSummary,
  clientName,
  serial,
  onSerialChange,
  destination,
  onDestinationChange,
  busy,
  validationError,
  onClose,
  onConfirm,
}) {
  if (!weapon) return null

  return (
    <div
      className="weapons-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="weapons-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weapons-acquire-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="weapons-acquire-title" className="weapons-dialog__title">
          Adquirir arma
        </h2>

        {validationError ? (
          <p className="weapons-dialog__validation" role="alert">
            {validationError}
          </p>
        ) : null}

        <form
          className="weapons-dialog__form"
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm()
          }}
        >
          <fieldset className="weapons-dialog__summary" disabled={busy}>
            <legend>Arma vendida</legend>
            <dl className="weapons-dialog__summary-grid">
              <div>
                <dt>Cliente</dt>
                <dd>{clientName || '—'}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{weaponSummary?.type ?? '—'}</dd>
              </div>
              <div>
                <dt>Marca</dt>
                <dd>{weaponSummary?.brand ?? '—'}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{weaponSummary?.model ?? '—'}</dd>
              </div>
              <div>
                <dt>Calibre</dt>
                <dd>{weaponSummary?.caliber ?? '—'}</dd>
              </div>
            </dl>
          </fieldset>

          <fieldset className="weapons-dialog__fieldset" disabled={busy}>
            <legend>Aquisição</legend>
            <label className="weapons-dialog__field">
              <span>Nº de série</span>
              <input
                type="text"
                value={serial}
                onChange={(e) => onSerialChange(e.target.value)}
                placeholder="Número de série da arma"
                autoComplete="off"
                required
              />
            </label>
            <div className="weapons-dialog__field">
              <span>Destino após adquirir</span>
              <div className="weapons-dialog__radios">
                <label className="weapons-dialog__check">
                  <input
                    type="radio"
                    name="acquire-destination"
                    checked={destination === 'estoque'}
                    onChange={() => onDestinationChange('estoque')}
                  />
                  <span>Estoque da loja</span>
                </label>
                <label className="weapons-dialog__check">
                  <input
                    type="radio"
                    name="acquire-destination"
                    checked={destination === 'dono'}
                    onChange={() => onDestinationChange('dono')}
                  />
                  <span>
                    Armas com dono
                    {clientName ? ` (${clientName})` : ''}
                  </span>
                </label>
              </div>
            </div>
          </fieldset>

          <div className="weapons-dialog__actions">
            <button type="button" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !(serial ?? '').trim() || !destination}
            >
              {busy ? 'Salvando…' : 'Confirmar aquisição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
