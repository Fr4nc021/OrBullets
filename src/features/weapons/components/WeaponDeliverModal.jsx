/**
 * Dados do comprovante de entrega antes de gerar o PDF e registrar ou atualizar a retirada.
 * @param {'new' | 'edit'} mode
 */
export function WeaponDeliverModal({
  weapon,
  weaponSummary,
  mode = 'new',
  owner,
  onOwnerChange,
  rg,
  onRgChange,
  cpf,
  onCpfChange,
  sigmaSinarm,
  onSigmaSinarmChange,
  responsible,
  onResponsibleChange,
  withdrawDate,
  onWithdrawDateChange,
  busy,
  validationError,
  onClose,
  onRequestComprovante,
}) {
  if (!weapon) return null

  const isEdit = mode === 'edit'
  const ownerTrimmed = (owner ?? '').trim()

  return (
    <div
      className="weapons-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="weapons-dialog weapons-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weapons-deliver-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="weapons-deliver-title" className="weapons-dialog__title">
          {isEdit ? 'Editar entrega' : 'Arma entregue — comprovante'}
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
            onRequestComprovante()
          }}
        >
          <fieldset className="weapons-dialog__summary" disabled={busy}>
            <legend>Dados da arma (cadastro)</legend>
            <dl className="weapons-dialog__summary-grid">
              {isEdit ? (
                <label className="weapons-dialog__field weapons-dialog__field--in-summary">
                  <span>Dono / recebedor</span>
                  <input
                    type="text"
                    value={owner}
                    onChange={(e) => onOwnerChange(e.target.value)}
                    placeholder="Nome de quem recebeu a arma"
                    autoComplete="off"
                    required
                  />
                </label>
              ) : (
                <div>
                  <dt>Dono / recebedor</dt>
                  <dd>{ownerTrimmed || '—'}</dd>
                </div>
              )}
              <div>
                <dt>Tipo / espécie</dt>
                <dd>{weaponSummary.type}</dd>
              </div>
              <div>
                <dt>Marca</dt>
                <dd>{weaponSummary.brand}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{weaponSummary.model}</dd>
              </div>
              <div>
                <dt>Calibre</dt>
                <dd>{weaponSummary.caliber}</dd>
              </div>
              <div>
                <dt>Nº de série</dt>
                <dd>{weaponSummary.serial}</dd>
              </div>
            </dl>
          </fieldset>

          <fieldset className="weapons-dialog__fieldset" disabled={busy}>
            <legend>Documentos do recebedor</legend>
            <label className="weapons-dialog__field">
              <span>RG</span>
              <input
                type="text"
                value={rg}
                onChange={(e) => onRgChange(e.target.value)}
                placeholder="Número do RG"
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field">
              <span>CPF</span>
              <input
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => onCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field">
              <span>Nº SINARM/SIGMA</span>
              <input
                type="text"
                value={sigmaSinarm}
                onChange={(e) => onSigmaSinarmChange(e.target.value)}
                placeholder="Registro SIGMA ou SINARM"
                autoComplete="off"
                required
              />
            </label>
          </fieldset>

          <fieldset className="weapons-dialog__fieldset" disabled={busy}>
            <legend>Entrega</legend>
            <label className="weapons-dialog__field">
              <span>Responsável pela retirada (loja)</span>
              <input
                type="text"
                value={responsible}
                onChange={(e) => onResponsibleChange(e.target.value)}
                placeholder="Nome do responsável"
                autoComplete="off"
              />
            </label>
            <label className="weapons-dialog__field">
              <span>Data da retirada</span>
              <input
                type="date"
                value={withdrawDate}
                onChange={(e) => onWithdrawDateChange(e.target.value)}
                required
              />
            </label>
          </fieldset>

          <div className="weapons-dialog__actions">
            <button type="button" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" disabled={busy || !ownerTrimmed}>
              {busy ? 'Gerando PDF…' : 'Gerar comprovante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
