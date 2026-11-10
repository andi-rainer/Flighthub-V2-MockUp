import { useState } from 'react'
import { useSession } from '../../session/session'
import { useApp } from '../../state'
import { Button, Row, Section, field } from '../../ui'
import type { PaxLimits } from './data'
import { dec, useAircraft } from './parts'

/**
 * Thresholds for the total weight of the jumpers on one flight: green up to yellow, then yellow, orange (optional) and red above the maximum.
 * Typed and shown in the mass unit of the aircraft, stored in kg (the weights of the people are kg).
 */
export default function PaxThresholds({ id }: { id: string }) {
  const { paxLimits, setPaxLimits, can } = useApp()
  const { guarded } = useSession()
  const { c } = useAircraft(id)
  const cur: PaxLimits = paxLimits[id] ?? { yellow: 0, max: 0 }
  const show = (kg: number) => String(c.mass(kg)).replace('.', ',')
  const [yellow, setYellow] = useState(cur.yellow ? show(cur.yellow) : '')
  const [orange, setOrange] = useState(cur.orange !== undefined ? show(cur.orange) : '')
  const [max, setMax] = useState(cur.max ? show(cur.max) : '')
  const y = dec(yellow), o = orange.trim() === '' ? undefined : dec(orange), m = dec(max)
  const valid = y > 0 && m > y && (o === undefined || (o > y && o < m))
  const next: PaxLimits = { yellow: c.toKg(y), orange: o === undefined ? undefined : c.toKg(o), max: c.toKg(m) }
  const changed = [['yellow', y], ['orange', o], ['max', m]].some(([k, v]) => (v === undefined) !== (cur[k as keyof PaxLimits] === undefined) || (v !== undefined && Math.abs(c.mass(cur[k as keyof PaxLimits] as number) - (v as number)) > 0.005))
  const mayEdit = can('aircraft.edit')
  const scale = Math.max(m, y, o ?? 0) * 1.1 || 1
  const pct = (kg: number) => `${Math.min(100, (kg / scale) * 100)}%`
  const box = (value: string, set: (v: string) => void, label: string) => <input aria-label={label} inputMode="decimal" disabled={!mayEdit} value={value} onChange={(e) => set(e.target.value)} className={`${field} w-24 text-right tabular-nums disabled:bg-slate-50`} />
  return (
    <Section title="Springergewicht" action={mayEdit && <Button variant="primary" disabled={!valid || !changed} onClick={() => guarded('aircraft.edit', () => setPaxLimits(id, next))}>Speichern</Button>}>
      <Row label="Gelb ab" hint="Gesamtgewicht der Springer auf einem Flug"><span className="flex items-center gap-2">{box(yellow, setYellow, 'Gelb ab')}<span className="min-w-6 text-muted">{c.massUnit}</span></span></Row>
      <Row label="Orange ab (optional)"><span className="flex items-center gap-2">{box(orange, setOrange, 'Orange ab')}<span className="min-w-6 text-muted">{c.massUnit}</span></span></Row>
      <Row label="Maximum" hint="darüber rot"><span className="flex items-center gap-2">{box(max, setMax, 'Maximum')}<span className="min-w-6 text-muted">{c.massUnit}</span></span></Row>
      {valid && (
        <div className="px-5 py-4">
          <div className="flex h-3 overflow-hidden rounded-full">
            <div className="bg-ok" style={{ width: pct(y) }} />
            <div className="bg-warn" style={{ width: `calc(${pct(o ?? m)} - ${pct(y)})` }} />
            {o !== undefined && <div className="bg-orange-500" style={{ width: `calc(${pct(m)} - ${pct(o)})` }} />}
            <div className="flex-1 bg-bad" />
          </div>
        </div>
      )}
    </Section>
  )
}
