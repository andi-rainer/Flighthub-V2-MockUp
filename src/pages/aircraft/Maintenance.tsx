import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { ActionPanel, Badge, Button, ConfirmDelete, Drawer, field, Field, Row, Section } from '../../ui'
import { TODAY_ISO } from '../../state'
import { addMonthsIso, dueList, type MaintItem } from './data'
import { dec, dmy, fmt, toneText, useAircraft } from './parts'

const newId = () => `m-${Date.now()}`
const interval = (m: MaintItem) => [m.intervalHours ? `alle ${fmt(m.intervalHours)} h` : '', m.intervalMonths ? `alle ${m.intervalMonths} Monate` : ''].filter(Boolean).join(' oder ') || 'einmalig'

/** Recurring maintenance by flight hours and/or date, and the history of what was done. */
export default function Maintenance({ id }: { id: string }) {
  const { d, mayEdit, edit } = useAircraft(id)
  const [open, setOpen] = useState<MaintItem | 'new' | null>(null)
  const [adding, setAdding] = useState(false)
  const due = new Map(dueList(d, TODAY_ISO).filter((x) => x.kind === 'Wartung').map((x) => [x.id, x]))
  return (
    <div className="space-y-4">
      <Section title="Wartungsintervalle" action={mayEdit && <Button onClick={() => setOpen('new')}><Plus size={14} /> Wartung planen</Button>}>
        {[...d.maint].sort((a, b) => (due.get(a.id)?.days ?? 0) - (due.get(b.id)?.days ?? 0)).map((m) => {
          const x = due.get(m.id)
          return (
            <Row key={m.id} onClick={() => setOpen(m)} label={m.name} hint={`${interval(m)}${m.lastDone ? ` · zuletzt ${dmy(m.lastDone)}` : ''}`}>
              {x && <span className={`text-sm ${toneText[x.tone]}`}>{x.label}</span>}
              <ChevronRight size={16} className="text-muted" />
            </Row>
          )
        })}
        {d.maint.length === 0 && <p className="px-5 py-4 text-sm text-muted">Noch keine Wartung geplant.</p>}
      </Section>
      <Section title="Historie" action={mayEdit && <Button onClick={() => setAdding(true)}><Plus size={14} /> Eintrag</Button>}>
        {d.history.map((h) => <Row key={h.id} label={h.type} hint={h.note}><span className="text-muted">{dmy(h.date)} · {fmt(h.hours, 1)} h{h.by ? ` · ${h.by}` : ''}</span></Row>)}
        {d.history.length === 0 && <p className="px-5 py-4 text-sm text-muted">Keine Einträge.</p>}
      </Section>
      {open && <ItemDrawer id={id} item={open} onClose={() => setOpen(null)} />}
      {adding && <RecordDrawer id={id} onClose={() => setAdding(false)} />}
    </div>
  )
}

