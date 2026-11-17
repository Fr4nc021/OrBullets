import { useEffect, useMemo, useState } from 'react'
import { formatDateBrShort } from '../weaponVendaHelpers.js'

function saleDateLabel(saleDate) {
  if (!saleDate) return '—'
  return formatDateBrShort(saleDate)
}

/**
 * Lista vendas registradas para o usuário marcar quais entram na declaração.
 */
export function SoldWeaponsDeclarationModal({ open, onClose, rows, onExport }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(new Set())
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const blob = [r.clientName, r.clientCpf, r.model, r.brand, r.caliber, r.serial]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, query])

  if (!open) return null

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id))

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleFiltered() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const r of filtered) next.delete(r.id)
      } else {
        for (const r of filtered) next.add(r.id)
      }
      return next
    })
  }

  function exportSelected() {
    const picked = rows.filter((r) => selected.has(r.id))
    if (picked.length === 0) return
    onExport(picked)
  }

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
        aria-labelledby="sold-declaration-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="stock-report__head">
          <h2 id="sold-declaration-title" className="stock-report__title">
            Declaração de armas vendidas
          </h2>
          <button
            type="button"
            className="stock-report__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <p className="stock-report__intro">
          Marque as vendas que entram no PDF. A declaração traz os dados dos
          clientes e, em seguida, os dados das armas. Só aparecem armas com
          venda registrada.
        </p>
        <form className="stock-report__filters" onSubmit={(e) => e.preventDefault()}>
          <label className="stock-report__field stock-report__field--grow">
            <span>Pesquisar cliente, modelo ou série</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex.: João, Glock, 9 mm"
              autoComplete="off"
            />
          </label>
        </form>
        <div className="stock-report__table-wrap">
          <table className="stock-report-table stock-report-table--weapons sold-declaration-table">
            <thead>
              <tr>
                <th className="sold-declaration-table__check">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleFiltered}
                    disabled={filtered.length === 0}
                    aria-label="Marcar vendas da lista"
                  />
                </th>
                <th>Data</th>
                <th>Cliente</th>
                <th>CPF</th>
                <th>Modelo</th>
                <th>Calibre</th>
                <th>Nº série</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="stock-report-table__empty">
                    Nenhuma venda registrada.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="stock-report-table__empty">
                    Nenhuma venda encontrada para essa pesquisa.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="sold-declaration-table__check">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={`Incluir venda de ${r.clientName}, ${r.model}`}
                      />
                    </td>
                    <td>{saleDateLabel(r.saleDate)}</td>
                    <td>{r.clientName}</td>
                    <td>{r.clientCpf || '—'}</td>
                    <td>{r.model}</td>
                    <td>{r.caliber}</td>
                    <td>{r.serial || '—'}</td>
                    <td>{r.statusLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="stock-report__pdf-actions">
          <span className="sold-declaration-table__count">
            {selected.size} selecionada(s)
          </span>
          <button
            type="button"
            className="stock-report__pdf-btn"
            onClick={exportSelected}
            disabled={selected.size === 0}
          >
            Gerar declaração
          </button>
        </div>
      </div>
    </div>
  )
}
