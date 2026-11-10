import type { Jumper } from '../../data'
import type { Lang } from '../members/data'

// ---------- Manifest days, tandem windows and tandem bookings ----------
/** A day is planned, runs (check-in and boarding), is closed (charged) or was cancelled. */
export type DayStatus = 'geplant' | 'aktiv' | 'abgeschlossen' | 'abgesagt'

/**
 * A tandem window: the club offers `capacity` tandems between `from` and `to`. The shop shows exactly these windows, a booking
 * takes one place in a window. A day WITHOUT windows has no tandem booking in the shop (pure sport jumper days).
 */
export interface TandemWindow { id: string; from: string; to: string; capacity: number; /** Bookable in the shop. */ open: boolean }

export interface ManifestDay {
  id: string; date: string // ISO yyyy-mm-dd
  aircraft: string // registration
  from: string; to: string // operating hours, HH:MM
  status: DayStatus
  windows: TandemWindow[]
  note?: string
  /** Who covers which duty of the day, role id -> shifts. Several people can share a duty or take over from each other. */
  duties: Record<string, DutyShift[]>
  /** Only for closed days: the numbers, the flights themselves are not kept in the dummy. */
  done?: { flights: number; jumps: number }
  cancelReason?: string
}

/**
 * A duty of a manifest day (coordinator, shuttle driver, ...). The club defines the roles: `required` ones must be filled before the day
 * starts, a member may take a role when they hold ANY of `functions` (empty: every member).
 */
export interface DutyRole { id: string; name: string; required: boolean; /** At least this many people at any hour of the day (for required duties). */ min: number; functions: string[] }

/** One person on a duty from one full hour to another (`from` 9, `to` 13 = 9 to 13 o'clock). Minutes are not recorded. */
export interface DutyShift { memberId: string; from: number; to: number }

/** Settings of the manifest, per club: prices, the usual gap between flights, the usual operating hours and the duties of a day. */
/** An earlier price of a sport jump with the days it applied (ISO). `until` is the day the next price started. */
export interface PriceVersion { price: number; since: string; until: string }
export interface ManifestSettings { sportPrice: number; /** First day of the current price (ISO). */ sportPriceSince: string; /** Earlier prices, newest first. Archived, never edited. */ sportPriceHistory: PriceVersion[]; loadGap: number; /** Usual flight time of a jump flight in minutes (cycle time), the default of the AFP. */ cycleMin: number; from: string; to: string; roles: DutyRole[] }
export const DEFAULT_SETTINGS: ManifestSettings = {
  sportPrice: 40, sportPriceSince: '2026-01-01', sportPriceHistory: [{ price: 35, since: '2025-01-01', until: '2026-01-01' }], loadGap: 45, cycleMin: 30, from: '09:00', to: '17:00',
  roles: [
    { id: 'r-coord', name: 'Manifest-Koordinator', required: true, min: 1, functions: ['manifest_coordinator'] },
    { id: 'r-shuttle', name: 'Shuttlebusfahrer', required: false, min: 1, functions: [] },
  ],
}

/** Whole hours the day runs: 09:00 to 16:30 gives 9 to 17. */
export const dayHours = (d: Pick<ManifestDay, 'from' | 'to'>) => ({ from: Math.floor(minutes(d.from) / 60), to: Math.ceil(minutes(d.to) / 60) })
export const hourRange = (s: Pick<DutyShift, 'from' | 'to'>) => `${s.from}–${s.to} Uhr`
export const shiftHours = (s: DutyShift) => Math.max(0, s.to - s.from)

/** The day with the shifts of one duty replaced. */
export const withShifts = (day: ManifestDay, roleId: string, shifts: DutyShift[]): ManifestDay => {
  const duties = { ...day.duties }
  if (shifts.length > 0) duties[roleId] = shifts
  else delete duties[roleId]
  return { ...day, duties }
}

