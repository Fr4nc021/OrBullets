import { jsPDF } from 'jspdf'
import logoPescaUrl from '../../assets/logo-pesca-sem-limites.png'
import calibriRegularUrl from '../../assets/fonts/Calibri.ttf?url'
import calibriBoldUrl from '../../assets/fonts/Calibri-Bold.ttf?url'
import { filenameDateStamp } from '../ammo/saidaTermoPdf.js'
import { formatDateBrShort, formatMoneyBr } from './weaponVendaHelpers.js'
import { appendWeaponVendaContract } from './weaponVendaContratoPdf.js'

const PAGE_W_MM = 210
const CENTER_X = PAGE_W_MM / 2
const TWIP_MM = 25.4 / 1440

/** Medidas do Word (VENDA DE ARMAS.docx), em mm. */
const TOP_MARGIN = 1417 * TWIP_MM
const CLIENT_W = 10060 * TWIP_MM
const CLIENT_X = (PAGE_W_MM - CLIENT_W) / 2
const GRID_X = 1701 * TWIP_MM - 811 * TWIP_MM
const GRID_W = 10257 * TWIP_MM
const COL_L = 6022 * TWIP_MM
const COL_R = 4235 * TWIP_MM
const PAD_X = 108 * TWIP_MM
const BODY = 16
const TITLE = 20
const LINE = BODY * 0.3528 * 1.15
const ROW_H = 7.4
const BORDER_W = 0.18
const LOGO_MAX_W_MM = 68.8
const LOGO_MAX_H_MM = 11.9
const CPF_X = CLIENT_X + CLIENT_W * 0.58
const BAIRRO_X = CLIENT_X + CLIENT_W * 0.34

/** @type {Promise<{ dataUrl: string, width: number, height: number }> | null} */
let logoCachePromise = null
/** @type {Promise<{ regular: string, bold: string }> | null} */
let fontCachePromise = null

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadCalibriFonts() {
  if (!fontCachePromise) {
    fontCachePromise = (async () => {
      const [regRes, boldRes] = await Promise.all([
        fetch(calibriRegularUrl),
        fetch(calibriBoldUrl),
      ])
      if (!regRes.ok || !boldRes.ok) {
        throw new Error('Não foi possível carregar a fonte Calibri.')
      }
      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ])
      return {
        regular: arrayBufferToBase64(regBuf),
        bold: arrayBufferToBase64(boldBuf),
      }
    })()
  }
  return fontCachePromise
}

/** @type {boolean} */
let calibriReady = false

/**
 * @param {import('jspdf').jsPDF} doc
 */
async function registerCalibri(doc) {
  try {
    const fonts = await loadCalibriFonts()
    doc.addFileToVFS('Calibri.ttf', fonts.regular)
    doc.addFileToVFS('Calibri-Bold.ttf', fonts.bold)
    doc.addFont('Calibri.ttf', 'Calibri', 'normal')
    doc.addFont('Calibri-Bold.ttf', 'Calibri', 'bold')
    calibriReady = true
    return true
  } catch {
    calibriReady = false
    return false
  }
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {'normal' | 'bold'} style
 */
function setFont(doc, style = 'normal') {
  if (calibriReady) {
    doc.setFont('Calibri', style === 'bold' ? 'bold' : 'normal')
  } else {
    doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal')
  }
}

function loadLogoForPdf() {
  if (!logoCachePromise) {
    logoCachePromise = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas não disponível para o logo.'))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }
      img.onerror = () => reject(new Error('Falha ao carregar o logo.'))
      img.src = logoPescaUrl
    })
  }
  return logoCachePromise
}

function fitLogoSizeMm(naturalW, naturalH) {
  const ratio = naturalW / naturalH
  let w = LOGO_MAX_W_MM
  let h = w / ratio
  if (h > LOGO_MAX_H_MM) {
    h = LOGO_MAX_H_MM
    w = h * ratio
  }
  return { w, h }
}

function shown(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '—') return ''
  return text
}

function setBody(doc, bold = false) {
  doc.setFontSize(BODY)
  setFont(doc, bold ? 'bold' : 'normal')
  doc.setTextColor(0)
}

function textBaseline(y, h) {
  return y + h / 2 + BODY * 0.3528 * 0.28
}

function wrappedLines(doc, text, maxW) {
  setBody(doc, false)
  const raw = String(text ?? '')
  if (!raw.trim()) return ['']
  return doc.splitTextToSize(raw, Math.max(8, maxW))
}

function linesHeight(lines) {
  const count = Math.max(1, lines.filter((line) => String(line).trim()).length || 1)
  if (count <= 1) return ROW_H
  return Math.max(ROW_H, count * LINE + 1.15)
}

function drawLines(doc, lines, x, y, h, opts = {}) {
  setBody(doc, Boolean(opts.bold))
  const visible = lines.filter((line) => String(line).trim())
  const count = Math.max(1, visible.length)
  let baseline = textBaseline(y, h)
  if (count > 1) {
    const block = count * LINE
    baseline = y + (h - block) / 2 + LINE * 0.78
  }
  const draw = visible.length ? visible : []
  for (let i = 0; i < draw.length; i += 1) {
    if (opts.align === 'center') {
      doc.text(draw[i], x, baseline + i * LINE, { align: 'center' })
    } else {
      doc.text(draw[i], x, baseline + i * LINE)
    }
  }
}

