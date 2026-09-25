import { buildTermoEntregaNoteLine } from './weaponEntregaHelpers.js'

/** Valor usado no cadastro para “em estoque da loja” (botão na UI). */
export const SHOP_STOCK_OWNER = 'estoque'

/**
 * Dono = estoque da loja (mesmo critério do botão “Em estoque da loja”).
 */
export function isShopStockOwner(owner) {
  const t = (owner ?? '').trim().toLowerCase()
  return t === SHOP_STOCK_OWNER
}

/**
 * Retirada no mês civil atual (fuso local), para lista principal.
 */
export function isTimestampInCurrentMonthLocal(ms) {
  if (!Number.isFinite(ms)) return false
  const d = new Date(ms)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
}

/**
 * Extrai S/N gravado em `notes` no formato `S/N: …`.
 */
export function parseWeaponSerialFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return '—'
  const m = notes.match(/(?:^|\n)\s*S\/N:\s*([^\n]+)/i)
  return m ? m[1].trim() : '—'
}

/**
 * Atualiza ou remove a linha `S/N:` em `notes`, preservando retirada e termo.
 */
export function setWeaponSerialInNotes(notes, serial) {
  const sn = (serial ?? '').trim()
  const lines = String(notes ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\s*S\/N:/i.test(l))
  if (sn) lines.unshift(`S/N: ${sn}`)
  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Extrai responsável da linha de retirada em `notes`.
 */
export function parseCheckoutResponsibleFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return '—'
  const lines = notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(/Retirada\s*—\s*responsável:\s*(.+?)\s*\(/i)
    if (m) return m[1].trim()
  }
  return '—'
}

/**
 * Data/hora da retirada (ISO entre parênteses na linha `Retirada`).
 */
export function parseRetiradaTimestampMs(notes) {
  if (!notes || typeof notes !== 'string') return NaN
  const lines = notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].toLowerCase().includes('retirada')) continue
    const m = lines[i].match(/\(([^)]+)\)\s*$/)
    if (m) {
      const t = new Date(m[1].trim()).getTime()
      if (Number.isFinite(t)) return t
    }
  }
  return NaN
}

function getWeaponCreatedMs(w) {
  if (!w?.created_at) return NaN
  const t = new Date(w.created_at).getTime()
  return Number.isFinite(t) ? t : NaN
}

/**
 * Data da retirada: linha em `notes` ou, em último caso, `updated_at`.
 */
export function getWeaponWithdrawalMs(w) {
  const fromNotes = parseRetiradaTimestampMs(w.notes)
  if (Number.isFinite(fromNotes)) return fromNotes
  if (w.updated_at) {
    const t = new Date(w.updated_at).getTime()
    if (Number.isFinite(t)) return t
  }
  return NaN
}

/** Data local de hoje no formato `YYYY-MM-DD` (input type="date"). */
export function todayLocalDateInput() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Converte `YYYY-MM-DD` (fuso local) em ISO para gravar em `notes`.
 * Usa meio-dia local para evitar mudança de dia em UTC.
 */
export function withdrawalIsoFromDateInput(dateStr) {
  const raw = (dateStr ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Informe uma data de retirada válida.')
  }
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    throw new Error('Informe uma data de retirada válida.')
  }
  return dt.toISOString()
}

/** Linha de retirada em `notes` (responsável e data entre parênteses). */
export function buildWithdrawalNoteLine(responsible, iso) {
  const trimmed = (responsible ?? '').trim()
  return trimmed
    ? `Retirada — responsável: ${trimmed} (${iso})`
    : `Retirada (${iso})`
}

function isRetiradaNoteLine(line) {
  const t = (line ?? '').trim()
  return /^Retirada(\s*—|\s*\()/i.test(t)
}

function isTermoEntregaNoteLine(line) {
  return /^Termo entrega\s*—/i.test((line ?? '').trim())
}

/**
 * Reescreve linhas de retirada/termo em `notes`, preservando S/N e demais linhas.
 * @param {string | null | undefined} prevNotes
 * @param {{ responsible?: string, withdrawnAtIso: string, termoEntrega?: { rg: string, cpf: string, sigmaSinarm: string } }} delivery
 */
export function rebuildWeaponNotesWithDelivery(prevNotes, delivery) {
  const lines = (prevNotes ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const kept = lines.filter((l) => !isRetiradaNoteLine(l) && !isTermoEntregaNoteLine(l))
  kept.push(buildWithdrawalNoteLine(delivery.responsible, delivery.withdrawnAtIso))
  if (delivery.termoEntrega) {
    kept.push(buildTermoEntregaNoteLine(delivery.termoEntrega))
  }
  return kept.join('\n')
}

/** `YYYY-MM-DD` local a partir do timestamp da retirada. */
export function withdrawalDateInputFromMs(ms) {
  if (!Number.isFinite(ms)) return todayLocalDateInput()
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Intervalo padrão do relatório: dia 1 do mês local até hoje. */
export function defaultWeaponsReportDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: iso(start), to: iso(now) }
}

/**
 * @param {Array<object>} weapons
 * @param {Record<string, string>} caliberNameById
 * @param {Record<string, string>} typeNameById
 * @param {Record<string, string>} brandNameById
 */
export function buildWeaponReportRows(
  weapons,
  caliberNameById,
  typeNameById,
  brandNameById,
) {
  return weapons
    .map((w) => ({
      id: w.id,
      status: w.status,
      model: w.name ?? '—',
      brand: brandNameById[w.brand_id] ?? '—',
      type: typeNameById[w.weapon_type_id] ?? '—',
      caliber: caliberNameById[w.caliber_id] ?? '—',
      serial: parseWeaponSerialFromNotes(w.notes),
      owner: (w.owner ?? '').trim() || '—',
      responsible: parseCheckoutResponsibleFromNotes(w.notes),
      createdAtMs: getWeaponCreatedMs(w),
      withdrawalMs: getWeaponWithdrawalMs(w),
    }))
    .sort((a, b) =>
      a.model.localeCompare(b.model, 'pt-BR', { sensitivity: 'base' }),
    )
}
