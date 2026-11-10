import clsx from 'clsx'
import { Receipt as ReceiptIcon } from 'lucide-react'
import { useState } from 'react'
import { aircraft, eur } from '../../data'
import { Badge, Button, Card, Drawer, Segmented } from '../../ui'
import { useApp } from '../../state'
import { dmy } from '../manifest/data'
import { Field, field } from '../tickets/parts'
import { captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { openReceiptFile } from './parts'

type Kind = '' | 'fuel' | 'other'

/**
 * A member hands in a cash expense in four short steps: what it was, the receipt (scanned or uploaded and read), a short description, send.
 * The treasurer checks it in Finanzen; only then it is credited. Nothing is preselected.
 */
export function ExpenseSubmitDrawer({ onClose }: { onClose: () => void }) {
  const { ledger, persona } = useApp()
  const memberId = persona.memberId
  const [kind, setKind] = useState<Kind>('')
  const [cap, setCap] = useState<Captured>(EMPTY_CAPTURE)
  const [text, setText] = useState('')
  const [reg, setReg] = useState('')
  const fuel = kind === 'fuel'
  const problem = !kind ? 'Was war es?' : captureProblem(cap, fuel) ?? (!text.trim() ? 'Kurze Beschreibung fehlt.' : fuel && !reg ? 'Flugzeug wählen.' : null)
  const total = Number(cap.total.replace(',', '.')) || 0
  const submit = () => {
    const cc = fuel ? ledger.costCenters.find((c) => c.name === reg)?.id : undefined
    ledger.submitExpense({ memberId, receipt: toNewReceipt(cap, fuel), description: text.trim(), suggested: cc ? { costCenterId: cc, categoryId: 'k-fuel' } : undefined, origin: 'Mitglied' })
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
            <div>{step(2, 'Beleg')}<ReceiptCapture key={kind} value={cap} onChange={setCap} fuel={fuel} /></div>
            <div className="space-y-3">
              {step(3, 'Kurz beschrieben')}
              <input aria-label="Beschreibung" value={text} onChange={(e) => setText(e.target.value)} placeholder={fuel ? 'z. B. getankt in Wels vor dem Sprungbetrieb' : 'z. B. Schrauben für den Hangar'} className={`${field} h-11 w-full`} />
              {fuel && <Field label="Für welches Flugzeug?"><select aria-label="Flugzeug" value={reg} onChange={(e) => setReg(e.target.value)} className={`${field} h-11 w-full`}><option value="">Bitte wählen</option>{aircraft.map((a) => <option key={a.id}>{a.reg}</option>)}</select></Field>}
            </div>
            {problem && cap.file && cap.total && <p className="text-warn">{problem}</p>}
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
              <span className="font-medium tabular-nums">{r ? eur(r.amount) : ''}</span>
              <Badge tone={TONE[x.status]}>{LABEL[x.status]}</Badge>
              {x.status === 'abgelehnt' && x.rejectReason && <div className={clsx('basis-full text-xs text-bad')}>Grund: {x.rejectReason}</div>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
