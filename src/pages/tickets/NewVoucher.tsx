import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Button, Drawer, Switch } from '../../ui'
import { addMonths, nextCode, type Voucher } from './data'
import { NEW_PAY, PaymentFields, payReady, useBookPayment, type PayChoice } from './pay'
import { payTarget } from './payments'
import { Field, field, newLog, useActor } from './parts'

const input = `${field} w-full`
const area = 'w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand'

/**
 * Issues a voucher by hand (counter sale, phone, bank transfer). The payment is booked in Finanzen right here: cash with its day, a transfer
 * that is already in the bank list, or still open (assigned later). A voucher from the earlier system keeps its own code and purchase date.
 */
export default function NewVoucher({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }) {
  const { catalog, vouchers, setVouchers } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const book = useBookPayment()
  const types = catalog.filter((c) => c.kind === 'voucher' && c.active)
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pay, setPay] = useState<PayChoice>(NEW_PAY)
  const [legacy, setLegacy] = useState(false)
  const [code, setCode] = useState('')
  const [bought, setBought] = useState(TODAY_ISO)
  const [message, setMessage] = useState('')
  const [comment, setComment] = useState('')
  const [send, setSend] = useState(true)
  const type = types.find((t) => t.id === typeId)
  const codeTaken = vouchers.some((v) => v.code === code.trim())
  const ok = !!type && first.trim() !== '' && last.trim() !== '' && email.includes('@') && (legacy ? code.trim() !== '' && !codeTaken && bought <= TODAY_ISO : payReady(pay))
  const confirm = legacy ? 'Übernehmen' : pay.mode === 'cash' ? `Ausstellen und Bar buchen · ${eur(type?.price ?? 0)}` : pay.mode === 'bank' ? 'Ausstellen und zuweisen' : 'Ausstellen'

  const create = () => guarded('vouchers.create', () => {
    if (!type) return
    const finalCode = legacy ? code.trim() : nextCode(type.prefix, vouchers.map((v) => v.code))
    const buyer = { first: first.trim(), last: last.trim(), email: email.trim(), phone: phone.trim() || undefined }
    const day = legacy ? bought : TODAY_ISO
    const v: Voucher = {
      code: finalCode, typeId, buyer, bought: day, validUntil: addMonths(day, type.validityMonths ?? 12), price: type.price,
      // Not paid until Finanzen reports the money (see `onPayment` in the state); a voucher from the earlier system was paid there.
      pay: legacy ? 'legacy' : 'bank', paid: legacy, paidOn: legacy ? day : undefined, status: legacy ? 'active' : 'unpaid',
      legacy: legacy || undefined, message: message.trim() || undefined,
      log: [
        newLog(TODAY_ISO, actor, legacy ? `Aus Altsystem übernommen, Code ${finalCode}` : `Ausgestellt, ${eur(type.price)}${pay.mode === 'open' ? ', Zahlung offen' : ''}`),
        ...(send && !legacy ? [newLog(TODAY_ISO, 'System', `Gutschein-PDF an ${email.trim()} gesendet`)] : []),
        ...(comment.trim() ? [newLog(TODAY_ISO, actor, comment.trim(), 'comment')] : []),
      ],
    }
    setVouchers((all) => [v, ...all])
    if (!legacy) book(payTarget('Gutschein', finalCode, buyer), type.price, pay, actor)
    onCreated(finalCode)
  })

  return (
    <Drawer open title="Gutschein ausstellen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!ok} onClick={create}>{confirm}</Button></div>}>
      <div className="space-y-4 text-sm">
        <Field label="Art"><select aria-label="Art" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={input}>{types.map((t) => <option key={t.id} value={t.id}>{t.name} · {eur(t.price)}</option>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vorname des Käufers"><input aria-label="Vorname" value={first} onChange={(e) => setFirst(e.target.value)} className={input} /></Field>
          <Field label="Nachname"><input aria-label="Nachname" value={last} onChange={(e) => setLast(e.target.value)} className={input} /></Field>
          <Field label="E-Mail"><input aria-label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
          <Field label="Telefon"><input aria-label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></Field>
        </div>
        {!legacy && <PaymentFields value={pay} onChange={setPay} amount={type?.price ?? 0} allowOpen hint={last.trim()} />}
        <Field label="Persönliche Nachricht"><textarea aria-label="Nachricht" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className={area} /></Field>
        <Field label="Kommentar (nur intern)"><textarea aria-label="Kommentar" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className={area} /></Field>
        {!legacy && <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span className="font-medium">Gutschein-PDF per Mail senden</span><Switch checked={send} onChange={setSend} label="PDF senden" /></div>}
        <div className="space-y-3 rounded-lg border border-line p-3">
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} />Gutschein aus Altsystem übernehmen</label>
          {legacy && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Code"><input aria-label="Alter Code" value={code} onChange={(e) => setCode(e.target.value)} className={input} />{codeTaken && <span className="mt-1 block text-xs text-bad">Diesen Code gibt es schon</span>}</Field>
              <Field label="Kaufdatum"><input aria-label="Kaufdatum" type="date" max={TODAY_ISO} value={bought} onChange={(e) => setBought(e.target.value)} className={input} /></Field>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
