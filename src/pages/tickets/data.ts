/**
 * Tickets and vouchers (THROWAWAY mock data). A voucher is a prepaid claim on one tandem jump with its own life cycle; a ticket is a tandem
 * booking bought for a day. They stay separate: redeeming a voucher books the guest in the manifest but does not create a ticket.
 * The catalog says which kinds exist and what they cost. Prices are versioned like operation kinds: a change never reaches what was sold.
 */
import type { BookingSource } from '../manifest/data'

// ---------- Catalog ----------
export type CatalogKind = 'voucher' | 'ticket'
export const KIND_NAME: Record<CatalogKind, string> = { voucher: 'Gutschein', ticket: 'Ticket' }

/** An old price (and validity) with the days it applied (ISO); `until` is the day the next version started. Archived, never edited. */
export interface CatalogVersion { since: string; until: string; price: number; validityMonths?: number }
export interface CatalogItem {
  id: string; kind: CatalogKind; name: string; nameEn: string
  /** Start of the codes: GS-1043. */
  prefix: string; templateId: string
  /** Can be sold and issued. A switched-off kind stays readable on everything that was sold with it. */
  active: boolean
  price: number
  /** Vouchers only: how long a voucher of this kind is valid. */
  validityMonths?: number
  /** First day (ISO) of the current price. */
  since: string
  /** Earlier prices, newest first. */
  history: CatalogVersion[]
  /** Shop presentation, edited under Shop und Mails. */
  description: string; features: string[]; shownOn: { page: string; label: string }[]
}

export const DEFAULT_CATALOG: CatalogItem[] = [
  { id: 'p1', kind: 'ticket', name: 'Tandemsprung', nameEn: 'Tandem jump', price: 220, since: '2026-01-01', history: [{ since: '2025-01-01', until: '2026-01-01', price: 200 }], prefix: 'TB', active: true, templateId: 't3', description: 'Ca. 45 Sekunden freier Fall aus 4.000 m.', features: ['Tandem-Master', 'Ausrüstung', 'Einweisung'], shownOn: [{ page: 'bookings', label: 'Seite „Termin buchen“' }, { page: 'home', label: 'Karte „Direkt buchen“' }] },
  { id: 'p2', kind: 'ticket', name: 'Tandem + Video', nameEn: 'Tandem + video', price: 290, since: '2026-01-01', history: [], prefix: 'TV', active: true, templateId: 't3', description: 'Tandemsprung inklusive Video.', features: ['Tandem-Master', 'Ausrüstung', 'Video in HD'], shownOn: [{ page: 'bookings', label: 'Seite „Termin buchen“' }] },
  { id: 'p3', kind: 'voucher', name: 'Tandem-Gutschein', nameEn: 'Tandem voucher', price: 220, validityMonths: 12, since: '2026-01-01', history: [{ since: '2025-01-01', until: '2026-01-01', price: 200, validityMonths: 12 }], prefix: 'GS', active: true, templateId: 't1', description: 'Gültig für einen Tandemsprung.', features: ['Tandemsprung', '12 Monate gültig'], shownOn: [{ page: 'vouchers', label: 'Seite „Gutscheine“' }, { page: 'home', label: 'Karte „Gutschein verschenken“' }] },
  { id: 'p4', kind: 'voucher', name: 'Tandem + Video Gutschein', nameEn: 'Tandem + video voucher', price: 290, validityMonths: 12, since: '2026-01-01', history: [], prefix: 'GV', active: false, templateId: 't2', description: 'Mit Video-Paket.', features: ['Tandemsprung', 'Video'], shownOn: [{ page: 'vouchers', label: 'Seite „Gutscheine“' }] },
]

const sameTerms = (a: Pick<CatalogItem, 'price' | 'validityMonths'>, b: Pick<CatalogItem, 'price' | 'validityMonths'>) => a.price === b.price && a.validityMonths === b.validityMonths
/**
 * Saves a catalog item. Names and switches change in place; a changed price or validity closes the current version into the archive and
 * starts a new one today, so what was sold keeps its price and its terms.
 */
export function saveCatalogItem(old: CatalogItem | undefined, next: CatalogItem, todayIso: string): CatalogItem {
  if (!old || sameTerms(old, next)) return { ...next, since: old?.since ?? todayIso, history: old?.history ?? [] }
  return { ...next, since: todayIso, history: [{ since: old.since, until: todayIso, price: old.price, validityMonths: old.validityMonths }, ...old.history] }
}

