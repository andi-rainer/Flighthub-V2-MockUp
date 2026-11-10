import { useApp } from '../../state'
import { dayName, windowLabel, type TandemBooking } from '../manifest/data'
import { field, Field } from './parts'

/** What the staff does to a guest here reaches the manifest: the booking there is the single source for day, window and state. */
export function useManifestSync() {
  const { setBookings, setLoads } = useApp()
  const unplan = (id: string) => setLoads((ls) => ls.map((l) => (l.status === 'geplant' ? { ...l, jumpers: l.jumpers.filter((j) => j.bookingId !== id) } : l)))
  const patch = (id: string, p: Partial<TandemBooking>) => setBookings((all) => all.map((b) => (b.id === id ? { ...b, ...p } : b)))
  return {
    add: (b: TandemBooking) => setBookings((all) => [...all, b]),
    /** Moves the guest to another window; a place on a flight of the old day is given up. */
    move: (id: string, dayId: string, windowId: string) => { unplan(id); patch(id, { dayId, windowId }) },
    cancel: (id: string) => { unplan(id); patch(id, { state: 'storniert' }) },
    reinstate: (id: string) => patch(id, { state: 'gebucht' }),
  }
}

export interface Slot { dayId: string; windowId: string }

/** Day and window for a booking: only days that are still ahead (or running), only windows with a free place. */
export function SlotPicker({ value, onChange, maxIso, selfId }: { value: Slot; onChange: (s: Slot) => void; maxIso?: string; selfId?: string }) {
  const { days, bookings } = useApp()
  const open = days.filter((d) => (d.status === 'geplant' || d.status === 'aktiv') && (!maxIso || d.date <= maxIso)).sort((a, b) => a.date.localeCompare(b.date))
  const day = open.find((d) => d.id === value.dayId)
  const free = (windowId: string, capacity: number) => capacity - bookings.filter((b) => b.dayId === value.dayId && b.windowId === windowId && b.state === 'gebucht' && b.id !== selfId).length
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Sprungtag">
        <select aria-label="Sprungtag" value={value.dayId} onChange={(e) => onChange({ dayId: e.target.value, windowId: '' })} className={`${field} w-full`}>
          <option value="">Tag wählen</option>
          {open.map((d) => <option key={d.id} value={d.id}>{dayName(d.date)}{d.status === 'aktiv' ? ' (läuft)' : ''}</option>)}
        </select>
      </Field>
      <Field label="Zeitfenster">
        <select aria-label="Zeitfenster" value={value.windowId} disabled={!day} onChange={(e) => onChange({ ...value, windowId: e.target.value })} className={`${field} w-full`}>
          <option value="">Fenster wählen</option>
          {day?.windows.map((w) => <option key={w.id} value={w.id} disabled={free(w.id, w.capacity) <= 0}>{windowLabel(w)} · {Math.max(0, free(w.id, w.capacity))} frei</option>)}
        </select>
      </Field>
    </div>
  )
}

export const NO_SLOT: Slot = { dayId: '', windowId: '' }
