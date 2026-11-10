import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Row, Section } from '../../ui'
import { dayName, dmy, windowLabel } from '../manifest/data'
import { NO_SLOT, SlotPicker, useManifestSync, type Slot } from './book'
import { addMonths, daysLeft, expiresSoon, fullName, isUsable, PAY_NAME, VOUCHER_STATUS, type Voucher } from './data'
import { NEW_PAY, payConfirm, PaymentFields, payReady, useBookPayment, type PayChoice } from './pay'
import { payTarget } from './payments'
import { ActionPanel, DetailShell, Field, field, newLog, ReasonField, useActor } from './parts'

export type VoucherAction = 'redeem' | 'extend' | 'pay' | 'mail' | 'cancel'
const perm = 'vouchers.manage'
const input = `${field} w-full`

/** Everything about one voucher: the facts, the dates, all actions and its history. Changes are written into the history. */
export default function VoucherDetail({ code, initial, onClose }: { code: string; initial?: VoucherAction; onClose: () => void }) {
  const { vouchers, setVouchers, catalog, bookings, days, can } = useApp()
  const { guarded } = useSession()
  const sync = useManifestSync()
  const book = useBookPayment()
  const actor = useActor()
  const [act, setAct] = useState<VoucherAction | null>(initial ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const v = vouchers.find((x) => x.code === code)
  if (!v) return null
  const type = catalog.find((c) => c.id === v.typeId)
  const booking = bookings.find((b) => b.id === v.bookingId)
  const day = days.find((d) => d.id === booking?.dayId)
  const window = day?.windows.find((w) => w.id === booking?.windowId)
  const manage = can(perm)
  const usable = isUsable(v)
  const left = daysLeft(v.validUntil, TODAY_ISO)

  const update = (patch: Partial<Voucher>, text: string, message?: string) => guarded(perm, () => {
    setVouchers((all) => all.map((x) => (x.code === v.code ? { ...x, ...patch, log: [...x.log, newLog(TODAY_ISO, actor, text)] } : x)))
    setNotice(message ?? text); setAct(null)
  })
  const comment = (text: string) => guarded(perm, () => setVouchers((all) => all.map((x) => (x.code === v.code ? { ...x, log: [...x.log, newLog(TODAY_ISO, actor, text, 'comment')] } : x))))

  /** The money goes into Finanzen first; Finanzen reports back to the voucher (paid, history). */
  const pay = (c: PayChoice) => guarded(perm, () => { book(payTarget('Gutschein', v.code, v.buyer), v.price, c, actor); setNotice('Die Zahlung ist in Finanzen gebucht.'); setAct(null) })
  const open = (a: VoucherAction) => () => { setNotice(null); setAct(a) }
  const actions = manage && (
    <>
      {usable && <Button variant={!v.bookingId && !v.wishDay && v.paid ? 'primary' : 'secondary'} disabled={!v.paid} onClick={open('redeem')}><span title={v.paid ? undefined : 'Erst die Zahlung erfassen'}>{v.bookingId ? 'Termin ändern' : v.wishDay ? 'Termin festlegen' : 'Termin buchen'}</span></Button>}
      {!v.paid && usable && <Button variant="primary" onClick={open('pay')}>Zahlung erfassen</Button>}
      {(usable || v.status === 'expired') && <Button onClick={open('extend')}>Gültigkeit verlängern</Button>}
      {v.status !== 'cancelled' && <Button onClick={open('mail')}>PDF senden</Button>}
      {usable && <Button variant="danger" className="ml-auto" onClick={open('cancel')}>Stornieren</Button>}
      {v.status === 'cancelled' && <Button onClick={() => update({ status: v.statusBeforeCancel ?? 'active', cancelReason: undefined, statusBeforeCancel: undefined }, 'Storno zurückgenommen', 'Der Gutschein ist wieder aktiv.')}>Storno zurücknehmen</Button>}
    </>
  )

  return (
    <DetailShell title={v.code} subtitle={type?.name ?? 'Unbekannte Art'} onClose={onClose} actions={actions} notice={notice} canComment={manage} onComment={comment} log={v.log}
      badges={<><Badge tone={VOUCHER_STATUS[v.status].tone}>{VOUCHER_STATUS[v.status].label}</Badge>{expiresSoon(v, TODAY_ISO) && <Badge tone="warn">Läuft in {left} {left === 1 ? 'Tag' : 'Tagen'} ab</Badge>}{!v.paid && (v.proof ? <Badge tone="warn">Nachweis geprüft</Badge> : <Badge tone="bad">Zahlung offen</Badge>)}</>}
      panel={act && (
        act === 'redeem' ? <RedeemPanel v={v} onDone={update} sync={sync} onCancel={() => setAct(null)} /> :
        act === 'extend' ? <ExtendPanel v={v} onDone={update} onCancel={() => setAct(null)} /> :
        act === 'pay' ? <PayPanel v={v} onDone={pay} onCancel={() => setAct(null)} /> :
        act === 'mail' ? <MailPanel v={v} onDone={update} onCancel={() => setAct(null)} /> :
        <CancelPanel v={v} hasBooking={!!booking} onDone={(reason) => { if (booking) sync.cancel(booking.id); update({ status: 'cancelled', statusBeforeCancel: v.status, cancelReason: reason }, `Storniert: ${reason}`, 'Der Gutschein ist storniert.') }} onCancel={() => setAct(null)} />
      )}
      details={<>
        <Section title="Gutschein">
          <Row label="Art">{type?.name}</Row>
          <Row label="Gekauft am">{dmy(v.bought)}{v.legacy && <Badge>Aus Altsystem</Badge>}</Row>
          <Row label="Gültig bis"><span className={left < 0 ? 'text-bad' : expiresSoon(v, TODAY_ISO) ? 'text-warn' : ''}>{dmy(v.validUntil)}</span></Row>
          <Row label="Bezahlt"><span className="flex flex-wrap items-center justify-end gap-2">{eur(v.price)} · {v.paid ? `${PAY_NAME[v.pay]}${v.paidOn ? ` am ${dmy(v.paidOn)}` : ''}` : v.proof ? `noch offen · Bestätigung geprüft von ${v.proof.by} am ${dmy(v.proof.at)}${v.proof.note ? ` (${v.proof.note})` : ''}` : 'noch offen'}{v.payLineId && <Link to="/finanzen?tab=bank" className="font-medium text-brand hover:underline">In Finanzen</Link>}</span></Row>
          <Row label="Ertrag">{v.status === 'redeemed' || v.status === 'redeemed_noshow' ? 'Beim Flug verbucht' : v.status === 'cancelled' ? 'Keiner' : `Noch nicht verbucht, Verbindlichkeit ${eur(v.price)}`}</Row>
        </Section>
        <Section title="Termin">
          {booking && day ? (
            <>
              <Row label="Sprungtag">{dayName(day.date)}{window ? ` · ${windowLabel(window)}` : ''}</Row>
              <Row label="Gast">{booking.first} {booking.last}{booking.weight ? ` · ${booking.weight} kg` : ''}</Row>
              <Row label="Im Manifest"><Link to={`/manifest/${day.id}?tab=tandem`} className="font-medium text-brand hover:underline">Tag öffnen</Link></Row>
            </>
          ) : v.wishDay ? <Row label="Wunschtermin">{dayName(v.wishDay)}<Badge tone="warn">belegt keinen Platz</Badge></Row> : <Row label="Termin">Noch keiner</Row>}
        </Section>
        <Section title="Käufer">
          <Row label="Name">{fullName(v.buyer)}</Row>
          <Row label="E-Mail"><a href={`mailto:${v.buyer.email}`} className="text-brand hover:underline">{v.buyer.email}</a></Row>
          {v.buyer.phone && <Row label="Telefon">{v.buyer.phone}</Row>}
        </Section>
        {v.message && <Section title="Nachricht"><Row label="Persönliche Nachricht">{v.message}</Row></Section>}
      </>}
    />
  )
}

type Done = (patch: Partial<Voucher>, text: string, message?: string) => void

function RedeemPanel({ v, onDone, sync, onCancel }: { v: Voucher; onDone: Done; sync: ReturnType<typeof useManifestSync>; onCancel: () => void }) {
  const { bookings, days } = useApp()
  const booking = bookings.find((b) => b.id === v.bookingId)
  const [pencil, setPencil] = useState(false)
  const [slot, setSlot] = useState<Slot>(booking?.windowId ? { dayId: booking.dayId, windowId: booking.windowId } : NO_SLOT)
  const [wish, setWish] = useState(v.wishDay ?? '')
  const [first, setFirst] = useState(booking?.first ?? '')
  const [last, setLast] = useState(booking?.last ?? '')
  const [kg, setKg] = useState(booking?.weight ? String(booking.weight) : '')
  const day = days.find((d) => d.id === slot.dayId)
  const win = day?.windows.find((w) => w.id === slot.windowId)
  const okGuest = first.trim() !== '' && last.trim() !== ''
  const ok = pencil ? wish >= TODAY_ISO && wish <= v.validUntil : !!win && okGuest

  const confirm = () => {
    if (pencil) return onDone({ wishDay: wish, status: 'pre_scheduled' }, `Wunschtermin ${dmy(wish)} vorgemerkt, belegt keinen Platz`)
    const where = `${dayName(day!.date)} (${windowLabel(win!)})`
    if (booking) { sync.move(booking.id, slot.dayId, slot.windowId); return onDone({}, `Termin geändert auf ${where}`) }
    const id = `bk-${Date.now()}`
    sync.add({ id, dayId: slot.dayId, windowId: slot.windowId, first: first.trim(), last: last.trim(), weight: kg ? Number(kg) : undefined, email: v.buyer.email, phone: v.buyer.phone, source: 'Telefon', voucher: v.code, paidOnline: false, price: v.price, state: 'gebucht' })
    onDone({ bookingId: id, wishDay: undefined, status: 'reserved' }, `Termin ${where} gebucht für ${first.trim()} ${last.trim()}`)
  }
  return (
    <ActionPanel title={booking ? 'Termin ändern' : 'Termin buchen'} confirm={pencil ? 'Vormerken' : booking ? 'Termin ändern' : 'Termin buchen'} disabled={!ok} onConfirm={confirm} onCancel={onCancel}>
      {!booking && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pencil} onChange={(e) => setPencil(e.target.checked)} />Nur vormerken (Wunschtermin, belegt keinen Platz)</label>}
      {pencil ? (
        <Field label="Wunschtermin"><input type="date" aria-label="Wunschtermin" min={TODAY_ISO} max={v.validUntil} value={wish} onChange={(e) => setWish(e.target.value)} className={field} /></Field>
      ) : (
        <>
          <SlotPicker value={slot} onChange={setSlot} maxIso={v.validUntil} selfId={booking?.id} />
          {!booking && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Vorname des Gasts"><input aria-label="Vorname" value={first} onChange={(e) => setFirst(e.target.value)} className={input} /></Field>
              <Field label="Nachname"><input aria-label="Nachname" value={last} onChange={(e) => setLast(e.target.value)} className={input} /></Field>
              <Field label="Gewicht (kg)"><input aria-label="Gewicht" inputMode="numeric" value={kg} onChange={(e) => setKg(e.target.value.replace(/\D/g, ''))} className={input} /></Field>
            </div>
          )}
        </>
      )}
    </ActionPanel>
  )
}

