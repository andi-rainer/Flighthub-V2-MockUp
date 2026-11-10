import { X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eur, fixedCostsYear, sparten, varPerMinute } from '../../data'
import { areaOn } from '../../modules'
import { useApp } from '../../state'
import { Badge, Row, Section, field } from '../../ui'
import { useAircraft } from './parts'

/** A text that is saved when the field is left. */
function TextField({ value, label, onSave, disabled }: { value: string; label: string; onSave: (v: string) => void; disabled?: boolean }) {
  const [v, setV] = useState(value)
  return <input aria-label={label} disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => (v.trim() && v !== value ? onSave(v.trim()) : setV(value))} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={`${field} w-64 disabled:bg-slate-50`} />
}

/** Master data of the aircraft: type, fuel, equipment. Hours come from the logbook. */
export function MasterData({ id }: { id: string }) {
  const { ac, d, mayEdit, edit } = useAircraft(id)
  const [item, setItem] = useState('')
  const add = () => { if (item.trim()) { edit((x) => ({ ...x, equipment: [...x.equipment, item.trim()] })); setItem('') } }
  return (
    <Section title="Stammdaten">
      <Row label="Kennzeichen">{ac.reg}</Row>
      <Row label="Typ">{ac.type}</Row>
      <Row label="Einsatz">{ac.uses.map((u) => <Badge key={u} tone="info">{u}</Badge>)}</Row>
      <Row label="Treibstoff"><TextField label="Treibstoff" value={d.fuelType} disabled={!mayEdit} onSave={(v) => edit((x) => ({ ...x, fuelType: v }))} /></Row>
      <div className="px-5 py-3">
        <div className="mb-2 text-sm font-medium">Ausrüstung</div>
        <div className="flex flex-wrap items-center gap-2">
          {d.equipment.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-600">{e}{mayEdit && <button aria-label={`${e} entfernen`} onClick={() => edit((x) => ({ ...x, equipment: x.equipment.filter((y) => y !== e) }))} className="grid h-4 w-4 place-items-center rounded-full hover:bg-slate-200"><X size={10} /></button>}</span>)}
          {d.equipment.length === 0 && !mayEdit && <span className="text-sm text-muted">–</span>}
          {mayEdit && <input aria-label="Ausrüstung hinzufügen" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} placeholder="+ hinzufügen" className="h-7 w-36 rounded-full border border-dashed border-line bg-transparent px-3 text-xs outline-none focus:border-brand" />}
        </div>
      </div>
    </Section>
  )
}

/** What the aircraft costs per hour, from the books, and the prices of the operation kinds. */
export function Costs({ id }: { id: string }) {
  const { ac } = useAircraft(id)
  const { kinds, modules } = useApp()
  const totalMin = sparten.reduce((n, s) => n + s.minutes, 0)
  const perMin = varPerMinute + fixedCostsYear / totalMin
  return (
    <Section title="Kosten">
      <Row label="Kostendeckender Satz" hint="aus Bordbuch, Belegen und Finanzen"><span className="text-lg font-semibold tabular-nums">{eur(perMin * 60)} <span className="text-sm font-normal text-muted">pro Stunde</span></span></Row>
      {kinds.filter((k) => k.rates[ac.reg] !== undefined && areaOn(modules, k.area)).map((k) => <Row key={k.id} label={k.name}><span className="tabular-nums">{eur(k.rates[ac.reg])} je Minute</span></Row>)}
      <div className="px-5 py-3 text-sm"><Link to="/verein?tab=betriebsarten" className="font-medium text-brand hover:underline">Preise unter Vereinseinstellungen, Betriebsarten</Link></div>
    </Section>
  )
}
