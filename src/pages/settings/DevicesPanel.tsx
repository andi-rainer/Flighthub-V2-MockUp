import { Laptop, ShieldCheck, ShieldQuestion, Smartphone, Tablet } from 'lucide-react'
import { useState } from 'react'
import { SESSION_POLICY } from '../../session/policy'
import { useSession } from '../../session/session'
import { Badge, Banner, Button, Card } from '../../ui'

const others = [
  { id: 'd1', name: 'iPhone von Eva', info: 'Safari · iOS · Wien', icon: Smartphone, trusted: true, last: 'heute 08:12' },
  { id: 'd2', name: 'iPad mini (Sprungplatz)', info: 'Safari · iPadOS · Flugplatz', icon: Tablet, trusted: true, last: 'gestern 17:40' },
  { id: 'd3', name: 'PC im Clubhaus', info: 'Edge · Windows · Flugplatz', icon: Laptop, trusted: false, last: '31.10.2026 19:05' },
]

/** Active devices like V1: this device with its trust, every other signed-in device with a sign-out button. */
export default function DevicesPanel() {
  const { session, untrustDevice, trustDevice, logout } = useSession()
  const [list, setList] = useState(others)
  const [note, setNote] = useState<string | null>(null)
  const trusted = !!session?.trusted
  return (
    <div className="max-w-3xl space-y-4">
      {note && <Banner>{note}</Banner>}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className={trusted ? 'text-ok' : 'text-warn'}>{trusted ? <ShieldCheck size={22} /> : <ShieldQuestion size={22} />}</div><div><div className="flex items-center gap-2 font-medium">Dieses Gerät <Badge tone="info">aktuell</Badge></div><div className="text-sm text-muted">{trusted ? 'Vertrauenswürdig: du bleibst angemeldet, bis du dich abmeldest.' : `Öffentlich: Abmeldung nach ${SESSION_POLICY.untrustedIdleMin} Minuten ohne Aktivität oder ${SESSION_POLICY.untrustedAbsoluteMin / 60} Stunden.`}</div></div></div>
          <div className="flex gap-2">{trusted ? <Button onClick={untrustDevice}>Vertrauen entziehen</Button> : <Button variant="primary" onClick={trustDevice}>Diesem Gerät vertrauen</Button>}<Button onClick={() => logout()}>Abmelden</Button></div>
        </div>
      </Card>

      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Weitere angemeldete Geräte ({list.length})</h3>{list.length > 0 && <Button onClick={() => { setList([]); setNote('Auf allen anderen Geräten wurdest du abgemeldet.') }}>Auf allen anderen Geräten abmelden</Button>}</div>
      <Card className="divide-y divide-line">
        {list.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <d.icon size={20} className="text-muted" />
            <div className="min-w-0 flex-1"><div className="font-medium">{d.name}</div><div className="text-xs text-muted">{d.info} · zuletzt aktiv {d.last}</div></div>
            <Badge tone={d.trusted ? 'ok' : 'warn'}>{d.trusted ? 'vertrauenswürdig' : 'öffentlich'}</Badge>
            <Button onClick={() => { setList(list.filter((x) => x.id !== d.id)); setNote(`${d.name} wurde abgemeldet.`) }}>Abmelden</Button>
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-center text-sm text-muted">Keine weiteren Geräte angemeldet.</p>}
      </Card>
    </div>
  )
}
