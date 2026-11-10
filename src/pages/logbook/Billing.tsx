import clsx from 'clsx'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { eur, members } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useSession } from '../../session/session'
import { useApp, type FlightCharge } from '../../state'
import { Badge, Button, Card, Drawer } from '../../ui'

type Part = FlightCharge['split'][number]
export const splitText = (split: Part[]) => split.map((x) => `${x.percent} % ${x.who}`).join(' · ')
const sumOf = (split: Part[]) => split.reduce((n, x) => n + x.percent, 0)
const field = 'h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand'

/** The charge of a flight: minutes times the price of the kind, and who pays how much. The treasurer checks it, then confirms. */
export function FlightBilling({ flight: f, onEditing }: { flight: FlightCharge; /** The editor is open: the flight must not be charged before it is saved or cancelled. */ onEditing: (editing: boolean) => void }) {
  const { patchFlight } = useApp()
  const [edit, setEditState] = useState(false)
  const setEdit = (v: boolean) => { setEditState(v); onEditing(v) }
  const rate = f.minutes ? f.amount / f.minutes : 0
  if (f.state === 'verrechnet') {
    return <Section title="Verrechnung"><Parts split={f.split} amount={f.amount} /><div className="px-1 pt-2"><Badge tone="ok">verrechnet</Badge></div></Section>
  }
  return (
    <Section title="Verrechnung">
      <div className="mb-2 text-sm text-muted">{f.minutes} min × {eur(rate)} = <b className="text-ink">{eur(f.amount)}</b></div>
      {edit ? <SplitEditor split={f.split} onSave={(split) => { patchFlight(f.id, { split }); setEdit(false) }} onCancel={() => setEdit(false)} />
        : <><Parts split={f.split} amount={f.amount} /><button onClick={() => setEdit(true)} className="mt-2 text-sm text-brand">Aufteilung ändern</button></>}
    </Section>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-5 rounded-xl border border-line p-3"><h3 className="mb-2 text-sm font-semibold">{title}</h3>{children}</section>
)

function Parts({ split, amount }: { split: Part[]; amount: number }) {
  return (
    <div className="divide-y divide-line text-sm">
      {split.map((x, i) => <div key={i} className="flex justify-between gap-3 py-1.5"><span>{x.who} <span className="text-muted">({x.percent} %)</span></span><span className="tabular-nums">{eur((amount * x.percent) / 100)}</span></div>)}
    </div>
  )
}

/** Who pays: parts with a Betriebskonto of a member or a cost center and a percentage; they have to add up to 100. */
type EditRow = Part & { t: '' | 'konto' | 'cc' }
function SplitEditor({ split, onSave, onCancel }: { split: Part[]; onSave: (s: Part[]) => void; onCancel: () => void }) {
  const { ledger, hasAccount } = useApp()
  const [rows, setRows] = useState<EditRow[]>(split.map((p) => ({ ...p, t: p.memberId ? 'konto' : 'cc' })))
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const set = (i: number, p: Partial<EditRow>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)))
  const total = sumOf(rows)
  const valid = total === 100 && rows.every((r) => r.percent > 0 && r.who)
  return (
    <div className="space-y-2 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <select aria-label="Art" value={r.t} onChange={(e) => set(i, { t: e.target.value as EditRow['t'], who: '', memberId: undefined })} className={clsx(field, 'flex-1')}>
            <option value="">Wer?</option><option value="konto">Betriebskonto</option><option value="cc">Kostenstelle</option>
          </select>
          <div className="order-last min-w-0 basis-full empty:hidden">
            {r.t === 'konto' && <MemberPicker ariaLabel="Mitglied" placeholder="Mitglied wählen" value={r.memberId} allow={(m) => hasAccount(m.id)} onChange={(id) => set(i, { memberId: id || undefined, who: id ? `Betriebskonto ${members.find((m) => m.id === id)?.name ?? ''}` : '' })} />}
            {r.t === 'cc' && <select aria-label="Kostenstelle" value={r.who} onChange={(e) => set(i, { who: e.target.value })} className={clsx(field, 'w-full')}><option value="">Bitte wählen</option>{ccs.map((c) => <option key={c.id} value={`Kostenstelle ${c.name}`}>{c.name}</option>)}</select>}
          </div>
          <input aria-label="Prozent" inputMode="numeric" value={r.percent || ''} onChange={(e) => set(i, { percent: Number(e.target.value.replace(/\D/g, '')) })} className={clsx(field, 'w-16 text-right tabular-nums')} />
          <span className="text-muted">%</span>
          <button aria-label="Teil entfernen" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, k) => k !== i))} className="rounded p-1 text-muted hover:bg-slate-100 disabled:opacity-30"><X size={14} /></button>
        </div>
      ))}
      <button onClick={() => setRows([...rows, { who: '', percent: 0, t: '' }])} className="inline-flex items-center gap-1 text-brand"><Plus size={14} /> Teil hinzufügen</button>
      <div className="flex items-center justify-between pt-1">
        <span className={clsx('text-xs', total === 100 ? 'text-muted' : 'text-bad')}>Summe {total} %</span>
        <span className="flex gap-2"><Button onClick={onCancel}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => onSave(rows.map(({ t: _t, ...p }) => p))}>Speichern</Button></span>
      </div>
    </div>
  )
}

/** Appears at the bottom while flights are picked in the Bordbuch. */
export function BillingBar({ flights, onClear, onReview }: { flights: FlightCharge[]; onClear: () => void; onReview: () => void }) {
  if (flights.length === 0) return null
  return (
    <div className="sticky bottom-16 z-10 mt-3 md:bottom-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/40 px-4 py-2.5 shadow-lg">
        <span className="text-sm"><b>{flights.length}</b> {flights.length === 1 ? 'Flug' : 'Flüge'} ausgewählt · <b className="tabular-nums">{eur(flights.reduce((n, f) => n + f.amount, 0))}</b></span>
        <span className="flex gap-2"><Button onClick={onClear}>Auswahl aufheben</Button><Button variant="primary" onClick={onReview}>Prüfen und verrechnen</Button></span>
      </Card>
    </div>
  )
}

/** The picked flights at a glance, nothing is charged before the list was seen. */
export function ChargeDrawer({ flights, onClose, onDone }: { flights: FlightCharge[]; onClose: () => void; onDone: (n: number) => void }) {
  const { chargeFlights } = useApp()
  const { guarded } = useSession()
  const total = flights.reduce((n, f) => n + f.amount, 0)
  return (
    <Drawer open title={`${flights.length} ${flights.length === 1 ? 'Flug' : 'Flüge'} verrechnen`} onClose={onClose}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={flights.length === 0} onClick={() => { guarded('billing.flights.charge', () => { chargeFlights(flights.map((f) => f.id)); onDone(flights.length) }); onClose() }}>{eur(total)} verrechnen</Button>}>
      <div className="divide-y divide-line rounded-xl border border-line text-sm">
        {flights.map((f) => (
          <div key={f.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate font-medium">{f.date} · {f.aircraft} · {f.pilot}</span><span className="shrink-0 font-semibold tabular-nums">{eur(f.amount)}</span></div>
            <div className="truncate text-xs text-muted">{f.kind} · {f.minutes} min · {splitText(f.split)}</div>
          </div>
        ))}
      </div>
    </Drawer>
  )
}
