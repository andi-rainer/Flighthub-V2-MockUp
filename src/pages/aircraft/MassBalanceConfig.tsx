import { ChevronRight, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, ConfirmDelete, Drawer, field, Field, Row, Section } from '../../ui'
import { useApp } from '../../state'
import { Chart } from './Envelope'
import type { Station } from './data'
import { dec, DecField, fmt, UnitField, useAircraft } from './parts'
import type { FuelUnit, LengthUnit, MassUnit } from './units'
import PaxThresholds from './PaxThresholds'

/**
 * The data behind the mass and balance calculation of one aircraft: empty mass and CG, limits, the envelope from the AFM and the loading
 * stations. Everybody can calculate (the tool), only people with `aircraft.edit` change these data.
 */
export default function MassBalanceConfig({ id }: { id: string }) {
  const { ac, d, mayEdit, edit, c } = useAircraft(id)
  const { modules } = useApp()
  const [station, setStation] = useState<Station | 'new' | null>(null)
  const env = d.envelope
  const setPoint = (i: number, k: 0 | 1, v: number) => edit((x) => ({ ...x, envelope: x.envelope?.map((p, j) => (j === i ? (k === 0 ? [v, p[1]] : [p[0], v]) : p) as [number, number]) }))
  const addPoint = () => edit((x) => ({ ...x, envelope: [...(x.envelope ?? []), x.envelope?.[x.envelope.length - 1] ?? [x.emptyArm, x.emptyKg]] }))
  const dropPoint = (i: number) => edit((x) => ({ ...x, envelope: x.envelope?.filter((_, j) => j !== i) }))
  const startEnvelope = () => edit((x) => ({ ...x, envelope: [[x.emptyArm - 0.2, x.emptyKg], [x.emptyArm - 0.2, x.mtow], [x.emptyArm + 0.2, x.mtow], [x.emptyArm + 0.2, x.emptyKg]] }))
  const ready = d.emptyKg > 0

  return (
    <div className="space-y-4">
      <Section title="Einheiten">
        <Row label="Masse"><select aria-label="Masseneinheit" value={d.units.mass} disabled={!mayEdit} onChange={(e) => edit((x) => ({ ...x, units: { ...x.units, mass: e.target.value as MassUnit } }))} className={`${field} w-44`}><option value="kg">Kilogramm (kg)</option><option value="lb">Pfund (lb)</option></select></Row>
        <Row label="Hebelarm und Länge"><select aria-label="Längeneinheit" value={d.units.length} disabled={!mayEdit} onChange={(e) => edit((x) => ({ ...x, units: { ...x.units, length: e.target.value as LengthUnit } }))} className={`${field} w-44`}><option value="m">Meter (m)</option><option value="in">Zoll (in)</option></select></Row>
        <Row label="Treibstoff"><select aria-label="Treibstoffeinheit" value={d.units.fuel} disabled={!mayEdit} onChange={(e) => edit((x) => ({ ...x, units: { ...x.units, fuel: e.target.value as FuelUnit } }))} className={`${field} w-44`}><option value="L">Liter (L)</option><option value="gal">US-Gallonen (US gal)</option></select></Row>
      </Section>

      <Section title="Grunddaten" action={<Link to={`/flugzeuge/${ac.id}/rechner`} className="text-sm font-medium text-brand hover:underline">Zum Rechner</Link>}>
        <Row label="Leermasse" hint="aus dem Wägebericht"><UnitField q="mass" c={c} label="Leermasse" value={d.emptyKg} disabled={!mayEdit} onSave={(n) => edit((x) => ({ ...x, emptyKg: n }))} /></Row>
        <Row label="Leerschwerpunkt" hint="Hebelarm hinter der Bezugsebene"><UnitField q="length" c={c} label="Leerschwerpunkt" value={d.emptyArm} disabled={!mayEdit} onSave={(n) => edit((x) => ({ ...x, emptyArm: n }))} /></Row>
        <Row label="Höchstabflugmasse (MTOM)"><UnitField q="mass" c={c} label="MTOM" value={d.mtow} disabled={!mayEdit} onSave={(n) => edit((x) => ({ ...x, mtow: n }))} /></Row>
        <Row label="Maximaler Treibstoff"><UnitField q="fuel" c={c} label="Maximaler Treibstoff" value={d.maxFuelL} disabled={!mayEdit} onSave={(n) => edit((x) => ({ ...x, maxFuelL: n }))} /></Row>
        <Row label="Treibstoffverbrauch"><UnitField q="fuel" perHour c={c} label="Verbrauch" value={d.burnLph} disabled={!mayEdit} onSave={(n) => edit((x) => ({ ...x, burnLph: n }))} /></Row>
      </Section>

      <Section title="Schwerpunktgrenzen (Envelope aus dem AFM)" action={mayEdit && env && <Button onClick={addPoint}><Plus size={14} /> Punkt</Button>}>
        {env ? (
          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_28px] gap-2 text-xs text-muted"><span>Hebelarm ({c.lengthUnit})</span><span>Masse ({c.massUnit})</span><span /></div>
              {env.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
                  <DecField label={`Punkt ${i + 1} Hebelarm`} value={c.length(p[0])} width="w-full" disabled={!mayEdit} onSave={(n) => setPoint(i, 0, c.toM(n))} />
                  <DecField label={`Punkt ${i + 1} Masse`} value={c.mass(p[1])} width="w-full" disabled={!mayEdit} onSave={(n) => setPoint(i, 1, c.toKg(n))} />
                  {mayEdit && env.length > 3 ? <button aria-label={`Punkt ${i + 1} entfernen`} onClick={() => dropPoint(i)} className="grid h-8 w-7 place-items-center rounded-md text-muted hover:bg-slate-100"><X size={14} /></button> : <span />}
                </div>
              ))}
              <p className="pt-1 text-xs text-muted">Die Punkte laufen der Reihe nach um den zulässigen Bereich.</p>
            </div>
            <Chart c={c} env={env} mtow={d.mtow} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"><span className="text-muted">{ready ? 'Noch keine Schwerpunktgrenzen erfasst.' : 'Erst Leermasse, Leerschwerpunkt und MTOM eintragen.'}</span>{mayEdit && <Button variant="primary" disabled={!ready || d.mtow <= d.emptyKg} onClick={startEnvelope}>Envelope anlegen</Button>}</div>
        )}
      </Section>

      <Section title="Beladestationen" action={mayEdit && <Button onClick={() => setStation('new')}><Plus size={14} /> Station</Button>}>
        {(d.stations ?? []).map((s) => (
          <Row key={s.id} onClick={() => setStation(s)} label={<span className="flex items-center gap-2">{s.name}{s.unit === 'L' && <Badge>Treibstoff</Badge>}</span>} hint={`Hebelarm ${c.lengthText(s.arm, 2)}${s.max ? ` · max. ${s.unit === 'L' ? c.fuelText(s.max) : c.massText(s.max)}` : ''}${s.density ? ` · ${fmt(s.density, 2)} kg/L` : ''}`}>
            <ChevronRight size={16} className="text-muted" />
          </Row>
        ))}
        {(d.stations ?? []).length === 0 && <p className="px-5 py-4 text-sm text-muted">Noch keine Station erfasst.</p>}
      </Section>

      {ac.uses.includes('Sprung') && modules.skydive && <PaxThresholds key={d.units.mass} id={ac.id} />}
      {station && <StationDrawer id={id} item={station} onClose={() => setStation(null)} />}
    </div>
  )
}

