import { useState } from 'react'
import { useSession } from '../../session/session'
import { eur } from '../../data'
import { useApp } from '../../state'
import { Badge, Banner, Button, Card, Segmented, usePaging } from '../../ui'

type View = 'offen' | 'verrechnet'
const COLS = 'md:grid-cols-[minmax(0,1.6fr)_10rem_minmax(0,1.4fr)_6rem_7rem]'

/**
 * Flights never hit the ledger by themselves. A flight from the Bordbuch waits here until the treasurer
 * has checked it (minutes, aircraft, who pays) and confirms it.
 */
export default function Flights() {
  const { flights, chargeFlights } = useApp()
  const { guarded } = useSession()
  const [view, setView] = useState<View>('offen')
  const [done, setDone] = useState<string | null>(null)
  const open = flights.filter((f) => f.state === 'offen')
  const paging = usePaging(flights.filter((f) => f.state === view), view)
  const shown = paging.rows

  const charge = (ids: string[]) => guarded('billing.flights.charge', () => { chargeFlights(ids); setDone(`${ids.length} Flug/Flüge verrechnet. Mitgliedskonten und Kostenstellen sind gebucht.`) })

  return (
    <div className="space-y-4">
      {done && <Banner>{done}</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'offen', label: `Zu verrechnen (${open.length})` }, { value: 'verrechnet', label: 'Verrechnet' }]} />
        <Button variant="primary" disabled={open.length === 0} onClick={() => charge(open.map((f) => f.id))}>{open.length} bestätigen und verrechnen</Button>
      </div>
      <Card className="overflow-hidden">
        <div className={`hidden gap-x-3 border-b border-line bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid ${COLS}`}>
          <span>Flug</span><span>Art · Minuten</span><span>Wer zahlt</span><span className="text-right">Betrag</span><span />
        </div>
        <div className="divide-y divide-line">
          {shown.map((f) => (
            <div key={f.id} className={`grid gap-x-3 gap-y-1 px-3 py-2 md:items-center ${COLS}`}>
              <div className="min-w-0 truncate text-sm font-medium">{f.date} · {f.aircraft} · {f.pilot}</div>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted"><Badge tone={f.kind === 'Charter' ? 'warn' : 'neutral'}>{f.kind}</Badge>{f.minutes} min</div>
              <div className="min-w-0 truncate text-sm text-muted" title={f.split.map((x) => `${x.percent} % ${x.who}`).join(' · ')}>{f.split.map((x) => `${x.percent} % ${x.who}`).join(' · ')}</div>
              <div className="text-sm font-semibold tabular-nums md:text-right">{eur(f.amount)}</div>
              <div className="md:flex md:justify-end">{f.state === 'offen' ? <Button variant="primary" onClick={() => charge([f.id])}>Verrechnen</Button> : <Badge tone="ok">verrechnet</Badge>}</div>
            </div>
          ))}
          {shown.length === 0 && <div className="p-6 text-center text-sm text-muted">Nichts in dieser Ansicht.</div>}
        </div>
        {paging.bar}
      </Card>
    </div>
  )
}
