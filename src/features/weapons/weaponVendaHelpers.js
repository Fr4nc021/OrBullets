import { cpfDigitsOnly, formatCpfDisplay, dateFromDateInput } from './weaponEntregaHelpers.js'
import { parseWeaponSerialFromNotes } from './weaponsReportHelpers.js'

/** Apenas dígitos do CEP (máx. 8). */
export function cepDigitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8)
}

/** Ex.: 95703114 → 95703-114 */
export function formatCepDisplay(digits) {
  const d = cepDigitsOnly(digits)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/** Máscara parcial enquanto digita. */
export function maskCepInput(value) {
  return formatCepDisplay(value)
}

/**
 * Consulta ViaCEP. Retorna null se CEP inválido / não encontrado / rede falhou.
 * @param {string} cep
 * @returns {Promise<{ address: string, neighborhood: string, city: string, state: string, cep: string } | null>}
 */
export async function lookupAddressByCep(cep) {
  const digits = cepDigitsOnly(cep)
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.erro) return null
    return {
      address: String(data.logradouro ?? '').trim(),
      neighborhood: String(data.bairro ?? '').trim(),
      city: String(data.localidade ?? '').trim(),
      state: String(data.uf ?? '').trim(),
      cep: formatCepDisplay(digits),
    }
  } catch {
    return null
  }
}


/** @typedef {'certificado_registro' | 'autorizacao' | 'apostilamento' | 'guia_trafego' | 'segundo_endereco'} VendaDocProcessId */

/** @type {{ id: VendaDocProcessId, label: string }[]} */
export const VENDA_DOC_PROCESSES = [
  { id: 'certificado_registro', label: 'Certificado de registro' },
  { id: 'autorizacao', label: 'Autorização' },
  { id: 'apostilamento', label: 'Apostilamento' },
  { id: 'guia_trafego', label: 'Guia de tráfego' },
  { id: 'segundo_endereco', label: 'Segundo endereço' },
]

const PROCESS_ID_SET = new Set(VENDA_DOC_PROCESSES.map((p) => p.id))

/**
 * @param {string} raw
 * @returns {number}
 */
