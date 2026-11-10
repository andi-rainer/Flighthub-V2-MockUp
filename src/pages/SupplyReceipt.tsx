import clsx from 'clsx'
import { useState } from 'react'
import MemberPicker from '../MemberPicker'
import { useApp, type Rcpt, type Supply } from '../state'
import { Segmented } from '../ui'
import { captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './finance/capture'
import { NO_RECEIPT_REASONS, type Ledger } from './finance/ledger'

const num = (v: string) => Number(v.replace(',', '.')) || 0

/**
 * Fuel or oil that was filled in: the amount, and the receipt for it (file and numbers, or the reason there is none). The receipt is kept
 * in Finanzen. If a member paid it privately it is booked as an Auslage and credited to the Betriebskonto. Used by the Bordbuch and the
 * end of a flight. `fixed` is an entry that already exists (the receipt is handed in later).
 */
export function useSupplyForm(fuel: boolean, fixed?: number, startOn = false) {
  const [on, setOn] = useState(fixed !== undefined || startOn)
  const [amount, setAmount] = useState(fixed ?? 0)
  const [cap, setCap] = useState<Captured>(EMPTY_CAPTURE)
  const [noReceipt, setNoReceiptState] = useState(false)
  const [later, setLaterState] = useState(false)
  const { persona } = useApp()
  // "Kein Beleg" and "Beleg kommt später" exclude each other; the second one goes on with the receipt missing, to be handed in through "Beleg fehlt".
  const setNoReceipt = (b: boolean) => { setNoReceiptState(b); if (b) setLaterState(false) }
  const setLater = (b: boolean) => { setLaterState(b); if (b) setNoReceiptState(false) }
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const [paid, setPaid] = useState<'' | 'lieferschein' | 'privat'>('')
  const [payer, setPayer] = useState('')
  const reasonText = reason === 'Sonstiges' ? other.trim() : reason
  // Oil is only tracked: it needs no invoice or delivery note.
  const state: Rcpt = !fuel ? { state: 'entfaellt' } : cap.file ? { state: 'ja' } : noReceipt && reasonText ? { state: 'grund', reason: reasonText } : { state: 'fehlt' }
  const mismatch = fuel && !!cap.file && amount > 0 && num(cap.liters) > 0 && Math.abs(num(cap.liters) - amount) > 0.5
  // Privately paid: the person who is logged in, changeable.
  const payerId = payer || persona.memberId
  const problem = !on ? null
    : amount <= 0 ? (fuel ? 'Bei „Getankt“ bitte die Liter angeben.' : 'Bei „Öl“ bitte die Menge angeben.')
    : !fuel ? null
    : !cap.file && !later && !noReceipt ? 'Beleg anhängen oder „Beleg kommt später“ wählen.'
    : noReceipt && !reasonText ? 'Treibstoff: Grund für den fehlenden Beleg angeben.'
    : cap.file ? (captureProblem(cap, fuel) ?? (mismatch ? 'Liter im Beleg und im Eintrag weichen ab.' : !paid ? 'Bitte angeben: Lieferschein oder privat vorgestreckt.' : paid === 'privat' && !payerId ? 'Bitte das Mitglied wählen, das bezahlt hat.' : null))
    : null
  return {
    fuel, on, setOn, amount, setAmount, cap, state, problem, fixed: fixed !== undefined,
    missing: fuel && on && amount > 0 && state.state === 'fehlt',
    fields: { fuel, amount, setAmount, cap, setCap: (c: Captured) => { setCap(c); if (fuel && amount === 0 && num(c.liters) > 0) setAmount(num(c.liters)) }, noReceipt, setNoReceipt, later, setLater, reason, setReason, other, setOther, paid, setPaid, payer: payerId, setPayer, lockAmount: fixed !== undefined, mismatch },
    /** Keeps the receipt in Finanzen (an Auslage when a member paid it) and returns what the entry stores. */
    commit: (ledger: Ledger, reg: string): Supply | undefined => {
      if (!on || amount <= 0) return undefined
      let receiptId: string | undefined
      if (fuel && cap.file) {
        const splits = [{ costCenterId: ledger.costCenters.find((c) => c.name === reg)?.id ?? ledger.costCenters[0].id, categoryId: fuel ? 'k-fuel' : 'k-maint', percent: 100 }]
        const receipt = toNewReceipt({ ...cap, liters: fuel ? String(amount) : '' }, fuel, { source: 'Bordbuch', splits, note: `Bordbuch ${reg}` })
        receiptId = paid === 'privat' && payerId ? ledger.submitExpense({ memberId: payerId, receipt, description: `Treibstoff ${reg}, ${amount} L`, suggested: splits[0], origin: 'Bordbuch' }) : ledger.createReceipt(receipt)
      }
      return { amount, receipt: state, receiptId }
    },
  }
}
export type SupplyForm = ReturnType<typeof useSupplyForm>

const box = 'h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand disabled:bg-slate-50'

/** Amount and receipt of one fill-up. */
export function SupplyFields({ f, hideAmount, onLiters }: { f: SupplyForm['fields']; hideAmount?: boolean; /** The liters of the receipt were taken over: the host follows. */ onLiters?: (n: number) => void }) {
  const { fuel } = f
  const { hasAccount } = useApp()
  return (
    <div className="space-y-4">
      {!hideAmount && (
        <label className="block text-sm font-medium">{fuel ? 'Liter' : 'Menge (Liter)'}
          <input inputMode="decimal" disabled={f.lockAmount} value={f.amount || ''} onChange={(e) => f.setAmount(num(e.target.value))} className={clsx(box, 'mt-1 sm:w-48')} />
        </label>
      )}
      {fuel && (<>
      <div>
        <div className="mb-1 text-sm font-medium">Rechnung oder Lieferschein</div>
        {f.noReceipt ? (
          <div className="space-y-3 rounded-xl border border-line p-3">
            <div className="text-sm font-medium">Warum gibt es keinen Beleg?</div>
            <div className="flex flex-wrap gap-2">{NO_RECEIPT_REASONS.filter((r) => r !== 'Beleg kommt später').map((r) => <button key={r} onClick={() => f.setReason(r)} className={clsx('rounded-lg border px-3 py-2 text-sm', f.reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
            {f.reason === 'Sonstiges' && <input value={f.other} onChange={(e) => f.setOther(e.target.value)} placeholder="Grund kurz beschreiben" className="h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />}
            <button onClick={() => { f.setNoReceipt(false); f.setReason(''); f.setOther('') }} className="text-sm text-brand">Doch einen Beleg anhängen</button>
          </div>
        ) : f.later ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>Beleg kommt später. Nachreichen über „Beleg fehlt“ im Bordbuch.</span><button onClick={() => f.setLater(false)} className="text-brand">Doch jetzt anhängen</button></div>
        ) : (
          <>
            <ReceiptCapture value={f.cap} onChange={f.setCap} fuel={fuel} liters={f.amount} onUseLiters={(n) => { f.setAmount(n); onLiters?.(n) }} />
            {!f.cap.file && <div className="mt-2 flex flex-wrap gap-4 text-sm"><button onClick={() => f.setLater(true)} className="font-medium text-brand">Beleg kommt später</button><button onClick={() => f.setNoReceipt(true)} className="text-brand">Kein Beleg vorhanden</button></div>}
          </>
        )}
      </div>
      {f.cap.file && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Wer hat bezahlt?</div>
          <Segmented value={f.paid} onChange={f.setPaid} options={[{ value: 'lieferschein', label: 'Lieferschein' }, { value: 'privat', label: 'Privat vorgestreckt' }]} />
          {f.paid === 'privat' && <MemberPicker ariaLabel="Bezahlt von" placeholder="Mitglied wählen" value={f.payer || undefined} allow={(m) => hasAccount(m.id)} onChange={(id) => f.setPayer(id ?? '')} />}
        </div>
      )}
      </>)}
    </div>
  )
}