const MONTHS = [1, 3, 6, 12]
function ExtendPanel({ v, onDone, onCancel }: { v: Voucher; onDone: Done; onCancel: () => void }) {
  const base = v.validUntil > TODAY_ISO ? v.validUntil : TODAY_ISO
  const [until, setUntil] = useState(addMonths(base, 3))
  const [reason, setReason] = useState('')
  const ok = until > base && reason !== ''
  return (
    <ActionPanel title="Gültigkeit verlängern" confirm="Verlängern" disabled={!ok} onConfirm={() => onDone({ validUntil: until, status: v.status === 'expired' ? (v.paid ? 'active' : 'unpaid') : v.status }, `Gültigkeit von ${dmy(v.validUntil)} auf ${dmy(until)} verlängert. Grund: ${reason}`, `Der Gutschein gilt jetzt bis ${dmy(until)}.`)} onCancel={onCancel}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Gültig bis"><input type="date" aria-label="Neues Ablaufdatum" min={base} value={until} onChange={(e) => setUntil(e.target.value)} className={field} /></Field>
        <div className="flex gap-1.5 pb-0.5">{MONTHS.map((m) => <Button key={m} onClick={() => setUntil(addMonths(base, m))}>+{m} {m === 1 ? 'Monat' : 'Monate'}</Button>)}</div>
      </div>
      <ReasonField onChange={setReason} />
    </ActionPanel>
  )
}

