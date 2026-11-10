import { eur } from '../../data'
import type { PaymentEvent, PaymentTarget } from '../finance/ledger'
import { fullName, type LogEntry, type PayProof, type Person, type Ticket, type Voucher } from './data'

/** "06.11." → ISO of the latest such day that is not in the future. */
export function isoFromDm(dm: string, todayIso: string): string {
  const [d, m] = dm.split('.')
  const year = Number(todayIso.slice(0, 4))
  const iso = `${year}-${m}-${d}`
  return iso > todayIso ? `${year - 1}-${m}-${d}` : iso
}

/** What Finanzen shows for the money of one voucher or ticket. */
export const payTarget = (what: 'Gutschein' | 'Ticket', code: string, buyer: Person): PaymentTarget => ({ kind: 'zahlung', code, label: `${what} ${code} · ${fullName(buyer)}` })

const how = (e: PaymentEvent) => (e.method === 'cash' ? `Bar am ${e.date}` : `Überweisung vom ${e.date}, in Finanzen zugewiesen`)
const entry = (e: PaymentEvent, todayIso: string, text: string): LogEntry => ({ id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: `${todayIso} ${new Date().toTimeString().slice(0, 5)}`, by: e.by, kind: 'event', text })

/** A payment reached a voucher: it is paid, an unpaid one becomes usable. */
export function payVoucher(v: Voucher, e: PaymentEvent, todayIso: string): Voucher {
  if (e.amount <= 0) return v
  return { ...v, proof: undefined, paid: true, pay: e.method, paidOn: isoFromDm(e.date, todayIso), payLineId: e.lineId, status: v.status === 'unpaid' ? (v.bookingId ? 'reserved' : 'active') : v.status, log: [...v.log, entry(e, todayIso, `Zahlung ${eur(e.amount)} erfasst: ${how(e)}`)] }
}

/** A payment (amount > 0) or a refund (amount < 0) reached a ticket. */
export function payTicket(t: Ticket, e: PaymentEvent, todayIso: string): Ticket {
  if (e.amount < 0) return { ...t, refunded: true, log: [...t.log, entry(e, todayIso, `Erstattung ${eur(-e.amount)} gebucht: ${how(e)}`)] }
  return { ...t, proof: undefined, paid: true, pay: e.method, paidOn: isoFromDm(e.date, todayIso), payLineId: e.lineId, log: [...t.log, entry(e, todayIso, `Zahlung ${eur(e.amount)} erfasst: ${how(e)}`)] }
}

/** Someone checked the confirmation of a transfer that is not in Finanzen yet: the guest may fly, the treasurer assigns the money later. */
export function confirmProof<T extends Voucher | Ticket>(x: T, proof: PayProof, todayIso: string): T {
  const text = `Überweisungsbestätigung geprüft${proof.note ? ` (${proof.note})` : ''}, Eingang in Finanzen noch offen`
  return { ...x, proof, log: [...x.log, { id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: `${todayIso} ${new Date().toTimeString().slice(0, 5)}`, by: proof.by, kind: 'event', text }] }
}
