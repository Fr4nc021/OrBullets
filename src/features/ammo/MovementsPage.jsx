import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteEntradaMovement,
  deleteSaidaMovement,
  fetchRecentAmmoMovements,
  searchAmmoMovements,
  updateAmmoMovement,
} from './ammoApi.js'
import { parseLocalDateEnd, parseLocalDateStart } from './ammoStockReport.js'
import { productTypeLabel } from './productTypes.js'
import { getSaidaTermoPdfBlob } from './saidaTermoPdf.js'
import { SaidaTermoPreviewModal } from './components/SaidaTermoPreviewModal.jsx'
import './MovementsPage.css'
import './StockPage.css'

function formatMovementDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

function isoToDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalToIso(local) {
  if (local == null || String(local).trim() === '') return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseQuantityEdit(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number(String(raw).replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  return n
}

/** Linhas da mesma saída (mesmo termo) para montar o PDF. */
function collectSaidaRowsForTermo(row, allRows) {
  if (row.type !== 'saida') return []
  if (row.saida_group_id) {
    const g = allRows.filter(
      (r) => r.type === 'saida' && r.saida_group_id === row.saida_group_id,
    )
    g.sort((a, b) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      if (da !== db) return da - db
      return String(a.ammo_type_id).localeCompare(String(b.ammo_type_id))
    })
    return g
  }
  return [row]
}

export default function MovementsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const termoPdfUrlRef = useRef('')
  const [termoOpen, setTermoOpen] = useState(false)
  const [termoPdfUrl, setTermoPdfUrl] = useState('')
  const [termoFilename, setTermoFilename] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [filterCaliber, setFilterCaliber] = useState('')
  const [filterNfNumber, setFilterNfNumber] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCaliberDebounced, setFilterCaliberDebounced] = useState('')
  const [filterNfDebounced, setFilterNfDebounced] = useState('')

  function revokeTermoObjectUrl() {
    if (termoPdfUrlRef.current) {
      URL.revokeObjectURL(termoPdfUrlRef.current)
      termoPdfUrlRef.current = ''
    }
  }

  function closeTermoPreview() {
    revokeTermoObjectUrl()
    setTermoPdfUrl('')
    setTermoFilename('')
    setTermoOpen(false)
  }

  useEffect(() => {
    return () => {
      if (termoPdfUrlRef.current) {
        URL.revokeObjectURL(termoPdfUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setFilterCaliberDebounced(filterCaliber.trim())
    }, 350)
    return () => clearTimeout(t)
  }, [filterCaliber])

  useEffect(() => {
    const t = setTimeout(() => {
      setFilterNfDebounced(filterNfNumber.trim())
    }, 350)
    return () => clearTimeout(t)
  }, [filterNfNumber])

  const filterStartMs = filterDateFrom
    ? parseLocalDateStart(filterDateFrom)
    : NaN
  const filterEndMs = filterDateTo ? parseLocalDateEnd(filterDateTo) : NaN

  const filterDateError = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return ''
    if (filterDateFrom && !Number.isFinite(filterStartMs)) {
      return 'Data inicial inválida.'
    }
    if (filterDateTo && !Number.isFinite(filterEndMs)) {
      return 'Data final inválida.'
    }
    if (
      filterDateFrom &&
      filterDateTo &&
      Number.isFinite(filterStartMs) &&
      Number.isFinite(filterEndMs) &&
      filterStartMs > filterEndMs
    ) {
      return 'A data inicial não pode ser posterior à data final.'
    }
    return ''
  }, [filterDateFrom, filterDateTo, filterStartMs, filterEndMs])

  const hasActiveFilters =
    filterCaliberDebounced !== '' ||
    filterNfDebounced !== '' ||
    filterDateFrom !== '' ||
    filterDateTo !== ''

  const load = useCallback(async () => {
    if (filterDateError) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = hasActiveFilters
        ? await searchAmmoMovements({
            caliber: filterCaliberDebounced || undefined,
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
            nfNumber: filterNfDebounced || undefined,
          })
        : await fetchRecentAmmoMovements(200)
      setRows(data)
    } catch (err) {
      setError(err.message ?? 'Erro ao carregar movimentações.')
    } finally {
      setLoading(false)
    }
  }, [
    filterCaliberDebounced,
    filterNfDebounced,
    filterDateFrom,
    filterDateTo,
    filterDateError,
    hasActiveFilters,
  ])

  useEffect(() => {
    load()
  }, [load])

  function clearFilters() {
    setFilterCaliber('')
    setFilterCaliberDebounced('')
    setFilterNfNumber('')
    setFilterNfDebounced('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  function openSaidaTermoForRow(row) {
    const group = collectSaidaRowsForTermo(row, rows)
    if (group.length === 0) return
    const pdfLines = group.map((r) => ({
      quantity: r.quantity,
      caliber: r.caliber,
      product: r.productName,
    }))
    const atMs = Math.min(...group.map((r) => new Date(r.date).getTime()))
    const atDate = new Date(atMs)
    const { blob, filename } = getSaidaTermoPdfBlob(pdfLines, { atDate })
    revokeTermoObjectUrl()
    const url = URL.createObjectURL(blob)
    termoPdfUrlRef.current = url
    setTermoFilename(filename)
    setTermoPdfUrl(url)
    setTermoOpen(true)
  }

  function openEditMovement(row) {
    if (row.id == null) return
    setError('')
    setEditDraft({
      row,
      qtyStr: String(row.quantity),
      dateLocal: isoToDatetimeLocal(row.date),
      nfStr: row.nf_number != null ? String(row.nf_number) : '',
    })
  }

  function closeEditMovement() {
    setEditDraft(null)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editDraft) return
    const qty = parseQuantityEdit(editDraft.qtyStr)
    if (qty === null) {
      setError('Informe uma quantidade inteira positiva.')
      return
    }
    const iso = datetimeLocalToIso(editDraft.dateLocal)
    if (!iso) {
      setError('Informe data e hora válidas.')
      return
    }
    const patch = { quantity: qty, date: iso }
    if (editDraft.row.type === 'entrada') {
      const nf = String(editDraft.nfStr ?? '').trim()
      if (!nf) {
        setError('Informe o número da NF.')
        return
      }
      patch.nf_number = nf
    }
    setSavingEdit(true)
    setError('')
    try {
      await updateAmmoMovement(editDraft.row.id, patch)
      await load()
      closeEditMovement()
    } catch (err) {
      setError(err.message ?? 'Erro ao salvar alterações.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteEntrada(row) {
    if (row.type !== 'entrada' || row.id == null) return
    if (
      !window.confirm(
        'Excluir esta entrada? A quantidade será descontada do estoque.',
      )
    ) {
      return
    }
    setDeletingId(row.id)
    setError('')
    try {
      await deleteEntradaMovement(row.id)
      await load()
    } catch (err) {
      setError(err.message ?? 'Erro ao excluir entrada.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteSaida(row) {
    if (row.type !== 'saida' || row.id == null) return
    const group = collectSaidaRowsForTermo(row, rows)
    const n = group.length
    const msg =
      n > 1
        ? `Excluir esta saída (${n} itens do termo)? As quantidades voltam ao estoque.`
        : 'Excluir esta saída? A quantidade volta ao estoque.'
    if (!window.confirm(msg)) return
    setDeletingId(row.id)
    setError('')
    try {
      await deleteSaidaMovement(row.id)
      await load()
    } catch (err) {
      setError(err.message ?? 'Erro ao excluir saída.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="movements-page">
      <header className="movements-page__header">
        <h1>Movimentações</h1>
        <p className="movements-page__subtitle">
          Últimas entradas e saídas registradas no estoque de munições e
          produtos relacionados
        </p>
      </header>

      <SaidaTermoPreviewModal
        open={termoOpen}
        pdfUrl={termoPdfUrl}
        filename={termoFilename}
        onClose={closeTermoPreview}
        readOnly
        confirming={false}
      />

      {editDraft ? (
        <div
          className="stock-dialog-backdrop"
          role="presentation"
          onClick={closeEditMovement}
        >
          <div
            className="stock-dialog movements-edit-dialog"
            role="dialog"
            aria-labelledby="movements-edit-title"
            aria-modal="true"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="movements-edit-title" className="stock-dialog__title">
              Editar movimentação
            </h2>
            <p className="movements-edit-dialog__meta">
              <span
                className={
                  editDraft.row.type === 'entrada'
                    ? 'movements-table__badge movements-table__badge--entrada'
                    : 'movements-table__badge movements-table__badge--saida'
                }
              >
                {editDraft.row.type === 'entrada' ? 'Entrada' : 'Saída'}
              </span>
              <span className="movements-edit-dialog__meta-line">
                {productTypeLabel(editDraft.row.product_type)} —{' '}
                {editDraft.row.caliber} — {editDraft.row.productName}
              </span>
            </p>
            <form className="stock-dialog__form" onSubmit={handleSaveEdit}>
              <div className="stock-dialog__field">
                <label htmlFor="movements-edit-qty">Quantidade</label>
                <input
                  id="movements-edit-qty"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={editDraft.qtyStr}
                  onChange={(ev) =>
                    setEditDraft((d) =>
                      d ? { ...d, qtyStr: ev.target.value } : d,
                    )
                  }
                  disabled={savingEdit}
                  required
                />
              </div>
              <div className="stock-dialog__field">
                <label htmlFor="movements-edit-when">Data e hora do lançamento</label>
                <input
                  id="movements-edit-when"
                  type="datetime-local"
                  value={editDraft.dateLocal}
                  onChange={(ev) =>
                    setEditDraft((d) =>
                      d ? { ...d, dateLocal: ev.target.value } : d,
                    )
                  }
                  disabled={savingEdit}
                  required
                />
              </div>
              {editDraft.row.type === 'entrada' ? (
                <div className="stock-dialog__field">
                  <label htmlFor="movements-edit-nf">Número da NF</label>
                  <input
                    id="movements-edit-nf"
                    type="text"
                    value={editDraft.nfStr}
                    onChange={(ev) =>
                      setEditDraft((d) =>
                        d ? { ...d, nfStr: ev.target.value } : d,
                      )
                    }
                    disabled={savingEdit}
                    autoComplete="off"
                    maxLength={80}
                    required
                  />
                </div>
              ) : null}
              <div className="stock-dialog__actions">
                <button
                  type="button"
                  onClick={closeEditMovement}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingEdit}>
                  {savingEdit ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="movements-page__message movements-page__message--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="movements-page__toolbar">
        <button
          type="button"
          className="movements-page__refresh"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? 'Carregando…' : 'Atualizar'}
        </button>
      </div>

      <section
        className="stock-page__filters movements-page__filters"
        aria-label="Pesquisar movimentações"
      >
        <h2 className="stock-page__filters-title">Pesquisar</h2>
        <div className="stock-page__filters-row">
          <label className="stock-page__filter-field stock-page__filter-field--grow">
            <span className="stock-page__filter-label">Calibre</span>
            <input
              type="search"
              value={filterCaliber}
              onChange={(ev) => setFilterCaliber(ev.target.value)}
              placeholder="Ex.: 9mm, .38"
              autoComplete="off"
              disabled={loading && rows.length === 0}
              enterKeyHint="search"
            />
          </label>
          <label className="stock-page__filter-field stock-page__filter-field--grow">
            <span className="stock-page__filter-label">Número da NF</span>
            <input
              type="search"
              value={filterNfNumber}
              onChange={(ev) => setFilterNfNumber(ev.target.value)}
              placeholder="Ex.: 123456"
              autoComplete="off"
              disabled={loading && rows.length === 0}
              enterKeyHint="search"
            />
          </label>
          <label className="stock-page__filter-field">
            <span className="stock-page__filter-label">Data inicial</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(ev) => setFilterDateFrom(ev.target.value)}
              disabled={loading && rows.length === 0}
            />
          </label>
          <label className="stock-page__filter-field">
            <span className="stock-page__filter-label">Data final</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(ev) => setFilterDateTo(ev.target.value)}
              disabled={loading && rows.length === 0}
            />
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              className="stock-page__filters-clear"
              onClick={clearFilters}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
        {filterDateError ? (
          <p className="movements-page__filter-hint movements-page__filter-hint--error" role="alert">
            {filterDateError}
          </p>
        ) : hasActiveFilters && !loading ? (
          <p className="movements-page__filter-hint">
            {rows.length}{' '}
            {rows.length === 1
              ? 'movimentação encontrada'
              : 'movimentações encontradas'}{' '}
            em todo o histórico.
          </p>
        ) : !hasActiveFilters && !loading && rows.length > 0 ? (
          <p className="movements-page__filter-hint">
            Exibindo as {rows.length} movimentações mais recentes. Use os filtros
            para pesquisar em todo o histórico.
          </p>
        ) : null}
      </section>

      <section
        className="movements-page__section"
        aria-labelledby="movements-table-heading"
      >
        <h2 id="movements-table-heading" className="movements-page__section-title">
          {hasActiveFilters ? 'Resultado da pesquisa' : 'Registro recente'}
        </h2>
        {loading && rows.length === 0 ? (
          <p className="movements-page__hint">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="movements-page__empty">
            {hasActiveFilters
              ? 'Nenhuma movimentação corresponde aos filtros.'
              : 'Nenhuma movimentação encontrada.'}
          </p>
        ) : (
          <div className="movements-page__table-wrap">
            <table className="movements-table">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Tipo</th>
                  <th>Número da NF</th>
                  <th>Tipo de produto</th>
                  <th>Calibre</th>
                  <th>Produto</th>
                  <th className="movements-table__qty-head">Quantidade</th>
                  <th className="movements-table__actions-head">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={
                      row.id != null
                        ? `m-${row.id}`
                        : `${row.date}-${row.ammo_type_id}-${row.type}-${idx}`
                    }
                  >
                    <td className="movements-table__date">
                      {formatMovementDate(row.date)}
                    </td>
                    <td>
                      <span
                        className={
                          row.type === 'entrada'
                            ? 'movements-table__badge movements-table__badge--entrada'
                            : 'movements-table__badge movements-table__badge--saida'
                        }
                      >
                        {row.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="movements-table__nf">
                      {row.type === 'entrada' && row.nf_number
                        ? row.nf_number
                        : '—'}
                    </td>
                    <td>{productTypeLabel(row.product_type)}</td>
                    <td>{row.caliber}</td>
                    <td>{row.productName}</td>
                    <td className="movements-table__qty">{row.quantity}</td>
                    <td className="movements-table__actions">
                      {row.type === 'saida' ? (
                        <div className="movements-table__action-btns">
                          <button
                            type="button"
                            className="movements-table__termo-btn"
                            onClick={() => openSaidaTermoForRow(row)}
                          >
                            Ver PDF
                          </button>
                          {row.id != null ? (
                            <button
                              type="button"
                              className="movements-table__edit-btn"
                              disabled={deletingId != null || savingEdit}
                              onClick={() => openEditMovement(row)}
                            >
                              Editar
                            </button>
                          ) : null}
                          {row.id != null ? (
                            <button
                              type="button"
                              className="movements-table__delete-btn"
                              disabled={deletingId != null || savingEdit}
                              onClick={() => handleDeleteSaida(row)}
                            >
                              {deletingId === row.id ? 'Excluindo…' : 'Excluir'}
                            </button>
                          ) : null}
                        </div>
                      ) : row.id != null ? (
                        <div className="movements-table__action-btns">
                          <button
                            type="button"
                            className="movements-table__edit-btn"
                            disabled={deletingId != null || savingEdit}
                            onClick={() => openEditMovement(row)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="movements-table__delete-btn"
                            disabled={deletingId != null || savingEdit}
                            onClick={() => handleDeleteEntrada(row)}
                          >
                            {deletingId === row.id ? 'Excluindo…' : 'Excluir'}
                          </button>
                        </div>
                      ) : (
                        <span className="movements-table__actions--na">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
