import { useEffect, useRef } from 'react'

function blobToBase64Pdf(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') {
        reject(new Error('Leitura do PDF falhou.'))
        return
      }
      const i = dataUrl.indexOf(',')
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Leitura do PDF falhou.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Tenta abrir o diálogo de impressão do sistema (app Electron no Windows, etc.).
 * @returns {Promise<boolean>} true se tratou a impressão (nativo ou iframe).
 */
async function openPrintDialogForPdfUrl(pdfUrl, iframeContentWindow, { duplex = false } = {}) {
  try {
    const blob = await fetch(pdfUrl).then((r) => r.blob())
    const desktop = typeof window !== 'undefined' ? window.orbDesktop : undefined
    if (desktop?.printPdfFromBase64) {
      const base64 = await blobToBase64Pdf(blob)
      const result = await desktop.printPdfFromBase64(
        base64,
        duplex ? { duplex: true } : undefined,
      )
      if (result?.ok) return true
    }
  } catch {
    /* fallback abaixo */
  }
  if (iframeContentWindow) {
    try {
      iframeContentWindow.focus()
      iframeContentWindow.print()
      return true
    } catch {
      /* ignore */
    }
  }
  return false
}

export function SaidaTermoPreviewModal({
  open,
  pdfUrl,
  filename,
  onClose,
  onConfirmRegister,
  onFinalizeAfterSuccessfulRegister,
  confirming,
  /** Só visualização (ex.: movimentações) — sem confirmar saída */
  readOnly = false,
  titlePreview = 'Termo de retirada — pré-visualização',
  titleReadOnly = 'Termo de retirada de munições',
  hintPreview = 'Confira o PDF abaixo. Ao confirmar a saída, o estoque é atualizado. Use Imprimir ou Baixar PDF se precisar do termo em papel.',
  hintReadOnly = 'PDF gerado a partir dos itens desta saída. Você pode baixar ou imprimir.',
  confirmLabel = 'Confirmar saída',
  defaultDownloadName = 'termo-saida-municoes.pdf',
  /** Impressão frente e verso (borda longa), usada no documento de venda. */
  duplexPrint = false,
}) {
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!open || !pdfUrl) return
    const frame = iframeRef.current
    if (!frame) return
    frame.src = pdfUrl
  }, [open, pdfUrl])

  if (!open) return null

  async function handlePrint() {
    await openPrintDialogForPdfUrl(pdfUrl, iframeRef.current?.contentWindow, {
      duplex: duplexPrint,
    })
  }

  function handleDownload() {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = filename || defaultDownloadName
    a.rel = 'noopener'
    a.click()
  }

  async function handleConfirmRegister() {
    if (!onConfirmRegister) return
    const ok = await onConfirmRegister()
    if (!ok) return
    onFinalizeAfterSuccessfulRegister?.()
  }

  return (
    <div
      className="stock-termo-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !confirming) onClose()
      }}
    >
      <div
        className="stock-termo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-termo-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="stock-termo-dialog__head">
          <h2 id="stock-termo-title" className="stock-termo-dialog__title">
            {readOnly ? titleReadOnly : titlePreview}
          </h2>
          <button
            type="button"
            className="stock-termo-dialog__close"
            onClick={() => !confirming && onClose()}
            disabled={confirming}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <p className="stock-termo-dialog__hint">
          {readOnly ? hintReadOnly : hintPreview}
        </p>
        <div className="stock-termo-dialog__frame-wrap">
          {pdfUrl ? (
            <iframe
              ref={iframeRef}
              className="stock-termo-dialog__frame"
              title="Pré-visualização do termo PDF"
              src={pdfUrl}
            />
          ) : (
            <p className="stock-termo-dialog__hint">Carregando PDF…</p>
          )}
        </div>
        <div className="stock-termo-dialog__actions">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
          >
            {readOnly ? 'Fechar' : 'Voltar'}
          </button>
          <button
            type="button"
            className="stock-termo-dialog__btn-secondary"
            onClick={handleDownload}
            disabled={confirming || !pdfUrl}
          >
            Baixar PDF
          </button>
          <button
            type="button"
            className="stock-termo-dialog__btn-secondary"
            onClick={handlePrint}
            disabled={confirming || !pdfUrl}
          >
            Imprimir
          </button>
          {!readOnly ? (
            <button
              type="button"
              className="stock-termo-dialog__btn-primary"
              onClick={handleConfirmRegister}
              disabled={confirming}
            >
              {confirming ? 'Registrando…' : confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
