import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  createWeapon,
  createWeaponSale,
  acquireWeaponSale,
  markWeaponPurchased,
  deleteWeapon,
  fetchCalibers,
  fetchWeaponBrands,
  fetchWeaponTypes,
  fetchWeapons,
  updateWeapon,
  updateWeaponDelivery,
  updateWeaponDetails,
} from './weaponsApi.js'
import { parseLocalDateEnd, parseLocalDateStart } from '../ammo/ammoStockReport.js'
import { SaidaTermoPreviewModal } from '../ammo/components/SaidaTermoPreviewModal.jsx'
import { WeaponsReportModal } from './components/WeaponsReportModal.jsx'
import { WeaponDeliverModal } from './components/WeaponDeliverModal.jsx'
import { WeaponSaleModal } from './components/WeaponSaleModal.jsx'
import { WeaponAcquireModal } from './components/WeaponAcquireModal.jsx'
import { getWeaponEntregaComprovantePdfBlob } from './weaponEntregaComprovantePdf.js'
import { getWeaponVendaPdfBlob } from './weaponVendaPdf.js'
import {
  buildComprovantePayload,
  dateFromDateInput,
  maskCpfInput,
  parseTermoEntregaFromNotes,
  validateWeaponEntregaFields,
} from './weaponEntregaHelpers.js'
import {
  buildVendaLayoutTestPayload,
  buildVendaPdfPayload,
  formatDateBrShort,
  lookupAddressByCep,
  maskCepInput,
  normalizeDocProcessIds,
  parseMoneyInput,
  parseVendaFromNotes,
  validateWeaponVendaFields,
} from './weaponVendaHelpers.js'
import {
  buildWeaponReportRows,
  defaultWeaponsReportDateRange,
  getWeaponWithdrawalMs,
  isShopStockOwner,
  isTimestampInCurrentMonthLocal,
  parseCheckoutResponsibleFromNotes,
  parseWeaponSerialFromNotes,
  SHOP_STOCK_OWNER,
  todayLocalDateInput,
  withdrawalDateInputFromMs,
  withdrawalIsoFromDateInput,
} from './weaponsReportHelpers.js'
import { downloadWeaponsReportPdf } from './weaponsReportPdf.js'
import { productTypeLabel } from '../ammo/productTypes.js'
import '../ammo/StockPage.css'
import './WeaponsPage.css'

function WeaponActionIcon({ kind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (kind === 'edit') {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    )
  }
  if (kind === 'clipboard') {
    return (
      <svg {...common}>
        <path d="M9 5h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        <path d="M9 3h6v4H9z" />
        <path d="M9 11h6" />
        <path d="M9 15h4" />
      </svg>
    )
  }
  if (kind === 'delete') {
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6 6l1 14h10l1-14" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </svg>
    )
  }
  if (kind === 'receipt') {
    return (
      <svg {...common} strokeWidth={2.25}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5 10.5 15 16 9.5" />
      </svg>
    )
  }
  if (kind === 'cart') {
    return (
      <svg {...common}>
        <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
        <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
        <path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7" />
      </svg>
    )
  }
  if (kind === 'purchased') {
    return (
      <svg {...common}>
        <path d="M9 11.5 11.5 14 16 9.5" />
        <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
        <path d="M8 7V5a4 4 0 0 1 8 0v2" />
      </svg>
    )
  }
  if (kind === 'acquire') {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
        <path d="M4 19h16" />
      </svg>
    )
  }
  return null
}

function SearchToggleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 16.5 16.5" />
    </svg>
  )
}

