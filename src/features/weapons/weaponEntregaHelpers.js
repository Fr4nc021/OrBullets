/** @typedef {{ rg: string, cpf: string, sigmaSinarm: string }} TermoEntregaData */

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Apenas dígitos do CPF. */
export function cpfDigitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Ex.: 93681747091 → 936.817.470-91 */
export function formatCpfDisplay(digits) {
  const d = cpfDigitsOnly(digits)
  if (d.length !== 11) return d
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Máscara parcial enquanto digita. */
export function maskCpfInput(value) {
  const d = cpfDigitsOnly(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Ex.: 1 de junho de 2026. */
export function formatBrazilianDateLong(d) {
  const day = d.getDate()
  const month = MESES_PT[d.getMonth()]
  const year = d.getFullYear()
  return `${day} de ${month} de ${year}.`
}

export function dateFromDateInput(dateStr) {
  const raw = (dateStr ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date()
  const [y, m, d] = raw.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/**
 * Linha em `notes` para reimprimir o comprovante.
 * @param {TermoEntregaData} data
 */
export function buildTermoEntregaNoteLine({ rg, cpf, sigmaSinarm }) {
  const rgT = (rg ?? '').trim()
  const cpfT = formatCpfDisplay(cpfDigitsOnly(cpf))
  const sigmaT = (sigmaSinarm ?? '').trim()
  return `Termo entrega — RG: ${rgT} | CPF: ${cpfT} | SINARM/SIGMA: ${sigmaT}`
}

/**
 * @param {string | null | undefined} notes
 * @returns {TermoEntregaData | null}
 */
export function parseTermoEntregaFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null
  const lines = notes.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(
      /^Termo entrega\s*—\s*RG:\s*(.+?)\s*\|\s*CPF:\s*(.+?)\s*\|\s*SINARM\/SIGMA:\s*(.+)$/i,
    )
    if (m) {
      return {
        rg: m[1].trim(),
        cpf: m[2].trim(),
        sigmaSinarm: m[3].trim(),
      }
    }
  }
  return null
}

/**
 * @param {{ rg: string, cpf: string, sigmaSinarm: string }} fields
 * @returns {string | null} mensagem de erro ou null se ok
 */
export function validateWeaponEntregaFields({ rg, cpf, sigmaSinarm }) {
  if (!(rg ?? '').trim()) return 'Informe o RG do recebedor.'
  if (cpfDigitsOnly(cpf).length !== 11) return 'Informe um CPF válido (11 dígitos).'
  if (!(sigmaSinarm ?? '').trim()) return 'Informe o Nº SINARM/SIGMA.'
  return null
}

/**
 * @param {object} weapon
 * @param {{ type: string, brand: string, model: string, caliber: string, serial: string }} labels
 */
export function buildComprovantePayload(weapon, labels, recipient, atDate) {
  const r = recipient ?? {}
  return {
    recipient: {
      name: (weapon?.owner ?? '').trim(),
      rg: String(r.rg ?? '').trim(),
      cpf: formatCpfDisplay(cpfDigitsOnly(r.cpf ?? '')),
    },
    weapon: {
      type: labels?.type ?? '—',
      brand: labels?.brand ?? '—',
      model: labels?.model ?? '—',
      caliber: labels?.caliber ?? '—',
      serial: labels?.serial ?? '—',
      sigmaSinarm: String(r.sigmaSinarm ?? '').trim(),
    },
    atDate: atDate ?? new Date(),
  }
}
