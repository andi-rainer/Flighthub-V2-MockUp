import { members, type Member } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp } from '../../state'
import { Badge } from '../../ui'
import type { TandemBooking } from './data'

/** "Clara W." */
export const masterShort = (id?: string) => {
  const m = members.find((x) => x.id === id)
  if (!m) return undefined
  const [first, ...rest] = m.name.split(' ')
  return rest.length > 0 ? `${first} ${rest[rest.length - 1][0]}.` : first
}

/**
 * The tandem master of one guest, chosen wherever the guest is shown (waiting list, bookings, flight). The choice is stored on the booking,
 * so it is the same everywhere and survives moving the guest between flights. Only people with the capability `manifest.tandem.master` are
 * offered, the ones with the fewest tandems today first; a master who already flies another guest on the SAME flight is not offered again.
 * Read only for people who cannot assign, on closed days and once the flight has left.
 */
export function MasterPick({ booking, onPicked, className }: { booking: TandemBooking; onPicked?: () => void; className?: string }) {
  const { bookings, setBookings, loads, days, can, memberCan } = useApp()
  const day = days.find((d) => d.id === booking.dayId)
  const load = loads.find((l) => l.jumpers.some((j) => j.bookingId === booking.id))
  const locked = !can('manifest.jumpers.assign') || !(day?.status === 'geplant' || day?.status === 'aktiv') || load?.status === 'in_air' || load?.status === 'gelandet'
  const today = (id: string) => bookings.filter((b) => b.dayId === booking.dayId && b.state === 'gebucht' && b.masterId === id).length
  const takenOnFlight = (id: string) => !!load && load.jumpers.some((j) => j.bookingId !== booking.id && j.kind === 'tandem' && bookings.find((b) => b.id === j.bookingId)?.masterId === id)
  const allow = (m: Member) => m.id === booking.masterId || (memberCan(m.id, 'manifest.tandem.master') && !takenOnFlight(m.id))
  if (locked) return booking.masterId ? <span className={className}>{members.find((m) => m.id === booking.masterId)?.name}</span> : <Badge tone="warn">Master fehlt</Badge>
  return (
    <MemberPicker ariaLabel="Tandemmaster" className={className} value={booking.masterId} placeholder="Tandemmaster wählen" clearable
      onChange={(id) => { setBookings((all) => all.map((b) => (b.id === booking.id ? { ...b, masterId: id || undefined } : b))); onPicked?.() }}
      allow={allow} rank={(m) => today(m.id)} rankHint="Wenigste Tandems heute zuerst" info={(m) => `${today(m.id)} heute`} />
  )
}
