import { DEFAULT_CATALOG, seedTickets, seedVouchers, type CatalogItem, type Ticket, type Voucher } from './pages/tickets/data'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { initialCostCenters, members, registerMember, type Jumper, type Member } from './data'
import { F, FUNCTIONS, permissionsFor, seedGrants, type Assignment, type FunctionDef, type Grants, type Permission } from './permissions'
import { useLedger, type Ledger, type PaymentEvent } from './pages/finance/ledger'
import { payTicket, payVoucher } from './pages/tickets/payments'
import { docStateOf, seedMemberDocs, type MemberDoc, type MemberDocView } from './pages/members/memberDocs'
import { DEFAULT_MODULES, type ModulesConfig } from './modules'
import { DEFAULT_KINDS, rateFor, splitFor as splitOf, type OperationKind } from './kinds'
import { DEFAULT_AFP_CONFIG, type AfpConfig } from './pages/afp/config'
import { details as seedDetails, seedPaxLimits, type Detail, type PaxLimits } from './pages/aircraft/data'
import { DEFAULT_SETTINGS, seedBookings, seedDays, tandemJumper, type ManifestDay, type ManifestSettings, type TandemBooking } from './pages/manifest/data'
import { defaultClub, defaultLayout, designFrom, initialApplications, initialFees, initialForms, initialPatterns, membershipTypes, type Application, type Branding, type ClubData, type Fee, type Layout, type FeePattern, type FormTemplate, type MembershipType } from './pages/members/data'

// ---------- Who is signed in: functions give permissions (logic adopted from V1) ----------
export type Perm = Permission
export interface Persona { id: string; label: string; role: string; memberId: string; functions: string[]; perms: Set<string> }
export const TODAY_ISO = '2026-11-07'
/** Function assignments with validity, like `user_functions`. */
export const initialAssignments: Record<string, Assignment[]> = {
  m1: [{ fn: F.SPORT_JUMPER }],
  m2: [{ fn: F.SPORT_JUMPER }, { fn: F.SKYDIVE_PILOT }, { fn: F.PILOT }],
  m3: [{ fn: F.TANDEM_MASTER, until: '2027-06-30' }],
  m4: [{ fn: F.SPORT_JUMPER }, { fn: F.TANDEM_MASTER }],
  m5: [{ fn: F.PILOT }, { fn: F.FLIGHT_INSTRUCTOR }, { fn: F.TREASURER }],
  m6: [], m7: [{ fn: F.SPORT_JUMPER }], m8: [{ fn: F.MANIFEST_COORDINATOR }], m9: [],
}
/** People the prototype can be viewed as. */
export const viewAs = ['m5', 'm8', 'm2', 'm3', 'm1']

// ---------- Loads (shared by Manifest, AFP and Dashboard) ----------
export type LoadStatus = 'geplant' | 'boarding' | 'in_air' | 'gelandet'
export interface Load { id: number; dayId: string; time: string; status: LoadStatus; jumpers: Jumper[]; /** Member id of the pilot of this flight. */ pilotId?: string }
/** Number of a flight within its day (1, 2, 3 ...), ordered by time. The id is unique over all days and only used internally. */
export const flightNo = (loads: Load[], l: Load) => loads.filter((x) => x.dayId === l.dayId).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id).findIndex((x) => x.id === l.id) + 1
/** The price comes from the manifest settings (per club); the default is only for seed data. */
export const sportJumper = (m: Member, kg?: number, price = DEFAULT_SETTINGS.sportPrice): Jumper => ({ id: `s-${m.id}`, memberId: m.id, name: m.name, kind: 'sport', price, weight: kg })

/** Result of the pilot's AFP (Abbreviated Flight Plan), made at the aircraft. The manifest only sees this result. */
export interface AfpData { /** Reserve in minutes at the time of the release. */ reserveMin?: number; /** Flight time to the alternate in minutes at the time of the release. */ alternateMin?: number; pilotId: string; pilotKg: number; pax: { id: number; name: string; kg: number }[]; bag: number; fuelL: number; planned: number; kind: string; /** Fuel filled before the flight and what was done to the tank: they go into the Bordbuch entry when the flight is done. */ fuelSupply?: Supply; fuelAdjust?: FuelAdjust }
/** The four times of a flight, logged one after another (HH:MM). Block time and flight time are derived, never typed. */
export interface FlightTimes { off?: string; to?: string; ld?: string; on?: string }
/** The pilot's release: signature (image), time, the PDF that went to the pilot by mail. The pre-flight check was confirmed with it. */
export interface AfpRelease { signature: string; signedAt: string; pdf: string; mailedTo: string }
export interface AfpResult { key: string; pilot: string; fuelL: number; tow: number; arm: number; enduranceMin: number; status: 'Freigegeben' | 'Gelandet'; releasedAt: string; data?: AfpData; times?: FlightTimes; release?: AfpRelease }

