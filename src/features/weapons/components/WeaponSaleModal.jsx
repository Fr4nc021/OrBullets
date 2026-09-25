import { VENDA_DOC_PROCESSES } from '../weaponVendaHelpers.js'

/**
 * Formulário de venda de arma (PDF + registro para_compra).
 * Documentos são só para o comprovante.
 */
export function WeaponSaleModal({
  open,
  weaponTypes,
  weaponBrands,
  calibers,
  loadingMeta,
  loadingCalibers,
  caliberDisplayById,
  values,
  onChange,
  onToggleDocProcess,
  busy,
  validationError,
  cepLookingUp = false,
  onClose,
  onRequestPdf,
  onRequestTestPrint,
}) {
  if (!open) return null

  const v = values ?? {}
  const selected = new Set(v.docProcesses ?? [])
  const hasDocs = selected.size > 0

  function setField(key, value) {
    onChange(key, value)
  }

  return (
    <div
      className="weapons-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="weapons-dialog weapons-dialog--wide weapons-dialog--sale"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weapons-sale-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="weapons-sale-title" className="weapons-dialog__title">
          Registrar venda de arma
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
            onRequestPdf()
          }}
        >
          <fieldset className="weapons-dialog__fieldset" disabled={busy}>
            <legend>Arma</legend>
            <div className="weapons-sale__grid">
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Data da venda</span>
              <input
                type="date"
                value={v.saleDate ?? ''}
                onChange={(e) => setField('saleDate', e.target.value)}
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Tipo / produto</span>
              <select
                value={v.weaponTypeId ?? ''}
                onChange={(e) => setField('weaponTypeId', e.target.value)}
                disabled={loadingMeta || weaponTypes.length === 0}
                required
              >
                {loadingMeta ? (
                  <option value="">Carregando…</option>
                ) : weaponTypes.length === 0 ? (
                  <option value="">Cadastre um tipo em Cadastro</option>
                ) : (
                  weaponTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Marca</span>
              <select
                value={v.brandId ?? ''}
                onChange={(e) => setField('brandId', e.target.value)}
                disabled={loadingMeta || weaponBrands.length === 0}
                required
              >
                {loadingMeta ? (
                  <option value="">Carregando…</option>
                ) : weaponBrands.length === 0 ? (
                  <option value="">Cadastre uma marca em Cadastro</option>
                ) : (
                  weaponBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Modelo</span>
              <input
                type="text"
                value={v.name ?? ''}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ex: G19, 686"
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Calibre</span>
              <select
                value={v.caliberId ?? ''}
                onChange={(e) => setField('caliberId', e.target.value)}
                disabled={loadingCalibers || calibers.length === 0}
                required
              >
                {loadingCalibers ? (
                  <option value="">Carregando…</option>
                ) : calibers.length === 0 ? (
                  <option value="">Cadastre um calibre em Cadastro</option>
                ) : (
                  calibers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {caliberDisplayById?.[c.id] ?? c.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Nº de série (opcional)</span>
              <input
                type="text"
                value={v.serial ?? ''}
                onChange={(e) => setField('serial', e.target.value)}
                placeholder="Pode preencher na aquisição"
                autoComplete="off"
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Valor da arma</span>
              <input
                type="text"
                inputMode="decimal"
                value={v.weaponValue ?? ''}
                onChange={(e) => setField('weaponValue', e.target.value)}
                placeholder="0,00"
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Forma de pagamento</span>
              <input
                type="text"
                value={v.paymentMethod ?? ''}
                onChange={(e) => setField('paymentMethod', e.target.value)}
                placeholder="Ex: Pix, cartão, 3x"
                autoComplete="off"
                required
              />
            </label>
            </div>
          </fieldset>

          <fieldset className="weapons-dialog__fieldset" disabled={busy}>
            <legend>Documentos (somente no PDF)</legend>
            <p className="weapons-dialog__hint">
              Marque os processos que serão realizados. Não altera o controle de
              estoque.
            </p>
            <div className="weapons-dialog__checkboxes">
              {VENDA_DOC_PROCESSES.map((p) => (
                <label key={p.id} className="weapons-dialog__check">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => onToggleDocProcess(p.id)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            <div className="weapons-sale__grid">
            <label className="weapons-dialog__field weapons-sale__span-4">
              <span>Valor a pagar dos documentos</span>
              <input
                type="text"
                inputMode="decimal"
                value={v.docsValue ?? ''}
                onChange={(e) => setField('docsValue', e.target.value)}
                placeholder="0,00"
                autoComplete="off"
                disabled={!hasDocs}
                required={hasDocs}
              />
            </label>
            </div>
          </fieldset>

          <fieldset className="weapons-dialog__fieldset" disabled={busy}>
            <legend>Cliente e vendedor</legend>
            <div className="weapons-sale__grid">
            <label className="weapons-dialog__field weapons-sale__span-6">
              <span>Cliente (comprador)</span>
              <input
                type="text"
                value={v.clientName ?? ''}
                onChange={(e) => setField('clientName', e.target.value)}
                placeholder="Nome completo"
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Identidade (RG)</span>
              <input
                type="text"
                value={v.clientIdentity ?? ''}
                onChange={(e) => setField('clientIdentity', e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>CPF</span>
              <input
                type="text"
                inputMode="numeric"
                value={v.clientCpf ?? ''}
                onChange={(e) => setField('clientCpf', e.target.value)}
                placeholder="000.000.000-00"
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Telefone</span>
              <input
                type="text"
                value={v.clientPhone ?? ''}
                onChange={(e) => setField('clientPhone', e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>CEP</span>
              <input
                type="text"
                inputMode="numeric"
                value={v.clientCep ?? ''}
                onChange={(e) => setField('clientCep', e.target.value)}
                placeholder="00000-000"
                autoComplete="postal-code"
              />
              {cepLookingUp ? (
                <span className="weapons-dialog__field-hint">Buscando endereço…</span>
              ) : (
                <span className="weapons-dialog__field-hint">
                  Ao completar o CEP, rua, bairro e cidade são preenchidos.
                </span>
              )}
            </label>
            <label className="weapons-dialog__field weapons-sale__span-4">
              <span>Endereço</span>
              <input
                type="text"
                value={v.clientAddress ?? ''}
                onChange={(e) => setField('clientAddress', e.target.value)}
                autoComplete="street-address"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-2">
              <span>Nº</span>
              <input
                type="text"
                value={v.clientNumber ?? ''}
                onChange={(e) => setField('clientNumber', e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Bairro</span>
              <input
                type="text"
                value={v.clientNeighborhood ?? ''}
                onChange={(e) => setField('clientNeighborhood', e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Cidade</span>
              <input
                type="text"
                value={v.clientCity ?? ''}
                onChange={(e) => setField('clientCity', e.target.value)}
                autoComplete="address-level2"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-3">
              <span>Vendedor</span>
              <input
                type="text"
                value={v.seller ?? ''}
                onChange={(e) => setField('seller', e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label className="weapons-dialog__field weapons-sale__span-6">
              <span>OBS</span>
              <textarea
                value={v.obs ?? ''}
                onChange={(e) => setField('obs', e.target.value)}
                rows={2}
                placeholder="Opcional"
              />
            </label>
            </div>
          </fieldset>

          <div className="weapons-dialog__actions">
            <button type="button" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="weapons-dialog__btn-test"
              onClick={onRequestTestPrint}
              disabled={busy}
            >
              {busy ? 'Gerando PDF…' : 'Imprimir teste'}
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Gerando PDF…' : 'Gerar documento de venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
