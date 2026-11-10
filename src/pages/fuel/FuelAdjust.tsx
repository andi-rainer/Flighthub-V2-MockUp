import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { members } from '../../data'
import { useApp, type FuelAdjust } from '../../state'

const num = (v: string) => Number(v.replace(',', '.')) || 0
const REASONS = ['Peilstab oder Tankanzeige', 'Fehler bei früherer Eingabe', 'Sonstiges']

/**
 * The tank only changes with a Bordbuch entry (or the AFP that becomes one): fuel in (uplift) is part of the entry, fuel out (de-fueling)
 * and, in an exception, setting the content by hand are done here. Nothing is preselected.
 */
export function useFuelAdjust(content: number) {
  const [mode, setMode] = useState<null | 'defuel' | 'korrektur'>(null)
  const [liters, setLiters] = useState('')
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const [comment, setComment] = useState('')
  const n = num(liters)
  const reasonText = reason === 'Sonstiges' ? other.trim() : reason
  const problem = mode === 'defuel' ? (n <= 0 ? 'Abgetankte Liter angeben.' : n > content ? `Es sind nur ${Math.round(content)} L im Tank.` : !comment.trim() ? 'Kommentar zum De-fueling fehlt.' : null)
    : mode === 'korrektur' ? (liters.trim() === '' ? 'Gemessenen Inhalt angeben.' : !reasonText ? 'Grund für die Korrektur angeben.' : null)
    : null
  const adjust: FuelAdjust | undefined = problem || !mode ? undefined : mode === 'defuel' ? { kind: 'defuel', liters: n, reason: comment.trim() } : { kind: 'korrektur', liters: n, reason: reasonText }
  /** The content the flight starts with before any uplift. */
  const start = adjust ? (adjust.kind === 'defuel' ? Math.max(0, content - adjust.liters) : adjust.liters) : content
  return { mode, setMode, liters, setLiters, reason, setReason, other, setOther, comment, setComment, problem, adjust, start }
}
export type FuelAdjustForm = ReturnType<typeof useFuelAdjust>

export function FuelAdjustFields({ a, content, disabled }: { a: FuelAdjustForm; content: number; disabled?: boolean }) {
  const btn = (m: 'defuel' | 'korrektur', label: string) => (
    <button disabled={disabled} onClick={() => { a.setMode(a.mode === m ? null : m); a.setLiters(''); a.setComment('') }} className={clsx('h-9 rounded-lg border px-3 text-sm disabled:opacity-40', a.mode === m ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{label}</button>
  )
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">{btn('defuel', 'Abgetankt (De-fueling)')}{btn('korrektur', 'Inhalt korrigieren (Ausnahme)')}<span className="text-xs text-muted">Im Tank laut System: {Math.round(content)} L</span></div>
      {a.mode && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <label className="block font-medium">{a.mode === 'defuel' ? 'Abgetankte Liter' : 'Gemessener Inhalt (L)'}
            <input inputMode="decimal" aria-label="Liter Tankänderung" value={a.liters} onChange={(e) => a.setLiters(e.target.value)} className="mt-1 block h-11 w-36 rounded-lg border border-line px-3 text-lg font-semibold tabular-nums outline-none focus:border-brand" />
          </label>
          {a.mode === 'defuel' && <label className="block font-medium">Kommentar<input aria-label="Kommentar" value={a.comment} onChange={(e) => a.setComment(e.target.value)} placeholder="z. B. Treibstoff für Wartung entnommen" className="mt-1 h-10 w-full rounded-lg border border-line px-3 font-normal outline-none focus:border-brand" /></label>}
          {a.mode === 'korrektur' && (
            <div className="space-y-2">
              <div className="font-medium">Warum wird der Inhalt von Hand gesetzt?</div>
              <div className="flex flex-wrap gap-2">{REASONS.map((r) => <button key={r} onClick={() => a.setReason(r)} className={clsx('rounded-lg border px-3 py-2', a.reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
              {a.reason === 'Sonstiges' && <input aria-label="Grund" value={a.other} onChange={(e) => a.setOther(e.target.value)} placeholder="Grund kurz beschreiben" className="h-10 w-full rounded-lg border border-line px-3 outline-none focus:border-brand" />}
            </div>
          )}
          {a.problem && a.liters.trim() !== '' && <p className="text-warn">{a.problem}</p>}
          {a.adjust && <p className="text-muted">Inhalt danach: <b className="tabular-nums text-ink">{Math.round(a.start)} L</b></p>}
        </div>
      )}
    </div>
  )
}

/** A short text for an entry: what was done to the tank besides filling it. */
export const adjustText = (a: FuelAdjust) => (a.kind === 'defuel' ? `${a.liters} L abgetankt${a.reason ? ` (${a.reason})` : ''}` : `Inhalt auf ${a.liters} L korrigiert${a.reason ? ` (${a.reason})` : ''}`)

/**
 * Tells the pilot clearly when the receipt of one of his or her fill-ups is missing. It is handed in in the Bordbuch ("Beleg fehlt").
 * Shows nothing when nothing is missing.
 */
export function FuelMissingNotice({ className, subtle, onFilter }: { className?: string; /** In the AFP: only a quiet line, the receipt may well wait until later. */ subtle?: boolean; /** In the Bordbuch itself: filter the list instead of linking to it. */ onFilter?: () => void }) {
  const { entries, persona } = useApp()
  const me = members.find((m) => m.id === persona.memberId)?.name
  const mine = entries.filter((e) => e.pilot === me && e.fuel?.receipt.state === 'fehlt')
  if (mine.length === 0) return null
  if (subtle) return <p className={clsx('text-xs text-muted', className)}>Beleg fehlt noch zu {mine.length === 1 ? 'einem Tankvorgang' : `${mine.length} Tankvorgängen`}. <Link to={`/bordbuch?nur=beleg&flugzeug=${mine[0].aircraft}`} className="text-brand hover:underline">Im Bordbuch nachreichen</Link></p>
  return (
    <div className={clsx('flex flex-wrap items-center gap-3 rounded-xl border-2 border-warn bg-warn-soft px-4 py-3 text-sm text-amber-900', className)}>
      <span className="min-w-0 flex-1 basis-64"><b>{mine.length === 1 ? 'Bei einem Tankvorgang' : `Bei ${mine.length} Tankvorgängen`} fehlt der Beleg.</b> Bitte im Bordbuch nachreichen.</span>
      {onFilter
        ? <button onClick={onFilter} className="inline-flex h-9 items-center rounded-lg bg-brand px-3 font-medium text-white">Meine Flüge ohne Tankbeleg</button>
        : <Link to={`/bordbuch?nur=beleg&flugzeug=${mine[0].aircraft}`} className="inline-flex h-9 items-center rounded-lg bg-brand px-3 font-medium text-white">Zum Bordbuch</Link>}
    </div>
  )
}
