import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Row, Section } from '../../ui'
import { dayName, windowLabel } from '../manifest/data'
import { NO_SLOT, SlotPicker, useManifestSync, type Slot } from './book'
import { fullName, PAY_NAME, refundOpen, TICKET_STATUS, type Ticket } from './data'
import { NEW_PAY, payConfirm, PaymentFields, payReady, useBookPayment, type PayChoice } from './pay'
import { payTarget } from './payments'
import { ActionPanel, DetailShell, Field, field, newLog, ReasonField, useActor } from './parts'

export type TicketAction = 'move' | 'pay' | 'mail' | 'cancel' | 'refund'
const perm = 'vouchers.manage'
const input = `${field} w-full`

/** Everything about one ticket (a tandem booking bought for a day): facts, all actions, history. */
export default function TicketDetail({ code, initial, onClose }: { code: string; initial?: TicketAction; onClose: () => void }) {
  const { tickets, setTickets, catalog, bookings, can } = useApp()
  const { guarded } = useSession()
  const sync = useManifestSync()
  const book = useBookPayment()
  const actor = useActor()
  const [act, setAct] = useState<TicketAction | null>(initial ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const t = tickets.find((x) => x.code === code)
  if (!t) return null
  const type = catalog.find((c) => c.id === t.typeId)
  const manage = can(perm)
  const ahead = t.day >= TODAY_ISO
  const booked = t.status === 'booked'
  const booking = bookings.find((b) => b.id === t.bookingId)

  const update = (patch: Partial<Ticket>, text: string, message?: string) => guarded(perm, () => {
    setTickets((all) => all.map((x) => (x.code === t.code ? { ...x, ...patch, log: [...x.log, newLog(TODAY_ISO, actor, text)] } : x)))
    setNotice(message ?? text); setAct(null)
  })
  const comment = (text: string) => guarded(perm, () => setTickets((all) => all.map((x) => (x.code === t.code ? { ...x, log: [...x.log, newLog(TODAY_ISO, actor, text, 'comment')] } : x))))
  /** The money goes into Finanzen first; Finanzen reports back to the ticket (paid or refunded, history). */
  const money = (c: PayChoice, dir: 'in' | 'out') => guarded(perm, () => { book(payTarget('Ticket', t.code, t.buyer), t.price, c, actor, dir); setNotice(dir === 'in' ? 'Die Zahlung ist in Finanzen gebucht.' : 'Die Erstattung ist in Finanzen gebucht.'); setAct(null) })
  const open = (a: TicketAction) => () => { setNotice(null); setAct(a) }

  const actions = manage && (
    <>
      {booked && ahead && <Button variant="primary" onClick={open('move')}>Umbuchen</Button>}
      {!t.paid && t.status !== 'cancelled' && <Button variant={booked && ahead ? 'secondary' : 'primary'} onClick={open('pay')}>Zahlung erfassen</Button>}
      {refundOpen(t) && <Button variant="primary" onClick={open('refund')}>Erstattung erfassen</Button>}
      <Button onClick={open('mail')}>PDF senden</Button>
      {booked && ahead && <Button variant="danger" className="ml-auto" onClick={open('cancel')}>Stornieren</Button>}
      {t.status === 'cancelled' && ahead && <Button onClick={() => { if (booking) sync.reinstate(booking.id); update({ status: t.statusBeforeCancel ?? 'booked', cancelReason: undefined, statusBeforeCancel: undefined }, 'Storno zurückgenommen', 'Das Ticket ist wieder gebucht.') }}>Storno zurücknehmen</Button>}
    </>
  )

  return (
    <DetailShell title={t.code} subtitle={type?.name ?? 'Unbekannte Art'} onClose={onClose} actions={actions} notice={notice} canComment={manage} onComment={comment} log={t.log}
      badges={<><Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>{t.refunded && <Badge tone="ok">Erstattet</Badge>}{refundOpen(t) && <Badge tone="warn">Erstattung offen</Badge>}{!t.paid && t.status !== 'cancelled' && (t.proof ? <Badge tone="warn">Nachweis geprüft</Badge> : <Badge tone="bad">Zahlung offen</Badge>)}</>}
      panel={act && (
        act === 'move' ? <MovePanel t={t} onDone={(slot, reason, where) => { sync.move(t.bookingId ?? '', slot.dayId, slot.windowId); update({ day: where.day, windowLabel: where.window }, `Umgebucht von ${dayName(t.day)} (${t.windowLabel}) auf ${dayName(where.day)} (${where.window}). Grund: ${reason}`, `Umgebucht auf ${dayName(where.day)}.`) }} onCancel={() => setAct(null)} /> :
        act === 'pay' ? <MoneyPanel t={t} dir="in" onDone={(c) => money(c, 'in')} onCancel={() => setAct(null)} /> :
        act === 'mail' ? <MailPanel t={t} onDone={(to) => update({}, `Ticket-PDF an ${to} gesendet`, `Das PDF ist an ${to} unterwegs.`)} onCancel={() => setAct(null)} /> :
        act === 'refund' ? <MoneyPanel t={t} dir="out" onDone={(c) => money(c, 'out')} onCancel={() => setAct(null)} /> :
        <CancelPanel t={t} onDone={(reason) => { if (t.bookingId) sync.cancel(t.bookingId); update({ status: 'cancelled', statusBeforeCancel: t.status, cancelReason: reason }, `Storniert: ${reason}`, 'Das Ticket ist storniert.') }} onCancel={() => setAct(null)} />
      )}
      details={<>
        <Section title="Ticket">
          <Row label="Art">{type?.name}</Row>
          <Row label="Gebucht am">{t.bought.split('-').reverse().join('.')} · {t.source}</Row>
          <Row label="Bezahlt"><span className="flex flex-wrap items-center justify-end gap-2">{eur(t.price)} · {t.paid ? `${PAY_NAME[t.pay]}${t.paidOn ? ` am ${t.paidOn.split('-').reverse().join('.')}` : ''}` : t.proof ? `noch offen · Bestätigung geprüft von ${t.proof.by} am ${t.proof.at.split('-').reverse().join('.')}${t.proof.note ? ` (${t.proof.note})` : ''}` : 'noch offen'}{t.payLineId && <Link to="/finanzen?tab=bank" className="font-medium text-brand hover:underline">In Finanzen</Link>}</span></Row>
          <Row label="Ertrag">{t.status === 'flown' ? 'Beim Sprung verbucht' : t.status === 'cancelled' ? (t.refunded ? 'Keiner, erstattet' : 'Keiner') : t.status === 'noshow' ? 'Verbucht, Ticket verfallen' : `Noch nicht verbucht, Verbindlichkeit ${eur(t.price)}`}</Row>
        </Section>
        <Section title="Termin und Gast">
          <Row label="Sprungtag">{dayName(t.day)} · {t.windowLabel}</Row>
          <Row label="Gast">{t.guest}{t.weight ? ` · ${t.weight} kg` : ''}</Row>
          {booking && <Row label="Im Manifest"><Link to={`/manifest/${booking.dayId}?tab=tandem`} className="font-medium text-brand hover:underline">Tag öffnen</Link></Row>}
        </Section>
        <Section title="Käufer">
          <Row label="Name">{fullName(t.buyer)}</Row>
          <Row label="E-Mail"><a href={`mailto:${t.buyer.email}`} className="text-brand hover:underline">{t.buyer.email}</a></Row>
          {t.buyer.phone && <Row label="Telefon">{t.buyer.phone}</Row>}
        </Section>
        {t.cancelReason && <Section title="Storno"><Row label="Grund">{t.cancelReason}</Row></Section>}
      </>}
    />
  )
}

function MovePanel({ t, onDone, onCancel }: { t: Ticket; onDone: (slot: Slot, reason: string, where: { day: string; window: string }) => void; onCancel: () => void }) {
  const { days, bookings } = useApp()
  const own = bookings.find((b) => b.id === t.bookingId)
  const [slot, setSlot] = useState<Slot>(NO_SLOT)
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const day = days.find((d) => d.id === slot.dayId)
  const win = day?.windows.find((w) => w.id === slot.windowId)
  return (
    <ActionPanel title="Umbuchen" confirm="Umbuchen" disabled={!win || !reason} onConfirm={() => onDone(slot, reason, { day: day!.date, window: windowLabel(win!) })} onCancel={onCancel}>
      <SlotPicker value={slot} onChange={setSlot} selfId={own?.id} />
      <ReasonField onChange={setReason} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{fullName(t.buyer)} per Mail benachrichtigen</label>
    </ActionPanel>
  )
}

/** Money for a ticket: the payment (in) or the refund (out). It is booked in Finanzen, the amount is part of the confirm button. */
function MoneyPanel({ t, dir, onDone, onCancel }: { t: Ticket; dir: 'in' | 'out'; onDone: (c: PayChoice) => void; onCancel: () => void }) {
  const [c, setC] = useState<PayChoice>(NEW_PAY)
  return (
    <ActionPanel title={dir === 'in' ? 'Zahlung erfassen' : 'Erstattung erfassen'} confirm={payConfirm(c, t.price, dir)} disabled={!payReady(c)} onConfirm={() => onDone(c)} onCancel={onCancel}>
      {dir === 'out' && <div className="text-sm">{eur(t.price)} gehen zurück an {fullName(t.buyer)}.</div>}
      <PaymentFields value={c} onChange={setC} amount={t.price} dir={dir} hint={t.code} />
    </ActionPanel>
  )
}

function MailPanel({ t, onDone, onCancel }: { t: Ticket; onDone: (to: string) => void; onCancel: () => void }) {
  const [to, setTo] = useState(t.buyer.email)
  return <ActionPanel title="Ticket-PDF senden" confirm="Senden" disabled={!to.includes('@')} onConfirm={() => onDone(to)} onCancel={onCancel}><Field label="An"><input type="email" aria-label="Empfänger" value={to} onChange={(e) => setTo(e.target.value)} className={input} /></Field></ActionPanel>
}

function CancelPanel({ t, onDone, onCancel }: { t: Ticket; onDone: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <ActionPanel danger title={`${t.code} stornieren`} confirm="Stornieren" disabled={!reason.trim()} onConfirm={() => onDone(reason.trim())} onCancel={onCancel}>
      <Field label="Grund"><textarea aria-label="Stornogrund" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" /></Field>
      {t.paid && <div className="text-sm text-muted">Die Erstattung von {eur(t.price)} erfasst du danach getrennt.</div>}
    </ActionPanel>
  )
}
