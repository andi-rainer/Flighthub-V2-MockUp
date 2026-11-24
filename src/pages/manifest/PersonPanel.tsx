import clsx from 'clsx'
import { CalendarClock, Check, FileText, Plane, Ticket, UserX, Wallet, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur, type Jumper } from '../../data'
import { flightNo, useApp, type Load } from '../../state'
import { Drawer, useConfirm } from '../../ui'
import { nameOf as formName } from '../members/data'
import { docIssue } from '../members/memberDocs'
import PdfSheet from '../members/PdfSheet'
import { fullName, windowLabel, type ManifestDay, type TandemBooking } from './data'
import { PayBadge, useGuestPay } from './GuestPayment'
import { POSTPONE_REASONS, postponeSlots, reasonReady, reasonText, useGuestOutcome, type PostponeReason } from './postpone'
import { payLabel, useSettle } from './Settle'
import { settledPrice } from './settleStore'
import { slots } from './slots'
import { MasterPick } from './TandemMaster'
import { LoadEditLink } from './LoadEdit'

interface Props {
  day: ManifestDay; jumper: Jumper; capacity: number
  onClose: () => void
  /** Puts the person on this flight (same rules as tap and drag). */ onPlace: (loadId: number) => void
  onDocs: (memberId: string) => void; onDeposit: (memberId: string) => void; onCheckout: (memberId: string) => void
  /** [Entwurf] "Kosten hinzufügen": Zusatzkosten for the member. */ onExtras?: (memberId: string) => void
  /** [Entwurf] "Korrigieren" of the member's last settlement today (payment and Zusatzkosten). */ onCorrect?: (memberId: string) => void
  onPay: (bookingId: string) => void; onTicket: (bookingId: string) => void
}

/**
 * [Entwurf] Everything about one person of the day in one side panel, opened from "Wartend", "Schon eingeplant", "In der Luft" or "Erwartet".
 * Sport jumper: flights, weight, documents, money, check-out. Tandem guest: ticket and payment, master, weight, check-in, flight, window and
 * what happens when the guest does not fly today.
 */
export default function PersonPanel(p: Props) {
  const title = p.jumper.kind === 'sport' ? p.jumper.name : p.jumper.name.replace(/^Tandem: /, '')
  const { bookings } = useApp()
  const b = p.jumper.bookingId ? bookings.find((x) => x.id === p.jumper.bookingId) : undefined
  return (
    <Drawer open title={b ? fullName(b) : title} onClose={p.onClose}>
      {p.jumper.kind === 'sport' && p.jumper.memberId ? <SportPanel {...p} memberId={p.jumper.memberId} /> : b ? <GuestPanel {...p} booking={b} /> : null}
    </Drawer>
  )
}

// ---------- Sport jumper ----------

