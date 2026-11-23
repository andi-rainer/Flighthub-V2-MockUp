import clsx from 'clsx'
import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Button, Drawer } from '../../ui'
import { windowLabel, type TandemBooking } from '../manifest/data'
import { nextCode, type Ticket } from './data'
import { Field, field, newLog, useActor } from './parts'

const input = `${field} h-12 w-full text-base`

/**
 * [Entwurf] A tandem guest on the day without a ticket: the manifest creates the ticket on the spot (buy a ticket, then jump). The ticket is
 * linked to the booking and paid in cash ("bar") with the closing of the day, so its number is on the Tagesabschluss-Beleg.
 */
export default function QuickTicket({ booking, onClose, onCreated }: { booking: TandemBooking; onClose: () => void; onCreated?: (code: string) => void }) {
  const { catalog, tickets, setTickets, days } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const types = catalog.filter((c) => c.kind === 'ticket' && c.active)
  const [typeId, setTypeId] = useState((types.find((t) => t.price === booking.price) ?? types[0])?.id ?? '')
  const [first, setFirst] = useState(booking.first)
  const [last, setLast] = useState(booking.last)
  const [email, setEmail] = useState(booking.email ?? '')
  const type = types.find((t) => t.id === typeId)
  const day = days.find((d) => d.id === booking.dayId)
  const win = day?.windows.find((w) => w.id === booking.windowId)
  const ok = !!type && !!day && first.trim() !== '' && last.trim() !== '' && (email.trim() === '' || email.includes('@'))

  const create = () => guarded('manifest.payments.update', () => {
    if (!type || !day) return
    const code = nextCode(type.prefix, tickets.map((t) => t.code))
    const buyer = { first: first.trim(), last: last.trim(), email: email.trim(), phone: booking.phone }
    const t: Ticket = {
      code, typeId: type.id, buyer, guest: `${booking.first} ${booking.last}`, weight: booking.weight, bought: TODAY_ISO,
      day: day.date, windowLabel: win ? windowLabel(win) : `${day.from}–${day.to}`, bookingId: booking.id, price: type.price, pay: 'cash', paid: false, status: 'booked', source: 'Vor Ort',
      log: [newLog(TODAY_ISO, actor, `Am Manifest angelegt, ${eur(type.price)}, Zahlung bar beim Tagesabschluss`)],
    }
    setTickets((all) => [t, ...all])
    onCreated?.(code)
    onClose()
  })

  return (
    <Drawer open title={`Ticket anlegen · ${booking.first} ${booking.last}`} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><Button size="lg" onClick={onClose}>Abbrechen</Button><Button size="lg" variant="primary" disabled={!ok} onClick={create}>Ticket anlegen · {eur(type?.price ?? 0)}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div role="radiogroup" aria-label="Art" className="grid gap-2">
          {types.map((t) => (
            <button key={t.id} role="radio" aria-checked={t.id === typeId} onClick={() => setTypeId(t.id)}
              className={clsx('flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-left text-base', t.id === typeId ? 'border-brand bg-brand-soft font-medium text-brand ring-1 ring-brand' : 'border-line bg-surface')}>
              <span>{t.name}</span><span className="tabular-nums">{eur(t.price)}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vorname des Käufers"><input aria-label="Vorname des Käufers" value={first} onChange={(e) => setFirst(e.target.value)} className={input} /></Field>
          <Field label="Nachname"><input aria-label="Nachname des Käufers" value={last} onChange={(e) => setLast(e.target.value)} className={input} /></Field>
        </div>
        <Field label="E-Mail (optional)"><input aria-label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
      </div>
    </Drawer>
  )
}
