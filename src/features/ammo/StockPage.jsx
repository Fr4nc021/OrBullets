import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createAmmoMovement,
  fetchAmmoMovementsForReport,
  fetchAmmoStock,
  fetchAmmoTypeOptions,
  fetchCalibers,
} from './ammoApi.js'
import { buildProductHierarchySections } from './ammoStockSections.js'
import { PRODUCT_TYPE_KEYS, productTypeLabel } from './productTypes.js'
import {
  computeStockReportHierarchy,
  parseLocalDateEnd,
  parseLocalDateStart,
} from './ammoStockReport.js'
import { getSaidaTermoPdfBlob } from './saidaTermoPdf.js'
import { SaidaTermoPreviewModal } from './components/SaidaTermoPreviewModal.jsx'
import { downloadStockReportHierarchyPdf } from './stockReportPdf.js'
import { StockReportModal } from './components/StockReportModal.jsx'
import { StockMovementModal } from './components/StockMovementModal.jsx'
import { checkLowStockAlert } from '../../services/alertsService.js'
import { LowStockAlertDialog } from '../settings/LowStockAlertDialog.jsx'
import './StockPage.css'

function defaultReportDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: iso(start), to: iso(now) }
}

function parseQuantityInput(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number(String(raw).replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  return n
}

export default function StockPage() {
  const [rows, setRows] = useState([])
  const [calibers, setCalibers] = useState([])
  const [ammoOptions, setAmmoOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCalibers, setLoadingCalibers] = useState(true)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [dialog, setDialog] = useState(null)
  const [selectedAmmoId, setSelectedAmmoId] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [saidaLines, setSaidaLines] = useState([])
  const [entradaStep, setEntradaStep] = useState(1)
  const [entradaProductType, setEntradaProductType] = useState('')
  const [entradaCaliber, setEntradaCaliber] = useState('')
  const [entradaLines, setEntradaLines] = useState([])
  const [entradaNfNumber, setEntradaNfNumber] = useState('')
  const [saidaStep, setSaidaStep] = useState(1)
  const [saidaProductType, setSaidaProductType] = useState('')
  const [saidaCaliber, setSaidaCaliber] = useState('')
  const [filterProductType, setFilterProductType] = useState('')
  const [filterCaliberCompound, setFilterCaliberCompound] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportFilterProductType, setReportFilterProductType] = useState('')
  const [reportCaliberId, setReportCaliberId] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const selectRef = useRef(null)
  const saidaTermoPdfUrlRef = useRef('')
  const [saidaTermoPreviewOpen, setSaidaTermoPreviewOpen] = useState(false)
  const [saidaTermoPdfUrl, setSaidaTermoPdfUrl] = useState('')
  const [saidaTermoFilename, setSaidaTermoFilename] = useState('')
  const [lowStockOpen, setLowStockOpen] = useState(false)
  const [lowStockItems, setLowStockItems] = useState(
    /** @type {{ name: string, caliber: string, productType?: string, quantity: number }[]} */ ([]),
  )
  const [lowStockThreshold, setLowStockThreshold] = useState(100)
  const [lowStockLoading, setLowStockLoading] = useState(false)
  const [lowStockError, setLowStockError] = useState('')
  const [lowStockCount, setLowStockCount] = useState(0)

  function revokeSaidaTermoObjectUrl() {
    if (saidaTermoPdfUrlRef.current) {
      URL.revokeObjectURL(saidaTermoPdfUrlRef.current)
      saidaTermoPdfUrlRef.current = ''
    }
  }

  function closeSaidaTermoPreview() {
    revokeSaidaTermoObjectUrl()
    setSaidaTermoPdfUrl('')
    setSaidaTermoFilename('')
    setSaidaTermoPreviewOpen(false)
  }

  useEffect(() => {
    return () => {
      if (saidaTermoPdfUrlRef.current) {
        URL.revokeObjectURL(saidaTermoPdfUrlRef.current)
      }
    }
  }, [])

  const loadCalibers = useCallback(async () => {
    setLoadingCalibers(true)
    try {
      const list = await fetchCalibers()
      setCalibers(list)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message ?? 'Erro ao carregar calibres.',
      })
    } finally {
      setLoadingCalibers(false)
    }
  }, [])

  const loadAmmoOptions = useCallback(async () => {
    setLoadingOptions(true)
    try {
      const options = await fetchAmmoTypeOptions()
      setAmmoOptions(options)
      setSelectedAmmoId((prev) => {
        if (prev && options.some((o) => o.id === prev)) return prev
        return options[0]?.id ?? ''
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message ?? 'Erro ao carregar tipos de munição.',
      })
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  const loadStock = useCallback(async () => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const data = await fetchAmmoStock()
      setRows(data)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message ?? 'Erro ao carregar estoque.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAll = useCallback(() => {
    return Promise.all([loadStock(), loadAmmoOptions(), loadCalibers()])
  }, [loadStock, loadAmmoOptions, loadCalibers])

  const refreshLowStockBadge = useCallback(async () => {
    try {
      const result = await checkLowStockAlert()
      setLowStockCount(
        Array.isArray(result?.items) ? result.items.length : 0,
      )
    } catch {
      setLowStockCount(0)
    }
  }, [])

  useEffect(() => {
    void refreshLowStockBadge()
  }, [refreshLowStockBadge])

  async function openLowStockAlert() {
    setLowStockOpen(true)
    setLowStockLoading(true)
    setLowStockError('')
    try {
      const result = await checkLowStockAlert()
      const items = Array.isArray(result?.items) ? result.items : []
      setLowStockItems(items)
      setLowStockThreshold(Number(result?.threshold) || 100)
      setLowStockCount(items.length)
    } catch (err) {
      setLowStockItems([])
      setLowStockError(
        err?.message || 'Não foi possível carregar o estoque baixo.',
      )
    } finally {
      setLowStockLoading(false)
    }
  }

  const hierarchySections = useMemo(
    () => buildProductHierarchySections(calibers, rows),
    [calibers, rows],
  )

  const tiposWithAmmo = useMemo(() => {
    const s = new Set(
      ammoOptions.map((o) => o.product_type ?? 'municao'),
    )
    return PRODUCT_TYPE_KEYS.filter((k) => s.has(k))
  }, [ammoOptions])

  const calibersForEntradaTipo = useMemo(() => {
    if (!entradaProductType) return []
    const names = new Set(
      ammoOptions
        .filter((o) => o.product_type === entradaProductType)
        .map((o) => o.caliber),
    )
    return [...names].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    )
  }, [ammoOptions, entradaProductType])

  const calibersForSaidaTipo = useMemo(() => {
    if (!saidaProductType) return []
    const names = new Set(
      ammoOptions
        .filter((o) => o.product_type === saidaProductType)
        .map((o) => o.caliber),
    )
    return [...names].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    )
  }, [ammoOptions, saidaProductType])

  const ammoOptionsForEntradaStep3 = useMemo(() => {
    if (!entradaProductType || !entradaCaliber) return []
    return ammoOptions.filter(
      (o) =>
        o.product_type === entradaProductType && o.caliber === entradaCaliber,
    )
  }, [ammoOptions, entradaProductType, entradaCaliber])

  const ammoOptionsForSaidaStep3 = useMemo(() => {
    if (!saidaProductType || !saidaCaliber) return []
    return ammoOptions.filter(
      (o) =>
        o.product_type === saidaProductType && o.caliber === saidaCaliber,
    )
  }, [ammoOptions, saidaProductType, saidaCaliber])

  const caliberFilterOptions = useMemo(() => {
    const opts = []
    for (const block of hierarchySections) {
      if (filterProductType && block.typeKey !== filterProductType) continue
      for (const cs of block.caliberSections) {
        opts.push({
          value: `${block.typeKey}::${cs.key}`,
          label: `${block.typeLabel} — ${cs.title}`,
        })
      }
    }
    return opts
  }, [hierarchySections, filterProductType])

  const reportCaliberOptions = useMemo(() => {
    let list = calibers
    if (reportFilterProductType) {
      list = list.filter((c) => c.product_type === reportFilterProductType)
    }
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    )
  }, [calibers, reportFilterProductType])

  const filteredHierarchy = useMemo(() => {
    let blocks = hierarchySections
    if (filterProductType) {
      blocks = blocks.filter((b) => b.typeKey === filterProductType)
    }
    if (filterCaliberCompound) {
      const [tKey, cKey] = filterCaliberCompound.split('::')
      blocks = blocks
        .filter((b) => b.typeKey === tKey)
        .map((b) => ({
          ...b,
          caliberSections: b.caliberSections.filter((cs) => cs.key === cKey),
        }))
    }
    const q = typeSearch.trim().toLowerCase()
    if (q) {
      blocks = blocks
        .map((b) => ({
          ...b,
          caliberSections: b.caliberSections
            .map((cs) => ({
              ...cs,
              rows: cs.rows.filter((r) =>
                r.ammo_name.toLowerCase().includes(q),
              ),
            }))
            .filter((cs) => cs.rows.length > 0),
        }))
        .filter((b) => b.caliberSections.length > 0)
    }
    return blocks
  }, [
    hierarchySections,
    filterProductType,
    filterCaliberCompound,
    typeSearch,
  ])

  useEffect(() => {
    if (
      filterCaliberCompound &&
      !caliberFilterOptions.some((o) => o.value === filterCaliberCompound)
    ) {
      setFilterCaliberCompound('')
    }
  }, [caliberFilterOptions, filterCaliberCompound])

  useEffect(() => {
    if (!reportCaliberId) return
    const c = calibers.find((x) => x.id === reportCaliberId)
    if (!c) {
      setReportCaliberId('')
      return
    }
    if (
      reportFilterProductType &&
      c.product_type !== reportFilterProductType
    ) {
      setReportCaliberId('')
    }
  }, [reportFilterProductType, reportCaliberId, calibers])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!dialog) return
    const shouldFocusSelect =
      (dialog.movementType === 'saida' &&
        saidaStep === 3 &&
        ammoOptionsForSaidaStep3.length > 0) ||
      (dialog.movementType === 'entrada' &&
        entradaStep === 3 &&
        ammoOptionsForEntradaStep3.length > 0)
    if (!shouldFocusSelect) return
    const t = requestAnimationFrame(() => {
      selectRef.current?.focus()
    })
    return () => cancelAnimationFrame(t)
  }, [
    dialog,
    entradaStep,
    ammoOptionsForEntradaStep3.length,
    saidaStep,
    ammoOptionsForSaidaStep3.length,
  ])

  function openMovementDialog(movementType) {
    setQtyInput('')
    setSaidaLines([])
    setSaidaStep(1)
    setSaidaProductType('')
    setSaidaCaliber('')
    setEntradaStep(1)
    setEntradaProductType('')
    setEntradaCaliber('')
    setEntradaLines([])
    setEntradaNfNumber('')
    setMessage({ type: '', text: '' })
    setSelectedAmmoId((prev) => {
      if (prev && ammoOptions.some((o) => o.id === prev)) return prev
      return ammoOptions[0]?.id ?? ''
    })
    setDialog({ movementType })
  }

  function closeDialog() {
    setDialog(null)
    setQtyInput('')
    setSaidaLines([])
    setSaidaStep(1)
    setSaidaProductType('')
    setSaidaCaliber('')
    setEntradaStep(1)
    setEntradaProductType('')
    setEntradaCaliber('')
    setEntradaLines([])
    setEntradaNfNumber('')
  }

  function selectSaidaProductType(pt) {
    setMessage({ type: '', text: '' })
    setSaidaProductType(pt)
    setSaidaStep(2)
    setSaidaCaliber('')
    setQtyInput('')
  }

  function selectSaidaCaliber(caliberName) {
    setMessage({ type: '', text: '' })
    const options = ammoOptions.filter(
      (o) => o.product_type === saidaProductType && o.caliber === caliberName,
    )
    setSaidaCaliber(caliberName)
    setSaidaStep(3)
    setSelectedAmmoId(options[0]?.id ?? '')
    setQtyInput('')
  }

  function goSaidaBack() {
    setMessage({ type: '', text: '' })
    if (saidaStep === 3) {
      setSaidaStep(2)
      setSaidaCaliber('')
      setQtyInput('')
      return
    }
    if (saidaStep === 2) {
      setSaidaStep(1)
      setSaidaProductType('')
      setQtyInput('')
      return
    }
  }

  /** Volta ao passo 1 (tipo) para incluir outro produto na mesma saída, mantendo a lista. */
  function beginSaidaAnotherProduct() {
    if (!dialog || dialog.movementType !== 'saida') return
    setMessage({ type: '', text: '' })
    setSaidaStep(1)
    setSaidaProductType('')
    setSaidaCaliber('')
    setQtyInput('')
    setSelectedAmmoId(ammoOptions[0]?.id ?? '')
  }

  function selectEntradaProductType(pt) {
    setMessage({ type: '', text: '' })
    setEntradaProductType(pt)
    setEntradaStep(2)
    setEntradaCaliber('')
    setQtyInput('')
  }

  function selectEntradaCaliber(caliberName) {
    setMessage({ type: '', text: '' })
    const options = ammoOptions.filter(
      (o) =>
        o.product_type === entradaProductType && o.caliber === caliberName,
    )
    setEntradaCaliber(caliberName)
    setEntradaStep(3)
    setSelectedAmmoId(options[0]?.id ?? '')
    setQtyInput('')
  }

  function goEntradaBack() {
    setMessage({ type: '', text: '' })
    if (entradaStep === 3) {
      setEntradaStep(2)
      setEntradaCaliber('')
      setQtyInput('')
      return
    }
    if (entradaStep === 2) {
      setEntradaStep(1)
      setEntradaProductType('')
      setQtyInput('')
      return
    }
  }

  function addEntradaLine() {
    if (!dialog || dialog.movementType !== 'entrada') return
    if (!selectedAmmoId) {
      setMessage({ type: 'error', text: 'Selecione o modelo de munição.' })
      return
    }
    const quantity = parseQuantityInput(qtyInput)
    if (quantity === null) {
      setMessage({ type: 'error', text: 'Informe um número inteiro positivo.' })
      return
    }
    const opt = ammoOptions.find((o) => o.id === selectedAmmoId)
    const ammoName = opt?.ammo_name ?? '—'
    const caliber = opt?.caliber ?? '—'
    const productTypeLabelLine = productTypeLabel(
      opt?.product_type ?? 'municao',
    )
    const existingIdx = entradaLines.findIndex(
      (l) => l.ammoTypeId === selectedAmmoId,
    )
    const lancamentoAt = new Date().toISOString()
    setMessage({ type: '', text: '' })
    if (existingIdx >= 0) {
      setEntradaLines((prev) =>
        prev.map((l, i) =>
          i === existingIdx ? { ...l, quantity: l.quantity + quantity } : l,
        ),
      )
    } else {
      setEntradaLines((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          ammoTypeId: selectedAmmoId,
          ammoName,
          caliber,
          productTypeLabel: productTypeLabelLine,
          quantity,
          lancamentoAt,
        },
      ])
    }
    setQtyInput('')
  }

  function removeEntradaLine(lineId) {
    setEntradaLines((prev) => prev.filter((l) => l.id !== lineId))
  }

  function addSaidaLine() {
    if (!dialog || dialog.movementType !== 'saida') return
    if (!selectedAmmoId) {
      setMessage({ type: 'error', text: 'Selecione o modelo de munição.' })
      return
    }
    const quantity = parseQuantityInput(qtyInput)
    if (quantity === null) {
      setMessage({ type: 'error', text: 'Informe um número inteiro positivo.' })
      return
    }
    const opt = ammoOptions.find((o) => o.id === selectedAmmoId)
    const fullName = opt?.label ?? opt?.ammo_name ?? '—'
    const ammoName = opt?.ammo_name ?? '—'
    const caliber = opt?.caliber ?? '—'
    const productTypeLabelLine = productTypeLabel(
      opt?.product_type ?? 'municao',
    )
    const lancamentoAt = new Date().toISOString()
    const stockRow = rows.find((r) => r.ammo_type_id === selectedAmmoId)
    const current = stockRow?.stock ?? 0
    const existingIdx = saidaLines.findIndex(
      (l) => l.ammoTypeId === selectedAmmoId,
    )
    const prevQty = existingIdx >= 0 ? saidaLines[existingIdx].quantity : 0
    const totalQty = prevQty + quantity
    if (totalQty > current) {
      setMessage({
        type: 'error',
        text: `Saldo insuficiente para "${fullName}". Em estoque: ${current}.`,
      })
      return
    }
    setMessage({ type: '', text: '' })
    if (existingIdx >= 0) {
      setSaidaLines((prev) =>
        prev.map((l, i) =>
          i === existingIdx ? { ...l, quantity: totalQty } : l,
        ),
      )
    } else {
      setSaidaLines((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          ammoTypeId: selectedAmmoId,
          fullName,
          ammoName,
          caliber,
          productTypeLabel: productTypeLabelLine,
          quantity,
          lancamentoAt,
        },
      ])
    }
    setQtyInput('')
  }

  function removeSaidaLine(lineId) {
    setSaidaLines((prev) => prev.filter((l) => l.id !== lineId))
  }

  function validateSaidaLinesForSubmit() {
    if (!dialog || dialog.movementType !== 'saida') return false
    if (saidaLines.length === 0) {
      setMessage({
        type: 'error',
        text: 'Adicione pelo menos um tipo de munição à lista.',
      })
      return false
    }
    for (const line of saidaLines) {
      const stockRow = rows.find((r) => r.ammo_type_id === line.ammoTypeId)
      const current = stockRow?.stock ?? 0
      if (line.quantity > current) {
        setMessage({
          type: 'error',
          text: `Saldo insuficiente para "${line.fullName}". Em estoque: ${current}.`,
        })
        return false
      }
    }
    return true
  }

  /** Abre pré-visualização do termo; o registro no banco ocorre só após confirmar no modal. */
  function openSaidaTermoPreview() {
    if (!validateSaidaLinesForSubmit()) return
    setMessage({ type: '', text: '' })
    const pdfLines = saidaLines.map((l) => ({
      quantity: l.quantity,
      caliber: l.caliber,
      product: l.fullName,
    }))
    const { blob, filename } = getSaidaTermoPdfBlob(pdfLines)
    revokeSaidaTermoObjectUrl()
    const url = URL.createObjectURL(blob)
    saidaTermoPdfUrlRef.current = url
    setSaidaTermoFilename(filename)
    setSaidaTermoPdfUrl(url)
    setSaidaTermoPreviewOpen(true)
  }

  /** @returns {Promise<boolean>} true se gravou no banco; o modal chama finalize em seguida (sem impressão automática). */
  async function confirmSaidaAfterTermoPreview() {
    if (!dialog || dialog.movementType !== 'saida') return false
    if (!validateSaidaLinesForSubmit()) {
      closeSaidaTermoPreview()
      return false
    }

    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const saidaGroupId = crypto.randomUUID()
      for (const line of saidaLines) {
        await createAmmoMovement(line.ammoTypeId, 'saida', line.quantity, {
          saidaGroupId,
        })
      }
      await refreshAll()
      setMessage({
        type: 'success',
        text: 'Saída registrada no estoque.',
      })
      return true
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message ?? 'Erro ao registrar movimentação.',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  function finalizeSaidaAfterTermoConfirm() {
    closeSaidaTermoPreview()
    closeDialog()
  }

  function openReport() {
    const { from, to } = defaultReportDateRange()
    setReportFrom(from)
    setReportTo(to)
    setReportFilterProductType('')
    setReportCaliberId('')
    setReportData(null)
    setReportError('')
    setReportOpen(true)
  }

  function closeReport() {
    setReportOpen(false)
    setReportError('')
  }

  async function runStockReport(e) {
    e?.preventDefault()
    setReportError('')
    const startMs = parseLocalDateStart(reportFrom)
    const endMs = parseLocalDateEnd(reportTo)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      setReportError('Informe datas de início e fim válidas.')
      return
    }
    if (startMs > endMs) {
      setReportError('A data inicial não pode ser posterior à data final.')
      return
    }
    if (ammoOptions.length === 0) {
      setReportError('Cadastre tipos de munição para gerar o relatório.')
      return
    }

    setReportLoading(true)
    setReportData(null)
    try {
      const movements = await fetchAmmoMovementsForReport()
      const selectedCal = reportCaliberId
        ? calibers.find((c) => c.id === reportCaliberId)
        : null
      let productTypeFilter = null
      let caliberNameFilter = null
      if (selectedCal) {
        productTypeFilter = selectedCal.product_type
        caliberNameFilter = selectedCal.name
      } else if (reportFilterProductType) {
        productTypeFilter = reportFilterProductType
      }
      const result = computeStockReportHierarchy({
        movements,
        ammoOptions,
        currentStockRows: rows,
        periodStartMs: startMs,
        periodEndMs: endMs,
        productTypeFilter,
        caliberNameFilter,
      })
      setReportData(result)
    } catch (err) {
      setReportError(err.message ?? 'Erro ao montar o relatório.')
    } finally {
      setReportLoading(false)
    }
  }

  function exportStockReportPdf() {
    if (!reportData) return
    const selectedCal = reportCaliberId
      ? calibers.find((c) => c.id === reportCaliberId)
      : null
    let filterDesc = ''
    if (selectedCal) {
      filterDesc = `${productTypeLabel(selectedCal.product_type)} — ${selectedCal.name}`
    } else if (reportFilterProductType) {
      filterDesc = productTypeLabel(reportFilterProductType)
    }
    downloadStockReportHierarchyPdf({
      reportData,
      periodFrom: reportFrom,
      periodTo: reportTo,
      filterDescription: filterDesc,
    })
  }

  async function submitMovement(e) {
    e.preventDefault()
    if (!dialog || dialog.movementType !== 'entrada') return

    const nf = String(entradaNfNumber ?? '').trim()
    if (!nf) {
      setMessage({
        type: 'error',
        text: 'Informe o número da NF.',
      })
      return
    }

    if (entradaLines.length === 0) {
      setMessage({
        type: 'error',
        text: 'Adicione pelo menos um item à lista.',
      })
      return
    }

    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      for (const line of entradaLines) {
        await createAmmoMovement(line.ammoTypeId, 'entrada', line.quantity, {
          nfNumber: nf,
        })
      }
      setMessage({ type: 'success', text: 'Entrada registrada.' })
      closeDialog()
      await refreshAll()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message ?? 'Erro ao registrar movimentação.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stock-page">
      <header className="stock-page__header">
        <h1>Estoque de munições</h1>
        <p className="stock-page__subtitle">
          Estoque por tipo de produto, calibre e item; entradas e saídas
        </p>
      </header>

      {message.text ? (
        <div
          className={`stock-page__message stock-page__message--${message.type}`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      <SaidaTermoPreviewModal
        open={saidaTermoPreviewOpen}
        pdfUrl={saidaTermoPdfUrl}
        filename={saidaTermoFilename}
        onClose={closeSaidaTermoPreview}
        onConfirmRegister={confirmSaidaAfterTermoPreview}
        onFinalizeAfterSuccessfulRegister={finalizeSaidaAfterTermoConfirm}
        confirming={saving}
      />

      <StockReportModal
        open={reportOpen}
        onClose={closeReport}
        reportFrom={reportFrom}
        reportTo={reportTo}
        onReportFromChange={setReportFrom}
        onReportToChange={setReportTo}
        reportFilterProductType={reportFilterProductType}
        onReportFilterProductTypeChange={setReportFilterProductType}
        reportCaliberId={reportCaliberId}
        onReportCaliberIdChange={setReportCaliberId}
        reportCaliberOptions={reportCaliberOptions}
        calibers={calibers}
        reportLoading={reportLoading}
        onSubmitReport={runStockReport}
        reportError={reportError}
        reportData={reportData}
        onExportPdf={exportStockReportPdf}
      />


      <StockMovementModal
        dialog={dialog}
        closeDialog={closeDialog}
        entradaStep={entradaStep}
        entradaProductType={entradaProductType}
        entradaCaliber={entradaCaliber}
        entradaLines={entradaLines}
        entradaNfNumber={entradaNfNumber}
        setEntradaNfNumber={setEntradaNfNumber}
        selectEntradaProductType={selectEntradaProductType}
        selectEntradaCaliber={selectEntradaCaliber}
        goEntradaBack={goEntradaBack}
        addEntradaLine={addEntradaLine}
        removeEntradaLine={removeEntradaLine}
        submitMovement={submitMovement}
        loadingOptions={loadingOptions}
        tiposWithAmmo={tiposWithAmmo}
        entradaTiposOptions={PRODUCT_TYPE_KEYS}
        calibersForEntradaTipo={calibersForEntradaTipo}
        saving={saving}
        ammoOptionsForEntradaStep3={ammoOptionsForEntradaStep3}
        selectedAmmoId={selectedAmmoId}
        setSelectedAmmoId={setSelectedAmmoId}
        qtyInput={qtyInput}
        setQtyInput={setQtyInput}
        selectRef={selectRef}
        ammoOptions={ammoOptions}
        saidaStep={saidaStep}
        saidaProductType={saidaProductType}
        saidaCaliber={saidaCaliber}
        saidaLines={saidaLines}
        selectSaidaProductType={selectSaidaProductType}
        selectSaidaCaliber={selectSaidaCaliber}
        goSaidaBack={goSaidaBack}
        addSaidaLine={addSaidaLine}
        removeSaidaLine={removeSaidaLine}
        requestSaidaTermoPreview={openSaidaTermoPreview}
        calibersForSaidaTipo={calibersForSaidaTipo}
        ammoOptionsForSaidaStep3={ammoOptionsForSaidaStep3}
        beginSaidaAnotherProduct={beginSaidaAnotherProduct}
      />

      <div className="stock-page__toolbar">
        <button
          type="button"
          className="stock-page__action stock-page__action--entrada"
          onClick={() => openMovementDialog('entrada')}
          disabled={loadingOptions || ammoOptions.length === 0}
        >
          Dar entrada
        </button>
        <button
          type="button"
          className="stock-page__action stock-page__action--saida"
          onClick={() => openMovementDialog('saida')}
          disabled={loadingOptions || ammoOptions.length === 0}
        >
          Dar saída
        </button>
        <button
          type="button"
          className="stock-page__refresh"
          onClick={() => {
            void refreshAll().then(() => refreshLowStockBadge())
          }}
          disabled={loading || loadingOptions || loadingCalibers}
        >
          {loading || loadingOptions || loadingCalibers
            ? 'Carregando…'
            : 'Atualizar'}
        </button>
        <button
          type="button"
          className="stock-page__action stock-page__action--report"
          onClick={openReport}
          disabled={loadingCalibers}
        >
          Relatórios
        </button>
        <button
          type="button"
          className={
            lowStockCount > 0
              ? 'stock-page__alert stock-page__alert--active'
              : 'stock-page__alert'
          }
          onClick={() => void openLowStockAlert()}
          title="Estoque baixo"
          aria-label={
            lowStockCount > 0
              ? `Estoque baixo: ${lowStockCount} itens`
              : 'Estoque baixo'
          }
        >
          <svg
            className="stock-page__alert-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z"
            />
          </svg>
          {lowStockCount > 0 ? (
            <span className="stock-page__alert-badge">{lowStockCount}</span>
          ) : null}
        </button>
      </div>

      <LowStockAlertDialog
        open={lowStockOpen}
        titleId="stock-low-stock-title"
        items={lowStockItems}
        threshold={lowStockThreshold}
        loading={lowStockLoading}
        error={lowStockError}
        onDismiss={() => setLowStockOpen(false)}
      />

      <section
        className="stock-page__filters"
        aria-labelledby="stock-filters-heading"
      >
        <h2 id="stock-filters-heading" className="stock-page__filters-title">
          Filtros
        </h2>
        <div className="stock-page__filters-row">
          <label className="stock-page__filter-field">
            <span className="stock-page__filter-label">Tipo</span>
            <select
              value={filterProductType}
              onChange={(e) => {
                setFilterProductType(e.target.value)
                setFilterCaliberCompound('')
              }}
              disabled={loadingCalibers || hierarchySections.length === 0}
            >
              <option value="">Todos os tipos</option>
              {PRODUCT_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {productTypeLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-page__filter-field stock-page__filter-field--grow">
            <span className="stock-page__filter-label">Calibre</span>
            <select
              value={filterCaliberCompound}
              onChange={(e) => setFilterCaliberCompound(e.target.value)}
              disabled={
                loadingCalibers || caliberFilterOptions.length === 0
              }
            >
              <option value="">Todos os calibres</option>
              {caliberFilterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-page__filter-field stock-page__filter-field--grow">
            <span className="stock-page__filter-label">
              Pesquisar por nome do produto
            </span>
            <input
              type="search"
              value={typeSearch}
              onChange={(e) => setTypeSearch(e.target.value)}
              placeholder="Ex.: FMJ, Hollow"
              autoComplete="off"
              disabled={loading && rows.length === 0}
              enterKeyHint="search"
            />
          </label>
          {(filterProductType ||
            filterCaliberCompound ||
            typeSearch.trim()) ? (
            <button
              type="button"
              className="stock-page__filters-clear"
              onClick={() => {
                setFilterProductType('')
                setFilterCaliberCompound('')
                setTypeSearch('')
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </section>

      <section
        className="stock-page__inventory"
        aria-labelledby="stock-inventory-heading"
      >
        <h2 id="stock-inventory-heading">
          Estoque por tipo, calibre e produto
        </h2>

        {loadingCalibers ? (
          <p className="stock-inventory__hint">Carregando calibres…</p>
        ) : loading && rows.length === 0 ? (
          <p className="stock-inventory__hint">Carregando estoque…</p>
        ) : hierarchySections.length === 0 ? (
          <p className="stock-inventory__empty">
            Cadastre tipo, calibre e produto para ver a listagem.
          </p>
        ) : filteredHierarchy.length === 0 ? (
          <p className="stock-inventory__empty">
            Nenhum resultado para os filtros selecionados. Ajuste tipo, calibre
            ou a pesquisa pelo nome do produto.
          </p>
        ) : (
          <div className="stock-inventory__blocks stock-inventory__blocks--hierarchy">
            {filteredHierarchy.map((typeBlock) => (
              <div
                key={typeBlock.typeKey}
                className="stock-product-type-block"
              >
                <h3 className="stock-product-type-block__title">
                  {typeBlock.typeLabel}
                </h3>
                <div className="stock-product-type-block__calibers">
                  {typeBlock.caliberSections.map(
                    ({ key, title, rows: sectionRows }) => (
                      <div key={key} className="stock-caliber-block">
                        <h4 className="stock-caliber-block__title stock-caliber-block__title--nested">
                          {title}
                        </h4>
                        <div className="stock-page__table-wrap stock-page__table-wrap--nested">
                          <table className="stock-per-caliber-table">
                            <thead>
                              <tr>
                                <th>Produto</th>
                                <th>Quantidade em estoque</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectionRows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={2}
                                    className="stock-per-caliber-table__empty"
                                  >
                                    Nenhum produto neste calibre.
                                  </td>
                                </tr>
                              ) : (
                                sectionRows.map((row) => (
                                  <tr key={row.ammo_type_id}>
                                    <td>{row.ammo_name}</td>
                                    <td>{row.stock}</td>
                                  </tr>
                                ))
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