export function parseMoneyInput(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/R\$\s?/i, '')
    .replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    const normalized = s.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : NaN
  }
  const n = Number(s.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatMoneyBr(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string} DD/MM/YYYY
 */
export function formatDateBrShort(dateStr) {
  const d = dateFromDateInput(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * @param {unknown} ids
 * @returns {VendaDocProcessId[]}
 */
export function normalizeDocProcessIds(ids) {
  if (!Array.isArray(ids)) return []
  const out = []
  for (const id of ids) {
    const key = String(id ?? '').trim()
    if (PROCESS_ID_SET.has(/** @type {VendaDocProcessId} */ (key)) && !out.includes(key)) {
      out.push(/** @type {VendaDocProcessId} */ (key))
    }
  }
  return out
}

/**
 * @param {VendaDocProcessId[]} processIds
 * @returns {string[]}
 */
export function docProcessLabels(processIds) {
  const set = new Set(normalizeDocProcessIds(processIds))
  return VENDA_DOC_PROCESSES.filter((p) => set.has(p.id)).map((p) => p.label)
}

/**
 * @param {object} fields
 * @returns {string | null}
 */
export function validateWeaponVendaFields(fields) {
  const f = fields ?? {}
  if (!(f.weaponTypeId ?? '').toString().trim()) return 'Selecione o tipo da arma.'
  if (!(f.brandId ?? '').toString().trim()) return 'Selecione a marca.'
  if (!(f.name ?? '').toString().trim()) return 'Informe o modelo da arma.'
  if (!(f.caliberId ?? '').toString().trim()) return 'Selecione o calibre.'

  const weaponValue = parseMoneyInput(f.weaponValue)
  if (!Number.isFinite(weaponValue) || weaponValue < 0) {
    return 'Informe um valor válido da arma.'
  }

  if (!(f.paymentMethod ?? '').toString().trim()) {
    return 'Informe a forma de pagamento.'
  }

  const processes = normalizeDocProcessIds(f.docProcesses)
  const docsValue = parseMoneyInput(f.docsValue)
  if (processes.length > 0) {
    if (!Number.isFinite(docsValue) || docsValue <= 0) {
      return 'Informe o valor a pagar pelos documentos selecionados.'
    }
  } else if (Number.isFinite(docsValue) && docsValue > 0) {
    return 'Selecione ao menos um processo de documentos ou zere o valor.'
  }

  if (!(f.seller ?? '').toString().trim()) return 'Informe o vendedor.'
  if (!(f.clientName ?? '').toString().trim()) return 'Informe o nome do cliente.'
  if (!(f.clientIdentity ?? '').toString().trim()) return 'Informe a identidade (RG) do cliente.'
  if (cpfDigitsOnly(f.clientCpf).length !== 11) return 'Informe um CPF válido (11 dígitos).'
  if (!(f.clientPhone ?? '').toString().trim()) return 'Informe o telefone do cliente.'
  if (!(f.clientAddress ?? '').toString().trim()) return 'Informe o endereço do cliente.'
  if (!(f.clientCity ?? '').toString().trim()) return 'Informe a cidade.'
  if (!(f.saleDate ?? '').toString().trim()) return 'Informe a data da venda.'
  return null
}

/**
 * @param {object} data
 * @returns {string[]}
 */
export function buildVendaNoteLines(data) {
  const d = data ?? {}
  const processes = normalizeDocProcessIds(d.docProcesses)
  const weaponValue = parseMoneyInput(d.weaponValue)
  const docsValue = processes.length > 0 ? parseMoneyInput(d.docsValue) : 0
  const total =
    (Number.isFinite(weaponValue) ? weaponValue : 0) +
    (Number.isFinite(docsValue) ? docsValue : 0)

  const saleDate = (d.saleDate ?? '').toString().trim()
  const forma = (d.paymentMethod ?? '').trim()
  const vendedor = (d.seller ?? '').trim()

  const lines = [
    `Venda — data: ${saleDate} | forma: ${forma} | valor: ${weaponValue.toFixed(2)} | valor docs: ${docsValue.toFixed(2)} | total: ${total.toFixed(2)} | vendedor: ${vendedor}`,
  ]

  if (processes.length > 0) {
    lines.push(`Venda docs — processos: ${processes.join(',')}`)
  } else {
    lines.push('Venda docs — processos:')
  }

  const id = (d.clientIdentity ?? '').trim()
  const cpf = formatCpfDisplay(cpfDigitsOnly(d.clientCpf))
  const tel = (d.clientPhone ?? '').trim()
  const end = (d.clientAddress ?? '').trim()
  const num = (d.clientNumber ?? '').trim() || '—'
  const bairro = (d.clientNeighborhood ?? '').trim() || '—'
  const cidade = (d.clientCity ?? '').trim()
  const cep = formatCepDisplay(d.clientCep) || '—'

  lines.push(
    `Venda cliente — id: ${id} | CPF: ${cpf} | tel: ${tel} | end: ${end} | nº: ${num} | bairro: ${bairro} | cidade: ${cidade} | CEP: ${cep}`,
  )

  const obs = (d.obs ?? '').trim()
  if (obs) lines.push(`OBS venda: ${obs}`)

  return lines
}

/**
 * @param {string | null | undefined} notes
 * @param {string | null | undefined} [serial]
 * @returns {string}
 */
export function buildNotesWithVenda(notesBase, vendaLines, serial) {
  const kept = String(notesBase ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/^Venda\s*—/i.test(l) &&
        !/^Venda docs\s*—/i.test(l) &&
        !/^Venda cliente\s*—/i.test(l) &&
        !/^OBS venda:/i.test(l) &&
        !/^\s*S\/N:/i.test(l),
    )
  const sn = (serial ?? '').trim()
  const out = []
  if (sn) out.push(`S/N: ${sn}`)
  out.push(...vendaLines)
  out.push(...kept)
  return out.join('\n')
}

/**
 * @param {string | null | undefined} notes
 * @returns {object | null}
 */
export function parseVendaFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null
  const lines = notes.split('\n').map((l) => l.trim()).filter(Boolean)

  let saleLine = null
  let docsLine = null
  let clientLine = null
  let obs = ''

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!saleLine && /^Venda\s*—/i.test(line) && !/^Venda docs/i.test(line) && !/^Venda cliente/i.test(line)) {
      saleLine = line
    } else if (!docsLine && /^Venda docs\s*—/i.test(line)) {
      docsLine = line
    } else if (!clientLine && /^Venda cliente\s*—/i.test(line)) {
      clientLine = line
    } else if (!obs && /^OBS venda:/i.test(line)) {
      obs = line.replace(/^OBS venda:\s*/i, '').trim()
    }
  }

  if (!saleLine || !clientLine) return null

  const saleM = saleLine.match(
    /^Venda\s*—\s*data:\s*(.+?)\s*\|\s*forma:\s*(.+?)\s*\|\s*valor:\s*(.+?)\s*\|\s*valor docs:\s*(.+?)\s*\|\s*total:\s*(.+?)\s*\|\s*vendedor:\s*(.+)$/i,
  )
  if (!saleM) return null

  const clientM = clientLine.match(
    /^Venda cliente\s*—\s*id:\s*(.+?)\s*\|\s*CPF:\s*(.+?)\s*\|\s*tel:\s*(.+?)\s*\|\s*end:\s*(.+?)\s*\|\s*nº:\s*(.+?)\s*\|\s*bairro:\s*(.+?)\s*\|\s*cidade:\s*(.+?)\s*\|\s*CEP:\s*(.+)$/i,
  )
  if (!clientM) return null

  let docProcesses = []
  if (docsLine) {
    const dm = docsLine.match(/^Venda docs\s*—\s*processos:\s*(.*)$/i)
    if (dm) {
      const raw = (dm[1] ?? '').trim()
      docProcesses = normalizeDocProcessIds(
        raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      )
    }
  }

  return {
    saleDate: saleM[1].trim(),
    paymentMethod: saleM[2].trim(),
    weaponValue: Number(saleM[3]),
    docsValue: Number(saleM[4]),
    total: Number(saleM[5]),
    seller: saleM[6].trim(),
    docProcesses,
    clientIdentity: clientM[1].trim(),
    clientCpf: clientM[2].trim(),
    clientPhone: clientM[3].trim(),
    clientAddress: clientM[4].trim(),
    clientNumber: clientM[5].trim() === '—' ? '' : clientM[5].trim(),
    clientNeighborhood: clientM[6].trim() === '—' ? '' : clientM[6].trim(),
    clientCity: clientM[7].trim(),
    clientCep: clientM[8].trim() === '—' ? '' : clientM[8].trim(),
    obs,
    serial: (() => {
      const sn = parseWeaponSerialFromNotes(notes)
      return sn === '—' ? '' : sn
    })(),
  }
}

