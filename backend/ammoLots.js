/**
 * Lotes de munição.
 *
 * Saldo de um lote = saldo inicial distribuído (ammo_lot_openings) + entradas do lote − saídas do lote.
 * "Sem lote" = movimentos sem lote − tudo que já foi distribuído em lotes.
 * As movimentações antigas não mudam; por isso o estoque total continua igual ao de antes.
 */

/** Tipos de produto em que a entrada exige número de lote. */
const LOT_REQUIRED_PRODUCT_TYPES = new Set(['municao', 'cartucho'])

/**
 * Lote como é guardado: sem espaços nas pontas, em maiúsculas. Vazio = sem lote (null).
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeLotNumber(raw) {
  if (raw == null) return null
  const s = String(raw).trim().replace(/\s+/g, ' ').toUpperCase()
  return s === '' ? null : s
}

/** Chave interna do mapa de saldos: '' = sem lote. */
function lotKey(lot) {
  return lot == null ? '' : String(lot)
}

function allRows(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) out.push(stmt.getAsObject())
  stmt.free()
  return out
}

/**
 * Saldo por lote de um produto (ou de todos, sem ammoTypeId).
 * @param {import('sql.js').Database} db
 * @param {string} [ammoTypeId]
 * @returns {Map<string, Map<string, number>>} ammo_type_id → (lotKey → saldo)
 */
function lotBalances(db, ammoTypeId) {
  const where = ammoTypeId ? 'WHERE ammo_type_id = ?' : ''
  const params = ammoTypeId ? [ammoTypeId] : []
  const movs = allRows(
    db,
    `SELECT ammo_type_id, lot_number, SUM(
        CASE WHEN type = 'entrada' THEN quantity
             WHEN type = 'saida' THEN -quantity
             ELSE 0 END
      ) AS qty
     FROM ammo_movements ${where}
     GROUP BY ammo_type_id, lot_number`,
    params,
  )
  const openings = allRows(
    db,
    `SELECT ammo_type_id, lot_number, SUM(quantity) AS qty
     FROM ammo_lot_openings ${where}
     GROUP BY ammo_type_id, lot_number`,
    params,
  )
  /** @type {Map<string, Map<string, number>>} */
  const out = new Map()
  const add = (typeId, key, qty) => {
    const id = String(typeId)
    if (!out.has(id)) out.set(id, new Map())
    const m = out.get(id)
    m.set(key, (m.get(key) ?? 0) + Math.round(Number(qty) || 0))
  }
  for (const r of movs) add(r.ammo_type_id, lotKey(normalizeLotNumber(r.lot_number)), r.qty)
  for (const r of openings) {
    // O saldo distribuído sai do "sem lote" e entra no lote.
    add(r.ammo_type_id, '', -Number(r.qty))
    add(r.ammo_type_id, lotKey(normalizeLotNumber(r.lot_number)), r.qty)
  }
  return out
}

/**
 * @param {import('sql.js').Database} db
 * @param {string} ammoTypeId
 * @returns {Map<string, number>}
 */
function lotBalancesForType(db, ammoTypeId) {
  return lotBalances(db, ammoTypeId).get(String(ammoTypeId)) ?? new Map()
}

function lotLabel(key) {
  return key === '' ? 'sem lote' : `lote ${key}`
}

/**
 * Verifica se aplicar as variações deixa algum lote negativo.
 * @param {import('sql.js').Database} db
 * @param {string} ammoTypeId
 * @param {Map<string, number>} deltas lotKey → variação no saldo
 * @returns {string | null} mensagem de erro, ou null se está tudo certo
 */
function checkLotDeltas(db, ammoTypeId, deltas) {
  const balances = lotBalancesForType(db, ammoTypeId)
  for (const [key, delta] of deltas) {
    if (delta >= 0) continue
    const current = balances.get(key) ?? 0
    if (current + delta < 0) {
      return `Saldo insuficiente no ${lotLabel(key)}. Em estoque: ${current}.`
    }
  }
  return null
}

/** Efeito de uma movimentação no saldo do seu lote. */
function movementEffect(type, quantity) {
  const q = Math.round(Number(quantity) || 0)
  return type === 'entrada' ? q : type === 'saida' ? -q : 0
}

/**
 * @param {import('express').Express} app
 * @param {{
 *   db: import('sql.js').Database,
 *   save: () => void,
 *   qShop: (table: string, id: string|number, op: 'INSERT'|'UPDATE'|'DELETE', payload?: object|null) => void,
 *   jsonError: (res: import('express').Response, status: number, message: string) => unknown,
 *   crypto: typeof import('crypto'),
 * }} ctx
 */
