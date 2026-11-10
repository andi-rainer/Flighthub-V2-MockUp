import { useState } from 'react'
import MemberPicker from '../../MemberPicker'
import { useApp } from '../../state'
import { Button, Drawer } from '../../ui'
import { hm, minutes } from './data'

const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

/**
 * Creates flights: one or several. Time and pilot are only suggested (the time follows the last flight, the pilot is the one of the last
 * flight) and can be changed; nothing is created before the coordinator confirms.
 */
export default function FlightsDrawer({ open, first, gap, pilotId, onClose, onCreate }: { open: boolean; first: string; gap: number; pilotId?: string; onClose: () => void; onCreate: (times: string[], pilotId?: string) => void }) {
  const { memberCan } = useApp()
  const [start, setStart] = useState(first)
  const [every, setEvery] = useState(gap)
  const [count, setCount] = useState(1)
  const [pilot, setPilot] = useState(pilotId ?? '')
  const times = Array.from({ length: count }, (_, i) => hm(minutes(start) + i * every))
  return (
    <Drawer open={open} title="Flüge anlegen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!start || count < 1 || (count > 1 && every < 10)} onClick={() => { onCreate(times, pilot || undefined); onClose() }}>{count === 1 ? 'Flug anlegen' : `${count} Flüge anlegen`}</Button></div>}>
      <div className="space-y-4">
        <div className="text-sm font-medium">Anzahl</div>
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          {[1, 3, 6].map((n) => <button key={n} onClick={() => setCount(n)} className={`h-11 min-w-11 rounded-lg border px-3 text-sm font-medium ${count === n ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50'}`}>{n}</button>)}
          <input aria-label="Anzahl" inputMode="numeric" value={count || ''} onChange={(e) => setCount(Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 0))} className="h-11 w-20 rounded-lg border border-line bg-surface px-3 text-center text-sm outline-none focus:border-brand" />
        </div>
        <div className={`grid gap-3 ${count > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className="block text-sm font-medium">{count > 1 ? 'Erster Flug' : 'Zeit'}<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></label>
          {count > 1 && <label className="block text-sm font-medium">Abstand (min)<input inputMode="numeric" value={every} onChange={(e) => setEvery(Number(e.target.value.replace(/\D/g, '')) || 0)} className={field} /></label>}
        </div>
        <div className="block text-sm font-medium">Pilot
          <MemberPicker ariaLabel="Pilot" className="mt-1" value={pilot} placeholder="Pilot wählen (optional)" onChange={(id) => setPilot(id ?? '')} allow={(m) => memberCan(m.id, 'manifest.flights.pilot')} />
        </div>
        <div className="flex flex-wrap gap-2">{times.map((t, i) => <span key={i} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm tabular-nums">{t}</span>)}</div>
      </div>
    </Drawer>
  )
}
