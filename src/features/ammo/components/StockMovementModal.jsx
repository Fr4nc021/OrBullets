import { productTypeLabel } from '../productTypes.js'

export function StockMovementModal({
  dialog,
  closeDialog,
  entradaStep,
  entradaProductType,
  entradaCaliber,
  entradaLines,
  entradaNfNumber,
  setEntradaNfNumber,
  selectEntradaProductType,
  selectEntradaCaliber,
  goEntradaBack,
  addEntradaLine,
  removeEntradaLine,
  submitMovement,
  loadingOptions,
  tiposWithAmmo,
  entradaTiposOptions,
  calibersForEntradaTipo,
  saving,
  ammoOptionsForEntradaStep3,
  selectedAmmoId,
  setSelectedAmmoId,
  qtyInput,
  setQtyInput,
  selectRef,
  ammoOptions,
  saidaStep,
  saidaProductType,
  saidaCaliber,
  saidaLines,
  selectSaidaProductType,
  selectSaidaCaliber,
  goSaidaBack,
  addSaidaLine,
  removeSaidaLine,
  requestSaidaTermoPreview,
  calibersForSaidaTipo,
  ammoOptionsForSaidaStep3,
  beginSaidaAnotherProduct,
}) {
  if (!dialog) return null
  return (
    <div
          className="stock-dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog()
          }}
        >
          <div
            className={
              dialog.movementType === 'saida'
                ? 'stock-dialog stock-dialog--saida'
                : 'stock-dialog stock-dialog--entrada'
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {dialog.movementType === 'entrada' ? (
              <>
                <h2 id="stock-dialog-title" className="stock-dialog__title">
                  Registrar entrada
                </h2>
                <label className="stock-dialog__field stock-entrada-panel__nf">
                  <span>Número da NF</span>
                  <input
                    type="text"
                    value={entradaNfNumber}
                    onChange={(e) => setEntradaNfNumber(e.target.value)}
                    disabled={saving}
                    placeholder="Ex.: 123456"
                    autoComplete="off"
                    maxLength={80}
                    required
                  />
                </label>
                <div
                  className="stock-entrada-wizard"
                  aria-label="Etapas da entrada de munição"
                >
                  <div className="stock-entrada-wizard__steps stock-entrada-wizard__steps--3">
                    <div
                      className={
                        entradaStep === 1
                          ? 'stock-entrada-wizard__step stock-entrada-wizard__step--active'
                          : 'stock-entrada-wizard__step stock-entrada-wizard__step--done'
                      }
                    >
                      <span className="stock-entrada-wizard__step-num">1</span>
                      <span className="stock-entrada-wizard__step-label">
                        Tipo
                      </span>
                    </div>
                    <div className="stock-entrada-wizard__connector" aria-hidden />
                    <div
                      className={
                        entradaStep === 2
                          ? 'stock-entrada-wizard__step stock-entrada-wizard__step--active'
                          : entradaStep > 2
                            ? 'stock-entrada-wizard__step stock-entrada-wizard__step--done'
                            : 'stock-entrada-wizard__step'
                      }
                    >
                      <span className="stock-entrada-wizard__step-num">2</span>
                      <span className="stock-entrada-wizard__step-label">
                        Calibre
                      </span>
                    </div>
                    <div className="stock-entrada-wizard__connector" aria-hidden />
                    <div
                      className={
                        entradaStep === 3
                          ? 'stock-entrada-wizard__step stock-entrada-wizard__step--active'
                          : 'stock-entrada-wizard__step'
                      }
                    >
                      <span className="stock-entrada-wizard__step-num">3</span>
                      <span className="stock-entrada-wizard__step-label">
                        Produto
                      </span>
                    </div>
                  </div>

                  {entradaStep === 1 ? (
                    <div className="stock-entrada-panel">
                      <p className="stock-entrada-panel__intro">
                        Escolha o tipo de produto (Munição, Cartucho ou Insumo).
                        Só entram itens já cadastrados na aba Cadastro (tipo →
                        calibre → modelo). Informe também o número da NF no topo.
                      </p>
                      {loadingOptions ? (
                        <p className="stock-entrada-panel__hint">Carregando…</p>
                      ) : (
                        <div
                          className="stock-caliber-grid stock-type-grid"
                          role="listbox"
                          aria-label="Tipos de produto"
                        >
                          {(entradaTiposOptions ?? tiposWithAmmo).map((k) => (
                            <button
                              key={k}
                              type="button"
                              role="option"
                              className="stock-caliber-grid__btn stock-type-grid__btn"
                              onClick={() => selectEntradaProductType(k)}
                              disabled={saving}
                            >
                              {productTypeLabel(k)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="stock-dialog__actions stock-dialog__actions--entrada-only">
                        <button
                          type="button"
                          onClick={closeDialog}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : entradaStep === 2 ? (
                    <div className="stock-entrada-panel">
                      <p className="stock-entrada-panel__intro">
                        Escolha o calibre. Na próxima etapa você verá apenas os
                        produtos cadastrados para ele.
                      </p>
                      <p className="stock-entrada-panel__chip-row">
                        <span className="stock-entrada-panel__chip">
                          Tipo: {productTypeLabel(entradaProductType)}
                        </span>
                      </p>
                      {loadingOptions ? (
                        <p className="stock-entrada-panel__hint">Carregando…</p>
                      ) : calibersForEntradaTipo.length === 0 ? (
                        <p className="stock-entrada-panel__hint">
                          Nenhum produto deste tipo no cadastro. Vá em{' '}
                          <strong>Cadastro</strong>, crie o calibre e o modelo
                          (pode informar quantidade inicial) e volte aqui para
                          dar entrada com NF.
                        </p>
                      ) : (
                        <div
                          className="stock-caliber-grid"
                          role="listbox"
                          aria-label="Calibres com produtos cadastrados"
                        >
                          {calibersForEntradaTipo.map((name) => (
                            <button
                              key={name}
                              type="button"
                              role="option"
                              className="stock-caliber-grid__btn"
                              onClick={() => selectEntradaCaliber(name)}
                              disabled={saving}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="stock-dialog__actions stock-dialog__actions--entrada-only">
                        <button
                          type="button"
                          className="stock-entrada-panel__back"
                          onClick={goEntradaBack}
                          disabled={saving}
                        >
                          ← Voltar
                        </button>
                        <button
                          type="button"
                          onClick={closeDialog}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      className="stock-entrada-panel"
                      onSubmit={submitMovement}
                    >
                      <div className="stock-entrada-panel__head">
                        <button
                          type="button"
                          className="stock-entrada-panel__back"
                          onClick={goEntradaBack}
                          disabled={saving}
                        >
                          ← Voltar
                        </button>
                        <div className="stock-entrada-panel__chips">
                          <p className="stock-entrada-panel__caliber-chip">
                            <span className="stock-entrada-panel__caliber-label">
                              Tipo
                            </span>
                            <span className="stock-entrada-panel__caliber-value">
                              {productTypeLabel(entradaProductType)}
                            </span>
                          </p>
                          <p className="stock-entrada-panel__caliber-chip">
                            <span className="stock-entrada-panel__caliber-label">
                              Calibre
                            </span>
                            <span className="stock-entrada-panel__caliber-value">
                              {entradaCaliber || '—'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <p className="stock-entrada-panel__intro stock-entrada-panel__intro--compact">
                        NF {String(entradaNfNumber ?? '').trim() || '—'}: selecione
                        o produto, informe a quantidade e clique em{' '}
                        <strong>Adicionar à lista</strong>. A data do lançamento
                        é registrada automaticamente ao adicionar. Depois confirme
                        para registrar todas as entradas.
                      </p>
                      <div className="stock-dialog__form stock-dialog__form--entrada-add">
                        <label className="stock-dialog__field">
                          <span>Produto</span>
                          <select
                            ref={selectRef}
                            value={selectedAmmoId}
                            onChange={(e) => setSelectedAmmoId(e.target.value)}
                            disabled={
                              saving ||
                              loadingOptions ||
                              ammoOptionsForEntradaStep3.length === 0
                            }
                          >
                            {loadingOptions ? (
                              <option value="">Carregando…</option>
                            ) : ammoOptionsForEntradaStep3.length === 0 ? (
                              <option value="">
                                Nenhum produto neste calibre
                              </option>
                            ) : (
                              ammoOptionsForEntradaStep3.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.ammo_name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        {selectedAmmoId ? (
                          <p className="stock-entrada-panel__date-preview">
                            Data do lançamento (automática):{' '}
                            {new Date().toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        ) : null}
                        <label className="stock-dialog__field">
                          <span>Quantidade</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={qtyInput}
                            onChange={(e) => setQtyInput(e.target.value)}
                            disabled={
                              saving ||
                              ammoOptionsForEntradaStep3.length === 0
                            }
                            placeholder="Inteiro positivo"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addEntradaLine()
                              }
                            }}
                          />
                        </label>
                        <div className="stock-dialog__saida-add-row">
                          <button
                            type="button"
                            className="stock-dialog__btn-add-line stock-dialog__btn-add-line--entrada"
                            onClick={addEntradaLine}
                            disabled={
                              saving ||
                              ammoOptionsForEntradaStep3.length === 0 ||
                              !selectedAmmoId
                            }
                          >
                            Adicionar à lista
                          </button>
                        </div>
                      </div>
                      {entradaLines.length > 0 ? (
                        <div className="stock-entrada-list">
                          <h3 className="stock-entrada-list__title">
                            Itens desta entrada
                          </h3>
                          <div className="stock-entrada-list__table-wrap">
                            <table className="stock-entrada-list__table">
                              <thead>
                                <tr>
                                  <th>Tipo</th>
                                  <th>Nome</th>
                                  <th>Calibre</th>
                                  <th>Qtd.</th>
                                  <th>Data de lançamento</th>
                                  <th aria-label="Remover" />
                                </tr>
                              </thead>
                              <tbody>
                                {entradaLines.map((line) => (
                                  <tr key={line.id}>
                                    <td>{line.productTypeLabel}</td>
                                    <td>{line.ammoName}</td>
                                    <td>{line.caliber}</td>
                                    <td className="stock-entrada-list__qty">
                                      {line.quantity}
                                    </td>
                                    <td className="stock-entrada-list__date">
                                      {new Date(
                                        line.lancamentoAt,
                                      ).toLocaleString('pt-BR', {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      })}
                                    </td>
                                    <td className="stock-entrada-list__actions">
                                      <button
                                        type="button"
                                        className="stock-entrada-list__remove"
                                        onClick={() =>
                                          removeEntradaLine(line.id)
                                        }
                                        disabled={saving}
                                        aria-label={`Remover ${line.ammoName}`}
                                      >
                                        Remover
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="stock-entrada-list__empty">
                          Nenhum item na lista. Adicione pelo menos um tipo de
                          munição.
                        </p>
                      )}
                      <div className="stock-dialog__actions stock-dialog__actions--entrada">
                        <button
                          type="button"
                          onClick={closeDialog}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={
                            saving ||
                            ammoOptions.length === 0 ||
                            entradaLines.length === 0 ||
                            !String(entradaNfNumber ?? '').trim()
                          }
                        >
                          {saving ? 'Salvando…' : 'Registrar entradas'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 id="stock-dialog-title" className="stock-dialog__title">
                  Registrar saída
                </h2>
                <div
                  className="stock-saida-wizard"
                  aria-label="Etapas da saída de munição"
                >
                  <div className="stock-saida-wizard__steps stock-saida-wizard__steps--3">
                    <div
                      className={
                        saidaStep === 1
                          ? 'stock-saida-wizard__step stock-saida-wizard__step--active'
                          : 'stock-saida-wizard__step stock-saida-wizard__step--done'
                      }
                    >
                      <span className="stock-saida-wizard__step-num">1</span>
                      <span className="stock-saida-wizard__step-label">
                        Tipo
                      </span>
                    </div>
                    <div className="stock-saida-wizard__connector" aria-hidden />
                    <div
                      className={
                        saidaStep === 2
                          ? 'stock-saida-wizard__step stock-saida-wizard__step--active'
                          : saidaStep > 2
                            ? 'stock-saida-wizard__step stock-saida-wizard__step--done'
                            : 'stock-saida-wizard__step'
                      }
                    >
                      <span className="stock-saida-wizard__step-num">2</span>
                      <span className="stock-saida-wizard__step-label">
                        Calibre
                      </span>
                    </div>
                    <div className="stock-saida-wizard__connector" aria-hidden />
                    <div
                      className={
                        saidaStep === 3
                          ? 'stock-saida-wizard__step stock-saida-wizard__step--active'
                          : 'stock-saida-wizard__step'
                      }
                    >
                      <span className="stock-saida-wizard__step-num">3</span>
                      <span className="stock-saida-wizard__step-label">
                        Produto
                      </span>
                    </div>
                  </div>

                  {saidaStep === 1 ? (
                    <div className="stock-saida-panel">
                      {saidaLines.length > 0 ? (
                        <p
                          className="stock-saida-panel__resume"
                          role="status"
                        >
                          Esta saída já tem {saidaLines.length}{' '}
                          {saidaLines.length === 1 ? 'item' : 'itens'}. Escolha
                          o tipo para incluir outro produto.
                        </p>
                      ) : null}
                      <p className="stock-saida-panel__intro">
                        Escolha o tipo de produto. Em seguida, calibre e item.
                      </p>
                      {loadingOptions ? (
                        <p className="stock-saida-panel__hint">Carregando…</p>
                      ) : tiposWithAmmo.length === 0 ? (
                        <p className="stock-saida-panel__hint">
                          Cadastre produtos primeiro.
                        </p>
                      ) : (
                        <div
                          className="stock-caliber-grid stock-caliber-grid--saida stock-type-grid"
                          role="listbox"
                          aria-label="Tipos de produto"
                        >
                          {tiposWithAmmo.map((k) => (
                            <button
                              key={k}
                              type="button"
                              role="option"
                              className="stock-caliber-grid__btn stock-caliber-grid__btn--saida stock-type-grid__btn"
                              onClick={() => selectSaidaProductType(k)}
                              disabled={saving}
                            >
                              {productTypeLabel(k)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="stock-dialog__actions stock-dialog__actions--saida-only">
                        <button
                          type="button"
                          onClick={closeDialog}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : saidaStep === 2 ? (
                    <div className="stock-saida-panel">
                      {saidaLines.length > 0 ? (
                        <p
                          className="stock-saida-panel__resume"
                          role="status"
                        >
                          {saidaLines.length}{' '}
                          {saidaLines.length === 1 ? 'item na lista' : 'itens na lista'}
                          . Escolha o calibre do próximo produto.
                        </p>
                      ) : null}
                      <p className="stock-saida-panel__intro">
                        Escolha o calibre. Na próxima etapa você verá os produtos
                        cadastrados para ele.
                      </p>
                      <p className="stock-saida-panel__chip-row">
                        <span className="stock-saida-panel__chip">
                          Tipo: {productTypeLabel(saidaProductType)}
                        </span>
                      </p>
                      {loadingOptions ? (
                        <p className="stock-saida-panel__hint">Carregando…</p>
                      ) : calibersForSaidaTipo.length === 0 ? (
                        <p className="stock-saida-panel__hint">
                          Nenhum calibre neste tipo.
                        </p>
                      ) : (
                        <div
                          className="stock-caliber-grid stock-caliber-grid--saida"
                          role="listbox"
                          aria-label="Calibres com produtos cadastrados"
                        >
                          {calibersForSaidaTipo.map((name) => (
                            <button
                              key={name}
                              type="button"
                              role="option"
                              className="stock-caliber-grid__btn stock-caliber-grid__btn--saida"
                              onClick={() => selectSaidaCaliber(name)}
                              disabled={saving}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="stock-dialog__actions stock-dialog__actions--saida-only">
                        <button
                          type="button"
                          className="stock-saida-panel__back"
                          onClick={goSaidaBack}
                          disabled={saving}
                        >
                          ← Voltar
                        </button>
                        <button
                          type="button"
                          onClick={closeDialog}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="stock-saida-panel">
                      <div className="stock-saida-panel__head">
                        <button
                          type="button"
                          className="stock-saida-panel__back"
                          onClick={goSaidaBack}
                          disabled={saving}
                        >
                          ← Voltar
                        </button>
                        <div className="stock-saida-panel__chips">
                          <p className="stock-saida-panel__caliber-chip">
                            <span className="stock-saida-panel__caliber-label">
                              Tipo
                            </span>
                            <span className="stock-saida-panel__caliber-value">
                              {productTypeLabel(saidaProductType)}
                            </span>
                          </p>
                          <p className="stock-saida-panel__caliber-chip">
                            <span className="stock-saida-panel__caliber-label">
                              Calibre
                            </span>
                            <span className="stock-saida-panel__caliber-value">
                              {saidaCaliber || '—'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <p className="stock-saida-panel__intro stock-saida-panel__intro--compact">
                        Selecione o produto, informe a quantidade e clique em{' '}
                        <strong>Adicionar à lista</strong>. A data do lançamento
                        é registrada automaticamente ao adicionar. Ao confirmar,
                        as saídas são registradas e o termo em PDF é gerado.
                      </p>
                      <div className="stock-dialog__form stock-dialog__form--saida-add">
                        <label className="stock-dialog__field">
                          <span>Produto</span>
                          <select
                            ref={selectRef}
                            value={selectedAmmoId}
                            onChange={(e) => setSelectedAmmoId(e.target.value)}
                            disabled={
                              saving ||
                              loadingOptions ||
                              ammoOptionsForSaidaStep3.length === 0
                            }
                          >
                            {loadingOptions ? (
                              <option value="">Carregando…</option>
                            ) : ammoOptionsForSaidaStep3.length === 0 ? (
                              <option value="">
                                Nenhum produto neste calibre
                              </option>
                            ) : (
                              ammoOptionsForSaidaStep3.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.ammo_name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        {selectedAmmoId ? (
                          <p className="stock-saida-panel__date-preview">
                            Data do lançamento (automática):{' '}
                            {new Date().toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        ) : null}
                        <label className="stock-dialog__field">
                          <span>Quantidade</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={qtyInput}
                            onChange={(e) => setQtyInput(e.target.value)}
                            disabled={
                              saving || ammoOptionsForSaidaStep3.length === 0
                            }
                            placeholder="Inteiro positivo"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addSaidaLine()
                              }
                            }}
                          />
                        </label>
                        <div className="stock-dialog__saida-add-row">
                          <button
                            type="button"
                            className="stock-dialog__btn-add-line"
                            onClick={addSaidaLine}
                            disabled={
                              saving ||
                              ammoOptionsForSaidaStep3.length === 0 ||
                              !selectedAmmoId
                            }
                          >
                            Adicionar à lista
                          </button>
                          <button
                            type="button"
                            className="stock-dialog__btn-saida-another"
                            onClick={beginSaidaAnotherProduct}
                            disabled={saving}
                          >
                            Adicionar outro produto
                          </button>
                        </div>
                      </div>
                      {saidaLines.length > 0 ? (
                        <div className="stock-saida-list stock-saida-list--detailed">
                          <h3 className="stock-saida-list__title">
                            Itens desta saída
                          </h3>
                          <div className="stock-saida-list__table-wrap">
                            <table className="stock-saida-list__table">
                              <thead>
                                <tr>
                                  <th>Tipo</th>
                                  <th>Nome</th>
                                  <th>Calibre</th>
                                  <th>Qtd.</th>
                                  <th>Data de lançamento</th>
                                  <th aria-label="Remover" />
                                </tr>
                              </thead>
                              <tbody>
                                {saidaLines.map((line) => (
                                  <tr key={line.id}>
                                    <td>{line.productTypeLabel ?? '—'}</td>
                                    <td>
                                      {line.ammoName ?? line.fullName}
                                    </td>
                                    <td>{line.caliber ?? '—'}</td>
                                    <td className="stock-saida-list__qty">
                                      {line.quantity}
                                    </td>
                                    <td className="stock-saida-list__date">
                                      {line.lancamentoAt
                                        ? new Date(
                                            line.lancamentoAt,
                                          ).toLocaleString('pt-BR', {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                          })
                                        : '—'}
                                    </td>
                                    <td className="stock-saida-list__actions">
                                      <button
                                        type="button"
                                        className="stock-saida-list__remove"
                                        onClick={() =>
                                          removeSaidaLine(line.id)
                                        }
                                        disabled={saving}
                                        aria-label={`Remover ${line.fullName}`}
                                      >
                                        Remover
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="stock-saida-list__empty">
                          Nenhum item na lista. Adicione pelo menos um tipo de
                          munição.
                        </p>
                      )}
                      <div className="stock-dialog__actions stock-dialog__actions--saida">
                        <button
                          type="button"
                          onClick={closeDialog}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={requestSaidaTermoPreview}
                          disabled={
                            saving ||
                            ammoOptions.length === 0 ||
                            saidaLines.length === 0
                          }
                        >
                          Ver termo PDF e confirmar saída
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
  )
}

