import clsx from 'clsx'
import { ArrowLeft, ArrowRight, CalendarClock, Check, ChevronDown, ChevronLeft, CircleCheck, Lock, Mail, Plane, Printer, Ticket, UserX, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import MemberPicker from '../MemberPicker'
import { CASH_ID, eur, members, type Jumper } from '../data'
import { useSession } from '../session/session'
import { flightNo, sportJumper, TODAY_ISO, useApp, type Load } from '../state'
import { Card, useConfirm } from '../ui'
import { CashCountDialog } from './finance/CashCount'
import { DayCheckBadge, DayReportDrawer } from './finance/DayReport'
import { daySummary, HOW_WORDS, jumpsLabel, notFlownSentence, type DayCashLine, type DayHow, type DayReport, type DayReportLine, type NotFlownLine } from './finance/cashDocs'
import { byTime, capacityOf, dayName, dmy, fullName, sportPriceOn, weekday, windowLabel, type ManifestDay, type TandemBooking } from './manifest/data'
import { useDayCheck } from './manifest/dayCheck'
import { GuestPayDrawer } from './manifest/GuestPayment'
import { guestPay, type GuestPay } from './manifest/payState'
import { extrasDiff, payLabel, payWords, SettleSheet, useSettle } from './manifest/Settle'
import { LoadEditLink } from './manifest/LoadEdit'
import { BookingsPreview, MailList, type DayMail, type PreviewAccount, type PreviewEntry } from './manifest/closingPreview'
import { POSTPONE_REASONS, type PostponeReason } from './manifest/postpone'
import { settledPrice, type Settlement } from './manifest/settleStore'
import { slots } from './manifest/slots'
import { notFlownLog } from './tickets/data'
import { payTarget } from './tickets/payments'
import { newLog, useActor } from './tickets/parts'
import QuickTicket from './tickets/QuickTicket'

/**
 * Closing an operation day, done by the person at the manifest (a member, usually on a tablet). [Entwurf] A short guided flow:
 *   1. Flüge und Springer: every flight is down and has a pilot; who jumped on which flight (corrections possible); every tandem guest who
 *      did not fly gets one decision: "Verschieben" (ticket or voucher stays valid) or "Nicht erschienen" (it expires).
 *   2. Abrechnen: sport jumpers are mostly settled already at check-out ("Abrechnen und auschecken", own Kassa booking with Quittung); here
 *      the settled ones can be corrected (difference booking with reason) and the open ones are settled the same way. Tandem guests follow
 *      their ticket or voucher. The Kassa bookings of the day are listed.
 *   3. Übersicht: what will happen, in plain words; the mails that go out (each can be switched off and previewed) and every new booking per
 *      account, all "vorläufig" until Kassier or Obmann lock the day. One button closes the day; only then the guest decisions are applied.
 *   4. Fertig: the Tagesabschluss (print, PDF), "Kassa zählen". The day is then "Abgeschlossen, Prüfung offen" (see `manifest/dayCheck.ts`).
 */

type Step = 'pruefen' | 'bezahlung' | 'uebersicht'
const STEPS: { id: Step | 'fertig'; label: string }[] = [
  { id: 'pruefen', label: 'Flüge und Springer' },
  { id: 'bezahlung', label: 'Abrechnen' },
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'fertig', label: 'Fertig' },
]
type GuestChoice = 'bar' | 'offen'
type Outcome = 'verschoben' | 'nicht_erschienen'
/** [Entwurf] The decision for one tandem guest who did not fly. `slot`: "dayId|windowId" of the new date; none: Termin offen. */
interface Decision { outcome: Outcome; reason?: PostponeReason; note?: string; slot?: string; kulanz?: string; kulanzOk?: boolean; bulk?: boolean }

const now = () => new Date().toTimeString().slice(0, 5)

