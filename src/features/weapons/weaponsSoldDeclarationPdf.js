import { jsPDF } from 'jspdf'
import { docProcessLabels, formatDateBrShort, formatMoneyBr } from './weaponVendaHelpers.js'

const STORE_DECLARATION =
  'A loja Pesca Sem Limites Comércio de Produtos Náuticos Ltda, CNPJ 21.921.795/0001-40, declara que vendeu para esses clientes as seguintes armas:'

const MARGIN = 16

function dash(value) {
  const t = value == null ? '' : String(value).trim()
  return t ? t : '—'
}

function moneyOrDash(value) {
  const n = Number(value)
  return Number.isFinite(n) ? formatMoneyBr(n) : '—'
}

function filenameDateStamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} y
 * @param {number} need
 */
function ensureSpace(doc, y, need) {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + need > pageH - 14) {
    doc.addPage()
    return 16
  }
  return y
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {string} text
 * @param {number} y
 * @param {{ bold?: boolean, size?: number, gap?: number }} [opts]
 */
function writeWrapped(doc, text, y, opts = {}) {
  const size = opts.size ?? 11
  const gap = opts.gap ?? 5.2
  const innerW = doc.internal.pageSize.getWidth() - 2 * MARGIN
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  const lines = doc.splitTextToSize(String(text ?? ''), innerW)
  const lineH = size * 0.45
  y = ensureSpace(doc, y, lines.length * lineH + 2)
  doc.text(lines, MARGIN, y)
  return y + lines.length * lineH + (gap - lineH)
}

/**
 * PDF simples: declaração da loja, dados dos clientes e dados das armas selecionadas.
 * @param {Array<object>} sales
 */
export function buildSoldWeaponsDeclarationPdfDoc(sales) {
  const rows = Array.isArray(sales) ? sales : []
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Declaração de armas vendidas', MARGIN, y)
  y += 8

  y = writeWrapped(doc, STORE_DECLARATION, y, { size: 11, gap: 7 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y = ensureSpace(doc, y, 8)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${rows.length} arma(s)`,
    MARGIN,
    y,
  )
  y += 8

  y = writeWrapped(doc, 'Clientes', y, { bold: true, size: 12, gap: 6 })

  if (rows.length === 0) {
    y = writeWrapped(doc, 'Nenhuma venda selecionada.', y, { size: 11 })
  }

  const seenClients = new Set()
  let clientIndex = 0
  for (const row of rows) {
    const key = `${dash(row.clientCpf)}|${dash(row.clientName)}`.toLowerCase()
    if (seenClients.has(key)) continue
    seenClients.add(key)
    clientIndex += 1
    const address = [
      dash(row.clientAddress),
      `nº ${dash(row.clientNumber)}`,
      dash(row.clientNeighborhood),
      dash(row.clientCity),
      `CEP ${dash(row.clientCep)}`,
    ].join(', ')
    const block = [
      `${clientIndex}. ${dash(row.clientName)}`,
      `RG: ${dash(row.clientIdentity)}`,
      `CPF: ${dash(row.clientCpf)}`,
      `Telefone: ${dash(row.clientPhone)}`,
      `Endereço: ${address}`,
    ].join('\n')
    y = writeWrapped(doc, block, y, { size: 10.5, gap: 6 })
  }

  y += 2
  y = writeWrapped(doc, 'Armas', y, { bold: true, size: 12, gap: 6 })

  rows.forEach((row, index) => {
    const processes = docProcessLabels(row.docProcesses ?? [])
    const saleDate = row.saleDate ? formatDateBrShort(row.saleDate) : '—'
    const block = [
      `${index + 1}. ${dash(row.model)} — cliente: ${dash(row.clientName)}`,
      `Tipo: ${dash(row.type)}`,
      `Marca: ${dash(row.brand)}`,
      `Modelo: ${dash(row.model)}`,
      `Calibre: ${dash(row.caliber)}`,
      `Nº de série: ${dash(row.serial)}`,
      `Data da venda: ${saleDate}`,
      `Forma de pagamento: ${dash(row.paymentMethod)}`,
      `Valor da arma: ${moneyOrDash(row.weaponValue)}`,
      `Valor dos documentos: ${moneyOrDash(row.docsValue)}`,
      `Total: ${moneyOrDash(row.total)}`,
      `Documentos: ${processes.length ? processes.join(', ') : '—'}`,
      `Vendedor: ${dash(row.seller)}`,
      row.obs ? `Observação: ${row.obs}` : null,
    ]
      .filter(Boolean)
      .join('\n')
    y = writeWrapped(doc, block, y, { size: 10.5, gap: 6 })
  })

  return doc
}

/**
 * @param {Array<object>} sales
 */
export function downloadSoldWeaponsDeclarationPdf(sales) {
  const doc = buildSoldWeaponsDeclarationPdfDoc(sales)
  doc.save(`declaracao-armas-vendidas-${filenameDateStamp(new Date())}.pdf`)
}