function ItemDrawer({ id, item, onClose }: { id: string; item: MaintItem | 'new'; onClose: () => void }) {
  const { d, mayEdit, edit } = useAircraft(id)
  const cur = item === 'new' ? undefined : item
  const [name, setName] = useState(cur?.name ?? '')
  const [dueH, setDueH] = useState(cur?.dueHours !== undefined ? String(cur.dueHours).replace('.', ',') : '')
  const [dueD, setDueD] = useState(cur?.dueDate ?? '')
  const [ivH, setIvH] = useState(cur?.intervalHours !== undefined ? String(cur.intervalHours) : '')
  const [ivM, setIvM] = useState(cur?.intervalMonths !== undefined ? String(cur.intervalMonths) : '')
  const [done, setDone] = useState(false)
  const num = (v: string) => (v.trim() === '' ? undefined : dec(v))
  const hasDue = num(dueH) !== undefined || dueD !== ''
  const valid = name.trim() !== '' && hasDue && [dueH, ivH, ivM].every((v) => v.trim() === '' || Number.isFinite(dec(v)))
  const build = (): MaintItem => ({ id: cur?.id ?? newId(), name: name.trim(), dueHours: num(dueH), dueDate: dueD || undefined, intervalHours: num(ivH), intervalMonths: num(ivM), lastDone: cur?.lastDone })
  const save = () => { edit((x) => ({ ...x, maint: cur ? x.maint.map((m) => (m.id === cur.id ? build() : m)) : [...x.maint, build()] })); onClose() }
  return (
    <Drawer open title={cur ? cur.name : 'Wartung planen'} onClose={onClose}
      footer={!mayEdit ? undefined : <div className="flex flex-wrap items-center justify-between gap-2"><div>{cur && <ConfirmDelete what={cur.name} onConfirm={() => { edit((x) => ({ ...x, maint: x.maint.filter((m) => m.id !== cur.id) })); onClose() }} />}</div><div className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>Speichern</Button></div></div>}>
      <div className="space-y-5 text-sm">
        {cur && mayEdit && !done && <Button variant="primary" onClick={() => setDone(true)}>Erledigt buchen</Button>}
        {cur && done && <Done item={cur} hours={d.hours} onCancel={() => setDone(false)} onDone={(date, hours, by, note) => {
          edit((x) => ({ ...x,
            history: [{ id: `h-${Date.now()}`, date, type: cur.name, hours, by, note: note || undefined }, ...x.history],
            maint: x.maint.map((m) => (m.id === cur.id ? { ...m, lastDone: date, dueHours: m.intervalHours ? hours + m.intervalHours : m.dueHours, dueDate: m.intervalMonths ? addMonthsIso(date, m.intervalMonths) : m.dueDate } : m)) }))
          onClose() }} />}
        <fieldset disabled={!mayEdit} className="space-y-4">
          <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-full`} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fällig bei (Flugzeugstunden)"><div className="flex items-center gap-2"><input aria-label="Fällig bei Stunden" inputMode="decimal" value={dueH} onChange={(e) => setDueH(e.target.value)} className={`${field} w-28 text-right tabular-nums`} /><span className="text-muted">h</span></div></Field>
            <Field label="Fällig am"><input type="date" aria-label="Fällig am" value={dueD} onChange={(e) => setDueD(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Wiederholen alle (Stunden)"><div className="flex items-center gap-2"><input aria-label="Intervall Stunden" inputMode="decimal" value={ivH} onChange={(e) => setIvH(e.target.value)} className={`${field} w-28 text-right tabular-nums`} /><span className="text-muted">h</span></div></Field>
            <Field label="Wiederholen alle (Monate)"><div className="flex items-center gap-2"><input aria-label="Intervall Monate" inputMode="numeric" value={ivM} onChange={(e) => setIvM(e.target.value.replace(/\D/g, ''))} className={`${field} w-28 text-right tabular-nums`} /><span className="text-muted">Monate</span></div></Field>
          </div>
          {!hasDue && <p className="text-xs text-bad">Stunden oder Datum angeben, sonst wird nie erinnert.</p>}
        </fieldset>
      </div>
    </Drawer>
  )
}

function Done({ item, hours, onDone, onCancel }: { item: MaintItem; hours: number; onDone: (date: string, hours: number, by: string, note: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(TODAY_ISO)
  const [h, setH] = useState(String(hours).replace('.', ','))
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  return (
    <ActionPanel title={`${item.name} erledigt`} confirm="Erledigt buchen" disabled={!date || !Number.isFinite(dec(h)) || by.trim() === ''} onConfirm={() => onDone(date, dec(h), by.trim(), note.trim())} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum"><input type="date" aria-label="Datum" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
        <Field label="Flugzeugstunden"><input aria-label="Flugzeugstunden" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} className={`${field} w-full`} /></Field>
      </div>
      <Field label="Durchgeführt von"><input aria-label="Durchgeführt von" value={by} onChange={(e) => setBy(e.target.value)} className={`${field} w-full`} /></Field>
      <Field label="Notiz (optional)"><input aria-label="Notiz" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} w-full`} /></Field>
      {(item.intervalHours || item.intervalMonths) && <div className="text-sm text-muted">Nächste Fälligkeit: {item.intervalHours ? `${fmt(dec(h) + item.intervalHours, 1)} h` : ''}{item.intervalHours && item.intervalMonths ? ' oder ' : ''}{item.intervalMonths ? dmy(addMonthsIso(date, item.intervalMonths)) : ''}</div>}
    </ActionPanel>
  )
}

/** A maintenance that was done without a planned interval (repair, one-off check). */
function RecordDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, edit } = useAircraft(id)
  const [type, setType] = useState('')
  const [date, setDate] = useState(TODAY_ISO)
  const [h, setH] = useState(String(d.hours).replace('.', ','))
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  const valid = type.trim() !== '' && date !== '' && Number.isFinite(dec(h))
  return (
    <Drawer open title="Wartung eintragen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => { edit((x) => ({ ...x, history: [{ id: `h-${Date.now()}`, date, type: type.trim(), hours: dec(h), by: by.trim(), note: note.trim() || undefined }, ...x.history] })); onClose() }}>Eintragen</Button></div>}>
      <div className="space-y-4 text-sm">
        <Field label="Was wurde gemacht?"><input aria-label="Was wurde gemacht" value={type} onChange={(e) => setType(e.target.value)} className={`${field} w-full`} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Datum"><input type="date" aria-label="Datum" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Flugzeugstunden"><input aria-label="Flugzeugstunden" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} className={`${field} w-full`} /></Field>
        </div>
        <Field label="Durchgeführt von"><input aria-label="Durchgeführt von" value={by} onChange={(e) => setBy(e.target.value)} className={`${field} w-full`} /></Field>
        <Field label="Notiz"><textarea aria-label="Notiz" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" /></Field>
      </div>
    </Drawer>
  )
}