// ---------- Shared ----------
export interface Person { first: string; last: string; email: string; phone?: string }
export const fullName = (p: Pick<Person, 'first' | 'last'>) => `${p.first} ${p.last}`.trim()
/** `legacy`: paid in the earlier system, there is no posting in Finanzen. */
export type PayMethod = 'online' | 'bank' | 'cash' | 'legacy'
export const PAY_NAME: Record<PayMethod, string> = { online: 'Online', bank: 'Überweisung', cash: 'Bar', legacy: 'Altsystem' }
/**
 * A staff member checked the confirmation of a bank transfer although the money is not in Finanzen yet (the guest may fly meanwhile).
 * It is NOT a payment: the treasurer still assigns the real bank line later, which clears the proof.
 */
export interface PayProof { by: string; /** ISO day. */ at: string; note?: string }
/** One line of the history of a voucher or ticket: what happened, or a comment of the staff. */
export interface LogEntry { id: string; at: string; by: string; kind: 'event' | 'comment'; text: string }

/** The next free code of a kind: GS-1052 follows GS-1051. */
export const nextCode = (prefix: string, codes: string[]) => `${prefix}-${Math.max(1000, ...codes.filter((c) => c.startsWith(`${prefix}-`)).map((c) => Number(c.split('-')[1]) || 0)) + 1}`

// ---------- Vouchers ----------
export type VoucherStatus = 'active' | 'unpaid' | 'reserved' | 'pre_scheduled' | 'redeemed' | 'redeemed_noshow' | 'expired' | 'cancelled'
export const VOUCHER_STATUS: Record<VoucherStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  active: { label: 'Offen', tone: 'ok' },
  unpaid: { label: 'Unbezahlt', tone: 'warn' },
  reserved: { label: 'Termin gebucht', tone: 'info' },
  pre_scheduled: { label: 'Wunschtermin', tone: 'warn' },
  redeemed: { label: 'Eingelöst', tone: 'neutral' },
  redeemed_noshow: { label: 'Nicht erschienen', tone: 'bad' },
  expired: { label: 'Abgelaufen', tone: 'neutral' },
  cancelled: { label: 'Storniert', tone: 'bad' },
}
export interface Voucher {
  code: string; typeId: string; buyer: Person
  /** Day of purchase, valid until (ISO). */
  bought: string; validUntil: string
  /** What the buyer paid; the catalog price of that day. */
  price: number; pay: PayMethod; paid: boolean
  proof?: PayProof
  /** Day the money came in (ISO) and the posting in Finanzen (bank line or cash line) that shows it. */
  paidOn?: string; payLineId?: string
  status: VoucherStatus
  /** The booking in the manifest that holds the date; the day and window are read from there. */
  bookingId?: string
  /** A date only pencilled in: it does not take a place in a window. */
  wishDay?: string
  message?: string
  /** Entered from an older system with its own code. */
  legacy?: boolean
  cancelReason?: string; statusBeforeCancel?: VoucherStatus
  log: LogEntry[]
}

/** Cancelled and the money is back with the buyer only once it was refunded. */
export const refundOpen = (t: Ticket) => t.status === 'cancelled' && t.paid && !t.refunded && t.price > 0

/** Redeeming, moving and extending only make sense while the voucher can still be used. */
export const isUsable = (v: Pick<Voucher, 'status'>) => v.status === 'active' || v.status === 'unpaid' || v.status === 'reserved' || v.status === 'pre_scheduled'
/** Days until the voucher expires; negative when it is over. */
export const daysLeft = (iso: string, todayIso: string) => Math.round((Date.parse(iso) - Date.parse(todayIso)) / 86400000)
export const SOON_DAYS = 30
/** The voucher is usable and runs out within the warning time. */
export const expiresSoon = (v: Voucher, todayIso: string) => isUsable(v) && daysLeft(v.validUntil, todayIso) <= SOON_DAYS && daysLeft(v.validUntil, todayIso) >= 0
/** Adds months to an ISO date (a day that does not exist in the target month moves to its last day). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(d, last))
  return t.toISOString().slice(0, 10)
}

// ---------- Tickets ----------
export type TicketStatus = 'booked' | 'flown' | 'noshow' | 'cancelled'
export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  booked: { label: 'Gebucht', tone: 'info' },
  flown: { label: 'Geflogen', tone: 'ok' },
  noshow: { label: 'Nicht erschienen', tone: 'bad' },
  cancelled: { label: 'Storniert', tone: 'neutral' },
}
export interface Ticket {
  code: string; typeId: string; buyer: Person
  /** The guest who jumps, as typed at the booking. */
  guest: string; weight?: number
  bought: string
  /** Day (ISO) and the window of the day; the booking in the manifest carries the same. */
  day: string; windowLabel: string; bookingId?: string
  price: number; pay: PayMethod; paid: boolean
  proof?: PayProof
  paidOn?: string; payLineId?: string
  status: TicketStatus
  /** Cancelled and the money is back with the buyer. */
  refunded?: boolean
  source: BookingSource
  cancelReason?: string; statusBeforeCancel?: TicketStatus
  log: LogEntry[]
}

