const path = require('path')
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const { openDatabase, openClubDatabase } = require('./db.js')
const { registerClubRoutes } = require('./clubRoutes.js')
const { registerAlertRoutes } = require('./alertRoutes.js')
const { safeSyncAfterStockChange } = require('./alertsLowStock.js')
const syncOutbox = require('./syncOutbox.js')
const {
  pushOnce: pushSupabaseOnce,
  isSyncConfigured,
  integrityLocalCounts,
  getSyncState,
} = require('./supabaseSync.js')

/** @type {import('http').Server | null} */
let httpServer = null
/** @type {import('sql.js').Database | null} */
let sqlDb = null
/** @type {(() => void) | null} */
let persistDb = null
/** Banco do clube (separado da loja). */
let sqlClubDb = null
/** @type {(() => void) | null} */
let persistClubDb = null
/** Só true quando este processo é o PC servidor (Electron modo servidor) — envio ao Supabase. */
let supabasePushEnabled = false

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
 * @param {string} ammoTypeId
 */
function ammoStockForType(db, ammoTypeId) {
  const rows = allRows(
    db,
    `SELECT COALESCE(SUM(
      CASE WHEN type = 'entrada' THEN quantity
           WHEN type = 'saida' THEN -quantity
           ELSE 0 END
    ), 0) AS stock
     FROM ammo_movements WHERE ammo_type_id = ?`,
    [ammoTypeId],
  )
  return Math.round(Number(rows[0]?.stock ?? 0))
}

/**
 * @param {import('sql.js').Database} db — loja
 * @param {() => void} save
 * @param {import('sql.js').Database} clubDb — clube (insumos / produção)
 * @param {() => void} saveClub
 */
