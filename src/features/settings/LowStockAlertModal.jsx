import { useEffect, useState } from 'react'
import {
  checkLowStockAlert,
  getDismissedLowStockEpisodeKey,
  setDismissedLowStockEpisodeKey,
} from '../../services/alertsService.js'
import { LowStockAlertDialog } from './LowStockAlertDialog.jsx'

/**
 * Modal de estoque baixo ao entrar no app.
 * Falhas de rede/API são silenciosas.
 */
export default function LowStockAlertModal() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(
    /** @type {{ name: string, caliber: string, productType?: string, quantity: number }[]} */ ([]),
  )
  const [threshold, setThreshold] = useState(100)
  const [episodeKey, setEpisodeKey] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const result = await checkLowStockAlert()
        if (cancelled || !result?.show || !result.items?.length) return
        const key = result.episodeKey || ''
        if (key && key === getDismissedLowStockEpisodeKey()) return
        setItems(result.items)
        setThreshold(Number(result?.threshold) || 100)
        setEpisodeKey(key || null)
        setOpen(true)
      } catch {
        /* silêncio — não bloquear o app */
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    if (episodeKey) setDismissedLowStockEpisodeKey(episodeKey)
    setOpen(false)
  }

  return (
    <LowStockAlertDialog
      open={open}
      titleId="orb-low-stock-title"
      items={items}
      threshold={threshold}
      dismissLabel="Entendi"
      role="alertdialog"
      onDismiss={dismiss}
    />
  )
}
