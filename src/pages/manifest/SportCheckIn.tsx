import { Search } from 'lucide-react'
import { docIssue } from '../members/memberDocs'
import { useMemo, useState } from 'react'
import { members } from '../../data'
import { flightNo, useApp } from '../../state'
import { Badge, Button, Drawer } from '../../ui'

/**
 * Sport jumpers at the field. Presence replaces booking: whoever is here can be put on a flight. The coordinator adds a jumper here
 * (weight is mandatory for the CG) and removes one who went home; flights already flown stay as they are, they are charged.
 */
export default function SportCheckIn({ open, dayId, onClose, onLeave }: { open: boolean; dayId: string; onClose: () => void; onLeave: (memberId: string) => void }) {
  const { memberCan, checkedIn, toggleCheckIn, weights, setWeight, loads, docsOf } = useApp()
  const [q, setQ] = useState('')
  const dayLoads = loads.filter((l) => l.dayId === dayId)
  const all = useMemo(() => members.filter((m) => memberCan(m.id, 'manifest.jumps.sport') && m.name.toLowerCase().includes(q.toLowerCase())), [q, memberCan])
  const list = [...all].sort((a, b) => Number(checkedIn.includes(b.id)) - Number(checkedIn.includes(a.id)) || a.name.localeCompare(b.name))
  const stateOf = (id: string) => {
    if (!checkedIn.includes(id)) return null
    const mine = dayLoads.filter((l) => l.jumpers.some((j) => j.id === `s-${id}`))
    const flown = mine.filter((l) => l.status === 'gelandet').length
    const next = mine.find((l) => l.status !== 'gelandet')
    return [flown > 0 ? `${flown}× gesprungen` : '', next ? (next.status === 'in_air' ? `in der Luft (Flug ${flightNo(loads, next)})` : `auf Flug ${flightNo(loads, next)}`) : 'wartend'].filter(Boolean).join(' · ')
  }
  return (
    <Drawer open={open} title="Springer am Platz" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Springer können sich auch selbst am Handy einchecken. Hier fügst du jemanden hinzu oder checkst ihn aus, wenn er geht.</p>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mitglied suchen" className="h-12 w-full rounded-xl border border-line pl-9 pr-3 text-base outline-none focus:border-brand" />
      </div>
      <div className="mt-3 space-y-2">
        {list.map((m) => {
          const here = checkedIn.includes(m.id)
          const kg = weights[m.id]
          return (
            <div key={m.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">{here ? <Badge tone="ok">{stateOf(m.id)}</Badge> : 'nicht am Platz'}{(() => { const issue = docIssue(docsOf(m.id)); return issue && <Badge tone={issue.tone}>{issue.label}</Badge> })()}</div>
                </div>
                <Button className="shrink-0 whitespace-nowrap" variant={here ? 'secondary' : 'primary'} disabled={!here && !kg} onClick={() => (here ? onLeave(m.id) : toggleCheckIn(m.id, true))}>{here ? 'Check-out' : 'Hinzufügen'}</Button>
              </div>
              {!here && (
                <label className="mt-2 flex items-center gap-2 text-sm text-muted">Gewicht
                  <input inputMode="numeric" value={kg ?? ''} onChange={(e) => setWeight(m.id, Number(e.target.value) || 0)} className="h-9 w-20 rounded-lg border border-line px-2 text-right text-ink" /> kg
                  {!kg && <span className="text-bad">Pflicht für den Check-in</span>}
                </label>
              )}
            </div>
          )
        })}
        {list.length === 0 && <p className="text-sm text-muted">Niemand gefunden.</p>}
      </div>
    </Drawer>
  )
}
