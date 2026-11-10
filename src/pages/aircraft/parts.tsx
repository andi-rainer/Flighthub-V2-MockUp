import clsx from 'clsx'
import { useState } from 'react'
import { aircraft } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { field } from '../../ui'
import { blockingExpired, type Detail, type Tone } from './data'
import { converter, type Conv } from './units'

export const dec = (v: string) => Number(v.replace(',', '.'))
export const fmt = (n: number, digits = 0) => n.toLocaleString('de-AT', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const dmy = (iso: string) => iso.split('-').reverse().join('.')
export const toneText: Record<Tone, string> = { ok: 'text-muted', warn: 'text-warn', bad: 'font-medium text-bad' }
export const toneBar: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }

/** One aircraft with its data and a guarded way to change it (needs `aircraft.edit`). */
export function useAircraft(id: string) {
  const { aircraftData, setAircraftData, can } = useApp()
  const { guarded } = useSession()
  const ac = aircraft.find((a) => a.id === id) ?? aircraft[0]
  const d = aircraftData[ac.id]
  const mayEdit = can('aircraft.edit')
  const editAs = (perm: string, fn: (d: Detail) => Detail) => guarded(perm, () => setAircraftData(ac.id, fn))
  const edit = (fn: (d: Detail) => Detail) => editAs('aircraft.edit', fn)
  return { ac, d, mayEdit, edit, editAs, c: converter(d.units) }
}

/** The state an aircraft is in right now: a blocking document that ran out wins over the base state. */
export function effectiveStatus(base: 'bereit' | 'wartung' | 'dokument', d: Detail): 'bereit' | 'wartung' | 'dokument' {
  return base === 'wartung' ? base : blockingExpired(d, TODAY_ISO).length > 0 ? 'dokument' : base === 'dokument' ? 'bereit' : base
}
export const STATUS = { bereit: { tone: 'ok', label: 'Einsatzbereit' }, wartung: { tone: 'warn', label: 'In Wartung' }, dokument: { tone: 'bad', label: 'Dokument prüfen' } } as const

/** A decimal number that is saved when the field is left; an invalid entry falls back to the saved value. */
export function DecField({ value, unit, label, onSave, min = 0, width = 'w-24', disabled }: { value: number; unit?: string; label: string; onSave: (n: number) => void; min?: number; digits?: number; width?: string; disabled?: boolean }) {
  const show = (n: number) => String(n).replace('.', ',')
  const [v, setV] = useState(show(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) { setSeen(value); setV(show(value)) }
  const done = () => { const n = dec(v); if (v.trim() !== '' && Number.isFinite(n) && n >= min) { if (n !== value) onSave(n) } else setV(show(value)) }
  return (
    <>
      <input aria-label={label} inputMode="decimal" disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={clsx(field, width, 'text-right tabular-nums disabled:bg-slate-50 disabled:text-ink')} />
      {unit && <span className="min-w-10 whitespace-nowrap text-muted">{unit}</span>}
    </>
  )
}

/** Thin bar: how much of a limited life is used. */
export function UsedBar({ used, tone }: { used: number; tone: Tone }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={clsx('h-full', toneBar[tone])} style={{ width: `${Math.max(3, Math.min(100, used * 100))}%` }} /></div>
}

/** What a number measures: it decides which unit of the aircraft it is shown in. */
export type Quantity = 'mass' | 'length' | 'fuel'

/**
 * A number of an aircraft in ITS units: it shows and takes lb, inches or US gallons where the aircraft uses them, and stores metric. The
 * metric equivalent stands beside it, so a value from an American manual can be checked at a glance.
 */
export function UnitField({ q, value, c, label, onSave, perHour, width, disabled }: { q: Quantity; value: number; c: Conv; label: string; onSave: (stored: number) => void; perHour?: boolean; width?: string; disabled?: boolean }) {
  const unit = q === 'mass' ? c.massUnit : q === 'length' ? c.lengthUnit : c.fuelUnit
  const to = q === 'mass' ? c.toKg : q === 'length' ? c.toM : c.toL
  const alt = q === 'mass' ? c.massAlt(value) : q === 'length' ? c.lengthAlt(value) : c.fuelAlt(value)
  return (
    <>
      <DecField label={label} value={c[q](value)} unit={perHour ? `${unit}/h` : unit} width={width} disabled={disabled} onSave={(n) => onSave(to(n))} />
      {alt && <span className="ml-2 min-w-24 whitespace-nowrap text-xs text-muted">{alt}</span>}
    </>
  )
}