function PayPanel({ v, onDone, onCancel }: { v: Voucher; onDone: (c: PayChoice) => void; onCancel: () => void }) {
  const [c, setC] = useState<PayChoice>(NEW_PAY)
  return (
    <ActionPanel title="Zahlung erfassen" confirm={payConfirm(c, v.price)} disabled={!payReady(c)} onConfirm={() => onDone(c)} onCancel={onCancel}>
      <PaymentFields value={c} onChange={setC} amount={v.price} hint={v.code} />
    </ActionPanel>
  )
}

function MailPanel({ v, onDone, onCancel }: { v: Voucher; onDone: Done; onCancel: () => void }) {
  const [to, setTo] = useState(v.buyer.email)
  return (
    <ActionPanel title="Gutschein-PDF senden" confirm="Senden" disabled={!to.includes('@')} onConfirm={() => onDone({}, `Gutschein-PDF an ${to} gesendet`, `Das PDF ist an ${to} unterwegs.`)} onCancel={onCancel}>
      <Field label="An"><input type="email" aria-label="Empfänger" value={to} onChange={(e) => setTo(e.target.value)} className={input} /></Field>
    </ActionPanel>
  )
}

function CancelPanel({ v, hasBooking, onDone, onCancel }: { v: Voucher; hasBooking: boolean; onDone: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <ActionPanel danger title={`${v.code} stornieren`} confirm="Stornieren" disabled={!reason.trim()} onConfirm={() => onDone(reason.trim())} onCancel={onCancel}>
      {hasBooking && <div className="text-sm">Der gebuchte Termin wird mitstorniert.</div>}
      <Field label="Grund"><textarea aria-label="Stornogrund" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" /></Field>
    </ActionPanel>
  )
}
