import { formatBrazilianDateLong } from './weaponEntregaHelpers.js'
import { formatMoneyBr } from './weaponVendaHelpers.js'

const MARGIN = 16
const PAGE_W = 210
const PAGE_BOTTOM = 281
const TEXT_W = PAGE_W - 2 * MARGIN
const BODY_SIZE = 9
const LINE_FACTOR = 1.12

function lineHeight(size) {
  return size * 0.3528 * LINE_FACTOR
}

function setFont(doc, style = 'normal') {
  const list = doc.getFontList?.() ?? {}
  const hasCalibri = Boolean(list.Calibri || list.calibri)
  if (hasCalibri) {
    doc.setFont('Calibri', style === 'bold' ? 'bold' : 'normal')
  } else {
    doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal')
  }
}

function filled(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '—') return ''
  return text
}

function boldPart(text) {
  return { t: text, b: true }
}

function contractBlocks(payload) {
  const weaponValue = Number(payload.weapon?.value)
  const hasWeaponValue = Number.isFinite(weaponValue)
  const fine = hasWeaponValue ? weaponValue * 0.1 : NaN
  const liquid = hasWeaponValue ? weaponValue * 0.9 : NaN
  const money = (value) =>
    Number.isFinite(value) ? formatMoneyBr(value) : 'R$ __________________________'
  const client = payload.client ?? {}
  const saleDate = String(payload.saleDate ?? '').trim()
  const hasSaleDate = /^\d{4}-\d{2}-\d{2}$/.test(saleDate)
  const longDate = hasSaleDate
    ? formatBrazilianDateLong(new Date(
        Number(saleDate.slice(0, 4)),
        Number(saleDate.slice(5, 7)) - 1,
        Number(saleDate.slice(8, 10)),
        12,
      )).replace(/\.$/, '')
    : '______ de __________________ de ________'
  const nameLine = filled(client.name)
    ? `Nome: ${filled(client.name)}`
    : 'Nome: __________________________________'
  const cpfLine = filled(client.cpf)
    ? `CPF: ${filled(client.cpf)}`
    : 'CPF: ___________________________________'

  const item = (text) => ({
    kind: 'p',
    text,
    bold: true,
    align: 'left',
    gapAfter: 0.6,
  })

  return [
    {
      kind: 'center',
      text: 'PESCA SEM LIMITES COMÉRCIO DE PRODUTOS NÁUTICOS',
      bold: true,
      size: 9,
      gapAfter: 0.4,
    },
    {
      kind: 'center',
      text: 'CNPJ: 21.921.795/0001-40 | CR: 153392',
      bold: true,
      size: 9,
      gapAfter: 1.2,
    },
    {
      kind: 'center',
      text: 'TERMO DE CIÊNCIA E CONDIÇÕES DE AQUISIÇÃO DE ARMA DE FOGO',
      bold: true,
      size: 9,
      gapAfter: 1.6,
    },
    { kind: 'heading', text: '1. DA CIÊNCIA SOBRE O PROCESSO' },
    {
      kind: 'p',
      text: 'O CLIENTE declara estar ciente de que a aquisição de arma de fogo depende do cumprimento dos requisitos legais e da aprovação do processo pelo órgão público competente, não sendo a VENDEDORA ou o DESPACHANTE responsável pela decisão administrativa.',
    },
    {
      kind: 'rich',
      parts: [
        'O CLIENTE reconhece que a contratação dos serviços de despachante, documentação e acompanhamento do processo ',
        boldPart('não representa garantia de deferimento'),
        ', constituindo prestação de serviços independente da decisão da autoridade competente.',
      ],
    },
    { kind: 'heading', text: '2. DA SOLICITAÇÃO DO ARMAMENTO' },
    {
      kind: 'p',
      text: 'O CLIENTE declara estar ciente de que, após a confirmação da compra, a VENDEDORA poderá solicitar, reservar ou adquirir o armamento junto ao fornecedor especificamente em razão de sua manifestação de compra, podendo comprometer recursos financeiros e estoque da empresa.',
    },
    {
      kind: 'p',
      text: 'O armamento permanecerá sob guarda da VENDEDORA até que estejam cumpridas todas as exigências e autorizações legais para sua entrega.',
    },
    { kind: 'heading', text: '3. EM CASO DE INDEFERIMENTO' },
    {
      kind: 'rich',
      parts: [
        'Caso o processo de aquisição seja ',
        boldPart('indeferido pelo órgão competente'),
        ', sem que exista erro ou falha comprovada da VENDEDORA ou do DESPACHANTE, o CLIENTE declara estar ciente de que o resultado administrativo não será de responsabilidade da empresa.',
      ],
    },
    {
      kind: 'rich',
      parts: [
        'Nesse caso, o CLIENTE terá direito à restituição do ',
        boldPart('valor referente à arma'),
        ', observadas as condições abaixo. Os valores referentes a serviços já efetivamente prestados, taxas, exames, documentos e demais despesas realizadas ou contratadas serão tratados conforme sua natureza e a legislação aplicável, não se confundindo com o valor do armamento.',
      ],
    },
    {
      kind: 'rich',
      parts: [
        'Considerando que a arma poderá já ter sido adquirida pela VENDEDORA junto ao fornecedor, o CLIENTE concorda que a restituição do valor da arma poderá ser realizada em ',
        boldPart('até 10 (dez) parcelas mensais'),
        ', conforme disponibilidade financeira da empresa, especialmente em razão da necessidade de revenda do armamento para recomposição do capital empregado.',
      ],
    },
    { kind: 'heading', text: '4. EM CASO DE DESISTÊNCIA DO CLIENTE' },
    {
      kind: 'rich',
      parts: [
        'Caso o CLIENTE desista voluntariamente da aquisição após a solicitação, reserva ou aquisição do armamento pela VENDEDORA, será aplicada, observada a legislação aplicável, ',
        boldPart('multa compensatória de 10% (dez por cento) sobre o valor original da arma'),
        ', em razão dos compromissos comerciais assumidos.',
      ],
    },
    {
      kind: 'rich',
      parts: [
        'O valor eventualmente devido ao CLIENTE poderá ser restituído em ',
        boldPart('até 10 (dez) parcelas mensais'),
        ', conforme disponibilidade financeira da VENDEDORA, ficando o pagamento condicionado à regularização comercial da operação e à possibilidade de revenda do armamento.',
      ],
    },
    {
      kind: 'p',
      text: `VALOR DA ARMA: ${money(weaponValue)}    10% DE MULTA: ${money(fine)}    VALOR LÍQUIDO: ${money(liquid)}`,
      bold: true,
      align: 'left',
      gapAfter: 1.4,
    },
    { kind: 'heading', text: '5. DECLARAÇÃO FINAL' },
    {
      kind: 'p',
      text: 'O CLIENTE declara que leu e compreendeu integralmente este termo, estando ciente de que:',
    },
    item('a) a VENDEDORA e o DESPACHANTE não podem garantir o deferimento do processo;'),
    item('b) a decisão de aquisição compete ao órgão público competente;'),
    item('c) a arma poderá ser solicitada/adquirida especificamente em razão desta negociação;'),
    item('d) em caso de indeferimento sem culpa da VENDEDORA/DESPACHANTE, a restituição do valor da arma observará as condições deste termo;'),
    item('e) em caso de desistência voluntária, poderá ser aplicada a multa de 10%, observada a legislação aplicável;'),
    item('f) a restituição poderá ocorrer em até 10 parcelas, em razão da necessidade de revenda do armamento;'),
    item('g) nenhuma disposição deste termo autoriza entrega ou transferência do armamento em desacordo com a legislação vigente.'),
    {
      kind: 'p',
      text: 'Por estar de acordo, o CLIENTE assina o presente termo juntamente com a VENDEDORA, declarando ter recebido e compreendido uma via deste documento.',
      gapAfter: 1.6,
    },
    {
      kind: 'p',
      text: `Bento Gonçalves/RS, ${longDate}.`,
      bold: true,
      align: 'left',
      gapAfter: 4,
    },
    {
      kind: 'sign',
      lines: [
        'PESCA SEM LIMITES COMÉRCIO DE PRODUTOS NÁUTICOS',
        'CNPJ: 21.921.795/0001-40 | CR: 153392',
        'VENDEDORA / REPRESENTANTE',
      ],
      boldLines: [true, false, true],
    },
    {
      kind: 'sign',
      lines: ['CLIENTE', nameLine, cpfLine],
      boldLines: [true, false, false],
    },
  ]
}

