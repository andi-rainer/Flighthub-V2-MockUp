// THROWAWAY mock data. Envelope numbers are invented, NOT from a real AFM.
import { METRIC, type Units } from './units'

export interface Station { id: string; name: string; arm: number; max?: number; unit: 'kg' | 'L'; def: number; density?: number }
/**
 * Thresholds for the total weight of the jumpers on one flight of a jump aircraft: green up to `yellow`, yellow up to `orange` (or up to `max`
 * when there is no orange threshold), orange up to `max`, red above `max`.
 */
export interface PaxLimits { yellow: number; orange?: number; max: number }
export type PaxTone = 'ok' | 'yellow' | 'orange' | 'red'
export const paxTone = (kg: number, l: PaxLimits): PaxTone => (kg > l.max ? 'red' : l.orange !== undefined && kg > l.orange ? 'orange' : kg > l.yellow ? 'yellow' : 'ok')
/** Invented thresholds for the dummy, by aircraft id. Only jump aircraft have them. */
export const seedPaxLimits: Record<string, PaxLimits> = { a1: { yellow: 340, orange: 370, max: 400 }, a3: { yellow: 800, orange: 880, max: 950 } }

export interface Service { id: string; date: string; type: string; hours: number; by: string; note?: string }

// ---------- Maintenance, components, documents ----------
/** A recurring maintenance task. Next due by flight hours of the aircraft, by date, or both (whichever comes first). */
export interface MaintItem { id: string; name: string; dueHours?: number; dueDate?: string; intervalHours?: number; intervalMonths?: number; lastDone?: string }

export type ComponentType = 'Motor' | 'Propeller' | 'Fahrwerk' | 'Magnet' | 'Vakuumpumpe' | 'Lichtmaschine' | 'Anlasser' | 'ELT' | 'Sonstiges'
/** Common overhaul intervals (TBO) offered when a component is installed. The pilot or mechanic can change them. */
export const TBO_PRESETS: Record<ComponentType, number> = { Motor: 2000, Propeller: 2000, Fahrwerk: 3000, Magnet: 500, Vakuumpumpe: 500, Lichtmaschine: 1000, Anlasser: 1000, ELT: 0, Sonstiges: 0 }
/**
 * A part with a limited life. Used hours = aircraft hours now − aircraft hours at installation + hours it already had (used parts).
 * It can also have a calendar limit (many engines: hours or years, whichever comes first).
 */
export interface AcComponent {
  id: string; type: ComponentType; position?: string; model: string; manufacturer?: string; serial?: string; partNumber?: string
  tboHours: number; installedAt: string; hoursAtInstall: number; hoursOffset: number
  /** Last day (ISO) the part may stay installed, independent of hours. */
  calendarLimit?: string
  overhauls: number; notes?: string
  state: 'active' | 'removed' | 'scrapped'
  /** Day it left the aircraft and why. */
  endedAt?: string; endReason?: string
}
export const usedHours = (c: AcComponent, aircraftHours: number) => Math.max(0, aircraftHours - c.hoursAtInstall + c.hoursOffset)
export const componentName = (c: Pick<AcComponent, 'type' | 'position'>) => (c.position ? `${c.type} ${c.position}` : c.type)

export interface DocVersion { file: string; size: string; uploadedAt: string; uploadedBy: string; expires?: string; /** Only in the dummy: the file picked in this session (nothing is really stored). */ url?: string }
/** An aircraft document. It can expire; a blocking one that has expired stops reservations of the aircraft. */
export interface AcDoc { id: string; name: string; tags: string[]; expires?: string; blocks: boolean; file: string; size: string; uploadedAt: string; uploadedBy: string; versions: DocVersion[]; url?: string }

export interface Detail {
  hours: number; landings: number
  /** What people read and type for this aircraft. All values below are stored metric (kg, m, L). */
  units: Units
  emptyKg: number; emptyArm: number; mtow: number; maxFuelL: number
  envelope?: [number, number][] // [arm m, weight kg]
  stations?: Station[]
  maint: MaintItem[]; components: AcComponent[]; docs: AcDoc[]
  history: Service[]
  fuelType: string; burnLph: number
  equipment: string[]
}

