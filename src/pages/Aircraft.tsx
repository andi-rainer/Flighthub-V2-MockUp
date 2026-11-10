import { AlertTriangle, BookOpen, Calculator, Plane } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { aircraft } from '../data'
import { TODAY_ISO, useApp } from '../state'
import { Badge, Button, Card, PageHeader } from '../ui'
import { dueList } from './aircraft/data'
import { effectiveStatus, fmt, STATUS, toneText } from './aircraft/parts'

/** All aircraft at a glance: state, what is due next, and the quick ways to the tools. Reserving happens in the calendar. */
export default function Aircraft() {
  const nav = useNavigate()
  const { aircraftData, can } = useApp()
  return (
    <>
      <PageHeader title="Flugzeuge" actions={can('aircraft.create') && <Button variant="primary">Flugzeug hinzufügen</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {aircraft.map((a) => {
          const d = aircraftData[a.id]
          const s = STATUS[effectiveStatus(a.status, d)]
          const due = dueList(d, TODAY_ISO)
          const next = due[0]
          const attention = due.filter((x) => x.tone !== 'ok')
          const go = (to: string) => () => nav(to)
          return (
            <Card key={a.id} className="flex cursor-pointer flex-col p-5 transition hover:border-brand/40 hover:shadow-sm">
              <div onClick={() => nav(`/flugzeuge/${a.id}`)} className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Plane size={22} /></span>
                    <span><span className="block text-lg font-semibold">{a.reg}</span><span className="text-sm text-muted">{a.type}</span></span>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted">Betriebsstunden</div><div className="font-semibold tabular-nums">{fmt(d.hours, 1)} h</div></div>
                  <div><div className="text-xs text-muted">Landungen</div><div className="font-semibold tabular-nums">{fmt(d.landings)}</div></div>
                </div>
                <div className="mt-4 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="text-xs text-muted">Nächste Fälligkeit</div>
                  {next ? <><div className="font-medium">{next.name}</div><div className={toneText[next.tone]}>{next.label}</div></> : <div className="text-muted">Nichts fällig</div>}
                </div>
                <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
                  {a.uses.map((u) => <Badge key={u} tone="info">{u}</Badge>)}
                  {attention.length > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-warn"><AlertTriangle size={13} /> {attention.length} {attention.length === 1 ? 'Fälligkeit' : 'Fälligkeiten'} beachten</span>}
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <Button className="flex-1" onClick={go(`/flugzeuge/${a.id}/rechner`)}><Calculator size={15} /> Masse und Schwerpunkt</Button>
                <Button onClick={go('/bordbuch')}><BookOpen size={15} /> Bordbuch</Button>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
