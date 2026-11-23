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
}
export interface DayReport {
  id: string; /** "TA-2026-11-07" */ number: string; dayId: string; /** ISO */ date: string; aircraft: string; flights: number; jumps: number
  by: string; /** ISO */ at: string
  lines: DayReportLine[]
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
