/**
 * Editar / excluir itens do clube diretamente no SQLite (club-database.db).
 *
 * Isto é JavaScript (Node.js), NÃO é SQL. Não cole nem execute no Supabase SQL Editor.
 * No terminal, na pasta do projeto: node scripts/club-items-cli.js --help
 *
 * IMPORTANTE: feche o OrBullets (ou pare o servidor local) antes de correr este script
 * no mesmo ficheiro, para evitar corrupção da base de dados.
 *
 * Uso:
 *   node scripts/club-items-cli.js list [--db CAMINHO]
 *   node scripts/club-items-cli.js update <id> --name "Novo nome" [--kind polvora|espoleta|ponta|municao] [--db CAMINHO]
 *   node scripts/club-items-cli.js delete <id> [--db CAMINHO]
 *
 * Caminho da BD (por ordem):
 *   1) --db <caminho>
 *   2) variável de ambiente CLUB_DB
 *   3) ./club-database.db na raiz do projeto (desenvolvimento)
 *
 * No Windows com app instalado, o ficheiro costuma estar em:
 *   %APPDATA%\OrBullets\club-database.db
 *   (ou pasta com o nome do produto da build — verifique em %APPDATA%)
 */

const path = require('path')
const { openClubDatabase } = require('../backend/db.js')

const KINDS = ['polvora', 'espoleta', 'ponta', 'municao']

/**
 * @param {import('sql.js').Database} db
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
 */
function runDb(db, sql, params = []) {
  db.run(sql, params)
}

/**
 * @param {import('sql.js').Database} db
 * @param {string} itemId
 */
function itemInRecipe(db, itemId) {
  const ref = allRows(
    db,
    `SELECT 1 FROM club_recipes WHERE
      polvora_item_id = ? OR espoleta_item_id = ? OR ponta_item_id = ? OR municao_output_item_id = ?
     LIMIT 1`,
    [itemId, itemId, itemId, itemId],
  )
  return ref.length > 0
}

function parseArgs(argv) {
  const args = [...argv]
  const opts = { db: null }
  const rest = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      opts.db = args[++i]
      continue
    }
    rest.push(args[i])
  }
  return { opts, rest }
}

function resolveDbPath(opts) {
  if (opts.db) return path.resolve(opts.db)
  if (process.env.CLUB_DB) return path.resolve(process.env.CLUB_DB)
  return path.join(__dirname, '..', 'club-database.db')
}

async function main() {
  const { opts, rest } = parseArgs(process.argv.slice(2))
  const cmd = rest[0]
  const dbPath = resolveDbPath(opts)

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(`club-items-cli — itens do clube (SQLite)

Comandos:
  list                          Lista id, nome, tipo
  update <id> --name "..."      Atualiza nome (obrigatório neste comando)
              [--kind TIPO]     Opcional: ${KINDS.join('|')}
  delete <id>                   Apaga item e todas as movimentações de stock

Opções:
  --db CAMINHO                  Ficheiro club-database.db

BD actual: ${dbPath}
`)
    process.exit(cmd ? 0 : 1)
  }

  const { db, save } = await openClubDatabase(dbPath)

  try {
    if (cmd === 'list') {
      const rows = allRows(
        db,
        `SELECT id, name, kind, created_at FROM club_items ORDER BY kind, name COLLATE NOCASE`,
      )
      if (!rows.length) {
        console.log('(sem itens)')
        return
      }
      for (const r of rows) {
        console.log(`${r.id}\t${r.kind}\t${r.name}`)
      }
      return
    }

    if (cmd === 'update') {
      const id = rest[1]
      if (!id) {
        console.error('Uso: update <id> --name "..." [--kind TIPO]')
        process.exit(1)
      }
      let name = null
      let kind = null
      for (let i = 2; i < rest.length; i++) {
        if (rest[i] === '--name' && rest[i + 1]) {
          name = rest[++i]
        } else if (rest[i] === '--kind' && rest[i + 1]) {
          kind = rest[++i]
        }
      }
      if (name == null || !String(name).trim()) {
        console.error('--name é obrigatório e não pode ficar vazio.')
        process.exit(1)
      }
      const existingRows = allRows(db, `SELECT id, name, kind FROM club_items WHERE id = ?`, [id])
      if (!existingRows.length) {
        console.error('Item não encontrado:', id)
        process.exit(1)
      }
      const existing = existingRows[0]
      const newName = String(name).trim()
      const newKind = kind != null ? String(kind).trim() : existing.kind
      if (!KINDS.includes(newKind)) {
        console.error('kind inválido. Use:', KINDS.join(', '))
        process.exit(1)
      }
      if (newKind !== existing.kind && itemInRecipe(db, id)) {
        console.error(
          'Não é possível alterar o tipo: o item está numa receita. Retire-o da receita primeiro.',
        )
        process.exit(1)
      }
      runDb(db, `UPDATE club_items SET name = ?, kind = ? WHERE id = ?`, [newName, newKind, id])
      save()
      console.log('OK — item actualizado.')
      return
    }

    if (cmd === 'delete') {
      const id = rest[1]
      if (!id) {
        console.error('Uso: delete <id>')
        process.exit(1)
      }
      const exists = allRows(db, `SELECT id, name FROM club_items WHERE id = ?`, [id])
      if (!exists.length) {
        console.error('Item não encontrado:', id)
        process.exit(1)
      }
      if (itemInRecipe(db, id)) {
        console.error(
          'Não é possível excluir: o item está numa receita. Retire-o da receita primeiro.',
        )
        process.exit(1)
      }
      runDb(db, `DELETE FROM club_stock_movements WHERE item_id = ?`, [id])
      runDb(db, `DELETE FROM club_items WHERE id = ?`, [id])
      save()
      console.log('OK — excluído:', exists[0].name)
      return
    }

    console.error('Comando desconhecido:', cmd)
    process.exit(1)
  } finally {
    db.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
