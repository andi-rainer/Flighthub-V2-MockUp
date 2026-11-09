import { Plane } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { aircraft } from '../data'
import { Badge, Button, Card, PageHeader, RowMenu } from '../ui'

const status = { bereit: ['ok', 'Einsatzbereit'], wartung: ['warn', 'In Wartung'], dokument: ['bad', 'Dokument prüfen'] } as const

export default function Aircraft() {
  const nav = useNavigate()
  const open = (id: string, hash = '') => nav(`/flugzeuge/${id}${hash}`)
  return (
    <>
      <PageHeader title="Flugzeuge" actions={<Button variant="primary">Flugzeug hinzufügen</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {aircraft.map((a) => {
          const [tone, label] = status[a.status]
          return (
            <Card key={a.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <button onClick={() => open(a.id)} className="flex items-center gap-3 text-left">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Plane size={22} /></span>
                  <span>
                    <span className="block text-lg font-semibold">{a.reg}</span>
                    <span className="text-sm text-muted">{a.type}</span>
                  </span>
                </button>
                <RowMenu actions={[
                  { label: 'Details', onSelect: () => open(a.id) },
                  { label: 'Masse und Schwerpunkt', onSelect: () => open(a.id) },
                  { label: 'Fälligkeiten', onSelect: () => open(a.id) },
                  { label: 'Außer Betrieb setzen', onSelect: () => {}, danger: true },
                ]} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={tone}>{label}</Badge>
                {a.uses.map((u) => <Badge key={u} tone="info">{u}</Badge>)}
              </div>
              <p className="mt-3 flex-1 text-sm text-muted">{a.note}</p>
              <Button variant="primary" size="lg" className="mt-4 w-full" disabled={a.status !== 'bereit'}>Reservieren</Button>
            </Card>
          )
        })}
      </div>
    </>
  )
}
