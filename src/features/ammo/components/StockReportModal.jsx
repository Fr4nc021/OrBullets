import { PRODUCT_TYPE_KEYS, productTypeLabel } from '../productTypes.js'

/**
 * Modal de relatório hierárquico: tipo → calibre → produtos.
 */
export function StockReportModal({
  open,
  onClose,
  reportFrom,
  reportTo,
  onReportFromChange,
  onReportToChange,
  reportFilterProductType,
  onReportFilterProductTypeChange,
  reportCaliberId,
  onReportCaliberIdChange,
  reportCaliberOptions,
  calibers,
  reportLoading,
  onSubmitReport,
  reportError,
  reportData,
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
        aria-labelledby="stock-report-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="stock-report__head">
          <h2 id="stock-report-title" className="stock-report__title">
            Relatório de estoque
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
          Hierarquia: tipo → calibre → produto. Estoque no início do período,
          entradas e saídas no intervalo, saldo calculado ao fim do período e
          estoque atual.
        </p>
        <form className="stock-report__filters" onSubmit={onSubmitReport}>
          <label className="stock-report__field">
            <span>Data inicial</span>
            <input
              type="date"
              value={reportFrom}
              onChange={(e) => onReportFromChange(e.target.value)}
              disabled={reportLoading}
              required
            />
          </label>
          <label className="stock-report__field">
            <span>Data final</span>
            <input
              type="date"
              value={reportTo}
              onChange={(e) => onReportToChange(e.target.value)}
              disabled={reportLoading}
              required
            />
          </label>
          <label className="stock-report__field">
            <span>Tipo (opcional)</span>
            <select
              value={reportFilterProductType}
              onChange={(e) => onReportFilterProductTypeChange(e.target.value)}
              disabled={reportLoading || calibers.length === 0}
            >
              <option value="">Todos</option>
              {PRODUCT_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {productTypeLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-report__field stock-report__field--grow">
            <span>Calibre (opcional)</span>
            <select
              value={reportCaliberId}
              onChange={(e) => onReportCaliberIdChange(e.target.value)}
              disabled={reportLoading || reportCaliberOptions.length === 0}
            >
              <option value="">Todos neste filtro</option>
              {reportCaliberOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="stock-report__filter-actions">
            <button type="submit" disabled={reportLoading}>
              {reportLoading ? 'Gerando…' : 'Gerar relatório'}
            </button>
          </div>
        </form>
        {reportError ? (
          <p className="stock-report__error" role="alert">
            {reportError}
          </p>
        ) : null}
        {reportData?.groups ? (
          <>
            <div className="stock-report__hierarchy-wrap">
              {reportData.groups.length === 0 ? (
                <p className="stock-report-table__empty">
                  Nenhum dado para o período e filtros.
                </p>
              ) : (
                reportData.groups.map((typeBlock) => (
                  <section
                    key={typeBlock.typeKey}
                    className="stock-report-hierarchy-type"
                  >
                    <h3 className="stock-report-hierarchy-type__title">
                      {String(typeBlock.typeLabel ?? '').toUpperCase()}
                    </h3>
                    {typeBlock.caliberGroups.map((cg) => (
                      <div
                        key={`${typeBlock.typeKey}-${cg.caliberName}`}
                        className="stock-report-hierarchy-caliber"
                      >
                        <h4 className="stock-report-hierarchy-caliber__title">
                          {cg.caliberName}
                        </h4>
                        <div className="stock-report__table-wrap">
                          <table className="stock-report-table stock-report-table--nested">
                            <thead>
                              <tr>
                                <th>Produto</th>
                                <th>Estoque no início</th>
                                <th className="stock-report-table__col-entrada">
                                  Entradas no período
                                </th>
                                <th className="stock-report-table__col-saida">
                                  Saídas no período
                                </th>
                                <th>Saldo fim (cálculo)</th>
                                <th>Estoque atual</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cg.products.map((r) => (
                                <tr
                                  key={r.ammoTypeId}
                                >
                                  <td>{r.nome}</td>
                                  <td>{r.startStock}</td>
                                  <td className="stock-report-table__col-entrada">
                                    {r.periodEntrada}
                                  </td>
                                  <td className="stock-report-table__col-saida">
                                    {r.periodSaida}
                                  </td>
                                  <td>{r.computedEnd}</td>
                                  <td>{r.currentStock}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="stock-report-table__subtotal">
                                <th scope="row">Subtotal calibre</th>
                                <td>{cg.totals.startStock}</td>
                                <td className="stock-report-table__col-entrada">
                                  {cg.totals.periodEntrada}
                                </td>
                                <td className="stock-report-table__col-saida">
                                  {cg.totals.periodSaida}
                                </td>
                                <td>{cg.totals.computedEnd}</td>
                                <td>{cg.totals.currentStock}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    ))}
                    <div className="stock-report-hierarchy-type-total">
                      <table className="stock-report-table stock-report-table--type-total">
                        <tbody>
                          <tr>
                            <th scope="row">
                              Total {typeBlock.typeLabel}
                            </th>
                            <td>{typeBlock.typeTotals.startStock}</td>
                            <td className="stock-report-table__col-entrada">
                              {typeBlock.typeTotals.periodEntrada}
                            </td>
                            <td className="stock-report-table__col-saida">
                              {typeBlock.typeTotals.periodSaida}
                            </td>
                            <td>{typeBlock.typeTotals.computedEnd}</td>
                            <td>{typeBlock.typeTotals.currentStock}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))
              )}
            </div>
            {reportData.groups.length > 0 ? (
              <div className="stock-report__table-wrap stock-report__grand-total-wrap">
                <table className="stock-report-table stock-report-table--grand">
                  <tbody>
                    <tr>
                      <th scope="row">Total geral</th>
                      <td>{reportData.grandTotals.startStock}</td>
                      <td className="stock-report-table__col-entrada">
                        {reportData.grandTotals.periodEntrada}
                      </td>
                      <td className="stock-report-table__col-saida">
                        {reportData.grandTotals.periodSaida}
                      </td>
                      <td>{reportData.grandTotals.computedEnd}</td>
                      <td>{reportData.grandTotals.currentStock}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="stock-report__pdf-actions">
              <button
                type="button"
                className="stock-report__pdf-btn"
                onClick={onExportPdf}
                disabled={!reportData.groups?.length}
              >
                Exportar PDF
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
