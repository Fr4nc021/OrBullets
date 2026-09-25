import { useState } from 'react'
import { productTypeLabel } from '../ammo/productTypes.js'
import {
  downloadLowStockReportPdf,
  getLowStockReportPdfBlob,
  lowStockShortfall,
  sortLowStockItems,
} from './lowStockReportPdf.js'
import './SettingsPage.css'

function formatQty(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR')
}

function blobToBase64Pdf(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') {
        reject(new Error('Leitura do PDF falhou.'))
        return
      }
      const i = dataUrl.indexOf(',')
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl)
    }
    reader.onerror = () =>
      reject(reader.error ?? new Error('Leitura do PDF falhou.'))
    reader.readAsDataURL(blob)
  })
}

async function printPdfBlob(blob) {
  const desktop = typeof window !== 'undefined' ? window.orbDesktop : undefined
  if (desktop?.printPdfFromBase64) {
    const base64 = await blobToBase64Pdf(blob)
    const result = await desktop.printPdfFromBase64(base64)
    if (result?.ok) return
  }

  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'Relatório de estoque baixo')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.src = url
  document.body.appendChild(frame)
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      /* o utilizador ainda pode baixar o PDF */
    }
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      frame.remove()
    }, 60_000)
  }
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} [props.titleId]
 * @param {{ name: string, caliber: string, productType?: string, quantity: number }[]} props.items
 * @param {number} [props.threshold]
 * @param {boolean} [props.loading]
 * @param {string} [props.error]
 * @param {string} [props.dismissLabel]
 * @param {'dialog' | 'alertdialog'} [props.role]
 * @param {() => void} props.onDismiss
 */
export function LowStockAlertDialog({
  open,
  titleId = 'low-stock-alert-title',
  items,
  threshold,
  loading = false,
  error = '',
  dismissLabel = 'Fechar',
  role = 'dialog',
  onDismiss,
}) {
  const [pdfBusy, setPdfBusy] = useState(/** @type {'' | 'print' | 'download'} */ (''))
  const [pdfError, setPdfError] = useState('')

  if (!open) return null

  const sorted = sortLowStockItems(items)
  const minLabel =
    threshold != null && Number.isFinite(Number(threshold))
      ? formatQty(threshold)
      : null
  const canExport = !loading && !error && sorted.length > 0

  async function handleDownload() {
    setPdfError('')
    setPdfBusy('download')
    try {
      downloadLowStockReportPdf({ items: sorted, threshold })
    } catch (err) {
      setPdfError(err?.message || 'Não foi possível gerar o PDF.')
    } finally {
      setPdfBusy('')
    }
  }

  async function handlePrint() {
    setPdfError('')
    setPdfBusy('print')
    try {
      const { blob } = getLowStockReportPdfBlob({ items: sorted, threshold })
      await printPdfBlob(blob)
    } catch (err) {
      setPdfError(err?.message || 'Não foi possível abrir a impressão.')
    } finally {
      setPdfBusy('')
    }
  }

  return (
    <div
      className="low-stock-alert-backdrop"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        className={
          canExport ? 'low-stock-alert' : 'low-stock-alert low-stock-alert--compact'
        }
        role={role}
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-desc`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="low-stock-alert__head">
          <span className="low-stock-alert__mark" aria-hidden>
            !
          </span>
          <div>
            <h2 id={titleId} className="low-stock-alert__title">
              Estoque baixo
            </h2>
            <p
              id={`${titleId}-desc`}
              className={
                error && !loading
                  ? 'low-stock-alert__lead low-stock-alert__lead--error'
                  : 'low-stock-alert__lead'
              }
              role={error && !loading ? 'alert' : undefined}
            >
              {loading
                ? 'A carregar…'
                : error
                  ? error
                  : sorted.length === 0
                    ? `Nenhuma munição abaixo do estoque mínimo${minLabel ? ` (${minLabel})` : ''}, nem zerada.`
                    : `${sorted.length} ${sorted.length === 1 ? 'item' : 'itens'} abaixo do estoque mínimo${minLabel ? ` (${minLabel} un.)` : ''}, inclusive quantidade 0.`}
            </p>
          </div>
        </header>

        {!loading && !error && sorted.length > 0 ? (
          <div className="low-stock-alert__table-wrap">
            <table className="low-stock-alert__table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Produto</th>
                  <th>Calibre</th>
                  <th className="low-stock-alert__num">Qtd.</th>
                  <th className="low-stock-alert__num">Faltam</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const shortfall = lowStockShortfall(item.quantity, threshold)
                  return (
                    <tr key={`${item.productType}-${item.caliber}-${item.name}`}>
                      <td>{productTypeLabel(item.productType)}</td>
                      <td>{item.name}</td>
                      <td>{item.caliber || '—'}</td>
                      <td className="low-stock-alert__num low-stock-alert__qty">
                        {formatQty(item.quantity)}
                      </td>
                      <td className="low-stock-alert__num low-stock-alert__short">
                        {formatQty(shortfall)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {pdfError ? (
          <p className="low-stock-alert__pdf-error" role="alert">
            {pdfError}
          </p>
        ) : null}

        <div className="low-stock-alert__actions">
          <button
            type="button"
            className="low-stock-alert__btn low-stock-alert__btn--ghost"
            onClick={onDismiss}
          >
            {dismissLabel}
          </button>
          {canExport ? (
            <div className="low-stock-alert__actions-end">
              <button
                type="button"
                className="low-stock-alert__btn low-stock-alert__btn--ghost"
                onClick={() => void handleDownload()}
                disabled={Boolean(pdfBusy)}
              >
                {pdfBusy === 'download' ? 'A gerar…' : 'Baixar PDF'}
              </button>
              <button
                type="button"
                className="low-stock-alert__btn"
                onClick={() => void handlePrint()}
                disabled={Boolean(pdfBusy)}
              >
                {pdfBusy === 'print' ? 'A abrir…' : 'Imprimir'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