// ---------- Reservations (a reserved aircraft is a flight to prepare) ----------
/** `from` and `to` are absolute hours since 00:00 of day 0 (07.11.2026), so a reservation can span several days. */
export interface Reservation { id: number; aircraft: string; from: number; to: number; who: string; memberId?: string; label: string; priority?: boolean; standby?: boolean }
const seedReservations: Reservation[] = [
  { id: 1, aircraft: 'OE-DZA', from: 9, to: 17, who: 'Sprungbetrieb', label: 'Sprungtag', priority: true },
  { id: 5, aircraft: 'OE-DZA', from: 33, to: 41, who: 'Sprungbetrieb', label: 'Sprungtag', priority: true },
  { id: 9, aircraft: 'OE-DZA', from: 177, to: 185, who: 'Sprungbetrieb', label: 'Sprungtag', priority: true },
  { id: 10, aircraft: 'OE-DZA', from: 369, to: 376, who: 'Sprungbetrieb', label: 'Sprungtag', priority: true },
  { id: 2, aircraft: 'OE-KFR', from: 10, to: 12, who: 'Bernd Huber', memberId: 'm2', label: 'Bernd Huber' },
  { id: 3, aircraft: 'OE-KFR', from: 14, to: 16.5, who: 'Eva Steiner', memberId: 'm5', label: 'Eva Steiner' },
  { id: 4, aircraft: 'OE-DZA', from: 17.5, to: 19, who: 'Bernd Huber', memberId: 'm2', label: 'Bernd Huber' },
  { id: 6, aircraft: 'OE-KFR', from: 34, to: 37, who: 'Eva Steiner', memberId: 'm5', label: 'Eva Steiner' },
  { id: 7, aircraft: 'OE-KFR', from: 56, to: 58, who: 'Bernd Huber', memberId: 'm2', label: 'Bernd Huber' },
  { id: 8, aircraft: 'OE-KFR', from: 81, to: 113, who: 'Eva Steiner', memberId: 'm5', label: 'Eva Steiner (Ausflug)' },
]

// ---------- Personal data: one record per member, edited in the member file (club) and under Einstellungen (the member) ----------
export interface Profile { first: string; last: string; email: string; phone: string; birth: string; street: string; no: string; zip: string; city: string; country: string; emName: string; emPhone: string; lang: 'de' | 'en' }
export const defaultProfile = (name: string): Profile => {
  const [first, ...rest] = name.split(' ')
  const last = rest.join(' ')
  return { first, last, email: `${name.toLowerCase().replace(' ', '.')}@example.at`, phone: '+43 660 1234567', birth: '14.04.1992', street: 'Hauptstraße', no: '4', zip: '1234', city: 'Beispiel', country: 'Österreich', emName: `Maria ${last}`, emPhone: '+43 660 7654321', lang: 'de' }
}

// ---------- History of a member: only what matters for the administration ----------
// Forms (applications), personal data changes and membership changes. Check-ins and bookings on the Betriebskonto are NOT part of it.
export const NOW_ISO = '2026-11-07 10:15'
export interface HistoryEvent { id: number; memberId: string; at: string; type: 'Stammdaten' | 'Mitgliedschaft'; text: string; details?: string[]; by: string
  /** The form this change came from. A membership change has either a form or an exception. */
  appId?: string
  /** Done without a form as the exception: from when and why. */
  exception?: { from: string; reason: string; /** The person was created (not only changed) without a form. */ created?: boolean } }
const seedHistory: HistoryEvent[] = [
  { id: 1, memberId: 'm5', at: '2026-03-03 18:20', type: 'Stammdaten', text: 'Stammdaten geändert', details: ['Telefon: +43 660 1111111 → +43 660 1234567'], by: 'Eva Steiner (selbst)' },
  { id: 2, memberId: 'm5', at: '2026-01-12 11:00', type: 'Mitgliedschaft', text: 'Mitgliedschaft: Kurzzeit → Ordentlich', appId: 'a5', by: 'Schriftführer' },
  { id: 3, memberId: 'm2', at: '2026-05-02 09:10', type: 'Stammdaten', text: 'Stammdaten geändert', details: ['Gewicht: 83 kg → 85 kg'], by: 'Bernd Huber (selbst)' },
]
const FIELD_LABEL: Record<string, string> = { first: 'Vorname', last: 'Nachname', email: 'E-Mail', phone: 'Telefon', birth: 'Geburtsdatum', street: 'Straße', no: 'Hausnummer', zip: 'PLZ', city: 'Stadt', country: 'Land', emName: 'Notfallkontakt Name', emPhone: 'Notfallkontakt Telefon', lang: 'Sprache' }

