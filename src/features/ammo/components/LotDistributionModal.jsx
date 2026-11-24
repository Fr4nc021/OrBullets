import { useEffect, useMemo, useState } from 'react'
import {
  createLotOpenings,
  deleteLotOpening,
  fetchLotOpenings,
} from '../ammoApi.js'
import { lotDisplay, normalizeLotNumber } from '../ammoLots.js'
import { productTypeLabel } from '../productTypes.js'

function newDraftLine() {
  return { id: crypto.randomUUID(), lot: '', qty: '' }
}

function parseQty(raw) {
  const n = Number(String(raw ?? '').replace(',', '.').trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Distribui o estoque que já existia (sem lote) de um produto em lotes.
 * O total do produto não muda: só passa de "sem lote" para os lotes informados.
 */
export function LotDistributionModal({ product, lots, onClose, onChanged }) {
  const [openings, setOpenings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState(() => [newDraftLine()])

  const productId = product?.ammo_type_id

  useEffect(() => {
    if (!productId) return
    let alive = true
    setLoading(true)
    setError('')
    fetchLotOpenings(productId)
      .then((rows) => {
        if (alive) setOpenings(rows ?? [])
      })
      .catch((err) => {
        if (alive) setError(err.message ?? 'Erro ao carregar os lotes.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [productId, lots])

  const semLote = useMemo(
    () => (lots ?? []).find((l) => l.lot_number == null)?.stock ?? 0,
    [lots],
  )
  const named = useMemo(
    () => (lots ?? []).filter((l) => l.lot_number != null),
    [lots],
  )
  const draftTotal = lines.reduce((sum, l) => sum + (parseQty(l.qty) ?? 0), 0)
  const remaining = semLote - draftTotal

  if (!product) return null

  function updateLine(id, patch) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const filled = lines.filter((l) => l.lot.trim() || String(l.qty).trim())
    if (filled.length === 0) {
      setError('Informe pelo menos um lote com quantidade.')
      return
    }
    const payload = []
    for (const l of filled) {
      const lot = normalizeLotNumber(l.lot)
      const qty = parseQty(l.qty)
      if (!lot) {
        setError('Preencha o número de todos os lotes.')
        return
      }
      if (qty == null) {
        setError(`Quantidade inválida no lote ${lot}.`)
        return
      }
      payload.push({ lot_number: lot, quantity: qty })
    }
    const total = payload.reduce((s, l) => s + l.quantity, 0)
    if (total > semLote) {
      setError(
        `A soma dos lotes (${total}) passa do saldo sem lote (${semLote}).`,
      )
      return
    }
    setSaving(true)
    try {
      await createLotOpenings(product.ammo_type_id, payload)
      setLines([newDraftLine()])
      await onChanged?.()
    } catch (err) {
      setError(err.message ?? 'Erro ao salvar os lotes.')
    } finally {
      setSaving(false)
    }
  }

  async function undo(opening) {
    if (
      !window.confirm(
        `Desfazer a distribuição de ${opening.quantity} no lote ${opening.lot_number}? A quantidade volta para "sem lote".`,
      )
    ) {
      return
    }
    setError('')
    setSaving(true)
    try {
      await deleteLotOpening(opening.id)
      await onChanged?.()
    } catch (err) {
      setError(err.message ?? 'Erro ao desfazer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="stock-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="stock-dialog stock-dialog--lots"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-lots-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="stock-lots-title" className="stock-dialog__title">
          Lotes do produto
        </h2>
        <p className="stock-lots__product">
          <strong>{product.ammo_name}</strong>
          <span>
            {productTypeLabel(product.product_type)} · {product.caliber} ·
            Estoque total: {product.stock}
          </span>
        </p>

        <table className="stock-lots__table">
          <thead>
            <tr>
              <th>Lote</th>
              <th className="stock-lots__num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {named.map((l) => (
              <tr key={l.lot_number}>
                <td>{l.lot_number}</td>
                <td className="stock-lots__num">{l.stock}</td>
              </tr>
            ))}
            <tr className={semLote > 0 ? 'stock-lots__row--pending' : ''}>
              <td>Sem lote</td>
              <td className="stock-lots__num">{semLote}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="stock-lots__num">{product.stock}</td>
            </tr>
          </tfoot>
        </table>

        {semLote > 0 ? (
          <form className="stock-lots__form" onSubmit={save}>
            <h3 className="stock-lots__subtitle">
              Distribuir o saldo sem lote ({semLote})
            </h3>
            {lines.map((l, i) => (
              <div key={l.id} className="stock-lots__line">
                <label className="stock-dialog__field">
                  <span>Número do lote</span>
                  <input
                    type="text"
                    value={l.lot}
                    onChange={(e) => updateLine(l.id, { lot: e.target.value })}
                    disabled={saving}
                    maxLength={60}
                    autoComplete="off"
                    autoFocus={i === lines.length - 1 && i > 0}
                    placeholder="Ex.: AB1234"
                  />
                </label>
                <label className="stock-dialog__field">
                  <span>Quantidade</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={l.qty}
                    onChange={(e) => updateLine(l.id, { qty: e.target.value })}
                    disabled={saving}
                  />
                </label>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="stock-lots__remove"
                    onClick={() =>
                      setLines((prev) => prev.filter((x) => x.id !== l.id))
                    }
                    disabled={saving}
                    aria-label="Remover linha"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="stock-lots__add"
              onClick={() => setLines((prev) => [...prev, newDraftLine()])}
              disabled={saving}
            >
              + Outro lote
            </button>
            <p
              className={
                remaining < 0
                  ? 'stock-lots__remaining stock-lots__remaining--over'
                  : 'stock-lots__remaining'
              }
            >
              Distribuindo {draftTotal} · {remaining < 0 ? 'passou' : 'sobra sem lote'}:{' '}
              {Math.abs(remaining)}
            </p>
            <div className="stock-dialog__actions">
              <button type="button" onClick={onClose} disabled={saving}>
                Fechar
              </button>
              <button type="submit" disabled={saving || remaining < 0}>
                {saving ? 'Salvando…' : 'Salvar lotes'}
              </button>
            </div>
          </form>
        ) : (
          <p className="stock-lots__done">
            Todo o estoque deste produto já está em lotes. Novos lotes entram
            pela entrada com NF.
          </p>
        )}

        {error ? (
          <p className="stock-lots__error" role="alert">
            {error}
          </p>
        ) : null}

        {openings.length > 0 ? (
          <div className="stock-lots__history">
            <h3 className="stock-lots__subtitle">Distribuições feitas</h3>
            <ul>
              {openings.map((o) => (
                <li key={o.id}>
                  <span>
                    {lotDisplay(o.lot_number)}: {o.quantity}
                    <small>
                      {' '}
                      em{' '}
                      {new Date(o.created_at).toLocaleDateString('pt-BR')}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => void undo(o)}
                    disabled={saving}
                  >
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : loading ? (
          <p className="stock-lots__done">Carregando…</p>
        ) : null}

        {semLote <= 0 ? (
          <div className="stock-dialog__actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Fechar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
