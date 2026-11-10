import { useState } from 'react'
import { eur, members } from '../../data'
import { useSession } from '../../session/session'
import { Badge, Button, Card, Drawer, Segmented, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { captureOf, captureProblem, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { type ExpenseRequest, type Ledger } from './ledger'
import { openReceiptFile, perLiter } from './parts'

type View = 'offen' | 'erledigt'
const TONE = { offen: 'warn', gutgeschrieben: 'ok', abgelehnt: 'bad' } as const
const LABEL = { offen: 'Zur Prüfung', gutgeschrieben: 'Gutgeschrieben', abgelehnt: 'Abgelehnt' } as const
const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?'

/** Cash expenses of members waiting for the treasurer. Nothing is credited before the check, fuel included. */
export default function Expenses({ ledger }: { ledger: Ledger }) {
  const [view, setView] = useState<View>('offen')
  const [open, setOpen] = useState<ExpenseRequest | null>(null)
  const pending = ledger.expenses.filter((x) => x.status === 'offen')
  const rows = view === 'offen' ? pending : ledger.expenses.filter((x) => x.status !== 'offen')
  const paging = usePaging(rows, view)
  return (
    <div className="space-y-3">
      <Segmented<View> value={view} onChange={setView} options={[{ value: 'offen', label: `Zur Prüfung (${pending.length})` }, { value: 'erledigt', label: 'Erledigt' }]} />
      <Card className="divide-y divide-line">
        {paging.rows.map((x) => {
          const r = ledger.receipts.find((y) => y.id === x.receiptId)
          return (
            <div key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <div className="w-24 text-xs text-muted">{dmy(x.submitted)}</div>
              <div className="w-36 truncate font-medium">{nameOf(x.memberId)}</div>
              <div className="min-w-0 flex-1 basis-48"><div className="truncate">{x.description}</div><div className="truncate text-xs text-muted">{r?.supplier}{r?.number ? ` · ${r.number}` : ''}{r?.fuel ? ` · ${r.fuel.liters} L · ${perLiter(r.fuel.perLiter)}` : ''}</div></div>
              <Badge>{x.origin}</Badge>
              <div className="w-24 text-right font-semibold tabular-nums">{r ? eur(r.amount) : ''}</div>
              {x.status === 'offen' ? <Button variant="primary" onClick={() => setOpen(x)}>Prüfen</Button> : <Badge tone={TONE[x.status]}>{LABEL[x.status]}</Badge>}
            </div>
          )
        })}
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted">{view === 'offen' ? 'Keine Auslage zu prüfen.' : 'Noch nichts erledigt.'}</p>}
        {paging.bar}
      </Card>
      {open && <Review key={open.id} request={open} ledger={ledger} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** The check: the numbers as read (correct them if needed), where it is booked, then credit it or send it back with a reason. */
function Review({ request: x, ledger, onClose }: { request: ExpenseRequest; ledger: Ledger; onClose: () => void }) {
  const { guarded } = useSession()
  const actor = useActor()
  const r = ledger.receipts.find((y) => y.id === x.receiptId)!
  const [cap, setCap] = useState<Captured>(captureOf(r))
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const [cc, setCc] = useState(x.suggested?.costCenterId ?? '')
  const [cat, setCat] = useState(x.suggested?.categoryId ?? '')
  const [rejecting, setRejecting] = useState(false)
  const [why, setWhy] = useState('')
  const fuel = cat === 'k-fuel'
  const problem = captureProblem(cap, fuel) ?? (!cc || !cat ? 'Kostenstelle und Kostenart wählen.' : null)
  const total = Number(cap.total.replace(',', '.')) || 0
  const approve = () => { guarded('billing.bank.manage', () => ledger.approveExpense(x.id, toNewReceipt(cap, fuel, { source: r.source }), [{ costCenterId: cc, categoryId: cat, percent: 100 }], actor)); onClose() }
  const reject = () => { guarded('billing.bank.manage', () => ledger.rejectExpense(x.id, why.trim(), actor)); onClose() }
  return (
    <Drawer open title={`Auslage von ${nameOf(x.memberId)}`} onClose={onClose}
      footer={rejecting
        ? <div className="flex gap-2"><Button onClick={() => setRejecting(false)}>Zurück</Button><Button variant="danger" className="flex-1" disabled={!why.trim()} onClick={reject}>Ablehnen</Button></div>
        : <div className="flex gap-2"><Button onClick={() => setRejecting(true)}>Ablehnen</Button><Button variant="primary" size="lg" className="flex-1" disabled={!!problem} onClick={approve}>{problem ? 'Gutschreiben' : `${eur(total)} gutschreiben`}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{x.description}</div><div className="text-xs text-muted">{dmy(x.submitted)} · {x.origin} · <button onClick={() => openReceiptFile(r.name)} className="text-brand hover:underline">{r.name}</button></div></div>
        {rejecting ? (
          <Field label="Grund für die Ablehnung (das Mitglied sieht ihn)"><input autoFocus aria-label="Grund" value={why} onChange={(e) => setWhy(e.target.value)} className={`${field} h-11 w-full`} /></Field>
        ) : (
          <>
            <ReceiptCapture value={cap} onChange={setCap} fuel={fuel} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kostenstelle"><select aria-label="Kostenstelle" value={cc} onChange={(e) => setCc(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Kostenart"><select aria-label="Kostenart" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </div>
            {problem && cap.total && <p className="text-warn">{problem}</p>}
          </>
        )}
      </div>
    </Drawer>
  )
}
