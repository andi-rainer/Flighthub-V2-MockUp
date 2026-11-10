import type { Ticket, Voucher } from '../tickets/data'
import type { TandemBooking } from './data'

/**
 * Where the money of a tandem guest stands, read from the voucher or ticket behind the booking (single source of truth):
 * paid, an Überweisung whose confirmation was checked but is not in Finanzen yet (`nachweis`), an Überweisung still open (`offen`, stops
 * boarding until it is cleared) or money collected on site at the closing (`vor_ort`).
 */
export type GuestPayState = 'bezahlt' | 'nachweis' | 'offen' | 'vor_ort'
export interface GuestPay { state: GuestPayState; what?: 'Gutschein' | 'Ticket'; code?: string; item?: Voucher | Ticket }
export const GUEST_PAY: Record<GuestPayState, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  bezahlt: { label: 'Bezahlt', tone: 'ok' },
  nachweis: { label: 'Nachweis geprüft', tone: 'warn' },
  offen: { label: 'Zahlung offen', tone: 'bad' },
  vor_ort: { label: 'Zahlt vor Ort', tone: 'neutral' },
}

export function guestPay(b: TandemBooking, vouchers: Voucher[], tickets: Ticket[]): GuestPay {
  const voucher = vouchers.find((v) => v.bookingId === b.id || (!!b.voucher && v.code === b.voucher))
  const ticket = tickets.find((t) => t.bookingId === b.id)
  const item = voucher ?? ticket
  const what = voucher ? 'Gutschein' as const : ticket ? 'Ticket' as const : undefined
  const code = item?.code ?? b.voucher
  if (!item) return { state: b.paidOnline ? 'bezahlt' : 'vor_ort', code }
  if (item.paid) return { state: 'bezahlt', what, code, item }
  if (item.proof) return { state: 'nachweis', what, code, item }
  return { state: item.pay === 'cash' ? 'vor_ort' : 'offen', what, code, item }
}