const stations: Station[] = [
  { id: 'pilot', name: 'Pilot und Beifahrer', arm: 1.0, max: 200, unit: 'kg', def: 160 },
  { id: 'rear', name: 'Hintere Sitze / Springer', arm: 1.55, max: 300, unit: 'kg', def: 220 },
  { id: 'bag', name: 'Gepäckraum', arm: 2.43, max: 90, unit: 'kg', def: 0 },
  { id: 'fuel', name: 'Treibstoff', arm: 1.22, max: 200, unit: 'L', def: 120, density: 0.72 },
]
const doc = (id: string, name: string, expires: string | undefined, blocks: boolean, file: string, tags: string[] = []): AcDoc => ({ id, name, tags, expires, blocks, file, size: '186 KB', uploadedAt: '2026-01-12', uploadedBy: 'Eva Steiner', versions: [] })

export const details: Record<string, Detail> = {
  a1: {
    units: METRIC, hours: 4821.4, landings: 17432, emptyKg: 905, emptyArm: 1.04, mtow: 1406, maxFuelL: 200,
    envelope: [[0.84, 860], [0.84, 953], [0.97, 1406], [1.2, 1406], [1.2, 860]],
    stations,
    maint: [
      { id: 'm1', name: '100-h-Check', dueHours: 4839, intervalHours: 100, lastDone: '2026-10-02' },
      { id: 'm2', name: 'Jahresnachprüfung', dueDate: '2027-03-14', intervalMonths: 12, lastDone: '2026-03-14' },
      { id: 'm3', name: 'ELT-Batterie', dueDate: '2027-02-11', intervalMonths: 24 },
    ],
    components: [
      { id: 'c1', type: 'Motor', model: 'Lycoming IO-540', manufacturer: 'Lycoming', serial: 'L-12345-48A', tboHours: 2000, installedAt: '2019-05-20', hoursAtInstall: 3181.4, hoursOffset: 0, calendarLimit: '2031-05-20', overhauls: 1, state: 'active' },
      { id: 'c2', type: 'Propeller', model: 'McCauley 3A32C', manufacturer: 'McCauley', serial: 'MC-90211', tboHours: 2000, installedAt: '2025-11-19', hoursAtInstall: 3731.4, hoursOffset: 0, overhauls: 2, state: 'active' },
      { id: 'c3', type: 'Magnet', position: 'links', model: 'Slick 4371', serial: 'SL-5521', tboHours: 500, installedAt: '2024-04-03', hoursAtInstall: 4500.0, hoursOffset: 0, overhauls: 0, state: 'active' },
    ],
    docs: [
      doc('d1', 'Lufttüchtigkeitsprüfung (ARC)', '2027-03-14', true, 'ARC-OE-DZA-2026.pdf', ['Zulassung']),
      doc('d2', 'Versicherungsnachweis', '2026-12-31', true, 'Versicherung-OE-DZA-2026.pdf', ['Versicherung']),
      doc('d3', 'Wägebericht', undefined, false, 'Waegebericht-OE-DZA.pdf', ['Masse und Schwerpunkt']),
      doc('d4', 'Flughandbuch (AFM)', undefined, false, 'AFM-C182.pdf', ['Handbuch']),
    ],
    history: [
      { id: 'h1', date: '2026-10-02', type: '100-h-Check', hours: 4739.4, by: 'Fa. Hofer Flugtechnik' },
      { id: 'h2', date: '2026-03-14', type: 'Jahresnachprüfung', hours: 4601.0, by: 'Fa. Hofer Flugtechnik' },
      { id: 'h3', date: '2025-11-19', type: 'Propeller überholt', hours: 4388.2, by: 'Propeller Service GmbH' },
    ],
    fuelType: 'AVGAS 100LL', burnLph: 50, equipment: ['GNS 430', 'Transponder Mode S', 'ELT 406 MHz'],
  },
  a2: {
    // An aircraft with American units: the calculator and the data show lb, inches and US gallons (stored metric like all others).
    units: { mass: 'lb', length: 'in', fuel: 'gal' }, hours: 7310.2, landings: 22180, emptyKg: 640, emptyArm: 2.1, mtow: 1157, maxFuelL: 189,
    envelope: [[1.95, 600], [1.95, 820], [2.1, 1157], [2.35, 1157], [2.35, 600]],
    stations: [
      { id: 'front', name: 'Pilot und Beifahrer', arm: 2.05, max: 180, unit: 'kg', def: 150 },
      { id: 'rear', name: 'Rückbank', arm: 2.6, max: 200, unit: 'kg', def: 0 },
      { id: 'bag', name: 'Gepäckraum', arm: 2.9, max: 50, unit: 'kg', def: 0 },
      { id: 'fuel', name: 'Treibstoff', arm: 2.4, max: 189, unit: 'L', def: 100, density: 0.72 },
    ],
    maint: [{ id: 'm1', name: 'Jahresnachprüfung', dueDate: '2027-03-03', intervalMonths: 12, lastDone: '2026-03-03' }],
    components: [{ id: 'c1', type: 'Motor', model: 'Lycoming O-360', manufacturer: 'Lycoming', serial: 'L-3377-36A', tboHours: 2000, installedAt: '2021-02-10', hoursAtInstall: 6120.0, hoursOffset: 0, overhauls: 2, state: 'active' }],
    docs: [doc('d1', 'Versicherungsnachweis', '2026-11-19', true, 'Versicherung-OE-KFR-2026.pdf', ['Versicherung']), doc('d2', 'Lufttüchtigkeitsprüfung (ARC)', '2027-03-03', true, 'ARC-OE-KFR-2026.pdf', ['Zulassung'])],
    history: [{ id: 'h1', date: '2026-03-03', type: 'Jahresnachprüfung', hours: 7102.5, by: 'Fa. Hofer Flugtechnik' }],
    fuelType: 'AVGAS 100LL', burnLph: 36, equipment: ['GNS 430', 'Transponder Mode S'],
  },
  a3: {
    units: METRIC, hours: 2260.9, landings: 9120, emptyKg: 0, emptyArm: 0, mtow: 0, maxFuelL: 0,
    maint: [{ id: 'm1', name: 'Jahresnachprüfung', dueDate: '2027-05-01', intervalMonths: 12, lastDone: '2026-05-01' }],
    components: [{ id: 'c1', type: 'Motor', model: 'Pratt & Whitney PT6A-34', manufacturer: 'Pratt & Whitney', serial: 'PCE-71234', tboHours: 3600, installedAt: '2016-03-08', hoursAtInstall: 0, hoursOffset: 1200, overhauls: 0, notes: 'Überholung läuft, Rückgabe 24.11.', state: 'active' }],
    docs: [doc('d1', 'Versicherungsnachweis', '2027-06-30', true, 'Versicherung-OE-AXB-2026.pdf', ['Versicherung'])],
    history: [],
    fuelType: 'Jet A-1', burnLph: 110, equipment: [],
  },
}

