import { TODAY_ISO, useApp } from '../../state'
import { notFlownLog } from '../tickets/data'
import { newLog, useActor } from '../tickets/parts'
import { byTime, dayName, windowLabel, type ManifestDay, type TandemBooking } from './data'
import { guestPay } from './payState'

/** [Entwurf] Why a tandem is moved: the same three everywhere (side panel of the day, closing, "Alle verschieben"). Sonstiges needs own words. */
export const POSTPONE_REASONS = ['Wetter', 'Technik', 'Sonstiges'] as const
export type PostponeReason = (typeof POSTPONE_REASONS)[number]
export const reasonReady = (r?: PostponeReason, note?: string) => !!r && (r !== 'Sonstiges' || (note ?? '').trim().length > 0)
export const reasonText = (r?: PostponeReason, note?: string) => (r === 'Sonstiges' ? note?.trim() || 'Sonstiges' : r)

/** Open windows on later planned days with a free place for this guest (a voucher only up to its end). `taken` adds places already promised. */
export function postponeSlots(o: { days: ManifestDay[]; bookings: TandemBooking[]; day: ManifestDay; booking: TandemBooking; validUntil?: string; taken?: (dayId: string, windowId: string) => number; keep?: string }) {
  const used = (dId: string, wId: string) => o.bookings.filter((b) => b.dayId === dId && b.windowId === wId && b.state === 'gebucht' && b.id !== o.booking.id).length + (o.taken?.(dId, wId) ?? 0)
  return o.days.filter((d) => d.status === 'geplant' && d.date > o.day.date && (!o.validUntil || d.date <= o.validUntil)).sort((a, c) => a.date.localeCompare(c.date))
    .flatMap((d) => byTime(d.windows).filter((w) => w.open).map((w) => ({ key: `${d.id}|${w.id}`, label: `${dayName(d.date).slice(0, 9)} · ${windowLabel(w)}`, free: w.capacity - used(d.id, w.id) })))
    .filter((s) => s.free > 0 || s.key === o.keep).slice(0, 6)
}

/**
 * [Entwurf] One tandem guest leaves the day from the side panel: "Verschieben" (ticket or voucher stays valid, new date or Termin offen) or
 * "Nicht erschienen" (it expires). Same effect as the decision at the closing: booking, voucher or ticket history and the mail.
 */
export function useGuestOutcome(day: ManifestDay) {
  const { days, vouchers, tickets, setBookings, setLoads, setVouchers, setTickets } = useApp()
  const actor = useActor()
  return (b: TandemBooking, outcome: 'verschoben' | 'nicht_erschienen', reason?: string, slot?: string) => {
    const g = guestPay(b, vouchers, tickets)
    const [dId, wId] = slot?.split('|') ?? []
    const nd = days.find((d) => d.id === dId), w = nd?.windows.find((x) => x.id === wId)
    const newDate = nd && w ? `${dayName(nd.date)} · ${windowLabel(w)}` : undefined
    const logs = (what: 'Gutschein' | 'Ticket') => [
      newLog(TODAY_ISO, actor, notFlownLog({ what, dayIso: day.date, outcome, reason, newDate, paid: g.item?.paid })),
      newLog(TODAY_ISO, 'System', outcome === 'verschoben' ? `Mail „${newDate ? 'Neuer Termin' : 'Tandem verschoben'}“ an ${b.email ?? 'Käufer'} gesendet` : `Mail „Storniert ohne Erstattung“ an ${b.email ?? 'Käufer'} gesendet`),
    ]
    setBookings((all) => all.map((x) => {
      if (x.id !== b.id) return x
      if (outcome === 'nicht_erschienen') return { ...x, state: 'nicht_erschienen' }
      return nd && w ? { ...x, dayId: nd.id, windowId: w.id, checkin: undefined, masterId: undefined } : { ...x, state: 'verschoben', checkin: undefined }
    }))
    setLoads((ls) => ls.map((l) => (l.dayId === day.id && l.status !== 'gelandet' ? { ...l, jumpers: l.jumpers.filter((j) => j.bookingId !== b.id) } : l)))
    if (g.what === 'Gutschein') setVouchers((all) => all.map((v) => {
      if (v.code !== g.code) return v
      const patch = outcome === 'nicht_erschienen' ? { status: 'redeemed_noshow' as const } : nd ? {} : { bookingId: undefined, status: v.paid ? 'active' as const : 'unpaid' as const }
      return { ...v, ...patch, log: [...v.log, ...logs('Gutschein')] }
    }))
    if (g.what === 'Ticket') setTickets((all) => all.map((t) => {
      if (t.code !== g.code) return t
      const patch = outcome === 'nicht_erschienen' ? { status: 'noshow' as const } : nd && w ? { day: nd.date, windowLabel: windowLabel(w) } : {}
      return { ...t, ...patch, log: [...t.log, ...logs('Ticket')] }
    }))
  }
}
