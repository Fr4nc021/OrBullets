const crypto = require('crypto')

/**
 * @param {import('sql.js').Database} db
 * @param {string} sql
 * @param {unknown[]} [params]
 */
function allRows(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) {
    out.push(stmt.getAsObject())
  }
  stmt.free()
  return out
}

/**
 * @param {import('sql.js').Database} db
 * @param {string} sql
 * @param {unknown[]} [params]
 */
function runDb(db, sql, params = []) {
  db.run(sql, params)
}

function jsonError(res, status, message) {
  return res.status(status).json({ error: message })
}

/**
 * @param {import('sql.js').Database} db
 * @param {string} itemId
 */
function stockForItem(db, itemId) {
  const rows = allRows(
    db,
    `SELECT COALESCE(SUM(
      CASE WHEN type = 'entrada' THEN quantity
           WHEN type = 'saida' THEN -quantity
           ELSE 0 END
    ), 0) AS s
     FROM club_stock_movements WHERE item_id = ?`,
    [itemId],
  )
  return Number(rows[0]?.s ?? 0)
}

/**
 * @param {import('sql.js').Database} db
 * @param {string} itemId
 * @param {string} expectedKind
 */
function assertItemKind(db, itemId, expectedKind) {
  const rows = allRows(db, `SELECT kind FROM club_items WHERE id = ?`, [itemId])
  if (!rows.length) throw new Error('Item não encontrado.')
  if (rows[0].kind !== expectedKind) {
    throw new Error(`Item deve ser do tipo ${expectedKind}.`)
  }
}

/**
 * @param {import('express').Express} app
 * @param {import('sql.js').Database} db
 * @param {() => void} save
 * @param {(table: string, entityId: string|number, op: 'INSERT'|'UPDATE'|'DELETE', payload?: object|null) => void} qClub
 */