function strokeGrid(doc, x, y, widths, heights, opts = {}) {
  const totalW = widths.reduce((sum, w) => sum + w, 0)
  const totalH = heights.reduce((sum, h) => sum + h, 0)
  const splitH = opts.spanLast
    ? heights.slice(0, -1).reduce((sum, h) => sum + h, 0)
    : totalH
  doc.setDrawColor(0)
  doc.setLineWidth(BORDER_W)
  doc.rect(x, y, totalW, totalH)
  let cursorX = x
  for (let i = 0; i < widths.length - 1; i += 1) {
    cursorX += widths[i]
    doc.line(cursorX, y, cursorX, y + splitH)
  }
  let cursorY = y
  for (let i = 0; i < heights.length - 1; i += 1) {
    cursorY += heights[i]
    doc.line(x, cursorY, x + totalW, cursorY)
  }
}

function labelValue(label, value) {
  const text = shown(value)
  return text ? `${label} ${text}` : label
}

/**
 * Papel de venda no mesmo arranjo do Word: logo, título, data,
 * tabela do cliente (uma coluna) e grade ARMA | DOCUMENTOS.
 * @param {import('jspdf').jsPDF} doc
 * @param {object} payload
 */
function drawVendaSheet(doc, payload) {
  const client = payload.client ?? {}
  const weapon = payload.weapon ?? {}
  const selected = new Set(payload.documents?.processes ?? [])
  const mark = (id) => (selected.has(id) ? 'Sim' : '')
  const docsValue =
    selected.size > 0 ? formatMoneyBr(payload.documents?.value) : ''
  const model = [shown(weapon.model), shown(weapon.caliber)].filter(Boolean).join(' / ')

  let y = TOP_MARGIN
  if (payload.logo) {
    const fit = fitLogoSizeMm(payload.logo.width, payload.logo.height)
    const logoX = CENTER_X - fit.w / 2
    doc.addImage(payload.logo.dataUrl, 'PNG', logoX, y, fit.w, fit.h)
    y += fit.h + 8
  }

  const title = 'VENDA DE ARMA E DOCUMENTOS'
  doc.setFontSize(TITLE)
  setFont(doc, 'bold')
  doc.setTextColor(0)
  doc.text(title, CENTER_X, y, { align: 'center' })
  const titleW = doc.getTextWidth(title)
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.line(CENTER_X - titleW / 2, y + 1.15, CENTER_X + titleW / 2, y + 1.15)
  y += 9.2

  const dateLabel = payload.saleDate ? formatDateBrShort(payload.saleDate) : ''
  setBody(doc, false)
  doc.text(`DATA: ${dateLabel}`, CLIENT_X + CLIENT_W - PAD_X, y, { align: 'right' })
  y += 5.6

  const clientRows = [
    { lines: wrappedLines(doc, labelValue('CLIENTE:', client.name), CLIENT_W - PAD_X * 2) },
    {
      left: labelValue('IDENTIDADE:', client.identity),
      right: labelValue('CPF:', client.cpf),
      rightX: CPF_X,
    },
    {
      left: 'E-MAIL:',
      right: labelValue('TELEFONE:', client.phone),
      rightX: CPF_X,
    },
    { lines: wrappedLines(doc, labelValue('ENDEREÇO:', client.address), CLIENT_W - PAD_X * 2) },
    {
      left: labelValue('Nº', client.number),
      right: labelValue('BAIRRO:', client.neighborhood),
      rightX: BAIRRO_X,
    },
    {
      left: labelValue('CIDADE:', client.city),
      right: labelValue('CEP:', client.cep),
      rightX: CPF_X,
    },
    { lines: [''] },
  ]

  const clientHeights = clientRows.map((row) => {
    if (row.lines) return linesHeight(row.lines)
    const leftLines = wrappedLines(doc, row.left, row.rightX - CLIENT_X - PAD_X * 2)
    const rightLines = wrappedLines(
      doc,
      row.right,
      CLIENT_X + CLIENT_W - row.rightX - PAD_X,
    )
    row.leftLines = leftLines
    row.rightLines = rightLines
    return Math.max(linesHeight(leftLines), linesHeight(rightLines))
  })

  strokeGrid(doc, CLIENT_X, y, [CLIENT_W], clientHeights)
  let rowY = y
  for (let i = 0; i < clientRows.length; i += 1) {
    const row = clientRows[i]
    const h = clientHeights[i]
    if (row.lines) {
      drawLines(doc, row.lines, CLIENT_X + PAD_X, rowY, h)
    } else {
      drawLines(doc, row.leftLines, CLIENT_X + PAD_X, rowY, h)
      drawLines(doc, row.rightLines, row.rightX, rowY, h)
    }
    rowY += h
  }
  y = rowY + 11.5

  setBody(doc, true)
  const headerBaseline = y
  doc.text('ARMA', GRID_X + COL_L / 2, headerBaseline, { align: 'center' })
  doc.text('DOCUMENTOS', GRID_X + COL_L + COL_R / 2, headerBaseline, { align: 'center' })
  y += 3.6

  const leftTexts = [
    labelValue('Produto:', weapon.type),
    labelValue('Marca:', weapon.brand),
    labelValue('Modelo:', model),
    labelValue('Nº de série:', weapon.serial),
    labelValue('Valor:', Number.isFinite(Number(weapon.value)) ? formatMoneyBr(weapon.value) : ''),
    labelValue('Forma de Pagamento:', weapon.paymentMethod),
    '',
  ]
  const rightTexts = [
    labelValue('Certificado Registro:', mark('certificado_registro')),
    labelValue('Autorização:', mark('autorizacao')),
    labelValue('Apostilamento:', mark('apostilamento')),
    labelValue('Guia de trafego:', mark('guia_trafego')),
    labelValue('Segundo Endereço:', mark('segundo_endereco')),
    labelValue('Valor documentos:', docsValue),
    labelValue('OBS:', payload.obs),
  ]

  const leftInner = COL_L - PAD_X * 2
  const rightInner = COL_R - PAD_X * 2
  const gridHeights = []
  const leftWrapped = []
  const rightWrapped = []
  for (let i = 0; i < leftTexts.length; i += 1) {
    const left = wrappedLines(doc, leftTexts[i], leftInner)
    const right = wrappedLines(doc, rightTexts[i], rightInner)
    leftWrapped.push(left)
    rightWrapped.push(right)
    gridHeights.push(Math.max(linesHeight(leftTexts[i] ? left : ['']), linesHeight(rightTexts[i] ? right : [''])))
  }
  const totalText = `VALOR TOTAL: ${formatMoneyBr(payload.total)}`
  const totalLines = wrappedLines(doc, totalText, GRID_W - PAD_X * 2)
  gridHeights.push(linesHeight(totalLines))

  strokeGrid(doc, GRID_X, y, [COL_L, COL_R], gridHeights, { spanLast: true })
  let gridY = y
  for (let i = 0; i < leftTexts.length; i += 1) {
    const h = gridHeights[i]
    if (leftTexts[i]) drawLines(doc, leftWrapped[i], GRID_X + PAD_X, gridY, h)
    if (rightTexts[i]) drawLines(doc, rightWrapped[i], GRID_X + COL_L + PAD_X, gridY, h)
    gridY += h
  }
  const totalH = gridHeights[gridHeights.length - 1]
  setBody(doc, true)
  drawLines(doc, totalLines, GRID_X + GRID_W / 2, gridY, totalH, { bold: true, align: 'center' })
  y = gridY + totalH

  // Quatro parágrafos vazios do Word (corpo 16 pt, espaçamento depois de 8 pt).
  y += 4 * (LINE + 2.82)
  setBody(doc, false)
  const seller = shown(payload.seller)
  doc.text(seller ? `VENDEDOR: ${seller}` : 'VENDEDOR:', CENTER_X, y, { align: 'center' })
}

