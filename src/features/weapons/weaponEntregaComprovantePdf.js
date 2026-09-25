import { jsPDF } from 'jspdf'
import logoClubeUrl from '../../assets/Logo_Clube_de_Tiro (1) 1.png'
import { filenameDateStamp } from '../ammo/saidaTermoPdf.js'
import { formatBrazilianDateLong } from './weaponEntregaHelpers.js'
import { registerWeaponPdfFonts, setPdfFont } from './weaponPdfFonts.js'

const MARGIN = 14
const PAGE_W_MM = 210
const CENTER_X = PAGE_W_MM / 2
const PAGE_BOTTOM_MM = 282
const TEXT_W = PAGE_W_MM - 2.3 * MARGIN

const BODY_FONT_SIZE = 12
const ARMA_FONT_SIZE = 12
const PORTARIA_FONT_SIZE = 10

function lineHeightFor(fontSizePt) {
  return fontSizePt * 0.3528 * 1.5
}

/** Entrelinha ~1,5 para 12 pt */
const LINE_H = lineHeightFor(BODY_FONT_SIZE)
const ARMA_LINE_H = lineHeightFor(ARMA_FONT_SIZE)

const LOGO_MAX_W_MM = 62
const LOGO_MAX_H_MM = 30
/** Espaço entre logo e linha vertical */
const HEADER_LOGO_DIVIDER_GAP_MM = 3
/** Espaço entre linha vertical e bloco de contatos (como no modelo) */
const HEADER_DIVIDER_TEXT_GAP_MM = 4
const HEADER_CONTACT_FONT_SIZE = 8.5
const HEADER_BOTTOM_GAP_MM = 4

const HEADER_CONTACT = [
  '(054) 3701.3833 / (054) 99671.7871',
  'www.pescasemlimites.com.br',
  'comercial@pescasemlimites.com.br',
  'R. Planalto, 1227, Bento Gonçalves - RS cep:',
  '95703-114',
]

/** @type {Promise<{ dataUrl: string, width: number, height: number }> | null} */
let logoCachePromise = null

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
      img.src = logoClubeUrl
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

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {{ dataUrl: string, width: number, height: number } | null} logo
 * @returns {number} y após o cabeçalho
 */
function drawPdfHeader(doc, logo) {
  const headerTop = MARGIN
  let logoW = 0
  let logoH = 0

  if (logo) {
    const fit = fitLogoSizeMm(logo.width, logo.height)
    logoW = fit.w
    logoH = fit.h
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, headerTop, logoW, logoH)
  }

  const dividerX = logo
    ? MARGIN + logoW + HEADER_LOGO_DIVIDER_GAP_MM
    : MARGIN
  const contactX = dividerX + HEADER_DIVIDER_TEXT_GAP_MM
  const contactMaxW = PAGE_W_MM - MARGIN - contactX

  doc.setFontSize(HEADER_CONTACT_FONT_SIZE)
  setPdfFont(doc, 'normal')
  const contactLineH = HEADER_CONTACT_FONT_SIZE * 0.3528 * 1.35
  const contactBlockH = HEADER_CONTACT.length * contactLineH
  /** Topo do texto alinhado ao topo visual do logo (estrela), como no modelo */
  let contactY = headerTop + (logoH > contactBlockH ? 1.5 : 0)

  for (const line of HEADER_CONTACT) {
    doc.text(line, contactX, contactY, { maxWidth: contactMaxW, align: 'left' })
    contactY += contactLineH
  }

  const blockH = Math.max(logoH, contactY - headerTop)
  if (logo) {
    doc.setDrawColor(0)
    doc.setLineWidth(0.35)
    doc.line(dividerX, headerTop, dividerX, headerTop + blockH)
  }

  return headerTop + blockH + HEADER_BOTTOM_GAP_MM
}

const PARAGRAPH_1_TEMPLATE =
  'Eu {NOME} portador do RG nº {RG}, CPF {CPF}, declaro para devidos fins que recebi na data abaixo assinado, a arma abaixo descrita na empresa PESCA SEM LIMITES COMERCIO DE PRODUTOS NAUTICOS LTDA, sob CNPJ: 21.921.795/0001-40.'

const PARAGRAPH_2 =
  'DECLARO que tenho conhecimento e ciência sobre minhas obrigações legais, transporte, armazenamento, conduta, como CAC (caçador, atirador, colecionador) (SIGMA), tanto quanto minhas obrigações legais referentes à Pose e Porte de Arma via Polícia Federal (SINARM).'

const PORTARIA_TITLE = 'PORTARIA Nº 166 COLOG/C Ex, DE 22 DE DEZEMBRO DE 2023'

const PORTARIA_BODY =
  '" Art. 38. A Guia de Tráfego Especial (GTE) é o documento comprobatório do porte de trânsito, a que se refere o art. 81 do Decreto nº 10.030/2019 e o art. 33 do Decreto nº 11.615/2023, para colecionador, atirador desportivo e caçador excepcional.\n§1º A GTE autoriza o trânsito das armas de fogo registradas nos respectivos acervos, desmuniciadas e acompanhadas da munição acondicionada em recipiente próprio.\n§2º A GTE emitida para abate da fauna exótica invasora só terá validade quando acompanhada do documento comprobatório da necessidade de abate da fauna invasora, expedido pelo IBAMA, conforme o previsto no art. 39 do Decreto nº 11.615/2023 e nas condições nele estabelecidas."'