function WeaponIconButton({ kind, label, caption, disabled, onClick, showLabel = false }) {
  return (
    <button
      type="button"
      className={`weapons-table__icon-btn weapons-table__icon-btn--${kind}${showLabel ? ' weapons-table__icon-btn--labeled' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <WeaponActionIcon kind={kind} />
      {showLabel ? <span>{caption || label}</span> : null}
    </button>
  )
}

function buildNameById(rows) {
  const map = {}
  for (const r of rows) map[r.id] = r.name
  return map
}

/** Nome do calibre para UI; inclui tipo (Munição/Cartucho) quando houver. */
function buildCaliberDisplayById(rows) {
  const map = {}
  for (const r of rows) {
    map[r.id] =
      r.product_type != null
        ? `${r.name} (${productTypeLabel(r.product_type)})`
        : r.name
  }
  return map
}

function statusLabel(status) {
  if (status === 'em_estoque') return 'Em estoque'
  if (status === 'retirada') return 'Retirada'
  if (status === 'para_compra') return 'Para compra'
  if (status === 'aguardando_chegada') return 'Comprada! aguardando chegada'
  return status ?? '—'
}

function isPurchasePipelineStatus(status) {
  return status === 'para_compra' || status === 'aguardando_chegada'
}

function emptySaleForm(defaults = {}) {
  return {
    saleDate: todayLocalDateInput(),
    weaponTypeId: defaults.weaponTypeId ?? '',
    brandId: defaults.brandId ?? '',
    caliberId: defaults.caliberId ?? '',
    name: '',
    serial: '',
    weaponValue: '',
    paymentMethod: '',
    docProcesses: [],
    docsValue: '',
    clientName: '',
    clientIdentity: '',
    clientCpf: '',
    clientPhone: '',
    clientAddress: '',
    clientNumber: '',
    clientNeighborhood: '',
    clientCity: '',
    clientCep: '',
    seller: '',
    obs: '',
  }
}

function matchesWeaponListSearch(weapon, queryLower) {
  if (!queryLower) return true
  const name = (weapon.name ?? '').toLowerCase()
  const owner = (weapon.owner ?? '').toLowerCase()
  return name.includes(queryLower) || owner.includes(queryLower)
}

export default function WeaponsPage() {
  const [calibers, setCalibers] = useState([])
  const [weapons, setWeapons] = useState([])
  const [weaponTypes, setWeaponTypes] = useState([])
  const [weaponBrands, setWeaponBrands] = useState([])

  const [weaponTypeId, setWeaponTypeId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [caliberId, setCaliberId] = useState('')
  const [modelName, setModelName] = useState('')
  const [serial, setSerial] = useState('')
  const [owner, setOwner] = useState('')

  const [loadingCalibers, setLoadingCalibers] = useState(true)
  const [loadingWeaponMeta, setLoadingWeaponMeta] = useState(true)
  const [loadingWeapons, setLoadingWeapons] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyEditId, setBusyEditId] = useState(null)
  const [busyDeliverId, setBusyDeliverId] = useState(null)
  const [busyDeleteId, setBusyDeleteId] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [listSearch, setListSearch] = useState('')
  const [listSearchOpen, setListSearchOpen] = useState(false)
  const listSearchInputRef = useRef(null)
  /** @type {'todas' | 'comprar'} */
  const [listFilter, setListFilter] = useState('todas')
  const [busyMarkPurchasedId, setBusyMarkPurchasedId] = useState(null)

  const [cadastroOpen, setCadastroOpen] = useState(false)
  const [editWeapon, setEditWeapon] = useState(null)
  const [editWeaponTypeId, setEditWeaponTypeId] = useState('')
  const [editBrandId, setEditBrandId] = useState('')
  const [editCaliberId, setEditCaliberId] = useState('')
  const [editModelName, setEditModelName] = useState('')
  const [editSerial, setEditSerial] = useState('')
  const [editOwner, setEditOwner] = useState('')
  const editModelRef = useRef(null)

  const [deliverWeapon, setDeliverWeapon] = useState(null)
  /** @type {'new' | 'edit'} */
  const [deliverMode, setDeliverMode] = useState('new')
  const [deliverOwner, setDeliverOwner] = useState('')
  const [deliverResponsible, setDeliverResponsible] = useState('')
  const [deliverDate, setDeliverDate] = useState(() => todayLocalDateInput())
  const [deliverRg, setDeliverRg] = useState('')
  const [deliverCpf, setDeliverCpf] = useState('')
  const [deliverSigmaSinarm, setDeliverSigmaSinarm] = useState('')
  const [deliverValidationError, setDeliverValidationError] = useState('')

  const comprovantePdfUrlRef = useRef('')
  const [comprovantePreviewOpen, setComprovantePreviewOpen] = useState(false)
  const [comprovantePdfUrl, setComprovantePdfUrl] = useState('')
  const [comprovanteFilename, setComprovanteFilename] = useState('')
  const [comprovanteReadOnly, setComprovanteReadOnly] = useState(false)
  const [generatingComprovante, setGeneratingComprovante] = useState(false)
  /** @type {'entrega' | 'venda'} */
  const [docPreviewKind, setDocPreviewKind] = useState('entrega')
  const [vendaPreviewTest, setVendaPreviewTest] = useState(false)

  const [saleOpen, setSaleOpen] = useState(false)
  const [saleForm, setSaleForm] = useState(() => emptySaleForm())
  const [saleValidationError, setSaleValidationError] = useState('')
  const [busySale, setBusySale] = useState(false)
  const [saleCepLookingUp, setSaleCepLookingUp] = useState(false)
  const saleCepLookupRef = useRef(0)

  const [acquireWeapon, setAcquireWeapon] = useState(null)
  const [acquireSerial, setAcquireSerial] = useState('')
  const [acquireDestination, setAcquireDestination] = useState('estoque')
  const [acquireValidationError, setAcquireValidationError] = useState('')
  const [busyAcquireId, setBusyAcquireId] = useState(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportFrom, setReportFrom] = useState(
    () => defaultWeaponsReportDateRange().from,
  )
  const [reportTo, setReportTo] = useState(
    () => defaultWeaponsReportDateRange().to,
  )

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text })
  }, [])

  const loadCalibers = useCallback(async () => {
    setLoadingCalibers(true)
    try {
      const rows = await fetchCalibers({
        productTypes: ['municao', 'cartucho'],
      })
      setCalibers(rows)
      setCaliberId((prev) => {
        if (prev && rows.some((c) => c.id === prev)) return prev
        return rows[0]?.id ?? ''
      })
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao carregar calibres.')
    } finally {
      setLoadingCalibers(false)
    }
  }, [showMessage])

  const loadWeaponMeta = useCallback(async () => {
    setLoadingWeaponMeta(true)
    try {
      const [types, brands] = await Promise.all([fetchWeaponTypes(), fetchWeaponBrands()])
      setWeaponTypes(types)
      setWeaponBrands(brands)
      setWeaponTypeId((prev) => {
        if (prev && types.some((t) => t.id === prev)) return prev
        return types[0]?.id ?? ''
      })
      setBrandId((prev) => {
        if (prev && brands.some((b) => b.id === prev)) return prev
        return brands[0]?.id ?? ''
      })
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao carregar tipos e marcas de arma.')
    } finally {
      setLoadingWeaponMeta(false)
    }
  }, [showMessage])

  const loadWeapons = useCallback(async () => {
    setLoadingWeapons(true)
    try {
      const rows = await fetchWeapons()
      setWeapons(rows)
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao carregar armas.')
    } finally {
      setLoadingWeapons(false)
    }
  }, [showMessage])

  useEffect(() => {
    loadCalibers()
  }, [loadCalibers])

  useEffect(() => {
    loadWeaponMeta()
  }, [loadWeaponMeta])

  useEffect(() => {
    loadWeapons()
  }, [loadWeapons])

  useEffect(() => {
    return () => {
      if (comprovantePdfUrlRef.current) {
        URL.revokeObjectURL(comprovantePdfUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editWeapon) return
    const t = requestAnimationFrame(() => {
      editModelRef.current?.focus()
    })
    return () => cancelAnimationFrame(t)
  }, [editWeapon])

  useEffect(() => {
    if (!listSearchOpen) return
    const t = requestAnimationFrame(() => {
      listSearchInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(t)
  }, [listSearchOpen])

  function setOwnerToStock() {
    setOwner(SHOP_STOCK_OWNER)
  }

  async function handleSubmitWeapon(e) {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await createWeapon({
        name: modelName,
        weaponTypeId,
        weaponTypeName: weaponTypes.find((t) => t.id === weaponTypeId)?.name,
        brandId,
        caliberId: caliberId,
        owner,
        serial,
      })
      setModelName('')
      setSerial('')
      setOwner('')
      showMessage('success', 'Arma cadastrada.')
      setCadastroOpen(false)
      await loadWeapons()
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao cadastrar arma.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(weapon) {
    const sn = parseWeaponSerialFromNotes(weapon.notes)
    setEditWeapon(weapon)
    setEditWeaponTypeId(weapon.weapon_type_id ?? '')
    setEditBrandId(weapon.brand_id ?? '')
    setEditCaliberId(weapon.caliber_id ?? '')
    setEditModelName(weapon.name ?? '')
    setEditSerial(sn === '—' ? '' : sn)
    setEditOwner(weapon.owner ?? '')
    setMessage({ type: '', text: '' })
  }

  function closeEdit() {
    setEditWeapon(null)
    setEditWeaponTypeId('')
    setEditBrandId('')
    setEditCaliberId('')
    setEditModelName('')
    setEditSerial('')
    setEditOwner('')
  }

  function setEditOwnerToStock() {
    setEditOwner(SHOP_STOCK_OWNER)
  }

  function resetDeliverFormFields() {
    setDeliverResponsible('')
    setDeliverRg('')
    setDeliverCpf('')
    setDeliverSigmaSinarm('')
    setDeliverValidationError('')
  }

  function openDeliver(weapon) {
    if (weapon.status !== 'em_estoque') return
    setDeliverMode('new')
    setDeliverOwner(weapon.owner ?? '')
    setDeliverDate(todayLocalDateInput())
    resetDeliverFormFields()
    setMessage({ type: '', text: '' })
    setDeliverWeapon(weapon)
  }

  function openEditDelivery(weapon) {
    if (weapon.status !== 'retirada') return
    setDeliverMode('edit')
    setDeliverWeapon(weapon)
    setDeliverOwner(weapon.owner ?? '')
    const resp = parseCheckoutResponsibleFromNotes(weapon.notes)
    setDeliverResponsible(resp === '—' ? '' : resp)
    setDeliverDate(withdrawalDateInputFromMs(getWeaponWithdrawalMs(weapon)))
    const termo = parseTermoEntregaFromNotes(weapon.notes)
    setDeliverRg(termo?.rg ?? '')
    setDeliverCpf(termo?.cpf ? maskCpfInput(termo.cpf) : '')
    setDeliverSigmaSinarm(termo?.sigmaSinarm ?? '')
    setDeliverValidationError('')
    setMessage({ type: '', text: '' })
  }

  function closeDeliver() {
    setDeliverWeapon(null)
    setDeliverMode('new')
    setDeliverOwner('')
    resetDeliverFormFields()
  }

  function revokeComprovanteObjectUrl() {
    if (comprovantePdfUrlRef.current) {
      URL.revokeObjectURL(comprovantePdfUrlRef.current)
      comprovantePdfUrlRef.current = ''
    }
  }

  function closeComprovantePreview() {
    revokeComprovanteObjectUrl()
    setComprovantePdfUrl('')
    setComprovanteFilename('')
    setComprovantePreviewOpen(false)
    setComprovanteReadOnly(false)
    setVendaPreviewTest(false)
  }

  async function handleDeleteWeapon(w) {
    const label = (w.name ?? '').trim() || 'esta arma'
    if (
      !window.confirm(
        `Excluir "${label}" permanentemente? Esta ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    if (editWeapon?.id === w.id) closeEdit()
    if (deliverWeapon?.id === w.id) closeDeliver()
    setBusyDeleteId(w.id)
    setMessage({ type: '', text: '' })
    try {
      await deleteWeapon(w.id)
      showMessage('success', 'Arma excluída.')
      await loadWeapons()
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao excluir arma.')
    } finally {
      setBusyDeleteId(null)
    }
  }

  async function submitEdit(e) {
    e.preventDefault()
    if (!editWeapon) return
    const trimmedOwner = editOwner.trim()
    const trimmedModel = editModelName.trim()
    if (!trimmedModel) {
      showMessage('error', 'Informe o modelo da arma.')
      return
    }
    if (!editWeaponTypeId || !editBrandId || !editCaliberId) {
      showMessage('error', 'Selecione tipo, marca e calibre.')
      return
    }
    if (!trimmedOwner) {
      showMessage('error', 'Informe o dono ou use "Em estoque da loja".')
      return
    }
    setBusyEditId(editWeapon.id)
    setMessage({ type: '', text: '' })
    try {
      await updateWeaponDetails(editWeapon.id, {
        name: trimmedModel,
        weaponTypeId: editWeaponTypeId,
        weaponTypeName: weaponTypes.find((t) => t.id === editWeaponTypeId)?.name,
        brandId: editBrandId,
        caliberId: editCaliberId,
        owner: trimmedOwner,
        serial: editSerial,
      })
      showMessage('success', 'Dados da arma atualizados.')
      closeEdit()
      await loadWeapons()
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao atualizar arma.')
    } finally {
      setBusyEditId(null)
    }
  }

  const openReport = useCallback(async () => {
    const { from, to } = defaultWeaponsReportDateRange()
    setReportFrom(from)
    setReportTo(to)
    setReportOpen(true)
    setReportLoading(true)
    try {
      const rows = await fetchWeapons()
      setWeapons(rows)
    } catch (err) {
      showMessage('error', err.message ?? 'Erro ao carregar armas.')
    } finally {
      setReportLoading(false)
    }
  }, [showMessage])

  const closeReport = useCallback(() => {
    setReportOpen(false)
  }, [])

  const formValid =
    modelName.trim() &&
    weaponTypeId &&
    brandId &&
    caliberId &&
    owner.trim() &&
    calibers.length > 0 &&
    weaponTypes.length > 0 &&
    weaponBrands.length > 0

  const editFormValid =
    editModelName.trim() &&
    editWeaponTypeId &&
    editBrandId &&
    editCaliberId &&
    editOwner.trim() &&
    calibers.length > 0 &&
    weaponTypes.length > 0 &&
    weaponBrands.length > 0

  const caliberNameById = buildCaliberDisplayById(calibers)
  const typeNameById = buildNameById(weaponTypes)
  const brandNameById = buildNameById(weaponBrands)

  function weaponLabelsFor(w) {
    if (!w) {
      return {
        type: '—',
        brand: '—',
        model: '—',
        caliber: '—',
        serial: '—',
      }
    }
    return {
      type: typeNameById[w.weapon_type_id] ?? '—',
      brand: brandNameById[w.brand_id] ?? '—',
      model: w.name ?? '—',
      caliber: caliberNameById[w.caliber_id] ?? '—',
      serial: parseWeaponSerialFromNotes(w.notes),
    }
  }

  const deliverWeaponSummary = useMemo(
    () => weaponLabelsFor(deliverWeapon),
    [deliverWeapon, typeNameById, brandNameById, caliberNameById],
  )

  function deliverOwnerTrimmed() {
    if (deliverMode === 'edit') return deliverOwner.trim()
    return (deliverWeapon?.owner ?? '').trim()
  }

  function validateDeliverForComprovante() {
    if (!deliverWeapon) return 'Arma não selecionada.'
    const owner = deliverOwnerTrimmed()
    if (!owner) {
      return deliverMode === 'edit'
        ? 'Informe o dono / recebedor.'
        : 'Esta arma não tem dono cadastrado. Use Editar para informar o dono.'
    }
    const fieldErr = validateWeaponEntregaFields({
      rg: deliverRg,
      cpf: deliverCpf,
      sigmaSinarm: deliverSigmaSinarm,
    })
    if (fieldErr) return fieldErr
    try {
      withdrawalIsoFromDateInput(deliverDate)
    } catch (err) {
      return err.message ?? 'Data de retirada inválida.'
    }
    return null
  }

  async function openEntregaComprovantePreview({ readOnly = false, weapon = deliverWeapon } = {}) {
    if (!weapon) {
      showMessage('error', 'Arma não selecionada.')
      return
    }
    const err = readOnly ? null : validateDeliverForComprovante()
    if (err) {
      setDeliverValidationError(err)
      return
    }
    setDeliverValidationError('')
    setMessage({ type: '', text: '' })

    const labels = weaponLabelsFor(weapon)
    const termo = readOnly ? parseTermoEntregaFromNotes(weapon?.notes) : null
    if (readOnly && !termo) {
      showMessage(
        'error',
        'Comprovante não encontrado nos registros desta arma (dados do termo não gravados).',
      )
      return
    }

    const recipient = readOnly
      ? termo
      : {
          rg: deliverRg,
          cpf: deliverCpf,
          sigmaSinarm: deliverSigmaSinarm,
        }

    const atDate = readOnly
      ? (() => {
          const wm = getWeaponWithdrawalMs(weapon)
          return Number.isFinite(wm) ? new Date(wm) : new Date()
        })()
      : dateFromDateInput(deliverDate)

    const weaponForPdf =
      deliverMode === 'edit' && weapon.id === deliverWeapon?.id
        ? { ...weapon, owner: deliverOwnerTrimmed() }
        : weapon
    const payload = buildComprovantePayload(weaponForPdf, labels, recipient, atDate)
    setGeneratingComprovante(true)
    setDeliverValidationError('')
    try {
      const { blob, filename } = await getWeaponEntregaComprovantePdfBlob(payload)
      if (!blob || blob.size === 0) {
        throw new Error('O PDF foi gerado vazio. Tente novamente.')
      }
      revokeComprovanteObjectUrl()
      const url = URL.createObjectURL(blob)
      comprovantePdfUrlRef.current = url
      flushSync(() => {
        setDocPreviewKind('entrega')
        setComprovanteFilename(filename)
        setComprovantePdfUrl(url)
        setComprovanteReadOnly(readOnly)
        setComprovantePreviewOpen(true)
      })
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o comprovante PDF.'
      setDeliverValidationError(msg)
      showMessage('error', msg)
    } finally {
      setGeneratingComprovante(false)
    }
  }

  async function handleRequestComprovante() {
    await openEntregaComprovantePreview()
  }

  /** @returns {Promise<boolean>} */
  async function confirmDeliverAfterComprovantePreview() {
    if (!deliverWeapon || comprovanteReadOnly) return false
    const err = validateDeliverForComprovante()
    if (err) {
      setDeliverValidationError(err)
      closeComprovantePreview()
      return false
    }
    const owner = deliverOwnerTrimmed()
    let withdrawnAt
    try {
      withdrawnAt = withdrawalIsoFromDateInput(deliverDate)
    } catch (e) {
      showMessage('error', e.message ?? 'Data de retirada inválida.')
      closeComprovantePreview()
      return false
    }

    const termoEntrega = {
      rg: deliverRg.trim(),
      cpf: deliverCpf,
      sigmaSinarm: deliverSigmaSinarm.trim(),
    }

    setBusyDeliverId(deliverWeapon.id)
    setMessage({ type: '', text: '' })
    try {
      if (deliverMode === 'edit') {
        await updateWeaponDelivery(deliverWeapon.id, {
          owner,
          responsible: deliverResponsible,
          withdrawnAt,
          termoEntrega,
        })
        showMessage('success', 'Entrega atualizada.')
      } else {
        await updateWeapon(deliverWeapon.id, {
          owner,
          status: 'retirada',
          responsible: deliverResponsible,
          withdrawnAt,
          termoEntrega,
        })
        showMessage('success', 'Saída da arma registrada.')
      }
      return true
    } catch (e) {
      showMessage(
        'error',
        e.message ??
          (deliverMode === 'edit'
            ? 'Erro ao atualizar entrega.'
            : 'Erro ao registrar saída da arma.'),
      )
      return false
    } finally {
      setBusyDeliverId(null)
    }
  }

  function finalizeDeliverAfterComprovanteConfirm() {
    closeComprovantePreview()
    closeDeliver()
    loadWeapons()
  }

  function handleDeliverCpfChange(value) {
    setDeliverCpf(maskCpfInput(value))
  }

  function openSale() {
    setSaleForm(
      emptySaleForm({
        weaponTypeId,
        brandId,
        caliberId,
      }),
    )
    setSaleValidationError('')
    setSaleOpen(true)
    setMessage({ type: '', text: '' })
  }

  function closeSale() {
    if (busySale) return
    setSaleOpen(false)
    setSaleValidationError('')
  }

  function handleSaleFieldChange(key, value) {
    if (key === 'clientCpf') {
      setSaleForm((prev) => ({ ...prev, clientCpf: maskCpfInput(value) }))
      return
    }
    if (key === 'clientCep') {
      const masked = maskCepInput(value)
      setSaleForm((prev) => ({ ...prev, clientCep: masked }))
      const digits = masked.replace(/\D/g, '')
      if (digits.length === 8) {
        const reqId = ++saleCepLookupRef.current
        setSaleCepLookingUp(true)
        void lookupAddressByCep(digits).then((addr) => {
          if (reqId !== saleCepLookupRef.current) return
          setSaleCepLookingUp(false)
          if (!addr) {
            setSaleValidationError('CEP não encontrado. Preencha o endereço manualmente.')
            return
          }
          setSaleValidationError('')
          setSaleForm((prev) => ({
            ...prev,
            clientCep: addr.cep,
            clientAddress: addr.address || prev.clientAddress,
            clientNeighborhood: addr.neighborhood || prev.clientNeighborhood,
            clientCity: addr.city || prev.clientCity,
          }))
        })
      } else {
        saleCepLookupRef.current += 1
        setSaleCepLookingUp(false)
      }
      return
    }
    setSaleForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSaleToggleDocProcess(id) {
    setSaleForm((prev) => {
      const cur = normalizeDocProcessIds(prev.docProcesses)
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      return {
        ...prev,
        docProcesses: next,
        docsValue: next.length === 0 ? '' : prev.docsValue,
      }
    })
  }

  function saleLabelsFromForm(form) {
    return {
      type: typeNameById[form.weaponTypeId] ?? '—',
      brand: brandNameById[form.brandId] ?? '—',
      model: (form.name ?? '').trim() || '—',
      caliber: caliberNameById[form.caliberId] ?? '—',
    }
  }

  async function openVendaPdfPreview({ readOnly = false, weapon = null } = {}) {
    setSaleValidationError('')
    setMessage({ type: '', text: '' })

    let form
    let labels
    let ownerName

    if (readOnly && weapon) {
      const parsed = parseVendaFromNotes(weapon.notes)
      if (!parsed) {
        showMessage(
          'error',
          'Documento de venda não encontrado nos registros desta arma.',
        )
        return
      }
      form = {
        ...parsed,
        name: weapon.name,
        weaponTypeId: weapon.weapon_type_id,
        brandId: weapon.brand_id,
        caliberId: weapon.caliber_id,
        clientName: weapon.owner,
        weaponValue: String(parsed.weaponValue ?? ''),
        docsValue: String(parsed.docsValue ?? ''),
      }
      labels = weaponLabelsFor(weapon)
      ownerName = weapon.owner
    } else {
      const err = validateWeaponVendaFields(saleForm)
      if (err) {
        setSaleValidationError(err)
        return
      }
      form = saleForm
      labels = saleLabelsFromForm(saleForm)
      ownerName = saleForm.clientName
    }

    const payload = buildVendaPdfPayload(
      { owner: ownerName, notes: weapon?.notes, name: form.name },
      labels,
      form,
    )
    payload.atDate = dateFromDateInput(form.saleDate)

    setGeneratingComprovante(true)
    try {
      const { blob, filename } = await getWeaponVendaPdfBlob(payload)
      if (!blob || blob.size === 0) {
        throw new Error('O PDF foi gerado vazio. Tente novamente.')
      }
      revokeComprovanteObjectUrl()
      const url = URL.createObjectURL(blob)
      comprovantePdfUrlRef.current = url
      flushSync(() => {
        setDocPreviewKind('venda')
        setVendaPreviewTest(false)
        setComprovanteFilename(filename)
        setComprovantePdfUrl(url)
        setComprovanteReadOnly(readOnly)
        setComprovantePreviewOpen(true)
      })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível gerar o PDF de venda.'
      if (!readOnly) setSaleValidationError(msg)
      showMessage('error', msg)
    } finally {
      setGeneratingComprovante(false)
    }
  }

  async function openVendaTestPreview() {
    setSaleValidationError('')
    setMessage({ type: '', text: '' })
    const payload = buildVendaLayoutTestPayload()
    payload.atDate = dateFromDateInput(payload.saleDate)

    setGeneratingComprovante(true)
    try {
      const { blob, filename } = await getWeaponVendaPdfBlob(payload)
      if (!blob || blob.size === 0) {
        throw new Error('O PDF de teste foi gerado vazio. Tente novamente.')
      }
      revokeComprovanteObjectUrl()
      const url = URL.createObjectURL(blob)
      comprovantePdfUrlRef.current = url
      flushSync(() => {
        setDocPreviewKind('venda')
        setVendaPreviewTest(true)
        setComprovanteFilename(filename)
        setComprovantePdfUrl(url)
        setComprovanteReadOnly(true)
        setComprovantePreviewOpen(true)
      })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível gerar o teste de impressão.'
      setSaleValidationError(msg)
      showMessage('error', msg)
    } finally {
      setGeneratingComprovante(false)
    }
  }

  async function confirmSaleAfterPreview() {
    if (comprovanteReadOnly || docPreviewKind !== 'venda') return false
    const err = validateWeaponVendaFields(saleForm)
    if (err) {
      setSaleValidationError(err)
      closeComprovantePreview()
      return false
    }
    setBusySale(true)
    setMessage({ type: '', text: '' })
    try {
      await createWeaponSale({
        ...saleForm,
        weaponTypeName: weaponTypes.find((t) => t.id === saleForm.weaponTypeId)?.name,
        weaponValue: parseMoneyInput(saleForm.weaponValue),
        docsValue: parseMoneyInput(saleForm.docsValue),
      })
      showMessage('success', 'Venda registrada. Arma na lista para compra.')
      return true
    } catch (e) {
      showMessage('error', e.message ?? 'Erro ao registrar venda.')
      return false
    } finally {
      setBusySale(false)
    }
  }

  function finalizeSaleAfterPreview() {
    closeComprovantePreview()
    setSaleOpen(false)
    setSaleValidationError('')
    loadWeapons()
  }

  function openAcquire(weapon) {
    if (!isPurchasePipelineStatus(weapon.status)) return
    setAcquireWeapon(weapon)
    setAcquireSerial('')
    setAcquireDestination('estoque')
    setAcquireValidationError('')
    setMessage({ type: '', text: '' })
  }

  async function handleMarkPurchased(weapon) {
    if (!weapon || weapon.status !== 'para_compra') return
    const ok = window.confirm(
      `Marcar "${weapon.name}" como comprada, aguardando chegada?`,
    )
    if (!ok) return
    setBusyMarkPurchasedId(weapon.id)
    setMessage({ type: '', text: '' })
    try {
      await markWeaponPurchased(weapon.id)
      showMessage('success', 'Status atualizado: Comprada! aguardando chegada.')
      await loadWeapons()
    } catch (e) {
      showMessage('error', e.message ?? 'Erro ao atualizar status.')
    } finally {
      setBusyMarkPurchasedId(null)
    }
  }

  function closeAcquire() {
    if (busyAcquireId) return
    setAcquireWeapon(null)
    setAcquireSerial('')
    setAcquireDestination('estoque')
    setAcquireValidationError('')
  }

  async function handleConfirmAcquire() {
    if (!acquireWeapon) return
    const serial = acquireSerial.trim()
    if (!serial) {
      setAcquireValidationError('Informe o número de série.')
      return
    }
    if (acquireDestination !== 'estoque' && acquireDestination !== 'dono') {
      setAcquireValidationError('Escolha o destino da arma.')
      return
    }
    setBusyAcquireId(acquireWeapon.id)
    setAcquireValidationError('')
    setMessage({ type: '', text: '' })
    try {
      await acquireWeaponSale(acquireWeapon.id, {
        serial,
        destination: acquireDestination,
      })
      showMessage('success', 'Arma adquirida e movida para estoque.')
      closeAcquire()
      await loadWeapons()
    } catch (e) {
      setAcquireValidationError(e.message ?? 'Erro ao adquirir arma.')
      showMessage('error', e.message ?? 'Erro ao adquirir arma.')
    } finally {
      setBusyAcquireId(null)
    }
  }

  const reportRowsAll = useMemo(
    () =>
      buildWeaponReportRows(
        weapons,
        caliberNameById,
        typeNameById,
        brandNameById,
      ),
    [weapons, caliberNameById, typeNameById, brandNameById],
  )

  const reportPeriod = useMemo(() => {
    const startMs = parseLocalDateStart(reportFrom)
    const endMs = parseLocalDateEnd(reportTo)
    return { startMs, endMs }
  }, [reportFrom, reportTo])

  const reportError = useMemo(() => {
    const { startMs, endMs } = reportPeriod
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return 'Informe datas de início e fim válidas.'
    }
    if (startMs > endMs) {
      return 'A data inicial não pode ser posterior à data final.'
    }
    return ''
  }, [reportPeriod])

  const weaponsInStock = useMemo(
    () => weapons.filter((w) => w.status === 'em_estoque'),
    [weapons],
  )

  const weaponsWithdrawnInPeriod = useMemo(
    () =>
      weapons.filter(
        (w) =>
          w.status === 'retirada' &&
          isTimestampInCurrentMonthLocal(getWeaponWithdrawalMs(w)),
      ),
    [weapons],
  )

  const listSearchQuery = listSearch.trim().toLowerCase()

  const filteredWeaponsInStock = useMemo(() => {
    if (!listSearchQuery) return weaponsInStock
    return weaponsInStock.filter((w) => matchesWeaponListSearch(w, listSearchQuery))
  }, [weaponsInStock, listSearchQuery])

  const filteredWeaponsWithdrawn = useMemo(() => {
    if (!listSearchQuery) return weaponsWithdrawnInPeriod
    return weaponsWithdrawnInPeriod.filter((w) =>
      matchesWeaponListSearch(w, listSearchQuery),
    )
  }, [weaponsWithdrawnInPeriod, listSearchQuery])

  const weaponsParaCompra = useMemo(
    () => weapons.filter((w) => isPurchasePipelineStatus(w.status)),
    [weapons],
  )

  const filteredWeaponsParaCompra = useMemo(() => {
    if (!listSearchQuery) return weaponsParaCompra
    return weaponsParaCompra.filter((w) => matchesWeaponListSearch(w, listSearchQuery))
  }, [weaponsParaCompra, listSearchQuery])

  const showStockSection = listFilter === 'todas'
  const showWithdrawnSection = listFilter === 'todas'
  const showParaCompraSection = listFilter === 'todas' || listFilter === 'comprar'
  const inStockShopRows = useMemo(() => {
    if (reportError) return []
    return reportRowsAll.filter(
      (r) => r.status === 'em_estoque' && isShopStockOwner(r.owner),
    )
  }, [reportRowsAll, reportError])

  const inStockFixedOwnerRows = useMemo(() => {
    if (reportError) return []
    return reportRowsAll.filter(
      (r) => r.status === 'em_estoque' && !isShopStockOwner(r.owner),
    )
  }, [reportRowsAll, reportError])

  const soldRows = useMemo(() => {
    if (reportError) return []
    const { startMs, endMs } = reportPeriod
    return reportRowsAll.filter((r) => {
      if (r.status !== 'retirada') return false
      if (!Number.isFinite(r.withdrawalMs)) return false
      return r.withdrawalMs >= startMs && r.withdrawalMs <= endMs
    })
  }, [reportRowsAll, reportPeriod, reportError])

  const exportWeaponsPdf = useCallback(() => {
    if (reportError) return
    downloadWeaponsReportPdf({
      inStockShopRows,
      inStockFixedOwnerRows,
      soldRows,
      periodFrom: reportFrom,
      periodTo: reportTo,
    })
  }, [
    inStockShopRows,
    inStockFixedOwnerRows,
    soldRows,
    reportFrom,
    reportTo,
    reportError,
  ])

  return (
    <div className="weapons-page">
      <header className="weapons-page__header">
        <h1>Armas</h1>
        <p className="weapons-page__subtitle">
          Cadastro e controle de armas da loja. Estoque, retiradas do mês e armas
          vendidas aguardando compra aparecem em tabelas separadas. Pendentes de compra
          não entram no mapa/relatório.
        </p>
      </header>

      {message.text ? (
        <div
          className={`weapons-page__message weapons-page__message--${message.type}`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      <WeaponsReportModal
        open={reportOpen}
        onClose={closeReport}
        loading={reportLoading}
        reportFrom={reportFrom}
        reportTo={reportTo}
        onReportFromChange={setReportFrom}
        onReportToChange={setReportTo}
        reportError={reportError}
        inStockShopRows={inStockShopRows}
        inStockFixedOwnerRows={inStockFixedOwnerRows}
        soldRows={soldRows}
        onExportPdf={exportWeaponsPdf}
      />

      <SaidaTermoPreviewModal
        open={comprovantePreviewOpen}
        pdfUrl={comprovantePdfUrl}
        filename={comprovanteFilename}
        onClose={closeComprovantePreview}
        onConfirmRegister={
          comprovanteReadOnly
            ? undefined
            : docPreviewKind === 'venda'
              ? confirmSaleAfterPreview
              : confirmDeliverAfterComprovantePreview
        }
        onFinalizeAfterSuccessfulRegister={
          comprovanteReadOnly
            ? undefined
            : docPreviewKind === 'venda'
              ? finalizeSaleAfterPreview
              : finalizeDeliverAfterComprovanteConfirm
        }
        confirming={
          docPreviewKind === 'venda'
            ? busySale
            : deliverWeapon != null && busyDeliverId === deliverWeapon.id
        }
        readOnly={comprovanteReadOnly}
        titlePreview={
          docPreviewKind === 'venda'
            ? 'Documento de venda de arma — pré-visualização'
            : 'Comprovante de entrega de arma — pré-visualização'
        }
        titleReadOnly={
          vendaPreviewTest
            ? 'Teste de impressão — papel de venda e contrato'
            : docPreviewKind === 'venda'
              ? 'Documento de venda de arma'
              : 'Comprovante de entrega de arma de fogo'
        }
        hintPreview={
          docPreviewKind === 'venda'
            ? 'Confira o PDF abaixo. Ao confirmar, a venda é registrada e a arma vai para Armas para compra.'
            : deliverMode === 'edit' && !comprovanteReadOnly
              ? 'Confira o PDF abaixo. Ao confirmar, os dados da entrega são atualizados.'
              : 'Confira o PDF abaixo. Ao confirmar, a retirada é registrada. Use Imprimir ou Baixar PDF para entregar ao cliente.'
        }
        hintReadOnly={
          vendaPreviewTest
            ? 'Dados fictícios só para conferir o layout do papel de venda e do contrato. Nada é registrado. Use Imprimir ou Baixar PDF.'
            : docPreviewKind === 'venda'
              ? 'Documento gerado a partir dos dados gravados na venda.'
              : 'Comprovante gerado a partir dos dados gravados na retirada.'
        }
        confirmLabel={
          docPreviewKind === 'venda'
            ? 'Confirmar venda'
            : deliverMode === 'edit'
              ? 'Salvar alterações'
              : 'Confirmar saída'
        }
        defaultDownloadName={
          docPreviewKind === 'venda'
            ? 'venda-arma.pdf'
            : 'comprovante-entrega-arma.pdf'
        }
        duplexPrint={docPreviewKind === 'venda'}
      />

      <WeaponDeliverModal
        weapon={
          deliverWeapon && !comprovantePreviewOpen && docPreviewKind !== 'venda'
            ? deliverWeapon
            : null
        }
        mode={deliverMode}
        weaponSummary={deliverWeaponSummary}
        owner={deliverMode === 'edit' ? deliverOwner : (deliverWeapon?.owner ?? '')}
        onOwnerChange={setDeliverOwner}
        rg={deliverRg}
        onRgChange={setDeliverRg}
        cpf={deliverCpf}
        onCpfChange={handleDeliverCpfChange}
        sigmaSinarm={deliverSigmaSinarm}
        onSigmaSinarmChange={setDeliverSigmaSinarm}
        responsible={deliverResponsible}
        onResponsibleChange={setDeliverResponsible}
        withdrawDate={deliverDate}
        onWithdrawDateChange={setDeliverDate}
        busy={
          generatingComprovante ||
          (deliverWeapon != null && busyDeliverId === deliverWeapon.id)
        }
        validationError={deliverValidationError}
        onClose={closeDeliver}
        onRequestComprovante={handleRequestComprovante}
      />

      <WeaponSaleModal
        open={saleOpen && !(comprovantePreviewOpen && docPreviewKind === 'venda')}
        weaponTypes={weaponTypes}
        weaponBrands={weaponBrands}
        calibers={calibers}
        loadingMeta={loadingWeaponMeta}
        loadingCalibers={loadingCalibers}
        caliberDisplayById={caliberNameById}
        values={saleForm}
        onChange={handleSaleFieldChange}
        onToggleDocProcess={handleSaleToggleDocProcess}
        busy={generatingComprovante || busySale}
        validationError={saleValidationError}
        cepLookingUp={saleCepLookingUp}
        onClose={closeSale}
        onRequestPdf={() => openVendaPdfPreview()}
        onRequestTestPrint={openVendaTestPreview}
      />

      <WeaponAcquireModal
        weapon={acquireWeapon}
        weaponSummary={weaponLabelsFor(acquireWeapon)}
        clientName={acquireWeapon?.owner ?? ''}
        serial={acquireSerial}
        onSerialChange={setAcquireSerial}
        destination={acquireDestination}
        onDestinationChange={setAcquireDestination}
        busy={acquireWeapon != null && busyAcquireId === acquireWeapon.id}
        validationError={acquireValidationError}
        onClose={closeAcquire}
        onConfirm={handleConfirmAcquire}
      />
      {editWeapon ? (
        <div
          className="weapons-dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEdit()
          }}
        >
          <div
            className="weapons-dialog weapons-dialog--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weapons-edit-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="weapons-edit-title" className="weapons-dialog__title">
              Editar arma
            </h2>
            <form className="weapons-form" onSubmit={submitEdit}>
              <label className="weapons-field">
                <span className="weapons-field__label">Tipo da arma</span>
                <select
                  value={editWeaponTypeId}
                  onChange={(e) => setEditWeaponTypeId(e.target.value)}
                  disabled={
                    loadingWeaponMeta ||
                    weaponTypes.length === 0 ||
                    busyEditId === editWeapon.id
                  }
                >
                  {weaponTypes.length === 0 ? (
                    <option value="">Cadastre um tipo em Cadastro</option>
                  ) : (
                    weaponTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="weapons-field">
                <span className="weapons-field__label">Marca</span>
                <select
                  value={editBrandId}
                  onChange={(e) => setEditBrandId(e.target.value)}
                  disabled={
                    loadingWeaponMeta ||
                    weaponBrands.length === 0 ||
                    busyEditId === editWeapon.id
                  }
                >
                  {weaponBrands.length === 0 ? (
                    <option value="">Cadastre uma marca em Cadastro</option>
                  ) : (
                    weaponBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="weapons-field">
                <span className="weapons-field__label">Calibre</span>
                <select
                  value={editCaliberId}
                  onChange={(e) => setEditCaliberId(e.target.value)}
                  disabled={
                    loadingCalibers ||
                    calibers.length === 0 ||
                    busyEditId === editWeapon.id
                  }
                >
                  {calibers.length === 0 ? (
                    <option value="">Cadastre um calibre em Cadastro</option>
                  ) : (
                    calibers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.product_type
                          ? `${c.name} (${productTypeLabel(c.product_type)})`
                          : c.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="weapons-field">
                <span className="weapons-field__label">Modelo da arma</span>
                <input
                  ref={editModelRef}
                  type="text"
                  value={editModelName}
                  onChange={(e) => setEditModelName(e.target.value)}
                  placeholder="Ex: G19, 686"
                  autoComplete="off"
                  disabled={busyEditId === editWeapon.id}
                />
              </label>

              <label className="weapons-field">
                <span className="weapons-field__label">Número de série (opcional)</span>
                <input
                  type="text"
                  value={editSerial}
                  onChange={(e) => setEditSerial(e.target.value)}
                  placeholder="Ex: ABC12345"
                  autoComplete="off"
                  disabled={busyEditId === editWeapon.id}
                />
              </label>

              <label className="weapons-field">
                <span className="weapons-field__label">Dono</span>
                <input
                  type="text"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  placeholder="Nome do dono"
                  autoComplete="off"
                  disabled={busyEditId === editWeapon.id}
                />
              </label>

              <div className="weapons-form__row-actions">
                <button
                  type="button"
                  className="weapons-form__stock-btn weapons-form__stock-btn--ghost"
                  onClick={setEditOwnerToStock}
                  disabled={busyEditId === editWeapon.id}
                >
                  Em estoque da loja
                </button>
                <button
                  type="submit"
                  disabled={busyEditId === editWeapon.id || !editFormValid}
                >
                  {busyEditId === editWeapon.id ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  className="weapons-form__stock-btn weapons-form__stock-btn--ghost"
                  onClick={closeEdit}
                  disabled={busyEditId === editWeapon.id}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {cadastroOpen ? (
        <div
          className="weapons-dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCadastroOpen(false)
          }}
        >
          <div
            className="weapons-dialog weapons-dialog--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weapons-form-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="weapons-form-title" className="weapons-dialog__title">
              Cadastrar arma
            </h2>
            <form className="weapons-form" onSubmit={handleSubmitWeapon}>
          <label className="weapons-field">
            <span className="weapons-field__label">Tipo da arma</span>
            <select
              value={weaponTypeId}
              onChange={(e) => setWeaponTypeId(e.target.value)}
              disabled={
                loadingWeaponMeta || weaponTypes.length === 0 || saving
              }
            >
              {loadingWeaponMeta ? (
                <option value="">Carregando…</option>
              ) : weaponTypes.length === 0 ? (
                <option value="">Cadastre um tipo em Cadastro</option>
              ) : (
                weaponTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="weapons-field">
            <span className="weapons-field__label">Marca</span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              disabled={
                loadingWeaponMeta || weaponBrands.length === 0 || saving
              }
            >
              {loadingWeaponMeta ? (
                <option value="">Carregando…</option>
              ) : weaponBrands.length === 0 ? (
                <option value="">Cadastre uma marca em Cadastro</option>
              ) : (
                weaponBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="weapons-field">
            <span className="weapons-field__label">Calibre</span>
            <select
              value={caliberId}
              onChange={(e) => setCaliberId(e.target.value)}
              disabled={loadingCalibers || calibers.length === 0 || saving}
            >
              {loadingCalibers ? (
                <option value="">Carregando…</option>
              ) : calibers.length === 0 ? (
                <option value="">Cadastre um calibre em Cadastro</option>
              ) : (
                calibers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.product_type
                      ? `${c.name} (${productTypeLabel(c.product_type)})`
                      : c.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="weapons-field">
            <span className="weapons-field__label">Modelo da arma</span>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Ex: G19, 686"
              autoComplete="off"
              disabled={saving}
            />
          </label>

          <label className="weapons-field">
            <span className="weapons-field__label">Número de série (opcional)</span>
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Gravado em notes no banco"
              autoComplete="off"
              disabled={saving}
            />
          </label>

          <label className="weapons-field">
            <span className="weapons-field__label">Dono</span>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Nome do dono"
              autoComplete="off"
              disabled={saving}
            />
          </label>

          <div className="weapons-form__row-actions">
            <button
              type="button"
              className="weapons-form__stock-btn weapons-form__stock-btn--ghost"
              onClick={setOwnerToStock}
              disabled={saving}
            >
              Em estoque da loja
            </button>
            <button type="submit" disabled={saving || !formValid}>
              {saving ? 'Salvando…' : 'Cadastrar arma'}
            </button>
            <button
              type="button"
              className="weapons-form__stock-btn weapons-form__stock-btn--ghost"
              onClick={() => setCadastroOpen(false)}
              disabled={saving}
            >
              Fechar
            </button>
          </div>
        </form>
          </div>
        </div>
      ) : null}

      <div className="weapons-page__toolbar">
        <button
          type="button"
          className="weapons-page__report"
          onClick={() => setCadastroOpen(true)}
          disabled={loadingWeaponMeta || loadingCalibers}
        >
          Cadastrar arma
        </button>
        <button
          type="button"
          className="weapons-page__report"
          onClick={openSale}
          disabled={loadingWeaponMeta || loadingCalibers}
        >
          Registrar venda
        </button>
        <button
          type="button"
          className="weapons-page__report"
          onClick={openReport}
          disabled={loadingWeaponMeta || loadingCalibers}
        >
          Relatório
        </button>
        <button
          type="button"
          className="weapons-page__refresh"
          onClick={() => {
            loadCalibers()
            loadWeaponMeta()
            loadWeapons()
          }}
          disabled={loadingWeapons && weapons.length === 0}
        >
          {loadingWeapons ? 'Carregando…' : 'Atualizar lista'}
        </button>
      </div>

      <section
        className={`stock-page__filters weapons-page__filters${listSearchOpen ? ' weapons-page__filters--open' : ''}`}
        aria-label="Pesquisa"
      >
        <button
          type="button"
          className={`weapons-page__search-toggle${listSearchOpen ? ' weapons-page__search-toggle--open' : ''}${listSearchQuery || listFilter !== 'todas' ? ' weapons-page__search-toggle--active' : ''}`}
          aria-expanded={listSearchOpen}
          aria-controls="weapons-list-search"
          aria-label={listSearchOpen ? 'Fechar pesquisa' : 'Pesquisar listas'}
          title={listSearchOpen ? 'Fechar pesquisa' : 'Pesquisar listas'}
          onClick={() => setListSearchOpen((open) => !open)}
        >
          <SearchToggleIcon />
        </button>
        {listSearchOpen ? (
          <div id="weapons-list-search" className="weapons-page__search-panel">
            <h2 className="stock-page__filters-title">Pesquisar listas</h2>
            <div className="stock-page__filters-row">
              <label className="stock-page__filter-field">
                <span className="stock-page__filter-label">Filtro</span>
                <select
                  value={listFilter}
                  onChange={(e) => setListFilter(/** @type {'todas' | 'comprar'} */ (e.target.value))}
                  disabled={loadingWeapons && weapons.length === 0}
                >
                  <option value="todas">Todas</option>
                  <option value="comprar">Comprar</option>
                </select>
              </label>
              <label className="stock-page__filter-field stock-page__filter-field--grow">
                <span className="stock-page__filter-label">
                  Modelo ou dono
                </span>
                <input
                  ref={listSearchInputRef}
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Ex.: Glock, João Silva"
                  autoComplete="off"
                  disabled={loadingWeapons && weapons.length === 0}
                  enterKeyHint="search"
                />
              </label>
              {listSearchQuery || listFilter !== 'todas' ? (
                <button
                  type="button"
                  className="stock-page__filters-clear"
                  onClick={() => {
                    setListSearch('')
                    setListFilter('todas')
                  }}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {showParaCompraSection ? (
      <section
        className="weapons-page__table-section"
        aria-labelledby="weapons-para-compra-heading"
      >
        <h2 id="weapons-para-compra-heading" className="weapons-page__table-heading">
          Armas para compra
        </h2>
        <p className="weapons-page__table-hint">
          Vendidas e ainda não recebidas no estoque. Não entram no relatório/mapa.
          Marque como comprada ao pedir ao fornecedor; ao chegar, informe o nº de série
          e o destino (estoque ou dono).
        </p>
        <div className="weapons-page__table-wrap">
          <table className="weapons-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Marca</th>
                <th>Tipo</th>
                <th>Calibre</th>
                <th>Cliente</th>
                <th>Data venda</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingWeapons && weapons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Carregando…
                  </td>
                </tr>
              ) : weaponsParaCompra.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhuma arma aguardando compra.
                  </td>
                </tr>
              ) : filteredWeaponsParaCompra.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhum resultado para a pesquisa (modelo ou dono).
                  </td>
                </tr>
              ) : (
                filteredWeaponsParaCompra.map((w) => {
                  const venda = parseVendaFromNotes(w.notes)
                  const saleDateLabel = venda?.saleDate
                    ? formatDateBrShort(venda.saleDate)
                    : '—'
                  const rowBusy =
                    busyAcquireId === w.id ||
                    busyDeleteId === w.id ||
                    busyMarkPurchasedId === w.id ||
                    busyEditId === w.id
                  return (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td>{brandNameById[w.brand_id] ?? '—'}</td>
                      <td>{typeNameById[w.weapon_type_id] ?? '—'}</td>
                      <td>{caliberNameById[w.caliber_id] ?? '—'}</td>
                      <td>{w.owner}</td>
                      <td>{saleDateLabel}</td>
                      <td>{statusLabel(w.status)}</td>
                      <td className="weapons-table__actions weapons-table__actions--labeled">
                        <WeaponIconButton
                          kind="edit"
                          label="Editar dados da arma"
                          caption="Editar dados"
                          showLabel
                          disabled={rowBusy}
                          onClick={() => openEdit(w)}
                        />
                        <WeaponIconButton
                          kind="receipt"
                          label="Documento de venda"
                          showLabel
                          disabled={rowBusy}
                          onClick={() =>
                            openVendaPdfPreview({ readOnly: true, weapon: w })
                          }
                        />
                        {w.status === 'para_compra' ? (
                          <WeaponIconButton
                            kind="purchased"
                            label="Marcar como comprada (aguardando chegada)"
                            caption="Marcar comprada"
                            showLabel
                            disabled={rowBusy}
                            onClick={() => handleMarkPurchased(w)}
                          />
                        ) : null}
                        <WeaponIconButton
                          kind="acquire"
                          label="Adquirir arma (chegou — informar série)"
                          caption="Registrar chegada"
                          showLabel
                          disabled={rowBusy}
                          onClick={() => openAcquire(w)}
                        />
                        <WeaponIconButton
                          kind="delete"
                          label="Excluir registro de venda"
                          caption="Excluir"
                          showLabel
                          disabled={rowBusy}
                          onClick={() => handleDeleteWeapon(w)}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {showStockSection ? (
      <section className="weapons-page__table-section" aria-labelledby="weapons-stock-heading">
        <h2 id="weapons-stock-heading" className="weapons-page__table-heading">
          Armas em estoque
        </h2>
        <div className="weapons-page__table-wrap">
          <table className="weapons-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Marca</th>
                <th>Tipo</th>
                <th>Calibre</th>
                <th>Nº série</th>
                <th>Dono</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingWeapons && weapons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Carregando…
                  </td>
                </tr>
              ) : weapons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhuma arma cadastrada.
                  </td>
                </tr>
              ) : weaponsInStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhuma arma em estoque.
                  </td>
                </tr>
              ) : filteredWeaponsInStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhum resultado para a pesquisa (modelo ou dono).
                  </td>
                </tr>
              ) : (
                filteredWeaponsInStock.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{brandNameById[w.brand_id] ?? '—'}</td>
                    <td>{typeNameById[w.weapon_type_id] ?? '—'}</td>
                    <td>{caliberNameById[w.caliber_id] ?? '—'}</td>
                    <td>{parseWeaponSerialFromNotes(w.notes)}</td>
                    <td>{w.owner}</td>
                    <td>{statusLabel(w.status)}</td>
                    <td className="weapons-table__actions">
                      <WeaponIconButton
                        kind="edit"
                        label="Editar dados da arma"
                        disabled={
                          busyDeliverId === w.id ||
                          busyEditId === w.id ||
                          busyDeleteId === w.id
                        }
                        onClick={() => openEdit(w)}
                      />
                      <WeaponIconButton
                        kind="clipboard"
                        label="Registrar entrega da arma"
                        disabled={
                          busyDeliverId === w.id ||
                          busyEditId === w.id ||
                          busyDeleteId === w.id
                        }
                        onClick={() => openDeliver(w)}
                      />
                      <WeaponIconButton
                        kind="delete"
                        label="Excluir arma"
                        disabled={
                          busyDeliverId === w.id ||
                          busyEditId === w.id ||
                          busyDeleteId === w.id
                        }
                        onClick={() => handleDeleteWeapon(w)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {showWithdrawnSection ? (
      <section
        className="weapons-page__table-section"
        aria-labelledby="weapons-clients-heading"
      >
        <h2 id="weapons-clients-heading" className="weapons-page__table-heading">
          Armas com clientes (retiradas deste mês)
        </h2>
        <p className="weapons-page__table-hint">
          Só aparecem entregas do mês atual. Para consultar meses anteriores, vá em{' '}
          <strong>Mapa mensal</strong> e gere o relatório.
        </p>
        <div className="weapons-page__table-wrap">
          <table className="weapons-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Marca</th>
                <th>Tipo</th>
                <th>Calibre</th>
                <th>Nº série</th>
                <th>Dono</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingWeapons && weapons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Carregando…
                  </td>
                </tr>
              ) : weapons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhuma arma cadastrada.
                  </td>
                </tr>
              ) : weaponsWithdrawnInPeriod.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhuma retirada neste mês. Entregas antigas estão no Mapa mensal.
                  </td>
                </tr>
              ) : filteredWeaponsWithdrawn.length === 0 ? (
                <tr>
                  <td colSpan={8} className="weapons-table__empty">
                    Nenhum resultado para a pesquisa (modelo ou dono).
                  </td>
                </tr>
              ) : (
                filteredWeaponsWithdrawn.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{brandNameById[w.brand_id] ?? '—'}</td>
                    <td>{typeNameById[w.weapon_type_id] ?? '—'}</td>
                    <td>{caliberNameById[w.caliber_id] ?? '—'}</td>
                    <td>{parseWeaponSerialFromNotes(w.notes)}</td>
                    <td>{w.owner}</td>
                    <td>{statusLabel(w.status)}</td>
                    <td className="weapons-table__actions">
                      <WeaponIconButton
                        kind="edit"
                        label="Editar dados da arma"
                        disabled={
                          busyDeleteId === w.id ||
                          busyDeliverId === w.id ||
                          busyEditId === w.id ||
                          (deliverWeapon?.id === w.id && !comprovantePreviewOpen)
                        }
                        onClick={() => openEdit(w)}
                      />
                      <WeaponIconButton
                        kind="clipboard"
                        label="Editar entrega"
                        disabled={
                          busyDeleteId === w.id ||
                          busyDeliverId === w.id ||
                          busyEditId === w.id ||
                          (deliverWeapon?.id === w.id && !comprovantePreviewOpen)
                        }
                        onClick={() => openEditDelivery(w)}
                      />
                      <WeaponIconButton
                        kind="receipt"
                        label="Comprovante de entrega"
                        disabled={busyDeleteId === w.id || busyDeliverId === w.id}
                        onClick={() =>
                          openEntregaComprovantePreview({
                            readOnly: true,
                            weapon: w,
                          })
                        }
                      />
                      <WeaponIconButton
                        kind="delete"
                        label="Excluir arma"
                        disabled={
                          busyDeleteId === w.id ||
                          busyDeliverId === w.id ||
                          deliverWeapon?.id === w.id
                        }
                        onClick={() => handleDeleteWeapon(w)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  )
}
