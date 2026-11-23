import clsx from 'clsx'
import { Receipt as ReceiptIcon } from 'lucide-react'
import { useState } from 'react'
import { aircraft, eur } from '../../data'
import { useSession } from '../../session/session'
import { Badge, Button, Card, Drawer, Segmented } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { dmOf, NO_RECEIPT_REASONS, type OwnReceipt } from './ledger'
import { openReceiptFile } from './parts'
import { nextOwnNo, nowTime, OwnFields, OwnReceiptDoc } from './ReceiptDialogs'
import { LATER } from './status'

type Kind = '' | 'fuel' | 'other'

/**
 * A member hands in a cash expense in four short steps: what it was, the receipt (scanned or uploaded and read), a short description, send.
 * The treasurer checks it in Finanzen; only then it is credited. Nothing is preselected. Without a receipt the member writes and signs the
 * Eigenbeleg here ([Entwurf]); Kassier or Obmann countersign it.
 */
export function ExpenseSubmitDrawer({ onClose }: { onClose: () => void }) {
  const { ledger, persona } = useApp()
  const { stepUp } = useSession()
  const actor = useActor()
  const memberId = persona.memberId
  const [kind, setKind] = useState<Kind>('')
  const [cap, setCap] = useState<Captured>(EMPTY_CAPTURE)
  const [text, setText] = useState('')
  const [reg, setReg] = useState('')
  const [none, setNone] = useState(false)
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const [payee, setPayee] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(TODAY_ISO)
  const [signed, setSigned] = useState(false)
  const fuel = kind === 'fuel'
  const why = reason === 'Sonstiges' ? other.trim() : reason
  const value = Math.round((Number(amount.replace(',', '.')) || 0) * 100) / 100
  const no = nextOwnNo(ledger, date)
  const doc: OwnReceipt = { no, payee: payee.trim(), purpose: (purpose.trim() || text.trim()), date, amount: value, file: `${no}.pdf`, needsSecond: true, first: { by: actor, at: dmOf(TODAY_ISO), time: nowTime() } }
  const ownProblem = !why ? 'Grund wählen.' : !doc.payee ? 'Empfänger fehlt.' : !(value > 0) ? 'Betrag fehlt.' : !date || date > TODAY_ISO ? 'Datum prüfen.' : null
  const problem = !kind ? 'Was war es?' : (none ? ownProblem : captureProblem(cap, fuel)) ?? (!text.trim() ? 'Kurze Beschreibung fehlt.' : fuel && !reg ? 'Flugzeug wählen.' : none && !signed ? 'Eigenbeleg unterschreiben.' : null)
  const total = none ? value : Number(cap.total.replace(',', '.')) || 0
  const submit = () => {
    const cc = fuel ? ledger.costCenters.find((c) => c.name === reg)?.id : undefined
    const suggested = cc ? { costCenterId: cc, categoryId: 'k-fuel' } : undefined
    if (none) stepUp(() => ledger.submitExpense({ memberId, receipt: { file: doc.file, supplier: doc.payee, number: '', date, amount: value }, description: text.trim(), suggested, origin: 'Mitglied', own: { reason: why, doc } }))
    else ledger.submitExpense({ memberId, receipt: toNewReceipt(cap, fuel), description: text.trim(), suggested, origin: 'Mitglied' })
    onClose()
  }
  const step = (n: number, title: string) => <div className="mb-2 flex items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-xs text-brand">{n}</span>{title}</div>
  return (
    <Drawer open title="Auslage einreichen" onClose={onClose}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={!!problem} onClick={submit}>{problem ? 'Auslage einreichen' : `Auslage ${eur(total)} einreichen`}</Button>}>
      <div className="space-y-6 text-sm">
        <div>{step(1, 'Was war es?')}<Segmented<Kind> value={kind} onChange={setKind} options={[{ value: 'fuel', label: 'Treibstoff' }, { value: 'other', label: 'Etwas anderes' }]} /></div>
        {kind && (
          <>
            <div>
              {step(2, none ? 'Eigenbeleg' : 'Beleg')}
              {none ? (
                <div className="space-y-3">
                  <OwnFields reasons={NO_RECEIPT_REASONS.filter((r) => r !== LATER)} reason={reason} onReason={setReason} other={other} onOther={setOther} payee={payee} onPayee={setPayee} purpose={purpose} onPurpose={setPurpose} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Betrag (€)"><input aria-label="Betrag" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} h-11 w-full tabular-nums`} /></Field>
                    <Field label="Bezahlt am"><input aria-label="Bezahlt am" type="date" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} h-11 w-full`} /></Field>
                  </div>
                  <button onClick={() => { setNone(false); setSigned(false) }} className="text-xs text-brand hover:underline">Doch ein Beleg vorhanden</button>
                </div>
              ) : (
                <>
                  <ReceiptCapture key={kind} value={cap} onChange={setCap} fuel={fuel} />
                  {!cap.file && <button onClick={() => setNone(true)} className="mt-2 text-xs text-brand hover:underline">Kein Beleg vorhanden</button>}
                </>
              )}
            </div>
            <div className="space-y-3">
              {step(3, 'Kurz beschrieben')}
              <input aria-label="Beschreibung" value={text} onChange={(e) => setText(e.target.value)} placeholder={fuel ? 'z. B. getankt in Wels vor dem Sprungbetrieb' : 'z. B. Schrauben für den Hangar'} className={`${field} h-11 w-full`} />
              {fuel && <Field label="Für welches Flugzeug?"><select aria-label="Flugzeug" value={reg} onChange={(e) => setReg(e.target.value)} className={`${field} h-11 w-full`}><option value="">Bitte wählen</option>{aircraft.map((a) => <option key={a.id}>{a.reg}</option>)}</select></Field>}
            </div>
            {none && !ownProblem && text.trim() && (
              <div className="space-y-3">
                {step(4, 'Unterschreiben')}
                <OwnReceiptDoc own={doc} reason={why} by={actor} />
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={signed} onChange={(e) => setSigned(e.target.checked)} />Ich unterschreibe den Eigenbeleg als {actor}.</label>
              </div>
            )}
            {problem && (none || (cap.file && cap.total)) && <p className="text-warn">{problem}</p>}
          </>
        )}
      </div>
    </Drawer>
  )
}

/** The way into the workflow from the dashboard. */
export function ExpenseSubmitCard() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="flex flex-wrap items-center gap-3 p-5">
      <div className="min-w-0 flex-1 basis-48"><div className="font-semibold">Bar ausgelegt?</div><div className="text-sm text-muted">Beleg scannen, kurz beschreiben, einreichen. Der Kassier prüft und schreibt gut.</div></div>
      <Button variant="primary" size="lg" onClick={() => setOpen(true)}><ReceiptIcon size={16} /> Auslage einreichen</Button>
      {open && <ExpenseSubmitDrawer onClose={() => setOpen(false)} />}
    </Card>
  )
}

const TONE = { offen: 'warn', gutgeschrieben: 'ok', abgelehnt: 'bad' } as const
const LABEL = { offen: 'Zur Prüfung', gutgeschrieben: 'Gutgeschrieben', abgelehnt: 'Abgelehnt' } as const

/** The own expenses with where they stand. */
export function MyExpenses() {
  const { ledger, persona } = useApp()
  const mine = ledger.expenses.filter((x) => x.memberId === persona.memberId)
  if (mine.length === 0) return null
  return (
    <Card className="self-start">
      <div className="border-b border-line px-5 py-3 font-semibold">Meine Auslagen</div>
      <div className="divide-y divide-line">
        {mine.map((x) => {
          const r = ledger.receipts.find((y) => y.id === x.receiptId)
          return (
            <div key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1 basis-48"><div className="truncate font-medium">{x.description}</div><div className="text-xs text-muted">{dmy(x.submitted)}{r ? ` · ${r.supplier}` : ''}</div></div>
              {r && <button onClick={() => openReceiptFile(r.name)} className="text-xs text-brand hover:underline">Beleg</button>}
              {x.own && <button onClick={() => openReceiptFile(x.own!.doc.file)} className="text-xs text-brand hover:underline">Eigenbeleg {x.own.doc.no}</button>}
              <span className="font-medium tabular-nums">{r ? eur(r.amount) : x.own ? eur(x.own.doc.amount) : ''}</span>
              <Badge tone={TONE[x.status]}>{LABEL[x.status]}</Badge>
              {x.status === 'abgelehnt' && x.rejectReason && <div className={clsx('basis-full text-xs text-bad')}>Grund: {x.rejectReason}</div>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