const DECRETO_LINE = 'Decreto nº 11.615, 21 de julho 2023.'

const CITY = 'BENTO GONÇALVES'

/**
 * @param {{
 *   recipient: { name: string, rg: string, cpf: string },
 *   weapon: { type: string, brand: string, model: string, caliber: string, serial: string, sigmaSinarm: string },
 *   atDate?: Date,
 *   logo?: { dataUrl: string, width: number, height: number } | null,
 * }} payload
 * @returns {Promise<import('jspdf').jsPDF>}
 */
export async function buildWeaponEntregaComprovantePdfDoc(payload) {
  const atDate = payload.atDate ?? new Date()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerWeaponPdfFonts(doc)

  let y = drawPdfHeader(doc, payload.logo ?? null)
  y += 4

  function ensureMm(mm) {
    if (y + mm > PAGE_BOTTOM_MM) {
      doc.addPage()
      y = MARGIN
      setPdfFont(doc, 'normal')
    }
  }

  function writeLines(lines, opts = {}) {
    const {
      fontSize = BODY_FONT_SIZE,
      bold = false,
      align = 'left',
      maxWidth = TEXT_W,
      lineHeight = LINE_H,
    } = opts
    doc.setFontSize(fontSize)
    setPdfFont(doc, bold ? 'bold' : 'normal')
    for (const line of lines) {
      const split = doc.splitTextToSize(line, maxWidth)
      ensureMm(split.length * lineHeight + 1)
      if (align === 'center') {
        for (const row of split) {
          doc.text(row, CENTER_X, y, { align: 'center' })
          y += lineHeight
        }
      } else {
        const textAlign = align === 'justify' ? 'justify' : 'left'
        doc.text(split, MARGIN, y, { maxWidth, align: textAlign })
        y += split.length * lineHeight + 1
      }
    }
  }

  ensureMm(12)
  doc.setFontSize(BODY_FONT_SIZE)
  setPdfFont(doc, 'bold')
  doc.text('COMPROVANTE DE ENTREGA DE ARMA DE FOGO', CENTER_X, y, {
    align: 'center',
  })
  y += LINE_H + 4

  const p1 = PARAGRAPH_1_TEMPLATE.replace('{NOME}', payload.recipient.name)
    .replace('{RG}', payload.recipient.rg)
    .replace('{CPF}', payload.recipient.cpf)

  writeLines([p1], { fontSize: BODY_FONT_SIZE, align: 'justify' })
  y += 2
  writeLines([PARAGRAPH_2], { fontSize: BODY_FONT_SIZE, align: 'justify' })
  y += 4

  const armaLines = [
    'ARMA',
    `Tipo / Espécie: ${payload.weapon.type}`,
    `Marca: ${payload.weapon.brand}`,
    `Modelo: ${payload.weapon.model}`,
    `Calibre: ${payload.weapon.caliber}`,
    `Nº de série: ${payload.weapon.serial}`,
    `Nº SINARM/SIGMA: ${payload.weapon.sigmaSinarm}`,
  ]

  doc.setFontSize(ARMA_FONT_SIZE)
  setPdfFont(doc, 'bold')
  for (let i = 0; i < armaLines.length; i += 1) {
    ensureMm(ARMA_LINE_H + 1)
    doc.text(armaLines[i], CENTER_X, y, { align: 'center' })
    y += ARMA_LINE_H + (i === 0 ? 2 : 0.5)
  }

  y += 6
  writeLines([PORTARIA_TITLE], {
    fontSize: PORTARIA_FONT_SIZE,
    bold: true,
    align: 'center',
    maxWidth: TEXT_W,
    lineHeight: lineHeightFor(PORTARIA_FONT_SIZE),
  })
  y += 1
  writeLines(PORTARIA_BODY.split('\n'), {
    fontSize: PORTARIA_FONT_SIZE,
    align: 'left',
    lineHeight: lineHeightFor(PORTARIA_FONT_SIZE),
  })
  y += 2
  writeLines([DECRETO_LINE], {
    fontSize: BODY_FONT_SIZE,
    bold: true,
    align: 'center',
  })

  y += 14
  ensureMm(36)
  setPdfFont(doc, 'normal')
  doc.setFontSize(BODY_FONT_SIZE)
  doc.text(
    '________________________________________________________________________',
    CENTER_X,
    y,
    { align: 'center' },
  )
  y += LINE_H + 2
  doc.text(payload.recipient.name.toUpperCase(), CENTER_X, y, { align: 'center' })
  y += LINE_H + 2
  const dateLine = `${CITY}, ${formatBrazilianDateLong(atDate)}`
  doc.text(dateLine, CENTER_X, y, { align: 'center' })

  return doc
}

/**
 * @param {Parameters<typeof buildWeaponEntregaComprovantePdfDoc>[0]} payload
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function getWeaponEntregaComprovantePdfBlob(payload) {
  const atDate = payload.atDate ?? new Date()
  let logo = null
  try {
    logo = await loadLogoForPdf()
  } catch {
    /* PDF sem logo se a imagem não carregar */
  }
  try {
    const doc = await buildWeaponEntregaComprovantePdfDoc({ ...payload, atDate, logo })
    return {
      blob: doc.output('blob'),
      filename: `comprovante-entrega-arma-${filenameDateStamp(atDate)}.pdf`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(msg || 'Erro ao montar o PDF do comprovante.')
  }
}