function SportPanel({ day, jumper: j, memberId, capacity, onPlace, onDocs, onDeposit, onCheckout, onExtras, onCorrect }: Props & { memberId: string }) {
  const { loads, setLoads, weights, setWeight, can, docsOf } = useApp()
  const settle = useSettle(day)
  const running = day.status === 'aktiv'
  const mayAssign = can('manifest.jumpers.assign'), mayMoney = can('manifest.payments.update'), mayOut = can('manifest.checkin.others')
  const dayLoads = loads.filter((l) => l.dayId === day.id).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id)
  const mine = dayLoads.filter((l) => l.jumpers.some((x) => x.id === j.id))
  const flown = mine.filter((l) => l.status === 'gelandet' && l.jumpers.some((x) => x.id === j.id && !x.noShow)).length
  const air = mine.find((l) => l.status === 'in_air')
  const pending = mine.filter((l) => l.status === 'geplant' || l.status === 'boarding')
  const free = dayLoads.filter((l) => l.status === 'geplant' && !l.jumpers.some((x) => x.id === j.id) && slots(l.jumpers) + 1 <= capacity)
  const off = (l: Load) => setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, jumpers: x.jumpers.filter((y) => y.id !== j.id) } : x)))
  const kg = weights[memberId]
  const changeKg = (n: number) => {
    setWeight(memberId, n)
    setLoads((ls) => ls.map((l) => (l.dayId === day.id && (l.status === 'geplant' || l.status === 'boarding') ? { ...l, jumpers: l.jumpers.map((x) => (x.id === j.id ? { ...x, weight: n || undefined } : x)) } : l)))
  }
  const issue = docIssue(docsOf(memberId))
  const o = settle.open(memberId), balance = settle.balance(memberId)
  const last = settle.done.filter((x) => x.memberId === memberId && (x.loadIds.length > 0 || x.extras.length > 0)).pop()

  return (
    <div className="space-y-6">
      <Facts items={[
        ['Status', air ? `In der Luft · Flug ${flightNo(loads, air)}` : pending.length > 0 ? `Eingeplant · Flug ${pending.map((l) => flightNo(loads, l)).join(', ')}` : 'Wartend'],
        ['Heute', flown > 0 ? `${flown}× gesprungen` : 'noch nicht gesprungen'],
        ['Konto', <span className={clsx('tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</span>],
      ]} />

      <Section title="Flüge">
        {mine.filter((l) => l.status === 'gelandet').map((l) => (
          <Line key={l.id} icon={<Check size={18} />} tone="ok" title={`Flug ${flightNo(loads, l)} · ${l.time}`} sub={l.jumpers.some((x) => x.id === j.id && x.noShow) ? 'gelandet · Platz bezahlt' : 'gelandet'}>
            <LoadEditLink day={day} load={l} focus={memberId} />
          </Line>
        ))}
        {pending.map((l) => (
          <Line key={l.id} icon={<Plane size={18} />} title={`Flug ${flightNo(loads, l)} · ${l.time}`} sub={l.status === 'boarding' ? 'Boarding' : 'eingeplant'}>
            {mayAssign && l.status === 'geplant' && <Act onClick={() => off(l)}><X size={16} /> Abnehmen</Act>}
          </Line>
        ))}
        {mayAssign && running && (free.length > 0
          ? <div className="grid grid-cols-2 gap-2">{free.map((l) => <Act key={l.id} wide onClick={() => onPlace(l.id)}><span className="font-semibold">Flug {flightNo(loads, l)}</span><span className="text-muted">{l.time} · {capacity - slots(l.jumpers)} frei</span></Act>)}</div>
          : <Hint>Kein geplanter Flug mit freiem Platz.</Hint>)}
      </Section>

      <Section title="Gewicht"><Kg value={kg} onChange={changeKg} disabled={!mayOut} /></Section>

      {(issue || can('documents.view.all')) && (
        <Section title="Dokumente">
          <Line icon={<FileText size={18} />} tone={issue?.tone} title={issue ? issue.label : 'In Ordnung'}>
            <Act onClick={() => onDocs(memberId)}>{issue ? 'Prüfen' : 'Öffnen'}</Act>
          </Line>
        </Section>
      )}

      {running && (mayMoney || mayOut) && (
        <Section title="Geld und Gehen">
          {o.loadIds.length > 0 && <Line icon={<Wallet size={18} />} title={`Offen ${eur(o.price)}`} sub={o.flight} />}
          {last && mayMoney && onCorrect && (
            <Line icon={<Check size={18} />} tone="ok" title={`Abgerechnet ${eur(settledPrice(last))}`} sub={`${payLabel(settledPrice(last), last.cash)} · ${last.time}${last.fixes.length ? ' · korrigiert' : ''}`}>
              <Act onClick={() => onCorrect(memberId)}>Korrigieren</Act>
            </Line>
          )}
          {mayMoney && <div className="grid grid-cols-2 gap-2"><Act wide onClick={() => onDeposit(memberId)}>Bar einzahlen</Act>{onExtras && <Act wide onClick={() => onExtras(memberId)}>Kosten hinzufügen</Act>}</div>}
          {mayOut && <Act wide primary onClick={() => onCheckout(memberId)}>{o.loadIds.length > 0 ? 'Abrechnen und auschecken' : 'Auschecken'}</Act>}
        </Section>
      )}
    </div>
  )
}

// ---------- Tandem guest ----------

type Leave = null | 'verschieben' | 'nicht_erschienen' | 'stornieren'
const CANCEL_REASONS = ['Gast hat abgesagt', 'Wetter', 'Betrieb', 'Sonstiges'] as const

function GuestPanel({ day, booking: b, capacity, onClose, onPlace, onPay, onTicket }: Props & { booking: TandemBooking }) {
  const { loads, setLoads, bookings, setBookings, days, can, forms } = useApp()
  const nav = useNavigate()
  const guestPay = useGuestPay()
  const outcome = useGuestOutcome(day)
  const [leave, setLeave] = useState<Leave>(null)
  const [reason, setReason] = useState<PostponeReason | undefined>()
  const [note, setNote] = useState('')
  const [slot, setSlot] = useState<string | undefined>()
  const [cancel, setCancel] = useState('')
  const [contract, setContract] = useState(false)
  const editable = day.status === 'geplant' || day.status === 'aktiv', running = day.status === 'aktiv'
  const mayAssign = can('manifest.jumpers.assign'), mayManage = can('manifest.bookings.manage'), mayCheckIn = can('manifest.checkin.others')
  const pay = guestPay.of(b)
  const dayLoads = loads.filter((l) => l.dayId === day.id).sort((a, c) => a.time.localeCompare(c.time) || a.id - c.id)
  const onLoad = dayLoads.find((l) => l.jumpers.some((x) => x.bookingId === b.id))
  const free = dayLoads.filter((l) => l.status === 'geplant' && slots(l.jumpers) + 2 <= capacity)
  const w = day.windows.find((x) => x.id === b.windowId)
  const mine = bookings.filter((x) => x.dayId === day.id && x.state === 'gebucht')
  const windows = day.windows.filter((x) => x.id !== b.windowId && mine.filter((y) => y.windowId === x.id).length < x.capacity)
  const patch = (pt: Partial<TandemBooking>) => setBookings((all) => all.map((x) => (x.id === b.id ? { ...x, ...pt } : x)))
  const changeKg = (n: number) => {
    patch({ weight: n || undefined })
    setLoads((ls) => ls.map((l) => (l.dayId === day.id ? { ...l, jumpers: l.jumpers.map((x) => (x.bookingId === b.id ? { ...x, weight: n || undefined } : x)) } : l)))
  }
  const validUntil = pay.what === 'Gutschein' ? (pay.item as { validUntil?: string } | undefined)?.validUntil : undefined
  const slotList = postponeSlots({ days, bookings, day, booking: b, validUntil, keep: slot })
  const item = pay.what ? `${pay.what} ${pay.code ?? ''}`.trim() : pay.code
  const f = forms.find((x) => x.id === 'befoerderung'), v = f?.versions.find((x) => x.status === 'aktiv')
  const done = (fn: () => void) => { fn(); onClose() }
  const confirm = useConfirm()
  const who = fullName(b), what = item ?? 'Buchung'

  return (
    <div className="space-y-6">
      <Facts items={[
        ['Status', onLoad ? `Flug ${flightNo(loads, onLoad)} · ${onLoad.time}` : b.checkin ? 'Eingecheckt, wartet' : 'Erwartet'],
        ['Fenster', w ? windowLabel(w) : 'ohne Fenster'],
        ['Buchung', `${b.source} · ${eur(pay.item?.price ?? b.price)}`],
        ...(b.phone ? [['Telefon', b.phone] as [string, ReactNode]] : []),
      ]} />

      <Section title="Ticket und Zahlung">
        {item
          ? <Line icon={<Ticket size={18} />} title={item} sub={pay.item ? `Käufer ${fullName(pay.item.buyer)}` : undefined}>
              <PayBadge pay={pay} name={fullName(b)} />
            </Line>
          : <Line icon={<Ticket size={18} />} tone="warn" title="Kein Ticket" />}
        {guestPay.mayClear && editable && (pay.state === 'offen' || pay.state === 'nachweis') && pay.item && <Act wide primary onClick={() => onPay(b.id)}>Zahlung klären</Act>}
        {guestPay.mayClear && editable && pay.state === 'vor_ort' && !pay.item && <Act wide primary onClick={() => onTicket(b.id)}>Ticket anlegen</Act>}
      </Section>

      <Section title="Tandemmaster"><MasterPick booking={b} className="w-full" /></Section>

      <Section title="Gewicht"><Kg value={b.weight} onChange={changeKg} disabled={!editable || !(mayCheckIn || mayManage)} /></Section>

      <Section title="Check-in">
        {b.checkin
          ? <Line icon={<Check size={18} />} tone="ok" title="Vertrag unterschrieben" sub={b.checkin.at}><Act onClick={() => setContract(true)}>Vertrag</Act></Line>
          : running && mayCheckIn ? <Act wide primary onClick={() => nav(`/checkin/${day.id}?b=${b.id}`)}>Check-in starten</Act> : <Hint>Noch nicht eingecheckt.</Hint>}
      </Section>

      {editable && mayAssign && (
        <Section title="Auf Flug setzen">
          {onLoad
            ? <Line icon={<Plane size={18} />} title={`Flug ${flightNo(loads, onLoad)} · ${onLoad.time}`}>{onLoad.status === 'geplant' && <Act onClick={() => setLoads((ls) => ls.map((l) => (l.id === onLoad.id ? { ...l, jumpers: l.jumpers.filter((x) => x.bookingId !== b.id) } : l)))}><X size={16} /> Abnehmen</Act>}</Line>
            : free.length > 0
              ? <div className="grid grid-cols-2 gap-2">{free.map((l) => <Act key={l.id} wide onClick={() => done(() => onPlace(l.id))}><span className="font-semibold">Flug {flightNo(loads, l)}</span><span className="text-muted">{l.time} · {Math.floor((capacity - slots(l.jumpers)) / 2)} Tandem frei</span></Act>)}</div>
              : <Hint>Kein geplanter Flug mit Platz für ein Tandem.</Hint>}
        </Section>
      )}

      {editable && mayManage && !onLoad && windows.length > 0 && (
        <Section title="Anderes Zeitfenster heute">
          <div className="flex flex-wrap gap-2">{windows.map((x) => <Chip key={x.id} on={false} onClick={() => patch({ windowId: x.id })}>{windowLabel(x)}</Chip>)}</div>
        </Section>
      )}

      {editable && mayManage && (
        <Section title="Fliegt heute nicht">
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <Pick on={leave === 'verschieben'} onClick={() => setLeave(leave === 'verschieben' ? null : 'verschieben')} icon={<CalendarClock size={18} />}>Verschieben</Pick>
            {running && !b.checkin && <Pick on={leave === 'nicht_erschienen'} onClick={() => setLeave(leave === 'nicht_erschienen' ? null : 'nicht_erschienen')} icon={<UserX size={18} />}>Nicht erschienen</Pick>}
            {!onLoad && <Pick on={leave === 'stornieren'} danger onClick={() => setLeave(leave === 'stornieren' ? null : 'stornieren')} icon={<X size={18} />}>Stornieren</Pick>}
          </div>
          {leave === 'verschieben' && (
            <div className="space-y-4 rounded-xl border border-line p-4">
              <div>
                <Label>Grund</Label>
                <div className="flex flex-wrap gap-2">{POSTPONE_REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
                {reason === 'Sonstiges' && <input aria-label="Was war los?" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was war los?" className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand" />}
              </div>
              <div>
                <Label>Neuer Termin</Label>
                <div className="flex flex-wrap gap-2">
                  <Chip on={!slot} onClick={() => setSlot(undefined)}>Termin offen</Chip>
                  {slotList.map((s) => <Chip key={s.key} on={slot === s.key} onClick={() => setSlot(s.key)}>{s.label}</Chip>)}
                </div>
              </div>
              <Act wide primary disabled={!reasonReady(reason, note)} onClick={() => confirm.ask({
                title: `${who} verschieben?`, confirm: 'Ja, verschieben',
                lines: [<b className="font-semibold">{what} bleibt gültig · {slot ? slotList.find((x) => x.key === slot)?.label : 'Termin offen'}</b>, `Grund: ${reasonText(reason, note)}`, `Mail an ${b.email ?? 'den Käufer'}`],
                run: () => done(() => outcome(b, 'verschoben', reasonText(reason, note), slot)),
              })}>Verschieben</Act>
            </div>
          )}
          {leave === 'nicht_erschienen' && (
            <div className="space-y-3 rounded-xl border border-line p-4">
              <div className="text-base">{item ? `${item} verfällt` : 'Buchung verfällt'}{pay.item && !pay.item.paid ? ', Zahlung bleibt offen' : ''}</div>
              <Act wide danger onClick={() => confirm.ask({
                title: `${who}: nicht erschienen?`, confirm: 'Ja, nicht erschienen', danger: true,
                lines: [<b className="font-semibold">{what} verfällt{pay.item && !pay.item.paid ? ', Zahlung bleibt offen' : ''}</b>, `Mail an ${b.email ?? 'den Käufer'}`],
                run: () => done(() => outcome(b, 'nicht_erschienen')),
              })}>Nicht erschienen</Act>
            </div>
          )}
          {leave === 'stornieren' && (
            <div className="space-y-3 rounded-xl border border-line p-4">
              <Label>Grund</Label>
              <div className="flex flex-wrap gap-2">{CANCEL_REASONS.map((r) => <Chip key={r} on={cancel === r} onClick={() => setCancel(r)}>{r}</Chip>)}</div>
              <Act wide danger disabled={!cancel} onClick={() => confirm.ask({ title: `Buchung von ${who} stornieren?`, confirm: 'Ja, stornieren', danger: true, lines: [`Grund: ${cancel}`], run: () => done(() => patch({ state: 'storniert' })) })}>Stornieren</Act>
            </div>
          )}
        </Section>
      )}

      {confirm.dialog}
      <Drawer open={contract && !!b.checkin} title={`Beförderungsvertrag · ${fullName(b)}`} size="xl" onClose={() => setContract(false)}>
        {b.checkin && f && v && <PdfSheet title={formName(f, b.checkin.lang)} version={v} answers={b.checkin.answers} signedAt={b.checkin.at} channel="Vor Ort" lang={b.checkin.lang} />}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted"><FileText size={14} /> {b.checkin?.pdf}</div>
      </Drawer>
    </div>
  )
}

// ---------- Building blocks, sized for a finger on a tablet ----------

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line rounded-xl bg-slate-50">
      {items.map(([k, val]) => <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5"><dt className="text-sm text-muted">{k}</dt><dd className="min-w-0 text-right text-base font-medium">{val}</dd></div>)}
    </dl>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>{children}</section>
}

function Label({ children }: { children: ReactNode }) { return <div className="mb-1.5 text-sm text-muted">{children}</div> }
function Hint({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">{children}</div> }

function Line({ icon, title, sub, tone, children }: { icon: ReactNode; title: string; sub?: string; tone?: 'ok' | 'warn' | 'bad'; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl border border-line px-3 py-2">
      <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', tone === 'bad' ? 'bg-bad-soft text-bad' : tone === 'warn' ? 'bg-warn-soft text-warn' : tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-slate-100 text-muted')}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-base font-medium">{title}</span>{sub && <span className="block truncate text-sm text-muted">{sub}</span>}</span>
      {children && <span className="flex shrink-0 items-center gap-2">{children}</span>}
    </div>
  )
}

function Act({ children, onClick, wide, primary, danger, disabled }: { children: ReactNode; onClick: () => void; wide?: boolean; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx('inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-4 text-base font-medium transition active:scale-[0.98] disabled:opacity-40',
        wide && 'w-full flex-col gap-0 py-2 leading-tight [&>span]:text-sm',
        primary ? 'bg-brand text-white hover:bg-blue-700' : danger ? 'bg-bad text-white hover:opacity-90' : 'border border-line bg-surface hover:bg-slate-50')}>
      {children}
    </button>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick}
      className={clsx('inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 text-base font-medium transition', on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface hover:bg-slate-50')}>
      {on && <Check size={16} />}{children}
    </button>
  )
}

function Pick({ on, onClick, icon, danger, children }: { on: boolean; onClick: () => void; icon: ReactNode; danger?: boolean; children: ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick}
      className={clsx('flex h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-base font-medium transition active:scale-[0.98]', on ? (danger ? 'border-bad bg-bad-soft text-bad' : 'border-brand bg-brand-soft text-brand') : 'border-line bg-surface text-ink hover:bg-slate-50')}>
      {icon}{children}
    </button>
  )
}

/** Weight with big minus and plus: typing on a tablet is slow. */
function Kg({ value, onChange, disabled }: { value?: number; onChange: (n: number) => void; disabled?: boolean }) {
  const n = value ?? 0
  const step = (d: number) => onChange(Math.max(0, (n || 80) + d))
  return (
    <div className="flex items-center gap-2">
      <button aria-label="Ein Kilo weniger" disabled={disabled} onClick={() => step(-1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-surface text-2xl font-medium disabled:opacity-40">−</button>
      <label className={clsx('flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-surface px-4 focus-within:border-brand', n ? 'border-line' : 'border-warn')}>
        <input inputMode="numeric" aria-label="Gewicht in kg" disabled={disabled} value={n || ''} placeholder="fehlt" onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} onFocus={(e) => e.target.select()} className="h-full min-w-0 flex-1 bg-transparent text-center text-xl tabular-nums outline-none" />
        <span className="text-muted">kg</span>
      </label>
      <button aria-label="Ein Kilo mehr" disabled={disabled} onClick={() => step(1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-surface text-2xl font-medium disabled:opacity-40">+</button>
    </div>
  )
}