const ev = (id: string, at: string, text: string, by = 'System'): LogEntry => ({ id, at, by, kind: 'event', text })
const cm = (id: string, at: string, text: string, by: string): LogEntry => ({ id, at, by, kind: 'comment', text })
const person = (name: string, phone?: string): Person => {
  const at = name.lastIndexOf(' ')
  const [first, last] = [name.slice(0, at), name.slice(at + 1)]
  const slug = (x: string) => x.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z]/g, '')
  return { first, last, email: `${slug(first)}.${slug(last)}@example.at`, phone }
}
const bought = (iso: string, price: number, pay: PayMethod) => ev(`b-${iso}`, `${iso} 10:12`, `${pay === 'online' ? 'Online gekauft' : 'Erfasst'}, ${price} €`, pay === 'online' ? 'Webshop' : 'Kassa')

/** Seed rows: a paid one was paid on the day it was bought. */
const withPaidOn = <T extends { paid: boolean; bought: string; paidOn?: string }>(x: T): T => (x.paid && !x.paidOn ? { ...x, paidOn: x.bought } : x)

const rawVouchers: Voucher[] = [
  { code: 'GS-1038', typeId: 'p3', buyer: person('Familie Lehner', '+43 664 5550138'), bought: '2025-11-16', validUntil: '2026-11-16', price: 220, pay: 'online', paid: true, status: 'active', message: 'Alles Gute zum 18.!', log: [bought('2025-11-16', 220, 'online'), ev('l2', '2026-11-02 08:00', 'Erinnerung „läuft bald ab“ gesendet')] },
  { code: 'GS-1042', typeId: 'p3', buyer: person('Anna Köhler'), bought: '2026-03-02', validUntil: '2027-03-02', price: 220, pay: 'online', paid: true, status: 'reserved', bookingId: 'bk1', log: [bought('2026-03-02', 220, 'online'), ev('l2', '2026-10-20 14:03', 'Termin 07.11.2026 (10:00–12:00) gebucht für Markus Köhler', 'Eva Steiner')] },
  { code: 'GS-1043', typeId: 'p3', buyer: person('Julia Reiter'), bought: '2026-10-28', validUntil: '2027-10-28', price: 220, pay: 'online', paid: true, status: 'active', message: 'Für den ersten Flug deines Lebens.', log: [bought('2026-10-28', 220, 'online'), ev('l2', '2026-10-28 10:13', 'Gutschein-PDF per Mail gesendet')] },
  { code: 'GS-1044', typeId: 'p4', buyer: person('Sandra Auer', '+43 650 5550144'), bought: '2026-09-12', validUntil: '2027-09-12', price: 290, pay: 'online', paid: true, status: 'reserved', bookingId: 'bk7', log: [bought('2026-09-12', 290, 'online'), ev('l2', '2026-10-30 09:41', 'Termin 22.11.2026 (10:00–13:00) gebucht für Sandra Auer', 'Online')] },
  { code: 'GS-1051', typeId: 'p3', buyer: person('Petra Gruber'), bought: '2026-06-19', validUntil: '2027-06-19', price: 220, pay: 'cash', paid: true, status: 'reserved', bookingId: 'bk6', log: [bought('2026-06-19', 220, 'cash'), ev('l2', '2026-10-25 16:20', 'Termin 14.11.2026 (10:00–12:00) gebucht für Petra Gruber', 'Eva Steiner')] },
  { code: 'GS-1045', typeId: 'p3', buyer: person('Thomas Winkler', '+43 676 5550145'), bought: '2026-11-03', validUntil: '2027-11-03', price: 220, pay: 'bank', paid: false, status: 'unpaid', log: [ev('b', '2026-11-03 11:30', 'Erfasst, Zahlung per Überweisung offen', 'Eva Steiner'), cm('c0', '2026-11-03 11:31', 'Überweisung zugesagt bis 10.11.', 'Eva Steiner'), cm('c1', '2026-11-05 09:12', 'Kunde ruft nächste Woche an, falls das Geld nicht angekommen ist.', 'Eva Steiner')] },
  { code: 'GS-1049', typeId: 'p3', buyer: person('Maria Kofler'), bought: '2026-11-05', validUntil: '2027-11-05', price: 220, pay: 'bank', paid: false, status: 'unpaid', log: [ev('b', '2026-11-05 14:02', 'Erfasst, Zahlung per Überweisung offen', 'Eva Steiner')] },
  { code: 'GS-1046', typeId: 'p3', buyer: person('Maria Egger'), bought: '2026-08-01', validUntil: '2027-08-01', price: 220, pay: 'online', paid: true, status: 'pre_scheduled', wishDay: '2026-12-05', log: [bought('2026-08-01', 220, 'online'), ev('l2', '2026-10-15 17:44', 'Wunschtermin 05.12.2026 vorgemerkt, belegt keinen Platz', 'Eva Steiner')] },
  { code: 'GS-1047', typeId: 'p3', buyer: person('Lukas Berger'), bought: '2026-04-11', validUntil: '2026-11-14', price: 220, pay: 'online', paid: true, status: 'active', log: [bought('2026-04-11', 220, 'online')] },
  { code: 'GS-1048', typeId: 'p3', buyer: person('Helga Fuchs'), bought: '2026-05-20', validUntil: '2027-05-20', price: 220, pay: 'online', paid: true, status: 'active', log: [bought('2026-05-20', 220, 'online')] },
  { code: 'GS-1030', typeId: 'p3', buyer: person('Christian Moser'), bought: '2026-02-14', validUntil: '2027-02-14', price: 220, pay: 'online', paid: true, status: 'redeemed', log: [bought('2026-02-14', 220, 'online'), ev('l2', '2026-10-31 13:05', 'Geflogen am 31.10.2026, Ertrag verbucht')] },
  { code: 'GS-1031', typeId: 'p3', buyer: person('Katharina Pichler'), bought: '2026-03-30', validUntil: '2027-03-30', price: 220, pay: 'online', paid: true, status: 'redeemed_noshow', log: [bought('2026-03-30', 220, 'online'), ev('l2', '2026-10-24 17:10', 'Nicht erschienen am 24.10.2026, Gutschein verfällt', 'Manifest')] },
  { code: 'GS-1020', typeId: 'p3', buyer: person('Stefan Haas'), bought: '2025-09-05', validUntil: '2026-09-05', price: 200, pay: 'online', paid: true, status: 'expired', log: [bought('2025-09-05', 200, 'online'), ev('l2', '2026-09-06 00:05', 'Abgelaufen')] },
  { code: 'GS-1033', typeId: 'p3', buyer: person('Doris Leitner'), bought: '2026-07-07', validUntil: '2027-07-07', price: 220, pay: 'cash', paid: true, status: 'cancelled', statusBeforeCancel: 'active', cancelReason: 'Käuferin hat den Gutschein zurückgegeben', log: [bought('2026-07-07', 220, 'cash'), ev('l2', '2026-09-18 15:22', 'Storniert: Käuferin hat den Gutschein zurückgegeben', 'Eva Steiner')] },
  { code: 'GS-1010', typeId: 'p3', buyer: person('Gerhard Wallner'), bought: '2025-04-02', validUntil: '2026-04-02', price: 200, pay: 'legacy', paid: true, legacy: true, status: 'expired', log: [ev('b', '2026-01-05 10:00', 'Aus Altsystem übernommen, Code GS-1010', 'Eva Steiner')] },
]
export const seedVouchers = rawVouchers.map(withPaidOn)

