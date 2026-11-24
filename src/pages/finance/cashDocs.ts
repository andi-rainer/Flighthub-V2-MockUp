/**
 * [Entwurf] Documents of the Kassa. A day-closing report (Tagesabschluss-Beleg) is the receipt for the cash takings of a Sprungtag: the Kassa
 * booking links to it like a booking in the bank links to an invoice. A cash count (Zählprotokoll) records what was really in the box.
 */

/** How one person or guest of a Sprungtag was settled. */
export type DayHow = 'konto' | 'bar' | 'gast' | 'voucher' | 'online' | 'ticket' | 'offen'
export interface DayReportLine {
  who: string; memberId?: string
  /** "Sprung", "3 Sprünge", "Tandem" ... */ what: string
  price: number; how: DayHow
  /** Cash received for this line today (0: none). */ cash: number
  /** Voucher or ticket code. */ code?: string
  /** A guest paid at the manifest: booked one by one in the Kassa. */ ownLine?: boolean
  /** [Entwurf] Members: balance of the Betriebskonto before the closing. */ before?: number
  /** [Entwurf] Members: jumps flown and seats paid without jumping. */ jumps?: number; paidSeats?: number
  /** [Entwurf] The flights of the line ("Flug 2", "Flug 1, 3"). */ flight?: string
  /** [Entwurf] Members: settled during the day at this time ("15:42"); the line was booked then, not at the closing. */ time?: string
  /** [Entwurf] Members: the Quittung of the cash (QU-…). */ doc?: string
  /** [Entwurf] Members: Zusatzkosten charged with this line (included in `price`). */ extras?: { name: string; price: number }[]
  /** [Entwurf] Members: the payment was corrected at the closing ("vom Konto → bar: Grund"). */ fix?: string
}
/** [Entwurf] One Kassa booking of the day: settled at check-out, a deposit, a tandem guest, the remaining guest cash at the closing. */
export interface DayCashLine { time?: string; who: string; amount: number; lineId?: string; /** Quittung or ticket/voucher code. */ doc?: string }
/** [Entwurf] A tandem guest booked for the day who did not fly, and what the closing decided. */
export interface NotFlownLine {
  who: string; what?: 'Gutschein' | 'Ticket'; code?: string
  outcome: 'verschoben' | 'nicht_erschienen'
  /** Wetter, Technik, Gast verhindert or a free text. */ reason?: string
  /** A guest who was not checked in and still keeps the jump: the reason of the exception. */ kulanz?: string
  /** "Sa 14.11.2026 · 10:00–12:00"; none: the date is open. */ newDate?: string
  paid?: boolean
}
/** "Markus Köhler: verschoben (Wetter), Gutschein GS-1042 bleibt gültig, neuer Termin Sa 14.11.2026 · 10:00–12:00" */
export function notFlownSentence(l: NotFlownLine) {
  const item = l.what ? `${l.what}${l.code ? ` ${l.code}` : ''}` : l.code ?? 'Buchung'
  if (l.outcome === 'nicht_erschienen') return `${l.who}: nicht erschienen, ${item} verfällt${l.what && !l.paid ? ', Zahlung bleibt offen' : ''}`
  return `${l.who}: verschoben (${[l.reason, l.kulanz && `Kulanz: ${l.kulanz}`].filter(Boolean).join(', ')}), ${item} bleibt gültig, ${l.newDate ? `neuer Termin ${l.newDate}` : 'Termin offen'}`
}
/** "Flug 1, 3" and seats paid without a jump: "Flug 1, 3 · ohne Sprung: Flug 2". */
export const flightText = (jumped: number[], seats: number[] = []) =>
  [jumped.length ? `Flug ${jumped.join(', ')}` : '', seats.length ? `ohne Sprung: Flug ${seats.join(', ')}` : ''].filter(Boolean).join(' · ') || undefined

export interface DayReport {
  id: string; /** "TA-2026-11-07" */ number: string; dayId: string; /** ISO */ date: string; aircraft: string; flights: number; jumps: number
  by: string; /** ISO */ at: string
  /** [Entwurf] Time of the closing ("17:42") and the Kassa before it. */ time?: string; cashBefore?: number
  lines: DayReportLine[]
  /** [Entwurf] Tandem guests of the day who did not fly: rescheduled or no-show. */ notFlown?: NotFlownLine[]
  /** [Entwurf] Members were settled one by one during the day (check-out or the closing), each with its own booking. */ settled?: boolean
  /** [Entwurf] Every Kassa booking of the day with its time. */ cashBookings?: DayCashLine[]
  /** The Kassa booking of the takings (none when no cash came in) and the receipt that carries this report. */
  cashLineId?: string; receiptId?: string
}

