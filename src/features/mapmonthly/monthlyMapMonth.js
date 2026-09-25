/**
 * Chave estável do mês (YYYY-MM) e rótulo em pt-BR (ex.: fevereiro/2026).
 */

/**
 * @param {number} year
 * @param {number} monthIndex0 — 0 = janeiro
 * @returns {string}
 */
export function monthKeyFromYearMonth(year, monthIndex0) {
  const m = monthIndex0 + 1
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(m)}`
}

/**
 * @param {string} monthKey — YYYY-MM
 * @returns {string} ex.: fevereiro/2026
 */
export function formatMonthLabelPt(monthKey) {
  const parts = monthKey.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return monthKey
  const d = new Date(y, mo - 1, 1)
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d)
  return `${name.toLowerCase()}/${y}`
}

/**
 * Primeiro e último dia do mês civil (datas locais YYYY-MM-DD).
 * @param {string} monthKey — YYYY-MM
 * @returns {{ from: string, to: string }}
 */
export function getFullMonthRange(monthKey) {
  const parts = monthKey.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error('Mês inválido.')
  }
  const pad = (n) => String(n).padStart(2, '0')
  const from = `${y}-${pad(m)}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${pad(m)}-${pad(lastDay)}`
  return { from, to }
}

/**
 * @param {string} monthKey
 */
export function parseMonthKey(monthKey) {
  const [ys, ms] = monthKey.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { year: new Date().getFullYear(), monthIndex0: 0 }
  }
  return { year: y, monthIndex0: m - 1 }
}
