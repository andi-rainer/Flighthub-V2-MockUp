import clsx from 'clsx'
import { ArrowLeft, FileUp, Paperclip, Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { aircraft, currentCharterRatePerMin, eur, fixedCostsYear, sparten, varPerMinute } from '../../data'
import { Badge, Button, Card, Stat } from '../../ui'
import { daysLeft, details, type Due } from './data'
import MassBalance from './Envelope'

/**
 * One flat page, no nested tabs. Order = what you need most often:
 * numbers -> mass & balance -> everything that expires (maintenance, components, documents in ONE list) -> history -> master data.
 */
const sections = [
  { id: 'wb', label: 'Masse und Schwerpunkt' },
  { id: 'due', label: 'Fälligkeiten' },
  { id: 'hist', label: 'Historie' },
  { id: 'data', label: 'Stammdaten' },
  { id: 'cost', label: 'Kosten' },
]

const urgency = (d: Due) => d.remaining / d.total // only for the bar length
const tone = (d: Due) => (daysLeft(d) < 14 ? 'bad' : daysLeft(d) < 60 ? 'warn' : 'ok')

export default function AircraftDetail() {
  const { id = 'a1' } = useParams()
  const nav = useNavigate()
  const ac = aircraft.find((a) => a.id === id) ?? aircraft[0]
  const d = details[ac.id]
  const due = [...d.dues].sort((a, b) => daysLeft(a) - daysLeft(b))
  const next = due[0]
  const totalMin = sparten.reduce((n, s) => n + s.minutes, 0)
  const perMin = varPerMinute + fixedCostsYear / totalMin

  return (
    <>
      <button onClick={() => nav('/flugzeuge')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Alle Flugzeuge</button>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ac.reg} <span className="text-lg font-normal text-muted">{ac.type}</span></h1>
          <div className="mt-2 flex flex-wrap gap-2">{ac.uses.map((u) => <Badge key={u} tone="info">{u}</Badge>)}<Badge tone={ac.status === 'bereit' ? 'ok' : ac.status === 'wartung' ? 'warn' : 'bad'}>{ac.status === 'bereit' ? 'Einsatzbereit' : ac.status === 'wartung' ? 'In Wartung' : 'Dokument prüfen'}</Badge></div>
        </div>
        <div className="flex gap-2"><Button>Bearbeiten</Button><Button variant="primary" disabled={ac.status !== 'bereit'}>Reservieren</Button></div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Betriebsstunden" value={`${d.hours.toLocaleString('de-AT')} h`} />
        <Stat label="Landungen" value={d.landings.toLocaleString('de-AT')} />
        <Stat label="Nächste Fälligkeit" value={next ? next.name : '–'} hint={next?.label} tone={next && tone(next) === 'bad' ? 'bad' : undefined} />
        <Stat label="Leermasse / Leer-CG" value={d.emptyKg ? `${d.emptyKg} kg · ${d.emptyArm.toFixed(2)} m` : 'nicht erfasst'} />
      </div>

      <nav className="sticky top-0 z-10 -mx-1 mb-5 flex gap-1 overflow-x-auto bg-canvas/90 px-1 py-2 backdrop-blur">
        {sections.map((s) => <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) }} className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-brand hover:text-brand">{s.label}</a>)}
      </nav>

      <div className="space-y-10">
        <section id="wb" className="scroll-mt-16">
          <H title="Masse und Schwerpunkt" hint="Beladung eingeben, Schwerpunkt gegen das AFM-Envelope prüfen" action={d.emptyKg ? <Button>Daten bearbeiten</Button> : undefined} />
          <MassBalance d={d} />
        </section>

        <section id="due" className="scroll-mt-16">
          <H title="Fälligkeiten" hint="Wartung, Lebensdauer-Komponenten und Dokumente in einer Liste, das Dringendste zuerst" action={<Button><Plus size={14} /> Eintrag</Button>} />
          {due.length === 0 ? <Card className="p-4 text-sm text-muted">Noch nichts erfasst.</Card> : (
            <Card className="divide-y divide-line">
              {due.map((x) => (
                <div key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="font-medium">{x.name} <Badge>{x.kind}</Badge></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={clsx('h-full', { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone(x)])} style={{ width: `${Math.max(3, Math.min(100, urgency(x) * 100))}%` }} /></div>
                  </div>
                  <div className={clsx('w-56 text-sm', tone(x) === 'bad' ? 'font-medium text-bad' : tone(x) === 'warn' ? 'text-warn' : 'text-muted')}>{x.label}</div>
                  {x.file ? <Button><Paperclip size={14} /> Datei</Button> : <Button>Erledigt buchen</Button>}
                </div>
              ))}
            </Card>
          )}
        </section>

        <section id="hist" className="scroll-mt-16">
          <H title="Historie" hint="Durchgeführte Wartungen und Komponentenwechsel" action={<Button><FileUp size={14} /> Wartung eintragen</Button>} />
          <Card className="divide-y divide-line">
            {d.history.map((h) => (
              <div key={h.date + h.type} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="text-muted">{h.date}</span> · <b>{h.type}</b></span>
                <span className="text-muted">{h.hours} · {h.by}</span>
              </div>
            ))}
            {d.history.length === 0 && <div className="px-5 py-3 text-sm text-muted">Keine Einträge.</div>}
          </Card>
        </section>

        <section id="data" className="scroll-mt-16">
          <H title="Stammdaten" hint="Wird nur einmal gepflegt. Betriebsstunden kommen aus dem Bordbuch." />
          <Card className="grid gap-4 p-5 text-sm sm:grid-cols-3">
            <KV k="Kennzeichen" v={ac.reg} /><KV k="Typ" v={ac.type} /><KV k="Treibstoff" v={d.fuelType} />
            <KV k="Verbrauch" v={`${d.burnLph} L/h`} /><KV k="Max. Treibstoff" v={d.maxFuelL ? `${d.maxFuelL} L` : '–'} /><KV k="Einsatz" v={ac.uses.join(' und ')} />
            <div className="sm:col-span-3"><div className="text-muted">Ausrüstung</div><div className="mt-1 flex flex-wrap gap-2">{d.equipment.map((e) => <Badge key={e}>{e}</Badge>)}{d.equipment.length === 0 && '–'}</div></div>
          </Card>
        </section>

        <section id="cost" className="scroll-mt-16">
          <H title="Kosten" hint="Aus Bordbuch, Belegen und Finanzen, nichts doppelt erfasst" />
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div><div className="text-sm text-muted">Kostendeckender Satz</div><div className="text-2xl font-semibold tabular-nums">{eur(perMin * 60)} <span className="text-sm font-normal text-muted">pro Stunde</span></div></div>
            <div className="text-sm text-muted">Verrechnet an Mitglieder heute: {eur(currentCharterRatePerMin * 60)}/h<br />Details unter Finanzen → Ergebnis</div>
          </Card>
        </section>
      </div>
    </>
  )
}

const H = ({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) => (
  <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-semibold">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>{action}</div>
)
const KV = ({ k, v }: { k: string; v: string }) => <div><div className="text-muted">{k}</div><div className="font-medium">{v}</div></div>
