/**
 * Relatório: armas em estoque (loja vs dono fixo); retiradas filtradas pelo período.
 */
export function WeaponsReportModal({
  open,
  onClose,
  loading,
  reportFrom,
  reportTo,
  onReportFromChange,
  onReportToChange,
  reportError,
  inStockShopRows,
  inStockFixedOwnerRows,
  soldRows,
  onExportPdf,
}) {
  if (!open) return null

  return (
    <div
      className="stock-dialog-backdrop stock-dialog-backdrop--report"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="stock-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weapons-report-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="stock-report__head">
          <h2 id="weapons-report-title" className="stock-report__title">
            Relatório de armas
          </h2>
          <button
            type="button"
            className="stock-report__close"
            onClick={onClose}
            aria-label="Fechar relatório"
          >
            ×
          </button>
        </div>
        <p className="stock-report__intro">
          <strong>Estoque da loja / dono fixo:</strong> todas as armas com situação
          &quot;em estoque&quot;, separadas por dono (loja = texto &quot;estoque&quot; no
          cadastro).{' '}
          <strong>Vendidas / retiradas:</strong> apenas saídas cuja data está no período
          abaixo (registro em notas ou atualização do cadastro). Padrão do período: dia 1
          do mês até hoje. Armas em &quot;para compra&quot; ou &quot;aguardando
          chegada&quot; (vendidas e ainda não no estoque) não entram neste relatório.
        </p>
        <form className="stock-report__filters" onSubmit={(e) => e.preventDefault()}>
          <label className="stock-report__field">
            <span>Data inicial</span>
            <input
              type="date"
              value={reportFrom}
              onChange={(e) => onReportFromChange(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="stock-report__field">
            <span>Data final</span>
            <input
              type="date"
              value={reportTo}
              onChange={(e) => onReportToChange(e.target.value)}
              disabled={loading}
            />
          </label>
        </form>
        {reportError ? (
          <p className="stock-report__error" role="alert">
            {reportError}
          </p>
        ) : null}
        {loading ? (
          <p className="stock-report__error" style={{ color: 'var(--text-muted)' }}>
            Carregando…
          </p>
        ) : null}
        <div className="stock-report__hierarchy-wrap">
          <section
            className="stock-report-hierarchy-type"
            aria-labelledby="weapons-report-in-stock-shop"
          >
            <h3
              id="weapons-report-in-stock-shop"
              className="stock-report-hierarchy-type__title"
            >
              ARMAS EM ESTOQUE DA LOJA
            </h3>
            <div className="stock-report__table-wrap">
              <table className="stock-report-table stock-report-table--nested stock-report-table--weapons">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Marca</th>
                    <th>Tipo</th>
                    <th>Calibre</th>
                    <th>Nº série</th>
                    <th>Dono</th>
                    <th>Responsável (retirada)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportError ? (
                    <tr>
                      <td colSpan={7} className="stock-report-table__empty">
                        Ajuste as datas para visualizar.
                      </td>
                    </tr>
                  ) : inStockShopRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="stock-report-table__empty">
                        Nenhuma arma em estoque da loja.
                      </td>
                    </tr>
                  ) : (
                    inStockShopRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.model}</td>
                        <td>{r.brand}</td>
                        <td>{r.type}</td>
                        <td>{r.caliber}</td>
                        <td>{r.serial}</td>
                        <td>{r.owner}</td>
                        <td>—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="stock-report-hierarchy-type"
            aria-labelledby="weapons-report-in-stock-fixed"
          >
            <h3
              id="weapons-report-in-stock-fixed"
              className="stock-report-hierarchy-type__title"
            >
              ARMAS COM DONO FIXO (em estoque)
            </h3>
            <div className="stock-report__table-wrap">
              <table className="stock-report-table stock-report-table--nested stock-report-table--weapons">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Marca</th>
                    <th>Tipo</th>
                    <th>Calibre</th>
                    <th>Nº série</th>
                    <th>Dono</th>
                    <th>Responsável (retirada)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportError ? (
                    <tr>
                      <td colSpan={7} className="stock-report-table__empty">
                        Ajuste as datas para visualizar.
                      </td>
                    </tr>
                  ) : inStockFixedOwnerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="stock-report-table__empty">
                        Nenhuma arma com dono fixo em estoque.
                      </td>
                    </tr>
                  ) : (
                    inStockFixedOwnerRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.model}</td>
                        <td>{r.brand}</td>
                        <td>{r.type}</td>
                        <td>{r.caliber}</td>
                        <td>{r.serial}</td>
                        <td>{r.owner}</td>
                        <td>—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="stock-report-hierarchy-type"
            aria-labelledby="weapons-report-sold"
          >
            <h3
              id="weapons-report-sold"
              className="stock-report-hierarchy-type__title"
            >
              ARMAS VENDIDAS / RETIRADAS (no período)
            </h3>
            <div className="stock-report__table-wrap">
              <table className="stock-report-table stock-report-table--nested stock-report-table--weapons">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Marca</th>
                    <th>Tipo</th>
                    <th>Calibre</th>
                    <th>Nº série</th>
                    <th>Dono</th>
                    <th>Responsável (retirada)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportError ? (
                    <tr>
                      <td colSpan={7} className="stock-report-table__empty">
                        Ajuste as datas para visualizar.
                      </td>
                    </tr>
                  ) : soldRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="stock-report-table__empty">
                        Nenhuma retirada registrada neste período.
                      </td>
                    </tr>
                  ) : (
                    soldRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.model}</td>
                        <td>{r.brand}</td>
                        <td>{r.type}</td>
                        <td>{r.caliber}</td>
                        <td>{r.serial}</td>
                        <td>{r.owner}</td>
                        <td>{r.responsible}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="stock-report__pdf-actions">
          <button
            type="button"
            className="stock-report__pdf-btn"
            onClick={onExportPdf}
            disabled={loading || !!reportError}
          >
            Exportar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