/**
 * @param {object} weapon
 * @param {{ type: string, brand: string, model: string, caliber: string }} labels
 * @param {object} saleFields
 */
export function buildVendaPdfPayload(weapon, labels, saleFields) {
  const f = saleFields ?? {}
  const processes = normalizeDocProcessIds(f.docProcesses)
  const weaponValue = Number.isFinite(Number(f.weaponValue))
    ? Number(f.weaponValue)
    : parseMoneyInput(f.weaponValue)
  const docsValue =
    processes.length > 0
      ? Number.isFinite(Number(f.docsValue))
        ? Number(f.docsValue)
        : parseMoneyInput(f.docsValue)
      : 0
  const total =
    (Number.isFinite(weaponValue) ? weaponValue : 0) +
    (Number.isFinite(docsValue) ? docsValue : 0)

  const serialFromWeapon = parseWeaponSerialFromNotes(weapon?.notes)
  const serial =
    (f.serial ?? '').toString().trim() ||
    (serialFromWeapon !== '—' ? serialFromWeapon : '') ||
    '—'

  return {
    saleDate: (f.saleDate ?? '').toString().trim(),
    weapon: {
      type: labels?.type ?? '—',
      brand: labels?.brand ?? '—',
      model: labels?.model ?? weapon?.name ?? '—',
      caliber: labels?.caliber ?? '—',
      serial,
      value: weaponValue,
      paymentMethod: (f.paymentMethod ?? '').toString().trim(),
    },
    documents: {
      processes,
      processLabels: docProcessLabels(processes),
      value: docsValue,
    },
    total,
    obs: (f.obs ?? '').toString().trim(),
    seller: (f.seller ?? '').toString().trim(),
    client: {
      name: (weapon?.owner ?? f.clientName ?? '').toString().trim(),
      identity: (f.clientIdentity ?? '').toString().trim(),
      cpf: formatCpfDisplay(cpfDigitsOnly(f.clientCpf ?? '')),
      phone: (f.clientPhone ?? '').toString().trim(),
      address: (f.clientAddress ?? '').toString().trim(),
      number: (f.clientNumber ?? '').toString().trim(),
      neighborhood: (f.clientNeighborhood ?? '').toString().trim(),
      city: (f.clientCity ?? '').toString().trim(),
      cep: (f.clientCep ?? '').toString().trim(),
    },
  }
}

/**
 * Dados fictícios para conferir o layout do papel de venda e do contrato.
 * Não representa uma venda real.
 */
export function buildVendaLayoutTestPayload() {
  const now = new Date()
  const saleDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const payload = buildVendaPdfPayload(
    { owner: 'JOÃO DA SILVA TESTE', notes: '', name: 'G19' },
    {
      type: 'Pistola',
      brand: 'Glock',
      model: 'G19',
      caliber: '9 mm',
    },
    {
      saleDate,
      weaponValue: 8500,
      docsValue: 450,
      paymentMethod: 'Pix à vista',
      docProcesses: VENDA_DOC_PROCESSES.map((p) => p.id),
      seller: 'Maria Vendedora',
      clientName: 'JOÃO DA SILVA TESTE',
      clientIdentity: '1234567890',
      clientCpf: '12345678901',
      clientPhone: '(51) 99999-0000',
      clientAddress: 'Rua Exemplo da Loja',
      clientNumber: '120',
      clientNeighborhood: 'Centro',
      clientCity: 'Montenegro',
      clientCep: '95780-000',
      obs: 'Documento de teste para conferir o layout.',
      serial: 'ABC123456',
    },
  )
  payload.testLayout = true
  return payload
}
