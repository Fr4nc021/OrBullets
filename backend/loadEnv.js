const fs = require('fs')
const { DEFAULT_SUPABASE_URL } = require('./orbTables.js')

function parseEnvFile(content) {
  const out = {}
  for (const line of String(content).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function applyEnv(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || String(value).trim() === '') continue
    if (process.env[key] == null || String(process.env[key]).trim() === '') {
      process.env[key] = String(value).trim()
    }
  }
}

function loadEnvFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false
    applyEnv(parseEnvFile(fs.readFileSync(filePath, 'utf8')))
    return true
  } catch {
    return false
  }
}

function applySupabaseDefaults() {
  const url = (
    process.env.ORB_SUPABASE_SYNC_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim()
  process.env.ORB_SUPABASE_SYNC_URL = url || DEFAULT_SUPABASE_URL

  const key = (
    process.env.ORB_SUPABASE_SYNC_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim()
  if (key) {
    process.env.ORB_SUPABASE_SYNC_KEY = key
    if (!process.env.VITE_SUPABASE_ANON_KEY) {
      process.env.VITE_SUPABASE_ANON_KEY = key
    }
  }
}

module.exports = { parseEnvFile, loadEnvFile, applySupabaseDefaults }
