const fs = require('fs')
const path = require('path')

const MAX_BYTES = 512 * 1024

/** @type {string | null} */
let logFilePath = null

function setLogPath(p) {
  logFilePath = p && String(p).trim() ? String(p).trim() : null
}

function trimFileIfHuge() {
  if (!logFilePath) return
  try {
    const st = fs.statSync(logFilePath)
    if (st.size <= MAX_BYTES) return
    const buf = fs.readFileSync(logFilePath)
    const slice = buf.subarray(buf.length - Math.floor(MAX_BYTES / 2))
    fs.writeFileSync(logFilePath, Buffer.concat([Buffer.from('…[truncado]…\n'), slice]))
  } catch {
    /* ignore */
  }
}

/**
 * @param {'info'|'warn'|'error'} level
 * @param {string} msg
 * @param {Record<string, unknown>} [meta]
 */
function log(level, msg, meta) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
  }
  const text = `${line.ts} [${level.toUpperCase()}] ${msg}${meta ? ` ${JSON.stringify(meta)}` : ''}\n`
  if (level === 'error') {
    console.error('OrBullets sync:', msg, meta || '')
  } else if (level === 'warn') {
    console.warn('OrBullets sync:', msg, meta || '')
  } else {
    console.info('OrBullets sync:', msg, meta || '')
  }
  if (!logFilePath) return
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
    trimFileIfHuge()
    fs.appendFileSync(logFilePath, text, 'utf8')
  } catch (e) {
    console.warn('OrBullets sync: falha ao escrever log em disco', e.message)
  }
}

module.exports = { setLogPath, log }