/** Hours of the day in which fewer people than needed cover a required duty, as ranges ([9, 13] = 9 to 13 o'clock). */
export const dutyGaps = (day: Pick<ManifestDay, 'from' | 'to' | 'duties'>, role: DutyRole): [number, number][] => {
  if (!role.required) return []
  const { from, to } = dayHours(day)
  const need = Math.max(1, role.min)
  const gaps: [number, number][] = []
  for (let h = from; h < to; h++) {
    const here = (day.duties[role.id] ?? []).filter((s) => s.memberId && s.from <= h && h < s.to).length
    if (here >= need) continue
    const last = gaps[gaps.length - 1]
    if (last && last[1] === h) last[1] = h + 1
    else gaps.push([h, h + 1])
  }
  return gaps
}

/** Required duties that are not covered during the whole day. Only a warning, never a lock. */
export const missingDuties = (day: Pick<ManifestDay, 'from' | 'to' | 'duties'>, roles: DutyRole[]) =>
  roles.map((role) => ({ role, gaps: dutyGaps(day, role) })).filter((m) => m.gaps.length > 0)

/**
 * How often each member covered each duty and for how many hours. A day counts as `done` once it is closed or cancelled, before that the
 * entries are `planned`.
 */
export type DutyCount = { done: number; hours: number; planned: number }
export const dutyCounts = (days: ManifestDay[]) => {
  const out: Record<string, Record<string, DutyCount>> = {}
  for (const d of days) {
    const final = d.status === 'abgeschlossen' || d.status === 'abgesagt'
    for (const [role, shifts] of Object.entries(d.duties)) {
      for (const member of new Set(shifts.map((x) => x.memberId).filter(Boolean))) {
        const c = ((out[member] ??= {})[role] ??= { done: 0, hours: 0, planned: 0 })
        if (final) { c.done++; c.hours += shifts.filter((x) => x.memberId === member).reduce((n, x) => n + shiftHours(x), 0) } else c.planned++
      }
    }
  }
  return out
}

export type BookingSource = 'Webshop' | 'Telefon' | 'Vor Ort'
/** The signed carriage agreement of a tandem guest, created at the tandem check-in. */
export interface Checkin { at: string; lang: Lang; pdf: string; answers: Record<string, string> }
/** One tandem guest. `loadId` is not stored: where the guest sits is read from the loads (single source of truth). */
export interface TandemBooking {
  id: string; dayId: string; windowId?: string
  first: string; last: string; weight?: number; email?: string; phone?: string
  source: BookingSource; voucher?: string; paidOnline: boolean; price: number
  state: 'gebucht' | 'storniert' | 'nicht_erschienen'
  /** The tandem master who flies the guest. Set before or on the flight, read from here everywhere (single source of truth). */
  masterId?: string
  checkin?: Checkin
}

/** Where a guest is: expected (booked), planned on a flight without being here yet, waiting (checked in) or on a flight. */
export type Stage = 'erwartet' | 'eingeplant' | 'wartend' | 'auf_flug'
export const stageOf = (b: TandemBooking, onLoad: boolean): Stage => (b.checkin ? (onLoad ? 'auf_flug' : 'wartend') : onLoad ? 'eingeplant' : 'erwartet')
export const stageLabel: Record<Stage, string> = { erwartet: 'Erwartet', eingeplant: 'Eingeplant, noch nicht da', wartend: 'Eingecheckt', auf_flug: 'Auf einem Flug' }

export const fullName = (b: Pick<TandemBooking, 'first' | 'last'>) => `${b.first} ${b.last}`
/** "Markus K." for the kiosk: other guests see no full names. */
export const shortName = (b: Pick<TandemBooking, 'first' | 'last'>) => `${b.first} ${b.last[0]}.`

/**
 * One line per person for the closing: several jumps of a sport jumper are summed up. The sport price of the club applies to each jump
 * and to each paid empty seat.
 */
export const perPerson = (jumpers: Jumper[], sportPrice: number): Jumper[] => {
  const out: Jumper[] = []
  for (const j of jumpers) {
    if (j.kind !== 'sport') { out.push(j); continue }
    const seen = out.find((x) => x.id === j.id)
    const flew = j.noShow ? 0 : 1, paid = j.noShow ? 1 : 0
    if (seen) { seen.price += sportPrice; seen.jumps = (seen.jumps ?? 0) + flew; seen.paidSeats = (seen.paidSeats ?? 0) + paid; seen.noShow = (seen.jumps ?? 0) === 0 }
    else out.push({ ...j, price: sportPrice, jumps: flew, paidSeats: paid, noShow: flew === 0 })
  }
  return out
}

