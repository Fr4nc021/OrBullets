import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const MARGIN = 12

/** Cabeçalhos curtos para caber bem em A4 retrato */
const TABLE_HEAD = [
  [
    'Produto',
    'Início',
    'Entradas',
    'Saídas',
    'Saldo fim',
    'Atual',
  ],
]

function formatIsoDatePt(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const parts = iso.trim().split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

function filenameDateStamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pageInnerWidth(doc) {
  return doc.internal.pageSize.getWidth() - 2 * MARGIN
}

function pageHeight(doc) {
  return doc.internal.pageSize.getHeight()
}

function applyColumnWidths(innerW) {
  return {
    0: { cellWidth: innerW * 0.26, halign: 'left' },
    1: { cellWidth: innerW * 0.12, halign: 'right' },
    2: { cellWidth: innerW * 0.14, halign: 'right' },
    3: { cellWidth: innerW * 0.14, halign: 'right' },
    4: { cellWidth: innerW * 0.17, halign: 'right' },
    5: { cellWidth: innerW * 0.17, halign: 'right' },
  }
}

function tableStylesBase(fontSize) {
  return {
    fontSize,
    cellPadding: 1.6,
    valign: 'middle',
    lineColor: [100, 100, 100],
    lineWidth: 0.1,
    overflow: 'linebreak',
  }
}

/**
 * @param {object} p
 * @param {{ groups: Array, grandTotals: object }} p.reportData — `computeStockReportHierarchy`
 * @param {string} p.periodFrom
 * @param {string} p.periodTo
 * @param {string} [p.filterDescription]
 * @returns {import('jspdf').jsPDF}
 */
export function buildStockReportHierarchyPdfDoc({
  reportData,
  periodFrom,
  periodTo,
  filterDescription = '',
}) {
  const { groups, grandTotals } = reportData
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const innerW = pageInnerWidth(doc)
  const hPage = pageHeight(doc)
  let y = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Relatório de estoque', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Tipo → calibre → produto', MARGIN, y)
  y += 4
  doc.text(
    `Período: ${formatIsoDatePt(periodFrom)} a ${formatIsoDatePt(periodTo)}`,
    MARGIN,
    y,
  )
  y += 4

  const filterLine =
    filterDescription && String(filterDescription).trim()
      ? `Filtro: ${String(filterDescription).trim()}`
      : 'Filtro: todos os tipos e calibres'
  doc.text(filterLine, MARGIN, y)
  y += 4

  const now = new Date()
  doc.text(
    `Gerado em ${now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    MARGIN,
    y,
  )
  y += 7

  const emptyBody = [
    [
      'Nenhum dado para o período e filtros.',
      '—',
      '—',
      '—',
      '—',
      '—',
    ],
  ]

  if (!groups?.length) {
    autoTable(doc, {
      startY: y,
      head: TABLE_HEAD,
      body: emptyBody,
      theme: 'grid',
      styles: tableStylesBase(8),
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
      },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: innerW,
      columnStyles: applyColumnWidths(innerW),
    })
    return doc
  }

  let startY = y
  const minBottom = 18

  for (let gi = 0; gi < groups.length; gi += 1) {
    const g = groups[gi]
    if (gi > 0) startY += 2

    if (startY > hPage - minBottom) {
      doc.addPage()
      startY = MARGIN + 4
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(String(g.typeLabel ?? '').toUpperCase(), MARGIN, startY)
    doc.setTextColor(0, 0, 0)
    startY += 5.5

    g.caliberGroups.forEach((cg, ci) => {
      if (startY > hPage - minBottom) {
        doc.addPage()
        startY = MARGIN + 4
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(0, 0, 0)
      const calLabel = String(cg.caliberName ?? '—')
      const calLines = doc.splitTextToSize(calLabel, innerW - 2)
      const calLineH = doc.getLineHeight() / doc.internal.scaleFactor
      doc.text(calLines, MARGIN + 1, startY)
      doc.setTextColor(0, 0, 0)
      startY += calLines.length * calLineH + 1.5

      const body = cg.products.map((r) => [
        r.nome,
        String(r.startStock),
        String(r.periodEntrada),
        String(r.periodSaida),
        String(r.computedEnd),
        String(r.currentStock),
      ])

      const foot = [
        [
          `Subtotal ${cg.caliberName}`,
          String(cg.totals.startStock),
          String(cg.totals.periodEntrada),
          String(cg.totals.periodSaida),
          String(cg.totals.computedEnd),
          String(cg.totals.currentStock),
        ],
      ]

      const showHead = ci === 0

      autoTable(doc, {
        startY,
        head: showHead ? TABLE_HEAD : [],
        body,
        foot,
        theme: 'grid',
        styles: tableStylesBase(7.5),
        headStyles: {
          fillColor: [238, 242, 246],
          textColor: [20, 20, 20],
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        footStyles: {
          fillColor: [248, 250, 252],
          textColor: [30, 30, 30],
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        columnStyles: applyColumnWidths(innerW),
        margin: { left: MARGIN, right: MARGIN },
        tableWidth: innerW,
        showFoot: 'lastPage',
      })

      // Espaço após a tabela: doc.text usa baseline; precisa folga para não sobrepor o rótulo seguinte ao rodapé.
      startY = doc.lastAutoTable.finalY + 6
    })

    if (startY > hPage - minBottom) {
      doc.addPage()
      startY = MARGIN + 4
    }

    autoTable(doc, {
      startY,
      body: [
        [
          `Total ${g.typeLabel}`,
          String(g.typeTotals.startStock),
          String(g.typeTotals.periodEntrada),
          String(g.typeTotals.periodSaida),
          String(g.typeTotals.computedEnd),
          String(g.typeTotals.currentStock),
        ],
      ],
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        fontStyle: 'bold',
        fillColor: [230, 236, 245],
        textColor: [20, 20, 20],
      },
      columnStyles: applyColumnWidths(innerW),
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: innerW,
    })
    startY = doc.lastAutoTable.finalY + 3
  }

  if (startY > hPage - minBottom) {
    doc.addPage()
    startY = MARGIN + 4
  }

  autoTable(doc, {
    startY,
    body: [
      [
        'TOTAL GERAL',
        String(grandTotals.startStock),
        String(grandTotals.periodEntrada),
        String(grandTotals.periodSaida),
        String(grandTotals.computedEnd),
        String(grandTotals.currentStock),
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      fontStyle: 'bold',
      fillColor: [220, 228, 240],
      textColor: [20, 20, 20],
    },
    columnStyles: applyColumnWidths(innerW),
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
  })

  return doc
}

/**
 * @param {object} p
 * @param {{ groups: Array, grandTotals: object }} p.reportData
 * @param {string} p.periodFrom
 * @param {string} p.periodTo
 * @param {string} [p.filterDescription]
 */
export function downloadStockReportHierarchyPdf(params) {
  const doc = buildStockReportHierarchyPdfDoc(params)
  const now = new Date()
  doc.save(`relatorio-estoque-${filenameDateStamp(now)}.pdf`)
}

/**
 * @param {object} p — mesmo que `downloadStockReportHierarchyPdf`
 * @param {string} [filename] — nome do ficheiro sugerido (ex.: mapa mensal)
 * @returns {{ blob: Blob, filename: string }}
 */
export function getStockReportHierarchyPdfBlob(params, filename) {
  const doc = buildStockReportHierarchyPdfDoc(params)
  const fn =
    filename ?? `relatorio-estoque-${filenameDateStamp(new Date())}.pdf`
  const blob = doc.output('blob')
  return { blob, filename: fn }
}