/**
 * @param {object} payload
 * @returns {Promise<import('jspdf').jsPDF>}
 */
/** Pede frente e verso (virar na borda longa) ao abrir a impressão do PDF. */
function preferDuplexPrint(doc) {
  doc.internal.events.subscribe('putCatalog', function putDuplex() {
    this.internal.out('/ViewerPreferences << /Duplex /DuplexFlipLongEdge >>')
  })
}

export async function buildWeaponVendaPdfDoc(payload) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  preferDuplexPrint(doc)
  await registerCalibri(doc)
  drawVendaSheet(doc, payload)
  appendWeaponVendaContract(doc, payload)
  if (payload.testLayout) stampLayoutTestMark(doc)
  return doc
}

/** Marca discreta no rodapé para o papel impresso não ser confundido com uma venda. */
function stampLayoutTestMark(doc) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i)
    doc.setFontSize(8)
    setFont(doc, 'bold')
    doc.setTextColor(170, 45, 45)
    doc.text(
      'TESTE DE LAYOUT — documento fictício, não é uma venda',
      CENTER_X,
      292,
      { align: 'center' },
    )
    doc.setTextColor(0)
  }
}

/**
 * @param {Parameters<typeof buildWeaponVendaPdfDoc>[0]} payload
 */
export async function getWeaponVendaPdfBlob(payload) {
  const atDate = payload.atDate ?? new Date()
  let logo = null
  try {
    logo = await loadLogoForPdf()
  } catch {
    /* PDF sem logo */
  }
  try {
    const doc = await buildWeaponVendaPdfDoc({ ...payload, logo })
    return {
      blob: doc.output('blob'),
      filename: payload.testLayout
        ? `teste-layout-venda-contrato-${filenameDateStamp(atDate)}.pdf`
        : `venda-arma-${filenameDateStamp(atDate)}.pdf`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(msg || 'Erro ao montar o PDF de venda.')
  }
}

