import { useEffect, useMemo, useState } from 'react'
import { PRODUCT_TYPE_KEYS, productTypeLabel } from '../productTypes.js'
import { createCaliber, createAmmoType } from '../../../services/produtosService.js'

function parseNonNegativeInt(raw) {
  if (raw == null || String(raw).trim() === '') return 0
  const n = Number(String(raw).replace(',', '.').trim())
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}

/**
 * Cadastro em etapas: tipo → calibre (existente ou novo) → nome e quantidade inicial.
 */
export function ProductRegistrationWizard({
  calibers,
  loadingCalibers,
  onProductCreated,
  onMessage,
}) {
  const [step, setStep] = useState(1)
  const [productType, setProductType] = useState('municao')
  const [caliberMode, setCaliberMode] = useState('select')
  const [caliberId, setCaliberId] = useState('')
  const [newCaliberName, setNewCaliberName] = useState('')
  const [productName, setProductName] = useState('')
  const [initialQty, setInitialQty] = useState('0')
  const [saving, setSaving] = useState(false)

  const calibersForType = useMemo(
    () => calibers.filter((c) => c.product_type === productType),
    [calibers, productType],
  )

  useEffect(() => {
    setCaliberId((prev) => {
      if (prev && calibersForType.some((c) => c.id === prev)) return prev
      return calibersForType[0]?.id ?? ''
    })
  }, [calibersForType])

  useEffect(() => {
    if (calibersForType.length === 0 && caliberMode === 'select') {
      setCaliberMode('new')
    }
  }, [calibersForType.length, caliberMode])

  function resetAfterSuccess() {
    setStep(1)
    setProductType('municao')
    setCaliberMode('select')
    setNewCaliberName('')
    setProductName('')
    setInitialQty('0')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (step !== 3) return
    const trimmedName = productName.trim()
    if (!trimmedName) {
      onMessage?.('error', 'Informe o nome do produto.')
      return
    }
    const q = parseNonNegativeInt(initialQty)
    if (q === null) {
      onMessage?.('error', 'Quantidade inicial deve ser um inteiro ≥ 0.')
      return
    }

    setSaving(true)
    try {
      let cid = caliberId
      if (caliberMode === 'new') {
        const cn = newCaliberName.trim()
        if (!cn) {
          onMessage?.('error', 'Digite o nome do novo calibre.')
          setSaving(false)
          return
        }
        const created = await createCaliber(cn, productType)
        cid = created.id
      } else if (!cid) {
        onMessage?.('error', 'Selecione um calibre ou cadastre um novo.')
        setSaving(false)
        return
      }

      await createAmmoType(cid, trimmedName, q)
      onMessage?.('success', 'Produto cadastrado.')
      resetAfterSuccess()
      await onProductCreated?.()
    } catch (err) {
      onMessage?.('error', err.message ?? 'Erro ao cadastrar produto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="product-wizard" aria-label="Cadastro de produto em etapas">
      <div className="product-wizard__steps">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={
              step === n
                ? 'product-wizard__step product-wizard__step--active'
                : step > n
                  ? 'product-wizard__step product-wizard__step--done'
                  : 'product-wizard__step'
            }
          >
            <span className="product-wizard__step-num">{n}</span>
            <span className="product-wizard__step-label">
              {n === 1 ? 'Tipo' : n === 2 ? 'Calibre' : 'Produto'}
            </span>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="product-wizard__panel">
          <p className="product-wizard__intro">
            Selecione o tipo de item: Munição, Cartucho ou Insumo.
          </p>
          <div className="product-wizard__type-grid" role="listbox">
            {PRODUCT_TYPE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="option"
                className="product-wizard__type-btn"
                onClick={() => {
                  setProductType(k)
                  setStep(2)
                }}
                disabled={saving}
              >
                {productTypeLabel(k)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="product-wizard__panel">
          <p className="product-wizard__intro">
            Escolha um calibre já cadastrado para este tipo ou informe um novo
            calibre.
          </p>
          <p className="product-wizard__chip">
            Tipo: <strong>{productTypeLabel(productType)}</strong>
          </p>

          <fieldset className="product-wizard__fieldset">
            <legend className="product-wizard__legend">Calibre</legend>
            <label className="product-wizard__radio">
              <input
                type="radio"
                name="caliberMode"
                checked={caliberMode === 'select'}
                onChange={() => setCaliberMode('select')}
                disabled={saving}
              />
              Usar calibre existente
            </label>
            <label className="product-wizard__radio">
              <input
                type="radio"
                name="caliberMode"
                checked={caliberMode === 'new'}
                onChange={() => setCaliberMode('new')}
                disabled={saving}
              />
              Cadastrar novo calibre
            </label>
          </fieldset>

          {caliberMode === 'select' ? (
            <label className="product-wizard__field">
              <span>Calibres deste tipo</span>
              <select
                value={caliberId}
                onChange={(e) => setCaliberId(e.target.value)}
                disabled={loadingCalibers || calibersForType.length === 0 || saving}
              >
                {loadingCalibers ? (
                  <option value="">Carregando…</option>
                ) : calibersForType.length === 0 ? (
                  <option value="">Nenhum calibre — use &quot;novo calibre&quot;</option>
                ) : (
                  calibersForType.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <label className="product-wizard__field">
              <span>Nome do novo calibre</span>
              <input
                type="text"
                value={newCaliberName}
                onChange={(e) => setNewCaliberName(e.target.value)}
                placeholder="Ex.: 9mm, 12GA"
                autoComplete="off"
                disabled={saving}
              />
            </label>
          )}

          <div className="product-wizard__actions">
            <button
              type="button"
              className="product-wizard__back"
              onClick={() => setStep(1)}
              disabled={saving}
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={
                saving ||
                (caliberMode === 'select' &&
                  (!caliberId || calibersForType.length === 0)) ||
                (caliberMode === 'new' && !newCaliberName.trim())
              }
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <form className="product-wizard__panel" onSubmit={handleSubmit}>
          <p className="product-wizard__intro">
            Informe o nome do produto e a quantidade inicial (opcional). Se
            informar quantidade &gt; 0, já gera a primeira entrada no estoque
            (NF &quot;INICIAL&quot;). Entradas seguintes usam a aba Estoque com
            o número da NF.
          </p>
          <div className="product-wizard__chips">
            <span className="product-wizard__chip">
              Tipo: <strong>{productTypeLabel(productType)}</strong>
            </span>
            <span className="product-wizard__chip">
              Calibre:{' '}
              <strong>
                {caliberMode === 'new'
                  ? newCaliberName.trim() || '—'
                  : calibersForType.find((c) => c.id === caliberId)?.name ?? '—'}
              </strong>
            </span>
          </div>
          <label className="product-wizard__field">
            <span>Nome do produto</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex.: FMJ, Hollow Point"
              autoComplete="off"
              disabled={saving}
              required
            />
          </label>
          <label className="product-wizard__field">
            <span>Quantidade inicial</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              disabled={saving}
            />
          </label>
          <div className="product-wizard__actions">
            <button
              type="button"
              className="product-wizard__back"
              onClick={() => setStep(2)}
              disabled={saving}
            >
              ← Voltar
            </button>
            <button type="submit" disabled={saving || !productName.trim()}>
              {saving ? 'Salvando…' : 'Cadastrar produto'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