// ---------- Bordbuch ----------
/** A missing receipt is allowed, but only with a reason. Oil needs none (`entfaellt`): it is only tracked. */
export type Rcpt = { state: 'ja' } | { state: 'fehlt' } | { state: 'grund'; reason: string } | { state: 'entfaellt' }
export interface Supply { amount: number; receipt: Rcpt; /** The invoice kept in Finanzen (with its sum and price per liter). */ receiptId?: string; /** Fuel: filled before or after the flight. */ when?: 'vor' | 'nach' }
/** The tank changed in an exception of an entry: fuel taken out (de-fueling) or the content set by hand (`korrektur`, `liters` is the new content, with the reason). */
export interface FuelAdjust { kind: 'defuel' | 'korrektur'; liters: number; reason?: string }
/** `afp`: 'ja' = made through an AFP, 'alt' = before the AFP existed, anything else = the reason it was done without. */
export interface LogEntry { id: number; aircraft: string; times?: FlightTimes; blockMin?: number; afp?: string; date: string; pilot: string; kind: string; from: string; to: string; minutes: number; landings: number; fuel?: Supply; fuelAdjust?: FuelAdjust; oil?: Supply }

const seedEntries: LogEntry[] = [
  { id: 4, aircraft: 'OE-KFR', afp: 'alt', date: '03.11.2026', pilot: 'Anna Berger', kind: 'Charter', from: 'LOLW', to: 'LOLW', minutes: 95, landings: 2 },
  { id: 3, aircraft: 'OE-DZA', afp: 'alt', date: '31.10.2026', pilot: 'Bernd Huber', kind: 'Sprungbetrieb', from: 'LOLW', to: 'LOLW', minutes: 372, landings: 14, fuel: { amount: 85, receipt: { state: 'ja' } }, oil: { amount: 0.5, receipt: { state: 'entfaellt' } } },
  { id: 2, aircraft: 'OE-DZA', afp: 'alt', date: '24.10.2026', pilot: 'Eva Steiner', kind: 'Schulung', from: 'LOLW', to: 'LOLW', minutes: 65, landings: 6 },
  { id: 1, aircraft: 'OE-DZA', afp: 'alt', date: '17.10.2026', pilot: 'Bernd Huber', kind: 'Sprungbetrieb', from: 'LOLW', to: 'LOLW', minutes: 301, landings: 11, fuel: { amount: 62, receipt: { state: 'fehlt' } } },
]