function registerAmmoLotRoutes(app, { db, save, qShop, jsonError, crypto }) {
  /** Saldo por lote de todos os produtos (inclui "sem lote" só quando diferente de zero). */
  app.get('/api/ammo-lots', (_req, res) => {
    try {
      const all = lotBalances(db)
      const out = []
      for (const [ammoTypeId, m] of all) {
        for (const [key, stock] of m) {
          if (key === '' && stock === 0) continue
          out.push({
            ammo_type_id: ammoTypeId,
            lot_number: key === '' ? null : key,
            stock,
          })
        }
      }
      res.json(out)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar lotes.')
    }
  })

  app.get('/api/ammo-lot-openings', (req, res) => {
    try {
      const ammoTypeId = req.query.ammo_type_id ? String(req.query.ammo_type_id) : ''
      const rows = ammoTypeId
        ? allRows(
            db,
            `SELECT id, ammo_type_id, lot_number, quantity, created_at
             FROM ammo_lot_openings WHERE ammo_type_id = ? ORDER BY created_at, lot_number`,
            [ammoTypeId],
          )
        : allRows(
            db,
            `SELECT id, ammo_type_id, lot_number, quantity, created_at
             FROM ammo_lot_openings ORDER BY created_at, lot_number`,
          )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar distribuição de lotes.')
    }
  })

  /**
   * Distribui o saldo "sem lote" de um produto em lotes.
   * body: { ammo_type_id, lots: [{ lot_number, quantity }] }
   */
  app.post('/api/ammo-lot-openings', (req, res) => {
    try {
      const { ammo_type_id: ammoTypeId, lots } = req.body || {}
      if (!ammoTypeId || !Array.isArray(lots) || lots.length === 0) {
        return jsonError(res, 400, 'Informe o produto e pelo menos um lote.')
      }
      const exists = allRows(db, `SELECT id FROM ammo_types WHERE id = ?`, [ammoTypeId])
      if (!exists.length) return jsonError(res, 404, 'Produto não encontrado.')

      /** @type {Map<string, number>} */
      const merged = new Map()
      for (const l of lots) {
        const lot = normalizeLotNumber(l?.lot_number)
        if (!lot) return jsonError(res, 400, 'Todo lote precisa de um número.')
        const q = Number(l?.quantity)
        if (!Number.isInteger(q) || q <= 0) {
          return jsonError(res, 400, `Quantidade inválida no lote ${lot}.`)
        }
        merged.set(lot, (merged.get(lot) ?? 0) + q)
      }
      const total = [...merged.values()].reduce((a, b) => a + b, 0)
      const semLote = lotBalancesForType(db, ammoTypeId).get('') ?? 0
      if (total > semLote) {
        return jsonError(
          res,
          400,
          `A soma dos lotes (${total}) passa do saldo sem lote (${semLote}).`,
        )
      }

      const now = new Date().toISOString()
      const created = []
      for (const [lot, q] of merged) {
        const id = crypto.randomUUID()
        db.run(
          `INSERT INTO ammo_lot_openings (id, ammo_type_id, lot_number, quantity, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, ammoTypeId, lot, q, now],
        )
        const row = { id, ammo_type_id: ammoTypeId, lot_number: lot, quantity: q, created_at: now }
        created.push(row)
      }
      save()
      for (const row of created) qShop('ammo_lot_openings', row.id, 'INSERT', row)
      res.status(201).json(created)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao distribuir em lotes.')
    }
  })

  /** Desfaz uma distribuição: a quantidade volta para "sem lote". */
  app.delete('/api/ammo-lot-openings/:id', (req, res) => {
    try {
      const id = String(req.params.id)
      const row = allRows(
        db,
        `SELECT id, ammo_type_id, lot_number, quantity FROM ammo_lot_openings WHERE id = ?`,
        [id],
      )[0]
      if (!row) return jsonError(res, 404, 'Distribuição não encontrada.')
      const key = lotKey(normalizeLotNumber(row.lot_number))
      const err = checkLotDeltas(
        db,
        row.ammo_type_id,
        new Map([[key, -Number(row.quantity)]]),
      )
      if (err) {
        return jsonError(
          res,
          400,
          `Não dá para desfazer: parte do lote ${key} já saiu. ${err}`,
        )
      }
      db.run(`DELETE FROM ammo_lot_openings WHERE id = ?`, [id])
      save()
      qShop('ammo_lot_openings', id, 'DELETE', null)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao desfazer lote.')
    }
  })
}

module.exports = {
  LOT_REQUIRED_PRODUCT_TYPES,
  normalizeLotNumber,
  lotKey,
  lotBalances,
  lotBalancesForType,
  checkLotDeltas,
  movementEffect,
  registerAmmoLotRoutes,
}
