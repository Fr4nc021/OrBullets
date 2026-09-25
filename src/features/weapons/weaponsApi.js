import { supabase } from '../../services/supabase.js'
import { ORB_TABLES as T } from '../../services/orbTables.js'
import { isDesktopLocalApi } from '../../services/dataMode.js'
import * as apiWeapons from '../../services/repositories/apiWeaponsRepository.js'
import { fetchCalibers } from '../../services/produtosService.js'
import { buildTermoEntregaNoteLine } from './weaponEntregaHelpers.js'
import {
  buildNotesWithVenda,
  buildVendaNoteLines,
  validateWeaponVendaFields,
} from './weaponVendaHelpers.js'
import {
  buildWithdrawalNoteLine,
  rebuildWeaponNotesWithDelivery,
  setWeaponSerialInNotes,
  SHOP_STOCK_OWNER,
} from './weaponsReportHelpers.js'

export { fetchCalibers }

function formatSupabaseError(err) {
  if (!err) return 'Erro desconhecido.'
  const msg = err.message ?? String(err)
  const parts = [msg]
  if (err.details) parts.push(err.details)
  if (err.hint) parts.push(err.hint)
  return parts.filter(Boolean).join(' — ')
}

export async function fetchWeaponTypes() {
  if (isDesktopLocalApi()) return apiWeapons.fetchWeaponTypes()

  const { data, error } = await supabase
    .from(T.weapon_types)
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(formatSupabaseError(error))
  return data ?? []
}

export async function createWeaponType(name) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nome do tipo de arma é obrigatório.')

  if (isDesktopLocalApi()) return apiWeapons.createWeaponTypeRow(trimmed)

  const { data, error } = await supabase
    .from(T.weapon_types)
    .insert({ name: trimmed })
    .select('id, name')
    .single()

  if (error) throw new Error(formatSupabaseError(error))
  return data
}

export async function fetchWeaponBrands() {
  if (isDesktopLocalApi()) return apiWeapons.fetchWeaponBrands()

  const { data, error } = await supabase
    .from(T.weapon_brands)
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(formatSupabaseError(error))
  return data ?? []
}

export async function createWeaponBrand(name) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nome da marca é obrigatório.')

  if (isDesktopLocalApi()) return apiWeapons.createWeaponBrandRow(trimmed)

  const { data, error } = await supabase
    .from(T.weapon_brands)
    .insert({ name: trimmed })
    .select('id, name')
    .single()

  if (error) throw new Error(formatSupabaseError(error))
  return data
}

/**
 * Lista armas. Nomes de calibre, tipo e marca resolvem na UI com as listas de fetch.
 */
export async function fetchWeapons() {
  if (isDesktopLocalApi()) return apiWeapons.fetchWeaponsRows()

  const { data, error } = await supabase
    .from(T.weapons)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(formatSupabaseError(error))
  return data ?? []
}

/**
 * @param {{ name: string, weaponTypeId: string, brandId: string, caliberId: string, owner: string, serial?: string, weaponTypeName?: string }} input
 * status fixo em_estoque. Serial opcional: gravado em `notes` como `S/N: …` quando a coluna existir (execute supabase/sql/weapons_notes.sql).
 * `weaponTypeName`: nome do tipo (coluna legada `type` NOT NULL em algumas bases).
 */
