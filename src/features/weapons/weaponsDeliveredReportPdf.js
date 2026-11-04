import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const MARGIN = 10

const HEAD = [
  [
    'Data entrega',
    'Recebedor',
    'CPF',
    'RG',
    'SINARM/SIGMA',
    'Tipo',
    'Marca',
    'Modelo',
    'Calibre',
    'Nº série',
  ],
]

function formatIsoDatePt(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const parts = iso.trim().split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

function rowToBody(r) {
  const t = r.termo
  return [
    r.withdrawalDate ?? '—',
    r.owner,
    t?.cpf || '—',
    t?.rg || '—',
    t?.sigmaSinarm || '—',
    r.type,
    r.brand,
    r.model,
    r.caliber,
    r.serial,
  ]
}

/**
 * PDF só com as armas entregues (retiradas) no período, com dados do termo de entrega.
 * @param {{ soldRows: Array, periodFrom: string, periodTo: string }} p
 */
export function buildWeaponsDeliveredReportPdfDoc({ soldRows, periodFrom, periodTo }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const innerW = doc.internal.pageSize.getWidth() - 2 * MARGIN
  let y = 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Relatório de armas entregues', MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(
    `Período: ${formatIsoDatePt(periodFrom)} a ${formatIsoDatePt(periodTo)}`,
    MARGIN,
    y,
  )
  y += 4
  const rows = [...(soldRows ?? [])].sort(
    (a, b) => (a.withdrawalMs ?? 0) - (b.withdrawalMs ?? 0),
  )
  doc.text(`Total de armas entregues: ${rows.length}`, MARGIN, y)
  y += 4
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    MARGIN,
    y,
  )
  y += 6

  const pct = [0.08, 0.15, 0.1, 0.08, 0.11, 0.09, 0.09, 0.12, 0.07, 0.11]
  const columnStyles = Object.fromEntries(
    pct.map((p, i) => [i, { cellWidth: innerW * p, halign: 'left' }]),
  )

  autoTable(doc, {
    startY: y,
    head: HEAD,
    body:
      rows.length > 0
        ? rows.map(rowToBody)
        : [['Nenhuma arma entregue no período.', '', '', '', '', '', '', '', '', '']],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.4,
      valign: 'middle',
      lineColor: [100, 100, 100],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [238, 242, 246],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
  })

  return doc
}

export function downloadWeaponsDeliveredReportPdf(params) {
  const doc = buildWeaponsDeliveredReportPdfDoc(params)
  const from = params.periodFrom ?? ''
  const to = params.periodTo ?? ''
  doc.save(`armas-entregues-${from}_a_${to}.pdf`)
}
