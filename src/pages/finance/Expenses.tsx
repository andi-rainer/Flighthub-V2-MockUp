import { useState } from 'react'
import { eur, members } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp } from '../../state'
import { useSession } from '../../session/session'
import { Badge, Button, Card, Drawer, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { captureOf, captureProblem, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { type ExpenseRequest, type Ledger } from './ledger'
import { openReceiptFile, perLiter } from './parts'

const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?'

/**
 * Cash expenses of members waiting for the treasurer, shown in the bookings under "Zu bearbeiten". Nothing is credited before the check,
 * fuel included. Credited ones are in the bookings (card "Auslagen"); rejected ones can be shown here.
 */
export default function ExpenseQueue({ ledger }: { ledger: Ledger }) {
  const [open, setOpen] = useState<ExpenseRequest | null>(null)
  const [rejected, setRejected] = useState(false)
  const pending = ledger.expenses.filter((x) => x.status === 'offen')
  const turnedDown = ledger.expenses.filter((x) => x.status === 'abgelehnt')
  const rows = rejected ? [...pending, ...turnedDown] : pending
  const paging = usePaging(rows, String(rejected), [10, 25])
  if (pending.length === 0 && turnedDown.length === 0) return null
  return (
    <>
      <Card className="divide-y divide-line">
        <div className="flex items-center justify-between px-4 py-2 text-sm font-semibold">
          <span>Auslagen zur Prüfung · {pending.length}</span>
          {turnedDown.length > 0 && <button onClick={() => setRejected(!rejected)} className="text-xs font-normal text-brand">{rejected ? 'Abgelehnte ausblenden' : `${turnedDown.length} abgelehnte anzeigen`}</button>}
        </div>
        {paging.rows.map((x) => {
          const r = ledger.receipts.find((y) => y.id === x.receiptId)
          return (
            <div key={x.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 px-4 py-2.5 text-sm ${x.status === 'offen' ? 'border-l-warn' : 'border-l-transparent opacity-70'}`}>
              <div className="w-24 text-xs text-muted">{dmy(x.submitted)}</div>
              <div className="w-36 truncate font-medium">{nameOf(x.memberId)}</div>
              <div className="min-w-0 flex-1 basis-48"><div className="truncate">{x.description}</div><div className="truncate text-xs text-muted">{r?.supplier}{r?.number ? ` · ${r.number}` : ''}{r?.fuel ? ` · ${r.fuel.liters} L · ${perLiter(r.fuel.perLiter)}` : ''}</div></div>
              <Badge>{x.origin}</Badge>
              <div className="w-24 text-right font-semibold tabular-nums">{r ? eur(r.amount) : ''}</div>
              {x.status === 'offen' ? <Button variant="primary" onClick={() => setOpen(x)}>Prüfen</Button> : <span title={x.rejectReason}><Badge tone="bad">Abgelehnt</Badge></span>}
            </div>
          )
        })}
        {rows.length > 10 && paging.bar}
      </Card>
      {open && <Review key={open.id} request={open} ledger={ledger} onClose={() => setOpen(null)} />}
    </>
  )
}

/** The check: the numbers as read (correct them if needed), where it is booked, then credit it or send it back with a reason. */
function Review({ request: x, ledger, onClose }: { request: ExpenseRequest; ledger: Ledger; onClose: () => void }) {
  const { guarded } = useSession()
  const actor = useActor()
  const r = ledger.receipts.find((y) => y.id === x.receiptId)!
  const { hasAccount } = useApp()
  const [member, setMember] = useState(x.memberId)
  const [text, setText] = useState(x.description)
  const [cap, setCap] = useState<Captured>(captureOf(r))
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const [cc, setCc] = useState(x.suggested?.costCenterId ?? '')
  const [cat, setCat] = useState(x.suggested?.categoryId ?? '')
  const [rejecting, setRejecting] = useState(false)
  const [why, setWhy] = useState('')
  const fuel = cat === 'k-fuel'
  const problem = captureProblem(cap, fuel) ?? (!member ? 'Mitglied wählen.' : !cc || !cat ? 'Kostenstelle und Kostenart wählen.' : null)
  const total = Number(cap.total.replace(',', '.')) || 0
  const approve = () => { guarded('billing.bank.manage', () => ledger.approveExpense(x.id, { memberId: member, receipt: toNewReceipt(cap, fuel, { source: r.source }), splits: [{ costCenterId: cc, categoryId: cat, percent: 100 }], text }, actor)); onClose() }
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
            <div className="block">Gutschrift für
              <MemberPicker ariaLabel="Mitglied" className="mt-1" value={member || undefined} allow={(m) => hasAccount(m.id)} onChange={(id) => setMember(id ?? '')} />
              {member !== x.memberId && member && <p className="mt-1 text-xs text-warn">Eingereicht von {nameOf(x.memberId)}. Die Gutschrift geht an {nameOf(member)}.</p>}
            </div>
            <Field label="Buchungstext"><input aria-label="Buchungstext" value={text} onChange={(e) => setText(e.target.value)} className={`${field} h-11 w-full`} /></Field>
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