const rawTickets: Ticket[] = [
  { code: 'TB-1107', typeId: 'p1', buyer: person('Lena Hofer', '+43 660 5550102'), guest: 'Lena Hofer', weight: 61, bought: '2026-10-18', day: '2026-11-07', windowLabel: '10:00–12:00', bookingId: 'bk2', price: 220, pay: 'online', paid: true, status: 'booked', source: 'Webshop', log: [bought('2026-10-18', 220, 'online'), ev('l2', '2026-10-18 10:13', 'Ticket-PDF per Mail gesendet')] },
  { code: 'TB-1108', typeId: 'p1', buyer: person('Tobias Brandner'), guest: 'Tobias Brandner', weight: 84, bought: '2026-10-21', day: '2026-11-07', windowLabel: '12:00–14:00', bookingId: 'bk3', price: 220, pay: 'bank', paid: false, status: 'booked', source: 'Webshop', log: [ev('b', '2026-10-21 18:20', 'Online gebucht, Zahlung per Überweisung offen', 'Webshop')] },
  { code: 'TB-1109', typeId: 'p1', buyer: person('Karin Aigner', '+43 660 5550104'), guest: 'Karin Aigner', weight: 66, bought: '2026-11-04', day: '2026-11-07', windowLabel: '12:00–14:00', bookingId: 'bk4', price: 220, pay: 'cash', paid: false, status: 'booked', source: 'Telefon', log: [ev('b', '2026-11-04 15:40', 'Telefonisch gebucht, Zahlung vor Ort', 'Eva Steiner'), cm('c0', '2026-11-04 15:41', 'Zahlung beim Abschluss', 'Eva Steiner')] },
  { code: 'TB-1110', typeId: 'p1', buyer: person('Michael Steindl'), guest: 'Michael Steindl', weight: 79, bought: '2026-10-29', day: '2026-11-14', windowLabel: '10:00–12:00', bookingId: 'bk5', price: 220, pay: 'online', paid: true, status: 'booked', source: 'Webshop', log: [bought('2026-10-29', 220, 'online')] },
  { code: 'TV-1101', typeId: 'p2', buyer: person('Barbara Kern', '+43 699 5550111'), guest: 'Barbara Kern', weight: 63, bought: '2026-10-02', day: '2026-10-31', windowLabel: '10:00–12:00', price: 290, pay: 'online', paid: true, status: 'flown', source: 'Webshop', log: [bought('2026-10-02', 290, 'online'), ev('l2', '2026-10-31 12:40', 'Geflogen, Ertrag 290 € verbucht')] },
  { code: 'TB-1096', typeId: 'p1', buyer: person('Florian Ortner'), guest: 'Florian Ortner', weight: 88, bought: '2026-10-09', day: '2026-10-31', windowLabel: '12:00–14:00', price: 220, pay: 'online', paid: true, status: 'flown', source: 'Webshop', log: [bought('2026-10-09', 220, 'online'), ev('l2', '2026-10-31 14:15', 'Geflogen, Ertrag 220 € verbucht')] },
  { code: 'TB-1090', typeId: 'p1', buyer: person('Nina Strasser'), guest: 'Nina Strasser', weight: 57, bought: '2026-09-28', day: '2026-10-24', windowLabel: '10:00–12:00', price: 220, pay: 'online', paid: true, status: 'flown', source: 'Webshop', log: [bought('2026-09-28', 220, 'online')] },
  { code: 'TB-1091', typeId: 'p1', buyer: person('Jakob Riedl'), guest: 'Jakob Riedl', weight: 95, bought: '2026-09-30', day: '2026-10-24', windowLabel: '12:00–14:00', price: 220, pay: 'online', paid: true, status: 'noshow', source: 'Webshop', log: [bought('2026-09-30', 220, 'online'), ev('l2', '2026-10-24 17:10', 'Nicht erschienen, nicht erstattet (Frist verpasst)', 'Manifest')] },
  { code: 'TB-1080', typeId: 'p1', buyer: person('Eva Mayr'), guest: 'Eva Mayr', weight: 60, bought: '2026-09-11', day: '2026-10-17', windowLabel: '10:00–12:00', price: 220, pay: 'online', paid: true, status: 'cancelled', refunded: true, statusBeforeCancel: 'booked', cancelReason: 'Schlechtwetter, Betrieb abgesagt', source: 'Webshop', log: [bought('2026-09-11', 220, 'online'), ev('l2', '2026-10-17 08:30', 'Storniert: Schlechtwetter, Betrieb abgesagt', 'Eva Steiner'), ev('l3', '2026-10-19 09:15', 'Erstattung 220 € überwiesen', 'Eva Steiner')] },
  { code: 'TB-1075', typeId: 'p1', buyer: person('Paul Gruber'), guest: 'Paul Gruber', weight: 82, bought: '2026-09-02', day: '2026-10-10', windowLabel: '12:00–14:00', price: 220, pay: 'online', paid: true, status: 'cancelled', statusBeforeCancel: 'booked', cancelReason: 'Gast krank, Erstattung offen', source: 'Webshop', log: [bought('2026-09-02', 220, 'online'), ev('l2', '2026-10-09 18:02', 'Storniert: Gast krank, Erstattung offen', 'Eva Steiner')] },
]
export const seedTickets = rawTickets.map(withPaidOn)
