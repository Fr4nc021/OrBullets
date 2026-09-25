/**
 * Arquivo mensal de PDFs (mapa mensal) — armazenamento local no navegador (IndexedDB).
 * Os dados não são enviados ao servidor.
 */

const DB_NAME = 'orbullets-monthly-map'
const DB_VERSION = 1
const STORE = 'snapshots'

/**
 * @typedef {object} MonthlyMapSnapshot
 * @property {string} monthKey — YYYY-MM
 * @property {string} label — ex.: fevereiro/2026
 * @property {Blob | null} [estoquePdf]
 * @property {Blob | null} [armasPdf]
 * @property {string | null} [estoqueSavedAt] — ISO
 * @property {string | null} [armasSavedAt]
 */

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'monthKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

/**
 * @param {string} monthKey
 * @returns {Promise<MonthlyMapSnapshot | undefined>}
 */
export async function getMonthlySnapshot(monthKey) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const st = tx.objectStore(STORE)
    const r = st.get(monthKey)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/**
 * @returns {Promise<MonthlyMapSnapshot[]>}
 */
export async function getAllMonthlySnapshots() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const st = tx.objectStore(STORE)
    const r = st.getAll()
    r.onsuccess = () => resolve(r.result ?? [])
    r.onerror = () => reject(r.error)
  })
}

/**
 * Cria ou atualiza o registro do mês (preserva PDFs não substituídos).
 * @param {MonthlyMapSnapshot} record
 */
export async function putMonthlySnapshot(record) {
  const existing = await getMonthlySnapshot(record.monthKey)
  const merged = {
    monthKey: record.monthKey,
    label: record.label ?? existing?.label ?? record.monthKey,
    estoquePdf: record.estoquePdf ?? existing?.estoquePdf ?? null,
    armasPdf: record.armasPdf ?? existing?.armasPdf ?? null,
    estoqueSavedAt:
      record.estoqueSavedAt ?? existing?.estoqueSavedAt ?? null,
    armasSavedAt: record.armasSavedAt ?? existing?.armasSavedAt ?? null,
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(merged)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * @param {string} monthKey
 */
export async function deleteMonthlySnapshot(monthKey) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(monthKey)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
