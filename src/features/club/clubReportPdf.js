import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const MARGIN = 12

const KIND_LABEL = {
  polvora: 'Pólvora',
  espoleta: 'Espoleta',
  ponta: 'Ponta',
  municao: 'Munição pronta',
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

function formatIsoDatePtFromApi(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const datePart = iso.split('T')[0]
  const parts = datePart.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

function periodLine(period) {
  if (!period) return 'Período: —'
  if (period.entire_history) return 'Período: histórico completo'
  const a = period.from ? formatIsoDatePtFromApi(period.from) : '—'
  const b = period.to ? formatIsoDatePtFromApi(period.to) : '—'
  return `Período: ${a} a ${b}`
}

function fmtQty(kind, n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  if (kind === 'polvora') {
    return x.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }
  return String(Math.round(x))
}

function tableStylesBase(fontSize) {
  return {
    fontSize,
    cellPadding: 1.5,
    valign: 'middle',
    lineColor: [100, 100, 100],
    lineWidth: 0.1,
    overflow: 'linebreak',
  }
}

function nextY(doc, y, _hPage, minGap = 10) {
  const last = doc.lastAutoTable
  const fy = last && typeof last.finalY === 'number' ? last.finalY : null
  if (fy != null && Number.isFinite(fy)) {
    return fy + minGap
  }
  return y + minGap
}

function sectionTitle(doc, text, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(25, 35, 55)
  doc.text(text, MARGIN, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  return y + 5
}

/**
 * @param {object} reportData — resposta de GET /api/club/report/summary
 * @returns {import('jspdf').jsPDF}
 */
export function buildClubReportPdfDoc(reportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const innerW = pageInnerWidth(doc)
  const hPage = pageHeight(doc)
  let y = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Relatório do clube', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Produção, saídas de insumo e estoque atual', MARGIN, y)
  y += 4
  doc.text(periodLine(reportData?.period), MARGIN, y)
  y += 4

  const now = new Date()
  doc.text(
    `Gerado em ${now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    MARGIN,
    y,
  )
  y += 8

  const prod = reportData?.producao
  const total = Math.round(prod?.municoes_total ?? 0)
  y = sectionTitle(doc, 'Produção no período', y)
  doc.setFontSize(9)
  doc.text(`Total: ${total} munições`, MARGIN, y)
  y += 5

  const porCal = prod?.por_calibre ?? []
  const bodyProd =
    porCal.length > 0
      ? porCal.map((r) => [String(r.caliber_name ?? '—'), String(Math.round(r.municoes ?? 0))])
      : [['Nenhum lote no período', '—']]

  autoTable(doc, {
    startY: y,
    head: [['Calibre', 'Munições']],
    body: bodyProd,
    theme: 'grid',
    styles: tableStylesBase(8.5),
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
    columnStyles: {
      0: { cellWidth: innerW * 0.62, halign: 'left' },
      1: { cellWidth: innerW * 0.38, halign: 'right' },
    },
  })
  y = nextY(doc, y, hPage, 8)

  if (y > hPage - 40) {
    doc.addPage()
    y = MARGIN + 4
  }

  y = sectionTitle(doc, 'Saídas de insumo no período', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.setTextColor(60, 60, 60)
  doc.text(
    'Em produção = consumo dos lotes; Manual = saídas lançadas à mão.',
    MARGIN,
    y,
    { maxWidth: innerW },
  )
  doc.setTextColor(0, 0, 0)
  y += 6

  const ins = reportData?.insumos_saidas_no_periodo ?? []
  const bodyIns =
    ins.length > 0
      ? ins.map((r) => [
          KIND_LABEL[r.kind] ?? r.kind,
          String(r.name ?? '—'),
          fmtQty(r.kind, r.total_saida),
          fmtQty(r.kind, r.saida_em_producao),
          fmtQty(r.kind, r.saida_manual),
        ])
      : [['—', 'Nenhuma saída de insumo no período', '—', '—', '—']]

  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Item', 'Total saída', 'Em produção', 'Manual']],
    body: bodyIns,
    theme: 'grid',
    styles: tableStylesBase(7.8),
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
    columnStyles: {
      0: { cellWidth: innerW * 0.16, halign: 'left' },
      1: { cellWidth: innerW * 0.34, halign: 'left' },
      2: { cellWidth: innerW * 0.17, halign: 'right' },
      3: { cellWidth: innerW * 0.17, halign: 'right' },
      4: { cellWidth: innerW * 0.16, halign: 'right' },
    },
  })
  y = nextY(doc, y, hPage, 8)

  if (y > hPage - 35) {
    doc.addPage()
    y = MARGIN + 4
  }

  const mun = reportData?.municao_no_periodo ?? {}
  y = sectionTitle(doc, 'Munição pronta (movimentos no período)', y)
  doc.setFontSize(9)
  doc.text(
    `Entrada por produção: ${Math.round(mun.entrada_por_producao ?? 0)}`,
    MARGIN,
    y,
  )
  y += 4
  doc.text(`Saída (distribuição / uso): ${Math.round(mun.saida_distribuicao ?? 0)}`, MARGIN, y)
  y += 8

  if (y > hPage - 35) {
    doc.addPage()
    y = MARGIN + 4
  }

  y = sectionTitle(doc, 'Estoque atual', y)
  y += 1

  const est = reportData?.estoque_atual ?? []
  const bodyEst =
    est.length > 0
      ? est.map((row) => [
          KIND_LABEL[row.kind] ?? row.kind,
          String(row.name ?? '—'),
          fmtQty(row.kind, row.stock),
        ])
      : [['—', 'Sem itens', '—']]

  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Nome', 'Saldo']],
    body: bodyEst,
    theme: 'grid',
    styles: tableStylesBase(8.5),
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: innerW,
    columnStyles: {
      0: { cellWidth: innerW * 0.22, halign: 'left' },
      1: { cellWidth: innerW * 0.53, halign: 'left' },
      2: { cellWidth: innerW * 0.25, halign: 'right' },
    },
  })

  return doc
}

/**
 * @param {object} reportData
 */
export function downloadClubReportPdf(reportData) {
  const doc = buildClubReportPdfDoc(reportData)
  doc.save(`relatorio-clube-${filenameDateStamp(new Date())}.pdf`)
}
