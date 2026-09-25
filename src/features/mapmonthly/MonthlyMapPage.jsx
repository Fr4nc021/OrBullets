import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteMonthlySnapshot,
  getAllMonthlySnapshots,
  putMonthlySnapshot,
} from '../../services/monthlyMapStorage.js'
import {
  formatMonthLabelPt,
  monthKeyFromYearMonth,
  parseMonthKey,
} from './monthlyMapMonth.js'
import {
  generateArmasMonthlyPdf,
  generateEstoqueMonthlyPdf,
} from './monthlyMapReports.js'
import '../ammo/StockPage.css'
import './MonthlyMapPage.css'

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function yearOptions() {
  const y = new Date().getFullYear()
  const out = []
  for (let i = y - 8; i <= y + 1; i += 1) out.push(i)
  return out
}

export default function MonthlyMapPage() {
  const previewUrlRef = useRef('')
  const [snapshots, setSnapshots] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState('')
  const [busyKind, setBusyKind] = useState('')

  const now = new Date()
  const [pickYear, setPickYear] = useState(now.getFullYear())
  const [pickMonth0, setPickMonth0] = useState(now.getMonth())

  const selectedMonthKey = useMemo(
    () => monthKeyFromYearMonth(pickYear, pickMonth0),
    [pickYear, pickMonth0],
  )
  const selectedLabel = useMemo(
    () => formatMonthLabelPt(selectedMonthKey),
    [selectedMonthKey],
  )

  const [preview, setPreview] = useState(null)

  function revokePreviewUrl() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }
  }

  const refreshList = useCallback(async () => {
    setLoadingList(true)
    setError('')
    try {
      const rows = await getAllMonthlySnapshots()
      rows.sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)))
      setSnapshots(rows)
    } catch (err) {
      setError(err.message ?? 'Erro ao carregar mapa mensal.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  useEffect(() => {
    return () => {
      revokePreviewUrl()
    }
  }, [])

  function openPdfPreview(blob, filename, title) {
    revokePreviewUrl()
    const url = URL.createObjectURL(blob)
    previewUrlRef.current = url
    setPreview({ url, filename, title })
  }

  function closePreview() {
    revokePreviewUrl()
    setPreview(null)
  }

  async function handleSaveEstoque() {
    setBusyKind('estoque')
    setError('')
    try {
      const { blob, filename } = await generateEstoqueMonthlyPdf(selectedMonthKey)
      const savedAt = new Date().toISOString()
      await putMonthlySnapshot({
        monthKey: selectedMonthKey,
        label: selectedLabel,
        estoquePdf: blob,
        estoqueSavedAt: savedAt,
      })
      await refreshList()
    } catch (err) {
      setError(err.message ?? 'Erro ao gerar PDF de estoque.')
    } finally {
      setBusyKind('')
    }
  }

  async function handleSaveArmas() {
    setBusyKind('armas')
    setError('')
    try {
      const { blob, filename } = await generateArmasMonthlyPdf(selectedMonthKey)
      const savedAt = new Date().toISOString()
      await putMonthlySnapshot({
        monthKey: selectedMonthKey,
        label: selectedLabel,
        armasPdf: blob,
        armasSavedAt: savedAt,
      })
      await refreshList()
    } catch (err) {
      setError(err.message ?? 'Erro ao gerar PDF de armas.')
    } finally {
      setBusyKind('')
    }
  }

  async function handleDeleteMonth(monthKey) {
    if (
      !window.confirm(
        `Remover o mapa guardado de ${formatMonthLabelPt(monthKey)}? Os PDFs deste mês serão apagados deste aparelho.`,
      )
    ) {
      return
    }
    setError('')
    try {
      await deleteMonthlySnapshot(monthKey)
      await refreshList()
    } catch (err) {
      setError(err.message ?? 'Erro ao remover.')
    }
  }

  const busy = busyKind !== ''

  return (
    <div className="monthly-map-page">
      <header className="monthly-map-page__header">
        <h1>Mapa mensal</h1>
        <p className="monthly-map-page__subtitle">
          Guarde mês a mês os mesmos PDFs do relatório de estoque (munições) e do
          relatório de armas. Os ficheiros ficam armazenados neste navegador /
          computador (IndexedDB).
        </p>
      </header>

      {error ? (
        <div className="monthly-map-page__message monthly-map-page__message--error" role="alert">
          {error}
        </div>
      ) : null}

      {preview ? (
        <div
          className="stock-dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePreview()
          }}
        >
          <div
            className="stock-termo-dialog monthly-map-page__preview-dialog"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="stock-termo-dialog__head">
              <h2 className="stock-termo-dialog__title">{preview.title}</h2>
              <button
                type="button"
                className="stock-termo-dialog__close"
                onClick={closePreview}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <p className="stock-termo-dialog__hint">
              Pré-visualização do PDF guardado no mapa mensal.
            </p>
            <div className="stock-termo-dialog__frame-wrap">
              <iframe
                className="stock-termo-dialog__frame"
                title="PDF"
                src={preview.url}
              />
            </div>
            <div className="stock-termo-dialog__actions">
              <button type="button" onClick={closePreview}>
                Fechar
              </button>
              <button
                type="button"
                className="stock-termo-dialog__btn-secondary"
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = preview.url
                  a.download = preview.filename
                  a.rel = 'noopener'
                  a.click()
                }}
              >
                Baixar PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section
        className="monthly-map-page__panel monthly-map-page__panel--sticky"
        aria-labelledby="monthly-map-generate"
      >
        <h2 id="monthly-map-generate" className="monthly-map-page__panel-title">
          Gerar e guardar
        </h2>
        <p className="monthly-map-page__panel-hint">
          Escolha o mês e gere cada relatório. Pode guardar só um dos dois ou os
          dois para o mesmo mês.
        </p>
        <div className="monthly-map-page__pickers">
          <label className="monthly-map-page__field">
            <span>Mês</span>
            <select
              value={pickMonth0}
              onChange={(e) => setPickMonth0(Number(e.target.value))}
              disabled={busy}
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="monthly-map-page__field">
            <span>Ano</span>
            <select
              value={pickYear}
              onChange={(e) => setPickYear(Number(e.target.value))}
              disabled={busy}
            >
              {yearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="monthly-map-page__selection-label" aria-live="polite">
          Período: <strong>{selectedLabel}</strong> ({selectedMonthKey})
        </p>
        <div className="monthly-map-page__actions">
          <button
            type="button"
            className="monthly-map-page__btn monthly-map-page__btn--estoque"
            disabled={busy}
            onClick={handleSaveEstoque}
          >
            {busyKind === 'estoque' ? 'Gerando…' : 'Guardar PDF estoque (munições)'}
          </button>
          <button
            type="button"
            className="monthly-map-page__btn monthly-map-page__btn--armas"
            disabled={busy}
            onClick={handleSaveArmas}
          >
            {busyKind === 'armas' ? 'Gerando…' : 'Guardar PDF armas'}
          </button>
        </div>
      </section>

      <section className="monthly-map-page__panel" aria-labelledby="monthly-map-archives">
        <h2 id="monthly-map-archives" className="monthly-map-page__panel-title">
          Mapas guardados
        </h2>
        {loadingList ? (
          <p className="monthly-map-page__empty">Carregando…</p>
        ) : snapshots.length === 0 ? (
          <p className="monthly-map-page__empty">
            Nenhum mês guardado ainda. Use os botões acima para gerar o primeiro mapa.
          </p>
        ) : (
          <div className="monthly-map-page__table-wrap">
            <table className="monthly-map-table">
              <thead>
                <tr>
                  <th>Mês / ano</th>
                  <th>Estoque (munições)</th>
                  <th>Armas</th>
                  <th className="monthly-map-table__actions-head">Ações</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((row) => {
                  const { year, monthIndex0 } = parseMonthKey(row.monthKey)
                  const hasE = row.estoquePdf && row.estoquePdf.size > 0
                  const hasA = row.armasPdf && row.armasPdf.size > 0
                  return (
                    <tr key={row.monthKey}>
                      <td className="monthly-map-table__title">
                        <span className="monthly-map-table__label">{row.label}</span>
                        <span className="monthly-map-table__key">{row.monthKey}</span>
                      </td>
                      <td>
                        {hasE ? (
                          <div className="monthly-map-table__pdf-actions">
                            <button
                              type="button"
                              className="monthly-map-table__linkish"
                              onClick={() =>
                                openPdfPreview(
                                  row.estoquePdf,
                                  `mapa-estoque-${row.monthKey}.pdf`,
                                  `Estoque — ${row.label}`,
                                )
                              }
                            >
                              Abrir PDF
                            </button>
                            {row.estoqueSavedAt ? (
                              <span className="monthly-map-table__saved">
                                {new Intl.DateTimeFormat('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }).format(new Date(row.estoqueSavedAt))}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="monthly-map-table__na">—</span>
                        )}
                      </td>
                      <td>
                        {hasA ? (
                          <div className="monthly-map-table__pdf-actions">
                            <button
                              type="button"
                              className="monthly-map-table__linkish"
                              onClick={() =>
                                openPdfPreview(
                                  row.armasPdf,
                                  `mapa-armas-${row.monthKey}.pdf`,
                                  `Armas — ${row.label}`,
                                )
                              }
                            >
                              Abrir PDF
                            </button>
                            {row.armasSavedAt ? (
                              <span className="monthly-map-table__saved">
                                {new Intl.DateTimeFormat('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }).format(new Date(row.armasSavedAt))}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="monthly-map-table__na">—</span>
                        )}
                      </td>
                      <td className="monthly-map-table__actions">
                        <button
                          type="button"
                          className="monthly-map-table__delete"
                          onClick={() => handleDeleteMonth(row.monthKey)}
                        >
                          Remover mês
                        </button>
                        <button
                          type="button"
                          className="monthly-map-table__reuse"
                          onClick={() => {
                            setPickYear(year)
                            setPickMonth0(monthIndex0)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        >
                          Usar na geração
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
