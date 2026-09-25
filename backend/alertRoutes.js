const {
  getConfig,
  saveConfig,
  checkLowStock,
  ensureConfigRow,
  syncLowStockState,
} = require('./alertsLowStock.js')

/**
 * @param {import('express').Express} app
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {(res: import('express').Response, status: number, message: string) => void} jsonError
 */
function registerAlertRoutes(app, db, save, jsonError) {
  app.get('/api/alerts/low-stock/config', (_req, res) => {
    try {
      ensureConfigRow(db)
      const config = getConfig(db)
      res.json({
        enabled: config.enabled,
        threshold: config.threshold,
      })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao ler configuração de aviso.')
    }
  })

  app.put('/api/alerts/low-stock/config', (req, res) => {
    try {
      const body = req.body || {}
      const threshold = Math.floor(Number(body.threshold))
      if (!Number.isFinite(threshold) || threshold < 0) {
        return jsonError(res, 400, 'Estoque mínimo deve ser um número ≥ 0.')
      }
      saveConfig(
        db,
        {
          enabled: Boolean(body.enabled),
          threshold,
        },
        save,
      )
      try {
        syncLowStockState(db, save)
      } catch (e) {
        console.warn('[alerts] sync after config save:', e?.message || e)
      }
      const config = getConfig(db)
      res.json({
        ok: true,
        enabled: config.enabled,
        threshold: config.threshold,
      })
    } catch (e) {
      jsonError(res, 400, e.message || 'Erro ao gravar configuração de aviso.')
    }
  })

  app.get('/api/alerts/low-stock/check', (_req, res) => {
    try {
      res.json(checkLowStock(db, save))
    } catch (e) {
      console.warn('[alerts] check failed:', e?.message || e)
      res.json({
        show: false,
        items: [],
        threshold: 100,
        episodeKey: null,
        enabled: false,
      })
    }
  })
}

module.exports = { registerAlertRoutes }
