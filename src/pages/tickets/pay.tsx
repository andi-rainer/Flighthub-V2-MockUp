import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { eur } from '../../data'
import { TODAY_ISO, useApp } from '../../state'
import { Badge } from '../../ui'
import { dmy } from '../manifest/data'
import type { PaymentTarget } from '../finance/ledger'
import { Field, field } from './parts'

export type PayMode = 'cash' | 'bank' | 'open'
/** How a payment reaches Finanzen: cash with its day, a bank transfer that is already there, or still open. */
export interface PayChoice { mode: PayMode; date: string; lineId: string }
export const NEW_PAY: PayChoice = { mode: 'cash', date: TODAY_ISO, lineId: '' }

export const payReady = (c: PayChoice) => c.mode === 'open' || (c.mode === 'cash' ? !!c.date && c.date <= TODAY_ISO : !!c.lineId)
/** Text of the confirm button: the amount is part of it, the booking is not done before it is clicked. */
export const payConfirm = (c: PayChoice, amount: number, dir: 'in' | 'out' = 'in') =>
  c.mode === 'cash' ? `${dir === 'in' ? 'Bar buchen' : 'Bar auszahlen'} · ${eur(amount)}` : c.mode === 'bank' ? 'Überweisung zuweisen' : 'Ausstellen'

/** Books the money into Finanzen: a cash posting, or the chosen bank line assigned to the voucher or ticket. */
export function useBookPayment() {
  const { ledger } = useApp()
  return (target: PaymentTarget, amount: number, c: PayChoice, by: string, dir: 'in' | 'out' = 'in') => {
    if (c.mode === 'cash') ledger.bookCash(target, dir === 'in' ? amount : -amount, c.date, by)
    else if (c.mode === 'bank') ledger.assign(c.lineId, target)
  }
}

const LABEL = {
  in: { cash: 'Bar eingegangen', bank: 'Überweisung eingegangen', open: 'Zahlung offen', date: 'Eingegangen am' },
  out: { cash: 'Bar ausgezahlt', bank: 'Überweisung ausgeführt', open: '', date: 'Ausgezahlt am' },
}

/** The way a payment is recorded. A transfer must exist in Finanzen > Bank, it is assigned from there. */
export function PaymentFields({ value, onChange, amount, dir = 'in', allowOpen = false, hint = '' }: { value: PayChoice; onChange: (c: PayChoice) => void; amount: number; dir?: 'in' | 'out'; allowOpen?: boolean; hint?: string }) {
  const { ledger } = useApp()
  const t = LABEL[dir]
  const lines = ledger.lines
    .filter((l) => !ledger.done[l.id] && ledger.accounts.find((a) => a.id === l.accountId)?.kind === 'bank' && (dir === 'in' ? l.amount > 0 : l.amount < 0))
    .sort((a, b) => Number(Math.abs(b.amount) === amount) - Number(Math.abs(a.amount) === amount))
  const modes: PayMode[] = allowOpen ? ['cash', 'bank', 'open'] : ['cash', 'bank']
  return (
    <div className="space-y-3">
      <Field label={dir === 'in' ? 'Zahlung' : 'Auszahlung'}>
        <select aria-label="Zahlungsart" value={value.mode} onChange={(e) => onChange({ ...NEW_PAY, mode: e.target.value as PayMode })} className={`${field} w-full`}>
          {modes.map((m) => <option key={m} value={m}>{t[m]}</option>)}
        </select>
      </Field>
      {value.mode === 'cash' && (
        <Field label={t.date}><input type="date" aria-label={t.date} max={TODAY_ISO} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className={field} /></Field>
      )}
      {value.mode === 'bank' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted"><span>Offene Überweisungen in Finanzen</span><Link to="/finanzen?tab=bank" className="text-brand hover:underline">Bank öffnen</Link></div>
          {lines.map((l) => {
            const fits = Math.abs(l.amount) === amount
            return (
              <label key={l.id} className={clsx('flex items-center gap-3 rounded-lg border px-3 py-2 text-sm', fits ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50', value.lineId === l.id ? 'border-brand bg-slate-50' : 'border-line')}>
                <input type="radio" name="bank-line" disabled={!fits} checked={value.lineId === l.id} onChange={() => onChange({ ...value, lineId: l.id })} />
                <span className="min-w-0 flex-1"><span className="block truncate">{l.text}</span><span className="text-xs text-muted">{dmy(l.date)}</span></span>
                {fits && hint && l.text.toLowerCase().includes(hint.toLowerCase()) && <Badge tone="ok">passt</Badge>}
                {!fits && <Badge>Betrag weicht ab</Badge>}
                <span className="font-medium tabular-nums">{eur(l.amount)}</span>
              </label>
            )
          })}
          {lines.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">Keine offene Überweisung in Finanzen.</p>}
        </div>
      )}
    </div>
  )
}
