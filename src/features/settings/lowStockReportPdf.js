import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  compareProductTypeKeys,
  productTypeLabel,
} from '../ammo/productTypes.js'

const MARGIN = 12

/**
 * @param {{ productType?: string, caliber?: string, name?: string, quantity?: number }[]} items
 */
export function sortLowStockItems(items) {
  return [...(items ?? [])].sort((a, b) => {
    const typeCmp = compareProductTypeKeys(a.productType, b.productType)
    if (typeCmp) return typeCmp
    const cal = String(a.caliber ?? '').localeCompare(
      String(b.caliber ?? ''),
      'pt-BR',
    )
    if (cal) return cal
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR')
  })
}

export function lowStockShortfall(quantity, threshold) {
  const qty = Number(quantity)
  const min = Number(threshold)
  if (!Number.isFinite(qty) || !Number.isFinite(min)) return 0
  return Math.max(0, min - qty)
}

function filenameDateStamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pageInnerWidth(doc) {
  return doc.internal.pageSize.getWidth() - 2 * MARGIN
}

function formatQty(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR')
}

/**
 * @param {object} p
 * @param {{ name: string, caliber: string, productType?: string, quantity: number }[]} p.items
 * @param {number} p.threshold
 * @returns {import('jspdf').jsPDF}
 */
export function buildLowStockReportPdfDoc({ items, threshold }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const innerW = pageInnerWidth(doc)
  const sorted = sortLowStockItems(items)
  const min = Number(threshold) || 0
  let y = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20, 20, 20)
  doc.text('Relatório de estoque baixo', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Itens abaixo de ${formatQty(min)} unidades, inclusive quantidade 0`,
    MARGIN,
    y,
  )
  y += 4.5

  const now = new Date()
  doc.text(
    `Gerado em ${now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${sorted.length} ${sorted.length === 1 ? 'item' : 'itens'}`,
    MARGIN,
    y,
  )
  y += 7

  const body = sorted.length
    ? sorted.map((item) => [
        productTypeLabel(item.productType),
        item.name || '—',
        item.caliber || '—',
        formatQty(item.quantity),
        formatQty(lowStockShortfall(item.quantity, min)),
      ])
    : [['—', 'Nenhum item abaixo do estoque mínimo.', '—', '—', '—']]

  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Produto', 'Calibre', 'Quantidade', 'Faltam']],
    body,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      valign: 'middle',
      textColor: [20, 20, 20],
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [45, 55, 72],
      textColor: [248, 250, 252],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: innerW * 0.16 },
      1: { cellWidth: innerW * 0.32 },
      2: { cellWidth: innerW * 0.24 },
      3: { cellWidth: innerW * 0.14, halign: 'right' },
      4: { cellWidth: innerW * 0.14, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    tableWidth: innerW,
  })

  const pages = doc.internal.getNumberOfPages()
  const pageH = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    doc.text(
      `Página ${i} de ${pages}`,
      doc.internal.pageSize.getWidth() - MARGIN,
      pageH - 8,
      { align: 'right' },
    )
  }

  return doc
}

export function lowStockReportFilename(date = new Date()) {
  return `estoque-baixo-${filenameDateStamp(date)}.pdf`
}

export function getLowStockReportPdfBlob(params) {
  const doc = buildLowStockReportPdfDoc(params)
  const filename = lowStockReportFilename()
  return { blob: doc.output('blob'), filename }
}

export function downloadLowStockReportPdf(params) {
  const doc = buildLowStockReportPdfDoc(params)
  doc.save(lowStockReportFilename())
}