// ---------- Due list (maintenance, components, documents in one) ----------
const HOURS_PER_DAY = 0.55 // club average (~200 flight hours a year), used to compare hours with dates
export const isoDays = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const dmy = (iso: string) => iso.split('-').reverse().join('.')
const fmtH = (h: number) => h.toLocaleString('de-AT', { maximumFractionDigits: 1 })
export type Tone = 'ok' | 'warn' | 'bad'
export type DueKind = 'Wartung' | 'Komponente' | 'Dokument'
/** One line of "what is due next": the comparable number of days, how to say it, and which tab shows it. */
export interface Due { id: string; name: string; kind: DueKind; days: number; label: string; tone: Tone; tab: 'wartung' | 'komponenten' | 'dokumente'; /** 0..1 how much of the life is used, for the bar. */ used?: number; blocks?: boolean }
export const toneOf = (days: number): Tone => (days < 14 ? 'bad' : days < 60 ? 'warn' : 'ok')

/** Earliest of an hour limit and a date limit, as days from today (hours are converted with the club average). */
function limit(hoursLeft: number | undefined, date: string | undefined, today: string): { days: number; label: string } {
  const byH = hoursLeft === undefined ? Infinity : hoursLeft / HOURS_PER_DAY
  const byD = date === undefined ? Infinity : isoDays(date, today)
  const hText = hoursLeft === undefined ? '' : hoursLeft <= 0 ? `${fmtH(-hoursLeft)} h überfällig` : `noch ${fmtH(hoursLeft)} h`
  const dText = date === undefined ? '' : byD < 0 ? `seit ${dmy(date)} abgelaufen` : `bis ${dmy(date)}`
  return byH <= byD ? { days: byH, label: [hText, dText && byD < Infinity && date ? dText : ''].filter(Boolean).join(' · ') } : { days: byD, label: [dText, hText].filter(Boolean).join(' · ') }
}