function drawJustifiedLine(doc, line, x, y, maxWidth) {
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) {
    doc.text(words[0] ?? '', x, y)
    return
  }
  const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0)
  const extra = maxWidth - wordsWidth
  const natural = doc.getTextWidth(line.trim())
  if (extra <= 0.4 || natural < maxWidth * 0.72) {
    doc.text(line.trim(), x, y)
    return
  }
  const gap = extra / (words.length - 1)
  let cursor = x
  for (const word of words) {
    doc.text(word, cursor, y)
    cursor += doc.getTextWidth(word) + gap
  }
}

function createFlow(doc) {
  const state = { doc, y: MARGIN, contractPage: 0 }

  function continuationHeader() {
    setFont(doc, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80)
    doc.text('Termo de ciência — continuação', MARGIN, state.y)
    doc.setTextColor(0)
    state.y += 6
  }

  function nextPage() {
    doc.addPage()
    state.contractPage += 1
    state.y = MARGIN
    if (state.contractPage > 1) continuationHeader()
  }

  function ensure(height) {
    if (state.y + height > PAGE_BOTTOM) nextPage()
  }

  nextPage()
  return { state, ensure, nextPage }
}

function writeParagraph(flow, text, opts = {}) {
  const {
    bold = false,
    align = 'justify',
    size = BODY_SIZE,
    gapAfter = 2.1,
    indent = 0,
  } = opts
  const { state } = flow
  const doc = state.doc
  setFont(doc, bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(0)
  const maxW = TEXT_W - indent
  const lh = lineHeight(size)
  const lines = doc.splitTextToSize(String(text ?? ''), maxW)
  for (let i = 0; i < lines.length; i += 1) {
    flow.ensure(lh)
    const x = MARGIN + indent
    const isLast = i === lines.length - 1
    if (align === 'center') {
      doc.text(lines[i], PAGE_W / 2, state.y, { align: 'center' })
    } else if (align === 'justify' && !isLast) {
      drawJustifiedLine(doc, lines[i], x, state.y, maxW)
    } else {
      doc.text(lines[i], x, state.y)
    }
    state.y += lh
  }
  state.y += gapAfter
}

function writeField(flow, label, value) {
  const text = filled(value) ? `${label}: ${filled(value)}` : ''
  if (text) {
    writeParagraph(flow, text, { align: 'left', gapAfter: 1.15 })
    return
  }
  const { state } = flow
  const doc = state.doc
  const lh = lineHeight(BODY_SIZE)
  flow.ensure(lh)
  setFont(doc, 'normal')
  doc.setFontSize(BODY_SIZE)
  doc.setTextColor(0)
  const prefix = `${label}: `
  doc.text(prefix, MARGIN, state.y)
  const prefixW = doc.getTextWidth(prefix)
  doc.setDrawColor(40)
  doc.setLineWidth(0.25)
  doc.line(MARGIN + prefixW, state.y + 0.8, MARGIN + TEXT_W, state.y + 0.8)
  state.y += lh + 1.15
}

function writePair(flow, leftLabel, leftValue, rightLabel, rightValue) {
  const { state } = flow
  const doc = state.doc
  const gap = 6
  const colW = (TEXT_W - gap) / 2
  const lh = lineHeight(BODY_SIZE)
  setFont(doc, 'normal')
  doc.setFontSize(BODY_SIZE)
  doc.setTextColor(0)

  const leftText = filled(leftValue) ? `${leftLabel}: ${filled(leftValue)}` : `${leftLabel}:`
  const rightText = filled(rightValue) ? `${rightLabel}: ${filled(rightValue)}` : `${rightLabel}:`
  const leftLines = doc.splitTextToSize(leftText, colW - (filled(leftValue) ? 0 : 2))
  const rightLines = doc.splitTextToSize(rightText, colW - (filled(rightValue) ? 0 : 2))
  const rows = Math.max(leftLines.length, rightLines.length)
  flow.ensure(rows * lh)

  const top = state.y
  for (let i = 0; i < leftLines.length; i += 1) {
    doc.text(leftLines[i], MARGIN, top + i * lh)
  }
  for (let i = 0; i < rightLines.length; i += 1) {
    doc.text(rightLines[i], MARGIN + colW + gap, top + i * lh)
  }
  doc.setDrawColor(40)
  doc.setLineWidth(0.25)
  if (!filled(leftValue)) {
    const prefixW = doc.getTextWidth(`${leftLabel}: `)
    const yLine = top + (leftLines.length - 1) * lh + 0.8
    doc.line(MARGIN + prefixW, yLine, MARGIN + colW, yLine)
  }
  if (!filled(rightValue)) {
    const prefixW = doc.getTextWidth(`${rightLabel}: `)
    const x = MARGIN + colW + gap
    const yLine = top + (rightLines.length - 1) * lh + 0.8
    doc.line(x + prefixW, yLine, x + colW, yLine)
  }
  state.y = top + rows * lh + 1.15
}

function writeRich(flow, parts, opts = {}) {
  const {
    size = BODY_SIZE,
    gapAfter = 1.1,
    align = 'justify',
  } = opts
  const { state } = flow
  const doc = state.doc
  const tokens = []
  for (const part of parts) {
    const text = typeof part === 'string' ? part : part.t
    const bold = typeof part === 'string' ? false : Boolean(part.b)
    for (const bit of String(text).split(/(\s+)/)) {
      if (!bit) continue
      if (/^\s+$/.test(bit)) tokens.push({ space: true, bold })
      else tokens.push({ text: bit, bold })
    }
  }

  function tokenWidth(token) {
    setFont(doc, token.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return doc.getTextWidth(token.space ? ' ' : token.text)
  }

  const lines = []
  let line = []
  let width = 0
  for (const token of tokens) {
    const next = tokenWidth(token)
    const hasWord = line.some((item) => !item.space)
    if (!token.space && hasWord && width + next > TEXT_W) {
      lines.push(line)
      line = []
      width = 0
    }
    if (token.space && line.length === 0) continue
    line.push(token)
    width += next
  }
  if (line.length) lines.push(line)

  const lh = lineHeight(size)
  for (let i = 0; i < lines.length; i += 1) {
    flow.ensure(lh)
    const row = lines[i]
    const contentW = row.reduce((sum, token) => sum + tokenWidth(token), 0)
    const spaces = row.filter((token) => token.space)
    const justify = align === 'justify' && i < lines.length - 1 && spaces.length > 0
    const extra = justify ? Math.max(0, TEXT_W - contentW) / spaces.length : 0
    let x = MARGIN
    doc.setTextColor(0)
    for (const token of row) {
      setFont(doc, token.bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      const piece = token.space ? ' ' : token.text
      doc.text(piece, x, state.y)
      x += doc.getTextWidth(piece) + (token.space ? extra : 0)
    }
    state.y += lh
  }
  state.y += gapAfter
}

function writeSign(flow, lines, boldLines) {
  const { state } = flow
  const doc = state.doc
  const lh = lineHeight(BODY_SIZE)
  const blockH = 6 + lh * lines.length + 2
  flow.ensure(blockH)
  state.y += 2
  doc.setDrawColor(40)
  doc.setLineWidth(0.35)
  doc.line(MARGIN, state.y, MARGIN + 92, state.y)
  state.y += 5
  for (let i = 0; i < lines.length; i += 1) {
    const isBold = Array.isArray(boldLines) ? Boolean(boldLines[i]) : i === 0
    setFont(doc, isBold ? 'bold' : 'normal')
    doc.setFontSize(BODY_SIZE)
    doc.setTextColor(0)
    const wrapped = doc.splitTextToSize(lines[i], TEXT_W)
    for (const row of wrapped) {
      flow.ensure(lh)
      doc.text(row, MARGIN, state.y)
      state.y += lh
    }
  }
  state.y += 3
}

/**
 * Contracapa do documento de venda. O texto segue em páginas A4 seguintes,
 * justificado, sem redução de corpo para caber numa folha só.
 * @param {import('jspdf').jsPDF} doc
 * @param {object} payload
 */
export function appendWeaponVendaContract(doc, payload) {
  const flow = createFlow(doc)
  for (const block of contractBlocks(payload)) {
    if (block.kind === 'center') {
      writeParagraph(flow, block.text, {
        bold: Boolean(block.bold),
        align: 'center',
        size: block.size ?? BODY_SIZE,
        gapAfter: block.gapAfter ?? 1.2,
      })
    } else if (block.kind === 'heading') {
      const lh = lineHeight(BODY_SIZE)
      if (flow.state.y + lh * 3 > PAGE_BOTTOM) flow.nextPage()
      else flow.state.y += 1.3
      writeParagraph(flow, block.text, {
        bold: true,
        align: 'left',
        gapAfter: 0.7,
      })
    } else if (block.kind === 'field') {
      writeField(flow, block.label, block.value)
    } else if (block.kind === 'pair') {
      writePair(
        flow,
        block.leftLabel,
        block.leftValue,
        block.rightLabel,
        block.rightValue,
      )
    } else if (block.kind === 'rich') {
      writeRich(flow, block.parts, block)
    } else if (block.kind === 'sign') {
      writeSign(flow, block.lines, block.boldLines)
    } else {
      writeParagraph(flow, block.text, {
        bold: Boolean(block.bold),
        align: block.align ?? 'justify',
        gapAfter: block.gapAfter ?? 1.1,
        indent: block.indent ?? 0,
      })
    }
  }
}

