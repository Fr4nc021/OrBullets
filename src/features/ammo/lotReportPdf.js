import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const MARGIN = 12

function filenameDateStamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * PDF do estoque por lote (resultado de `buildLotReport`).
 * @param {{ report: ReturnType<import('./lotReport.js').buildLotReport>, filterDescription?: string }} p
 */
export function downloadLotReportPdf({ report, filterDescription = '' }) {
  const now = new Date()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const innerW = doc.internal.pageSize.getWidth() - 2 * MARGIN
  let y = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Estoque por lote', MARGIN, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Gerado em ${now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` +
      (filterDescription ? ` · ${filterDescription}` : ''),
    MARGIN,
    y,
  )
  y += 5
  doc.text(
    `${report.productCount} produtos · ${report.lotCount} lotes · ${report.totalStock} unidades em estoque` +
      (report.totalSemLote > 0
        ? ` · ${report.totalSemLote} ainda sem lote em ${report.pendingProducts} produtos`
        : ''),
    MARGIN,
    y,
  )
  y += 4

  for (const group of report.groups) {
    for (const cal of group.calibers) {
      const body = []
      for (const p of cal.products) {
        const lots = p.lots.length ? p.lots : [{ lot_number: null, stock: 0 }]
        lots.forEach((l, i) => {
          const row = []
          if (i === 0) {
            row.push({ content: p.ammo_name, rowSpan: lots.length })
          }
          row.push(l.lot_number ?? 'Sem lote', String(l.stock))
          if (i === 0) {
            row.push({ content: String(p.stock), rowSpan: lots.length })
          }
          body.push(row)
        })
      }
      autoTable(doc, {
        startY: y + 4,
        head: [
          [{ content: `${group.typeLabel} — ${cal.caliber}`, colSpan: 4 }],
          ['Produto', 'Lote', 'Qtd. no lote', 'Total do produto'],
        ],
        body,
        styles: {
          fontSize: 8.5,
          cellPadding: 1.6,
          valign: 'middle',
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          overflow: 'linebreak',
        },
        headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: innerW * 0.5 },
          1: { cellWidth: innerW * 0.2 },
          2: { cellWidth: innerW * 0.14, halign: 'right' },
          3: { cellWidth: innerW * 0.16, halign: 'right' },
        },
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === 1 && data.cell.raw === 'Sem lote') {
            data.cell.styles.textColor = [180, 90, 0]
            data.cell.styles.fontStyle = 'bold'
          }
        },
        margin: { left: MARGIN, right: MARGIN },
      })
      y = doc.lastAutoTable.finalY
    }
  }

  doc.save(`estoque-por-lote-${filenameDateStamp(now)}.pdf`)
}
