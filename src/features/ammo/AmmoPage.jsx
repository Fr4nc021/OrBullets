import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createCaliber,
  deleteProduct,
  fetchAmmoStock,
  fetchCalibers,
  updateProduct,
} from './ammoApi.js'
import { buildProductHierarchySections } from './ammoStockSections.js'
import { PRODUCT_TYPE_KEYS, productTypeLabel } from './productTypes.js'
import { ProductRegistrationWizard } from './components/ProductRegistrationWizard.jsx'
import {
  createWeaponBrand,
  createWeaponType,
} from '../weapons/weaponsApi.js'
import './AmmoPage.css'

export default function AmmoPage() {
  const [calibers, setCalibers] = useState([])
  const [stockRows, setStockRows] = useState([])

  const [caliberName, setCaliberName] = useState('')
  const [productTypeForCaliber, setProductTypeForCaliber] = useState('municao')
  const [weaponTypeName, setWeaponTypeName] = useState('')
  const [weaponBrandName, setWeaponBrandName] = useState('')

  const [loadingCalibers, setLoadingCalibers] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)
  const [savingCaliber, setSavingCaliber] = useState(false)
  const [savingWeaponType, setSavingWeaponType] = useState(false)
  const [savingWeaponBrand, setSavingWeaponBrand] = useState(false)
  const [productEditId, setProductEditId] = useState(null)
  const [productEditName, setProductEditName] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text })
  }, [])

  const loadCalibers = useCallback(async () => {
    setLoadingCalibers(true)
    try {
      const rows = await fetchCalibers()
      setCalibers(rows)
      setMessage({ type: '', text: '' })
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao carregar calibres.')
    } finally {
      setLoadingCalibers(false)
    }
  }, [showMessage])

  const loadAmmoStock = useCallback(async () => {
    setLoadingStock(true)
    try {
      const rows = await fetchAmmoStock()
      setStockRows(rows)
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao carregar estoque.')
    } finally {
      setLoadingStock(false)
    }
  }, [showMessage])

  useEffect(() => {
    loadCalibers()
  }, [loadCalibers])

  useEffect(() => {
    loadAmmoStock()
  }, [loadAmmoStock])

  const hierarchySections = useMemo(
    () => buildProductHierarchySections(calibers, stockRows),
    [calibers, stockRows],
  )

  async function handleCreateCaliber(e) {
    e.preventDefault()
    setSavingCaliber(true)
    try {
      await createCaliber(caliberName, productTypeForCaliber)
      setCaliberName('')
      showMessage('success', 'Calibre cadastrado.')
      await loadCalibers()
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao cadastrar calibre.')
    } finally {
      setSavingCaliber(false)
    }
  }

  async function handleCreateWeaponType(e) {
    e.preventDefault()
    setSavingWeaponType(true)
    try {
      await createWeaponType(weaponTypeName)
      setWeaponTypeName('')
      showMessage('success', 'Tipo de arma cadastrado.')
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao cadastrar tipo de arma.')
    } finally {
      setSavingWeaponType(false)
    }
  }

  async function handleCreateWeaponBrand(e) {
    e.preventDefault()
    setSavingWeaponBrand(true)
    try {
      await createWeaponBrand(weaponBrandName)
      setWeaponBrandName('')
      showMessage('success', 'Marca cadastrada.')
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao cadastrar marca.')
    } finally {
      setSavingWeaponBrand(false)
    }
  }

  function startProductEdit(row) {
    setProductEditId(row.ammo_type_id)
    setProductEditName(row.ammo_name ?? '')
  }

  function cancelProductEdit() {
    setProductEditId(null)
    setProductEditName('')
  }

  async function handleSaveProductEdit() {
    if (!productEditId || !productEditName.trim()) return
    setSavingProduct(true)
    try {
      await updateProduct(productEditId, productEditName)
      cancelProductEdit()
      showMessage('success', 'Produto atualizado.')
      await loadAmmoStock()
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao atualizar produto.')
    } finally {
      setSavingProduct(false)
    }
  }

  async function handleDeleteProduct(row) {
    const name = row.ammo_name ?? 'este produto'
    const ok = window.confirm(
      `Excluir "${name}"? Todas as movimentações deste item serão apagadas. Esta ação não pode ser desfeita.`,
    )
    if (!ok) return
    setDeletingProductId(row.ammo_type_id)
    try {
      await deleteProduct(row.ammo_type_id)
      if (productEditId === row.ammo_type_id) cancelProductEdit()
      showMessage('success', 'Produto excluído.')
      await loadAmmoStock()
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao excluir produto.')
    } finally {
      setDeletingProductId(null)
    }
  }

  return (
    <div className="ammo-page">
      <header className="ammo-page__header">
        <h1>OrBullets</h1>
        <p className="ammo-page__subtitle">
          Cadastro por tipo (Munição, Cartucho, Insumo), calibre e produto; marcas
          e tipos de arma; estoque hierárquico
        </p>
      </header>

      {message.text ? (
        <div
          className={`ammo-page__message ammo-page__message--${message.type}`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      <div className="ammo-page__grid">
        <details className="ammo-page__cadastros-details">
          <summary className="ammo-page__cadastros-summary" id="panel-caliber">
            Cadastrar calibre
          </summary>
          <form className="ammo-form" onSubmit={handleCreateCaliber} aria-labelledby="panel-caliber">
            <label className="ammo-field">
              <span className="ammo-field__label">Tipo de produto</span>
              <select
                value={productTypeForCaliber}
                onChange={(e) => setProductTypeForCaliber(e.target.value)}
                disabled={savingCaliber}
              >
                {PRODUCT_TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {productTypeLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ammo-field">
              <span className="ammo-field__label">Nome do calibre</span>
              <input
                type="text"
                value={caliberName}
                onChange={(e) => setCaliberName(e.target.value)}
                placeholder="Ex: 9mm, .38, 5.56"
                autoComplete="off"
                disabled={savingCaliber}
              />
            </label>
            <div className="ammo-form__actions">
              <button type="submit" disabled={savingCaliber || !caliberName.trim()}>
                {savingCaliber ? 'Salvando…' : 'Cadastrar calibre'}
              </button>
            </div>
          </form>
        </details>

        <details className="ammo-page__cadastros-details" open>
          <summary className="ammo-page__cadastros-summary" id="panel-ammo-type">
            Cadastrar produto (calibre + modelo)
          </summary>
          <div className="ammo-page__wizard-wrap" aria-labelledby="panel-ammo-type">
            <ProductRegistrationWizard
              calibers={calibers}
              loadingCalibers={loadingCalibers}
              onMessage={showMessage}
              onProductCreated={async () => {
                await loadCalibers()
                await loadAmmoStock()
              }}
            />
          </div>
        </details>

        <details className="ammo-page__cadastros-details">
          <summary className="ammo-page__cadastros-summary" id="panel-weapon-type">
            Cadastrar tipo de arma
          </summary>
          <form className="ammo-form" onSubmit={handleCreateWeaponType} aria-labelledby="panel-weapon-type">
            <label className="ammo-field">
              <span className="ammo-field__label">Nome do tipo</span>
              <input
                type="text"
                value={weaponTypeName}
                onChange={(e) => setWeaponTypeName(e.target.value)}
                placeholder="Ex: Pistola, Rifle, Espingarda"
                autoComplete="off"
                disabled={savingWeaponType}
              />
            </label>
            <div className="ammo-form__actions">
              <button
                type="submit"
                disabled={savingWeaponType || !weaponTypeName.trim()}
              >
                {savingWeaponType ? 'Salvando…' : 'Cadastrar tipo de arma'}
              </button>
            </div>
          </form>
        </details>

        <details className="ammo-page__cadastros-details">
          <summary className="ammo-page__cadastros-summary" id="panel-weapon-brand">
            Cadastrar marca de arma
          </summary>
          <form className="ammo-form" onSubmit={handleCreateWeaponBrand} aria-labelledby="panel-weapon-brand">
            <label className="ammo-field">
              <span className="ammo-field__label">Nome da marca</span>
              <input
                type="text"
                value={weaponBrandName}
                onChange={(e) => setWeaponBrandName(e.target.value)}
                placeholder="Ex: Glock, Taurus, Rossi"
                autoComplete="off"
                disabled={savingWeaponBrand}
              />
            </label>
            <div className="ammo-form__actions">
              <button
                type="submit"
                disabled={savingWeaponBrand || !weaponBrandName.trim()}
              >
                {savingWeaponBrand ? 'Salvando…' : 'Cadastrar marca'}
              </button>
            </div>
          </form>
        </details>
      </div>

      <section
        className="ammo-page__inventory"
        aria-labelledby="ammo-inventory-heading"
      >
        <h2 id="ammo-inventory-heading">Estoque por tipo, calibre e produto</h2>

        {loadingCalibers ? (
          <p className="ammo-inventory__hint">Carregando calibres…</p>
        ) : loadingStock && stockRows.length === 0 ? (
          <p className="ammo-inventory__hint">Carregando estoque…</p>
        ) : hierarchySections.length === 0 ? (
          <p className="ammo-inventory__empty">
            Cadastre tipo, calibre e produto para ver a listagem.
          </p>
        ) : (
          <div className="ammo-inventory__blocks ammo-inventory__blocks--hierarchy">
            {hierarchySections.map((typeBlock) => (
              <div
                key={typeBlock.typeKey}
                className="ammo-product-type-block"
              >
                <h3 className="ammo-product-type-block__title">
                  {typeBlock.typeLabel}
                </h3>
                <div className="ammo-product-type-block__calibers">
                  {typeBlock.caliberSections.map(
                    ({ key, title, rows }) => (
                      <div key={key} className="ammo-caliber-block">
                        <h4 className="ammo-caliber-block__title ammo-caliber-block__title--nested">
                          {title}
                        </h4>
                        <div className="ammo-page__table-wrap">
                          <table className="ammo-stock-table">
                            <thead>
                              <tr>
                                <th>Produto</th>
                                <th>Quantidade em estoque</th>
                                <th className="ammo-stock-table__th-actions">
                                  Ações
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={3}
                                    className="ammo-stock-table__empty"
                                  >
                                    Nenhum produto neste calibre.
                                  </td>
                                </tr>
                              ) : (
                                rows.map((row) => {
                                  const isEditing = productEditId === row.ammo_type_id
                                  return (
                                    <tr key={row.ammo_type_id}>
                                      <td>
                                        {isEditing ? (
                                          <input
                                            type="text"
                                            className="ammo-stock-table__edit-input"
                                            value={productEditName}
                                            onChange={(e) =>
                                              setProductEditName(e.target.value)
                                            }
                                            disabled={savingProduct}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                void handleSaveProductEdit()
                                              }
                                              if (e.key === 'Escape') {
                                                e.preventDefault()
                                                cancelProductEdit()
                                              }
                                            }}
                                            aria-label="Nome do produto"
                                            autoComplete="off"
                                          />
                                        ) : (
                                          row.ammo_name
                                        )}
                                      </td>
                                      <td>{row.stock}</td>
                                      <td className="ammo-stock-table__actions">
                                        {isEditing ? (
                                          <>
                                            <button
                                              type="button"
                                              className="ammo-stock-table__save-btn"
                                              onClick={() =>
                                                void handleSaveProductEdit()
                                              }
                                              disabled={
                                                savingProduct ||
                                                !productEditName.trim()
                                              }
                                            >
                                              {savingProduct ? 'Salvando…' : 'Salvar'}
                                            </button>
                                            <button
                                              type="button"
                                              className="ammo-stock-table__cancel-btn"
                                              onClick={cancelProductEdit}
                                              disabled={savingProduct}
                                            >
                                              Cancelar
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              className="ammo-stock-table__edit-btn"
                                              onClick={() =>
                                                startProductEdit(row)
                                              }
                                              disabled={deletingProductId != null}
                                            >
                                              Editar
                                            </button>
                                            <button
                                              type="button"
                                              className="ammo-stock-table__delete-btn"
                                              onClick={() =>
                                                void handleDeleteProduct(row)
                                              }
                                              disabled={deletingProductId != null}
                                            >
                                              {deletingProductId === row.ammo_type_id
                                                ? 'Excluindo…'
                                                : 'Excluir'}
                                            </button>
                                          </>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
