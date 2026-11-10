import clsx from 'clsx'

/** From this confidence on a suggestion counts as safe. */
export const SAFE = 0.85
const confTone = (c: number) => (c >= SAFE ? 'ok' : c >= 0.6 ? 'warn' : 'bad')
export const confLabel = (c: number) => (c >= SAFE ? 'sicher' : c >= 0.6 ? 'bitte prüfen' : 'unsicher')
export const Dot = ({ c }: { c: number }) => <span className={clsx('inline-block h-2 w-2 shrink-0 rounded-full', { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[confTone(c)])} />
export const cents = (s: string) => Math.round(Number(s.replace(',', '.')) * 100)
export const euros = (c: number) => String(c / 100).replace('.', ',')

/** Opens the file of an invoice. The dummy keeps no files: it shows a placeholder. */
export function openReceiptFile(name: string) {
  window.open(URL.createObjectURL(new Blob([`Klickdummy: Hier würde die Datei „${name}“ geöffnet.`], { type: 'text/plain;charset=utf-8' })), '_blank', 'noopener')
}

/** "2026-10" → "Oktober 2026" */
export const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })

/** Liters, cost and the average price per liter of the fuel invoices among `rs`: the weighted average, not the mean of the prices. */
export function fuelStats(rs: { amount: number; fuel?: { liters: number } }[]) {
  const f = rs.filter((r) => r.fuel && r.fuel.liters > 0)
  if (f.length === 0) return null
  const liters = f.reduce((n, r) => n + r.fuel!.liters, 0)
  const cost = f.reduce((n, r) => n + r.amount, 0)
  return { n: f.length, liters, cost, avg: cost / liters }
}
export const perLiter = (n: number) => `€ ${n.toFixed(3).replace('.', ',')}/L`
