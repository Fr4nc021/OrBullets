import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { docProcessLabels, formatDateBrShort, formatMoneyBr } from './weaponVendaHelpers.js'

const STORE_DECLARATION =
  'A loja Pesca Sem Limites Comércio de Produtos Náuticos Ltda, CNPJ 21.921.795/0001-40, declara que vendeu para esses clientes as seguintes armas:'

const MARGIN = 10

const CLIENT_HEAD = [['Nome', 'RG', 'CPF', 'Telefone', 'Endereço']]

const WEAPON_HEAD = [[
  'Cliente',
  'Tipo',
  'Marca',
  'Modelo',
  'Calibre',
  'Nº série',
  'Data',
  'Pagamento',
  'Valor arma',
  'Valor docs',
  'Total',
  'Documentos',
  'Vendedor',
  'Obs.',
]]

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

function clientAddress(row) {
  return [
    dash(row.clientAddress),
    `nº ${dash(row.clientNumber)}`,
    dash(row.clientNeighborhood),
    dash(row.clientCity),
    `CEP ${dash(row.clientCep)}`,
  ].join(', ')
}

function uniqueClients(rows) {
  const seen = new Set()
  const clients = []
  for (const row of rows) {
    const key = `${dash(row.clientCpf)}|${dash(row.clientName)}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    clients.push(row)
  }
  return clients
}

function tableStyles() {
  return {
    font: 'helvetica',
    fontSize: 7,
    cellPadding: 1.3,
    valign: 'middle',
    lineColor: [100, 100, 100],
    lineWidth: 0.1,
    overflow: 'linebreak',
  }
}

function headStyles() {
  return {
    fillColor: [238, 242, 246],
    textColor: [20, 20, 20],
    fontStyle: 'bold',
    fontSize: 7,
  }
}

function emptyRow(colCount, text) {
  return [[{ content: text, colSpan: colCount, styles: { halign: 'left', fontStyle: 'italic' } }]]
}

/**
 * PDF da declaração: texto da loja e, em tabelas, clientes e armas selecionadas.
 * @param {Array<object>} sales
 */
export function buildSoldWeaponsDeclarationPdfDoc(sales) {
  const rows = Array.isArray(sales) ? sales : []
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const innerW = pageW - 2 * MARGIN
  let y = 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Declaração de armas vendidas', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const declLines = doc.splitTextToSize(STORE_DECLARATION, innerW)
  doc.text(declLines, MARGIN, y)
  y += declLines.length * 4.4 + 2

  doc.setFontSize(8.5)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${rows.length} arma(s)`,
    MARGIN,
    y,
  )
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Clientes', MARGIN, y)
  y += 2

  const clients = uniqueClients(rows)
  const clientPct = [0.24, 0.12, 0.14, 0.14, 0.36]
  autoTable(doc, {
    startY: y,
    head: CLIENT_HEAD,
    body: clients.length
      ? clients.map((row) => [
        dash(row.clientName),
        dash(row.clientIdentity),
        dash(row.clientCpf),
        dash(row.clientPhone),
        clientAddress(row),
      ])
      : emptyRow(5, 'Nenhuma venda selecionada.'),
    theme: 'grid',
    styles: { ...tableStyles(), fontSize: 8 },
    headStyles: { ...headStyles(), fontSize: 8 },
    columnStyles: Object.fromEntries(
      clientPct.map((p, i) => [i, { cellWidth: innerW * p, halign: 'left' }]),
    ),
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
  })

  y = doc.lastAutoTable.finalY + 8
  if (y > doc.internal.pageSize.getHeight() - 28) {
    doc.addPage()
    y = 14
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Armas', MARGIN, y)
  y += 2

  const weaponPct = [0.1, 0.07, 0.08, 0.09, 0.06, 0.08, 0.06, 0.07, 0.07, 0.07, 0.06, 0.08, 0.06, 0.05]
  autoTable(doc, {
    startY: y,
    head: WEAPON_HEAD,
    body: rows.length
      ? rows.map((row) => {
        const processes = docProcessLabels(row.docProcesses ?? [])
        return [
          dash(row.clientName),
          dash(row.type),
          dash(row.brand),
          dash(row.model),
          dash(row.caliber),
          dash(row.serial),
          row.saleDate ? formatDateBrShort(row.saleDate) : '—',
          dash(row.paymentMethod),
          moneyOrDash(row.weaponValue),
          moneyOrDash(row.docsValue),
          moneyOrDash(row.total),
          processes.length ? processes.join(', ') : '—',
          dash(row.seller),
          dash(row.obs),
        ]
      })
      : emptyRow(14, 'Nenhuma venda selecionada.'),
    theme: 'grid',
    styles: tableStyles(),
    headStyles: headStyles(),
    columnStyles: Object.fromEntries(
      weaponPct.map((p, i) => [i, { cellWidth: innerW * p, halign: 'left' }]),
    ),
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
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
