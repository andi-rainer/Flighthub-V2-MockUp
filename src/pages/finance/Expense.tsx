import { useState } from 'react'
import { eur, members, type Receipt } from '../../data'
import MemberPicker from '../../MemberPicker'
import { Button, Drawer } from '../../ui'
import { useApp } from '../../state'
import { Field, field } from '../tickets/parts'
import { captureOf, captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { type Ledger } from './ledger'

/**
 * A cost the club has, paid privately by a member (fuel at the pump, a part): the invoice is captured, booked on a cost center and
 * credited to the Betriebskonto of the member with a link to the receipt. `from` is an invoice that is already kept (no new file).
 */
export function ExpenseForm({ ledger, memberId, from, onDone, onCancel }: { ledger: Ledger; memberId?: string; from?: Receipt; onDone: () => void; onCancel?: () => void }) {
  const { hasAccount } = useApp()
  const [member, setMember] = useState(memberId ?? '')
  const [text, setText] = useState(from?.note ?? '')
  const [cap, setCap] = useState<Captured>(from ? captureOf(from) : EMPTY_CAPTURE)
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const [cc, setCc] = useState(from?.splits?.[0]?.costCenterId ?? '')
  const [cat, setCat] = useState(from?.splits?.[0]?.categoryId ?? '')
  const fuel = cat === 'k-fuel'
  const problem = captureProblem(cap, fuel)
  const total = Number(cap.total.replace(',', '.')) || 0
  const valid = !!member && !!cc && !!cat && !problem
  const name = members.find((m) => m.id === member)?.name
  const submit = () => {
    ledger.bookExpense({ memberId: member, receiptId: from?.id, receipt: toNewReceipt(cap, fuel, { source: from?.source }), splits: [{ costCenterId: cc, categoryId: cat, percent: 100 }], text })
    onDone()
  }
  return (
    <div className="space-y-4 text-sm">
      {!memberId && (
        <div className="block">Wer hat bezahlt?
          <MemberPicker ariaLabel="Mitglied" className="mt-1" value={member || undefined} allow={(m) => hasAccount(m.id)} onChange={(id) => setMember(id ?? '')} />
        </div>
      )}
      <Field label="Buchungstext"><input aria-label="Buchungstext" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Schrauben für den Hangar" className={`${field} h-11 w-full`} /></Field>
      <ReceiptCapture value={cap} onChange={setCap} fuel={fuel} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kostenstelle"><select aria-label="Kostenstelle" value={cc} onChange={(e) => setCc(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Kostenart"><select aria-label="Kostenart" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {problem && cap.file && cap.total && <span className="mr-auto text-xs text-warn">{problem}</span>}
        {onCancel && <Button onClick={onCancel}>Abbrechen</Button>}
        <Button variant="primary" disabled={!valid} onClick={submit}>{valid ? `Erfassen und ${name} ${eur(total)} gutschreiben` : 'Auslage erfassen'}</Button>
      </div>
    </div>
  )
}

export function ExpenseDrawer({ ledger, memberId, from, onClose }: { ledger: Ledger; memberId?: string; from?: Receipt; onClose: () => void }) {
  return (
    <Drawer open title="Auslage erfassen" onClose={onClose}>
      <ExpenseForm ledger={ledger} memberId={memberId} from={from} onDone={onClose} onCancel={onClose} />
    </Drawer>
  )
}