export async function createWeapon({
  name,
  weaponTypeId,
  brandId,
  caliberId,
  owner,
  serial,
  weaponTypeName,
}) {
  const trimmedName = name.trim()
  const trimmedOwner = owner.trim()
  if (!trimmedName) throw new Error('Informe o modelo da arma.')
  if (!weaponTypeId) throw new Error('Selecione o tipo da arma.')
  if (!brandId) throw new Error('Selecione a marca.')
  if (!caliberId) throw new Error('Selecione um calibre.')
  if (!trimmedOwner) throw new Error('Informe o dono ou use "Em estoque da loja".')

  const legacyType = (weaponTypeName ?? '').trim() || '—'

  const row = {
    name: trimmedName,
    weapon_type_id: weaponTypeId,
    brand_id: brandId,
    caliber_id: caliberId,
    owner: trimmedOwner,
    status: 'em_estoque',
    type: legacyType,
  }
  const sn = serial?.trim()
  if (sn) row.notes = `S/N: ${sn}`

  if (isDesktopLocalApi()) return apiWeapons.createWeaponRow(row)

  let insertPayload = row
  let { data, error } = await supabase
    .from(T.weapons)
    .insert(insertPayload)
    .select('id')
    .single()

  if (error && sn && isMissingNotesColumnError(error)) {
    const { notes: _omit, ...rowWithoutNotes } = insertPayload
    insertPayload = rowWithoutNotes
    ;({ data, error } = await supabase
      .from(T.weapons)
      .insert(insertPayload)
      .select('id')
      .single())
  }

  if (error && insertPayload.type !== undefined && isMissingTypeColumnError(error)) {
    const { type: _omitType, ...rowWithoutType } = insertPayload
    insertPayload = rowWithoutType
    ;({ data, error } = await supabase
      .from(T.weapons)
      .insert(insertPayload)
      .select('id')
      .single())
  }

  if (error && sn && isMissingNotesColumnError(error)) {
    const { notes: _omit, ...rowWithoutNotes } = insertPayload
    insertPayload = rowWithoutNotes
    ;({ data, error } = await supabase
      .from(T.weapons)
      .insert(insertPayload)
      .select('id')
      .single())
  }

  if (error) throw new Error(formatSupabaseError(error))
  return data
}

/**
 * Atualiza dados cadastrais da arma (modelo, tipo, marca, calibre, dono, série).
 * @param {string} weaponId
 * @param {{ name: string, weaponTypeId: string, brandId: string, caliberId: string, owner: string, serial?: string, weaponTypeName?: string }} input
 */
export async function updateWeaponDetails(weaponId, input) {
  const trimmedName = (input.name ?? '').trim()
  const trimmedOwner = (input.owner ?? '').trim()
  if (!trimmedName) throw new Error('Informe o modelo da arma.')
  if (!input.weaponTypeId) throw new Error('Selecione o tipo da arma.')
  if (!input.brandId) throw new Error('Selecione a marca.')
  if (!input.caliberId) throw new Error('Selecione um calibre.')
  if (!trimmedOwner) throw new Error('Informe o dono ou use "Em estoque da loja".')

  const legacyType = (input.weaponTypeName ?? '').trim() || '—'
  const serial = input.serial?.trim() ?? ''

  if (isDesktopLocalApi()) {
    await apiWeapons.updateWeaponDetailsRow(weaponId, {
      name: trimmedName,
      weapon_type_id: input.weaponTypeId,
      brand_id: input.brandId,
      caliber_id: input.caliberId,
      owner: trimmedOwner,
      type: legacyType,
      serial,
    })
    return
  }

  const { data: current, error: fetchErr } = await supabase
    .from(T.weapons)
    .select('notes')
    .eq('id', weaponId)
    .single()

  if (fetchErr) throw new Error(formatSupabaseError(fetchErr))

  const notes = setWeaponSerialInNotes(current?.notes, serial)
  const payload = {
    name: trimmedName,
    weapon_type_id: input.weaponTypeId,
    brand_id: input.brandId,
    caliber_id: input.caliberId,
    owner: trimmedOwner,
    type: legacyType,
    notes,
  }

  let { error } = await supabase.from(T.weapons).update(payload).eq('id', weaponId)

  if (error && payload.notes != null && isMissingNotesColumnError(error)) {
    const { notes: _omit, ...withoutNotes } = payload
    ;({ error } = await supabase
      .from(T.weapons)
      .update(withoutNotes)
      .eq('id', weaponId))
  }

  if (error && payload.type !== undefined && isMissingTypeColumnError(error)) {
    const { type: _omitType, ...withoutType } = payload
    ;({ error } = await supabase
      .from(T.weapons)
      .update(withoutType)
      .eq('id', weaponId))
  }

  if (error) throw new Error(formatSupabaseError(error))
}