/** A booking as a person on a load. The check-in state is read from the booking, not copied. */
export const tandemJumper = (b: TandemBooking): Jumper => ({
  id: `t-${b.id}`, bookingId: b.id, name: `Tandem: ${b.first[0]}. ${b.last}`, kind: 'tandem', weight: b.weight, price: b.price,
  note: b.voucher ? `Voucher ${b.voucher}` : b.paidOnline ? 'Online bezahlt' : undefined,
})

// ---------- Calendar helpers (real dates, independent of the prototype calendar of the reservations) ----------
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
/** The price of a sport jump that applied on this day: a new price never reaches days before it started. */
export const sportPriceOn = (s: ManifestSettings, iso: string) =>
  iso >= s.sportPriceSince ? s.sportPrice : (s.sportPriceHistory.find((h) => iso >= h.since && iso < h.until) ?? s.sportPriceHistory[s.sportPriceHistory.length - 1])?.price ?? s.sportPrice
/** A new price from today on; the current one moves into the archive. */
export const withSportPrice = (s: ManifestSettings, price: number, todayIso: string): ManifestSettings =>
  price === s.sportPrice ? s : { ...s, sportPrice: price, sportPriceSince: todayIso, sportPriceHistory: [{ price: s.sportPrice, since: s.sportPriceSince, until: todayIso }, ...s.sportPriceHistory] }
export const dmy = (iso: string) => iso.split('-').reverse().join('.')
export const dm = (iso: string) => dmy(iso).slice(0, 6)
export const weekday = (iso: string) => WD[parse(iso).getDay()]
/** "Sa 07.11.2026" */
export const dayName = (iso: string) => `${weekday(iso)} ${dmy(iso)}`
export const dayId = (iso: string) => `d-${iso}`

export const minutes = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
export const hm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const windowLabel = (w: Pick<TandemWindow, 'from' | 'to'>) => `${w.from}–${w.to}`

/** A new window id. */
export const newWindowId = () => `w-${Math.random().toString(36).slice(2, 8)}`
/** `count` windows of equal length between two times, e.g. 10:00 to 16:00 in 2 windows of 3 hours. */
export const splitWindows = (from: string, to: string, count: number, capacity: number): TandemWindow[] => {
  const len = Math.floor((minutes(to) - minutes(from)) / Math.max(1, count))
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({ id: newWindowId(), from: hm(minutes(from) + i * len), to: hm(minutes(from) + (i + 1) * len), capacity, open: true }))
}
/** Windows in time order; a window is valid when it ends after it starts. */
export const byTime = (ws: TandemWindow[]) => [...ws].sort((a, b) => minutes(a.from) - minutes(b.from))
export const windowValid = (w: Pick<TandemWindow, 'from' | 'to'>) => !!w.from && !!w.to && minutes(w.to) > minutes(w.from)
/** Tandems that fit on one flight: a tandem pair takes 2 places. */
export const perFlight = (reg: string) => Math.max(1, Math.floor(capacityOf(reg) / 2))
/** The window a flight time lies in (start included, end excluded). */
export const windowAt = (ws: TandemWindow[], time: string) => ws.find((w) => minutes(time) >= minutes(w.from) && minutes(time) < minutes(w.to))

/** Places of the aircraft on a load (a tandem pair takes 2). */
export const CAPACITY: Record<string, number> = { 'OE-DZA': 5, 'OE-AXB': 9 }
export const capacityOf = (reg: string) => CAPACITY[reg] ?? 5

/** The day the prototype is on (07.11.2026): where the dashboard and the menu lead to. */
export const TODAY_DAY = 'd-2026-11-07'
export const MANIFEST_TODAY = `/manifest/${TODAY_DAY}`

// ---------- Seed data ----------
const D = (iso: string) => dayId(iso)
const sh = (memberId: string, from: number, to: number): DutyShift => ({ memberId, from, to })
const win = (id: string, from: string, to: string, capacity: number, open = true): TandemWindow => ({ id, from, to, capacity, open })

