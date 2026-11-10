import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Drawer, Segmented } from '../../ui'
import { fullName } from '../tickets/data'
import { NEW_PAY, PaymentFields, payConfirm, payReady, useBookPayment, type PayChoice } from '../tickets/pay'
import { confirmProof, payTarget } from '../tickets/payments'
import { Field, field, useActor } from '../tickets/parts'
import { dmy, fullName as guestName, type TandemBooking } from './data'
import { GUEST_PAY, guestPay, type GuestPay } from './payState'

/** The payment state of one tandem guest. */
export function useGuestPay() {
  const { vouchers, tickets, can } = useApp()
  return { of: (b: TandemBooking) => guestPay(b, vouchers, tickets), mayClear: can('manifest.payments.update') }
}

/** "Bezahlt", "Zahlung offen" ... An open or only checked payment opens the clearing drawer when the person may. */
export function PayBadge({ pay, name, onOpen, short }: { pay: GuestPay; name: string; onOpen?: () => void; short?: boolean }) {
  const { tone } = GUEST_PAY[pay.state]
  const label = short && pay.state === 'nachweis' ? 'Nachweis' : GUEST_PAY[pay.state].label
  const badge = <Badge tone={tone}>{label}</Badge>
  if (!onOpen || (pay.state !== 'offen' && pay.state !== 'nachweis')) return badge
  return <button onClick={onOpen} title="Zahlung klären" aria-label={`Zahlung von ${name} klären`} className="rounded-full">{badge}</button>
}

type Way = 'nachweis' | 'eingang'

/**
 * Clears the payment of a tandem guest at the manifest. Two honest ways: the money is here (cash, or a transfer that exists in Finanzen)
 * and gets booked there, or only the confirmation of a transfer was checked: then the guest may fly and the treasurer assigns the real
 * bank line later (Finanzen > Bank, or the ticket itself). The second way records who checked it, it does not book anything.
 */
export function GuestPayDrawer({ booking, onClose }: { booking: TandemBooking; onClose: () => void }) {
  const { vouchers, tickets, setVouchers, setTickets } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const book = useBookPayment()
  const pay = guestPay(booking, vouchers, tickets)
  const item = pay.item
  const [way, setWay] = useState<Way>(pay.state === 'nachweis' ? 'eingang' : item?.pay === 'bank' ? 'nachweis' : 'eingang')
  const [choice, setChoice] = useState<PayChoice>(NEW_PAY)
  const [checked, setChecked] = useState(false)
  const [note, setNote] = useState('')
  if (!item || !pay.what || !pay.code) return null
  const guard = (fn: () => void) => guarded('manifest.payments.update', () => { fn(); onClose() })
  const confirm = () => guard(() => {
    const proof = { by: actor, at: TODAY_ISO, note: note.trim() || undefined }
    if (pay.what === 'Gutschein') setVouchers((all) => all.map((v) => (v.code === pay.code ? confirmProof(v, proof, TODAY_ISO) : v)))
    else setTickets((all) => all.map((t) => (t.code === pay.code ? confirmProof(t, proof, TODAY_ISO) : t)))
  })
  const collect = () => guard(() => book(payTarget(pay.what!, pay.code!, item.buyer), item.price, choice, actor))

  return (
    <Drawer open title={`Zahlung · ${guestName(booking)}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-4">
          <div><span className="font-mono font-medium">{pay.code}</span> · {pay.what}</div>
          <div className="text-xl font-semibold tabular-nums">{eur(item.price)}</div>
          <div className="text-xs text-muted">Käufer {fullName(item.buyer)}</div>
        </div>
        {item.proof && <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-amber-900">Überweisungsbestätigung geprüft von {item.proof.by} am {dmy(item.proof.at)}{item.proof.note ? ` (${item.proof.note})` : ''}. Der Eingang in Finanzen fehlt noch.</div>}
        {!item.proof && <Segmented<Way> value={way} onChange={setWay} options={[{ value: 'nachweis', label: 'Bestätigung geprüft' }, { value: 'eingang', label: 'Zahlung ist da' }]} />}
        {way === 'nachweis' && !item.proof ? (
          <div className="space-y-3">
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Ich habe die Bestätigung der Überweisung geprüft.</label>
            <Field label="Hinweis (optional)"><input aria-label="Hinweis" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Beleg vom Handy, Überweisung vom 06.11." className={`${field} w-full`} /></Field>
            <Button variant="primary" size="lg" className="w-full" disabled={!checked} onClick={confirm}>Bestätigen, Gast darf fliegen</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <PaymentFields value={choice} onChange={setChoice} amount={item.price} hint={pay.code} />
            <Button variant="primary" size="lg" className="w-full" disabled={!payReady(choice)} onClick={collect}>{payConfirm(choice, item.price)}</Button>
          </div>
        )}
      </div>
    </Drawer>
  )
}
