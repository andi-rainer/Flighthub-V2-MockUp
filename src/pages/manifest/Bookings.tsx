import { FileText, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur } from '../../data'
import { flightNo, useApp, type Load } from '../../state'
import { Badge, Button, Card, Drawer, RowMenu, Segmented, Switch, type RowAction } from '../../ui'
import { nameOf } from '../members/data'
import PdfSheet from '../members/PdfSheet'
import { fullName, stageLabel, stageOf, tandemJumper, windowLabel, type BookingSource, type ManifestDay, type TandemBooking, type TandemWindow } from './data'
import { slots } from './slots'
import { MasterPick } from './TandemMaster'
import { GuestPayDrawer, PayBadge, useGuestPay } from './GuestPayment'

const stageTone = { erwartet: 'neutral', eingeplant: 'warn', wartend: 'ok', auf_flug: 'info' } as const
const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

/**
 * The tandem guests of one day, by window. The windows are what the shop offers: capacity, open or closed. A guest is first
 * expected, may be planned on a flight before arriving, checks in with the signed contract and then waits for the flight.
 */
export default function Bookings({ day, capacity }: { day: ManifestDay; capacity: number }) {
  const { bookings, setBookings, loads, setLoads, setDays, can, forms } = useApp()
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const [cancelling, setCancelling] = useState<TandemBooking | null>(null)
  const [contract, setContract] = useState<TandemBooking | null>(null)
  const [payFor, setPayFor] = useState<TandemBooking | null>(null)
  const guestPay = useGuestPay()
  const mine = bookings.filter((b) => b.dayId === day.id && b.state === 'gebucht')
  const countIn = (w: TandemWindow) => mine.filter((b) => b.windowId === w.id).length
  const mayManage = can('manifest.bookings.manage'), mayAssign = can('manifest.jumpers.assign'), mayCheckIn = can('manifest.checkin.others')
  const editable = day.status === 'geplant' || day.status === 'aktiv'
  const dayLoads = loads.filter((l) => l.dayId === day.id).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id)
  const loadOf = (b: TandemBooking) => dayLoads.find((l) => l.jumpers.some((j) => j.bookingId === b.id))

  const toggleWindow = (id: string, open: boolean) => setDays((all) => all.map((d) => (d.id === day.id ? { ...d, windows: d.windows.map((w) => (w.id === id ? { ...w, open } : w)) } : d)))
  const patch = (id: string, p: Partial<TandemBooking>) => setBookings((all) => all.map((b) => (b.id === id ? { ...b, ...p } : b)))
  const unplan = (b: TandemBooking) => setLoads((ls) => ls.map((l) => (l.dayId === day.id ? { ...l, jumpers: l.jumpers.filter((j) => j.bookingId !== b.id) } : l)))
  const plan = (b: TandemBooking, l: Load) => setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, jumpers: [...x.jumpers, tandemJumper(b)] } : x)))

  const actions = (b: TandemBooking): RowAction[] => {
    const l = loadOf(b)
    const out: RowAction[] = []
    if (b.checkin) out.push({ label: 'Vertrag ansehen', onSelect: () => setContract(b) })
    if (editable && mayAssign && !l) dayLoads.filter((x) => x.status === 'geplant' && slots(x.jumpers) + 2 <= capacity).forEach((x) => out.push({ label: `Auf Flug ${flightNo(loads, x)} (${x.time}) einplanen`, onSelect: () => plan(b, x) }))
    if (editable && mayAssign && l && l.status === 'geplant') out.push({ label: `Von Flug ${flightNo(loads, l)} nehmen`, onSelect: () => unplan(b) })
    if (editable && mayManage && !l) day.windows.filter((w) => w.id !== b.windowId && countIn(w) < w.capacity).forEach((w) => out.push({ label: `Ins Fenster ${windowLabel(w)} verschieben`, onSelect: () => patch(b.id, { windowId: w.id }) }))
    if (day.status === 'aktiv' && mayManage && !b.checkin) out.push({ label: 'Nicht erschienen', onSelect: () => { unplan(b); patch(b.id, { state: 'nicht_erschienen' }) } })
    if (editable && mayManage && !l) out.push({ label: 'Stornieren', danger: true, onSelect: () => setCancelling(b) })
    return out
  }

  const row = (b: TandemBooking) => {
    const l = loadOf(b)
    const stage = stageOf(b, !!l)
    const pay = guestPay.of(b)
    return (
      <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 basis-48">
          <div className="font-medium">{fullName(b)} <span className="font-normal text-muted">{b.weight ? `· ${b.weight} kg` : ''}</span></div>
          <div className="text-xs text-muted">{b.source}{pay.code ? <> · {pay.what} <span className="font-mono">{pay.code}</span></> : ' · ohne Ticket'} · {eur(b.price)}</div>
        </div>
        <PayBadge pay={pay} name={fullName(b)} onOpen={editable && guestPay.mayClear ? () => setPayFor(b) : undefined} />
        {editable && <MasterPick booking={b} className="w-52 shrink-0" />}
        <Badge tone={stageTone[stage]}>{l && stage !== 'wartend' ? `Flug ${flightNo(loads, l)} · ${l.time}` : stageLabel[stage]}</Badge>
        {b.checkin && <Badge tone="ok">Vertrag ✓</Badge>}
        {day.status === 'aktiv' && !b.checkin && mayCheckIn && <Button onClick={() => nav(`/checkin/${day.id}?b=${b.id}`)}>Check-in</Button>}
        {actions(b).length > 0 && <RowMenu actions={actions(b)} />}
      </div>
    )
  }

  const withoutWindow = mine.filter((b) => !b.windowId || !day.windows.some((w) => w.id === b.windowId))
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag size={16} /> Im Shop buchbar</div>
          {editable && mayManage && <Button onClick={() => setAdding(true)}>Gast anlegen</Button>}
        </div>
        <ul className="divide-y divide-line text-sm">
          {day.windows.map((w) => {
            const free = w.capacity - countIn(w)
            return (
              <li key={w.id} className="flex items-center gap-3 py-2">
                <span className="w-28 font-medium tabular-nums">{windowLabel(w)}</span>
                <span className="flex-1 text-muted">{countIn(w)} von {w.capacity} gebucht</span>
                {!w.open ? <Badge>geschlossen</Badge> : free <= 0 ? <Badge tone="warn">ausgebucht</Badge> : <Badge tone="ok">{free} frei</Badge>}
                {editable && mayManage && <Switch checked={w.open} label={`Fenster ${windowLabel(w)} im Shop buchbar`} onChange={(v) => toggleWindow(w.id, v)} />}
              </li>
            )
          })}
          {day.windows.length === 0 && <li className="py-2 text-muted">Dieser Tag hat keine Tandem-Fenster. Im Shop ist nichts buchbar.</li>}
        </ul>
      </Card>

      {day.windows.map((w) => {
        const list = mine.filter((b) => b.windowId === w.id)
        return (
          <section key={w.id}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{windowLabel(w)} <span className="font-normal normal-case">· {list.length} von {w.capacity}</span></h2>
            <Card className="divide-y divide-line">{list.map(row)}{list.length === 0 && <p className="px-4 py-4 text-sm text-muted">Noch keine Buchung.</p>}</Card>
          </section>
        )
      })}
      {withoutWindow.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Ohne Fenster</h2>
          <Card className="divide-y divide-line">{withoutWindow.map(row)}</Card>
        </section>
      )}

      {payFor && <GuestPayDrawer booking={payFor} onClose={() => setPayFor(null)} />}
      <GuestDrawer open={adding} day={day} onClose={() => setAdding(false)} countIn={countIn} />
      <Drawer open={!!cancelling} title="Buchung stornieren" onClose={() => setCancelling(null)}>
        {cancelling && <CancelForm b={cancelling} onClose={() => setCancelling(null)} onCancel={() => { patch(cancelling.id, { state: 'storniert' }); setCancelling(null) }} />}
      </Drawer>
      <Drawer open={!!contract} title={contract ? `Beförderungsvertrag · ${fullName(contract)}` : ''} size="xl" onClose={() => setContract(null)}>
        {contract?.checkin && (() => {
          const f = forms.find((x) => x.id === 'befoerderung'), v = f?.versions.find((x) => x.status === 'aktiv')
          return f && v ? <PdfSheet title={nameOf(f, contract.checkin.lang)} version={v} answers={contract.checkin.answers} signedAt={contract.checkin.at} channel="Vor Ort" lang={contract.checkin.lang} /> : null
        })()}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted"><FileText size={14} /> {contract?.checkin?.pdf}</div>
      </Drawer>
    </div>
  )
}