export const seedDays: ManifestDay[] = [
  { id: D('2026-11-07'), date: '2026-11-07', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'aktiv', duties: { 'r-coord': [sh('m8', 9, 17)], 'r-shuttle': [sh('m1', 9, 13), sh('m4', 13, 17)] }, windows: [win('w1', '10:00', '12:00', 3), win('w2', '12:00', '14:00', 3), win('w3', '14:00', '16:00', 3)] },
  { id: D('2026-11-08'), date: '2026-11-08', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'geplant', duties: { 'r-coord': [sh('m8', 9, 17)] }, windows: [], note: 'Sportspringer-Tag, keine Tandems' },
  { id: D('2026-11-14'), date: '2026-11-14', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'geplant', duties: {}, windows: [win('w4', '10:00', '12:00', 2), win('w5', '12:00', '14:00', 2), win('w6', '14:00', '16:00', 2)] },
  { id: D('2026-11-22'), date: '2026-11-22', aircraft: 'OE-DZA', from: '09:00', to: '16:00', status: 'geplant', duties: {}, windows: [win('w7', '10:00', '13:00', 3)] },
  { id: D('2026-10-31'), date: '2026-10-31', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'abgeschlossen', duties: { 'r-coord': [sh('m8', 9, 17)], 'r-shuttle': [sh('m4', 9, 17)] }, windows: [], done: { flights: 14, jumps: 38 } },
  { id: D('2026-10-24'), date: '2026-10-24', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'abgeschlossen', duties: { 'r-coord': [sh('m8', 9, 17)], 'r-shuttle': [sh('m1', 9, 17)] }, windows: [], done: { flights: 9, jumps: 24 } },
  { id: D('2026-10-17'), date: '2026-10-17', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'abgeschlossen', duties: { 'r-coord': [sh('m8', 9, 17)], 'r-shuttle': [sh('m4', 9, 13), sh('m1', 13, 17)] }, windows: [], done: { flights: 11, jumps: 29 } },
  { id: D('2026-10-10'), date: '2026-10-10', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'abgeschlossen', duties: { 'r-coord': [sh('m8', 9, 17)], 'r-shuttle': [sh('m2', 9, 17)] }, windows: [], done: { flights: 12, jumps: 31 } },
  { id: D('2026-10-03'), date: '2026-10-03', aircraft: 'OE-DZA', from: '09:00', to: '17:00', status: 'abgeschlossen', duties: { 'r-coord': [sh('m8', 9, 17)], 'r-shuttle': [sh('m7', 9, 17)] }, windows: [], done: { flights: 8, jumps: 20 } },
]

const bk = (id: string, dayId: string, windowId: string | undefined, first: string, last: string, weight: number, extra: Partial<TandemBooking> = {}): TandemBooking => ({
  id, dayId, windowId, first, last, weight, email: `${first.toLowerCase()}.${last.toLowerCase().replace('ö', 'oe')}@example.at`, phone: '+43 660 5550101', source: 'Webshop', paidOnline: true, price: 220, state: 'gebucht', ...extra,
})
export const seedBookings: TandemBooking[] = [
  bk('bk1', D('2026-11-07'), 'w1', 'Markus', 'Köhler', 92, { masterId: 'm3', voucher: 'GS-1042', paidOnline: false, checkin: { at: '07.11.2026 09:48', lang: 'de', pdf: 'Befoerderungsvertrag-Koehler-2026-11-07.pdf', answers: {} } }),
  bk('bk2', D('2026-11-07'), 'w1', 'Lena', 'Hofer', 61),
  bk('bk3', D('2026-11-07'), 'w2', 'Tobias', 'Brandner', 84, { paidOnline: false }),
  bk('bk4', D('2026-11-07'), 'w2', 'Karin', 'Aigner', 66, { source: 'Telefon', paidOnline: false }),
  bk('bk5', D('2026-11-14'), 'w4', 'Michael', 'Steindl', 79),
  bk('bk6', D('2026-11-14'), 'w4', 'Petra', 'Gruber', 58, { voucher: 'GS-1051', paidOnline: false }),
  bk('bk7', D('2026-11-22'), 'w7', 'Sandra', 'Auer', 71, { voucher: 'GS-1044', price: 290 }),
]