/** What a report adds up to. */
export function reportTotals(r: Pick<DayReport, 'lines'>) {
  const sum = (f: (l: DayReportLine) => boolean, v: (l: DayReportLine) => number) => r.lines.filter(f).reduce((n, l) => n + v(l), 0)
  return {
    /** Charged to Betriebskonten. */ charged: sum((l) => !!l.memberId, (l) => l.price),
    /** Cash credited to Betriebskonten. */ memberCash: sum((l) => !!l.memberId, (l) => l.cash),
    /** Cash of guests without a ticket record, in the day's Kassa booking. */ guestCash: sum((l) => !l.memberId && !l.ownLine, (l) => l.cash),
    /** Cash of guests with ticket or voucher, booked one by one. */ ticketCash: sum((l) => !l.memberId && !!l.ownLine, (l) => l.cash),
    /** Paid before (voucher, online, ticket): revenue today, no money today. */ prepaid: sum((l) => l.how === 'voucher' || l.how === 'online' || l.how === 'ticket', (l) => l.price),
    /** Flown, but the money is not here (transfer expected). */ open: sum((l) => l.how === 'offen', (l) => l.price),
  }
}
/** The Kassa booking of the day: cash of members plus cash of guests without a record. */
export const dayCash = (r: Pick<DayReport, 'lines'>) => { const t = reportTotals(r); return Math.round((t.memberCash + t.guestCash) * 100) / 100 }

const round2 = (n: number) => Math.round(n * 100) / 100

/** [Entwurf] Plain words for how a line was paid, as the manifest person and the Beleg say it. */
export const HOW_WORDS: Record<DayHow, string> = { konto: 'vom Konto', bar: 'bar', gast: 'bar', voucher: 'Voucher', online: 'online bezahlt', ticket: 'Ticket bezahlt', offen: 'Überweisung offen' }

/** "3 Sprünge", "1 Sprung, 1 Platz ohne Sprung" (seat paid by a no-show). */
export const jumpsLabel = (jumps = 1, paidSeats = 0) =>
  [jumps > 0 ? `${jumps} ${jumps === 1 ? 'Sprung' : 'Sprünge'}` : '', paidSeats > 0 ? `${paidSeats} ${paidSeats === 1 ? 'Platz' : 'Plätze'} ohne Sprung` : ''].filter(Boolean).join(', ')

export interface MemberRow { line: DayReportLine; before?: number; after?: number }
/**
 * [Entwurf] Everything the closing overview and the Tagesabschluss-Beleg show, read from the lines: cash split by members and guests,
 * the Kassa before and after, every member with the balance before and after, every guest, redeemed vouchers and who is in minus.
 */
export function daySummary(r: Pick<DayReport, 'lines' | 'cashBefore'>) {
  const members: MemberRow[] = r.lines.filter((l) => !!l.memberId).map((line) => ({ line, before: line.before, after: line.before === undefined ? undefined : round2(line.before - line.price + line.cash) }))
  const guests = r.lines.filter((l) => !l.memberId)
  const memberCash = round2(members.reduce((n, m) => n + m.line.cash, 0))
  const guestCash = round2(guests.reduce((n, l) => n + l.cash, 0))
  const cash = round2(memberCash + guestCash)
  return {
    members, guests, memberCash, guestCash, cash,
    memberTotal: round2(members.reduce((n, m) => n + m.line.price, 0)),
    guestTotal: round2(guests.reduce((n, l) => n + l.price, 0)),
    openTotal: round2(guests.filter((l) => l.how === 'offen').reduce((n, l) => n + l.price, 0)),
    vouchers: guests.filter((l) => l.how === 'voucher'),
    cashAfter: r.cashBefore === undefined ? undefined : round2(r.cashBefore + cash),
    /** In minus because of this day (zero or more before). */ newMinus: members.filter((m) => m.before !== undefined && m.after !== undefined && m.before >= 0 && m.after < 0),
    /** Already in minus before the day. */ oldMinus: members.filter((m) => m.before !== undefined && m.before < 0),
  }
}

// ---------- Cash count ----------
/** Euro notes and coins, largest first. The key is the value in cents. */
export const NOTES = [50000, 20000, 10000, 5000, 2000, 1000, 500] as const
export const COINS = [200, 100, 50, 20, 10, 5, 2, 1] as const
export const denomLabel = (cents: number) => (cents >= 100 ? `${cents / 100} €` : `${cents} Cent`)

export interface CashCount {
  id: string; accountId: string; /** ISO */ date: string; by: string
  /** Soll: the balance in the books. */ expected: number
  /** Ist: what was counted. */ counted: number
  /** Notes and coins: denomination (cents) → pieces. */ pieces: Record<string, number>
  /** Required when Ist differs from Soll. */ reason?: string
  /** The Differenz-Buchung. */ lineId?: string
}
export const countedSum = (pieces: Record<string, number>) => Object.entries(pieces).reduce((n, [k, v]) => n + Number(k) * (v || 0), 0) / 100

export const DIFFERENCE_REASONS = ['Wechselgeld falsch herausgegeben', 'Ausgabe ohne Beleg entnommen', 'Einzahlung nicht gebucht', 'Zählfehler bei der letzten Zählung', 'Unbekannt', 'Sonstiges'] as const
/** [Entwurf] Days after which the next count of a cash account is due. */
export const COUNT_INTERVAL_DAYS = 30
/** Days between two ISO dates. */
export const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)

/** The seed: the last count of the Kassa, five weeks ago, no difference (380 €). */
export const seedCounts: CashCount[] = [
  { id: 'cnt-seed', accountId: 'acc-kassa', date: '2026-10-05', by: 'Eva Steiner', expected: 380, counted: 380, pieces: { '5000': 2, '2000': 10, '1000': 4, '500': 8 } },
]
