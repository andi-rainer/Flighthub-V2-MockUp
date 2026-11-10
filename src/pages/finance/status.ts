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
export const receiptSum = (rs: { amount: number }[]) => Math.round(rs.reduce((n, r) => n + r.amount, 0) * 100)

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
/** Still to do before the period can be released. */
export const isTodo = (s: LineStatus) => s === 'offen' || s === 'beleg' || s === 'abweichung'
