/** Prototype calendar: day 0 is Saturday 07.11.2026. Times are "absolute hours" since 00:00 of day 0. */
export const BASE = new Date(2026, 10, 7)
const NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
export const dayDate = (idx: number) => new Date(BASE.getFullYear(), BASE.getMonth(), BASE.getDate() + idx)
export const dayShort = (idx: number) => { const d = dayDate(idx); return `${NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.` }
export const dayIso = (idx: number) => { const d = dayDate(idx); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const hmOf = (abs: number) => { const h = abs - Math.floor(abs / 24) * 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}` }
/** "10:00" for today, "Mo 09.11. 10:00" for other days. */
export const fmtAbs = (abs: number) => (Math.floor(abs / 24) === 0 ? hmOf(abs) : `${dayShort(Math.floor(abs / 24))} ${hmOf(abs)}`)
export const toAbs = (iso: string, hm: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - BASE.getTime()) / 86400000) * 24 + h + mi / 60
}