/**
 * Registra venda: arma ainda não adquirida pela loja (`para_compra`).
 * Documentos/valores comerciais vão em `notes` só para o PDF.
 * @param {object} input
 */
export async function createWeaponSale(input) {
  const err = validateWeaponVendaFields(input)
  if (err) throw new Error(err)

  const trimmedName = String(input.name ?? '').trim()
  const clientName = String(input.clientName ?? '').trim()
  const legacyType = (input.weaponTypeName ?? '').trim() || '—'
  const serial = String(input.serial ?? '').trim()
  const vendaLines = buildVendaNoteLines(input)
  const notes = buildNotesWithVenda('', vendaLines, serial)

  const row = {
    name: trimmedName,
    weapon_type_id: input.weaponTypeId,
    brand_id: input.brandId,
    caliber_id: input.caliberId,
    owner: clientName,
    status: 'para_compra',
    type: legacyType,
    notes,
  }

  if (isDesktopLocalApi()) return apiWeapons.createWeaponRow(row)

  let insertPayload = row
  let { data, error } = await supabase
    .from(T.weapons)
    .insert(insertPayload)
    .select('id')
    .single()

  if (error && insertPayload.type !== undefined && isMissingTypeColumnError(error)) {
    const { type: _omitType, ...rowWithoutType } = insertPayload
    insertPayload = rowWithoutType
    ;({ data, error } = await supabase
      .from(T.weapons)
      .insert(insertPayload)
      .select('id')
      .single())
  }

  if (error && insertPayload.notes != null && isMissingNotesColumnError(error)) {
    throw new Error(
      'Coluna notes indisponível. Execute supabase/sql/weapons_notes.sql para gravar vendas.',
    )
  }

  if (error) throw new Error(formatSupabaseError(error))
  return data
}

/**
 * Adquire arma vendida: preenche S/N e move para estoque (loja ou dono = comprador).
 * @param {string} weaponId
 * @param {{ serial: string, destination: 'estoque' | 'dono' }} input
 */
export async function acquireWeaponSale(weaponId, input) {
  const serial = String(input?.serial ?? '').trim()
  if (!serial) throw new Error('Informe o número de série.')
  const destination = input?.destination
  if (destination !== 'estoque' && destination !== 'dono') {
    throw new Error('Escolha o destino: estoque da loja ou armas com dono.')
  }

  if (isDesktopLocalApi()) {
    await apiWeapons.acquireWeaponSaleRow(weaponId, { serial, destination })
    return
  }

  const { data: current, error: fetchErr } = await supabase
    .from(T.weapons)
    .select('notes, status, owner')
    .eq('id', weaponId)
    .single()

  if (fetchErr) throw new Error(formatSupabaseError(fetchErr))
  if (
    current?.status !== 'para_compra' &&
    current?.status !== 'aguardando_chegada'
  ) {
    throw new Error('Esta arma não está na lista de armas para compra.')
  }

  const owner =
    destination === 'estoque'
      ? SHOP_STOCK_OWNER
      : String(current?.owner ?? '').trim()
  if (!owner) throw new Error('Cliente (dono) não encontrado nesta venda.')

  const notes = setWeaponSerialInNotes(current?.notes, serial)
  const payload = {
    status: 'em_estoque',
    owner,
    notes,
  }

  let { error } = await supabase.from(T.weapons).update(payload).eq('id', weaponId)

  if (error && payload.notes != null && isMissingNotesColumnError(error)) {
    ;({ error } = await supabase
      .from(T.weapons)
      .update({ status: 'em_estoque', owner })
      .eq('id', weaponId))
  }

  if (error) throw new Error(formatSupabaseError(error))
}