/** Older entries, one per flight, so the list has enough rows to need paging (generated, not real data). */
const historicEntries: LogEntry[] = (() => {
  const pilots = ['Bernd Huber', 'Eva Steiner', 'Anna Berger', 'David Gruber']
  const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  const out: LogEntry[] = []
  for (let i = 0; i < 90; i++) {
    const day = Math.floor(i / 9), j = i % 9
    const d = new Date(2026, 9, 10 - day * 3)
    const kind = j === 7 ? 'Schulung' : j === 8 ? 'Charter' : 'Sprungbetrieb'
    const minutes = kind === 'Sprungbetrieb' ? 17 + (i % 8) : kind === 'Schulung' ? 55 : 90
    const off = 17 * 60 - j * 50
    const supply = (amount: number): Supply => ({ amount, receipt: i % 13 === 0 ? { state: 'fehlt' } : i % 9 === 0 ? { state: 'grund', reason: 'Vereinstankstelle, kein Beleg' } : { state: 'ja' } })
    out.push({
      id: 100 + i, aircraft: kind === 'Sprungbetrieb' ? 'OE-DZA' : 'OE-KFR', afp: 'alt', pilot: pilots[(i + day) % 4], kind, from: 'LOLW', to: 'LOLW', minutes, landings: kind === 'Sprungbetrieb' ? 1 : kind === 'Schulung' ? 5 : 2,
      date: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`,
      times: { off: hm(off), to: hm(off + 5), ld: hm(off + 5 + minutes), on: hm(off + 10 + minutes) }, blockMin: minutes + 10,
      fuel: j % 4 === 3 ? supply(40 + (i % 5) * 10) : undefined, oil: i % 17 === 0 ? { amount: 0.5, receipt: { state: 'entfaellt' } } : undefined,
    })
  }
  return out
})()

// ---------- Flights waiting for the treasurer ----------
/** Flights are never charged automatically. The treasurer confirms each one. */
export interface FlightCharge {
  id: string; logId?: number; date: string; aircraft: string; pilot: string; kind: string; minutes: number; amount: number
  split: { who: string; memberId?: string; percent: number }[]; state: 'offen' | 'verrechnet'
}
export const memberIdByName = (n: string) => members.find((m) => m.name === n)?.id
/** Seed data only: the booking and price of the first flights come from the default kinds. The live ones come from the club's kinds. */
const seedSplit = (kind: string, pilot: string) => splitOf(DEFAULT_KINDS, (id) => initialCostCenters.find((c) => c.id === id)?.name ?? id, memberIdByName, kind, pilot)
const SEED_RATE = 5.15

const seedFlights: FlightCharge[] = [
  { id: 'f1', logId: 3, date: '31.10.', aircraft: 'OE-DZA', pilot: 'Bernd Huber', kind: 'Sprungbetrieb', minutes: 372, amount: 372 * SEED_RATE, split: seedSplit('Sprungbetrieb', 'Bernd Huber'), state: 'offen' },
  { id: 'f4', logId: 4, date: '03.11.', aircraft: 'OE-KFR', pilot: 'Anna Berger', kind: 'Charter', minutes: 95, amount: 95 * SEED_RATE, split: [{ who: 'Betriebskonto Anna Berger', memberId: 'm1', percent: 60 }, { who: 'Betriebskonto David Gruber', memberId: 'm4', percent: 40 }], state: 'offen' },
  { id: 'f2', logId: 2, date: '24.10.', aircraft: 'OE-DZA', pilot: 'Eva Steiner', kind: 'Schulung', minutes: 65, amount: 65 * SEED_RATE, split: seedSplit('Schulung', 'Eva Steiner'), state: 'verrechnet' },
  { id: 'f3', logId: 1, date: '17.10.', aircraft: 'OE-DZA', pilot: 'Bernd Huber', kind: 'Sprungbetrieb', minutes: 301, amount: 301 * SEED_RATE, split: seedSplit('Sprungbetrieb', 'Bernd Huber'), state: 'verrechnet' },
]

interface App {
  persona: Persona; setPersonaId: (id: string) => void; can: (p?: Perm | Perm[]) => boolean
  grants: Grants; setGrants: (g: Grants) => void
  /** The functions of the club. Only pre-filled: each can be renamed or deleted, new ones can be added. */
  functions: FunctionDef[]; fnName: (code: string) => string
  /** Adds a function (optionally with the rights of another one) and returns its code. */
  addFunction: (f: Pick<FunctionDef, 'name' | 'group'>, copyRightsFrom?: string) => string
  updateFunction: (code: string, p: Partial<Pick<FunctionDef, 'name' | 'group'>>) => void
  /** Deletes a function and removes it from everybody who holds it. */
  deleteFunction: (code: string) => void
  assignments: Record<string, Assignment[]>; setAssignments: (a: Record<string, Assignment[]>) => void
  checkedIn: string[]; toggleCheckIn: (memberId: string, on?: boolean) => void
  weights: Record<string, number>; setWeight: (memberId: string, kg: number) => void
  entries: LogEntry[]; addEntry: (e: LogEntry) => void; patchEntry: (id: number, p: Partial<LogEntry>) => void
  flights: FlightCharge[]; chargeFlights: (ids: string[]) => void
  /** The treasurer corrects who pays (before the flight is charged). */
  patchFlight: (id: string, p: Partial<Pick<FlightCharge, 'split'>>) => void
  apps: Application[]; setApps: (a: Application[]) => void
  forms: FormTemplate[]; setForms: (f: FormTemplate[]) => void
  profileOf: (memberId: string) => Profile; setProfile: (memberId: string, p: Partial<Profile>) => void
  /** Saves personal data (and the weight) and writes what changed into the history of the member. */
  updateProfile: (memberId: string, next: Profile, kg?: number) => void
  history: HistoryEvent[]
  addHistory: (memberId: string, type: HistoryEvent['type'], text: string, opts?: Pick<HistoryEvent, 'details' | 'appId' | 'exception'>) => void
  /** Changes the membership and writes it into the history. `how` says why or through which form. */
  changeMembership: (memberId: string, typeId: string, opts?: Pick<HistoryEvent, 'details' | 'appId' | 'exception'> & { text?: string }) => void
  /** Creates a person WITHOUT a form (the exception): roster entry, profile, membership and a history entry with the reason. */
  addMember: (m: Member, typeId: string, profile: Partial<Profile>, exception: { from: string; reason: string }) => void
  fees: Fee[]; setFees: (f: Fee[]) => void
  /** The club data: one place, used by all forms, PDFs and invoices. */
  club: ClubData; setClub: (c: ClubData) => void
  /** Standard layout of documents (template for new forms and versions). */
  layout: Layout; setLayout: (l: Layout) => void
  /** Standard design = club data + standard layout. */
  branding: Branding
  loads: Load[]; setLoads: (fn: (l: Load[]) => Load[]) => void
  /** Manifest days and the tandem guests booked for them. */
  /** Manifest settings of the club: sport jump price, usual gap between flights, operating hours, duties of a day. */
  settings: ManifestSettings; setSettings: (s: ManifestSettings) => void
  days: ManifestDay[]; setDays: (fn: (d: ManifestDay[]) => ManifestDay[]) => void
  bookings: TandemBooking[]; setBookings: (fn: (b: TandemBooking[]) => TandemBooking[]) => void
  /** Voucher and ticket kinds with their versioned prices, and what was sold. */
  catalog: CatalogItem[]; setCatalog: (c: CatalogItem[]) => void
  vouchers: Voucher[]; setVouchers: (fn: (v: Voucher[]) => Voucher[]) => void
  tickets: Ticket[]; setTickets: (fn: (t: Ticket[]) => Ticket[]) => void
  /** Documents of the members (licence, medical ...) with their state of today; a newer one can be presented and checked. */
  docsOf: (memberId: string) => MemberDocView[]
  setMemberDocs: (memberId: string, fn: (docs: MemberDoc[]) => MemberDoc[]) => void
  afps: Record<string, AfpResult>; setAfp: (r: AfpResult) => void
  /** Operation kinds of the club with price and booking, and what a flight of a kind is booked to. */
  kinds: OperationKind[]; setKinds: (k: OperationKind[]) => void
  splitFor: (kind: string, pilot: string) => FlightCharge['split']; rateOf: (kind: string, reg: string) => number
  /** Club wide switches of the AFP (on or off, evidence, mail, reserve). */
  afpConfig: AfpConfig; setAfpConfig: (c: AfpConfig) => void
  /** Which operations the club runs (Skydive, Charterbetrieb); at least one is on. */
  modules: ModulesConfig; setModules: (m: ModulesConfig) => void
  /** Weight thresholds of the jump aircraft (by aircraft id), set in the aircraft details. */
  /** Per aircraft: master data, mass and balance, maintenance, components, documents. */
  aircraftData: Record<string, Detail>; setAircraftData: (id: string, fn: (d: Detail) => Detail) => void
  /** Club-wide: keep older versions of aircraft documents. */
  docVersioning: boolean; setDocVersioning: (on: boolean) => void
  paxLimits: Record<string, PaxLimits>; setPaxLimits: (aircraftId: string, l: PaxLimits) => void
  reservations: Reservation[]; setReservations: (r: Reservation[]) => void
  /** Fuel left after the last flight per aircraft: the next flight starts with it. */
  restFuel: Record<string, number>; setRestFuel: (reg: string, litres: number) => void
  /** Membership types and their fee patterns (editable under Mitglieder > Mitgliedschaft einrichten). */
  types: MembershipType[]; setTypes: (t: MembershipType[]) => void
  patterns: FeePattern[]; setPatterns: (p: FeePattern[]) => void
  /** The membership type a member currently holds, and a direct (protocolled) change of it. */
  typeOf: (memberId: string) => MembershipType
  setMemberType: (memberId: string, typeId: string) => void
  typeAccount: Record<string, boolean>; setTypeAccount: (typeId: string, on: boolean) => void
  /** A Betriebskonto exists only for members whose membership type asks for one. */
  hasAccount: (memberId: string) => boolean
  /** The new membership has no Betriebskonto, but the member still has a balance: the account stays until it is settled. */
  windDown: (memberId: string) => boolean
  /** Current function names and permissions of any member (derived from assignments and live grants). */
  functionNames: (memberId: string) => string[]
  hasFunction: (memberId: string, fn: string) => boolean
  memberCan: (memberId: string, perm: Perm) => boolean
  ledger: Ledger
}
const Ctx = createContext<App | null>(null)
export const useApp = () => { const c = useContext(Ctx); if (!c) throw new Error('AppProvider missing'); return c }

export function AppProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState<string>('m5')
  const [grants, setGrants] = useState<Grants>(seedGrants)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [functions, setFunctions] = useState<FunctionDef[]>(FUNCTIONS)
  const fnName = (code: string) => functions.find((f) => f.code === code)?.name ?? code
  const [checkedIn, setCheckedIn] = useState<string[]>(['m1', 'm2', 'm4', 'm7'])
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(members.filter((m) => m.weight).map((m) => [m.id, m.weight!])))
  const [entries, setEntries] = useState<LogEntry[]>([...seedEntries, ...historicEntries])
  const [flights, setFlights] = useState<FlightCharge[]>(seedFlights)
  const [apps, setApps] = useState<Application[]>(initialApplications)
  const [forms, setForms] = useState<FormTemplate[]>(initialForms)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [history, setHistory] = useState<HistoryEvent[]>(seedHistory)
  const [fees, setFees] = useState<Fee[]>(initialFees)
  const [club, setClub] = useState<ClubData>(defaultClub)
  const [layout, setLayout] = useState<Layout>(defaultLayout)
  const branding = useMemo(() => designFrom(club, layout), [club, layout])
  const [loads, setLoads] = useState<Load[]>(() => {
    const w = (id: string) => members.find((m) => m.id === id)!
    return [
      { id: 1, dayId: 'd-2026-11-07', time: '09:40', status: 'gelandet', pilotId: 'm2', jumpers: [sportJumper(w('m1'), w('m1').weight), sportJumper(w('m2'), w('m2').weight)] },
      { id: 2, dayId: 'd-2026-11-07', time: '10:25', status: 'geplant', pilotId: 'm2', jumpers: [] },
      { id: 3, dayId: 'd-2026-11-07', time: '11:10', status: 'geplant', pilotId: 'm2', jumpers: [] },
      { id: 4, dayId: 'd-2026-11-14', time: '10:30', status: 'geplant', jumpers: [tandemJumper(seedBookings.find((b) => b.id === 'bk5')!)] },
      { id: 5, dayId: 'd-2026-11-14', time: '11:15', status: 'geplant', jumpers: [] },
    ]
  })
  const [settings, setSettings] = useState<ManifestSettings>(DEFAULT_SETTINGS)
  const [days, setDays] = useState<ManifestDay[]>(seedDays)
  const [bookings, setBookings] = useState<TandemBooking[]>(seedBookings)
  const [catalog, setCatalog] = useState<CatalogItem[]>(DEFAULT_CATALOG)
  const [vouchers, setVouchers] = useState<Voucher[]>(seedVouchers)
  const [tickets, setTickets] = useState<Ticket[]>(seedTickets)
  const [memberDocs, setMemberDocsState] = useState<Record<string, MemberDoc[]>>(seedMemberDocs)
  const [afps, setAfps] = useState<Record<string, AfpResult>>({})
  const [kinds, setKinds] = useState<OperationKind[]>(DEFAULT_KINDS)
  const [afpConfig, setAfpConfig] = useState<AfpConfig>(DEFAULT_AFP_CONFIG)
  const [modules, setModules] = useState<ModulesConfig>(DEFAULT_MODULES)
  const [aircraftData, setAircraftDataState] = useState<Record<string, Detail>>(seedDetails)
  const [docVersioning, setDocVersioning] = useState(true)
  const [paxLimits, setPaxLimitsState] = useState<Record<string, PaxLimits>>(seedPaxLimits)
  const [reservations, setReservations] = useState<Reservation[]>(seedReservations)
  const [restFuel, setRestFuelState] = useState<Record<string, number>>({ 'OE-DZA': 90, 'OE-KFR': 60, 'OE-AXB': 55 })
  const [types, setTypes] = useState<MembershipType[]>(membershipTypes)
  const [patterns, setPatterns] = useState<FeePattern[]>(initialPatterns)
  const [memberTypes, setMemberTypes] = useState<Record<string, string>>(() => Object.fromEntries(members.map((m) => [m.id, m.type])))
  const typeAccount = Object.fromEntries(types.map((t) => [t.id, t.account]))
  const typeOf = (id: string) => types.find((t) => t.id === memberTypes[id]) ?? types[0]
  /** A payment or refund in Finanzen (bank line assigned, cash posted) reaches the voucher or ticket it belongs to. */
  const onPayment = (e: PaymentEvent) => {
    setVouchers((all) => all.map((v) => (v.code === e.code ? payVoucher(v, e, TODAY_ISO) : v)))
    setTickets((all) => all.map((t) => (t.code === e.code ? payTicket(t, e, TODAY_ISO) : t)))
  }
  const ledger = useLedger(onPayment)
  const me = members.find((m) => m.id === personaId)!
  const myAssignments = (assignments[personaId] ?? []).filter((x) => !x.until || x.until >= TODAY_ISO)
  const persona: Persona = {
    id: personaId, memberId: personaId, functions: myAssignments.map((x) => x.fn),
    role: myAssignments.map((x) => fnName(x.fn)).join(', ') || 'Mitglied',
    label: `${me.name} (${myAssignments.map((x) => fnName(x.fn)).join(', ') || 'Mitglied'})`,
    perms: permissionsFor(assignments[personaId] ?? [], grants, TODAY_ISO),
  }

  return (
    <Ctx.Provider value={{
      persona, setPersonaId, grants, setGrants, assignments, setAssignments, functions, fnName,
      addFunction: (f, copyFrom) => {
        const code = `fn-${Date.now()}`
        setFunctions((all) => [...all, { code, ...f }])
        setGrants({ ...grants, [code]: [...(copyFrom ? grants[copyFrom] ?? [] : [])] })
        return code
      },
      updateFunction: (code, p) => setFunctions((all) => all.map((f) => (f.code === code ? { ...f, ...p } : f))),
      deleteFunction: (code) => {
        setFunctions((all) => all.filter((f) => f.code !== code))
        setGrants(Object.fromEntries(Object.entries(grants).filter(([k]) => k !== code)))
        setAssignments(Object.fromEntries(Object.entries(assignments).map(([id, list]) => [id, list.filter((a) => a.fn !== code)])))
      },
      can: (p) => !p || (Array.isArray(p) ? p.some((x) => persona.perms.has(x)) : persona.perms.has(p)),
      checkedIn, toggleCheckIn: (id, on) => setCheckedIn((c) => ((on ?? !c.includes(id)) ? (c.includes(id) ? c : [...c, id]) : c.filter((x) => x !== id))),
      weights, setWeight: (id, kg) => setWeights((w) => ({ ...w, [id]: kg })),
      entries,
      addEntry: (e) => {
        setEntries((es) => [e, ...es])
        setFlights((fs) => [{ id: `f-${e.id}`, logId: e.id, date: e.date.slice(0, 6), aircraft: e.aircraft, pilot: e.pilot, kind: e.kind, minutes: e.minutes, amount: e.minutes * rateFor(kinds, e.kind, e.aircraft), split: splitOf(kinds, (id) => ledger.costCenters.find((c) => c.id === id)?.name ?? id, memberIdByName, e.kind, e.pilot), state: 'offen' }, ...fs])
      },
      patchEntry: (id, p) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e))),
      flights,
      patchFlight: (id, p) => setFlights((fs) => fs.map((f) => (f.id === id && f.state === 'offen' ? { ...f, ...p } : f))),
      chargeFlights: (ids) => {
        for (const f of flights.filter((x) => ids.includes(x.id) && x.state === 'offen'))
          for (const s of f.split) if (s.memberId) ledger.charge(s.memberId, (f.amount * s.percent) / 100, `Flug ${f.date} ${f.aircraft}, ${f.minutes} min (${s.percent} %)`)
        setFlights((fs) => fs.map((f) => (ids.includes(f.id) ? { ...f, state: 'verrechnet' } : f)))
      },
      apps, setApps, forms, setForms, fees, setFees, club, setClub, layout, setLayout, branding,
      profileOf: (id) => profiles[id] ?? defaultProfile(members.find((m) => m.id === id)?.name ?? ''),
      history,
      addHistory: (id, type, text, opts) => setHistory((h) => [{ id: Date.now() + Math.random(), memberId: id, at: NOW_ISO, type, text, ...opts, by: me.name }, ...h]),
      updateProfile: (id, next, kg) => {
        const old = profiles[id] ?? defaultProfile(members.find((m) => m.id === id)?.name ?? '')
        const details = (Object.keys(FIELD_LABEL) as (keyof Profile)[]).filter((k) => old[k] !== next[k]).map((k) => `${FIELD_LABEL[k]}: ${old[k] || '–'} → ${next[k] || '–'}`)
        if (kg && kg !== weights[id]) details.push(`Gewicht: ${weights[id] ? `${weights[id]} kg` : '–'} → ${kg} kg`)
        if (kg) setWeights((w) => ({ ...w, [id]: kg }))
        setProfiles((all) => ({ ...all, [id]: next }))
        if (details.length) setHistory((h) => [{ id: Date.now(), memberId: id, at: NOW_ISO, type: 'Stammdaten', text: 'Stammdaten geändert', details, by: `${me.name}${personaId === id ? ' (selbst)' : ''}` }, ...h])
      },
      changeMembership: (id, typeId, opts) => {
        const from = typeOf(id).name, to = types.find((t) => t.id === typeId)?.name ?? ''
        setMemberTypes((t) => ({ ...t, [id]: typeId }))
        const { text, ...rest } = opts ?? {}
        setHistory((h) => [{ id: Date.now() + Math.random(), memberId: id, at: NOW_ISO, type: 'Mitgliedschaft', text: text ?? `Mitgliedschaft: ${from} → ${to}`, ...rest, by: me.name }, ...h])
      },
      addMember: (m, typeId, profile, exception) => {
        registerMember(m)
        setMemberTypes((t) => ({ ...t, [m.id]: typeId }))
        setProfiles((all) => ({ ...all, [m.id]: { ...defaultProfile(m.name), ...profile } }))
        const t = types.find((x) => x.id === typeId)?.name ?? ''
        setHistory((h) => [{ id: Date.now() + Math.random(), memberId: m.id, at: NOW_ISO, type: 'Mitgliedschaft', text: `Ohne Formular angelegt: ${t}`, details: profile.email ? [`E-Mail: ${profile.email}`] : undefined, exception: { ...exception, created: true }, by: me.name }, ...h])
      },
      setProfile: (id, p) => setProfiles((all) => ({ ...all, [id]: { ...(all[id] ?? defaultProfile(members.find((m) => m.id === id)?.name ?? '')), ...p } })), ledger,
      loads, setLoads: (fn) => setLoads(fn), settings, setSettings, days, setDays: (fn) => setDays(fn), bookings, setBookings: (fn) => setBookings(fn), catalog, setCatalog, vouchers, setVouchers: (fn) => setVouchers(fn), tickets, setTickets: (fn) => setTickets(fn),
      docsOf: (id) => (memberDocs[id] ?? []).map((d) => ({ ...d, state: docStateOf(d.expires, TODAY_ISO) })),
      setMemberDocs: (id, fn) => setMemberDocsState((all) => ({ ...all, [id]: fn(all[id] ?? []) })),
      afps, setAfp: (r) => setAfps((a) => ({ ...a, [r.key]: r })),
      afpConfig, setAfpConfig, modules, setModules, kinds, setKinds, rateOf: (k, reg) => rateFor(kinds, k, reg),
      splitFor: (k, pilot) => splitOf(kinds, (id) => ledger.costCenters.find((c) => c.id === id)?.name ?? id, memberIdByName, k, pilot),
      aircraftData, setAircraftData: (id, fn) => setAircraftDataState((all) => ({ ...all, [id]: fn(all[id]) })), docVersioning, setDocVersioning,
      paxLimits, setPaxLimits: (id, l) => setPaxLimitsState((all) => ({ ...all, [id]: l })),
      reservations, setReservations,
      restFuel, setRestFuel: (reg, l) => setRestFuelState((r) => ({ ...r, [reg]: l })),
      types, setTypes, patterns, setPatterns, typeOf,
      setMemberType: (id, typeId) => setMemberTypes((t) => ({ ...t, [id]: typeId })),
      typeAccount, setTypeAccount: (id, on) => setTypes((ts) => ts.map((t) => (t.id === id ? { ...t, account: on } : t))),
      functionNames: (id) => (assignments[id] ?? []).filter((a) => !a.until || a.until >= TODAY_ISO).map((a) => fnName(a.fn)),
      hasFunction: (id, fn) => (assignments[id] ?? []).some((a) => a.fn === fn && (!a.until || a.until >= TODAY_ISO)),
      memberCan: (id, p) => permissionsFor(assignments[id] ?? [], grants, TODAY_ISO).has(p),
      // The account belongs to the member, not to the membership: it exists while the type has one or a balance is left.
      hasAccount: (id) => typeOf(id).account || (ledger.balances[id] ?? 0) !== 0,
      windDown: (id) => !typeOf(id).account && (ledger.balances[id] ?? 0) !== 0,
    }}>{children}</Ctx.Provider>
  )
}