function StationDrawer({ id, item, onClose }: { id: string; item: Station | 'new'; onClose: () => void }) {
  const { d, mayEdit, edit, c } = useAircraft(id)
  const cur = item === 'new' ? undefined : item
  const [name, setName] = useState(cur?.name ?? '')
  const [unit, setUnit] = useState<'kg' | 'L'>(cur?.unit ?? 'kg')
  // Typed and shown in the units of the aircraft, stored metric.
  const show = (n: number, u: 'kg' | 'L') => String(u === 'L' ? c.fuel(n) : c.mass(n)).replace('.', ',')
  const [arm, setArm] = useState(cur ? String(c.length(cur.arm)).replace('.', ',') : '')
  const [max, setMax] = useState(cur?.max !== undefined ? show(cur.max, cur.unit) : '')
  const [def, setDef] = useState(cur ? show(cur.def, cur.unit) : '0')
  const [density, setDensity] = useState(String(cur?.density ?? 0.72).replace('.', ','))
  const num = (v: string) => dec(v)
  const valid = name.trim() !== '' && Number.isFinite(num(arm)) && arm.trim() !== '' && (max.trim() === '' || Number.isFinite(num(max))) && Number.isFinite(num(def)) && (unit === 'kg' || num(density) > 0)
  const store = (n: number) => (unit === 'L' ? c.toL(n) : c.toKg(n))
  const build = (): Station => ({ id: cur?.id ?? `st-${Date.now()}`, name: name.trim(), arm: c.toM(num(arm)), max: max.trim() === '' ? undefined : store(num(max)), unit, def: store(num(def)), density: unit === 'L' ? num(density) : undefined })
  const save = () => { edit((x) => ({ ...x, stations: cur ? (x.stations ?? []).map((s) => (s.id === cur.id ? build() : s)) : [...(x.stations ?? []), build()] })); onClose() }
  return (
    <Drawer open title={cur ? cur.name : 'Neue Station'} onClose={onClose}
      footer={!mayEdit ? undefined : <div className="flex flex-wrap items-center justify-between gap-2"><div>{cur && <ConfirmDelete what={cur.name} onConfirm={() => { edit((x) => ({ ...x, stations: (x.stations ?? []).filter((s) => s.id !== cur.id) })); onClose() }} />}</div><div className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>Speichern</Button></div></div>}>
      <fieldset disabled={!mayEdit} className="space-y-4 text-sm">
        <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-full`} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Art"><select aria-label="Art" value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'L')} className={`${field} w-full`}><option value="kg">Last ({c.massUnit})</option><option value="L">Treibstoff ({c.fuelUnit})</option></select></Field>
          <Field label={`Hebelarm (${c.lengthUnit})`}><input aria-label="Hebelarm" inputMode="decimal" value={arm} onChange={(e) => setArm(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          <Field label={`Höchstmenge (${unit === 'L' ? c.fuelUnit : c.massUnit})`}><input aria-label="Höchstmenge" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          <Field label={`Vorgabe im Rechner (${unit === 'L' ? c.fuelUnit : c.massUnit})`}><input aria-label="Vorgabe" inputMode="decimal" value={def} onChange={(e) => setDef(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          {unit === 'L' && <Field label="Dichte (kg/L)"><input aria-label="Dichte" inputMode="decimal" value={density} onChange={(e) => setDensity(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>}
        </div>
        {d.stations?.some((s) => s.unit === 'L' && s.id !== cur?.id) && unit === 'L' && <p className="text-xs text-bad">Es gibt schon eine Treibstoffstation. Der Rechner verwendet die erste.</p>}
      </fieldset>
    </Drawer>
  )
}
