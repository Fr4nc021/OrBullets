const fs = require('fs')
const path = require('path')

function resolveSqlJsDistDir() {
  const dev = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist')
  if (fs.existsSync(path.join(dev, 'sql-wasm.wasm'))) return dev
  const unpacked = path.join(
    process.resourcesPath || '',
    'app.asar.unpacked',
    'node_modules',
    'sql.js',
    'dist',
  )
  if (process.resourcesPath && fs.existsSync(path.join(unpacked, 'sql-wasm.wasm'))) {
    return unpacked
  }
  return dev
}

/**
 * @param {string} dbPath
 * @returns {Promise<{ db: import('sql.js').Database, save: () => void }>}
 */
async function openDatabase(dbPath) {
  const initSqlJs = require('sql.js')
  const wasmDir = resolveSqlJsDistDir()
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(wasmDir, file),
  })

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let db
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  db.exec(schema)
  // Bancos antigos: CREATE TABLE IF NOT EXISTS não adiciona colunas novas.
  ensureColumn(db, 'ammo_movements', 'nf_number', 'TEXT')
  ensureColumn(db, 'ammo_movements', 'saida_group_id', 'TEXT')
  ensureColumn(db, 'calibers', 'product_type', "TEXT DEFAULT 'municao'")
  ensureColumn(db, 'ammo_types', 'created_at', 'TEXT')

  function save() {
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }

  return { db, save }
}

/**
 * Banco exclusivo do clube (insumos / produção) — arquivo distinto da loja.
 * @param {string} dbPath
 * @returns {Promise<{ db: import('sql.js').Database, save: () => void }>}
 */
async function openClubDatabase(dbPath) {
  const initSqlJs = require('sql.js')
  const wasmDir = resolveSqlJsDistDir()
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(wasmDir, file),
  })

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let db
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  const schemaPath = path.join(__dirname, 'schema-club.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  db.exec(schema)

  function save() {
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }

  return { db, save }
}

/**
 * CREATE TABLE IF NOT EXISTS não adiciona colunas em bancos já existentes.
 * @param {import('sql.js').Database} db
 */
function ensureColumn(db, table, column, sqlType) {
  const info = db.exec(`PRAGMA table_info(${table})`)
  const existing = new Set()
  if (info[0]) {
    const nameIdx = info[0].columns.indexOf('name')
    for (const row of info[0].values) existing.add(row[nameIdx])
  }
  if (!existing.has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`)
  }
}

module.exports = { openDatabase, openClubDatabase }