function CancelForm({ b, onCancel }: { b: TandemBooking; onClose: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-4">
      <p className="text-sm">{fullName(b)} wird aus dem Tag genommen.{(b.voucher || b.paidOnline) && ' Der Gast bekommt einen Umbuchungs-Link per Mail.'}</p>
      <div className="flex flex-wrap gap-2">{['Gast hat abgesagt', 'Wetter', 'Betrieb', 'Sonstiges'].map((r) => <button key={r} onClick={() => setReason(r)} className={`rounded-lg border px-3 py-2 text-sm ${reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface'}`}>{r}</button>)}</div>
      <Button variant="danger" disabled={!reason} onClick={onCancel}>Stornieren</Button>
    </div>
  )
}

/** A guest booked by phone or at the desk. Online bookings come from the shop. */
function GuestDrawer({ open, day, onClose, countIn }: { open: boolean; day: ManifestDay; onClose: () => void; countIn: (w: TandemWindow) => number }) {
  const { setBookings } = useApp()
  const [first, setFirst] = useState(''), [last, setLast] = useState(''), [kg, setKg] = useState(''), [phone, setPhone] = useState(''), [voucher, setVoucher] = useState('')
  const [source, setSource] = useState<BookingSource>('Telefon')
  const [windowId, setWindowId] = useState('')
  const ok = first.trim() && last.trim() && Number(kg) > 0
  const save = () => {
    setBookings((all) => [...all, { id: `bk-${Date.now()}`, dayId: day.id, windowId: windowId || undefined, first: first.trim(), last: last.trim(), weight: Number(kg), phone: phone.trim() || undefined, source, voucher: voucher.trim() || undefined, paidOnline: false, price: 220, state: 'gebucht' }])
    setFirst(''); setLast(''); setKg(''); setPhone(''); setVoucher(''); setWindowId('')
    onClose()
  }
  return (
    <Drawer open={open} title="Tandem-Gast anlegen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!ok} onClick={save}>Anlegen</Button></div>}>
      <div className="space-y-4">
        <Segmented value={source} onChange={setSource} options={[{ value: 'Telefon', label: 'Telefon' }, { value: 'Vor Ort', label: 'Vor Ort' }]} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Vorname<input value={first} onChange={(e) => setFirst(e.target.value)} className={field} /></label>
          <label className="block text-sm font-medium">Nachname<input value={last} onChange={(e) => setLast(e.target.value)} className={field} /></label>
          <label className="block text-sm font-medium">Gewicht (kg)<input inputMode="numeric" value={kg} onChange={(e) => setKg(e.target.value.replace(/\D/g, ''))} className={field} /></label>
          <label className="block text-sm font-medium">Telefon<input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} /></label>
        </div>
        <label className="block text-sm font-medium">Zeitfenster
          <select value={windowId} onChange={(e) => setWindowId(e.target.value)} className={field}>
            <option value="">Ohne Fenster</option>
            {day.windows.map((w) => <option key={w.id} value={w.id} disabled={countIn(w) >= w.capacity}>{windowLabel(w)}{countIn(w) >= w.capacity ? ' (voll)' : ''}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Voucher-Code (optional)<input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Ohne Code zahlt der Gast beim Abschluss" className={field} /></label>
      </div>
    </Drawer>
  )
}
