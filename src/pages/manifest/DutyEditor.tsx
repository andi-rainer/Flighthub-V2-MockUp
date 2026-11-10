import { X } from 'lucide-react'
import { useState } from 'react'
import { members } from '../../data'
import { Badge } from '../../ui'
import { dutyGaps, type DutyRole, type DutyShift } from './data'
import DutySelect from './DutySelect'

const hourSel = 'h-10 rounded-lg border border-line bg-surface px-1.5 text-sm outline-none focus:border-brand disabled:bg-slate-50'
const link = 'text-sm font-medium text-brand hover:underline'

function Hour({ value, min, max, onChange, label, disabled }: { value: number; min: number; max: number; onChange: (h: number) => void; label: string; disabled?: boolean }) {
  const hours = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className={hourSel}>{hours.map((h) => <option key={h} value={h}>{h} Uhr</option>)}</select>
}

/**
 * The people of one duty on one day: one row per person with the whole hours they cover. More rows share a duty. "Tausch" hands the duty
 * over at an hour: whoever is on duty then ends there and the new person is on duty from that hour on.
 */
export default function DutyEditor({ role, shifts, hours, onChange, disabled }: { role: DutyRole; shifts: DutyShift[]; hours: { from: number; to: number }; onChange: (s: DutyShift[]) => void; disabled?: boolean }) {
  const [swapping, setSwapping] = useState(false)
  const [at, setAt] = useState(Math.round((hours.from + hours.to) / 2))
  const [inId, setInId] = useState('')
  const [outId, setOutId] = useState('')
  const gaps = dutyGaps({ from: `${String(hours.from).padStart(2, '0')}:00`, to: `${String(hours.to).padStart(2, '0')}:00`, duties: { [role.id]: shifts } }, role)
  const patch = (i: number, p: Partial<DutyShift>) => onChange(shifts.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? '–'
  // Who is on duty at the hour of the swap (usually one person).
  const onDuty = shifts.filter((s) => s.memberId && s.from <= at && at < s.to)
  const out = onDuty.find((s) => s.memberId === outId) ?? onDuty[0]

  const swap = () => {
    if (!inId) return
    if (!out) onChange([...shifts, { memberId: inId, from: at, to: hours.to }])
    else if (out.from === at) onChange(shifts.map((s) => (s === out ? { ...s, memberId: inId } : s)))
    else onChange(shifts.map((s) => (s === out ? { ...s, to: at } : s)).concat({ memberId: inId, from: at, to: out.to }))
    setSwapping(false)
    setInId('')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{role.name}{role.required ? <Badge tone="info">Pflicht{role.min > 1 ? `, mind. ${role.min}` : ''}</Badge> : <span className="text-xs font-normal text-muted">optional</span>}</div>
      {shifts.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <DutySelect role={role} value={s.memberId} disabled={disabled} onChange={(m) => patch(i, { memberId: m })} className="min-w-44 flex-1" />
          <Hour label="von" value={s.from} min={0} max={s.to - 1} disabled={disabled} onChange={(h) => patch(i, { from: h })} />
          <span className="text-xs text-muted">–</span>
          <Hour label="bis" value={s.to} min={s.from + 1} max={24} disabled={disabled} onChange={(h) => patch(i, { to: h })} />
          {!disabled && <button aria-label="Person entfernen" onClick={() => onChange(shifts.filter((_, k) => k !== i))} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-slate-100"><X size={14} /></button>}
        </div>
      ))}
      {!disabled && !swapping && (
        <div className="flex gap-3">
          <button className={link} onClick={() => onChange([...shifts, { memberId: '', from: hours.from, to: hours.to }])}>+ Person</button>
          {shifts.some((s) => s.memberId) && <button className={link} onClick={() => { setOutId(''); setSwapping(true) }}>Tausch</button>}
        </div>
      )}
      {swapping && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-sm">
          <span>Ab</span>
          <Hour label="Wechsel um" value={at} min={hours.from} max={hours.to - 1} onChange={setAt} />
          <span>übernimmt</span>
          <DutySelect role={role} value={inId} onChange={setInId} placeholder="Person wählen" className="min-w-44 flex-1" />
          {onDuty.length > 1 && <><span>statt</span><select aria-label="Wer geht" value={out?.memberId ?? ''} onChange={(e) => setOutId(e.target.value)} className={hourSel}>{onDuty.map((s) => <option key={s.memberId} value={s.memberId}>{name(s.memberId)}</option>)}</select></>}
          <button className={`${link} ml-auto`} disabled={!inId} onClick={swap}>Tauschen</button>
          <button className="text-sm text-muted hover:text-ink" onClick={() => setSwapping(false)}>Abbrechen</button>
        </div>
      )}
      {gaps.length > 0 && <p className="text-xs text-warn">Nicht besetzt: {gaps.map(([f, t]) => `${f}–${t} Uhr`).join(', ')}{role.min > 1 ? ` (mind. ${role.min} Personen)` : ''}</p>}
    </div>
  )
}