function createApp(db, save, clubDb, saveClub) {
  const app = express()
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json())

  /** @param {string} table @param {string|number} entityId @param {'INSERT'|'UPDATE'|'DELETE'} op @param {object|null} [payload] */
  const qShop = (table, entityId, op, payload) =>
    syncOutbox.enqueueChange(db, save, {
      entityTable: table,
      entityId: String(entityId),
      op,
      payload: payload ?? null,
    })
  /** @param {string} table @param {string|number} entityId @param {'INSERT'|'UPDATE'|'DELETE'} op @param {object|null} [payload] */
  const qClub = (table, entityId, op, payload) =>
    syncOutbox.enqueueChange(clubDb, saveClub, {
      entityTable: table,
      entityId: String(entityId),
      op,
      payload: payload ?? null,
    })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/calibers', (req, res) => {
    try {
      const productType = req.query.product_type
      const rows = productType
        ? allRows(
            db,
            `SELECT id, name, product_type FROM calibers
             WHERE product_type = ? ORDER BY name COLLATE NOCASE`,
            [productType],
          )
        : allRows(
            db,
            `SELECT id, name, product_type FROM calibers ORDER BY name COLLATE NOCASE`,
          )
      rows.sort((a, b) => {
        const t = String(a.product_type ?? 'municao').localeCompare(
          String(b.product_type ?? 'municao'),
        )
        if (t !== 0) return t
        return String(a.name).localeCompare(String(b.name), 'pt-BR', {
          sensitivity: 'base',
        })
      })
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar calibres.')
    }
  })

  app.post('/api/calibers', (req, res) => {
    try {
      const { name, product_type: productType } = req.body || {}
      if (!name || !productType) {
        return jsonError(res, 400, 'name e product_type são obrigatórios.')
      }
      const id = crypto.randomUUID()
      runDb(
        db,
        `INSERT INTO calibers (id, name, product_type) VALUES (?, ?, ?)`,
        [id, String(name).trim(), productType],
      )
      save()
      const row = allRows(db, `SELECT id, name, product_type FROM calibers WHERE id = ?`, [
        id,
      ])[0]
      qShop('calibers', id, 'INSERT', row)
      res.status(201).json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE constraint')) {
        return jsonError(
          res,
          409,
          'Já existe calibre com este nome para este tipo de produto.',
        )
      }
      jsonError(res, 500, e.message || 'Erro ao criar calibre.')
    }
  })

  app.get('/api/ammo-types-with-calibers', (_req, res) => {
    try {
      const types = allRows(
        db,
        `SELECT id, name, caliber_id, created_at FROM ammo_types ORDER BY name COLLATE NOCASE`,
      )
      const calibers = allRows(db, `SELECT id, name, product_type FROM calibers`)
      const calMap = new Map(calibers.map((c) => [c.id, c]))
      const hasCreatedAt = types.some((t) => t.created_at != null)
      const ammoTypes = types.map((t) => {
        const cal = calMap.get(t.caliber_id)
        const caliberName = cal?.name ?? '—'
        const productType = cal?.product_type ?? 'municao'
        return {
          id: t.id,
          ammo_name: t.name,
          caliber: caliberName,
          product_type: productType,
          label: `${t.name} — ${caliberName}`,
          created_at: t.created_at ?? null,
        }
      })
      res.json({ ammoTypes, hasCreatedAt })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar produtos.')
    }
  })

  app.post('/api/ammo-types', (req, res) => {
    try {
      const { caliber_id: caliberId, name } = req.body || {}
      if (!caliberId || !name) {
        return jsonError(res, 400, 'caliber_id e name são obrigatórios.')
      }
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      runDb(
        db,
        `INSERT INTO ammo_types (id, name, caliber_id, created_at) VALUES (?, ?, ?, ?)`,
        [id, String(name).trim(), caliberId, now],
      )
      save()
      const row = allRows(
        db,
        `SELECT id, name, caliber_id, created_at FROM ammo_types WHERE id = ?`,
        [id],
      )[0]
      qShop('ammo_types', id, 'INSERT', row)
      res.status(201).json(row)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao criar produto.')
    }
  })

  app.patch('/api/ammo-types/:id', (req, res) => {
    try {
      const id = req.params.id
      const { name } = req.body || {}
      const trimmed = name != null ? String(name).trim() : ''
      if (!trimmed) {
        return jsonError(res, 400, 'name é obrigatório.')
      }
      const existing = allRows(db, `SELECT id FROM ammo_types WHERE id = ?`, [id])
      if (!existing.length) {
        return jsonError(res, 404, 'Produto não encontrado.')
      }
      runDb(db, `UPDATE ammo_types SET name = ? WHERE id = ?`, [trimmed, id])
      save()
      const row = allRows(
        db,
        `SELECT id, name, caliber_id, created_at FROM ammo_types WHERE id = ?`,
        [id],
      )[0]
      qShop('ammo_types', id, 'UPDATE', row)
      res.json(row)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar produto.')
    }
  })

  app.delete('/api/ammo-types/:id', (req, res) => {
    try {
      const id = req.params.id
      const existing = allRows(db, `SELECT id FROM ammo_types WHERE id = ?`, [id])
      if (!existing.length) {
        return jsonError(res, 404, 'Produto não encontrado.')
      }
      const movIds = allRows(db, `SELECT id FROM ammo_movements WHERE ammo_type_id = ?`, [id])
      for (const m of movIds) {
        qShop('ammo_movements', m.id, 'DELETE', null)
      }
      qShop('ammo_types', id, 'DELETE', null)
      runDb(db, `DELETE FROM ammo_movements WHERE ammo_type_id = ?`, [id])
      runDb(db, `DELETE FROM ammo_types WHERE id = ?`, [id])
      save()
      res.json({ ok: true })
      safeSyncAfterStockChange(db, save)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir produto.')
    }
  })

  app.get('/api/ammo-stock', (_req, res) => {
    try {
      const rows = allRows(
        db,
        `SELECT
          at.id AS ammo_type_id,
          at.name AS ammo_name,
          c.name AS caliber,
          COALESCE(c.product_type, 'municao') AS product_type,
          COALESCE((
            SELECT SUM(
              CASE
                WHEN m.type = 'entrada' THEN m.quantity
                WHEN m.type = 'saida' THEN -m.quantity
                ELSE 0
              END
            )
            FROM ammo_movements m
            WHERE m.ammo_type_id = at.id
          ), 0) AS stock
        FROM ammo_types at
        JOIN calibers c ON c.id = at.caliber_id
        ORDER BY at.name COLLATE NOCASE`,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar estoque.')
    }
  })

  app.get('/api/ammo-movements/report', (_req, res) => {
    try {
      const page = 1000
      const all = []
      let offset = 0
      for (;;) {
        const chunk = allRows(
          db,
          `SELECT ammo_type_id, quantity, type, date FROM ammo_movements
           ORDER BY date ASC LIMIT ? OFFSET ?`,
          [page, offset],
        )
        if (!chunk.length) break
        all.push(...chunk)
        if (chunk.length < page) break
        offset += page
      }
      res.json(all)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar movimentações.')
    }
  })

  app.get('/api/ammo-movements/recent', (req, res) => {
    try {
      const lim = Math.min(
        500,
        Math.max(1, Math.floor(Number(req.query.limit)) || 200),
      )
      const movements = allRows(
        db,
        `SELECT m.id, m.ammo_type_id, m.quantity, m.type, m.date, m.saida_group_id,
                m.nf_number,
                at.name AS at_name, c.name AS cal_name,
                COALESCE(c.product_type, 'municao') AS product_type
         FROM ammo_movements m
         JOIN ammo_types at ON at.id = m.ammo_type_id
         JOIN calibers c ON c.id = at.caliber_id
         ORDER BY m.date DESC
         LIMIT ?`,
        [lim],
      )
      const out = movements.map((m) => ({
        id: m.id,
        date: m.date,
        type: m.type,
        quantity: m.quantity,
        ammo_type_id: m.ammo_type_id,
        saida_group_id: m.saida_group_id ?? null,
        nf_number: m.nf_number ?? null,
        productName: m.at_name ?? '—',
        caliber: m.cal_name ?? '—',
        product_type: m.product_type ?? 'municao',
      }))
      res.json(out)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar movimentações recentes.')
    }
  })

  app.get('/api/ammo-movements/search', (req, res) => {
    try {
      const caliberRaw = req.query.caliber
      const caliber =
        caliberRaw != null && String(caliberRaw).trim() !== ''
          ? String(caliberRaw).trim()
          : ''
      const dateFrom =
        req.query.dateFrom != null ? String(req.query.dateFrom).trim() : ''
      const dateTo =
        req.query.dateTo != null ? String(req.query.dateTo).trim() : ''
      const nfRaw = req.query.nfNumber
      const nfNumber =
        nfRaw != null && String(nfRaw).trim() !== ''
          ? String(nfRaw).trim()
          : ''

      let sql = `SELECT m.id, m.ammo_type_id, m.quantity, m.type, m.date, m.saida_group_id,
                m.nf_number,
                at.name AS at_name, c.name AS cal_name,
                COALESCE(c.product_type, 'municao') AS product_type
         FROM ammo_movements m
         JOIN ammo_types at ON at.id = m.ammo_type_id
         JOIN calibers c ON c.id = at.caliber_id
         WHERE 1=1`
      const params = []

      if (caliber) {
        sql += ` AND c.name LIKE ? COLLATE NOCASE`
        params.push(`%${caliber}%`)
      }
      if (dateFrom) {
        sql += ` AND m.date >= ?`
        params.push(dateFrom)
      }
      if (dateTo) {
        sql += ` AND m.date <= ?`
        params.push(dateTo)
      }
      if (nfNumber) {
        sql += ` AND m.nf_number LIKE ? COLLATE NOCASE`
        params.push(`%${nfNumber}%`)
      }
      sql += ` ORDER BY m.date DESC`

      const movements = allRows(db, sql, params)
      const out = movements.map((m) => ({
        id: m.id,
        date: m.date,
        type: m.type,
        quantity: m.quantity,
        ammo_type_id: m.ammo_type_id,
        saida_group_id: m.saida_group_id ?? null,
        nf_number: m.nf_number ?? null,
        productName: m.at_name ?? '—',
        caliber: m.cal_name ?? '—',
        product_type: m.product_type ?? 'municao',
      }))
      res.json(out)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao pesquisar movimentações.')
    }
  })

  app.post('/api/ammo-movements', (req, res) => {
    try {
      const body = req.body || {}
      const { ammo_type_id, quantity, type, date, saida_group_id, nf_number } =
        body
      if (!ammo_type_id || !type || quantity == null || !date) {
        return jsonError(
          res,
          400,
          'ammo_type_id, type, quantity e date são obrigatórios.',
        )
      }
      if (type !== 'entrada' && type !== 'saida') {
        return jsonError(res, 400, 'Tipo de movimentação inválido.')
      }
      const qty = Math.floor(Number(quantity))
      if (!Number.isFinite(qty) || qty <= 0 || qty !== Number(quantity)) {
        return jsonError(res, 400, 'Quantidade deve ser um inteiro positivo.')
      }
      const ammoExists = allRows(
        db,
        `SELECT id FROM ammo_types WHERE id = ?`,
        [ammo_type_id],
      )
      if (!ammoExists.length) {
        return jsonError(res, 404, 'Produto não encontrado.')
      }
      if (type === 'saida') {
        const available = ammoStockForType(db, ammo_type_id)
        if (available < qty) {
          return jsonError(
            res,
            400,
            `Saldo insuficiente. Em estoque: ${available}.`,
          )
        }
      }
      const nfTrim =
        nf_number != null && String(nf_number).trim() !== ''
          ? String(nf_number).trim()
          : null
      const nfStored = type === 'entrada' ? nfTrim : null
      runDb(
        db,
        `INSERT INTO ammo_movements (ammo_type_id, quantity, type, date, saida_group_id, nf_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ammo_type_id,
          qty,
          type,
          date,
          saida_group_id != null ? saida_group_id : null,
          nfStored,
        ],
      )
      save()
      const rid = allRows(db, `SELECT last_insert_rowid() AS id`)[0]?.id
      const inserted = allRows(
        db,
        `SELECT id, ammo_type_id, quantity, type, date, saida_group_id, nf_number FROM ammo_movements WHERE id = ?`,
        [rid],
      )[0]
      if (inserted) {
        qShop('ammo_movements', inserted.id, 'INSERT', {
          local_id: inserted.id,
          ammo_type_id: inserted.ammo_type_id,
          quantity: inserted.quantity,
          type: inserted.type,
          date: inserted.date,
          saida_group_id: inserted.saida_group_id ?? null,
          nf_number: inserted.nf_number ?? null,
        })
      }
      res.status(201).json({ ok: true })
      safeSyncAfterStockChange(db, save)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao registrar movimentação.')
    }
  })

  /**
   * Exclui uma entrada pelo id local da movimentação.
   * Valida saldo antes de remover; o estoque é recalculado pela soma das movimentações.
   */
  app.delete('/api/ammo-movements/entrada/:id', (req, res) => {
    try {
      const rawId = req.params.id
      const movementId = Math.floor(Number(rawId))
      if (!Number.isFinite(movementId) || movementId <= 0) {
        return jsonError(res, 400, 'Id de movimentação inválido.')
      }
      const row = allRows(
        db,
        `SELECT id, type, ammo_type_id, quantity FROM ammo_movements WHERE id = ?`,
        [movementId],
      )[0]
      if (!row) return jsonError(res, 404, 'Movimentação não encontrada.')
      if (row.type !== 'entrada') {
        return jsonError(res, 400, 'Só é possível excluir entradas.')
      }

      const s = ammoStockForType(db, row.ammo_type_id)
      if (s - row.quantity < 0) {
        return jsonError(
          res,
          400,
          'Saldo não permite excluir esta entrada.',
        )
      }

      runDb(db, `DELETE FROM ammo_movements WHERE id = ?`, [movementId])
      qShop('ammo_movements', movementId, 'DELETE', null)
      save()
      res.json({ ok: true })
      safeSyncAfterStockChange(db, save)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir entrada.')
    }
  })

  /**
   * Exclui uma saída pelo id local da movimentação.
   * Se houver saida_group_id, remove todas as linhas do mesmo termo; o estoque volta pelo cálculo SUM.
   */
  app.delete('/api/ammo-movements/saida/:id', (req, res) => {
    try {
      const rawId = req.params.id
      const movementId = Math.floor(Number(rawId))
      if (!Number.isFinite(movementId) || movementId <= 0) {
        return jsonError(res, 400, 'Id de movimentação inválido.')
      }
      const row = allRows(
        db,
        `SELECT id, type, saida_group_id FROM ammo_movements WHERE id = ?`,
        [movementId],
      )[0]
      if (!row) return jsonError(res, 404, 'Movimentação não encontrada.')
      if (row.type !== 'saida') {
        return jsonError(res, 400, 'Só é possível excluir saídas.')
      }

      const groupId = row.saida_group_id != null ? String(row.saida_group_id) : ''
      let idsToUnsync = [movementId]

      if (groupId) {
        const groupRows = allRows(
          db,
          `SELECT id FROM ammo_movements WHERE type = 'saida' AND saida_group_id = ?`,
          [groupId],
        )
        idsToUnsync = groupRows.map((r) => r.id)
        runDb(
          db,
          `DELETE FROM ammo_movements WHERE type = 'saida' AND saida_group_id = ?`,
          [groupId],
        )
      } else {
        runDb(db, `DELETE FROM ammo_movements WHERE id = ?`, [movementId])
      }

      for (const lid of idsToUnsync) {
        qShop('ammo_movements', lid, 'DELETE', null)
      }
      save()
      res.json({ ok: true, deleted: idsToUnsync.length })
      safeSyncAfterStockChange(db, save)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir saída.')
    }
  })

  app.patch('/api/ammo-movements/:id', (req, res) => {
    try {
      const rawId = req.params.id
      const movementId = Math.floor(Number(rawId))
      if (!Number.isFinite(movementId) || movementId <= 0) {
        return jsonError(res, 400, 'Id de movimentação inválido.')
      }
      const body = req.body || {}
      const { quantity, date, nf_number } = body
      if (
        quantity === undefined &&
        date === undefined &&
        nf_number === undefined
      ) {
        return jsonError(
          res,
          400,
          'Informe quantidade, data e/ou número da NF para alterar.',
        )
      }
      const rows = allRows(
        db,
        `SELECT id, ammo_type_id, quantity, type, date, nf_number FROM ammo_movements WHERE id = ?`,
        [movementId],
      )
      const row = rows[0]
      if (!row) return jsonError(res, 404, 'Movimentação não encontrada.')

      let newQty = row.quantity
      if (quantity !== undefined) {
        const q = Math.floor(Number(quantity))
        if (!Number.isFinite(q) || q <= 0) {
          return jsonError(res, 400, 'Quantidade deve ser um inteiro positivo.')
        }
        newQty = q
      }

      let newDate = row.date
      if (date !== undefined) {
        const d = new Date(date)
        if (Number.isNaN(d.getTime())) {
          return jsonError(res, 400, 'Data inválida.')
        }
        newDate = d.toISOString()
      }

      if (newQty !== row.quantity) {
        const s = ammoStockForType(db, row.ammo_type_id)
        const q1 = row.quantity
        const q2 = newQty
        if (row.type === 'entrada') {
          if (s + (q2 - q1) < 0) {
            return jsonError(
              res,
              400,
              'Saldo não permite reduzir esta entrada.',
            )
          }
        } else if (row.type === 'saida') {
          if (s + (q1 - q2) < 0) {
            return jsonError(
              res,
              400,
              'Saldo insuficiente para aumentar esta saída.',
            )
          }
        }
      }

      let newNf = row.nf_number ?? null
      if (nf_number !== undefined) {
        if (row.type !== 'entrada') {
          return jsonError(
            res,
            400,
            'Número da NF só se aplica a entradas.',
          )
        }
        newNf =
          nf_number != null && String(nf_number).trim() !== ''
            ? String(nf_number).trim()
            : null
      }

      runDb(
        db,
        `UPDATE ammo_movements SET quantity = ?, date = ?, nf_number = ? WHERE id = ?`,
        [newQty, newDate, newNf, movementId],
      )
      save()
      const upd = allRows(
        db,
        `SELECT id, ammo_type_id, quantity, type, date, saida_group_id, nf_number FROM ammo_movements WHERE id = ?`,
        [movementId],
      )[0]
      if (upd) {
        qShop('ammo_movements', movementId, 'UPDATE', {
          local_id: upd.id,
          ammo_type_id: upd.ammo_type_id,
          quantity: upd.quantity,
          type: upd.type,
          date: upd.date,
          saida_group_id: upd.saida_group_id ?? null,
          nf_number: upd.nf_number ?? null,
        })
      }
      res.json({ ok: true })
      safeSyncAfterStockChange(db, save)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar movimentação.')
    }
  })

  app.get('/api/weapon-types', (_req, res) => {
    try {
      const rows = allRows(
        db,
        `SELECT id, name FROM weapon_types ORDER BY name COLLATE NOCASE`,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar tipos de arma.')
    }
  })

  app.post('/api/weapon-types', (req, res) => {
    try {
      const name = (req.body?.name ?? '').trim()
      if (!name) return jsonError(res, 400, 'Nome é obrigatório.')
      const id = crypto.randomUUID()
      runDb(db, `INSERT INTO weapon_types (id, name) VALUES (?, ?)`, [id, name])
      save()
      const row = allRows(db, `SELECT id, name FROM weapon_types WHERE id = ?`, [
        id,
      ])[0]
      qShop('weapon_types', id, 'INSERT', row)
      res.status(201).json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return jsonError(res, 409, 'Tipo já cadastrado.')
      }
      jsonError(res, 500, e.message || 'Erro ao criar tipo.')
    }
  })

  app.get('/api/weapon-brands', (_req, res) => {
    try {
      const rows = allRows(
        db,
        `SELECT id, name FROM weapon_brands ORDER BY name COLLATE NOCASE`,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar marcas.')
    }
  })

  app.post('/api/weapon-brands', (req, res) => {
    try {
      const name = (req.body?.name ?? '').trim()
      if (!name) return jsonError(res, 400, 'Nome é obrigatório.')
      const id = crypto.randomUUID()
      runDb(db, `INSERT INTO weapon_brands (id, name) VALUES (?, ?)`, [id, name])
      save()
      const row = allRows(db, `SELECT id, name FROM weapon_brands WHERE id = ?`, [
        id,
      ])[0]
      qShop('weapon_brands', id, 'INSERT', row)
      res.status(201).json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return jsonError(res, 409, 'Marca já cadastrada.')
      }
      jsonError(res, 500, e.message || 'Erro ao criar marca.')
    }
  })

  app.get('/api/weapons', (_req, res) => {
    try {
      const rows = allRows(
        db,
        `SELECT * FROM weapons ORDER BY created_at DESC`,
      )
      res.json(rows)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao listar armas.')
    }
  })

  app.post('/api/weapons', (req, res) => {
    try {
      const row = req.body || {}
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      runDb(
        db,
        `INSERT INTO weapons (
          id, name, weapon_type_id, brand_id, caliber_id, owner, status, type, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          row.name,
          row.weapon_type_id ?? null,
          row.brand_id ?? null,
          row.caliber_id ?? null,
          row.owner,
          row.status ?? 'em_estoque',
          row.type ?? null,
          row.notes ?? null,
          now,
        ],
      )
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [id])[0]
      if (full) qShop('weapons', id, 'INSERT', full)
      res.status(201).json({ id })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao cadastrar arma.')
    }
  })

  function withdrawalIsoFromBody(body) {
    const raw = String(body?.withdrawnAt ?? body?.withdrawn_at ?? '').trim()
    if (!raw) return new Date().toISOString()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number)
      const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
      if (
        !Number.isNaN(dt.getTime()) &&
        dt.getFullYear() === y &&
        dt.getMonth() === m - 1 &&
        dt.getDate() === d
      ) {
        return dt.toISOString()
      }
    }
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    return new Date().toISOString()
  }

  function buildWithdrawalNoteLine(responsible, iso) {
    return responsible
      ? `Retirada — responsável: ${responsible} (${iso})`
      : `Retirada (${iso})`
  }

  function setWeaponSerialInNotes(notes, serial) {
    const sn = String(serial ?? '').trim()
    const lines = String(notes ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^\s*S\/N:/i.test(l))
    if (sn) lines.unshift(`S/N: ${sn}`)
    return lines.length > 0 ? lines.join('\n') : null
  }

  function isRetiradaNoteLine(line) {
    const t = String(line ?? '').trim()
    return /^Retirada(\s*—|\s*\()/i.test(t)
  }

  function isTermoEntregaNoteLine(line) {
    return /^Termo entrega\s*—/i.test(String(line ?? '').trim())
  }

  function buildTermoEntregaNoteLine(termo) {
    const rg = String(termo?.rg ?? '').trim()
    const cpfRaw = String(termo?.cpf ?? '').trim()
    const sigma = String(termo?.sigmaSinarm ?? termo?.sigma_sinarm ?? '').trim()
    const cpfDigits = cpfRaw.replace(/\D/g, '')
    const cpfFmt =
      cpfDigits.length === 11
        ? `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`
        : cpfRaw
    return `Termo entrega — RG: ${rg} | CPF: ${cpfFmt} | SINARM/SIGMA: ${sigma}`
  }

  function rebuildWeaponNotesWithDelivery(prevNotes, { responsible, withdrawnAtIso, termoEntrega }) {
    const lines = String(prevNotes ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const kept = lines.filter((l) => !isRetiradaNoteLine(l) && !isTermoEntregaNoteLine(l))
    kept.push(buildWithdrawalNoteLine(responsible, withdrawnAtIso))
    if (termoEntrega && typeof termoEntrega === 'object') {
      kept.push(buildTermoEntregaNoteLine(termoEntrega))
    }
    return kept.join('\n')
  }

  app.patch('/api/weapons/:id/checkout', (req, res) => {
    try {
      const weaponId = req.params.id
      const responsible = (req.body?.responsible ?? '').trim()
      const iso = withdrawalIsoFromBody(req.body)
      const current = allRows(db, `SELECT notes FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!current) return jsonError(res, 404, 'Arma não encontrada.')
      const line = buildWithdrawalNoteLine(responsible, iso)
      const prev = (current.notes ?? '').trim()
      const notes = prev ? `${prev}\n${line}` : line
      runDb(
        db,
        `UPDATE weapons SET status = 'retirada', notes = ? WHERE id = ?`,
        [notes, weaponId],
      )
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [weaponId])[0]
      if (full) qShop('weapons', weaponId, 'UPDATE', full)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao registrar retirada.')
    }
  })

  function updateWeaponById(req, res) {
    try {
      const weaponId = req.params.id
      const owner = (req.body?.owner ?? '').trim()
      const status = req.body?.status
      const responsible = (req.body?.responsible ?? '').trim()

      if (!owner) {
        return jsonError(res, 400, 'Informe o dono.')
      }
      if (status !== 'em_estoque' && status !== 'retirada') {
        return jsonError(res, 400, 'Situação inválida.')
      }

      const current = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!current) return jsonError(res, 404, 'Arma não encontrada.')

      if (status === 'retirada') {
        const iso = withdrawalIsoFromBody(req.body)
        const line = buildWithdrawalNoteLine(responsible, iso)
        const prev = (current.notes ?? '').trim()
        let notes = prev ? `${prev}\n${line}` : line
        const termo = req.body?.termoEntrega
        if (termo && typeof termo === 'object') {
          const rg = String(termo.rg ?? '').trim()
          const cpf = String(termo.cpf ?? '').trim()
          const sigma = String(termo.sigmaSinarm ?? termo.sigma_sinarm ?? '').trim()
          if (rg || cpf || sigma) {
            const cpfDigits = cpf.replace(/\D/g, '')
            const cpfFmt =
              cpfDigits.length === 11
                ? `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`
                : cpf
            notes = `${notes}\nTermo entrega — RG: ${rg} | CPF: ${cpfFmt} | SINARM/SIGMA: ${sigma}`
          }
        }
        runDb(
          db,
          `UPDATE weapons SET owner = ?, status = 'retirada', notes = ? WHERE id = ?`,
          [owner, notes, weaponId],
        )
      } else {
        runDb(
          db,
          `UPDATE weapons SET owner = ?, status = 'em_estoque' WHERE id = ?`,
          [owner, weaponId],
        )
      }
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [weaponId])[0]
      if (full) qShop('weapons', weaponId, 'UPDATE', full)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar arma.')
    }
  }

  app.patch('/api/weapons/:id', updateWeaponById)
  app.post('/api/weapons/:id/update', updateWeaponById)

  app.patch('/api/weapons/:id/details', (req, res) => {
    try {
      const weaponId = req.params.id
      const body = req.body || {}
      const name = String(body.name ?? '').trim()
      const owner = String(body.owner ?? '').trim()
      const weaponTypeId = body.weapon_type_id ?? body.weaponTypeId
      const brandId = body.brand_id ?? body.brandId
      const caliberId = body.caliber_id ?? body.caliberId
      const legacyType = String(body.type ?? '').trim() || '—'
      const serial =
        body.serial != null ? String(body.serial).trim() : undefined

      if (!name) return jsonError(res, 400, 'Informe o modelo da arma.')
      if (!weaponTypeId) return jsonError(res, 400, 'Selecione o tipo da arma.')
      if (!brandId) return jsonError(res, 400, 'Selecione a marca.')
      if (!caliberId) return jsonError(res, 400, 'Selecione um calibre.')
      if (!owner) return jsonError(res, 400, 'Informe o dono.')

      const current = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!current) return jsonError(res, 404, 'Arma não encontrada.')

      const notes =
        serial !== undefined
          ? setWeaponSerialInNotes(current.notes, serial)
          : current.notes

      runDb(
        db,
        `UPDATE weapons SET name = ?, weapon_type_id = ?, brand_id = ?, caliber_id = ?, owner = ?, type = ?, notes = ? WHERE id = ?`,
        [
          name,
          weaponTypeId,
          brandId,
          caliberId,
          owner,
          legacyType,
          notes,
          weaponId,
        ],
      )
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [weaponId])[0]
      if (full) qShop('weapons', weaponId, 'UPDATE', full)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar dados da arma.')
    }
  })

  app.patch('/api/weapons/:id/delivery', (req, res) => {
    try {
      const weaponId = req.params.id
      const owner = (req.body?.owner ?? '').trim()
      const responsible = (req.body?.responsible ?? '').trim()

      if (!owner) {
        return jsonError(res, 400, 'Informe o dono.')
      }

      const current = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!current) return jsonError(res, 404, 'Arma não encontrada.')
      if (current.status !== 'retirada') {
        return jsonError(res, 400, 'Esta arma não está registrada como retirada.')
      }

      const iso = withdrawalIsoFromBody(req.body)
      const notes = rebuildWeaponNotesWithDelivery(current.notes, {
        responsible,
        withdrawnAtIso: iso,
        termoEntrega: req.body?.termoEntrega,
      })

      runDb(
        db,
        `UPDATE weapons SET owner = ?, notes = ? WHERE id = ?`,
        [owner, notes, weaponId],
      )
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [weaponId])[0]
      if (full) qShop('weapons', weaponId, 'UPDATE', full)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao atualizar entrega.')
    }
  })

  app.patch('/api/weapons/:id/mark-purchased', (req, res) => {
    try {
      const weaponId = req.params.id
      const current = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!current) return jsonError(res, 404, 'Arma não encontrada.')
      if (current.status !== 'para_compra') {
        return jsonError(
          res,
          400,
          'Só é possível marcar armas com status "Para compra".',
        )
      }
      runDb(
        db,
        `UPDATE weapons SET status = 'aguardando_chegada' WHERE id = ?`,
        [weaponId],
      )
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [weaponId])[0]
      if (full) qShop('weapons', weaponId, 'UPDATE', full)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao marcar arma como comprada.')
    }
  })

  app.patch('/api/weapons/:id/acquire-sale', (req, res) => {
    try {
      const weaponId = req.params.id
      const serial = String(req.body?.serial ?? '').trim()
      const destination = String(req.body?.destination ?? '').trim()

      if (!serial) return jsonError(res, 400, 'Informe o número de série.')
      if (destination !== 'estoque' && destination !== 'dono') {
        return jsonError(
          res,
          400,
          'Escolha o destino: estoque da loja ou armas com dono.',
        )
      }

      const current = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!current) return jsonError(res, 404, 'Arma não encontrada.')
      if (
        current.status !== 'para_compra' &&
        current.status !== 'aguardando_chegada'
      ) {
        return jsonError(
          res,
          400,
          'Esta arma não está na lista de armas para compra.',
        )
      }

      const owner =
        destination === 'estoque'
          ? 'estoque'
          : String(current.owner ?? '').trim()
      if (!owner) {
        return jsonError(res, 400, 'Cliente (dono) não encontrado nesta venda.')
      }

      const notes = setWeaponSerialInNotes(current.notes, serial)
      runDb(
        db,
        `UPDATE weapons SET status = 'em_estoque', owner = ?, notes = ? WHERE id = ?`,
        [owner, notes, weaponId],
      )
      save()
      const full = allRows(db, `SELECT * FROM weapons WHERE id = ?`, [weaponId])[0]
      if (full) qShop('weapons', weaponId, 'UPDATE', full)
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao adquirir arma da venda.')
    }
  })

  app.delete('/api/weapons/:id', (req, res) => {
    try {
      const weaponId = req.params.id
      const existing = allRows(db, `SELECT id FROM weapons WHERE id = ?`, [
        weaponId,
      ])[0]
      if (!existing) return jsonError(res, 404, 'Arma não encontrada.')
      qShop('weapons', weaponId, 'DELETE', null)
      runDb(db, `DELETE FROM weapons WHERE id = ?`, [weaponId])
      save()
      res.json({ ok: true })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao excluir arma.')
    }
  })

  app.get('/api/sync/status', (_req, res) => {
    try {
      const st = getSyncState()
      res.json({
        ...st,
        supabasePushEnabled,
      })
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro ao ler estado de sync.')
    }
  })

  app.get('/api/sync/integrity', (_req, res) => {
    try {
      res.json(integrityLocalCounts(db, clubDb))
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro na verificação.')
    }
  })

  app.post('/api/sync/run', async (_req, res) => {
    try {
      if (!supabasePushEnabled) {
        return jsonError(
          res,
          403,
          'Sincronização remota só é executada no PC em modo servidor.',
        )
      }
      if (!isSyncConfigured()) {
        return jsonError(
          res,
          503,
      'Supabase não configurado (cole a anon key em ORB_SUPABASE_SYNC_KEY no .env).',
        )
      }
      const summary = await pushSupabaseOnce(db, save, clubDb, saveClub)
      res.json(summary)
    } catch (e) {
      jsonError(res, 500, e.message || 'Erro na sincronização.')
    }
  })

  registerClubRoutes(app, clubDb, saveClub, qClub)
  registerAlertRoutes(app, db, save, jsonError)

  return app
}

/**
 * @param {{
 *   dbPath: string,
 *   clubDbPath?: string,
 *   port?: number,
 *   onListening?: (info: { port: number }) => void,
 *   supabaseSync?: boolean
 * }} opts — `supabaseSync`: só true no PC servidor (cópia para Supabase). Clube usa ficheiro à parte.
 */
async function start(opts) {
  const { dbPath, port = 3000, onListening, supabaseSync = false } = opts
  const clubDbPath =
    opts.clubDbPath ?? path.join(path.dirname(dbPath), 'club-database.db')
  if (httpServer) {
    throw new Error('Server already running.')
  }
  const { db, save } = await openDatabase(dbPath)
  sqlDb = db
  persistDb = save
  const { db: clubDb, save: saveClub } = await openClubDatabase(clubDbPath)
  sqlClubDb = clubDb
  persistClubDb = saveClub
  supabasePushEnabled = Boolean(supabaseSync)
  const app = createApp(db, save, clubDb, saveClub)
  const syncLogPath = path.join(path.dirname(dbPath), 'orb-sync.log')
  return new Promise((resolve, reject) => {
    httpServer = app.listen(port, '0.0.0.0', () => {
      if (supabasePushEnabled) {
        const { startSupabaseSync } = require('./supabaseSync.js')
        startSupabaseSync(sqlDb, persistDb, {
          clubDb: sqlClubDb,
          clubSave: persistClubDb,
          logPath: syncLogPath,
        })
      }
      onListening?.({ port })
      resolve({ port })
    })
    httpServer.on('error', reject)
  })
}

async function stop() {
  const {
    stopSupabaseSync,
    pushOnce,
    isSyncConfigured,
  } = require('./supabaseSync.js')
  stopSupabaseSync()

  if (
    supabasePushEnabled &&
    sqlDb &&
    persistDb &&
    isSyncConfigured()
  ) {
    try {
      await pushOnce(sqlDb, persistDb, sqlClubDb, persistClubDb)
    } catch (e) {
      console.error(
        'OrBullets: última sincronização Supabase falhou',
        e?.message || e,
      )
    }
  }
  supabasePushEnabled = false

  return new Promise((resolve) => {
    const finish = () => {
      httpServer = null
      try {
        persistDb?.()
      } catch {
        /* ignore */
      }
      persistDb = null
      try {
        persistClubDb?.()
      } catch {
        /* ignore */
      }
      persistClubDb = null
      try {
        sqlClubDb?.close()
      } catch {
        /* ignore */
      }
      sqlClubDb = null
      try {
        sqlDb?.close()
      } catch {
        /* ignore */
      }
      sqlDb = null
      resolve()
    }
    if (httpServer) {
      httpServer.close(() => finish())
    } else {
      finish()
    }
  })
}

module.exports = { start, stop, createApp, openDatabase }