/** How much life an installed component has left: by hours, by calendar, whichever ends first. */
export function componentLife(c: AcComponent, aircraftHours: number, today: string): { days: number; label: string; tone: Tone; used?: number; usedH: number; leftH?: number } {
  const usedH = usedHours(c, aircraftHours)
  const leftH = c.tboHours ? c.tboHours - usedH : undefined
  const l = limit(leftH, c.calendarLimit, today)
  return { days: l.days, label: l.label || 'ohne Limit', tone: l.days === Infinity ? 'ok' : toneOf(l.days), used: c.tboHours ? Math.min(1, usedH / c.tboHours) : undefined, usedH, leftH }
}

export function dueList(d: Detail, today: string): Due[] {
  const out: Due[] = []
  for (const m of d.maint) {
    const l = limit(m.dueHours === undefined ? undefined : m.dueHours - d.hours, m.dueDate, today)
    out.push({ id: m.id, name: m.name, kind: 'Wartung', days: l.days, label: l.label, tone: toneOf(l.days), tab: 'wartung' })
  }
  for (const c of d.components.filter((x) => x.state === 'active')) {
    const l = componentLife(c, d.hours, today)
    out.push({ id: c.id, name: `${componentName(c)} (TBO)`, kind: 'Komponente', days: l.days, label: l.label, tone: l.tone, tab: 'komponenten', used: l.used })
  }
  for (const x of d.docs.filter((y) => y.expires)) {
    const days = isoDays(x.expires!, today)
    out.push({ id: x.id, name: x.name, kind: 'Dokument', days, label: days < 0 ? `seit ${dmy(x.expires!)} abgelaufen` : `bis ${dmy(x.expires!)}${days < 60 ? ` (in ${days} Tagen)` : ''}`, tone: days < 5 ? 'bad' : days < 45 ? 'warn' : 'ok', tab: 'dokumente', blocks: x.blocks })
  }
  return out.sort((a, b) => a.days - b.days)
}
/** A blocking document that has expired: the aircraft cannot be reserved until a new one is uploaded. */
export const blockingExpired = (d: Detail, today: string) => d.docs.filter((x) => x.blocks && x.expires && x.expires < today)
/**
 * Why an aircraft cannot be reserved (and so cannot fly: there is no flight without a reservation, otherwise nobody knows where the aircraft
 * is): in maintenance, or a blocking document has expired. `null` when it is free to use.
 */
export const groundedReason = (status: 'bereit' | 'wartung' | 'dokument', d: Detail, today: string): string | null =>
  status === 'wartung' ? 'in Wartung' : blockingExpired(d, today)[0] ? `${blockingExpired(d, today)[0].name} abgelaufen` : null
export const docState = (x: Pick<AcDoc, 'expires'>, today: string): { tone: Tone | 'none'; label: string } => {
  if (!x.expires) return { tone: 'none', label: 'Ohne Ablauf' }
  const days = isoDays(x.expires, today)
  return days < 0 ? { tone: 'bad', label: 'Abgelaufen' } : days < 45 ? { tone: 'warn', label: `Läuft in ${days} Tagen ab` } : { tone: 'ok', label: 'Gültig' }
}
/** Add months to an ISO date. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + months, 1))
  t.setUTCDate(Math.min(d, new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()))
  return t.toISOString().slice(0, 10)
}

export const inside = (poly: [number, number][], x: number, y: number) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}


/** Furthest aft CG allowed at a given weight (intersect the envelope with a horizontal line). */
export function aftLimit(poly: [number, number][], w: number) {
  let max = -Infinity
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]
    if ((y1 - w) * (y2 - w) <= 0 && y1 !== y2) max = Math.max(max, x1 + ((w - y1) * (x2 - x1)) / (y2 - y1))
  }
  return max
}
