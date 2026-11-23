import { useSyncExternalStore } from 'react'
import { AUSLAGE_ID, EARLIER_MINUTES, type CostCenter } from '../../data'
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

// ---------- Closing, budgets and audit (prototype state of the Zeiträume, Ergebnis and Kostenstellen pages) ----------

/** The last day of a month ("2026-10" → "2026-10-31"). */
export const monthEnd = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}` }
/** What the books say an account holds at the end of a day (ISO): opening balance plus every line up to that day. */
export const balanceAt = (ledger: Ledger, accountId: string, iso: string) =>
  Math.round(((ledger.accounts.find((a) => a.id === accountId)?.opening ?? 0) + ledger.lines.filter((l) => l.accountId === accountId && l.date <= iso).reduce((n, l) => n + l.amount, 0)) * 100) / 100

/** A balance check of one money account at the end of a month: what the books say (Soll) against the statement or the count (Ist). */
export interface Recon { month: string; accountId: string; /** Ist minus Soll at the time of the check. */ diff: number; by: string; at: string; /** Kassa: counted notes and coins (value → pieces). */ counted?: Record<string, number> }
/** A sign-off of the Rechnungsprüfer for a year. */
export interface Audit { year: string; by: string; at: string; note?: string }
/** Planned income and costs of a cost center in a year. */
export interface Budget { income: number; cost: number }
interface Extras { budgets: Record<string, Record<string, Budget>>; recons: Recon[]; audits: Audit[]; merged: Record<string, string> }

const seedBudgets: Record<string, Budget> = {
  'cc-oedza': { income: 0, cost: 21_000 }, 'cc-oekfr': { income: 0, cost: 6_000 }, 'cc-oeaxb': { income: 0, cost: 4_000 },
  'cc-sport': { income: 15_000, cost: 0 }, 'cc-tandem': { income: 22_000, cost: 0 }, 'cc-fcharter': { income: 8_000, cost: 0 },
  'cc-verein': { income: 18_000, cost: 1_500 }, 'cc-platz': { income: 0, cost: 2_000 },
}
let extras: Extras = {
  budgets: { '2025': seedBudgets, '2026': Object.fromEntries(Object.entries(seedBudgets).map(([k, b]) => [k, { income: Math.round(b.income * 1.08), cost: Math.round(b.cost * 1.05) }])) },
  // Every released month was checked against statement and count when it was released.
  recons: ['2026-07', '2026-08', '2026-09'].flatMap((m) => ['acc-bank', 'acc-kassa', 'acc-spar'].map((a) => ({ month: m, accountId: a, diff: 0, by: 'Eva Steiner', at: `${m.slice(0, 5)}${String(Number(m.slice(5)) + 1).padStart(2, '0')}-06` }))),
  audits: [{ year: '2025', by: 'Clara Wimmer', at: '2026-03-12', note: 'Stichproben Treibstoff und Wartung, ohne Beanstandung' }],
  merged: {},
}
const listeners = new Set<() => void>()
const emit = (next: Extras) => { extras = next; for (const l of listeners) l() }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Prototype state shared by Zeiträume, Ergebnis and Kostenstellen: budgets, balance checks, audit sign-offs and merges. */
export function useExtras() {
  const x = useSyncExternalStore(subscribe, () => extras)
  return {
    ...x,
    budgetOf: (year: string, ccId: string): Budget | undefined => x.budgets[year]?.[ccId],
    setBudget: (year: string, ccId: string, b: Budget) => emit({ ...extras, budgets: { ...extras.budgets, [year]: { ...extras.budgets[year], [ccId]: b } } }),
    setBudgets: (year: string, all: Record<string, Budget>) => emit({ ...extras, budgets: { ...extras.budgets, [year]: all } }),
    reconOf: (month: string, accountId: string) => x.recons.find((r) => r.month === month && r.accountId === accountId),
    addRecon: (r: Recon) => emit({ ...extras, recons: [...extras.recons.filter((y) => !(y.month === r.month && y.accountId === r.accountId)), r] }),
    dropRecons: (month: string) => emit({ ...extras, recons: extras.recons.filter((y) => y.month !== month) }),
    addAudit: (a: Audit) => emit({ ...extras, audits: [...extras.audits, a] }),
    merge: (fromId: string, intoId: string) => emit({ ...extras, merged: { ...extras.merged, [fromId]: intoId } }),
  }
}

/** One line of the Einnahmen-Ausgaben-Rechnung. */
export interface ClosingRow { name: string; amount: number }
/**
 * The Einnahmen-Ausgaben-Rechnung of a year from the money accounts (§ 21 VerG): every line of a bank or cash account, grouped by its cost
 * category; what goes to Betriebskonten, vouchers or tickets is shown on its own; transfers between the club's accounts are left out.
 * Expenses that a member paid privately (Auslagen) moved no money of the club and are listed apart.
 */
export function computeClosing(ledger: Ledger, year: string) {
  const cats = new Map(ledger.categories.map((c) => [c.id, c.name]))
  const by = new Map<string, number>()
  const add = (k: string, n: number) => by.set(k, (by.get(k) ?? 0) + n)
  let passIn = 0, passOut = 0, openIn = 0, openOut = 0, openCount = 0, auslagen = 0
  for (const l of ledger.lines) {
    if (yearOfLine(l.date) !== year) continue
    const t = ledger.done[l.id]
    if (l.accountId === AUSLAGE_ID) { auslagen += -l.amount; continue }
    if (t?.kind === 'umbuchung') continue
    if (!t) { openCount++; if (l.amount > 0) openIn += l.amount; else openOut += -l.amount; continue }
    const sign = l.amount < 0 ? -1 : 1
    let coded = 0
    for (const c of ledger.codingOfLine(l)) { add(c.categoryId, sign * c.amount); coded += c.amount }
    const rest = Math.abs(l.amount) - coded
    if (rest > 0.004) { if (sign > 0) passIn += rest; else passOut += rest }
  }
  const rows = [...by].map(([id, amount]) => ({ name: cats.get(id) ?? '?', amount }))
  const income: ClosingRow[] = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount)
  const cost: ClosingRow[] = rows.filter((r) => r.amount < 0).map((r) => ({ ...r, amount: -r.amount })).sort((a, b) => b.amount - a.amount)
  if (passIn) income.push({ name: 'Einzahlungen auf Betriebskonten, Gutscheine und Tickets', amount: passIn })
  if (passOut) cost.push({ name: 'Auszahlungen von Betriebskonten, Gutscheinen und Tickets', amount: passOut })
  if (openIn) income.push({ name: `Noch nicht zugeordnet`, amount: openIn })
  if (openOut) cost.push({ name: `Noch nicht zugeordnet`, amount: openOut })
  const sum = (r: ClosingRow[]) => r.reduce((n, x) => n + x.amount, 0)
  const accounts = ledger.accounts.filter((a) => a.id !== AUSLAGE_ID).map((a) => ({ account: a, start: balanceAt(ledger, a.id, `${Number(year) - 1}-12-31`), end: balanceAt(ledger, a.id, `${year}-12-31`) }))
  return { income, cost, totalIn: sum(income), totalOut: sum(cost), accounts, openCount, auslagen }
}
