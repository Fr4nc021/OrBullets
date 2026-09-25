import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const MARGIN = 12

const HEAD = [
  [
    'Modelo',
    'Marca',
    'Tipo',
    'Calibre',
    'Nº série',
    'Dono',
    'Responsável',
  ],
]

function filenameDateStamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatIsoDatePt(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const parts = iso.trim().split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

function pageInnerWidth(doc) {
  return doc.internal.pageSize.getWidth() - 2 * MARGIN
}

function pageHeight(doc) {
  return doc.internal.pageSize.getHeight()
}

function columnStyles(innerW) {
  const w0 = innerW * 0.2
  const w1 = innerW * 0.14
  const w2 = innerW * 0.12
  const w3 = innerW * 0.1
  const w4 = innerW * 0.14
  const w5 = innerW * 0.15
  const w6 = innerW * 0.15
  return {
    0: { cellWidth: w0, halign: 'left' },
    1: { cellWidth: w1, halign: 'left' },
    2: { cellWidth: w2, halign: 'left' },
    3: { cellWidth: w3, halign: 'left' },
    4: { cellWidth: w4, halign: 'left' },
    5: { cellWidth: w5, halign: 'left' },
    6: { cellWidth: w6, halign: 'left' },
  }
}

function tableStylesBase(fontSize) {
  return {
    fontSize,
    cellPadding: 1.4,
    valign: 'middle',
    lineColor: [100, 100, 100],
    lineWidth: 0.1,
    overflow: 'linebreak',
  }
}

function rowToBody(r, responsibleCol) {
  return [
    r.model,
    r.brand,
    r.type,
    r.caliber,
    r.serial,
    r.owner,
    responsibleCol === 'dash' ? '—' : r.responsible,
  ]
}

/**
 * @param {object} p
 * @param {Array} p.inStockShopRows — em estoque, dono = loja
 * @param {Array} p.inStockFixedOwnerRows — em estoque, dono fixo (cliente)
 * @param {Array} p.soldRows
 * @param {string} p.periodFrom — YYYY-MM-DD
 * @param {string} p.periodTo — YYYY-MM-DD
 * @returns {import('jspdf').jsPDF}
 */
export function buildWeaponsReportPdfDoc({
  inStockShopRows,
  inStockFixedOwnerRows,
  soldRows,
  periodFrom,
  periodTo,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const innerW = pageInnerWidth(doc)
  const hPage = pageHeight(doc)
  let y = 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Relatório de armas', MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const now = new Date()
  doc.text(
    `Período (vendidas/retiradas): ${formatIsoDatePt(periodFrom)} a ${formatIsoDatePt(periodTo)}`,
    MARGIN,
    y,
  )
  y += 4
  doc.text(
    'Em estoque: separado em armas da loja e armas com dono fixo (sem filtro de data).',
    MARGIN,
    y,
  )
  y += 4
  doc.text(
    'Armas “para compra” ou “aguardando chegada” (vendidas e ainda não no estoque) não entram neste relatório.',
    MARGIN,
    y,
  )
  y += 4
  doc.text(
    `Gerado em ${now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    MARGIN,
    y,
  )
  y += 8

  const minBottom = 16
  const sections = [
    {
      title: 'ARMAS EM ESTOQUE DA LOJA',
      rows: inStockShopRows ?? [],
      resp: 'dash',
    },
    {
      title: 'ARMAS COM DONO FIXO (em estoque)',
      rows: inStockFixedOwnerRows ?? [],
      resp: 'dash',
    },
    {
      title: 'ARMAS VENDIDAS / RETIRADAS (no período)',
      rows: soldRows,
      resp: 'value',
    },
  ]

  let startY = y

  for (let si = 0; si < sections.length; si += 1) {
    const sec = sections[si]
    if (si > 0) startY += 4

    if (startY > hPage - minBottom) {
      doc.addPage()
      startY = MARGIN + 4
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(25, 35, 55)
    doc.text(sec.title, MARGIN, startY)
    doc.setTextColor(0, 0, 0)
    startY += 4

    const body =
      sec.rows.length > 0
        ? sec.rows.map((r) => rowToBody(r, sec.resp))
        : [['Nenhum registro.', '—', '—', '—', '—', '—', '—']]

    autoTable(doc, {
      startY,
      head: HEAD,
      body,
      theme: 'grid',
      styles: tableStylesBase(7.5),
      headStyles: {
        fillColor: [238, 242, 246],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      columnStyles: columnStyles(innerW),
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: innerW,
    })
    startY = doc.lastAutoTable.finalY + 2
  }

  return doc
}

/**
 * @param {object} p
 * @param {Array} p.inStockShopRows
 * @param {Array} p.inStockFixedOwnerRows
 * @param {Array} p.soldRows
 * @param {string} p.periodFrom
 * @param {string} p.periodTo
 */
export function downloadWeaponsReportPdf(params) {
  const doc = buildWeaponsReportPdfDoc(params)
  const now = new Date()
  doc.save(`relatorio-armas-${filenameDateStamp(now)}.pdf`)
}

/**
 * @param {object} p — mesmo que `downloadWeaponsReportPdf`
 * @param {string} [filename]
 * @returns {{ blob: Blob, filename: string }}
 */
export function getWeaponsReportPdfBlob(params, filename) {
  const doc = buildWeaponsReportPdfDoc(params)
  const now = new Date()
  const fn = filename ?? `relatorio-armas-${filenameDateStamp(now)}.pdf`
  const blob = doc.output('blob')
  return { blob, filename: fn }
}
