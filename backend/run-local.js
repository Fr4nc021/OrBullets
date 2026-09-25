/**
 * API local (SQLite). Com ORB_SUPABASE_SYNC_KEY no .env, copia para a nuvem.
 * Uso: npm run api:local   ou   npm run dev
 */
const path = require('path')
const fs = require('fs')
const { loadEnvFile, applySupabaseDefaults } = require('./loadEnv.js')
const { isSyncConfigured } = require('./supabaseSync.js')
const { start } = require('./server.js')

loadEnvFile(path.join(__dirname, '..', '.env'))
applySupabaseDefaults()

const port = Number(process.env.ORB_LOCAL_API_PORT || process.env.PORT || 3000)
const dataDir =
  process.env.ORB_LOCAL_DATA_DIR ||
  path.join(__dirname, '..', '.local-data')

fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'database.db')
const clubDbPath = path.join(dataDir, 'club-database.db')
const supabaseSync = isSyncConfigured()

start({
  dbPath,
  clubDbPath,
  port,
  supabaseSync,
  onListening: ({ port: p }) => {
    console.log(`[OrBullets] API local em http://127.0.0.1:${p}`)
    console.log(`[OrBullets] SQLite: ${dbPath}`)
    console.log(`[OrBullets] Clube:  ${clubDbPath}`)
    console.log(
      `[OrBullets] Sync Supabase: ${supabaseSync ? 'ligado' : 'desligado (cole a anon key no .env)'}`,
    )
  },
}).catch((err) => {
  console.error('[OrBullets] Falha ao iniciar API local:', err)
  process.exit(1)
})
