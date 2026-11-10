import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Button, Drawer } from '../../ui'
import { windowLabel, type BookingSource } from '../manifest/data'
import { NO_SLOT, SlotPicker, useManifestSync, type Slot } from './book'
import { nextCode, type Ticket } from './data'
import { NEW_PAY, PaymentFields, payReady, useBookPayment, type PayChoice } from './pay'
import { payTarget } from './payments'
import { Field, field, newLog, useActor } from './parts'

const input = `${field} w-full`

/** Books a tandem guest by hand (phone, counter): the guest appears in the manifest and as a ticket here. */
export default function NewTicket({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }) {
  const { catalog, tickets, setTickets, days } = useApp()
  const { guarded } = useSession()
  const sync = useManifestSync()
  const book = useBookPayment()
  const actor = useActor()
  const types = catalog.filter((c) => c.kind === 'ticket' && c.active)
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [slot, setSlot] = useState<Slot>(NO_SLOT)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [kg, setKg] = useState('')
  const [same, setSame] = useState(true)
  const [buyerFirst, setBuyerFirst] = useState('')
  const [buyerLast, setBuyerLast] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pay, setPay] = useState<PayChoice>(NEW_PAY)
  const [source, setSource] = useState<BookingSource>('Telefon')
  const [comment, setComment] = useState('')
  const type = types.find((t) => t.id === typeId)
  const day = days.find((d) => d.id === slot.dayId)
  const win = day?.windows.find((w) => w.id === slot.windowId)
  const guest = `${first.trim()} ${last.trim()}`.trim()
  const buyerFirstName = same ? first.trim() : buyerFirst.trim()
  const buyerLastName = same ? last.trim() : buyerLast.trim()
  const ok = !!type && !!win && first.trim() !== '' && last.trim() !== '' && buyerFirstName !== '' && buyerLastName !== '' && email.includes('@') && payReady(pay)
  const confirm = pay.mode === 'cash' ? `Ausstellen und Bar buchen · ${eur(type?.price ?? 0)}` : pay.mode === 'bank' ? 'Ausstellen und zuweisen' : 'Ausstellen'

  const create = () => guarded('vouchers.create', () => {
    if (!type || !day || !win) return
    const code = nextCode(type.prefix, tickets.map((t) => t.code))
    const bookingId = `bk-${Date.now()}`
    sync.add({ id: bookingId, dayId: day.id, windowId: win.id, first: first.trim(), last: last.trim(), weight: kg ? Number(kg) : undefined, email: email.trim(), phone: phone.trim() || undefined, source, paidOnline: false, price: type.price, state: 'gebucht' })
    const buyerPerson = { first: buyerFirstName, last: buyerLastName, email: email.trim(), phone: phone.trim() || undefined }
    const t: Ticket = {
      code, typeId, buyer: buyerPerson, guest, weight: kg ? Number(kg) : undefined, bought: TODAY_ISO,
      day: day.date, windowLabel: windowLabel(win), bookingId, price: type.price, pay: pay.mode === 'bank' ? 'bank' : 'cash', paid: false, status: 'booked', source,
      // Not paid until Finanzen reports the money (see `onPayment` in the state).
      log: [newLog(TODAY_ISO, actor, `Erfasst (${source}), ${eur(type.price)}${pay.mode === 'open' ? ', Zahlung offen' : ''}`), ...(comment.trim() ? [newLog(TODAY_ISO, actor, comment.trim(), 'comment')] : [])],
    }
    setTickets((all) => [t, ...all])
    book(payTarget('Ticket', code, buyerPerson), type.price, pay, actor)
    onCreated(code)
  })

  return (
    <Drawer open title="Ticket ausstellen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!ok} onClick={create}>{confirm}</Button></div>}>
      <div className="space-y-4 text-sm">
        <Field label="Art"><select aria-label="Art" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={input}>{types.map((t) => <option key={t.id} value={t.id}>{t.name} · {eur(t.price)}</option>)}</select></Field>
        <SlotPicker value={slot} onChange={setSlot} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Vorname des Gasts"><input aria-label="Vorname" value={first} onChange={(e) => setFirst(e.target.value)} className={input} /></Field>
          <Field label="Nachname"><input aria-label="Nachname" value={last} onChange={(e) => setLast(e.target.value)} className={input} /></Field>
          <Field label="Gewicht (kg)"><input aria-label="Gewicht" inputMode="numeric" value={kg} onChange={(e) => setKg(e.target.value.replace(/\D/g, ''))} className={input} /></Field>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} />Der Gast ist auch der Käufer</label>
        <div className="grid gap-3 sm:grid-cols-2">
          {!same && <><Field label="Vorname des Käufers"><input aria-label="Vorname des Käufers" value={buyerFirst} onChange={(e) => setBuyerFirst(e.target.value)} className={input} /></Field><Field label="Nachname des Käufers"><input aria-label="Nachname des Käufers" value={buyerLast} onChange={(e) => setBuyerLast(e.target.value)} className={input} /></Field></>}
          <Field label="E-Mail"><input aria-label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
          <Field label="Telefon"><input aria-label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></Field>
          <Field label="Gebucht über"><select aria-label="Quelle" value={source} onChange={(e) => setSource(e.target.value as BookingSource)} className={input}><option>Telefon</option><option>Vor Ort</option></select></Field>
        </div>
        <PaymentFields value={pay} onChange={setPay} amount={type?.price ?? 0} allowOpen hint={buyerLastName} />
        <Field label="Kommentar (nur intern)"><textarea aria-label="Kommentar" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" /></Field>
      </div>
    </Drawer>
  )
}
