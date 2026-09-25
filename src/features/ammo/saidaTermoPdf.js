import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const TERM_PARAGRAPHS = [
  'Declaro, para os devidos fins, que recebi nesta data as munições indicadas na tabela abaixo, nas quantidades ali especificadas, estando ciente de que a conferência foi realizada no ato da retirada.',
  'Assumo total responsabilidade pela guarda, utilização e destino das munições, comprometendo-me a utilizá-las de acordo com as normas legais e regulamentações vigentes.',
  'Declaro ainda que estou ciente de que eventuais divergências ou irregularidades deverão ser comunicadas imediatamente no momento da retirada, não cabendo questionamentos posteriores quanto às quantidades recebidas.',
  'Por ser verdade, firmo o presente termo.',
]

const MARGIN = 14
const PAGE_W_MM = 210
const CENTER_X = PAGE_W_MM / 2
const PAGE_BOTTOM_MM = 282

const COMPANY_LINES = [
  'Local: Bento Gonçalves / RS -',
  'Pesca sem limites comercio de produtos LTDA',
  'CNPJ: 21.921.795/0001-40',
]

function formatBrazilianDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function filenameDateStamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * @param {{ quantity: number, caliber: string, product: string }[]} lines
 * @param {{ atDate?: Date }} [options]
 * @returns {import('jspdf').jsPDF}
 */
export function buildSaidaTermoPdfDoc(lines, options) {
  const atDate = options?.atDate ?? new Date()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const textWidth = PAGE_W_MM - 2 * MARGIN
  const lineHeightMm = 5

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Termo de retirada de munições', CENTER_X, 18, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  let y = 26

  function ensureSpace(linesNeeded) {
    if (y + linesNeeded * lineHeightMm > PAGE_BOTTOM_MM) {
      doc.addPage()
      y = 20
    }
  }

  function ensureSpaceMm(mmNeeded) {
    if (y + mmNeeded > PAGE_BOTTOM_MM) {
      doc.addPage()
      y = 20
    }
  }

  for (const paragraph of TERM_PARAGRAPHS) {
    const split = doc.splitTextToSize(paragraph, textWidth)
    ensureSpace(split.length + 2)
    doc.text(paragraph, MARGIN, y, {
      maxWidth: textWidth,
      align: 'justify',
    })
    y += split.length * lineHeightMm + 4
  }

  y += 6
  ensureSpace(28)
  const colQty = 28
  const colCal = 38
  const colProd = textWidth - colQty - colCal
  autoTable(doc, {
    startY: y,
    head: [['Quantidade', 'Produto', 'Calibre']],
    body: lines.map((l) => [
      String(l.quantity),
      l.product ?? '—',
      l.caliber ?? '—',
    ]),
    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: colQty, halign: 'center', valign: 'middle' },
      1: { cellWidth: colProd, halign: 'left', valign: 'middle' },
      2: { cellWidth: colCal, halign: 'left', valign: 'middle' },
    },
    didParseCell(data) {
      if (data.section === 'head') {
        const i = data.column.index
        if (i === 0) data.cell.styles.halign = 'center'
        if (i === 1 || i === 2) data.cell.styles.halign = 'left'
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  })

  y = doc.lastAutoTable.finalY + 10

  y += 4
  ensureSpace(COMPANY_LINES.length + 6)
  doc.setFont('helvetica', 'bold')
  for (const line of COMPANY_LINES) {
    doc.text(line, MARGIN, y)
    y += 6
  }

  const dateStr = formatBrazilianDate(atDate)
  doc.setFont('helvetica', 'normal')
  y += 12
  ensureSpaceMm(72)
  doc.text(`Data: ${dateStr}`, CENTER_X, y, { align: 'center' })
  y += 22
  ensureSpaceMm(48)
  doc.text('Assinatura', CENTER_X, y, { align: 'center' })
  y += 12
  doc.text(
    '________________________________________________________________________',
    CENTER_X,
    y,
    { align: 'center' },
  )
  y += 18

  return doc
}

/**
 * @param {{ quantity: number, caliber: string, product: string }[]} lines
 * @param {{ atDate?: Date }} [options]
 * @returns {{ blob: Blob, filename: string }}
 */
export function getSaidaTermoPdfBlob(lines, options) {
  const atDate = options?.atDate ?? new Date()
  const doc = buildSaidaTermoPdfDoc(lines, { atDate })
  return {
    blob: doc.output('blob'),
    filename: `termo-saida-municoes-${filenameDateStamp(atDate)}.pdf`,
  }
}

/**
 * @param {{ quantity: number, caliber: string, product: string }[]} lines
 * @param {{ atDate?: Date }} [options]
 */
export function downloadSaidaTermoPdf(lines, options) {
  const atDate = options?.atDate ?? new Date()
  const doc = buildSaidaTermoPdfDoc(lines, { atDate })
  doc.save(`termo-saida-municoes-${filenameDateStamp(atDate)}.pdf`)
}