/**
 * Marca venda como comprada pela loja, aguardando chegada física.
 * @param {string} weaponId
 */
export async function markWeaponPurchased(weaponId) {
  if (!weaponId || typeof weaponId !== 'string') {
    throw new Error('Arma inválida.')
  }

  if (isDesktopLocalApi()) {
    await apiWeapons.markWeaponPurchasedRow(weaponId)
    return
  }

  const { data: current, error: fetchErr } = await supabase
    .from(T.weapons)
    .select('status')
    .eq('id', weaponId)
    .single()

  if (fetchErr) throw new Error(formatSupabaseError(fetchErr))
  if (current?.status !== 'para_compra') {
    throw new Error('Só é possível marcar armas com status "Para compra".')
  }

  const { error } = await supabase
    .from(T.weapons)
    .update({ status: 'aguardando_chegada' })
    .eq('id', weaponId)

  if (error) throw new Error(formatSupabaseError(error))
}

/**
 * Remove o registro da arma (cadastro incorreto, duplicado, etc.).
 */
export async function deleteWeapon(weaponId) {
  if (!weaponId || typeof weaponId !== 'string') {
    throw new Error('Arma inválida.')
  }

  if (isDesktopLocalApi()) {
    await apiWeapons.deleteWeaponRow(weaponId)
    return
  }

  const { error } = await supabase.from(T.weapons).delete().eq('id', weaponId)

  if (error) throw new Error(formatSupabaseError(error))
}

function isMissingNotesColumnError(err) {
  const s = String(err?.message ?? err?.details ?? err ?? '')
  return /\.notes|column\s+[\w.]+\.notes|notes.*does not exist/i.test(s)
}

function isMissingTypeColumnError(err) {
  const s = String(err?.message ?? err?.details ?? err ?? '')
  return /column\s+[\w.]*\btype\b.*does not exist|does not exist.*\btype\b/i.test(s)
}

/**
 * Marca arma como retirada. Com coluna `notes` (veja supabase/sql/weapons_notes.sql), grava responsável em `notes`.
 * @param {string} [withdrawnAt] ISO da retirada; se omitido, usa o momento atual.
 */
export async function checkoutWeapon(weaponId, responsible, withdrawnAt) {
  const trimmed = responsible?.trim() ?? ''
  const iso =
    typeof withdrawnAt === 'string' && withdrawnAt.trim()
      ? withdrawnAt.trim()
      : new Date().toISOString()

  if (isDesktopLocalApi()) {
    await apiWeapons.checkoutWeaponRow(weaponId, {
      responsible: trimmed,
      withdrawnAt: iso,
    })
    return
  }

  const payload = { status: 'retirada' }

  const { data: current, error: fetchErr } = await supabase
    .from(T.weapons)
    .select('notes')
    .eq('id', weaponId)
    .single()

  if (!fetchErr && current) {
    const line = buildWithdrawalNoteLine(trimmed, iso)
    const prev = (current.notes ?? '').trim()
    payload.notes = prev ? `${prev}\n${line}` : line
  }

  let { error } = await supabase.from(T.weapons).update(payload).eq('id', weaponId)

  if (error && payload.notes && isMissingNotesColumnError(error)) {
    ;({ error } = await supabase
      .from(T.weapons)
      .update({ status: 'retirada' })
      .eq('id', weaponId))
  }

  if (error) throw new Error(formatSupabaseError(error))
}

/**
 * Atualiza dono e situação de uma arma em estoque.
 * @param {string} weaponId
 * @param {{ owner: string, status: 'em_estoque' | 'retirada', responsible?: string, withdrawnAt?: string, termoEntrega?: { rg: string, cpf: string, sigmaSinarm: string } }} input
 */
