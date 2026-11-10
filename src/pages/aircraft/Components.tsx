import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { ActionPanel, Badge, Button, Drawer, field, Field, Row, Section } from '../../ui'
import { TODAY_ISO } from '../../state'
import { componentLife, componentName, TBO_PRESETS, type AcComponent, type ComponentType } from './data'
import { dec, dmy, fmt, toneText, UsedBar, useAircraft } from './parts'

const TYPES = Object.keys(TBO_PRESETS) as ComponentType[]
const END_REASONS = ['Überholung extern', 'Defekt', 'Tausch', 'Flugzeug verkauft', 'Sonstiges']
const newId = () => `c-${Date.now()}`

/** Parts with a limited life (engine, propeller ...): hours since installation against the overhaul interval (TBO), and a calendar limit. */
export default function Components({ id }: { id: string }) {
  const { d, mayEdit } = useAircraft(id)
  const [open, setOpen] = useState<AcComponent | 'new' | null>(null)
  const active = d.components.filter((c) => c.state === 'active')
  const gone = d.components.filter((c) => c.state !== 'active')
  return (
    <div className="space-y-4">
      <Section title="Eingebaut" action={mayEdit && <Button onClick={() => setOpen('new')}><Plus size={14} /> Komponente einbauen</Button>}>
        {active.map((c) => {
          const l = componentLife(c, d.hours, TODAY_ISO)
          return (
            <Row key={c.id} onClick={() => setOpen(c)} label={<span className="flex flex-wrap items-center gap-2">{componentName(c)}{c.overhauls > 0 && <Badge>{c.overhauls}× überholt</Badge>}</span>}
              hint={`${c.model}${c.serial ? ` · ${c.serial}` : ''}`}>
              <div className="w-64">
                <div className={`mb-1 text-right text-sm ${toneText[l.tone]}`}>{l.label}</div>
                {l.used !== undefined && <UsedBar used={l.used} tone={l.tone} />}
                {c.tboHours > 0 && <div className="mt-0.5 text-right text-xs text-muted tabular-nums">{fmt(l.usedH, 1)} von {fmt(c.tboHours)} h</div>}
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Row>
          )
        })}
        {active.length === 0 && <p className="px-5 py-4 text-sm text-muted">Noch keine Komponente erfasst.</p>}
      </Section>
      {gone.length > 0 && (
        <Section title="Ausgebaut">
          {gone.map((c) => <Row key={c.id} onClick={() => setOpen(c)} label={componentName(c)} hint={`${c.model}${c.serial ? ` · ${c.serial}` : ''}`}><span className="text-muted">{c.state === 'scrapped' ? 'Verschrottet' : 'Ausgebaut'} {c.endedAt && dmy(c.endedAt)} · {c.endReason}</span></Row>)}
        </Section>
      )}
      {open && <ComponentDrawer id={id} item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

type Act = 'overhaul' | 'remove' | 'scrap'

function ComponentDrawer({ id, item, onClose }: { id: string; item: AcComponent | 'new'; onClose: () => void }) {
  const { d, mayEdit, edit } = useAircraft(id)
  const cur = item === 'new' ? undefined : item
  const readOnly = !mayEdit || (cur !== undefined && cur.state !== 'active')
  const [type, setType] = useState<ComponentType>(cur?.type ?? 'Motor')
  const [position, setPosition] = useState(cur?.position ?? '')
  const [model, setModel] = useState(cur?.model ?? '')
  const [manufacturer, setManufacturer] = useState(cur?.manufacturer ?? '')
  const [serial, setSerial] = useState(cur?.serial ?? '')
  const [part, setPart] = useState(cur?.partNumber ?? '')
  const [tbo, setTbo] = useState(String(cur?.tboHours ?? TBO_PRESETS.Motor))
  const [limit, setLimit] = useState(cur?.calendarLimit ?? '')
  const [installed, setInstalled] = useState(cur?.installedAt ?? TODAY_ISO)
  const [atInstall, setAtInstall] = useState(String(cur?.hoursAtInstall ?? d.hours).replace('.', ','))
  const [offset, setOffset] = useState(String(cur?.hoursOffset ?? 0))
  const [notes, setNotes] = useState(cur?.notes ?? '')
  const [act, setAct] = useState<Act | null>(null)
  const life = cur && cur.state === 'active' ? componentLife(cur, d.hours, TODAY_ISO) : undefined
  const valid = model.trim() !== '' && Number.isFinite(dec(tbo)) && dec(tbo) >= 0 && Number.isFinite(dec(atInstall)) && dec(atInstall) >= 0 && Number.isFinite(dec(offset)) && dec(offset) >= 0 && installed !== ''
  const pickType = (t: ComponentType) => { setType(t); if (!cur) setTbo(String(TBO_PRESETS[t])) }
  const build = (): AcComponent => ({ id: cur?.id ?? newId(), type, position: position.trim() || undefined, model: model.trim(), manufacturer: manufacturer.trim() || undefined, serial: serial.trim() || undefined, partNumber: part.trim() || undefined, tboHours: dec(tbo), installedAt: installed, hoursAtInstall: dec(atInstall), hoursOffset: dec(offset), calendarLimit: limit || undefined, overhauls: cur?.overhauls ?? 0, notes: notes.trim() || undefined, state: 'active' })
  const save = () => { edit((x) => ({ ...x, components: cur ? x.components.map((c) => (c.id === cur.id ? build() : c)) : [...x.components, build()] })); onClose() }
  const history = (text: string, by: string) => ({ id: `h-${Date.now()}`, date: TODAY_ISO, type: text, hours: d.hours, by })

  return (
    <Drawer open title={cur ? componentName(cur) : 'Komponente einbauen'} onClose={onClose}
      footer={readOnly ? undefined : <div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>{cur ? 'Speichern' : 'Einbauen'}</Button></div>}>
      <div className="space-y-5 text-sm">
        {life && (
          <div className="rounded-xl border border-line p-3">
            <div className={`font-medium ${toneText[life.tone]}`}>{life.label}</div>
            {life.used !== undefined && <div className="mt-2"><UsedBar used={life.used} tone={life.tone} /></div>}
            <div className="mt-1 text-xs text-muted tabular-nums">{fmt(life.usedH, 1)} h seit Einbau{cur!.hoursOffset ? ` (davon ${fmt(cur!.hoursOffset)} h Vorbenutzung)` : ''}</div>
          </div>
        )}
        {cur && cur.state !== 'active' && <div className="rounded-xl bg-slate-50 p-3">{cur.state === 'scrapped' ? 'Verschrottet' : 'Ausgebaut'} am {cur.endedAt && dmy(cur.endedAt)}: {cur.endReason}</div>}
        {act && cur && (
          act === 'overhaul' ? <Overhaul c={cur} hours={d.hours} onDone={(date, newTbo, by) => { edit((x) => ({ ...x, components: x.components.map((c) => (c.id === cur.id ? { ...c, installedAt: date, hoursAtInstall: x.hours, hoursOffset: 0, tboHours: newTbo, overhauls: c.overhauls + 1 } : c)), history: [history(`${componentName(cur)} überholt`, by), ...x.history] })); onClose() }} onCancel={() => setAct(null)} /> :
          <Leave scrap={act === 'scrap'} onDone={(date, reason) => { edit((x) => ({ ...x, components: x.components.map((c) => (c.id === cur.id ? { ...c, state: act === 'scrap' ? 'scrapped' : 'removed', endedAt: date, endReason: reason } : c)), history: [history(`${componentName(cur)} ${act === 'scrap' ? 'verschrottet' : 'ausgebaut'}: ${reason}`, ''), ...x.history] })); onClose() }} onCancel={() => setAct(null)} />
        )}
        {!act && cur && !readOnly && <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => setAct('overhaul')}>Überholt buchen</Button><Button onClick={() => setAct('remove')}>Ausbauen</Button><Button variant="danger" className="ml-auto" onClick={() => setAct('scrap')}>Verschrotten</Button></div>}
        <fieldset disabled={readOnly} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Art"><select aria-label="Art" value={type} onChange={(e) => pickType(e.target.value as ComponentType)} className={`${field} w-full`}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Position (optional)"><input aria-label="Position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="z. B. links" className={`${field} w-full`} /></Field>
            <Field label="Modell"><input aria-label="Modell" value={model} onChange={(e) => setModel(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Hersteller"><input aria-label="Hersteller" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Seriennummer"><input aria-label="Seriennummer" value={serial} onChange={(e) => setSerial(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Teilenummer"><input aria-label="Teilenummer" value={part} onChange={(e) => setPart(e.target.value)} className={`${field} w-full`} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Überholintervall (TBO)"><div className="flex items-center gap-2"><input aria-label="TBO in Stunden" inputMode="decimal" value={tbo} onChange={(e) => setTbo(e.target.value)} className={`${field} w-24 text-right tabular-nums`} /><span className="text-muted">h, 0 = keines</span></div></Field>
            <Field label="Kalenderlimit (optional)"><input type="date" aria-label="Kalenderlimit" value={limit} onChange={(e) => setLimit(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Eingebaut am"><input type="date" aria-label="Eingebaut am" max={TODAY_ISO} value={installed} onChange={(e) => setInstalled(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Flugzeugstunden beim Einbau"><div className="flex items-center gap-2"><input aria-label="Flugzeugstunden beim Einbau" inputMode="decimal" value={atInstall} onChange={(e) => setAtInstall(e.target.value)} className={`${field} w-28 text-right tabular-nums`} /><span className="text-muted">h</span></div></Field>
            <Field label="Stunden aus früherem Einsatz"><div className="flex items-center gap-2"><input aria-label="Vorbenutzung" inputMode="decimal" value={offset} onChange={(e) => setOffset(e.target.value)} className={`${field} w-28 text-right tabular-nums`} /><span className="text-muted">h</span></div></Field>
          </div>
          <Field label="Notizen"><textarea aria-label="Notizen" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" /></Field>
        </fieldset>
      </div>
    </Drawer>
  )
}

function Overhaul({ c, hours, onDone, onCancel }: { c: AcComponent; hours: number; onDone: (date: string, tbo: number, by: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(TODAY_ISO)
  const [tbo, setTbo] = useState(String(c.tboHours))
  const [by, setBy] = useState('')
  return (
    <ActionPanel title="Überholt buchen" confirm="Überholung buchen" disabled={!date || !Number.isFinite(dec(tbo)) || by.trim() === ''} onConfirm={() => onDone(date, dec(tbo), by.trim())} onCancel={onCancel}>
      <p className="text-sm text-muted">Die Stunden beginnen bei 0, gezählt ab {fmt(hours, 1)} Flugzeugstunden.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Überholt am"><input type="date" aria-label="Überholt am" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
        <Field label="Neues Intervall (h)"><input aria-label="Neues Intervall" inputMode="decimal" value={tbo} onChange={(e) => setTbo(e.target.value)} className={`${field} w-full`} /></Field>
      </div>
      <Field label="Durchgeführt von"><input aria-label="Durchgeführt von" value={by} onChange={(e) => setBy(e.target.value)} className={`${field} w-full`} /></Field>
    </ActionPanel>
  )
}

function Leave({ scrap, onDone, onCancel }: { scrap: boolean; onDone: (date: string, reason: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(TODAY_ISO)
  const [reason, setReason] = useState('')
  return (
    <ActionPanel danger={scrap} title={scrap ? 'Verschrotten' : 'Ausbauen'} confirm={scrap ? 'Verschrotten' : 'Ausbauen'} disabled={!date || !reason} onConfirm={() => onDone(date, reason)} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum"><input type="date" aria-label="Datum" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
        <Field label="Grund"><select aria-label="Grund" value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} w-full`}><option value="">Grund wählen</option>{END_REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      </div>
    </ActionPanel>
  )
}
