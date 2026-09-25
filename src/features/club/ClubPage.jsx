import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createClubCaliber,
  createClubItem,
  createClubStockMovement,
  clearClubItemMovements,
  deleteClubCaliber,
  deleteClubItem,
  deleteClubProductionBatch,
  deleteClubRecipe,
  deleteClubStockMovement,
  fetchClubCalibers,
  fetchClubItems,
  fetchClubProductionBatches,
  fetchClubRecipe,
  fetchClubRecipes,
  fetchClubReportSummary,
  fetchClubStock,
  fetchClubStockMovements,
  postClubProduction,
  saveClubRecipe,
  setClubItemBalance,
  updateClubCaliber,
  updateClubItem,
  updateClubProductionBatch,
  updateClubStockMovement,
} from '../../services/clubService.js'
import { isDesktopLocalApi } from '../../services/dataMode.js'
import { downloadClubReportPdf } from './clubReportPdf.js'
import {
  formatGramsHint,
  formatGrainsStock,
  gramsToGrains,
  parsePowderQty,
  powderDisplayFromGrains,
  powderQtyToGrains,
} from './powderUnits.js'
import './ClubPage.css'

const KIND_LABEL = {
  polvora: 'Pólvora',
  espoleta: 'Espoleta',
  ponta: 'Ponta',
  municao: 'Munição pronta',
}

function isoToDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function datetimeLocalToIso(s) {
  const t = String(s || '').trim()
  if (!t) return new Date().toISOString()
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export default function ClubPage() {
  const desktop = isDesktopLocalApi()

  const [calibers, setCalibers] = useState([])
  const [items, setItems] = useState([])
  const [stock, setStock] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [caliberName, setCaliberName] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemKind, setItemKind] = useState('polvora')

  const [movItemId, setMovItemId] = useState('')
  const [movQty, setMovQty] = useState('')
  const [movType, setMovType] = useState('entrada')
  const [movPolvoraUnit, setMovPolvoraUnit] = useState('grams')

  const [recipeCaliberId, setRecipeCaliberId] = useState('')
  const [recipePolvoraId, setRecipePolvoraId] = useState('')
  const [recipeEspId, setRecipeEspId] = useState('')
  const [recipePontaId, setRecipePontaId] = useState('')
  const [recipeMunicaoOutId, setRecipeMunicaoOutId] = useState('')
  const [recipePolvoraInput, setRecipePolvoraInput] = useState('')
  const [recipePolvoraUnit, setRecipePolvoraUnit] = useState('grams')
  const recipePolvoraUnitRef = useRef(recipePolvoraUnit)
  recipePolvoraUnitRef.current = recipePolvoraUnit
  const [recipeEspPer, setRecipeEspPer] = useState('1')
  const [recipePontaPer, setRecipePontaPer] = useState('1')

  const [prodCaliberId, setProdCaliberId] = useState('')
  const [prodQty, setProdQty] = useState('')
  const [prodNotes, setProdNotes] = useState('')

  const [editItem, setEditItem] = useState(null)
  const [editItemSaving, setEditItemSaving] = useState(false)
  const [adjustBalance, setAdjustBalance] = useState(null)
  const [adjustBalanceSaving, setAdjustBalanceSaving] = useState(false)
  const [editCaliber, setEditCaliber] = useState(null)
  const [editCaliberSaving, setEditCaliberSaving] = useState(false)
  const [editBatch, setEditBatch] = useState(null)
  const [editBatchSaving, setEditBatchSaving] = useState(false)
  const [deletingBatchId, setDeletingBatchId] = useState(null)
  const [clearingItemId, setClearingItemId] = useState(null)
  const [zeroingItemId, setZeroingItemId] = useState(null)
  const [deletingCaliberId, setDeletingCaliberId] = useState(null)
  const [recipeDeleting, setRecipeDeleting] = useState(false)
  const [recipeRowExists, setRecipeRowExists] = useState(false)
  const [recipeList, setRecipeList] = useState([])
  const [recipeListLoading, setRecipeListLoading] = useState(false)

  const [movements, setMovements] = useState([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [editMov, setEditMov] = useState(null)
  const [editMovSaving, setEditMovSaving] = useState(false)
  const [deletingMovId, setDeletingMovId] = useState(null)

  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  const msgRef = useRef(null)
  const recipeInlineRef = useRef(null)
  const recipeSectionRef = useRef(null)
  const [recipeInline, setRecipeInline] = useState(null)
  const [recipeSaving, setRecipeSaving] = useState(false)

  const [clubNav, setClubNav] = useState('producao')

  const showMessage = useCallback((type, text) => {
    setMsg({ type, text })
  }, [])

  useEffect(() => {
    if (!msg.text) return
    msgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [msg.text])

  useEffect(() => {
    if (!recipeInline) return
    recipeInlineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [recipeInline])

  const loadAll = useCallback(async () => {
    if (!desktop) return
    setLoading(true)
    try {
      const [c, it, st, b] = await Promise.all([
        fetchClubCalibers(),
        fetchClubItems(),
        fetchClubStock(),
        fetchClubProductionBatches(40),
      ])
      setCalibers(c)
      setItems(it)
      setStock(st)
      setBatches(b)
      setProdCaliberId((prev) => prev || (c[0]?.id ?? ''))
      setRecipeCaliberId((prev) => prev || (c[0]?.id ?? ''))
      setMovItemId((prev) => prev || (it[0]?.id ?? ''))
    } catch (e) {
      showMessage('err', e.message ?? 'Erro ao carregar dados do clube.')
    } finally {
      setLoading(false)
    }
  }, [desktop, showMessage])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const loadReport = useCallback(async () => {
    if (!desktop) return
    setReportLoading(true)
    try {
      const data = await fetchClubReportSummary(
        reportFrom.trim() || undefined,
        reportTo.trim() || undefined,
      )
      setReportData(data)
    } catch (e) {
      showMessage('err', e.message ?? 'Erro ao carregar relatório.')
      setReportData(null)
    } finally {
      setReportLoading(false)
    }
  }, [desktop, reportFrom, reportTo, showMessage])

  const polvoraItems = useMemo(
    () => items.filter((i) => i.kind === 'polvora'),
    [items],
  )
  const espoletaItems = useMemo(
    () => items.filter((i) => i.kind === 'espoleta'),
    [items],
  )
  const pontaItems = useMemo(() => items.filter((i) => i.kind === 'ponta'), [items])
  const municaoItems = useMemo(
    () => items.filter((i) => i.kind === 'municao'),
    [items],
  )

  const movItemKind = useMemo(
    () => items.find((i) => i.id === movItemId)?.kind,
    [items, movItemId],
  )

  function changeRecipePolvoraUnit(next) {
    if (next === recipePolvoraUnit) return
    const n = parsePowderQty(recipePolvoraInput)
    if (Number.isFinite(n) && n > 0) {
      const grains = recipePolvoraUnit === 'grams' ? gramsToGrains(n) : n
      setRecipePolvoraInput(powderDisplayFromGrains(grains, next))
    }
    setRecipePolvoraUnit(next)
  }

  function setAdjustBalancePolvoraUnit(nextUnit) {
    setAdjustBalance((p) => {
      if (!p || p.kind !== 'polvora') return p
      const prev = p.polvoraUnit ?? 'grams'
      if (nextUnit === prev) return p
      const n = parsePowderQty(p.input)
      let input = p.input
      if (Number.isFinite(n) && n > 0) {
        const grains = prev === 'grams' ? gramsToGrains(n) : n
        input = powderDisplayFromGrains(grains, nextUnit)
      }
      return { ...p, polvoraUnit: nextUnit, input }
    })
  }

  useEffect(() => {
    if (!desktop || !recipeCaliberId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetchClubRecipe(recipeCaliberId)
        if (cancelled) return
        if (!r) {
          setRecipeRowExists(false)
          setRecipePolvoraId('')
          setRecipeEspId('')
          setRecipePontaId('')
          setRecipeMunicaoOutId('')
          setRecipePolvoraInput('')
          setRecipeEspPer('1')
          setRecipePontaPer('1')
          return
        }
        setRecipeRowExists(true)
        setRecipePolvoraId(r.polvora_item_id ?? '')
        setRecipeEspId(r.espoleta_item_id ?? '')
        setRecipePontaId(r.ponta_item_id ?? '')
        setRecipeMunicaoOutId(r.municao_output_item_id ?? '')
        const g = r.grains_polvora_por_municao
        setRecipePolvoraInput(
          g != null && g !== '' && Number.isFinite(Number(g)) && Number(g) > 0
            ? powderDisplayFromGrains(Number(g), recipePolvoraUnitRef.current)
            : '',
        )
        setRecipeEspPer(String(r.espoletas_por_municao ?? 1))
        setRecipePontaPer(String(r.pontas_por_municao ?? 1))
      } catch {
        if (cancelled) return
        setRecipeRowExists(false)
        setRecipePolvoraId('')
        setRecipeEspId('')
        setRecipePontaId('')
        setRecipeMunicaoOutId('')
        setRecipePolvoraInput('')
        setRecipeEspPer('1')
        setRecipePontaPer('1')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [desktop, recipeCaliberId])

  useEffect(() => {
    if (!desktop || clubNav !== 'movimentos') return
    let cancelled = false
    setMovementsLoading(true)
    fetchClubStockMovements(250)
      .then((rows) => {
        if (!cancelled) setMovements(Array.isArray(rows) ? rows : [])
      })
      .catch((e) => {
        if (!cancelled) {
          showMessage('err', e.message ?? 'Erro ao carregar movimentações.')
          setMovements([])
        }
      })
      .finally(() => {
        if (!cancelled) setMovementsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [desktop, clubNav, showMessage])

  const reloadRecipeList = useCallback(async () => {
    if (!desktop) return
    try {
      const rows = await fetchClubRecipes()
      setRecipeList(Array.isArray(rows) ? rows : [])
    } catch {
      setRecipeList([])
    }
  }, [desktop])

  useEffect(() => {
    if (!desktop || clubNav !== 'producao') return
    let cancelled = false
    setRecipeListLoading(true)
    fetchClubRecipes()
      .then((rows) => {
        if (!cancelled) setRecipeList(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setRecipeList([])
      })
      .finally(() => {
        if (!cancelled) setRecipeListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [desktop, clubNav])

  function focusRecipeForm(caliberId) {
    setRecipeCaliberId(caliberId)
    setRecipeInline(null)
    requestAnimationFrame(() => {
      recipeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function handleCreateCaliber(e) {
    e.preventDefault()
    try {
      await createClubCaliber(caliberName)
      setCaliberName('')
      showMessage('ok', 'Calibre do clube cadastrado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao cadastrar calibre.')
    }
  }

  async function handleCreateItem(e) {
    e.preventDefault()
    try {
      await createClubItem(itemName, itemKind)
      setItemName('')
      showMessage('ok', 'Item cadastrado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao cadastrar item.')
    }
  }

  function openEditItem(row) {
    setEditItem({ id: row.id, name: row.name, kind: row.kind })
  }

  function openAdjustBalance(row) {
    const s = row.stock
    const isPowder = row.kind === 'polvora'
    const str =
      typeof s === 'number' && Number.isFinite(s)
        ? isPowder
          ? powderDisplayFromGrains(s, 'grams')
          : String(Math.round(s))
        : '0'
    setAdjustBalance({
      id: row.id,
      name: row.name,
      kind: row.kind,
      input: str,
      polvoraUnit: isPowder ? 'grams' : undefined,
    })
  }

  async function submitAdjustBalance(e) {
    e.preventDefault()
    if (!adjustBalance?.id) return
    const q =
      adjustBalance.kind === 'polvora'
        ? powderQtyToGrains(adjustBalance.input, adjustBalance.polvoraUnit ?? 'grams')
        : Number(String(adjustBalance.input).trim().replace(',', '.'))
    if (!Number.isFinite(q) || q < 0) {
      showMessage('err', 'Informe um saldo válido (≥ 0).')
      return
    }
    setAdjustBalanceSaving(true)
    try {
      await setClubItemBalance(adjustBalance.id, q)
      setAdjustBalance(null)
      showMessage('ok', 'Saldo atualizado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao ajustar saldo.')
    } finally {
      setAdjustBalanceSaving(false)
    }
  }

  async function handleDeleteClubItem(row) {
    const label = `${KIND_LABEL[row.kind] ?? row.kind} — ${row.name}`
    const ok = window.confirm(
      `Excluir o item «${label}»? Todo o histórico de movimentações deste item será apagado.`,
    )
    if (!ok) return
    try {
      await deleteClubItem(row.id)
      showMessage('ok', 'Item excluído.')
      await loadAll()
    } catch (err) {
      const text = err.message ?? 'Erro ao excluir item.'
      if (String(text).includes('está numa receita')) {
        showMessage(
          'err',
          `${text} Use "Zerar saldo" ou "Limpar movimentos" para manter o item sem estoque.`,
        )
      } else {
        showMessage('err', text)
      }
    }
  }

  async function handleZeroStock(row) {
    const label = `${KIND_LABEL[row.kind] ?? row.kind} — ${row.name}`
    const ok = window.confirm(`Zerar o saldo de «${label}»?`)
    if (!ok) return
    setZeroingItemId(row.id)
    try {
      await setClubItemBalance(row.id, 0)
      showMessage('ok', 'Saldo zerado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao zerar saldo.')
    } finally {
      setZeroingItemId(null)
    }
  }

  async function handleClearItemMovements(row) {
    const label = `${KIND_LABEL[row.kind] ?? row.kind} — ${row.name}`
    const ok = window.confirm(
      `Apagar todas as movimentações de «${label}»? O saldo ficará em zero.`,
    )
    if (!ok) return
    setClearingItemId(row.id)
    try {
      await clearClubItemMovements(row.id)
      showMessage('ok', 'Movimentações apagadas e saldo zerado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao limpar movimentações.')
    } finally {
      setClearingItemId(null)
    }
  }

  async function submitEditItem(e) {
    e.preventDefault()
    if (!editItem?.id || !editItem.name.trim()) {
      showMessage('err', 'Informe um nome.')
      return
    }
    setEditItemSaving(true)
    try {
      await updateClubItem(editItem.id, {
        name: editItem.name.trim(),
        kind: editItem.kind,
      })
      setEditItem(null)
      showMessage('ok', 'Item atualizado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao atualizar item.')
    } finally {
      setEditItemSaving(false)
    }
  }

  function openEditCaliber(c) {
    setEditCaliber({ id: c.id, name: c.name })
  }

  async function submitEditCaliber(e) {
    e.preventDefault()
    if (!editCaliber?.id || !editCaliber.name.trim()) {
      showMessage('err', 'Informe o nome do calibre.')
      return
    }
    setEditCaliberSaving(true)
    try {
      await updateClubCaliber(editCaliber.id, editCaliber.name.trim())
      setEditCaliber(null)
      showMessage('ok', 'Calibre atualizado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao atualizar calibre.')
    } finally {
      setEditCaliberSaving(false)
    }
  }

  async function handleMovement(e) {
    e.preventDefault()
    const item = items.find((i) => i.id === movItemId)
    const q =
      item?.kind === 'polvora'
        ? powderQtyToGrains(movQty, movPolvoraUnit)
        : Number(String(movQty).trim().replace(',', '.'))
    if (!movItemId || !Number.isFinite(q) || q <= 0) {
      showMessage('err', 'Informe item e quantidade válida.')
      return
    }
    try {
      await createClubStockMovement({
        item_id: movItemId,
        type: movType,
        quantity: q,
      })
      setMovQty('')
      showMessage('ok', 'Movimentação registrada.')
      await loadAll()
      void reloadMovementsList()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao lançar movimentação.')
    }
  }

  async function handleSaveRecipe(e) {
    e.preventDefault()
    setRecipeInline(null)
    const g = powderQtyToGrains(recipePolvoraInput, recipePolvoraUnit)
    if (!recipeCaliberId || !recipePolvoraId || !recipeEspId || !recipePontaId) {
      const t = 'Preencha calibre e os três insumos da receita.'
      showMessage('err', t)
      setRecipeInline({ type: 'err', text: t })
      return
    }
    if (!Number.isFinite(g) || g <= 0) {
      const t = 'Quantidade de pólvora por munição deve ser maior que zero.'
      showMessage('err', t)
      setRecipeInline({ type: 'err', text: t })
      return
    }
    setRecipeSaving(true)
    try {
      await saveClubRecipe(recipeCaliberId, {
        polvora_item_id: recipePolvoraId,
        espoleta_item_id: recipeEspId,
        ponta_item_id: recipePontaId,
        municao_output_item_id: recipeMunicaoOutId || null,
        grains_polvora_por_municao: g,
        espoletas_por_municao: Number(String(recipeEspPer).replace(',', '.')) || 1,
        pontas_por_municao: Number(String(recipePontaPer).replace(',', '.')) || 1,
      })
      const ok = 'Receita salva.'
      showMessage('ok', ok)
      setRecipeInline({ type: 'ok', text: ok })
      await loadAll()
      void reloadRecipeList()
    } catch (err) {
      const t = err.message ?? 'Erro ao salvar receita.'
      showMessage('err', t)
      setRecipeInline({ type: 'err', text: t })
    } finally {
      setRecipeSaving(false)
    }
  }

  async function handleProduction(e) {
    e.preventDefault()
    const n = Math.floor(Number(prodQty))
    if (!prodCaliberId || !Number.isFinite(n) || n <= 0) {
      showMessage('err', 'Selecione o calibre e a quantidade de munições.')
      return
    }
    try {
      const noteTrim = prodNotes.trim() || undefined
      const res = await postClubProduction({
        caliber_id: prodCaliberId,
        municoes_produzidas: n,
        ...(noteTrim ? { notes: noteTrim } : {}),
      })
      setProdQty('')
      setProdNotes('')
      const s = res?.saldos_apos
      const pg = s?.polvora
      const polvoraMsg =
        typeof pg === 'number' && Number.isFinite(pg)
          ? `${formatGrainsStock(pg)} gr (${formatGramsHint(pg)} g)`
          : String(pg ?? '—')
      showMessage(
        'ok',
        `Produção registrada. Saldos: pólvora ${polvoraMsg}, espoletas ${s?.espoleta}, pontas ${s?.ponta}.`,
      )
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao registrar produção.')
    }
  }

  function openEditBatch(batch) {
    const date = batch?.date ? String(batch.date).slice(0, 10) : ''
    setEditBatch({
      id: batch.id,
      municoes: String(Math.max(1, Math.floor(Number(batch.municoes_produzidas) || 0))),
      date,
      notes: batch.notes != null ? String(batch.notes) : '',
    })
  }

  async function submitEditBatch(e) {
    e.preventDefault()
    if (!editBatch?.id) return
    const n = Math.floor(Number(editBatch.municoes))
    if (!Number.isFinite(n) || n <= 0) {
      showMessage('err', 'Informe uma quantidade válida (inteiro maior que zero).')
      return
    }
    if (!editBatch.date) {
      showMessage('err', 'Informe a data do lançamento.')
      return
    }
    setEditBatchSaving(true)
    try {
      await updateClubProductionBatch(editBatch.id, {
        municoes_produzidas: n,
        date: `${editBatch.date}T12:00:00.000Z`,
        notes: editBatch.notes != null ? String(editBatch.notes).trim() || null : null,
      })
      setEditBatch(null)
      showMessage('ok', 'Lançamento atualizado.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao atualizar lançamento.')
    } finally {
      setEditBatchSaving(false)
    }
  }

  async function handleDeleteBatch(batch) {
    const caliberName =
      calibers.find((c) => c.id === batch.caliber_id)?.name ?? String(batch.caliber_id)
    const ok = window.confirm(
      `Excluir o lançamento de ${Math.round(batch.municoes_produzidas)} munições (${caliberName})? Esta ação remove o lote do histórico e os movimentos de estoque vinculados.`,
    )
    if (!ok) return
    setDeletingBatchId(batch.id)
    try {
      await deleteClubProductionBatch(batch.id)
      if (editBatch?.id === batch.id) setEditBatch(null)
      showMessage('ok', 'Lançamento excluído do histórico.')
      await loadAll()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao excluir lançamento.')
    } finally {
      setDeletingBatchId(null)
    }
  }

  async function reloadMovementsList() {
    try {
      const rows = await fetchClubStockMovements(250)
      setMovements(Array.isArray(rows) ? rows : [])
    } catch {
      /* ignore */
    }
  }

  async function handleDeleteCaliber(c) {
    const ok = window.confirm(
      `Excluir o calibre «${c.name}»? Só é permitido se não houver receita nem lotes de produção para ele.`,
    )
    if (!ok) return
    setDeletingCaliberId(c.id)
    try {
      await deleteClubCaliber(c.id)
      const nextCalibers = await fetchClubCalibers()
      if (recipeCaliberId === c.id) setRecipeCaliberId(nextCalibers[0]?.id ?? '')
      if (prodCaliberId === c.id) setProdCaliberId(nextCalibers[0]?.id ?? '')
      showMessage('ok', 'Calibre excluído.')
      await loadAll()
      void reloadRecipeList()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao excluir calibre.')
    } finally {
      setDeletingCaliberId(null)
    }
  }

  async function handleDeleteRecipe() {
    if (!recipeCaliberId) return
    const hasBatches = batches.some((b) => b.caliber_id === recipeCaliberId)
    if (hasBatches) {
      showMessage('err', 'Não é possível remover a receita: já existem lotes de produção para este calibre.')
      return
    }
    const ok = window.confirm(
      'Remover a receita deste calibre? Poderá voltar a definir insumos e quantidades ao guardar uma nova receita.',
    )
    if (!ok) return
    setRecipeDeleting(true)
    try {
      await deleteClubRecipe(recipeCaliberId)
      setRecipeRowExists(false)
      setRecipePolvoraId('')
      setRecipeEspId('')
      setRecipePontaId('')
      setRecipeMunicaoOutId('')
      setRecipePolvoraInput('')
      setRecipeEspPer('1')
      setRecipePontaPer('1')
      showMessage('ok', 'Receita removida.')
      setRecipeInline({ type: 'ok', text: 'Receita removida. Preencha e guarde para criar outra.' })
      await loadAll()
      void reloadRecipeList()
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao remover receita.')
    } finally {
      setRecipeDeleting(false)
    }
  }

  function openEditMovement(row) {
    const linked =
      row.production_batch_id != null && String(row.production_batch_id).trim() !== ''
    const kind = row.item_kind || 'espoleta'
    const qtyNum = Number(row.quantity)
    const qtyStr =
      kind === 'polvora' && Number.isFinite(qtyNum)
        ? powderDisplayFromGrains(qtyNum, 'grams')
        : String(Number.isFinite(qtyNum) ? Math.round(qtyNum) : row.quantity)
    setEditMov({
      id: row.id,
      linkedBatch: Boolean(linked),
      item_id: row.item_id,
      item_name: row.item_name ?? '',
      item_kind: kind,
      type: row.type === 'saida' ? 'saida' : 'entrada',
      quantityStr: qtyStr,
      polvoraUnit: 'grams',
      dateLocal: isoToDatetimeLocalValue(row.date),
      notes: row.notes != null ? String(row.notes) : '',
    })
  }

  async function submitEditMovement(e) {
    e.preventDefault()
    if (!editMov?.id) return
    setEditMovSaving(true)
    try {
      if (editMov.linkedBatch) {
        await updateClubStockMovement(editMov.id, {
          notes: editMov.notes.trim() || null,
        })
      } else {
        const item = items.find((i) => i.id === editMov.item_id)
        const qGrains =
          item?.kind === 'polvora'
            ? powderQtyToGrains(editMov.quantityStr, editMov.polvoraUnit ?? 'grams')
            : Number(String(editMov.quantityStr).trim().replace(',', '.'))
        if (!editMov.item_id || !Number.isFinite(qGrains) || qGrains <= 0) {
          showMessage('err', 'Informe item e quantidade válidos.')
          setEditMovSaving(false)
          return
        }
        await updateClubStockMovement(editMov.id, {
          item_id: editMov.item_id,
          type: editMov.type,
          quantity: qGrains,
          date: datetimeLocalToIso(editMov.dateLocal),
          notes: editMov.notes.trim() || null,
        })
      }
      setEditMov(null)
      showMessage('ok', 'Movimento atualizado.')
      await Promise.all([loadAll(), reloadMovementsList()])
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao atualizar movimento.')
    } finally {
      setEditMovSaving(false)
    }
  }

  async function handleDeleteMovement(row) {
    const linked =
      row.production_batch_id != null && String(row.production_batch_id).trim() !== ''
    if (linked) {
      showMessage(
        'err',
        'Este movimento pertence a um lote de produção: exclua ou edite o lote em «Últimos lotes».',
      )
      return
    }
    const label = `${KIND_LABEL[row.item_kind] ?? row.item_kind} — ${row.item_name ?? row.item_id}`
    const ok = window.confirm(`Excluir o movimento de «${label}»? O saldo do item será recalculado.`)
    if (!ok) return
    setDeletingMovId(row.id)
    try {
      await deleteClubStockMovement(row.id)
      showMessage('ok', 'Movimento excluído.')
      await Promise.all([loadAll(), reloadMovementsList()])
    } catch (err) {
      showMessage('err', err.message ?? 'Erro ao excluir movimento.')
    } finally {
      setDeletingMovId(null)
    }
  }

  if (!desktop) {
    return (
      <div className="club-page club-page--offline">
        <div className="club-page__banner club-page__banner--warn club-page__banner--sticky">
          O estoque do clube está disponível apenas no aplicativo desktop com servidor local
          ativo. A loja continua usando o cadastro e o estoque habituais (e Supabase, quando
          configurado); o clube usa outro ficheiro de base de dados no PC.
        </div>
      </div>
    )
  }

  return (
    <div className="club-page">
      <div className="club-page__top">
        <div className="club-page__msg-slot">
          {msg.text ? (
            <p
              ref={msgRef}
              className={`club-msg ${msg.type === 'ok' ? 'club-msg--ok' : 'club-msg--err'}`}
            >
              {msg.text}
            </p>
          ) : null}
        </div>

        <nav className="club-page__nav" aria-label="Secções do módulo clube">
          <ul className="club-page__nav-list">
            <li>
              <button
                type="button"
                className={
                  clubNav === 'producao'
                    ? 'club-page__nav-item club-page__nav-item--active'
                    : 'club-page__nav-item'
                }
                aria-current={clubNav === 'producao' ? 'page' : undefined}
                onClick={() => setClubNav('producao')}
              >
                Produção
              </button>
            </li>
            <li>
              <button
                type="button"
                className={
                  clubNav === 'estoque'
                    ? 'club-page__nav-item club-page__nav-item--active'
                    : 'club-page__nav-item'
                }
                aria-current={clubNav === 'estoque' ? 'page' : undefined}
                onClick={() => setClubNav('estoque')}
              >
                Estoque
              </button>
            </li>
            <li>
              <button
                type="button"
                className={
                  clubNav === 'entrada'
                    ? 'club-page__nav-item club-page__nav-item--active'
                    : 'club-page__nav-item'
                }
                aria-current={clubNav === 'entrada' ? 'page' : undefined}
                onClick={() => setClubNav('entrada')}
              >
                Entrada
              </button>
            </li>
            <li>
              <button
                type="button"
                className={
                  clubNav === 'movimentos'
                    ? 'club-page__nav-item club-page__nav-item--active'
                    : 'club-page__nav-item'
                }
                aria-current={clubNav === 'movimentos' ? 'page' : undefined}
                onClick={() => setClubNav('movimentos')}
              >
                Movimentos
              </button>
            </li>
            <li>
              <button
                type="button"
                className={
                  clubNav === 'cadastro'
                    ? 'club-page__nav-item club-page__nav-item--active'
                    : 'club-page__nav-item'
                }
                aria-current={clubNav === 'cadastro' ? 'page' : undefined}
                onClick={() => setClubNav('cadastro')}
              >
                Cadastro
              </button>
            </li>
            <li>
              <button
                type="button"
                className={
                  clubNav === 'relatorios'
                    ? 'club-page__nav-item club-page__nav-item--active'
                    : 'club-page__nav-item'
                }
                aria-current={clubNav === 'relatorios' ? 'page' : undefined}
                onClick={() => setClubNav('relatorios')}
              >
                Relatórios
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <div className="club-page__scroll">
        <div className="club-page__inner">
            {clubNav === 'cadastro' ? (
              <>
      <section className="club-section" aria-labelledby="club-h-calibres">
      <h2 id="club-h-calibres">Calibres (produção)</h2>
      <form className="club-grid club-grid--2" onSubmit={handleCreateCaliber}>
        <div className="club-field">
          <label htmlFor="club-caliber-name">Nome do calibre</label>
          <input
            id="club-caliber-name"
            value={caliberName}
            onChange={(e) => setCaliberName(e.target.value)}
            placeholder="Ex.: 9mm"
          />
        </div>
        <div className="club-actions" style={{ alignSelf: 'end' }}>
          <button type="submit" className="club-btn" disabled={!caliberName.trim()}>
            Cadastrar calibre
          </button>
        </div>
      </form>

      {!loading && calibers.length > 0 ? (
        <div className="club-table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="club-table">
            <thead>
              <tr>
                <th>Calibre</th>
                <th className="club-table__th-actions"> </th>
              </tr>
            </thead>
            <tbody>
              {calibers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <div className="club-table__actions">
                      <button
                        type="button"
                        className="club-btn club-btn--ghost"
                        onClick={() => openEditCaliber(c)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="club-btn club-btn--ghost club-btn--danger"
                        onClick={() => void handleDeleteCaliber(c)}
                        disabled={deletingCaliberId != null}
                      >
                        {deletingCaliberId === c.id ? 'A excluir…' : 'Excluir'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      </section>

      <section className="club-section" aria-labelledby="club-h-itens">
      <h2 id="club-h-itens">Itens de estoque (clube)</h2>
      <form className="club-grid club-grid--2" onSubmit={handleCreateItem}>
        <div className="club-field">
          <label htmlFor="club-item-name">Nome</label>
          <input
            id="club-item-name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Ex.: N320 lote A"
          />
        </div>
        <div className="club-field">
          <label htmlFor="club-item-kind">Tipo</label>
          <select
            id="club-item-kind"
            value={itemKind}
            onChange={(e) => setItemKind(e.target.value)}
          >
            <option value="polvora">Pólvora</option>
            <option value="espoleta">Espoleta</option>
            <option value="ponta">Ponta</option>
            <option value="municao">Munição pronta (saída da linha)</option>
          </select>
        </div>
        <div className="club-actions">
          <button type="submit" className="club-btn" disabled={!itemName.trim()}>
            Cadastrar item
          </button>
        </div>
      </form>
      </section>
              </>
            ) : null}
            {clubNav === 'estoque' ? (
      <section className="club-section" aria-labelledby="club-h-estoque">
      <h2 id="club-h-estoque">Estoque atual</h2>
      {loading ? (
        <p className="club-msg">A carregar…</p>
      ) : (
        <div className="club-table-wrap">
          <table className="club-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th>Saldo</th>
                <th className="club-table__th-actions"> </th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sem itens. Cadastre itens e lance entradas.</td>
                </tr>
              ) : (
                stock.map((row) => (
                  <tr key={row.id}>
                    <td>{KIND_LABEL[row.kind] ?? row.kind}</td>
                    <td>{row.name}</td>
                    <td>
                      {typeof row.stock === 'number'
                        ? row.kind === 'polvora'
                          ? (
                              <>
                                {formatGrainsStock(row.stock)} gr
                                <span className="club-stock__gram-hint">
                                  {' '}
                                  ({formatGramsHint(row.stock)} g)
                                </span>
                              </>
                            )
                          : Math.round(row.stock)
                        : row.stock}
                    </td>
                    <td>
                      <div className="club-table__actions">
                        <button
                          type="button"
                          className="club-btn club-btn--ghost"
                          onClick={() => openAdjustBalance(row)}
                          disabled={clearingItemId != null || zeroingItemId != null}
                        >
                          Ajustar saldo
                        </button>
                        <button
                          type="button"
                          className="club-btn club-btn--ghost"
                          onClick={() => void handleZeroStock(row)}
                          disabled={clearingItemId != null || zeroingItemId != null}
                        >
                          {zeroingItemId === row.id ? 'A zerar…' : 'Zerar saldo'}
                        </button>
                        <button
                          type="button"
                          className="club-btn club-btn--ghost club-btn--danger"
                          onClick={() => void handleClearItemMovements(row)}
                          disabled={clearingItemId != null || zeroingItemId != null}
                        >
                          {clearingItemId === row.id ? 'A limpar…' : 'Limpar movimentos'}
                        </button>
                        <button
                          type="button"
                          className="club-btn club-btn--ghost"
                          onClick={() => openEditItem(row)}
                          disabled={clearingItemId != null || zeroingItemId != null}
                        >
                          Editar dados
                        </button>
                        <button
                          type="button"
                          className="club-btn club-btn--ghost club-btn--danger"
                          onClick={() => handleDeleteClubItem(row)}
                          disabled={clearingItemId != null || zeroingItemId != null}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      </section>
            ) : null}
            {clubNav === 'relatorios' ? (
      <section className="club-section" aria-labelledby="club-h-relatorio">
      <h2 id="club-h-relatorio">Relatório (período)</h2>
      <p className="club-msg" style={{ opacity: 0.85 }}>
        Munições produzidas (lotes), saídas de insumo e movimentos de munição pronta no intervalo;
        saldos abaixo são o <strong>estoque atual</strong> (não o saldo no fim do período).
      </p>
      <div className="club-grid club-grid--2" style={{ marginBottom: '0.75rem' }}>
        <div className="club-field">
          <label htmlFor="club-report-from">De (opcional)</label>
          <input
            id="club-report-from"
            type="date"
            value={reportFrom}
            onChange={(e) => setReportFrom(e.target.value)}
          />
        </div>
        <div className="club-field">
          <label htmlFor="club-report-to">Até (opcional)</label>
          <input
            id="club-report-to"
            type="date"
            value={reportTo}
            onChange={(e) => setReportTo(e.target.value)}
          />
        </div>
      </div>
      <div className="club-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="club-btn" onClick={loadReport} disabled={reportLoading}>
          {reportLoading ? 'A carregar…' : 'Gerar relatório'}
        </button>
        <button
          type="button"
          className="club-btn club-btn--ghost"
          disabled={!reportData}
          onClick={() => {
            if (reportData) downloadClubReportPdf(reportData)
          }}
        >
          Exportar PDF
        </button>
      </div>
      {reportData ? (
        <>
          <h3 className="club-report__h3">Produção no período</h3>
          <p>
            Total:{' '}
            <strong>{Math.round(reportData.producao?.municoes_total ?? 0)}</strong> munições
            {reportData.period?.entire_history ? ' (histórico completo)' : null}
          </p>
          {(reportData.producao?.por_calibre ?? []).length > 0 ? (
            <div className="club-table-wrap">
              <table className="club-table">
                <thead>
                  <tr>
                    <th>Calibre</th>
                    <th>Munições</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.producao.por_calibre.map((r) => (
                    <tr key={r.caliber_id}>
                      <td>{r.caliber_name}</td>
                      <td>{Math.round(r.municoes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="club-msg">Nenhum lote no período.</p>
          )}

          <h3 className="club-report__h3">Saídas de insumo no período</h3>
          <p className="club-msg" style={{ opacity: 0.85 }}>
            &quot;Em produção&quot; = consumo automático dos lotes; &quot;Manual&quot; = saídas
            lançadas à mão (perdas, ajustes, etc.).
          </p>
          {(reportData.insumos_saidas_no_periodo ?? []).length > 0 ? (
            <div className="club-table-wrap">
              <table className="club-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Item</th>
                    <th>Total saída</th>
                    <th>Em produção</th>
                    <th>Manual</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.insumos_saidas_no_periodo.map((r) => (
                    <tr key={r.item_id}>
                      <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td>{r.name}</td>
                      <td>
                        {r.kind === 'polvora'
                          ? r.total_saida.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                          : Math.round(r.total_saida)}
                      </td>
                      <td>
                        {r.kind === 'polvora'
                          ? r.saida_em_producao.toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })
                          : Math.round(r.saida_em_producao)}
                      </td>
                      <td>
                        {r.kind === 'polvora'
                          ? r.saida_manual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                          : Math.round(r.saida_manual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="club-msg">Nenhuma saída de insumo no período.</p>
          )}

          <h3 className="club-report__h3">Munição pronta (movimentos no período)</h3>
          <ul className="club-report__list">
            <li>
              Entrada por produção:{' '}
              <strong>
                {Math.round(reportData.municao_no_periodo?.entrada_por_producao ?? 0)}
              </strong>
            </li>
            <li>
              Saída (distribuição / uso):{' '}
              <strong>
                {Math.round(reportData.municao_no_periodo?.saida_distribuicao ?? 0)}
              </strong>
            </li>
          </ul>

          <h3 className="club-report__h3">Estoque atual</h3>
          <div className="club-table-wrap">
            <table className="club-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nome</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.estoque_atual ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sem itens.</td>
                  </tr>
                ) : (
                  reportData.estoque_atual.map((row) => (
                    <tr key={row.id}>
                      <td>{KIND_LABEL[row.kind] ?? row.kind}</td>
                      <td>{row.name}</td>
                      <td>
                        {typeof row.stock === 'number'
                          ? row.kind === 'polvora'
                            ? (
                                <>
                                  {formatGrainsStock(row.stock)} gr
                                  <span className="club-stock__gram-hint">
                                    {' '}
                                    ({formatGramsHint(row.stock)} g)
                                  </span>
                                </>
                              )
                            : Math.round(row.stock)
                          : row.stock}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      </section>
            ) : null}
            {clubNav === 'entrada' ? (
      <section className="club-section" aria-labelledby="club-h-mov">
      <h2 id="club-h-mov">Entrada / ajuste de insumos</h2>
      <form onSubmit={handleMovement}>
        <div className="club-grid club-grid--2">
          <div className="club-field">
            <label htmlFor="club-mov-item">Item</label>
            <select
              id="club-mov-item"
              value={movItemId}
              onChange={(e) => setMovItemId(e.target.value)}
            >
              {items.length === 0 ? (
                <option value="">Cadastre itens em «Cadastro»</option>
              ) : (
                items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {KIND_LABEL[i.kind]} — {i.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="club-field">
            <label htmlFor="club-mov-type">Movimento</label>
            <select
              id="club-mov-type"
              value={movType}
              onChange={(e) => setMovType(e.target.value)}
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          {movItemKind === 'polvora' ? (
            <div className="club-field club-field--qty-unit">
              <label htmlFor="club-mov-qty">Quantidade de pólvora</label>
              <div className="club-qty-unit-row">
                <input
                  id="club-mov-qty"
                  value={movQty}
                  onChange={(e) => setMovQty(e.target.value)}
                  inputMode="decimal"
                />
                <select
                  id="club-mov-polvora-unit"
                  value={movPolvoraUnit}
                  onChange={(e) => setMovPolvoraUnit(e.target.value)}
                  aria-label="Unidade da pólvora"
                >
                  <option value="grams">Gramas</option>
                  <option value="grains">Grains</option>
                </select>
              </div>
              <p className="club-field__hint">
                O estoque continua em <strong>grains</strong>; 1 g = 15,432358 gr (conversão ao guardar).
              </p>
            </div>
          ) : (
            <div className="club-field">
              <label htmlFor="club-mov-qty">Quantidade (unidades)</label>
              <input
                id="club-mov-qty"
                value={movQty}
                onChange={(e) => setMovQty(e.target.value)}
                inputMode="decimal"
              />
            </div>
          )}
        </div>
        <div className="club-actions">
          <button type="submit" className="club-btn" disabled={!movItemId || !movQty.trim()}>
            Confirmar
          </button>
        </div>
      </form>
      </section>
            ) : null}
            {clubNav === 'movimentos' ? (
      <section className="club-section" aria-labelledby="club-h-movhist">
      <h2 id="club-h-movhist">Histórico de movimentações</h2>
      <p className="club-msg" style={{ opacity: 0.85 }}>
        Movimentos <strong>sem</strong> lote de produção podem ser editados ou excluídos. Nos
        movimentos gerados por um lote, só as <strong>notas</strong> são editáveis aqui (quantidade
        e data ajustam-se em «Últimos lotes»).
      </p>
      {movementsLoading ? (
        <p className="club-msg">A carregar…</p>
      ) : (
        <div className="club-table-wrap">
          <table className="club-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Item</th>
                <th>Tipo</th>
                <th>Mov.</th>
                <th>Qtd.</th>
                <th>Notas</th>
                <th>Lote</th>
                <th className="club-table__th-actions"> </th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8}>Sem movimentações registadas.</td>
                </tr>
              ) : (
                movements.map((row) => {
                  const linked =
                    row.production_batch_id != null &&
                    String(row.production_batch_id).trim() !== ''
                  const powder = row.item_kind === 'polvora'
                  return (
                    <tr key={row.id}>
                      <td>{row.date ? String(row.date).slice(0, 19).replace('T', ' ') : '—'}</td>
                      <td>
                        {KIND_LABEL[row.item_kind] ?? row.item_kind} — {row.item_name ?? '—'}
                      </td>
                      <td>{row.type === 'saida' ? 'Saída' : 'Entrada'}</td>
                      <td>#{row.id}</td>
                      <td>
                        {powder
                          ? (
                              <>
                                {formatGrainsStock(Number(row.quantity))} gr
                                <span className="club-stock__gram-hint">
                                  {' '}
                                  ({formatGramsHint(Number(row.quantity))} g)
                                </span>
                              </>
                            )
                          : Math.round(Number(row.quantity))}
                      </td>
                      <td className="club-table__cell-notes">
                        {row.notes ? String(row.notes) : '—'}
                      </td>
                      <td>{linked ? String(row.production_batch_id).slice(0, 8) + '…' : '—'}</td>
                      <td>
                        <div className="club-table__actions">
                          <button
                            type="button"
                            className="club-btn club-btn--ghost"
                            onClick={() => openEditMovement(row)}
                            disabled={deletingMovId != null}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="club-btn club-btn--ghost club-btn--danger"
                            onClick={() => void handleDeleteMovement(row)}
                            disabled={deletingMovId != null || linked}
                            title={
                              linked
                                ? 'Exclua ou edite o lote de produção correspondente.'
                                : undefined
                            }
                          >
                            {deletingMovId === row.id ? 'A excluir…' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      </section>
            ) : null}
            {clubNav === 'producao' ? (
              <>
      <section className="club-section club-section--primary" aria-labelledby="club-h-prod">
      <h2 id="club-h-prod">Produção (munições fabricadas)</h2>
      <form onSubmit={handleProduction}>
        <div className="club-grid club-grid--2">
          <div className="club-field">
            <label>Calibre</label>
            <select
              value={prodCaliberId}
              onChange={(e) => setProdCaliberId(e.target.value)}
            >
              {calibers.length === 0 ? (
                <option value="">Cadastre calibres</option>
              ) : (
                calibers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="club-field">
            <label>Quantidade de munições</label>
            <input
              value={prodQty}
              onChange={(e) => setProdQty(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="club-field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="club-prod-notes">Notas do lote (opcional)</label>
            <textarea
              id="club-prod-notes"
              rows={2}
              value={prodNotes}
              onChange={(e) => setProdNotes(e.target.value)}
              placeholder="Ex.: referência interna, turno…"
            />
          </div>
        </div>
        <div className="club-actions">
          <button type="submit" className="club-btn" disabled={!prodCaliberId || !prodQty.trim()}>
            Registrar produção e baixar insumos
          </button>
        </div>
      </form>
      </section>

      <section className="club-section" aria-labelledby="club-h-lotes">
      <h2 id="club-h-lotes">Últimos lotes</h2>
      <div className="club-table-wrap">
        <table className="club-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Calibre</th>
              <th>Munições</th>
              <th className="club-table__th-actions"> </th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={4}>Nenhum lote registado.</td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.date ? String(b.date).slice(0, 10) : '—'}</td>
                  <td>{calibers.find((c) => c.id === b.caliber_id)?.name ?? b.caliber_id}</td>
                  <td>{b.municoes_produzidas}</td>
                  <td>
                    <div className="club-table__actions">
                      <button
                        type="button"
                        className="club-btn club-btn--ghost"
                        onClick={() => openEditBatch(b)}
                        disabled={deletingBatchId != null}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="club-btn club-btn--ghost club-btn--danger"
                        onClick={() => void handleDeleteBatch(b)}
                        disabled={deletingBatchId != null}
                      >
                        {deletingBatchId === b.id ? 'A excluir…' : 'Excluir'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </section>

      <section className="club-section" aria-labelledby="club-h-receitas-lista">
      <h2 id="club-h-receitas-lista">Receitas cadastradas</h2>
      <p className="club-msg" style={{ opacity: 0.85 }}>
        Lista de todas as receitas guardadas. Use <strong>Editar</strong> para carregar o formulário
        abaixo com esse calibre e alterar matérias ou quantidades (pólvora, espoletas e pontas por
        munição).
      </p>
      {recipeListLoading ? (
        <p className="club-msg">A carregar receitas…</p>
      ) : recipeList.length === 0 ? (
        <p className="club-msg">Ainda não há receitas. Crie uma na secção seguinte.</p>
      ) : (
        <div className="club-table-wrap">
          <table className="club-table club-table--recipes">
            <thead>
              <tr>
                <th>Calibre</th>
                <th>Pólvora / munição</th>
                <th>Espoleta</th>
                <th>Ponta</th>
                <th>Munição pronta</th>
                <th className="club-table__th-actions"> </th>
              </tr>
            </thead>
            <tbody>
              {recipeList.map((r) => {
                const g = Number(r.grains_polvora_por_municao)
                const polTxt =
                  Number.isFinite(g) && g > 0 ? (
                    <>
                      {formatGrainsStock(g)} gr
                      <span className="club-stock__gram-hint">
                        {' '}
                        ({formatGramsHint(g)} g)
                      </span>
                    </>
                  ) : (
                    '—'
                  )
                return (
                  <tr key={r.caliber_id}>
                    <td>{r.caliber_name ?? r.caliber_id}</td>
                    <td>
                      <span className="club-recipe-list__item">{r.polvora_name ?? '—'}</span>
                      <br />
                      <span className="club-recipe-list__qty">{polTxt}</span>
                    </td>
                    <td>
                      <span className="club-recipe-list__item">{r.espoleta_name ?? '—'}</span>
                      <br />
                      <span className="club-recipe-list__qty">
                        ×{Number(r.espoletas_por_municao ?? 1)} / mun.
                      </span>
                    </td>
                    <td>
                      <span className="club-recipe-list__item">{r.ponta_name ?? '—'}</span>
                      <br />
                      <span className="club-recipe-list__qty">
                        ×{Number(r.pontas_por_municao ?? 1)} / mun.
                      </span>
                    </td>
                    <td>{r.municao_output_name ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="club-btn club-btn--ghost"
                        onClick={() => focusRecipeForm(r.caliber_id)}
                      >
                        Editar
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

      <section
        ref={recipeSectionRef}
        className="club-section"
        aria-labelledby="club-h-receita"
      >
      <h2 id="club-h-receita">Receita por calibre</h2>
      <p className="club-msg" style={{ opacity: 0.85 }}>
        Indique qual pólvora, espoleta e ponta entram em <strong>uma</strong> munição deste calibre.
        Opcionalmente, escolha um item &quot;Munição pronta&quot; para dar entrada automática no
        estoque quando registrar produção.
      </p>
      <p className="club-msg" style={{ opacity: 0.85 }}>
        {!recipeRowExists
          ? 'Ainda não há receita guardada para este calibre: preencha os campos e use «Guardar receita».'
          : 'Receita guardada. Novas produções usam estes valores; lotes antigos mantêm os movimentos já lançados.'}
      </p>
      <div className="club-actions" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="club-btn club-btn--ghost club-btn--danger"
          disabled={
            recipeDeleting ||
            !recipeRowExists ||
            batches.some((b) => b.caliber_id === recipeCaliberId)
          }
          title={
            batches.some((b) => b.caliber_id === recipeCaliberId)
              ? 'Existem lotes deste calibre: não é possível remover a receita pela API.'
              : undefined
          }
          onClick={() => void handleDeleteRecipe()}
        >
          {recipeDeleting ? 'A remover…' : 'Remover receita'}
        </button>
      </div>
      <form onSubmit={handleSaveRecipe} noValidate>
        <div className="club-grid club-grid--2">
          <div className="club-field">
            <label>Calibre</label>
            <select
              value={recipeCaliberId}
              onChange={(e) => setRecipeCaliberId(e.target.value)}
            >
              {calibers.length === 0 ? (
                <option value="">Cadastre calibres</option>
              ) : (
                calibers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="club-field">
            <label>Pólvora (item)</label>
            <select
              value={recipePolvoraId}
              onChange={(e) => setRecipePolvoraId(e.target.value)}
            >
              <option value="">—</option>
              {recipePolvoraId &&
              !polvoraItems.some((i) => i.id === recipePolvoraId) ? (
                <option value={recipePolvoraId}>
                  {items.find((x) => x.id === recipePolvoraId)?.name ?? 'Item'} (referência)
                </option>
              ) : null}
              {polvoraItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="club-field">
            <label>Espoleta</label>
            <select value={recipeEspId} onChange={(e) => setRecipeEspId(e.target.value)}>
              <option value="">—</option>
              {recipeEspId && !espoletaItems.some((i) => i.id === recipeEspId) ? (
                <option value={recipeEspId}>
                  {items.find((x) => x.id === recipeEspId)?.name ?? 'Item'} (referência)
                </option>
              ) : null}
              {espoletaItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="club-field">
            <label>Ponta</label>
            <select value={recipePontaId} onChange={(e) => setRecipePontaId(e.target.value)}>
              <option value="">—</option>
              {recipePontaId && !pontaItems.some((i) => i.id === recipePontaId) ? (
                <option value={recipePontaId}>
                  {items.find((x) => x.id === recipePontaId)?.name ?? 'Item'} (referência)
                </option>
              ) : null}
              {pontaItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="club-field">
            <label>Munição pronta (entrada opcional)</label>
            <select
              value={recipeMunicaoOutId}
              onChange={(e) => setRecipeMunicaoOutId(e.target.value)}
            >
              <option value="">— Não dar entrada automática</option>
              {recipeMunicaoOutId && !municaoItems.some((i) => i.id === recipeMunicaoOutId) ? (
                <option value={recipeMunicaoOutId}>
                  {items.find((x) => x.id === recipeMunicaoOutId)?.name ?? 'Item'} (referência)
                </option>
              ) : null}
              {municaoItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="club-field club-field--qty-unit">
            <label htmlFor="club-recipe-polvora-qty">Pólvora por munição</label>
            <div className="club-qty-unit-row">
              <input
                id="club-recipe-polvora-qty"
                value={recipePolvoraInput}
                onChange={(e) => setRecipePolvoraInput(e.target.value)}
                inputMode="decimal"
              />
              <select
                id="club-recipe-polvora-unit"
                value={recipePolvoraUnit}
                onChange={(e) => changeRecipePolvoraUnit(e.target.value)}
                aria-label="Unidade da pólvora na receita"
              >
                <option value="grams">Gramas</option>
                <option value="grains">Grains</option>
              </select>
            </div>
            <p className="club-field__hint">
              A receita é guardada em <strong>grains</strong> por munição; escolha gramas para lançar com
              a balança.
            </p>
          </div>
          <div className="club-field">
            <label>Espoletas por munição</label>
            <input
              value={recipeEspPer}
              onChange={(e) => setRecipeEspPer(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="club-field">
            <label>Pontas por munição</label>
            <input
              value={recipePontaPer}
              onChange={(e) => setRecipePontaPer(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>
        <div className="club-actions">
          <button type="submit" className="club-btn" disabled={recipeSaving}>
            {recipeSaving ? 'A guardar…' : 'Guardar receita'}
          </button>
        </div>
        {recipeInline ? (
          <p
            ref={recipeInlineRef}
            className={`club-msg club-recipe-inline ${
              recipeInline.type === 'ok' ? 'club-msg--ok' : 'club-msg--err'
            }`}
            role="alert"
          >
            {recipeInline.text}
          </p>
        ) : null}
      </form>
      </section>
              </>
            ) : null}
          </div>
        </div>

      {adjustBalance ? (
        <div
          className="club-dialog-backdrop"
          role="presentation"
          onMouseDown={() => !adjustBalanceSaving && setAdjustBalance(null)}
        >
          <div
            className="club-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-adjust-balance-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="club-adjust-balance-title" className="club-dialog__title">
              Ajustar saldo
            </h3>
            <p className="club-dialog__hint" style={{ marginTop: 0 }}>
              {KIND_LABEL[adjustBalance.kind] ?? adjustBalance.kind} — {adjustBalance.name}
            </p>
            <form className="club-dialog__form" onSubmit={submitAdjustBalance}>
              <label className="club-field">
                <span>
                  Novo saldo{' '}
                  {adjustBalance.kind === 'polvora'
                    ? adjustBalance.polvoraUnit === 'grams'
                      ? '(gramas)'
                      : '(grains)'
                    : '(unidades)'}
                </span>
                {adjustBalance.kind === 'polvora' ? (
                  <div className="club-qty-unit-row">
                    <input
                      value={adjustBalance.input}
                      onChange={(e) =>
                        setAdjustBalance((p) => (p ? { ...p, input: e.target.value } : p))
                      }
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={adjustBalanceSaving}
                    />
                    <select
                      value={adjustBalance.polvoraUnit ?? 'grams'}
                      onChange={(e) => setAdjustBalancePolvoraUnit(e.target.value)}
                      aria-label="Unidade do saldo de pólvora"
                      disabled={adjustBalanceSaving}
                    >
                      <option value="grams">Gramas</option>
                      <option value="grains">Grains</option>
                    </select>
                  </div>
                ) : (
                  <input
                    value={adjustBalance.input}
                    onChange={(e) =>
                      setAdjustBalance((p) => (p ? { ...p, input: e.target.value } : p))
                    }
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={adjustBalanceSaving}
                  />
                )}
              </label>
              {adjustBalance.kind === 'polvora' ? (
                <p className="club-dialog__hint" style={{ marginTop: '-0.25rem' }}>
                  O saldo gravado na base é sempre em grains (conversão automática).
                </p>
              ) : null}
              <p className="club-dialog__hint">
                É criado um lançamento de entrada ou saída para igualar ao valor indicado (nota:
                «Ajuste de saldo»).
              </p>
              <div className="club-dialog__actions">
                <button
                  type="button"
                  className="club-btn club-btn--ghost"
                  onClick={() => setAdjustBalance(null)}
                  disabled={adjustBalanceSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="club-btn" disabled={adjustBalanceSaving}>
                  {adjustBalanceSaving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editItem ? (
        <div
          className="club-dialog-backdrop"
          role="presentation"
          onMouseDown={() => !editItemSaving && setEditItem(null)}
        >
          <div
            className="club-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-edit-item-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="club-edit-item-title" className="club-dialog__title">
              Editar item
            </h3>
            <form className="club-dialog__form" onSubmit={submitEditItem}>
              <label className="club-field">
                <span>Nome</span>
                <input
                  value={editItem.name}
                  onChange={(e) => setEditItem((p) => (p ? { ...p, name: e.target.value } : p))}
                  autoComplete="off"
                  disabled={editItemSaving}
                />
              </label>
              <label className="club-field">
                <span>Tipo</span>
                <select
                  value={editItem.kind}
                  onChange={(e) => setEditItem((p) => (p ? { ...p, kind: e.target.value } : p))}
                  disabled={editItemSaving}
                >
                  <option value="polvora">Pólvora</option>
                  <option value="espoleta">Espoleta</option>
                  <option value="ponta">Ponta</option>
                  <option value="municao">Munição pronta</option>
                </select>
              </label>
              <p className="club-dialog__hint">
                Se o item estiver numa receita, só é possível alterar o nome (não o tipo).
              </p>
              <div className="club-dialog__actions">
                <button
                  type="button"
                  className="club-btn club-btn--ghost"
                  onClick={() => setEditItem(null)}
                  disabled={editItemSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="club-btn" disabled={editItemSaving}>
                  {editItemSaving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editCaliber ? (
        <div
          className="club-dialog-backdrop"
          role="presentation"
          onMouseDown={() => !editCaliberSaving && setEditCaliber(null)}
        >
          <div
            className="club-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-edit-caliber-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="club-edit-caliber-title" className="club-dialog__title">
              Editar calibre
            </h3>
            <form className="club-dialog__form" onSubmit={submitEditCaliber}>
              <label className="club-field">
                <span>Nome</span>
                <input
                  value={editCaliber.name}
                  onChange={(e) =>
                    setEditCaliber((p) => (p ? { ...p, name: e.target.value } : p))
                  }
                  autoComplete="off"
                  disabled={editCaliberSaving}
                />
              </label>
              <div className="club-dialog__actions">
                <button
                  type="button"
                  className="club-btn club-btn--ghost"
                  onClick={() => setEditCaliber(null)}
                  disabled={editCaliberSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="club-btn" disabled={editCaliberSaving}>
                  {editCaliberSaving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editBatch ? (
        <div
          className="club-dialog-backdrop"
          role="presentation"
          onMouseDown={() => !editBatchSaving && setEditBatch(null)}
        >
          <div
            className="club-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-edit-batch-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="club-edit-batch-title" className="club-dialog__title">
              Editar lançamento
            </h3>
            <form className="club-dialog__form" onSubmit={submitEditBatch}>
              <label className="club-field">
                <span>Quantidade de munições</span>
                <input
                  value={editBatch.municoes}
                  onChange={(e) =>
                    setEditBatch((p) => (p ? { ...p, municoes: e.target.value } : p))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={editBatchSaving}
                />
              </label>
              <label className="club-field">
                <span>Data do lançamento</span>
                <input
                  type="date"
                  value={editBatch.date}
                  onChange={(e) => setEditBatch((p) => (p ? { ...p, date: e.target.value } : p))}
                  disabled={editBatchSaving}
                />
              </label>
              <label className="club-field">
                <span>Notas do lote</span>
                <textarea
                  value={editBatch.notes ?? ''}
                  onChange={(e) =>
                    setEditBatch((p) => (p ? { ...p, notes: e.target.value } : p))
                  }
                  rows={2}
                  disabled={editBatchSaving}
                />
              </label>
              <p className="club-dialog__hint">
                Ao editar este lote, o sistema atualiza automaticamente os movimentos de estoque
                ligados a ele.
              </p>
              <div className="club-dialog__actions">
                <button
                  type="button"
                  className="club-btn club-btn--ghost"
                  onClick={() => setEditBatch(null)}
                  disabled={editBatchSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="club-btn" disabled={editBatchSaving}>
                  {editBatchSaving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editMov ? (
        <div
          className="club-dialog-backdrop"
          role="presentation"
          onMouseDown={() => !editMovSaving && setEditMov(null)}
        >
          <div
            className="club-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-edit-mov-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="club-edit-mov-title" className="club-dialog__title">
              {editMov.linkedBatch ? 'Editar notas do movimento' : 'Editar movimento'}
            </h3>
            <form className="club-dialog__form" onSubmit={submitEditMovement}>
              {editMov.linkedBatch ? (
                <p className="club-dialog__hint" style={{ marginTop: 0 }}>
                  {KIND_LABEL[editMov.item_kind] ?? editMov.item_kind} — {editMov.item_name} ·{' '}
                  {editMov.type === 'saida' ? 'Saída' : 'Entrada'} · #{editMov.id}
                  <br />
                  Quantidade e data deste movimento seguem o lote de produção.
                </p>
              ) : (
                <>
                  <label className="club-field">
                    <span>Item</span>
                    <select
                      value={editMov.item_id}
                      onChange={(e) => {
                        const id = e.target.value
                        const k = items.find((i) => i.id === id)?.kind ?? 'espoleta'
                        setEditMov((p) =>
                          p
                            ? {
                                ...p,
                                item_id: id,
                                item_kind: k,
                                polvoraUnit: 'grams',
                                quantityStr:
                                  k === 'polvora'
                                    ? ''
                                    : String(Math.max(1, Math.floor(Number(p.quantityStr)) || 1)),
                              }
                            : p,
                        )
                      }}
                      disabled={editMovSaving}
                    >
                      {editMov.item_id && !items.some((i) => i.id === editMov.item_id) ? (
                        <option value={editMov.item_id}>
                          {editMov.item_name || 'Item'} (referência)
                        </option>
                      ) : null}
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {KIND_LABEL[i.kind]} — {i.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="club-field">
                    <span>Movimento</span>
                    <select
                      value={editMov.type}
                      onChange={(e) =>
                        setEditMov((p) => (p ? { ...p, type: e.target.value } : p))
                      }
                      disabled={editMovSaving}
                    >
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </label>
                  {editMov.item_kind === 'polvora' ? (
                    <label className="club-field">
                      <span>Quantidade (pólvora)</span>
                      <div className="club-qty-unit-row">
                        <input
                          value={editMov.quantityStr}
                          onChange={(e) =>
                            setEditMov((p) => (p ? { ...p, quantityStr: e.target.value } : p))
                          }
                          inputMode="decimal"
                          disabled={editMovSaving}
                        />
                        <select
                          value={editMov.polvoraUnit ?? 'grams'}
                          onChange={(e) => {
                            const next = e.target.value
                            setEditMov((p) => {
                              if (!p || p.item_kind !== 'polvora') return p
                              const prev = p.polvoraUnit ?? 'grams'
                              if (next === prev) return p
                              const n = parsePowderQty(p.quantityStr)
                              let input = p.quantityStr
                              if (Number.isFinite(n) && n > 0) {
                                const grains = prev === 'grams' ? gramsToGrains(n) : n
                                input = powderDisplayFromGrains(grains, next)
                              }
                              return { ...p, polvoraUnit: next, quantityStr: input }
                            })
                          }}
                          aria-label="Unidade"
                          disabled={editMovSaving}
                        >
                          <option value="grams">Gramas</option>
                          <option value="grains">Grains</option>
                        </select>
                      </div>
                    </label>
                  ) : (
                    <label className="club-field">
                      <span>Quantidade (unidades)</span>
                      <input
                        value={editMov.quantityStr}
                        onChange={(e) =>
                          setEditMov((p) => (p ? { ...p, quantityStr: e.target.value } : p))
                        }
                        inputMode="decimal"
                        disabled={editMovSaving}
                      />
                    </label>
                  )}
                  <label className="club-field">
                    <span>Data e hora</span>
                    <input
                      type="datetime-local"
                      value={editMov.dateLocal}
                      onChange={(e) =>
                        setEditMov((p) => (p ? { ...p, dateLocal: e.target.value } : p))
                      }
                      disabled={editMovSaving}
                    />
                  </label>
                </>
              )}
              <label className="club-field">
                <span>Notas</span>
                <textarea
                  value={editMov.notes}
                  onChange={(e) => setEditMov((p) => (p ? { ...p, notes: e.target.value } : p))}
                  rows={2}
                  disabled={editMovSaving}
                />
              </label>
              <div className="club-dialog__actions">
                <button
                  type="button"
                  className="club-btn club-btn--ghost"
                  onClick={() => setEditMov(null)}
                  disabled={editMovSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="club-btn" disabled={editMovSaving}>
                  {editMovSaving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
