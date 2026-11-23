import type { BankLine } from '../../data'
import type { Ledger } from './ledger'

/** Where a booking stands. Only `gebucht` and `gesperrt` (and `ausnahme`, which stays visible) are final. */
export type LineStatus = 'offen' | 'beleg' | 'abweichung' | 'ausnahme' | 'gebucht' | 'gesperrt'

export const STATUS: Record<LineStatus, { label: string; tone: 'warn' | 'ok' | 'info' | 'neutral' }> = {
  offen: { label: 'Offen', tone: 'warn' },
  beleg: { label: 'Beleg fehlt', tone: 'warn' },
  abweichung: { label: 'Belege weichen ab', tone: 'warn' },
  ausnahme: { label: 'Ohne Beleg', tone: 'info' },
  gebucht: { label: 'Gebucht', tone: 'ok' },
  gesperrt: { label: 'Gesperrt', tone: 'neutral' },
}

/** The invoices on a booking and whether they cover its amount. */
export const receiptsOf = (l: BankLine, ledger: Ledger) => ledger.receipts.filter((r) => r.lineId === l.id)
/** Signed: a credit note (negative) reduces the invoices it belongs to; compared with the line as an absolute amount. */
export const receiptSum = (rs: { amount: number }[]) => Math.abs(Math.round(rs.reduce((n, r) => n + r.amount, 0) * 100))

export function lineStatus(l: BankLine, ledger: Ledger): LineStatus {
  if (!ledger.done[l.id]) return 'offen'
  const rs = receiptsOf(l, ledger)
  if (l.needsReceipt) {
    if (rs.length === 0 && !ledger.exempt[l.id]) return 'beleg'
    if (rs.length > 0 && receiptSum(rs) !== Math.round(Math.abs(l.amount) * 100)) return 'abweichung'
  }
  if (ledger.isLocked(l.date)) return 'gesperrt'
  if (l.needsReceipt && rs.length === 0) return 'ausnahme'
  return 'gebucht'
}
/**
 * The counter booking of a transfer between the club's own accounts: the linked one, or (for transfers booked as a pair) the line on the
 * other account with the opposite amount on the same day that points back.
 */
export function counterOf(l: BankLine, ledger: Ledger): BankLine | undefined {
  const t = ledger.done[l.id]
  if (t?.kind !== 'umbuchung') return undefined
  if (t.lineId) return ledger.lines.find((x) => x.id === t.lineId)
  return ledger.lines.find((x) => {
    const o = ledger.done[x.id]
    return x.id !== l.id && x.accountId === t.accountId && x.amount === -l.amount && x.date === l.date && o?.kind === 'umbuchung' && o.accountId === l.accountId
  })
}

/** Lines on another account that could be the counter booking of `l`: not booked yet, the opposite amount, at most a week apart. */
export function counterCandidates(l: BankLine, accountId: string, ledger: Ledger): BankLine[] {
  const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000
  return ledger.lines.filter((x) => x.accountId === accountId && !ledger.done[x.id] && x.amount === -l.amount && Math.abs(day(x.date) - day(l.date)) <= 7)
}

/**
 * [Entwurf] What backs a booking: an invoice, a marked exemption, the linked counter booking (transfer), the system record (voucher, ticket,
 * Betriebskonto), or nothing yet. Used for the "Beleg" filter, so every booking can be checked for its proof.
 */
export type Proof = 'rechnung' | 'ausnahme' | 'fehlt' | 'intern' | 'offen'
export const PROOF: Record<Proof, string> = { rechnung: 'Mit Rechnung', ausnahme: 'Ohne Beleg (Ausnahme)', fehlt: 'Beleg fehlt', intern: 'Kein Beleg nötig', offen: 'Noch nicht zugeordnet' }
export function proofOf(l: BankLine, ledger: Ledger): Proof {
  if (receiptsOf(l, ledger).length > 0) return 'rechnung'
  if (!ledger.done[l.id]) return 'offen'
  if (!l.needsReceipt) return 'intern'
  return ledger.exempt[l.id] ? 'ausnahme' : 'fehlt'
}

/** Still to do before the period can be released. */
export const isTodo = (s: LineStatus) => s === 'offen' || s === 'beleg' || s === 'abweichung'
