import { EARLIER_MINUTES, type CostCenter } from '../../data'
import type { LogEntry } from '../../state'
import type { Ledger } from './ledger'

/** What one cost category contributed to a cost center. */
export interface Part { categoryId: string; name: string; type: 'Kosten' | 'Ertrag'; fixed: boolean; amount: number }
export interface CcResult { cc: CostCenter; income: number; cost: number; result: number; parts: Part[] }
/** The costs of one aircraft and what an hour in it has to bring in. Hours come from the Bordbuch. */
export interface AircraftResult { cc: CostCenter; reg: string; minutes: number; variable: number; fixed: number; cost: number; /** Cost per flight hour that covers variable and fixed costs of the year; null without flights. */ coverPerHour: number | null; variablePerHour: number | null }

const yearOfLine = (iso: string) => iso.slice(0, 4)
const yearOfEntry = (date: string) => date.slice(6)

export const minutesOf = (entries: LogEntry[], reg: string, year: string) =>
  (EARLIER_MINUTES[year]?.[reg] ?? 0) + entries.filter((e) => e.aircraft === reg && yearOfEntry(e.date) === year).reduce((n, e) => n + e.minutes, 0)

/**
 * The result of one year, from what is booked: every booking is coded on cost centers and categories, a category is a cost or an income.
 * Works for any number of cost centers and aircraft. Bookings that are not assigned yet are not in it (`open`).
 */
export function computeResults(ledger: Ledger, entries: LogEntry[], year: string) {
  const cats = new Map(ledger.categories.map((c) => [c.id, c]))
  const acc = new Map<string, Map<string, number>>()
  let open = 0
  for (const l of ledger.lines) {
    if (yearOfLine(l.date) !== year) continue
    if (!ledger.done[l.id]) { open++; continue }
    for (const c of ledger.codingOfLine(l)) {
      const byCat = acc.get(c.costCenterId) ?? new Map<string, number>()
      byCat.set(c.categoryId, (byCat.get(c.categoryId) ?? 0) + c.amount)
      acc.set(c.costCenterId, byCat)
    }
  }
  const rows: CcResult[] = ledger.costCenters.flatMap((cc) => {
    const byCat = acc.get(cc.id)
    if (!byCat && cc.archived) return []
    const parts: Part[] = [...(byCat ?? [])].flatMap(([id, amount]) => { const c = cats.get(id); return c ? [{ categoryId: id, name: c.name, type: c.type, fixed: !!c.fixed, amount }] : [] }).sort((a, b) => b.amount - a.amount)
    const income = parts.filter((p) => p.type === 'Ertrag').reduce((n, p) => n + p.amount, 0)
    const cost = parts.filter((p) => p.type === 'Kosten').reduce((n, p) => n + p.amount, 0)
    return [{ cc, income, cost, result: income - cost, parts }]
  })
  const aircraft: AircraftResult[] = rows.filter((r) => r.cc.kind === 'Flugzeug').map((r) => {
    const minutes = minutesOf(entries, r.cc.name, year)
    const variable = r.parts.filter((p) => p.type === 'Kosten' && !p.fixed).reduce((n, p) => n + p.amount, 0)
    const fixed = r.parts.filter((p) => p.type === 'Kosten' && p.fixed).reduce((n, p) => n + p.amount, 0)
    const hours = minutes / 60
    return { cc: r.cc, reg: r.cc.name, minutes, variable, fixed, cost: variable + fixed, coverPerHour: hours > 0 ? (variable + fixed) / hours : null, variablePerHour: hours > 0 ? variable / hours : null }
  })
  const income = rows.reduce((n, r) => n + r.income, 0)
  const cost = rows.reduce((n, r) => n + r.cost, 0)
  return { rows, aircraft, income, cost, result: income - cost, open }
}

/** The years that have bookings, newest first; the running year is always there. */
export function resultYears(ledger: Ledger, current: string) {
  return [...new Set([current, ...ledger.lines.map((l) => yearOfLine(l.date))])].sort().reverse()
}
