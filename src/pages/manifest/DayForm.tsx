import { Minus, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { aircraft } from '../../data'
import { toAbs } from '../../dates'
import { TODAY_ISO, useApp } from '../../state'
import { Banner, Button, Drawer, Segmented } from '../../ui'
import { byTime, dayId, dayName, minutes, newWindowId, perFlight, splitWindows, windowValid, dayHours, type DutyShift, type ManifestDay, type TandemWindow } from './data'
import { groundedReason } from '../aircraft/data'
import DutyFields from './DutyFields'

const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
const label = 'mb-1 block text-sm font-medium'
const small = 'h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand'

/**
 * Create or edit a manifest day. The tandem offer is part of the day: with windows the shop shows them, without windows the day is
 * for sport jumpers only and nothing is bookable. Every window has its own times and its own number of tandems, so a day can have
 * two long windows of 6 tandems or many short ones. Creating a day reserves the aircraft with priority (pilot reservations go to standby).
 */
export default function DayForm({ open, day, onClose, onSaved }: { open: boolean; day?: ManifestDay; onClose: () => void; onSaved?: (d: ManifestDay) => void }) {
  const { days, setDays, bookings, reservations, setReservations, settings, aircraftData } = useApp()
  const [date, setDate] = useState(day?.date ?? '')
  const [reg, setReg] = useState(day?.aircraft ?? 'OE-DZA')
  const [from, setFrom] = useState(day?.from ?? settings.from)
  const [to, setTo] = useState(day?.to ?? settings.to)
  const [tandem, setTandem] = useState<'aus' | 'fenster'>(day ? (day.windows.length > 0 ? 'fenster' : 'aus') : 'fenster')
  const [windows, setWindows] = useState<TandemWindow[]>(day?.windows ?? splitWindows('10:00', '16:00', 2, 6))
  const [duties, setDuties] = useState<Record<string, DutyShift[]>>(day?.duties ?? {})
  const [note, setNote] = useState(day?.note ?? '')
  const [splitting, setSplitting] = useState(false)
  const [sFrom, setSFrom] = useState('10:00'), [sTo, setSTo] = useState('16:00'), [sCount, setSCount] = useState(3), [sCap, setSCap] = useState(4)

  const taken = days.some((d) => d.date === date && d.id !== day?.id && d.status !== 'abgesagt')
  const booked = (w: TandemWindow) => bookings.filter((b) => b.windowId === w.id && b.state === 'gebucht').length
  const per = perFlight(reg)
  const sorted = byTime(windows)
  const overlap = sorted.some((w, i) => i > 0 && minutes(w.from) < minutes(sorted[i - 1].to))
  const clash = useMemo(() => {
    if (!date || day) return 0
    const f = toAbs(date, from), t = toAbs(date, to)
    return reservations.filter((r) => r.aircraft === reg && !r.priority && !r.standby && r.from < t && r.to > f).length
  }, [date, from, to, reg, day, reservations])
  const valid = !!date && date >= TODAY_ISO && !taken && minutes(to) > minutes(from) && (tandem === 'aus' || (windows.length > 0 && windows.every(windowValid)))

  const patch = (id: string, p: Partial<TandemWindow>) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)))
  const addWindow = () => {
    const last = sorted[sorted.length - 1]
    const len = last ? minutes(last.to) - minutes(last.from) : 120
    const start = last ? minutes(last.to) : minutes('10:00')
    const h = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    setWindows((ws) => [...ws, { id: newWindowId(), from: h(start), to: h(start + len), capacity: last?.capacity ?? 4, open: true }])
  }

  const save = () => {
    const next: ManifestDay = { id: day?.id ?? dayId(date), date, aircraft: reg, from, to, status: day?.status ?? 'geplant', duties, windows: tandem === 'aus' ? [] : byTime(windows), note: note.trim() || undefined }
    if (day) setDays((all) => all.map((d) => (d.id === day.id ? next : d)))
    else {
      setDays((all) => [...all, next].sort((a, b) => a.date.localeCompare(b.date)))
      // The aircraft is reserved for the day with priority; pilot reservations that overlap become standby.
      const f = toAbs(date, from), t = toAbs(date, to)
      setReservations([
        ...reservations.map((r) => (r.aircraft === reg && !r.priority && r.from < t && r.to > f ? { ...r, standby: true } : r)),
        { id: Math.max(0, ...reservations.map((r) => r.id)) + 1, aircraft: reg, from: f, to: t, who: 'Sprungbetrieb', label: 'Sprungtag', priority: true },
      ])
    }
    onSaved?.(next)
    onClose()
  }

  return (
    <Drawer open={open} title={day ? `Tag bearbeiten · ${dayName(day.date)}` : 'Neuer Manifest-Tag'} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>{day ? 'Speichern' : 'Tag anlegen'}</Button></div>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={label}>Datum</span><input type="date" min={TODAY_ISO} value={date} disabled={!!day} onChange={(e) => setDate(e.target.value)} className={field} /></label>
          <label className="block"><span className={label}>Flugzeug</span>
            <select value={reg} onChange={(e) => setReg(e.target.value)} className={field}>
              {aircraft.filter((a) => a.uses.includes('Sprung')).map((a) => <option key={a.id} value={a.reg} disabled={!!groundedReason(a.status, aircraftData[a.id], TODAY_ISO)}>{a.reg}{groundedReason(a.status, aircraftData[a.id], TODAY_ISO) ? ` (${groundedReason(a.status, aircraftData[a.id], TODAY_ISO)})` : ''}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Betrieb von</span><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} /></label>
          <label className="block"><span className={label}>Betrieb bis</span><input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} /></label>
        </div>
        {taken && <Banner tone="warn">Für dieses Datum gibt es schon einen Manifest-Tag.</Banner>}
        {clash > 0 && <Banner>{clash === 1 ? 'Eine Pilotenreservierung überschneidet' : `${clash} Pilotenreservierungen überschneiden`} sich mit dem Tag und {clash === 1 ? 'kommt' : 'kommen'} auf Standby.</Banner>}

        <div>
          <span className={label}>Tandems</span>
          <Segmented value={tandem} onChange={setTandem} options={[{ value: 'fenster', label: 'Mit Zeitfenstern' }, { value: 'aus', label: 'Ohne Tandems' }]} />
        </div>

        {tandem === 'fenster' && (
          <div className="space-y-3">
            <ul className="divide-y divide-line rounded-xl border border-line">
              {sorted.map((w) => (
                <li key={w.id} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="time" aria-label="Fenster von" value={w.from} onChange={(e) => patch(w.id, { from: e.target.value })} className={`${small} w-28`} />
                    <span className="text-muted">bis</span>
                    <input type="time" aria-label="Fenster bis" value={w.to} onChange={(e) => patch(w.id, { to: e.target.value })} className={`${small} w-28`} />
                    <span className="ml-auto inline-flex items-center gap-2">
                      <Stepper value={w.capacity} min={Math.max(1, booked(w))} onChange={(c) => patch(w.id, { capacity: c })} />
                      <span className="text-sm text-muted">Tandems</span>
                    </span>
                    <button aria-label="Fenster entfernen" disabled={booked(w) > 0} title={booked(w) > 0 ? 'Es gibt Buchungen in diesem Fenster' : undefined} onClick={() => setWindows((ws) => ws.filter((x) => x.id !== w.id))} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-slate-100 disabled:opacity-30"><X size={14} /></button>
                  </div>
                  <div className="text-xs text-muted">
                    {windowValid(w) ? `${w.capacity} Tandems = ${Math.ceil(w.capacity / per)} ${Math.ceil(w.capacity / per) === 1 ? 'Flug' : 'Flüge'} (${per} Tandems je Flug)` : <span className="text-bad">Das Ende muss nach dem Beginn liegen.</span>}
                  </div>
                </li>
              ))}
              {windows.length === 0 && <li className="px-3 py-3 text-sm text-muted">Kein Fenster. Mit „Fenster“ eines hinzufügen.</li>}
            </ul>
            {overlap && <Banner tone="warn">Zwei Fenster überschneiden sich.</Banner>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={addWindow}><Plus size={14} /> Fenster</Button>
              <Button variant="ghost" onClick={() => setSplitting((v) => !v)}>Gleichmäßig aufteilen</Button>
            </div>
            {splitting && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">Von<input type="time" value={sFrom} onChange={(e) => setSFrom(e.target.value)} className={field} /></label>
                  <label className="block text-sm font-medium">Bis<input type="time" value={sTo} onChange={(e) => setSTo(e.target.value)} className={field} /></label>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-2">Fenster <Stepper value={sCount} onChange={setSCount} /></span>
                  <span className="inline-flex items-center gap-2">Tandems je Fenster <Stepper value={sCap} onChange={setSCap} /></span>
                </div>
                <Button disabled={minutes(sTo) <= minutes(sFrom)} onClick={() => { setWindows(splitWindows(sFrom, sTo, sCount, sCap)); setSplitting(false) }}>Fenster ersetzen</Button>
              </div>
            )}
          </div>
        )}

        {settings.roles.length > 0 && <div><span className={label}>Dienste</span><DutyFields roles={settings.roles} duties={duties} hours={dayHours({ from, to })} onChange={(r, s) => setDuties((d) => { const next = { ...d }; if (s.length > 0) next[r] = s; else delete next[r]; return next })} /></div>}

        <label className="block"><span className={label}>Notiz (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} className={field} /></label>
      </div>
    </Drawer>
  )
}

function Stepper({ value, min = 1, onChange }: { value: number; min?: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-lg border border-line bg-surface">
      <button aria-label="Weniger" disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-9 w-9 place-items-center hover:bg-slate-50 disabled:opacity-30"><Minus size={14} /></button>
      <span className="w-8 text-center text-sm font-medium tabular-nums">{value}</span>
      <button aria-label="Mehr" onClick={() => onChange(value + 1)} className="grid h-9 w-9 place-items-center hover:bg-slate-50"><Plus size={14} /></button>
    </span>
  )
}