function registerClubRoutes(app, db, save, qClub) {
  const q = typeof qClub === 'function' ? qClub : () => {}

  function signedMovementQty(type, quantity) {
    return type === 'entrada' ? Number(quantity) : -Number(quantity)
  }

  function clubMovementPayload(r) {
    return {
      local_id: r.id,
      item_id: r.item_id,
      type: r.type,
      quantity: r.quantity,
      date: r.date,
      notes: r.notes ?? null,
      production_batch_id: r.production_batch_id ?? null,
    }
  }
  app.get('/api/club/calibers', (_req, res) => {
    try {
      const rows = allRows(
        db,
        `SELECT id, name, created_at FROM club_calibers ORDER BY name COLLATE NOCASE`,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar calibres do clube.')
    }
  })

  app.post('/api/club/calibers', (req, res) => {
    try {
      const { name } = req.body || {}
      const trimmed = name != null ? String(name).trim() : ''
      if (!trimmed) {
        return jsonError(res, 400, 'name é obrigatório.')
      }
      const id = crypto.randomUUID()
      runDb(db, `INSERT INTO club_calibers (id, name) VALUES (?, ?)`, [id, trimmed])
      save()
      const row = allRows(db, `SELECT id, name, created_at FROM club_calibers WHERE id = ?`, [
        id,
      ])[0]
      q('club_calibers', id, 'INSERT', row)
      res.status(201).json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE constraint')) {
        return jsonError(res, 409, 'Já existe calibre com este nome.')
      }
      jsonError(res, 500, e.message || 'Erro ao criar calibre.')
    }
  })

  app.get('/api/club/items', (req, res) => {
    try {
      const kind = req.query.kind
      const rows = kind
        ? allRows(
            db,
            `SELECT id, name, kind, created_at FROM club_items WHERE kind = ? ORDER BY name COLLATE NOCASE`,
            [kind],
          )
        : allRows(
            db,
            `SELECT id, name, kind, created_at FROM club_items ORDER BY kind, name COLLATE NOCASE`,
          )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar itens.')
    }
  })

  app.post('/api/club/items', (req, res) => {
    try {
      const { name, kind } = req.body || {}
      const trimmed = name != null ? String(name).trim() : ''
      if (!trimmed) {
        return jsonError(res, 400, 'name é obrigatório.')
      }
      const k = kind != null ? String(kind).trim() : ''
      if (!['polvora', 'espoleta', 'ponta', 'municao'].includes(k)) {
        return jsonError(res, 400, 'kind deve ser polvora, espoleta, ponta ou municao.')
      }
      const id = crypto.randomUUID()
      runDb(db, `INSERT INTO club_items (id, name, kind) VALUES (?, ?, ?)`, [id, trimmed, k])
      save()
      const row = allRows(db, `SELECT id, name, kind, created_at FROM club_items WHERE id = ?`, [
        id,
      ])[0]
      q('club_items', id, 'INSERT', row)
      res.status(201).json(row)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao criar item.')
    }
  })

  app.put('/api/club/items/:id', (req, res) => {
    try {
      const itemId = req.params.id
      const existingRows = allRows(db, `SELECT id, name, kind FROM club_items WHERE id = ?`, [
        itemId,
      ])
      if (!existingRows.length) {
        return jsonError(res, 404, 'Item não encontrado.')
      }
      const existing = existingRows[0]
      const b = req.body || {}
      const name = b.name !== undefined ? String(b.name).trim() : existing.name
      const kind = b.kind !== undefined ? String(b.kind).trim() : existing.kind
      if (!name) {
        return jsonError(res, 400, 'name não pode ficar vazio.')
      }
      if (!['polvora', 'espoleta', 'ponta', 'municao'].includes(kind)) {
        return jsonError(res, 400, 'kind deve ser polvora, espoleta, ponta ou municao.')
      }
      if (kind !== existing.kind) {
        const ref = allRows(
          db,
          `SELECT 1 FROM club_recipes WHERE
            polvora_item_id = ? OR espoleta_item_id = ? OR ponta_item_id = ? OR municao_output_item_id = ?
          LIMIT 1`,
          [itemId, itemId, itemId, itemId],
        )
        if (ref.length) {
          return jsonError(
            res,
            400,
            'Não é possível alterar o tipo: o item está numa receita. Retire-o da receita primeiro.',
          )
        }
      }
      runDb(db, `UPDATE club_items SET name = ?, kind = ? WHERE id = ?`, [name, kind, itemId])
      save()
      const row = allRows(db, `SELECT id, name, kind, created_at FROM club_items WHERE id = ?`, [
        itemId,
      ])[0]
      q('club_items', itemId, 'UPDATE', row)
      res.json(row)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar item.')
    }
  })

  app.patch('/api/club/items/:id/balance', (req, res) => {
    try {
      const itemId = req.params.id
      const rows = allRows(db, `SELECT id FROM club_items WHERE id = ?`, [itemId])
      if (!rows.length) {
        return jsonError(res, 404, 'Item não encontrado.')
      }
      const target = Number(req.body?.quantity)
      if (!Number.isFinite(target) || target < 0) {
        return jsonError(res, 400, 'quantity deve ser um número maior ou igual a zero.')
      }
      const current = stockForItem(db, itemId)
      const delta = target - current
      if (Math.abs(delta) < 1e-9) {
        return res.json({ id: itemId, stock: current })
      }
      const type = delta > 0 ? 'entrada' : 'saida'
      const q = Math.abs(delta)
      const when = new Date().toISOString()
      runDb(
        db,
        `INSERT INTO club_stock_movements (item_id, type, quantity, date, notes, production_batch_id)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [itemId, type, q, when, 'Ajuste de saldo'],
      )
      save()
      const rid = allRows(db, `SELECT last_insert_rowid() AS id`)[0]?.id
      const mRow = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id FROM club_stock_movements WHERE id = ?`,
        [rid],
      )[0]
      if (mRow) q('club_stock_movements', mRow.id, 'INSERT', clubMovementPayload(mRow))
      res.json({ id: itemId, stock: stockForItem(db, itemId) })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao ajustar saldo.')
    }
  })

  app.delete('/api/club/items/:id', (req, res) => {
    try {
      const itemId = req.params.id
      const exists = allRows(db, `SELECT id FROM club_items WHERE id = ?`, [itemId])
      if (!exists.length) {
        return jsonError(res, 404, 'Item não encontrado.')
      }
      const ref = allRows(
        db,
        `SELECT 1 FROM club_recipes WHERE
          polvora_item_id = ? OR espoleta_item_id = ? OR ponta_item_id = ? OR municao_output_item_id = ?
         LIMIT 1`,
        [itemId, itemId, itemId, itemId],
      )
      if (ref.length) {
        return jsonError(
          res,
          400,
          'Não é possível excluir: o item está numa receita. Retire-o da receita primeiro.',
        )
      }
      const movIds = allRows(db, `SELECT id FROM club_stock_movements WHERE item_id = ?`, [itemId])
      for (const mr of movIds) {
        q('club_stock_movements', mr.id, 'DELETE', null)
      }
      q('club_items', itemId, 'DELETE', null)
      runDb(db, `DELETE FROM club_stock_movements WHERE item_id = ?`, [itemId])
      runDb(db, `DELETE FROM club_items WHERE id = ?`, [itemId])
      save()
      res.status(204).end()
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir item.')
    }
  })

  app.delete('/api/club/items/:id/movements', (req, res) => {
    try {
      const itemId = req.params.id
      const exists = allRows(db, `SELECT id FROM club_items WHERE id = ?`, [itemId])
      if (!exists.length) {
        return jsonError(res, 404, 'Item não encontrado.')
      }
      const movIds = allRows(db, `SELECT id FROM club_stock_movements WHERE item_id = ?`, [itemId])
      for (const mr of movIds) {
        q('club_stock_movements', mr.id, 'DELETE', null)
      }
      runDb(db, `DELETE FROM club_stock_movements WHERE item_id = ?`, [itemId])
      save()
      res.json({ id: itemId, stock: 0, deleted_movements: movIds.length })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao limpar movimentações do item.')
    }
  })

  app.put('/api/club/calibers/:id', (req, res) => {
    try {
      const caliberId = req.params.id
      const rows = allRows(db, `SELECT id FROM club_calibers WHERE id = ?`, [caliberId])
      if (!rows.length) {
        return jsonError(res, 404, 'Calibre não encontrado.')
      }
      const trimmed =
        req.body?.name != null ? String(req.body.name).trim() : ''
      if (!trimmed) {
        return jsonError(res, 400, 'name é obrigatório.')
      }
      runDb(db, `UPDATE club_calibers SET name = ? WHERE id = ?`, [trimmed, caliberId])
      save()
      const row = allRows(db, `SELECT id, name, created_at FROM club_calibers WHERE id = ?`, [
        caliberId,
      ])[0]
      q('club_calibers', caliberId, 'UPDATE', row)
      res.json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE constraint')) {
        return jsonError(res, 409, 'Já existe calibre com este nome.')
      }
      jsonError(res, 500, e.message || 'Erro ao atualizar calibre.')
    }
  })

  app.delete('/api/club/calibers/:id', (req, res) => {
    try {
      const caliberId = req.params.id
      const rows = allRows(db, `SELECT id FROM club_calibers WHERE id = ?`, [caliberId])
      if (!rows.length) {
        return jsonError(res, 404, 'Calibre não encontrado.')
      }
      const refRecipe = allRows(
        db,
        `SELECT 1 FROM club_recipes WHERE caliber_id = ? LIMIT 1`,
        [caliberId],
      )
      if (refRecipe.length) {
        return jsonError(
          res,
          400,
          'Remova a receita deste calibre antes de excluir o calibre.',
        )
      }
      const refBatch = allRows(
        db,
        `SELECT 1 FROM club_production_batches WHERE caliber_id = ? LIMIT 1`,
        [caliberId],
      )
      if (refBatch.length) {
        return jsonError(
          res,
          400,
          'Existem lotes de produção para este calibre; não é possível excluir.',
        )
      }
      q('club_calibers', caliberId, 'DELETE', null)
      runDb(db, `DELETE FROM club_calibers WHERE id = ?`, [caliberId])
      save()
      res.status(204).end()
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir calibre.')
    }
  })

  app.get('/api/club/stock', (_req, res) => {
    try {
      const items = allRows(
        db,
        `SELECT id, name, kind, created_at FROM club_items ORDER BY kind, name COLLATE NOCASE`,
      )
      const out = items.map((it) => ({
        ...it,
        stock: stockForItem(db, it.id),
      }))
      res.json(out)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar estoque do clube.')
    }
  })

  app.post('/api/club/stock/movements', (req, res) => {
    try {
      const { item_id: itemId, type, quantity, date, notes } = req.body || {}
      if (!itemId || !type || quantity == null) {
        return jsonError(res, 400, 'item_id, type e quantity são obrigatórios.')
      }
      if (type !== 'entrada' && type !== 'saida') {
        return jsonError(res, 400, 'type deve ser entrada ou saida.')
      }
      const q = Number(quantity)
      if (!Number.isFinite(q) || q <= 0) {
        return jsonError(res, 400, 'quantity deve ser um número positivo.')
      }
      const exists = allRows(db, `SELECT id FROM club_items WHERE id = ?`, [itemId])
      if (!exists.length) {
        return jsonError(res, 404, 'Item não encontrado.')
      }
      const when = date != null && String(date).trim() ? String(date).trim() : new Date().toISOString()
      const note = notes != null ? String(notes).trim() || null : null
      runDb(
        db,
        `INSERT INTO club_stock_movements (item_id, type, quantity, date, notes, production_batch_id)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [itemId, type, q, when, note],
      )
      save()
      const rid = allRows(db, `SELECT last_insert_rowid() AS id`)[0]?.id
      const last = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id
         FROM club_stock_movements WHERE id = ?`,
        [rid],
      )[0]
      if (last) q('club_stock_movements', last.id, 'INSERT', clubMovementPayload(last))
      res.status(201).json(last)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao lançar movimentação.')
    }
  })

  app.get('/api/club/stock/movements', (req, res) => {
    try {
      const lim = Math.min(500, Math.max(1, Math.floor(Number(req.query.limit)) || 200))
      const itemFilter = req.query.item_id != null ? String(req.query.item_id).trim() : ''
      const params = itemFilter ? [itemFilter, lim] : [lim]
      const rows = allRows(
        db,
        itemFilter
          ? `SELECT m.id, m.item_id, i.name AS item_name, i.kind AS item_kind, m.type, m.quantity,
                    m.date, m.notes, m.production_batch_id
             FROM club_stock_movements m
             JOIN club_items i ON i.id = m.item_id
             WHERE m.item_id = ?
             ORDER BY m.date DESC, m.id DESC
             LIMIT ?`
          : `SELECT m.id, m.item_id, i.name AS item_name, i.kind AS item_kind, m.type, m.quantity,
                    m.date, m.notes, m.production_batch_id
             FROM club_stock_movements m
             JOIN club_items i ON i.id = m.item_id
             ORDER BY m.date DESC, m.id DESC
             LIMIT ?`,
        params,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar movimentações.')
    }
  })

  app.put('/api/club/stock/movements/:id', (req, res) => {
    try {
      const movId = Math.floor(Number(req.params.id))
      if (!Number.isFinite(movId) || movId <= 0) {
        return jsonError(res, 400, 'id de movimento inválido.')
      }
      const prevRows = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id
         FROM club_stock_movements WHERE id = ?`,
        [movId],
      )
      if (!prevRows.length) {
        return jsonError(res, 404, 'Movimento não encontrado.')
      }
      const prev = prevRows[0]
      const b = req.body || {}
      const linkedBatch = prev.production_batch_id != null && String(prev.production_batch_id).trim()

      if (linkedBatch) {
        const noteOnly =
          b.item_id === undefined &&
          b.type === undefined &&
          b.quantity === undefined &&
          b.date === undefined &&
          b.notes !== undefined
        if (!noteOnly) {
          return jsonError(
            res,
            400,
            'Movimento ligado a um lote de produção: só é possível alterar as notas. Quantidade e data ajustam-se pelo lote.',
          )
        }
        const notes = b.notes != null ? String(b.notes).trim() || null : null
        runDb(db, `UPDATE club_stock_movements SET notes = ? WHERE id = ?`, [notes, movId])
        save()
        const row = allRows(
          db,
          `SELECT id, item_id, type, quantity, date, notes, production_batch_id
           FROM club_stock_movements WHERE id = ?`,
          [movId],
        )[0]
        q('club_stock_movements', row.id, 'UPDATE', clubMovementPayload(row))
        return res.json(row)
      }

      const itemId = b.item_id !== undefined ? String(b.item_id).trim() : prev.item_id
      const type = b.type !== undefined ? String(b.type).trim() : prev.type
      const qty = b.quantity !== undefined ? Number(b.quantity) : Number(prev.quantity)
      const date =
        b.date !== undefined && String(b.date).trim()
          ? String(b.date).trim()
          : String(prev.date)
      const notes = b.notes !== undefined ? (b.notes != null ? String(b.notes).trim() || null : null) : prev.notes

      if (!itemId) {
        return jsonError(res, 400, 'item_id é obrigatório.')
      }
      if (type !== 'entrada' && type !== 'saida') {
        return jsonError(res, 400, 'type deve ser entrada ou saida.')
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return jsonError(res, 400, 'quantity deve ser um número positivo.')
      }
      const itemExists = allRows(db, `SELECT id FROM club_items WHERE id = ?`, [itemId])
      if (!itemExists.length) {
        return jsonError(res, 404, 'Item não encontrado.')
      }

      const oldSigned = signedMovementQty(prev.type, prev.quantity)
      const newSigned = signedMovementQty(type, qty)
      const affected = new Set([String(prev.item_id), String(itemId)])
      for (const iid of affected) {
        let s = stockForItem(db, iid)
        if (String(prev.item_id) === iid) s -= oldSigned
        if (String(itemId) === iid) s += newSigned
        if (s < -1e-9) {
          return jsonError(
            res,
            400,
            'A alteração deixaria um item com saldo negativo. Ajuste valores ou o estoque.',
          )
        }
      }

      runDb(
        db,
        `UPDATE club_stock_movements
         SET item_id = ?, type = ?, quantity = ?, date = ?, notes = ?
         WHERE id = ?`,
        [itemId, type, qty, date, notes, movId],
      )
      save()
      const row = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id
         FROM club_stock_movements WHERE id = ?`,
        [movId],
      )[0]
      q('club_stock_movements', row.id, 'UPDATE', clubMovementPayload(row))
      res.json(row)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar movimento.')
    }
  })

  app.delete('/api/club/stock/movements/:id', (req, res) => {
    try {
      const movId = Math.floor(Number(req.params.id))
      if (!Number.isFinite(movId) || movId <= 0) {
        return jsonError(res, 400, 'id de movimento inválido.')
      }
      const prevRows = allRows(
        db,
        `SELECT id, item_id, type, quantity, production_batch_id FROM club_stock_movements WHERE id = ?`,
        [movId],
      )
      if (!prevRows.length) {
        return jsonError(res, 404, 'Movimento não encontrado.')
      }
      const prev = prevRows[0]
      if (prev.production_batch_id != null && String(prev.production_batch_id).trim()) {
        return jsonError(
          res,
          400,
          'Movimento ligado a um lote de produção: exclua ou edite o lote em «Últimos lotes».',
        )
      }
      const oldSigned = signedMovementQty(prev.type, prev.quantity)
      const s = stockForItem(db, prev.item_id) - oldSigned
      if (s < -1e-9) {
        return jsonError(res, 409, 'Remover este movimento deixaria saldo inconsistente.')
      }
      q('club_stock_movements', movId, 'DELETE', null)
      runDb(db, `DELETE FROM club_stock_movements WHERE id = ?`, [movId])
      save()
      res.status(204).end()
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir movimento.')
    }
  })

  app.get('/api/club/recipes', (_req, res) => {
    try {
      const rows = allRows(
        db,
        `SELECT
           r.caliber_id,
           c.name AS caliber_name,
           r.polvora_item_id,
           COALESCE(pi.name, r.polvora_item_id) AS polvora_name,
           r.espoleta_item_id,
           COALESCE(ei.name, r.espoleta_item_id) AS espoleta_name,
           r.ponta_item_id,
           COALESCE(pti.name, r.ponta_item_id) AS ponta_name,
           r.municao_output_item_id,
           mi.name AS municao_output_name,
           r.grains_polvora_por_municao,
           r.espoletas_por_municao,
           r.pontas_por_municao,
           r.updated_at
         FROM club_recipes r
         JOIN club_calibers c ON c.id = r.caliber_id
         LEFT JOIN club_items pi ON pi.id = r.polvora_item_id
         LEFT JOIN club_items ei ON ei.id = r.espoleta_item_id
         LEFT JOIN club_items pti ON pti.id = r.ponta_item_id
         LEFT JOIN club_items mi ON mi.id = r.municao_output_item_id
         ORDER BY c.name COLLATE NOCASE`,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar receitas.')
    }
  })

  app.get('/api/club/recipes/:caliberId', (req, res) => {
    try {
      const caliberId = req.params.caliberId
      const rows = allRows(
        db,
        `SELECT caliber_id, polvora_item_id, espoleta_item_id, ponta_item_id, municao_output_item_id,
                grains_polvora_por_municao, espoletas_por_municao, pontas_por_municao, updated_at
         FROM club_recipes WHERE caliber_id = ?`,
        [caliberId],
      )
      res.json(rows.length ? rows[0] : null)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao buscar receita.')
    }
  })

  app.delete('/api/club/recipes/:caliberId', (req, res) => {
    try {
      const caliberId = req.params.caliberId
      const rows = allRows(db, `SELECT caliber_id FROM club_recipes WHERE caliber_id = ?`, [
        caliberId,
      ])
      if (!rows.length) {
        return jsonError(res, 404, 'Receita não encontrada para este calibre.')
      }
      const batches = allRows(
        db,
        `SELECT 1 FROM club_production_batches WHERE caliber_id = ? LIMIT 1`,
        [caliberId],
      )
      if (batches.length) {
        return jsonError(
          res,
          400,
          'Não é possível remover a receita: já existem lotes de produção para este calibre.',
        )
      }
      q('club_recipes', caliberId, 'DELETE', null)
      runDb(db, `DELETE FROM club_recipes WHERE caliber_id = ?`, [caliberId])
      save()
      res.status(204).end()
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao remover receita.')
    }
  })

  app.put('/api/club/recipes/:caliberId', (req, res) => {
    try {
      const caliberId = req.params.caliberId
      const cal = allRows(db, `SELECT id FROM club_calibers WHERE id = ?`, [caliberId])
      if (!cal.length) {
        return jsonError(res, 404, 'Calibre não encontrado.')
      }
      const b = req.body || {}
      const {
        polvora_item_id: polvoraItemId,
        espoleta_item_id: espoletaItemId,
        ponta_item_id: pontaItemId,
        municao_output_item_id: municaoOutId,
        grains_polvora_por_municao: grains,
        espoletas_por_municao: espPer,
        pontas_por_municao: pontaPer,
      } = b

      if (!polvoraItemId || !espoletaItemId || !pontaItemId) {
        return jsonError(
          res,
          400,
          'polvora_item_id, espoleta_item_id e ponta_item_id são obrigatórios.',
        )
      }
      assertItemKind(db, polvoraItemId, 'polvora')
      assertItemKind(db, espoletaItemId, 'espoleta')
      assertItemKind(db, pontaItemId, 'ponta')
      if (municaoOutId) {
        assertItemKind(db, municaoOutId, 'municao')
      }

      const g = Number(grains)
      if (!Number.isFinite(g) || g <= 0) {
        return jsonError(res, 400, 'grains_polvora_por_municao deve ser > 0.')
      }
      const e1 = espPer != null ? Number(espPer) : 1
      const e2 = pontaPer != null ? Number(pontaPer) : 1
      if (!Number.isFinite(e1) || e1 <= 0 || !Number.isFinite(e2) || e2 <= 0) {
        return jsonError(res, 400, 'Quantidades por munição devem ser > 0.')
      }

      const now = new Date().toISOString()
      const existing = allRows(db, `SELECT caliber_id FROM club_recipes WHERE caliber_id = ?`, [
        caliberId,
      ])
      if (existing.length) {
        runDb(
          db,
          `UPDATE club_recipes SET
            polvora_item_id = ?, espoleta_item_id = ?, ponta_item_id = ?, municao_output_item_id = ?,
            grains_polvora_por_municao = ?, espoletas_por_municao = ?, pontas_por_municao = ?,
            updated_at = ?
           WHERE caliber_id = ?`,
          [
            polvoraItemId,
            espoletaItemId,
            pontaItemId,
            municaoOutId || null,
            g,
            e1,
            e2,
            now,
            caliberId,
          ],
        )
      } else {
        runDb(
          db,
          `INSERT INTO club_recipes (
            caliber_id, polvora_item_id, espoleta_item_id, ponta_item_id, municao_output_item_id,
            grains_polvora_por_municao, espoletas_por_municao, pontas_por_municao, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caliberId,
            polvoraItemId,
            espoletaItemId,
            pontaItemId,
            municaoOutId || null,
            g,
            e1,
            e2,
            now,
          ],
        )
      }
      save()
      const row = allRows(
        db,
        `SELECT caliber_id, polvora_item_id, espoleta_item_id, ponta_item_id, municao_output_item_id,
                grains_polvora_por_municao, espoletas_por_municao, pontas_por_municao, updated_at
         FROM club_recipes WHERE caliber_id = ?`,
        [caliberId],
      )[0]
      q('club_recipes', caliberId, existing.length ? 'UPDATE' : 'INSERT', row)
      res.json(row)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao salvar receita.')
    }
  })

  app.post('/api/club/production', (req, res) => {
    try {
      const { caliber_id: caliberId, municoes_produzidas: nRaw, date, notes } = req.body || {}
      if (!caliberId) {
        return jsonError(res, 400, 'caliber_id é obrigatório.')
      }
      const n = Math.floor(Number(nRaw))
      if (!Number.isFinite(n) || n <= 0) {
        return jsonError(res, 400, 'municoes_produzidas deve ser um inteiro positivo.')
      }

      const recipeRows = allRows(
        db,
        `SELECT * FROM club_recipes WHERE caliber_id = ?`,
        [caliberId],
      )
      if (!recipeRows.length) {
        return jsonError(res, 400, 'Cadastre a receita deste calibre antes de registrar produção.')
      }
      const r = recipeRows[0]

      const needPolvora = n * Number(r.grains_polvora_por_municao)
      const needEsp = n * Number(r.espoletas_por_municao)
      const needPonta = n * Number(r.pontas_por_municao)

      if (stockForItem(db, r.polvora_item_id) + 1e-9 < needPolvora) {
        return jsonError(res, 400, 'Pólvora insuficiente no estoque do clube.')
      }
      if (stockForItem(db, r.espoleta_item_id) + 1e-9 < needEsp) {
        return jsonError(res, 400, 'Espoletas insuficientes no estoque do clube.')
      }
      if (stockForItem(db, r.ponta_item_id) + 1e-9 < needPonta) {
        return jsonError(res, 400, 'Pontas insuficientes no estoque do clube.')
      }

      const batchId = crypto.randomUUID()
      const when = date != null && String(date).trim() ? String(date).trim() : new Date().toISOString()
      const note = notes != null ? String(notes).trim() || null : null

      runDb(
        db,
        `INSERT INTO club_production_batches (id, caliber_id, municoes_produzidas, date, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [batchId, caliberId, n, when, note],
      )

      const insumoNote = `Produção ${n} munições (lote ${batchId.slice(0, 8)})`

      runDb(
        db,
        `INSERT INTO club_stock_movements (item_id, type, quantity, date, notes, production_batch_id)
         VALUES (?, 'saida', ?, ?, ?, ?)`,
        [r.polvora_item_id, needPolvora, when, insumoNote, batchId],
      )
      runDb(
        db,
        `INSERT INTO club_stock_movements (item_id, type, quantity, date, notes, production_batch_id)
         VALUES (?, 'saida', ?, ?, ?, ?)`,
        [r.espoleta_item_id, needEsp, when, insumoNote, batchId],
      )
      runDb(
        db,
        `INSERT INTO club_stock_movements (item_id, type, quantity, date, notes, production_batch_id)
         VALUES (?, 'saida', ?, ?, ?, ?)`,
        [r.ponta_item_id, needPonta, when, insumoNote, batchId],
      )

      if (r.municao_output_item_id) {
        runDb(
          db,
          `INSERT INTO club_stock_movements (item_id, type, quantity, date, notes, production_batch_id)
           VALUES (?, 'entrada', ?, ?, ?, ?)`,
          [r.municao_output_item_id, n, when, insumoNote, batchId],
        )
      }

      save()

      const batch = allRows(db, `SELECT * FROM club_production_batches WHERE id = ?`, [batchId])[0]
      if (batch) q('club_production_batches', batchId, 'INSERT', batch)
      const batchMovs = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id FROM club_stock_movements WHERE production_batch_id = ?`,
        [batchId],
      )
      for (const m of batchMovs) {
        q('club_stock_movements', m.id, 'INSERT', clubMovementPayload(m))
      }
      res.status(201).json({
        batch,
        consumo: {
          polvora_grains: needPolvora,
          espoletas: needEsp,
          pontas: needPonta,
        },
        saldos_apos: {
          polvora: stockForItem(db, r.polvora_item_id),
          espoleta: stockForItem(db, r.espoleta_item_id),
          ponta: stockForItem(db, r.ponta_item_id),
          municao: r.municao_output_item_id
            ? stockForItem(db, r.municao_output_item_id)
            : null,
        },
      })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao registrar produção.')
    }
  })

  /**
   * Relatório: munições produzidas e saídas de insumo no período; estoque atual (saldos).
   * Query: from, to — datas ISO ou só YYYY-MM-DD (inclusive). Omitir ambos = histórico completo.
   */
  app.get('/api/club/report/summary', (req, res) => {
    try {
      const fromRaw = req.query.from != null ? String(req.query.from).trim() : ''
      const toRaw = req.query.to != null ? String(req.query.to).trim() : ''
      let fromIso = fromRaw || null
      let toIso = toRaw || null
      if (fromIso && !fromIso.includes('T')) {
        fromIso = `${fromIso}T00:00:00.000Z`
      }
      if (toIso && !toIso.includes('T')) {
        toIso = `${toIso}T23:59:59.999Z`
      }

      const batchConds = []
      const batchParams = []
      if (fromIso) {
        batchConds.push('b.date >= ?')
        batchParams.push(fromIso)
      }
      if (toIso) {
        batchConds.push('b.date <= ?')
        batchParams.push(toIso)
      }
      const batchWhere = batchConds.length ? `WHERE ${batchConds.join(' AND ')}` : ''

      const movConds = ["m.type = 'saida'", "i.kind IN ('polvora', 'espoleta', 'ponta')"]
      const movParams = []
      if (fromIso) {
        movConds.push('m.date >= ?')
        movParams.push(fromIso)
      }
      if (toIso) {
        movConds.push('m.date <= ?')
        movParams.push(toIso)
      }
      const movWhereInsumo = `WHERE ${movConds.join(' AND ')}`

      const movCondsMunIn = [
        "m.type = 'entrada'",
        "i.kind = 'municao'",
        'm.production_batch_id IS NOT NULL',
      ]
      const movParamsMunIn = []
      if (fromIso) {
        movCondsMunIn.push('m.date >= ?')
        movParamsMunIn.push(fromIso)
      }
      if (toIso) {
        movCondsMunIn.push('m.date <= ?')
        movParamsMunIn.push(toIso)
      }

      const movCondsMunOut = ["m.type = 'saida'", "i.kind = 'municao'"]
      const movParamsMunOut = []
      if (fromIso) {
        movCondsMunOut.push('m.date >= ?')
        movParamsMunOut.push(fromIso)
      }
      if (toIso) {
        movCondsMunOut.push('m.date <= ?')
        movParamsMunOut.push(toIso)
      }

      const totalProducedRows = allRows(
        db,
        `SELECT COALESCE(SUM(b.municoes_produzidas), 0) AS t
         FROM club_production_batches b ${batchWhere}`,
        batchParams,
      )
      const municoesProduzidasTotal = Number(totalProducedRows[0]?.t ?? 0)

      const porCalibre = allRows(
        db,
        `SELECT b.caliber_id AS caliber_id, c.name AS caliber_name,
                COALESCE(SUM(b.municoes_produzidas), 0) AS municoes
         FROM club_production_batches b
         JOIN club_calibers c ON c.id = b.caliber_id
         ${batchWhere}
         GROUP BY b.caliber_id
         ORDER BY c.name COLLATE NOCASE`,
        batchParams,
      )

      const insumoSaidas = allRows(
        db,
        `SELECT m.item_id AS item_id, i.name AS name, i.kind AS kind,
                COALESCE(SUM(m.quantity), 0) AS total_saida,
                COALESCE(SUM(CASE WHEN m.production_batch_id IS NOT NULL THEN m.quantity ELSE 0 END), 0) AS saida_em_producao,
                COALESCE(SUM(CASE WHEN m.production_batch_id IS NULL THEN m.quantity ELSE 0 END), 0) AS saida_manual
         FROM club_stock_movements m
         JOIN club_items i ON i.id = m.item_id
         ${movWhereInsumo}
         GROUP BY m.item_id
         ORDER BY i.kind, i.name COLLATE NOCASE`,
        movParams,
      )

      const munEntradaProdRows = allRows(
        db,
        `SELECT COALESCE(SUM(m.quantity), 0) AS q
         FROM club_stock_movements m
         JOIN club_items i ON i.id = m.item_id
         WHERE ${movCondsMunIn.join(' AND ')}`,
        movParamsMunIn,
      )
      const municaoEntradaProducao = Number(munEntradaProdRows[0]?.q ?? 0)

      const munSaidaRows = allRows(
        db,
        `SELECT COALESCE(SUM(m.quantity), 0) AS q
         FROM club_stock_movements m
         JOIN club_items i ON i.id = m.item_id
         WHERE ${movCondsMunOut.join(' AND ')}`,
        movParamsMunOut,
      )
      const municaoSaidaDistribuicao = Number(munSaidaRows[0]?.q ?? 0)

      const items = allRows(
        db,
        `SELECT id, name, kind, created_at FROM club_items ORDER BY kind, name COLLATE NOCASE`,
      )
      const estoqueAtual = items.map((it) => ({
        id: it.id,
        name: it.name,
        kind: it.kind,
        stock: stockForItem(db, it.id),
      }))

      res.json({
        period: {
          entire_history: !fromIso && !toIso,
          from: fromIso,
          to: toIso,
        },
        producao: {
          municoes_total: municoesProduzidasTotal,
          por_calibre: porCalibre.map((r) => ({
            caliber_id: r.caliber_id,
            caliber_name: r.caliber_name,
            municoes: Number(r.municoes ?? 0),
          })),
        },
        insumos_saidas_no_periodo: insumoSaidas.map((r) => ({
          item_id: r.item_id,
          name: r.name,
          kind: r.kind,
          total_saida: Number(r.total_saida ?? 0),
          saida_em_producao: Number(r.saida_em_producao ?? 0),
          saida_manual: Number(r.saida_manual ?? 0),
        })),
        municao_no_periodo: {
          entrada_por_producao: municaoEntradaProducao,
          saida_distribuicao: municaoSaidaDistribuicao,
        },
        estoque_atual: estoqueAtual,
      })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao gerar relatório.')
    }
  })

  app.get('/api/club/production/batches', (req, res) => {
    try {
      const lim = Math.min(500, Math.max(1, Math.floor(Number(req.query.limit)) || 100))
      const rows = allRows(
        db,
        `SELECT id, caliber_id, municoes_produzidas, date, notes, created_at
         FROM club_production_batches
         ORDER BY date DESC
         LIMIT ?`,
        [lim],
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar lotes.')
    }
  })

  app.put('/api/club/production/batches/:id', (req, res) => {
    try {
      const batchId = req.params.id
      const batchRows = allRows(
        db,
        `SELECT id, caliber_id, municoes_produzidas, date, notes, created_at
         FROM club_production_batches WHERE id = ?`,
        [batchId],
      )
      if (!batchRows.length) {
        return jsonError(res, 404, 'Lote não encontrado.')
      }
      const batch = batchRows[0]
      const nextQtyRaw =
        req.body?.municoes_produzidas != null
          ? req.body.municoes_produzidas
          : batch.municoes_produzidas
      const nextQty = Math.floor(Number(nextQtyRaw))
      if (!Number.isFinite(nextQty) || nextQty <= 0) {
        return jsonError(res, 400, 'municoes_produzidas deve ser um inteiro positivo.')
      }
      const nextDate =
        req.body?.date != null && String(req.body.date).trim()
          ? String(req.body.date).trim()
          : batch.date
      const nextNotes =
        req.body?.notes !== undefined
          ? req.body.notes != null
            ? String(req.body.notes).trim() || null
            : null
          : batch.notes

      const batchMovs = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id
         FROM club_stock_movements
         WHERE production_batch_id = ?`,
        [batchId],
      )
      if (!batchMovs.length) {
        return jsonError(
          res,
          409,
          'Este lote não possui movimentos de estoque vinculados para ajustar.',
        )
      }

      const oldQty = Number(batch.municoes_produzidas)
      if (!Number.isFinite(oldQty) || oldQty <= 0) {
        return jsonError(res, 409, 'O lote atual está inválido para edição.')
      }

      const impactedByItem = new Map()
      for (const mov of batchMovs) {
        const oldSigned = signedMovementQty(mov.type, mov.quantity)
        const perUnit = oldSigned / oldQty
        const newSigned = perUnit * nextQty
        const prev = impactedByItem.get(mov.item_id) || { oldSigned: 0, newSigned: 0 }
        impactedByItem.set(mov.item_id, {
          oldSigned: prev.oldSigned + oldSigned,
          newSigned: prev.newSigned + newSigned,
        })
      }
      for (const [itemId, impact] of impactedByItem.entries()) {
        const current = stockForItem(db, itemId)
        const nextStock = current - impact.oldSigned + impact.newSigned
        if (nextStock < -1e-9) {
          return jsonError(
            res,
            400,
            'A edição deixaria um item com saldo negativo. Ajuste a quantidade do lote.',
          )
        }
      }

      runDb(
        db,
        `UPDATE club_production_batches SET municoes_produzidas = ?, date = ?, notes = ? WHERE id = ?`,
        [nextQty, nextDate, nextNotes, batchId],
      )
      for (const mov of batchMovs) {
        const oldSigned = signedMovementQty(mov.type, mov.quantity)
        const perUnit = oldSigned / oldQty
        const nextSigned = perUnit * nextQty
        const nextType = nextSigned >= 0 ? 'entrada' : 'saida'
        const nextAbsQty = Math.abs(nextSigned)
        runDb(
          db,
          `UPDATE club_stock_movements
           SET type = ?, quantity = ?, date = ?
           WHERE id = ?`,
          [nextType, nextAbsQty, nextDate, mov.id],
        )
      }
      save()

      const updatedBatch = allRows(
        db,
        `SELECT id, caliber_id, municoes_produzidas, date, notes, created_at
         FROM club_production_batches WHERE id = ?`,
        [batchId],
      )[0]
      q('club_production_batches', batchId, 'UPDATE', updatedBatch)
      const updatedMovs = allRows(
        db,
        `SELECT id, item_id, type, quantity, date, notes, production_batch_id
         FROM club_stock_movements WHERE production_batch_id = ?`,
        [batchId],
      )
      for (const mov of updatedMovs) {
        q('club_stock_movements', mov.id, 'UPDATE', clubMovementPayload(mov))
      }
      res.json(updatedBatch)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar lote.')
    }
  })

  app.delete('/api/club/production/batches/:id', (req, res) => {
    try {
      const batchId = req.params.id
      const batchRows = allRows(db, `SELECT id FROM club_production_batches WHERE id = ?`, [batchId])
      if (!batchRows.length) {
        return jsonError(res, 404, 'Lote não encontrado.')
      }
      const movRows = allRows(
        db,
        `SELECT id FROM club_stock_movements WHERE production_batch_id = ?`,
        [batchId],
      )
      for (const row of movRows) {
        q('club_stock_movements', row.id, 'DELETE', null)
      }
      runDb(db, `DELETE FROM club_stock_movements WHERE production_batch_id = ?`, [batchId])
      runDb(db, `DELETE FROM club_production_batches WHERE id = ?`, [batchId])
      save()
      q('club_production_batches', batchId, 'DELETE', null)
      res.status(204).end()
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir lote.')
    }
  })
}

module.exports = { registerClubRoutes }
