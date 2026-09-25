/**
 * jsPDF: Helvetica (padrão, sempre disponível).
 * Evita fontes customizadas embutidas que podem falhar no Electron/dev.
 */

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {'normal' | 'bold'} style
 */
export function setPdfFont(doc, style = 'normal') {
  doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal')
}

/** @deprecated mantido por compatibilidade; não faz nada. */
export function registerWeaponPdfFonts(_doc) {
  return false
}