export async function updateWeapon(weaponId, input) {
  const trimmedOwner = (input.owner ?? '').trim()
  if (!trimmedOwner) throw new Error('Informe o dono.')

  const status = input.status
  if (status !== 'em_estoque' && status !== 'retirada') {
    throw new Error('Situação inválida.')
  }

  const withdrawnAt =
    typeof input.withdrawnAt === 'string' && input.withdrawnAt.trim()
      ? input.withdrawnAt.trim()
      : undefined

  if (isDesktopLocalApi()) {
    await apiWeapons.updateWeaponRow(weaponId, {
      owner: trimmedOwner,
      status,
      responsible: input.responsible,
      withdrawnAt,
      termoEntrega: input.termoEntrega,
    })
    return
  }

  if (status === 'retirada') {
    const trimmed = (input.responsible ?? '').trim()
    const iso = withdrawnAt ?? new Date().toISOString()

    const { data: current, error: fetchErr } = await supabase
      .from(T.weapons)
      .select('notes')
      .eq('id', weaponId)
      .single()

    if (fetchErr) throw new Error(formatSupabaseError(fetchErr))

    const line = buildWithdrawalNoteLine(trimmed, iso)
    const prev = (current?.notes ?? '').trim()
    let notes = prev ? `${prev}\n${line}` : line
    if (input.termoEntrega) {
      const termoLine = buildTermoEntregaNoteLine(input.termoEntrega)
      notes = `${notes}\n${termoLine}`
    }

    const payload = {
      owner: trimmedOwner,
      status: 'retirada',
      notes,
    }

    let { error } = await supabase.from(T.weapons).update(payload).eq('id', weaponId)

    if (error && payload.notes && isMissingNotesColumnError(error)) {
      ;({ error } = await supabase
        .from(T.weapons)
        .update({ owner: trimmedOwner, status: 'retirada' })
        .eq('id', weaponId))
    }

    if (error) throw new Error(formatSupabaseError(error))
    return
  }

  const { error } = await supabase
    .from(T.weapons)
    .update({ owner: trimmedOwner, status: 'em_estoque' })
    .eq('id', weaponId)

  if (error) throw new Error(formatSupabaseError(error))
}

/**
 * Atualiza dados de uma entrega já registrada (substitui linhas em `notes`, não acrescenta).
 * @param {string} weaponId
 * @param {{ owner: string, responsible?: string, withdrawnAt: string, termoEntrega: { rg: string, cpf: string, sigmaSinarm: string } }} input
 */
export async function updateWeaponDelivery(weaponId, input) {
  const trimmedOwner = (input.owner ?? '').trim()
  if (!trimmedOwner) throw new Error('Informe o dono.')

  const withdrawnAt =
    typeof input.withdrawnAt === 'string' && input.withdrawnAt.trim()
      ? input.withdrawnAt.trim()
      : undefined
  if (!withdrawnAt) throw new Error('Informe a data de retirada.')

  if (isDesktopLocalApi()) {
    await apiWeapons.updateWeaponDeliveryRow(weaponId, {
      owner: trimmedOwner,
      responsible: input.responsible,
      withdrawnAt,
      termoEntrega: input.termoEntrega,
    })
    return
  }

  const { data: current, error: fetchErr } = await supabase
    .from(T.weapons)
    .select('notes, status')
    .eq('id', weaponId)
    .single()

  if (fetchErr) throw new Error(formatSupabaseError(fetchErr))
  if (current?.status !== 'retirada') {
    throw new Error('Esta arma não está registrada como retirada.')
  }

  const notes = rebuildWeaponNotesWithDelivery(current?.notes, {
    responsible: input.responsible,
    withdrawnAtIso: withdrawnAt,
    termoEntrega: input.termoEntrega,
  })

  const payload = { owner: trimmedOwner, notes }

  let { error } = await supabase.from(T.weapons).update(payload).eq('id', weaponId)

  if (error && payload.notes && isMissingNotesColumnError(error)) {
    ;({ error } = await supabase
      .from(T.weapons)
      .update({ owner: trimmedOwner })
      .eq('id', weaponId))
  }

  if (error) throw new Error(formatSupabaseError(error))
}