export default function Closing({ day, flights, jumped, onBack, onBooked }: { day: ManifestDay; /** Flights flown that day. */ flights: number; jumped: Jumper[]; onBack: () => void; onBooked: () => void }) {
  const { ledger, bookings, setBookings, vouchers, setVouchers, tickets, setTickets, loads, setLoads, memberCan, checkedIn, days, weights, settings } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const settle = useSettle(day)
  const [step, setStep] = useState<Step>('pruefen')
  const [guestChoice, setGuestChoice] = useState<Record<string, GuestChoice>>({})
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [done, setDone] = useState<DayReport | null>(null)
  const [dialog, setDialog] = useState<null | 'beleg' | 'zaehlen'>(null)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [ticketFor, setTicketFor] = useState<string | null>(null)
  // [Entwurf] Flights in step 1 are collapsed; an open one lists everyone on board and is where sport jumpers are corrected.
  const [openLoads, setOpenLoads] = useState<number[]>([])
  const [bulkNote, setBulkNote] = useState('')
  const [settleFor, setSettleFor] = useState<{ id: string; extrasOnly?: boolean } | null>(null)
  const confirm = useConfirm()
  const [fixFor, setFixFor] = useState<Settlement | null>(null)
  const [sent, setSent] = useState({ minus: 0, guests: 0 })
  const dayCheck = useDayCheck()

  // ---------- Flights of the day ----------
  const dayLoads = loads.filter((l) => l.dayId === day.id).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id)
  const landed = dayLoads.filter((l) => l.status === 'gelandet')
  const notLanded = dayLoads.filter((l) => l.status !== 'gelandet')
  const noPilot = landed.filter((l) => !l.pilotId)
  const patchLoad = (id: number, p: Partial<Load>) => setLoads((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)))
  const dropLoad = (id: number) => setLoads((ls) => ls.filter((l) => l.id !== id))
  const flightsOf = (id: string) => { const n = landed.filter((l) => l.jumpers.some((x) => x.id === id)).map((l) => flightNo(loads, l)); return n.length ? `Flug ${n.join(', ')}` : undefined }

  // ---------- Sport jumpers: who jumped on which flight ----------
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? id
  const sportIds = [...new Set(landed.flatMap((l) => l.jumpers.filter((j) => j.kind === 'sport' && j.memberId).map((j) => j.memberId!)))].sort((a, b) => memberName(a).localeCompare(memberName(b)))
  const cap = capacityOf(day.aircraft)
  const firstName = (n: string) => n.split(' ')[0]
  /** Everyone on board by name: a tandem is the guest and the master. */
  const peopleOf = (l: Load) => l.jumpers.filter((j) => !j.noShow).flatMap((j) => {
    if (j.kind === 'sport') return [firstName(j.name)]
    const b = bookings.find((x) => x.id === j.bookingId), master = members.find((m) => m.id === b?.masterId)?.name
    return [b ? b.first : j.name.replace(/^Tandem: /, ''), ...(master ? [firstName(master)] : [])]
  })
  const removeFrom = (l: Load, j: Jumper) => confirm.ask({
    title: `${j.name} von Flug ${flightNo(loads, l)} nehmen?`, confirm: 'Ja, nicht dabei', danger: true,
    lines: [`${j.name} war nicht auf Flug ${flightNo(loads, l)}. Dieser Sprung wird nicht verrechnet.`],
    run: () => patchLoad(l.id, { jumpers: l.jumpers.filter((x) => x.id !== j.id) }),
  })
  const strike = (l: Load) => confirm.ask({
    title: `Flug ${flightNo(loads, l)} streichen?`, confirm: 'Ja, streichen', danger: true,
    lines: [`Flug ${flightNo(loads, l)} · ${l.time}${l.jumpers.length ? ` · ${l.jumpers.length} an Bord, niemand wird verrechnet` : ' · leer'}`],
    run: () => dropLoad(l.id),
  })
  const addTo = (l: Load, memberId: string) => {
    const m = members.find((x) => x.id === memberId)
    if (!m || l.jumpers.some((j) => j.memberId === memberId)) return
    patchLoad(l.id, { jumpers: [...l.jumpers, sportJumper(m, weights[memberId], sportPriceOn(settings, day.date))] })
  }
  const toggleLoad = (id: number) => setOpenLoads((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
  const onSomeFlight = new Set(dayLoads.flatMap((l) => l.jumpers.map((j) => j.memberId).filter(Boolean)))
  const idle = day.status === 'aktiv' ? checkedIn.filter((id) => !onSomeFlight.has(id)).map(memberName).sort() : []
  const coveredLoads = (id: string) => new Set(settle.done.filter((s) => s.memberId === id).flatMap((s) => s.loadIds))

  // ---------- Tandem guests who did not fly ----------
  const flewIds = new Set(landed.flatMap((l) => l.jumpers.filter((j) => !j.noShow && j.bookingId).map((j) => j.bookingId!)))
  const openIds = new Set(notLanded.flatMap((l) => l.jumpers.filter((j) => j.bookingId).map((j) => j.bookingId!)))
  const missed = bookings.filter((b) => b.dayId === day.id && b.state === 'gebucht' && !flewIds.has(b.id) && !openIds.has(b.id))
  const decisionOf = (b: TandemBooking): Decision => decisions[b.id] ?? (b.checkin ? { outcome: 'verschoben' } : { outcome: 'nicht_erschienen' })
  const decide = (b: TandemBooking, p: Partial<Decision>) => setDecisions((d) => ({ ...d, [b.id]: { ...(d[b.id] ?? decisionOf(b)), ...p } }))
  const isDecided = (b: TandemBooking) => {
    const d = decisionOf(b)
    if (d.outcome === 'nicht_erschienen') return true
    if (!d.reason || (d.reason === 'Sonstiges' && !d.note?.trim())) return false
    return !!b.checkin || !!d.bulk || !!d.kulanzOk
  }
  const undecided = missed.filter((b) => !isDecided(b))
  const itemOf = (b: TandemBooking) => guestPay(b, vouchers, tickets)
  const allBulk = (r: PostponeReason) => missed.length > 0 && missed.every((b) => { const d = decisionOf(b); return d.bulk && d.outcome === 'verschoben' && d.reason === r })
  const bulk = (r: PostponeReason, note = bulkNote) => setDecisions((all) => Object.fromEntries(missed.map((b) => [b.id, { ...(all[b.id] ?? {}), outcome: 'verschoben' as const, reason: r, note: r === 'Sonstiges' ? note || all[b.id]?.note : undefined, bulk: true, kulanz: undefined, kulanzOk: undefined }])))
  /** Free places of a window on another day, minus the guests already moved there in this closing. */
  const taken = (dayId: string, windowId: string, except: string) =>
    bookings.filter((b) => b.dayId === dayId && b.windowId === windowId && b.state === 'gebucht' && b.id !== except).length
    + missed.filter((b) => b.id !== except && decisionOf(b).outcome === 'verschoben' && decisionOf(b).slot === `${dayId}|${windowId}`).length
  const slotsFor = (b: TandemBooking) => {
    const g = itemOf(b), max = g.what === 'Gutschein' ? (g.item as { validUntil?: string } | undefined)?.validUntil : undefined
    return days.filter((d) => d.status === 'geplant' && d.date > day.date && (!max || d.date <= max)).sort((a, c) => a.date.localeCompare(c.date))
      .flatMap((d) => byTime(d.windows).filter((w) => w.open).map((w) => ({ key: `${d.id}|${w.id}`, label: `${dayName(d.date).slice(0, 9)} · ${windowLabel(w)}`, free: w.capacity - taken(d.id, w.id, b.id) })))
      .filter((s) => s.free > 0 || decisionOf(b).slot === s.key).slice(0, 6)
  }
  const slotLabel = (key?: string) => {
    if (!key) return undefined
    const [dId, wId] = key.split('|'), d = days.find((x) => x.id === dId), w = d?.windows.find((x) => x.id === wId)
    return d && w ? `${dayName(d.date)} · ${windowLabel(w)}` : undefined
  }
  const notFlown: NotFlownLine[] = missed.map((b) => {
    const d = decisionOf(b), g = itemOf(b)
    return { who: fullName(b), what: g.what, code: g.code, outcome: d.outcome, reason: d.outcome === 'verschoben' ? (d.reason === 'Sonstiges' ? d.note?.trim() || 'Sonstiges' : d.reason) : undefined, kulanz: d.outcome === 'verschoben' && !b.checkin && !d.bulk ? d.kulanz?.trim() : undefined, newDate: d.outcome === 'verschoben' ? slotLabel(d.slot) : undefined, paid: g.item?.paid }
  })

  const openIssues = notLanded.length + noPilot.length + undecided.length

  // ---------- Who pays how ----------
  const isGuest = (j: Jumper) => j.kind === 'tandem'
  const bookingOf = (j: Jumper) => (isGuest(j) ? bookings.find((x) => x.id === j.bookingId) : undefined)
  const guestOf = (j: Jumper): GuestPay | undefined => { const b = bookingOf(j); return b ? guestPay(b, vouchers, tickets) : undefined }
  const guestState = (j: Jumper) => guestOf(j)?.state ?? (j.note ? 'bezahlt' : 'vor_ort')
  const nameOf = (j: Jumper) => { const b = bookingOf(j); return b ? fullName(b) : j.name.replace(/^Tandem: /, '') }
  const choiceOf = (j: Jumper): GuestChoice => guestChoice[j.id] ?? (guestState(j) === 'vor_ort' ? 'bar' : 'offen')
  /** A guest who pays on site but has no ticket yet. */
  const noTicket = (j: Jumper) => isGuest(j) && !!bookingOf(j) && !guestOf(j)?.item && guestState(j) === 'vor_ort'
  const priceOf = (j: Jumper) => guestOf(j)?.item?.price ?? j.price
  const guestHow = (j: Jumper): DayHow => {
    if (guestState(j) === 'bezahlt') { const g = guestOf(j); return g?.what === 'Gutschein' ? 'voucher' : g?.what === 'Ticket' ? 'ticket' : 'online' }
    return choiceOf(j) === 'bar' ? 'gast' : 'offen'
  }
  const guestRows = jumped.filter(isGuest)
  const guestLines: DayReportLine[] = guestRows.map((j) => {
    const how = guestHow(j), g = guestOf(j)
    return { who: nameOf(j), what: 'Tandem', price: priceOf(j), how, cash: how === 'gast' ? priceOf(j) : 0, code: g?.code, ownLine: how === 'gast' && !!g?.item, flight: flightsOf(j.id) }
  })
  // Members: one line per settlement of the day, booked when it was settled.
  const settledRows = settle.done.filter((s) => s.loadIds.length > 0 || s.extras.length > 0)
  /** [Entwurf] "+ Packen · bar 50,00 € → bar 70,00 € · Grund" for every correction of a settlement. */
  const fixText = (s: Settlement) => s.fixes.length === 0 ? undefined : s.fixes.map((f, i) => {
    const to = s.fixes[i + 1]?.fromExtras ?? s.extras
    const extras = extrasDiff(f.fromExtras ?? to, to).map((d) => `${d.amount > 0 ? '+' : '−'} ${d.name}`)
    return [...extras, f.fromCash !== f.toCash ? `${f.fromCash > 0 ? `bar ${eur(f.fromCash)}` : 'vom Konto'} → ${f.toCash > 0 ? `bar ${eur(f.toCash)}` : 'vom Konto'}` : '', f.reason].filter(Boolean).join(' · ')
  }).join('; ')
  const memberLines: DayReportLine[] = settledRows.map((s) => ({ who: s.name, memberId: s.memberId, what: jumpsLabel(s.jumps, s.paidSeats) || (s.extras.length ? 'Zusatzkosten' : 'Sprung'), price: settledPrice(s), how: s.how, cash: s.cash, before: s.before, jumps: s.jumps, paidSeats: s.paidSeats, flight: s.flight, time: s.time, doc: s.doc, extras: s.extras.length ? s.extras : undefined, fix: fixText(s) }))
  const whatOf = (s: Settlement) => [s.loadIds.length > 0 ? jumpsLabel(s.jumps, s.paidSeats) : '', ...s.extras.map((x) => x.name)].filter(Boolean).join(' + ')
  const lines = [...memberLines, ...guestLines]
  const jumpCount = landed.reduce((n, l) => n + l.jumpers.filter((j) => !j.noShow).length, 0)
  const withoutTicket = guestRows.filter(noTicket).length

  // ---------- The Kassa of the day: every cash booking, as it happened ----------
  const fixOf = (lineId: string) => settle.done.flatMap((s) => s.fixes).find((f) => f.cashLineId === lineId)
  const timeOf = (lineId: string) => settle.done.find((s) => s.cashLineId === lineId)?.time ?? settle.deposits.find((d) => d.cashLineId === lineId)?.time ?? fixOf(lineId)?.time
  const docOf = (lineId: string) => settle.done.find((s) => s.cashLineId === lineId)?.doc ?? settle.deposits.find((d) => d.cashLineId === lineId)?.doc ?? fixOf(lineId)?.doc
  const kassaToday: DayCashLine[] = ledger.lines.filter((l) => l.accountId === CASH_ID && l.date === day.date).reverse().map((l) => ({ time: timeOf(l.id), who: l.text, amount: l.amount, lineId: l.id, doc: docOf(l.id) }))
  const kassaSum = Math.round(kassaToday.reduce((n, l) => n + l.amount, 0) * 100) / 100
  const guestCashNow = guestLines.reduce((n, l) => n + l.cash, 0)
  const kassaEnd = Math.round((kassaSum + guestCashNow) * 100) / 100
  const sum = daySummary({ lines, cashBefore: ledger.cash - kassaSum })

  const paidBy = new Set(memberLines.map((l) => l.memberId)).size

  // ---------- [Entwurf] Last step: the mails that go out and the new bookings of the day ----------
  const chargedIds = [...new Set(settle.done.filter((s) => s.loadIds.length > 0 || s.extras.length > 0).map((s) => s.memberId))]
  /** Charged today and in minus now (lower than before the first settlement): mail "Konto im Minus". */
  const minusNow = chargedIds.map((id) => ({ id, balance: settle.balance(id), before: settle.done.find((s) => s.memberId === id)!.before })).filter((m) => m.balance < 0 && m.balance < m.before)
  const dayMails: DayMail[] = [
    ...missed.map((b, i): DayMail => {
      const l = notFlown[i]
      return { key: `g-${b.id}`, mailId: l.outcome === 'verschoben' ? 'tandem_postponed' : 'booking_cancelled_contact', who: l.who, to: b.email ?? 'Käufer (keine Adresse)',
        vars: { Vorname: b.first, Name: fullName(b), Code: [l.what, l.code].filter(Boolean).join(' '), AlterTermin: dmy(day.date), Datum: l.newDate ?? 'noch offen', Link: '[Link zur Terminwahl]' } }
    }),
    ...minusNow.map((m): DayMail => ({ key: `m-${m.id}`, mailId: 'account_minus', who: memberName(m.id), to: `${memberName(m.id)} (Mitglied) · erst beim Festschreiben`, vars: { Vorname: firstName(memberName(m.id)), Name: memberName(m.id), Datum: dmy(day.date), Kontostand: eur(m.balance), Link: '[Link zu Mein Konto]' } })),
  ]
  const [mailOff, setMailOff] = useState<string[]>([])
  const sending = (key: string) => !mailOff.includes(key)
  /** Every booking of the Betriebskonto of a member today, as it was booked: settlements, corrections (only the differences), deposits. */
  const memberEntries = (id: string): PreviewEntry[] => {
    const out: PreviewEntry[] = []
    settle.done.filter((s) => s.memberId === id).forEach((s) => {
      const un = s.fixes.flatMap((f) => (f.uncover ? [f.uncover] : []))
      const price0 = Math.round((s.price + un.reduce((n, u) => n + u.amount, 0)) * 100) / 100
      if (price0 > 0) out.push({ time: s.time, text: `Sprungtag: ${jumpsLabel(s.jumps + un.filter((u) => !u.noShow).length, s.paidSeats + un.filter((u) => u.noShow).length)}`, amount: -price0 })
      const extras0 = s.fixes[0]?.fromExtras ?? s.extras, cash0 = s.fixes[0]?.fromCash ?? s.cash
      extras0.forEach((x) => out.push({ time: s.time, text: x.name, amount: -x.price }))
      if (cash0 > 0) out.push({ time: s.time, text: 'Bar in die Kassa', amount: cash0, doc: s.doc })
      s.fixes.forEach((f, i) => {
        const to = s.fixes[i + 1]?.fromExtras ?? s.extras
        extrasDiff(f.fromExtras ?? to, to).forEach((d) => out.push({ time: f.time, text: `Korrektur ${d.name}`, amount: -d.amount }))
        if (f.uncover) out.push({ time: f.time, text: `Korrektur: ${f.reason}`, amount: f.uncover.amount })
        if (f.toCash !== f.fromCash) out.push({ time: f.time, text: 'Korrektur bar', amount: Math.round((f.toCash - f.fromCash) * 100) / 100, doc: f.doc })
      })
    })
    settle.deposits.filter((d) => d.memberId === id).forEach((d) => out.push({ time: d.time, text: 'Einzahlung bar', amount: d.amount, doc: d.doc }))
    return out.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }
  const memberAccounts: PreviewAccount[] = [...new Set([...chargedIds, ...settle.deposits.map((d) => d.memberId)])].sort((a, b) => memberName(a).localeCompare(memberName(b))).map((id) => {
    const entries = memberEntries(id), after = settle.balance(id)
    return { key: id, title: memberName(id), sub: 'Betriebskonto', entries, after, before: Math.round((after - entries.reduce((n, e) => n + e.amount, 0)) * 100) / 100 }
  }).filter((a) => a.entries.length > 0)
  const bank = ledger.accounts.find((a) => a.kind === 'bank' && !a.archived)
  const moneyAccounts: PreviewAccount[] = [
    { key: 'kassa', title: ledger.accountName(CASH_ID), sub: 'Bargeldkonto', entries: [
      ...kassaToday.map((l) => ({ time: l.time, text: l.who, amount: l.amount, doc: l.doc })),
      ...guestLines.filter((l) => l.how === 'gast').map((l) => ({ text: `Tandem bar: ${l.who}${l.code ? ` · ${l.code}` : ''}`, amount: l.cash })),
    ] },
    { key: 'bank', title: bank?.name ?? 'Bank', sub: 'Bankkonto · Eingang erwartet', expected: true, entries: guestLines.filter((l) => l.how === 'offen').map((l) => ({ text: `Überweisung ${l.who}${l.code ? ` · ${l.code}` : ''}`, amount: l.price })) },
  ].filter((a) => a.entries.length > 0)
  const askFinish = () => confirm.ask({
    title: 'Tag abschließen?', confirm: 'Ja, abschließen',
    lines: [
      <b className="font-semibold">Kassa: {eur(kassaSum)} schon gebucht{guestCashNow > 0 ? ` + ${eur(guestCashNow)} Tandem-Gäste bar` : ''}</b>,
      ...(paidBy > 0 ? [`${paidBy} ${paidBy === 1 ? 'Mitglied' : 'Mitglieder'} abgerechnet · ${eur(sum.memberTotal)}`] : []),
      ...(guestRows.length > 0 ? [`${guestRows.length} Tandem-${guestRows.length === 1 ? 'Gast' : 'Gäste'} · ${eur(sum.guestTotal)}`] : []),
      ...(notFlown.length > 0 ? [`${notFlown.length} Tandem nicht geflogen`] : []),
      ...(dayMails.length > 0 ? [`${dayMails.filter((m) => sending(m.key)).length} von ${dayMails.length} Mails senden`] : []),
    ],
    run: finish,
  })
  const finish = () => guarded('manifest.payments.update', () => {
    const cashBefore = Math.round((ledger.cash - kassaSum) * 100) / 100
    const t = now()
    const extra: DayCashLine[] = []
    // A guest with a ticket or voucher who paid cash: the Kassa line belongs to the ticket, which becomes paid.
    guestRows.forEach((j, i) => { const g = guestOf(j), l = guestLines[i]; if (l.how === 'gast' && g?.item && g.what && g.code) { ledger.bookCash(payTarget(g.what, g.code, g.item.buyer), priceOf(j), day.date, actor); extra.push({ time: t, who: `Bar eingegangen: ${g.what} ${g.code} (${l.who})`, amount: priceOf(j), doc: g.code }) } })
    applyGuests()
    const report = ledger.closeDay({ dayId: day.id, date: day.date, aircraft: day.aircraft, flights, jumps: jumpCount, lines, by: actor, time: t, cashBefore, notFlown, settled: true, cashBookings: [...kassaToday, ...extra] })
    // [Beschlossen] Charged today and in minus afterwards: "Konto im Minus" waits for "Prüfen und festschreiben" (amounts may still change).
    const minus = minusNow.filter((m) => sending(`m-${m.id}`))
    dayCheck.queueMinus(report.id, minus.map((m) => m.id))
    setSent({ minus: minus.length, guests: missed.filter((b) => sending(`g-${b.id}`)).length })
    setDone(report)
    onBooked()
  })

  /** [Entwurf] The decisions for guests who did not fly take effect only now: booking, voucher or ticket, history and mail. */
  const applyGuests = () => {
    if (missed.length === 0) return
    const ids = new Set(missed.map((b) => b.id))
    const byCode = new Map(missed.map((b, i) => [itemOf(b).code ?? '', { b, d: decisionOf(b), line: notFlown[i] }]))
    const logs = (what: 'Gutschein' | 'Ticket', x: { b: TandemBooking; d: Decision; line: NotFlownLine }) => [
      newLog(TODAY_ISO, actor, notFlownLog({ what, dayIso: day.date, outcome: x.d.outcome, reason: x.line.reason, kulanz: x.line.kulanz, newDate: x.line.newDate, paid: x.line.paid })),
      ...(sending(`g-${x.b.id}`) ? [newLog(TODAY_ISO, 'System', x.d.outcome === 'verschoben' ? `Mail „${x.line.newDate ? 'Neuer Termin' : 'Tandem verschoben'}“ an ${x.b.email ?? 'Käufer'} gesendet` : `Mail „Storniert ohne Erstattung“ an ${x.b.email ?? 'Käufer'} gesendet`)] : []),
    ]
    setBookings((all) => all.map((b) => {
      if (!ids.has(b.id)) return b
      const d = decisionOf(b)
      if (d.outcome === 'nicht_erschienen') return { ...b, state: 'nicht_erschienen' }
      const [dayId, windowId] = d.slot?.split('|') ?? []
      return dayId ? { ...b, dayId, windowId, checkin: undefined, masterId: undefined } : { ...b, state: 'verschoben', checkin: undefined }
    }))
    setLoads((ls) => ls.map((l) => (l.dayId === day.id && l.status !== 'gelandet' ? { ...l, jumpers: l.jumpers.filter((j) => !j.bookingId || !ids.has(j.bookingId)) } : l)))
    setVouchers((all) => all.map((v) => {
      const x = byCode.get(v.code)
      if (!x || itemOf(x.b).what !== 'Gutschein') return v
      const patch = x.d.outcome === 'nicht_erschienen' ? { status: 'redeemed_noshow' as const } : x.d.slot ? {} : { bookingId: undefined, status: v.paid ? 'active' as const : 'unpaid' as const }
      return { ...v, ...patch, log: [...v.log, ...logs('Gutschein', x)] }
    }))
    setTickets((all) => all.map((tk) => {
      const x = byCode.get(tk.code)
      if (!x || itemOf(x.b).what !== 'Ticket') return tk
      const [dId, wId] = x.d.slot?.split('|') ?? []
      const nd = days.find((d) => d.id === dId), w = nd?.windows.find((y) => y.id === wId)
      const patch = x.d.outcome === 'nicht_erschienen' ? { status: 'noshow' as const } : nd && w ? { day: nd.date, windowLabel: windowLabel(w) } : {}
      return { ...tk, ...patch, log: [...tk.log, ...logs('Ticket', x)] }
    }))
  }

  const title = `${weekday(day.date)} ${dmy(day.date)} · ${day.aircraft}`
  const current = done ? 'fertig' : step
  const go = (s: Step) => { setStep(s); document.querySelector('main')?.scrollTo({ top: 0 }) }
  const stillOpen = settle.openMembers.length

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Zurück zum Tag</button>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{done ? 'Tag abgeschlossen' : 'Tag abschließen'}</h1>
        <p className="mt-1 text-sm text-muted">{title}</p>
      </div>
      <Stepper current={current} />

      {!done && step === 'pruefen' && (
        <div className="space-y-6">
          <Group title="Flüge" count={`${landed.length} gelandet`}>
            {dayLoads.map((l) => {
              const no = flightNo(loads, l), names = peopleOf(l), isOpen = openLoads.includes(l.id)
              const pilot = members.find((m) => m.id === l.pilotId)?.name
              const ok = l.status === 'gelandet' && !!l.pilotId
              const state = l.status === 'gelandet' ? (l.pilotId ? pilot : 'Pilot fehlt') : l.status === 'in_air' ? 'In der Luft' : l.status === 'boarding' ? 'Boarding' : 'Nicht geflogen'
              const full = slots(l.jumpers) >= cap
              return (
                <div key={l.id} className={clsx('@container', !ok && 'bg-warn-soft/40')}>
                  <div className="flex flex-col gap-3 px-4 py-3 @2xl:flex-row @2xl:items-center @2xl:gap-4 @2xl:px-5">
                    <button onClick={() => toggleLoad(l.id)} aria-expanded={isOpen} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full', ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>{ok ? <Done /> : <Plane size={18} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">Flug {no} · {l.time} <span className="font-normal text-muted">· {state}</span></span>
                        <span className="block truncate text-sm text-muted">{names.length === 0 ? 'leer' : `${names.length} ${names.length === 1 ? 'Person' : 'Personen'}: ${names.join(', ')}`}</span>
                      </span>
                      <ChevronDown size={20} className={clsx('shrink-0 text-muted transition', isOpen && 'rotate-180')} />
                    </button>
                    {l.status === 'gelandet' && !l.pilotId && <div className="flex w-full shrink-0 @2xl:w-auto"><MemberPicker ariaLabel={`Pilot von Flug ${no}`} className="w-full @2xl:w-64" value="" placeholder="Pilot wählen" onChange={(id) => id && patchLoad(l.id, { pilotId: id })} allow={(m) => memberCan(m.id, 'manifest.flights.pilot')} /></div>}
                    {l.status === 'in_air' && <div className="flex w-full shrink-0 [&>button]:w-full @2xl:w-auto @2xl:[&>button]:w-auto"><Big onClick={() => patchLoad(l.id, { status: 'gelandet' })}>Gelandet</Big></div>}
                    {(l.status === 'geplant' || l.status === 'boarding') && <div className="flex w-full shrink-0 [&>button]:w-full @2xl:w-auto @2xl:[&>button]:w-auto"><Big onClick={() => strike(l)}>Flug streichen</Big></div>}
                  </div>
                  {isOpen && (
                    <div className="space-y-2 border-t border-line bg-slate-50/70 px-4 py-3 @2xl:px-5">
                      {l.jumpers.map((j) => {
                        if (j.kind === 'tandem') {
                          const b = bookings.find((x) => x.id === j.bookingId), master = members.find((m) => m.id === b?.masterId)?.name
                          return (
                            <div key={j.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-3 py-2">
                              <span className="min-w-0 flex-1"><span className="block truncate text-base">{b ? fullName(b) : j.name}</span><span className="block truncate text-sm text-muted">mit {master ?? 'Master fehlt'}</span></span>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-sm text-muted">Tandem</span>
                            </div>
                          )
                        }
                        const locked = !!j.memberId && coveredLoads(j.memberId).has(l.id)
                        return (
                          <div key={j.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-3 py-1.5">
                            <span className="min-w-0 flex-1 truncate text-base">{j.name}{j.noShow && <span className="ml-2 text-sm text-muted">Platz bezahlt</span>}</span>
                            {l.status !== 'gelandet' ? null : locked
                              ? <span className="inline-flex h-11 items-center gap-1.5 px-2 text-sm text-muted"><Lock size={15} /> abgerechnet</span>
                              : <button onClick={() => removeFrom(l, j)} aria-label={`${j.name} von Flug ${no} nehmen`} title="Nicht dabei" className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-slate-100 hover:text-ink"><X size={14} /> <span className="hidden @md:inline">nicht dabei</span></button>}
                          </div>
                        )
                      })}
                      {l.jumpers.length === 0 && <div className="px-1 py-2 text-sm text-muted">Niemand an Bord.</div>}
                      {l.status === 'gelandet' && (
                        <div className="flex flex-col gap-2 pt-1 @md:flex-row @md:items-center @md:justify-between">
                          <span className="flex items-center gap-3 text-sm text-muted">{full ? `Voll (${cap} Plätze)` : 'Springer fehlt?'}<LoadEditLink day={day} load={l} /></span>
                          <MemberPicker ariaLabel={`Springer auf Flug ${no} nachtragen`} className="w-full @md:w-64" value="" placeholder="Nachtragen" disabled={full}
                            onChange={(id) => id && addTo(l, id)} allow={(m) => memberCan(m.id, 'manifest.jumps.sport') && !l.jumpers.some((j) => j.memberId === m.id)}
                            rank={(m) => (checkedIn.includes(m.id) ? 0 : 1)} rankHint="Am Platz zuerst" info={(m) => (checkedIn.includes(m.id) ? 'am Platz' : undefined)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {dayLoads.length === 0 && <Empty>Kein Flug an diesem Tag.</Empty>}
          </Group>

          {sportIds.length + idle.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Wer war auf welchen Loads</h2>
                <span className="text-sm tabular-nums text-muted">{sportIds.length}</span>
              </div>
              <div className="rounded-xl border border-line bg-surface/60 px-4 py-2 text-sm">
                {sportIds.map((id) => {
                  const mine = landed.filter((l) => l.jumpers.some((j) => j.id === `s-${id}`))
                  const jumps = mine.filter((l) => l.jumpers.some((j) => j.id === `s-${id}` && !j.noShow)).length
                  return (
                    <div key={id} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-0">
                      <span className="min-w-0 truncate">{memberName(id)} <span className="text-muted">→ Flug {mine.map((l) => flightNo(loads, l)).join(', ')}</span></span>
                      <span className="shrink-0 tabular-nums text-muted">{jumpsLabel(jumps, mine.length - jumps)}</span>
                    </div>
                  )
                })}
                {idle.length > 0 && <div className="py-1.5 text-muted">Am Platz, nicht gesprungen: {idle.join(', ')}</div>}
              </div>
            </section>
          )}

          {missed.length > 0 && (
            <Group title="Tandem nicht geflogen" count={`${missed.length}`}>
              {missed.length >= 2 && (
                <div className="@container bg-slate-50">
                  <div className="flex flex-col gap-3 px-4 py-4 @2xl:flex-row @2xl:items-center @2xl:px-5">
                    <div className="min-w-0 flex-1"><div className="text-base font-medium">Alle verschieben</div><div className="text-sm text-muted">{missed.length} Gäste</div></div>
                    <div className="flex gap-2">
                      {POSTPONE_REASONS.map((r) => <Chip key={r} on={allBulk(r)} onClick={() => bulk(r)}>{r}</Chip>)}
                    </div>
                  </div>
                  {allBulk('Sonstiges') && <div className="px-4 pb-4 @2xl:px-5"><input aria-label="Was war los? (alle)" value={bulkNote} onChange={(e) => { setBulkNote(e.target.value); bulk('Sonstiges', e.target.value) }} placeholder="Was war los?" className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand" /></div>}
                </div>
              )}
              {missed.map((b) => {
                const d = decisionOf(b), g = itemOf(b), item = g.what ? `${g.what} ${g.code ?? ''}`.trim() : g.code ?? 'Buchung'
                const twoChoices = !!b.checkin || !!d.bulk
                const kulanzMode = !twoChoices && d.outcome === 'verschoben'
                return (
                  <div key={b.id} className={clsx('space-y-3 px-4 py-4 sm:px-5', !isDecided(b) && 'bg-warn-soft/40')}>
                    <div className="min-w-0">
                      <div className="truncate text-base font-medium">{fullName(b)}</div>
                      <div className="truncate text-sm text-muted">{[item, b.checkin ? 'eingecheckt' : 'nicht eingecheckt', g.item && !g.item.paid ? 'nicht bezahlt' : ''].filter(Boolean).join(' · ')}</div>
                    </div>
                    {twoChoices && (
                      <div role="radiogroup" aria-label={`Ergebnis ${fullName(b)}`} className="grid grid-cols-2 gap-2">
                        <Pick on={d.outcome === 'verschoben'} onClick={() => decide(b, { outcome: 'verschoben' })} icon={<CalendarClock size={18} />}>Verschieben</Pick>
                        <Pick on={d.outcome === 'nicht_erschienen'} onClick={() => decide(b, { outcome: 'nicht_erschienen' })} icon={<UserX size={18} />}>Nicht erschienen</Pick>
                      </div>
                    )}
                    {!twoChoices && d.outcome === 'nicht_erschienen' && (
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-medium"><UserX size={16} /> Nicht erschienen · {item} verfällt</span>
                        <button onClick={() => decide(b, { outcome: 'verschoben', kulanz: '', kulanzOk: false })} className="min-h-11 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">Kulanz: trotzdem verschieben</button>
                      </div>
                    )}
                    {twoChoices && d.outcome === 'nicht_erschienen' && <div className="text-sm text-muted">{item} verfällt{g.item && !g.item.paid ? ', Zahlung bleibt offen' : ''}</div>}
                    {d.outcome === 'verschoben' && (
                      <div className="space-y-3">
                        {kulanzMode && (
                          <div className="flex flex-col gap-2 rounded-xl border border-line p-3 @container">
                            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Kulanz</span><button onClick={() => decide(b, { outcome: 'nicht_erschienen', kulanz: undefined, kulanzOk: undefined })} className="min-h-11 text-sm text-muted hover:text-ink">Doch nicht erschienen</button></div>
                            {d.kulanzOk
                              ? <div className="flex items-center justify-between gap-3 text-sm"><span>Grund: {d.kulanz}</span><button onClick={() => decide(b, { kulanzOk: false })} className="min-h-11 text-brand">Ändern</button></div>
                              : <div className="flex gap-2"><input aria-label="Grund der Kulanz" value={d.kulanz ?? ''} onChange={(e) => decide(b, { kulanz: e.target.value })} placeholder="Grund der Kulanz" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand" /><Big disabled={(d.kulanz ?? '').trim().length < 3} onClick={() => decide(b, { kulanzOk: true })}>Bestätigen</Big></div>}
                          </div>
                        )}
                        <div>
                          <div className="mb-1.5 text-sm text-muted">Grund</div>
                          <div className="flex flex-wrap gap-2">{POSTPONE_REASONS.map((r) => <Chip key={r} on={d.reason === r} onClick={() => decide(b, { reason: r })}>{r}</Chip>)}</div>
                          {d.reason === 'Sonstiges' && <input aria-label="Was war los?" value={d.note ?? ''} onChange={(e) => decide(b, { note: e.target.value })} placeholder="Was war los?" className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand" />}
                        </div>
                        <div>
                          <div className="mb-1.5 text-sm text-muted">Neuer Termin</div>
                          <div className="flex flex-wrap gap-2">
                            <Chip on={!d.slot} onClick={() => decide(b, { slot: undefined })}>Termin offen</Chip>
                            {slotsFor(b).map((s) => <Chip key={s.key} on={d.slot === s.key} onClick={() => decide(b, { slot: s.key })}>{s.label}</Chip>)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </Group>
          )}

          <Footer>
            <span className={clsx('text-sm font-medium', openIssues > 0 ? 'text-warn' : 'text-ok')}>{openIssues > 0 ? `Noch ${openIssues} offen` : 'Alles geklärt'}</span>
            <Big variant="primary" disabled={openIssues > 0} onClick={() => go('bezahlung')}>Weiter <ArrowRight size={18} /></Big>
          </Footer>
        </div>
      )}

      {!done && step === 'bezahlung' && (
        <div className="space-y-6">
          {stillOpen > 0 && (
            <Group title="Noch offen" count={`${stillOpen}`}>
              {settle.openMembers.map((id) => {
                const o = settle.open(id)
                return (
                  <Item key={id} tone="warn" title={memberName(id)} amount={eur(o.price)} sub={[jumpsLabel(o.jumps, o.paidSeats), o.flight].filter(Boolean).join(' · ')}>
                    <Big variant="primary" onClick={() => setSettleFor({ id })}>Abrechnen</Big>
                  </Item>
                )
              })}
              {stillOpen >= 2 && (
                <div className="px-4 py-3 sm:px-5"><Big className="w-full" onClick={() => confirm.ask({
                  title: `Alle ${stillOpen} vom Konto abrechnen?`, confirm: 'Ja, abrechnen',
                  lines: settle.openMembers.map((id) => payWords(memberName(id), settle.open(id).price, 0)),
                  run: () => guarded('manifest.payments.update', () => settle.openMembers.forEach((id) => settle.settle(id, 0, false))),
                })}>Alle vom Konto abrechnen ({stillOpen})</Big></div>
              )}
            </Group>
          )}

          {settledRows.length > 0 && (
            <Group title="Schon abgerechnet" count={eur(settledRows.reduce((n, s) => n + settledPrice(s), 0))}>
              {settledRows.map((s) => (
                <Item key={s.id} title={s.name} amount={eur(settledPrice(s))}
                  sub={[whatOf(s), s.flight].filter(Boolean).join(' · ')}
                  foot={<div className="text-sm text-muted">{payLabel(settledPrice(s), s.cash)} · {s.time}{s.fixes.length > 0 && <> · korrigiert{fixText(s) ? `: ${fixText(s)}` : ''}</>}</div>}>
                  <Big onClick={() => setFixFor(s)}>Korrigieren</Big>
                </Item>
              ))}
            </Group>
          )}

          {guestRows.length > 0 && (
            <Group title="Tandem-Gäste" count={eur(sum.guestTotal)}>
              {guestRows.map((j) => {
                const state = guestState(j), g = guestOf(j), b = bookingOf(j), how = guestHow(j)
                if (noTicket(j) && b) return (
                  <Item key={j.id} tone="warn" icon={<Ticket size={18} />} title={nameOf(j)} amount={eur(j.price)} sub={['Kein Ticket', flightsOf(j.id)].filter(Boolean).join(' · ')}>
                    <Big variant="primary" onClick={() => setTicketFor(b.id)}>Ticket anlegen</Big>
                  </Item>
                )
                return (
                  <Item key={j.id} title={nameOf(j)} amount={eur(priceOf(j))} sub={[g?.code, flightsOf(j.id)].filter(Boolean).join(' · ') || 'Tandem'}
                    foot={(state === 'offen' || state === 'nachweis') && g?.item && b ? <button onClick={() => setPayFor(b.id)} className="min-h-11 text-sm font-medium text-brand">Überweisung ist da? Zahlung klären</button> : undefined}>
                    {state === 'bezahlt'
                      ? <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-ok-soft px-4 text-sm font-medium text-ok"><Check size={16} /> {HOW_WORDS[how]}</span>
                      : <Choice<GuestChoice> label={`Bezahlung ${nameOf(j)}`} value={choiceOf(j)} onChange={(v) => setGuestChoice((p) => ({ ...p, [j.id]: v }))} options={[{ value: 'bar', label: 'bar' }, { value: 'offen', label: 'Überweisung offen' }]} />}
                  </Item>
                )
              })}
            </Group>
          )}

          {settledRows.length + stillOpen + guestRows.length === 0 && <Empty>Niemand ist geflogen. Es gibt nichts abzurechnen.</Empty>}

          <Group title="Kassa heute" count={eur(kassaSum)}>
            {kassaToday.map((l) => <CashRow key={l.lineId} line={l} />)}
            {kassaToday.length === 0 && <Empty>Noch kein Bargeld heute.</Empty>}
          </Group>

          <Footer>
            <Big onClick={() => go('pruefen')}><ArrowLeft size={18} /> Zurück</Big>
            {stillOpen + withoutTicket > 0
              ? <span className="text-sm font-medium text-warn">Noch {stillOpen + withoutTicket} offen</span>
              : <span className="hidden text-sm text-muted @md:inline">Kassa heute <b className="text-base tabular-nums text-ink">{eur(kassaEnd)}</b></span>}
            <Big variant="primary" disabled={stillOpen + withoutTicket > 0} onClick={() => go('uebersicht')}>Weiter <ArrowRight size={18} /></Big>
          </Footer>
        </div>
      )}

      {!done && step === 'uebersicht' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-5">
              <div className="text-sm text-muted">Bargeld heute</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{eur(kassaEnd)}</div>
              <div className="mt-2 space-y-0.5 text-sm text-muted">
                <div className="flex justify-between gap-3"><span>schon gebucht</span><span className="tabular-nums">{eur(kassaSum)}</span></div>
                <div className="flex justify-between gap-3"><span>jetzt Tandem-Gäste bar</span><span className="tabular-nums">{eur(guestCashNow)}</span></div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-muted">Kassa danach</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{eur(ledger.cash + guestCashNow)}</div>
              <div className="mt-2 text-sm text-muted">jetzt {eur(ledger.cash)}</div>
            </Card>
          </div>

          {sum.guests.length > 0 && (
            <Group title="Tandem-Gäste" count={eur(sum.guestTotal)}>
              {sum.guests.map((l, i) => (
                <Sentence key={i} amount={eur(l.price)}>
                  <b className="font-medium">{l.who}</b>{' '}
                  {l.how === 'voucher' ? <>löst Voucher <span className="font-mono">{l.code}</span> ein</>
                    : l.how === 'gast' ? <>zahlt {l.code && <>Ticket <span className="font-mono">{l.code}</span> </>}<Tag tone="ok">bar</Tag></>
                    : l.how === 'offen' ? <><Tag tone="warn">Überweisung offen</Tag></>
                    : <>hat {HOW_WORDS[l.how]}</>}
                </Sentence>
              ))}
            </Group>
          )}
          {notFlown.length > 0 && (
            <Group title="Tandem nicht geflogen" count={`${notFlown.length}`}>
              {notFlown.map((l, i) => <Sentence key={i}>{notFlownSentence(l)}</Sentence>)}
            </Group>
          )}

          <BookingsPreview money={moneyAccounts} members={memberAccounts} />
          {dayMails.length > 0 && <MailList list={dayMails} off={mailOff} onToggle={(k) => setMailOff((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))} />}

          <Footer>
            <Big onClick={() => go('bezahlung')}><ArrowLeft size={18} /> Zurück</Big>
            <Big variant="primary" className="flex-1 @md:flex-none @md:px-10" onClick={askFinish}>Tag abschließen</Big>
          </Footer>
        </div>
      )}

      {done && (
        <div className="space-y-6">
          <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <CircleCheck size={56} className="text-ok" strokeWidth={1.5} />
            <div className="text-xl font-semibold">Erledigt</div>
            <div className="text-sm text-muted">{done.number} · {done.time ?? ''} · {done.by}</div>
            <div className="mt-1"><DayCheckBadge report={done} /></div>
            <div className="mt-4 text-sm text-muted">Bargeld heute</div>
            <div className="text-3xl font-semibold tabular-nums">{eur((done.cashBookings ?? []).reduce((n, l) => n + l.amount, 0))}</div>
            {sent.minus > 0 && <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm"><Mail size={16} className="text-muted" /> „Konto im Minus“ an {sent.minus === 1 ? '1 Mitglied' : `${sent.minus} Mitglieder`} beim Festschreiben</div>}
            {sent.guests > 0 && <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm"><Mail size={16} className="text-muted" /> Mail an {sent.guests === 1 ? '1 Tandem-Gast' : `${sent.guests} Tandem-Gäste`} gesendet</div>}
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Big variant="primary" className="w-full" onClick={() => setDialog('beleg')}><Printer size={18} /> Tagesabschluss</Big>
            <Big className="w-full" onClick={() => setDialog('zaehlen')}>Kassa zählen</Big>
          </div>
          <Big variant="ghost" className="w-full" onClick={onBack}>Zurück zum Tag</Big>
        </div>
      )}

      {dialog === 'beleg' && done && <DayReportDrawer report={done} onClose={() => setDialog(null)} />}
      {dialog === 'zaehlen' && <CashCountDialog accountId={CASH_ID} onClose={() => setDialog(null)} />}
      {ticketFor && bookings.find((x) => x.id === ticketFor) && <QuickTicket booking={bookings.find((x) => x.id === ticketFor)!} onClose={() => setTicketFor(null)} />}
      {payFor && bookings.find((x) => x.id === payFor) && <GuestPayDrawer booking={bookings.find((x) => x.id === payFor)!} onClose={() => setPayFor(null)} />}
      {settleFor && <SettleSheet day={day} memberId={settleFor.id} extrasOnly={settleFor.extrasOnly} checkout={false} onClose={() => setSettleFor(null)} />}
      {confirm.dialog}
      {fixFor && <SettleSheet day={day} memberId={fixFor.memberId} checkout={false} fix={fixFor} onClose={() => setFixFor(null)} />}
    </div>
  )
}

function CashRow({ line: l }: { line: DayCashLine }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
      <span className="min-w-0 text-base"><span className="mr-2 tabular-nums text-muted">{l.time ?? '–'}</span>{l.who}{l.doc && <span className="ml-2 font-mono text-sm text-muted">{l.doc}</span>}</span>
      <span className={clsx('shrink-0 text-base tabular-nums', l.amount < 0 && 'text-bad')}>{eur(l.amount)}</span>
    </div>
  )
}

function Pick({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button role="radio" aria-checked={on} onClick={onClick}
      className={clsx('flex h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-base font-medium transition active:scale-[0.98]', on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink hover:bg-slate-50')}>
      {icon}{children}
    </button>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick}
      className={clsx('inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition', on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface hover:bg-slate-50')}>
      {on && <Check size={14} />}{children}
    </button>
  )
}

// ---------- Building blocks, sized for a finger on a tablet ----------

function Stepper({ current }: { current: string }) {
  const at = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="@container mb-6">
    <ol className="grid grid-cols-4 gap-2" aria-label="Schritte">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === at ? 'step' : undefined} className="min-w-0">
          <div className={clsx('h-1.5 rounded-full', i <= at ? 'bg-brand' : 'bg-slate-200')} />
          <div className={clsx('mt-2 hidden items-center gap-1.5 text-sm @xl:flex', i === at ? 'font-semibold text-ink' : i < at ? 'text-ink' : 'text-muted')}>
            <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs', i < at ? 'bg-brand text-white' : i === at ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-muted')}>{i < at ? <Check size={13} /> : i + 1}</span>
            <span className="hidden truncate @xl:inline">{s.label}</span>
          </div>
        </li>
      ))}
    </ol>
    <div className="mt-2 text-sm @xl:hidden"><span className="text-muted">Schritt {at + 1} von {STEPS.length} · </span><b className="font-semibold">{STEPS[at].label}</b></div>
    </div>
  )
}

function Group({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {count && <span className="text-sm tabular-nums text-muted">{count}</span>}
      </div>
      <Card className="divide-y divide-line overflow-visible">{children}</Card>
    </section>
  )
}

/** One person or flight: name and detail on the left, the one action on the right; below each other when narrow. */
function Item({ title, sub, amount, icon, tone, foot, children }: { title: string; sub?: string; amount?: string; icon?: ReactNode; tone?: 'warn'; foot?: ReactNode; children?: ReactNode }) {
  return (
    <div className={clsx('@container', tone === 'warn' && 'bg-warn-soft/40')}>
      <div className="flex flex-col gap-3 px-4 py-4 @2xl:flex-row @2xl:items-center @2xl:gap-4 @2xl:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full', tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok')}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-base font-medium">{title}</span>
              {amount && <span className="shrink-0 text-base font-semibold tabular-nums @2xl:hidden">{amount}</span>}
            </div>
            {sub && <div className="truncate text-sm text-muted">{sub}</div>}
            {foot && <div className="mt-0.5">{foot}</div>}
          </div>
          {amount && <span className="hidden w-24 shrink-0 text-right text-base font-semibold tabular-nums @2xl:block">{amount}</span>}
        </div>
        {children && <div className={clsx('flex w-full shrink-0 [&>button]:w-full @2xl:[&>button]:w-auto', amount ? '@2xl:w-[22rem]' : '@2xl:w-auto @2xl:justify-end')}>{children}</div>}
      </div>
    </div>
  )
}

function Sentence({ amount, children }: { amount?: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5 sm:px-5">
      <span className="min-w-0 text-base leading-relaxed">{children}</span>
      {amount && <span className="shrink-0 text-base tabular-nums">{amount}</span>}
    </div>
  )
}

function Choice<T extends string>({ value, onChange, options, label, full }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[]; label: string; full?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1', full ? 'w-full' : 'min-w-[13rem] flex-[2] @2xl:flex-none')}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} role="radio" aria-checked={on} disabled={o.disabled && !on} onClick={() => onChange(o.value)}
            className={clsx('h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition disabled:opacity-40', on ? 'bg-surface text-brand shadow-sm ring-2 ring-brand' : 'text-muted hover:text-ink')}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Big({ children, onClick, variant = 'secondary', disabled, className }: { children: ReactNode; onClick: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx('inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-base font-medium transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-brand text-white hover:bg-blue-700',
        variant === 'secondary' && 'border border-line bg-surface hover:bg-slate-50',
        variant === 'ghost' && 'text-muted hover:bg-slate-100 hover:text-ink',
        className)}>
      {children}
    </button>
  )
}

/** The action bar of a step: stays at the bottom of the screen while the list scrolls. */
function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <div className="@container"><div className="flex items-center justify-between gap-3">{children}</div></div>
    </div>
  )
}

function Done() { return <Check size={18} /> }
function Empty({ children }: { children: ReactNode }) { return <div className="px-5 py-6 text-sm text-muted">{children}</div> }
function Money({ n }: { n: number }) { return <b className={clsx('whitespace-nowrap font-semibold tabular-nums', n < 0 ? 'text-bad' : 'text-ink')}>{eur(n)}</b> }
function Tag({ tone, children }: { tone: 'ok' | 'warn'; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium', tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>{children}</span>
}
