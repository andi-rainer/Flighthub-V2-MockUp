/**
 * Operation kinds (Betriebsarten) of the club: what a flight is (jump operation, charter, training, maintenance ...). Each kind has its own
 * price per flight minute and its own default booking: who pays how much, the pilot's account and/or cost centers. The club defines them
 * (Vereinseinstellungen > Betriebsarten); flights are booked from them, the treasurer still confirms every flight.
 */
export type SplitTarget = { kind: 'pilot' } | { kind: 'costCenter'; id: string }
export interface SplitPart { target: SplitTarget; percent: number }
import { areaOn, type Area, type ModulesConfig } from './modules'

/** One price and booking rule of a kind with the time it was valid. Flights keep the rule of the day they were entered. */
export interface KindVersion {
  /** First day of validity (dd.MM.yyyy). */
  since: string
  rates: Record<string, number>
  split: SplitPart[]
}
/** An old version, closed by `until`. Archived versions are never edited or deleted. */
export interface ArchivedKindVersion extends KindVersion { until: string }
export interface OperationKind {
  id: string; name: string
  /**
   * EUR per flight minute, by aircraft registration: every aircraft has its own price. An aircraft without an entry cannot fly in this
   * kind (a jump operation only exists for jump aircraft).
   */
  rates: Record<string, number>
  /** Who pays by default, the percentages add up to 100. */
  split: SplitPart[]
  /** Since when the current prices and booking apply. */
  since: string
  /** Earlier prices and bookings, newest first. A change never reaches flights that are already entered, so the old rules stay readable. */
  history: ArchivedKindVersion[]
  /** The operation the kind belongs to; it is not offered when that operation is switched off. No area: always possible (e.g. maintenance). */
  area?: Area
  /** The kind of the flights that come from the manifest (jump operation). Exactly one; it cannot be deleted or switched off. */
  manifest?: boolean
  /** Can be chosen when a flight is started or logged. */
  active: boolean
}

/** The day of the prototype. */
export const TODAY = '07.11.2026'

const PILOT: SplitPart[] = [{ target: { kind: 'pilot' }, percent: 100 }]
export const DEFAULT_KINDS: OperationKind[] = [
  { id: 'k-sprung', name: 'Sprungbetrieb', rates: { 'OE-DZA': 5.15, 'OE-AXB': 9.8 }, manifest: true, area: 'skydive', active: true, split: [{ target: { kind: 'costCenter', id: 'cc-sport' }, percent: 100 }], since: '01.01.2026', history: [] },
  { id: 'k-charter', name: 'Charter', rates: { 'OE-DZA': 5.15, 'OE-KFR': 3.9 }, area: 'charter', active: true, split: PILOT, since: '01.01.2026',
    history: [{ since: '01.01.2025', until: '31.12.2025', rates: { 'OE-DZA': 4.8, 'OE-KFR': 3.7 }, split: PILOT }] },
  { id: 'k-schulung', name: 'Schulung', rates: { 'OE-DZA': 4, 'OE-KFR': 3.2 }, area: 'charter', active: true, split: PILOT, since: '01.01.2026', history: [] },
  { id: 'k-privat', name: 'Privat', rates: { 'OE-DZA': 5.15, 'OE-KFR': 3.9 }, area: 'charter', active: true, split: PILOT, since: '01.01.2026', history: [] },
  { id: 'k-wartung', name: 'Wartungsflug', rates: { 'OE-DZA': 5.15, 'OE-KFR': 3.9, 'OE-AXB': 9.8 }, active: true, split: [{ target: { kind: 'pilot' }, percent: 50 }, { target: { kind: 'costCenter', id: 'cc-verein' }, percent: 50 }], since: '01.01.2026', history: [] },
]

const sameRule = (a: KindVersion, b: KindVersion) => JSON.stringify([a.rates, a.split]) === JSON.stringify([b.rates, b.split])
/**
 * Saves a kind. Name and "wählbar" change in place; a changed price or booking closes the current rule into the archive and starts a new one
 * today, so nothing that was valid before is overwritten.
 */
export function saveKind(old: OperationKind | undefined, next: OperationKind, today = TODAY): OperationKind {
  if (!old || sameRule(old, next)) return { ...next, since: old?.since ?? today, history: old?.history ?? [] }
  return { ...next, since: today, history: [{ since: old.since, until: today, rates: old.rates, split: old.split }, ...old.history] }
}

/** A line of the booking proposal of a flight. */
export interface SplitLine { who: string; memberId?: string; percent: number }

/** The booking proposal of a flight of this kind: the pilot's Betriebskonto and/or cost centers. Unknown kinds fall back to the pilot. */
export function splitFor(kinds: OperationKind[], ccName: (id: string) => string, memberIdOf: (name: string) => string | undefined, kindName: string, pilot: string): SplitLine[] {
  const kind = kinds.find((k) => k.name === kindName)
  const parts = kind?.split ?? [{ target: { kind: 'pilot' } as SplitTarget, percent: 100 }]
  return parts.map((p) => (p.target.kind === 'pilot' ? { who: `Betriebskonto ${pilot}`, memberId: memberIdOf(pilot), percent: p.percent } : { who: `Kostenstelle ${ccName(p.target.id)}`, percent: p.percent }))
}
/** Price per minute of this kind with this aircraft; 0 when the aircraft has no price in the kind. */
export const rateFor = (kinds: OperationKind[], kindName: string, reg: string) => kinds.find((k) => k.name === kindName)?.rates[reg] ?? 0
/** The kinds a flight with this aircraft can have: switched on, with a price for the aircraft and in an operation the club runs. */
export const offeredFor = (kinds: OperationKind[], reg: string, modules: ModulesConfig) => kinds.filter((k) => k.active && k.rates[reg] !== undefined && areaOn(modules, k.area))
export const splitSum = (k: Pick<OperationKind, 'split'>) => k.split.reduce((n, p) => n + p.percent, 0)
