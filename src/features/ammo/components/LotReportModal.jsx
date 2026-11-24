import { useMemo, useState } from 'react'
import { buildLotReport } from '../lotReport.js'
import { downloadLotReportPdf } from '../lotReportPdf.js'
import { PRODUCT_TYPE_KEYS, productTypeLabel } from '../productTypes.js'

/** Relatório de estoque atual por lote: tipo → calibre → produto → lotes. */
export function LotReportModal({ open, onClose, stockRows, lotIndex, onOpenProductLots }) {
  const [productType, setProductType] = useState('')
  const [hideZero, setHideZero] = useState(true)
  const [onlyPending, setOnlyPending] = useState(false)

  const report = useMemo(() => {
    const base = buildLotReport({ stockRows, lotIndex, productType, hideZero })
    if (!onlyPending) return base
    const groups = base.groups
      .map((g) => ({
        ...g,
        calibers: g.calibers
          .map((c) => ({ ...c, products: c.products.filter((p) => p.semLote > 0) }))
          .filter((c) => c.products.length > 0),
      }))
      .filter((g) => g.calibers.length > 0)
    return { ...base, groups }
  }, [stockRows, lotIndex, productType, hideZero, onlyPending])

  if (!open) return null

  const filterDescription = [
    productType ? productTypeLabel(productType) : '',
    onlyPending ? 'só produtos com saldo sem lote' : '',
  ]
    .filter(Boolean)
    .join(' · ')

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
        aria-labelledby="stock-lot-report-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="stock-report__head">
          <h2 id="stock-lot-report-title" className="stock-report__title">
            Estoque por lote
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
          Estoque atual de cada produto separado por lote. A soma dos lotes é o
          total do produto. &quot;Sem lote&quot; é o saldo antigo que ainda não
          foi distribuído.
        </p>

        <div className="stock-report__filters stock-lot-report__filters">
          <label className="stock-report__field">
            <span>Tipo</span>
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">Todos os tipos</option>
              {PRODUCT_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {productTypeLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-lot-report__check">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
            />
            Esconder produtos zerados
          </label>
          <label className="stock-lot-report__check">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
            Só o que falta distribuir
          </label>
          <button
            type="button"
            className="stock-report__pdf-btn"
            onClick={() => downloadLotReportPdf({ report, filterDescription })}
            disabled={report.groups.length === 0}
          >
            Exportar PDF
          </button>
        </div>

        <p className="stock-lot-report__summary" role="status">
          {report.productCount} produtos · {report.lotCount} lotes ·{' '}
          {report.totalStock} em estoque
          {report.totalSemLote > 0 ? (
            <strong>
              {' '}
              · {report.totalSemLote} ainda sem lote em {report.pendingProducts}{' '}
              {report.pendingProducts === 1 ? 'produto' : 'produtos'}
            </strong>
          ) : (
            ' · tudo distribuído em lotes'
          )}
        </p>

        {report.groups.length === 0 ? (
          <p className="stock-report__intro">Nada para mostrar com estes filtros.</p>
        ) : (
          <div className="stock-lot-report__body">
            {report.groups.map((g) => (
              <section key={g.typeKey} className="stock-lot-report__type">
                <h3>{g.typeLabel}</h3>
                {g.calibers.map((c) => (
                  <div key={c.caliber} className="stock-lot-report__caliber">
                    <h4>{c.caliber}</h4>
                    <table className="stock-lot-report__table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Lote</th>
                          <th className="stock-lots__num">Qtd. no lote</th>
                          <th className="stock-lots__num">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.products.map((p) => {
                          const lots = p.lots.length
                            ? p.lots
                            : [{ lot_number: null, stock: 0 }]
                          return lots.map((l, i) => (
                            <tr
                              key={`${p.ammo_type_id}-${l.lot_number ?? ''}`}
                              className={i === 0 ? 'stock-lot-report__first' : ''}
                            >
                              {i === 0 ? (
                                <td rowSpan={lots.length}>
                                  {onOpenProductLots ? (
                                    <button
                                      type="button"
                                      className="stock-lot-report__product"
                                      onClick={() => onOpenProductLots(p.ammo_type_id)}
                                      title="Abrir lotes deste produto"
                                    >
                                      {p.ammo_name}
                                    </button>
                                  ) : (
                                    p.ammo_name
                                  )}
                                </td>
                              ) : null}
                              <td
                                className={
                                  l.lot_number == null ? 'stock-lots__pending-text' : ''
                                }
                              >
                                {l.lot_number ?? 'Sem lote'}
                              </td>
                              <td className="stock-lots__num">{l.stock}</td>
                              {i === 0 ? (
                                <td rowSpan={lots.length} className="stock-lots__num">
                                  <strong>{p.stock}</strong>
                                </td>
                              ) : null}
                            </tr>
                          ))
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
