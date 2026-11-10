import { BookOpen, Calculator, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Row, Section, Stat } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { dueList, type Due } from './data'
import { dmy, fmt, toneText, UsedBar, useAircraft } from './parts'

type Tab = Due['tab']

/** First tab: the numbers, everything that is due next (maintenance, components, documents in ONE list) and the usual ways on. */
export default function Overview({ id, onTab }: { id: string; onTab: (t: Tab) => void }) {
  const { ac, d, c } = useAircraft(id)
  const { modules } = useApp()
  const due = dueList(d, TODAY_ISO)
  const next = due[0]
  const links = [
    { to: `/flugzeuge/${ac.id}/rechner`, icon: Calculator, label: 'Masse und Schwerpunkt rechnen' },
    { to: '/bordbuch', icon: BookOpen, label: 'Bordbuch' },
    ...(modules.charter && ac.uses.includes('Charter') ? [{ to: '/reservierungen', icon: CalendarDays, label: 'Reservierungskalender' }] : []),
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Betriebsstunden" value={`${fmt(d.hours, 1)} h`} />
        <Stat label="Landungen" value={fmt(d.landings)} />
        <Stat label="Nächste Fälligkeit" value={next ? next.name : '–'} hint={next?.label} tone={next?.tone === 'bad' ? 'bad' : undefined} />
        <Stat label="Leermasse und Leer-CG" value={d.emptyKg ? `${c.massText(d.emptyKg)} · ${c.lengthText(d.emptyArm, 2)}` : 'nicht erfasst'} />
      </div>
      <Section title="Fälligkeiten">
        {due.map((x) => (
          <Row key={`${x.kind}-${x.id}`} onClick={() => onTab(x.tab)} label={<span className="flex flex-wrap items-center gap-2">{x.name}<Badge>{x.kind}</Badge>{x.blocks && x.tone === 'bad' && <Badge tone="bad">Sperrt Reservierungen</Badge>}</span>}>
            <div className="w-64">
              <div className={`text-right text-sm ${toneText[x.tone]}`}>{x.label}</div>
              {x.used !== undefined && <div className="mt-1"><UsedBar used={x.used} tone={x.tone} /></div>}
            </div>
          </Row>
        ))}
        {due.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nichts fällig. Wartung, Komponenten und Dokumente legst du in den Reitern an.</p>}
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Schnellzugriff">
          {links.map((l) => <Link key={l.to} to={l.to} className="flex items-center gap-3 px-5 py-3 text-sm font-medium hover:bg-slate-50"><l.icon size={16} className="text-brand" />{l.label}</Link>)}
        </Section>
        <Section title="Zuletzt gewartet" action={<button onClick={() => onTab('wartung')} className="text-xs font-medium text-brand hover:underline">Alle</button>}>
          {d.history.slice(0, 3).map((h) => <Row key={h.id} label={h.type}><span className="text-muted">{dmy(h.date)} · {fmt(h.hours, 1)} h</span></Row>)}
          {d.history.length === 0 && <p className="px-5 py-4 text-sm text-muted">Keine Einträge.</p>}
        </Section>
      </div>
    </div>
  )
}
