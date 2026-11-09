import { useState } from 'react'
import { useSession } from '../../session/session'
import { eur } from '../../data'
import { useApp } from '../../state'
import { Badge, Banner, Button, Card, Segmented, usePaging } from '../../ui'

type View = 'offen' | 'verrechnet'

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
      <Card className="divide-y divide-line">
        {shown.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1 basis-56">
              <div className="font-medium">{f.date} · {f.aircraft} · {f.pilot}</div>
              <div className="text-sm text-muted"><Badge tone={f.kind === 'Charter' ? 'warn' : 'neutral'}>{f.kind}</Badge> {f.minutes} min</div>
            </div>
            <div className="min-w-0 flex-1 basis-56 text-sm">
              {f.split.map((s) => <div key={s.who} className="text-muted">{s.percent} % {s.who}</div>)}
            </div>
            <div className="w-28 text-right font-semibold tabular-nums">{eur(f.amount)}</div>
            {f.state === 'offen' ? <Button variant="primary" onClick={() => charge([f.id])}>Verrechnen</Button> : <Badge tone="ok">verrechnet</Badge>}
          </div>
        ))}
        {shown.length === 0 && <div className="p-8 text-center text-muted">Nichts in dieser Ansicht.</div>}
        {paging.bar}
      </Card>
    </div>
  )
}
