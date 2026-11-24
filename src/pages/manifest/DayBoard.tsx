import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, ExternalLink, FileText, UserCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBack } from '../../backTo'
import MemberPicker from '../../MemberPicker'
import { members, type Jumper, type Member } from '../../data'
import { toAbs } from '../../dates'
import { flightNo, sportJumper, useApp, type Load } from '../../state'
import { Badge, Banner, Button, Card, Drawer, PageHeader, RowMenu, Segmented } from '../../ui'
import Closing from '../Closing'
import { DayReportDrawer, useDayReview } from '../finance/DayReport'
import QuickTicket from '../tickets/QuickTicket'
import { DAY_CHECK, useDayCheck } from './dayCheck'
import Bookings from './Bookings'
import { capacityOf, dayName, fullName, hm, minutes, missingDuties, perPerson, sportPriceOn, tandemJumper, windowAt, windowLabel, withShifts, dayHours, type DayStatus, type ManifestDay } from './data'
import DutyFields from './DutyFields'
import DutySummary from './DutySummary'
import DayForm from './DayForm'
import FlightCard from './FlightCard'
import FlightsDrawer from './FlightsDrawer'
import MemberDocuments from '../members/MemberDocuments'
import { docIssue } from '../members/memberDocs'
import KioskDrawer from './KioskDrawer'
import { slots } from './slots'
import SportCheckIn from './SportCheckIn'
import { DepositSheet, SettleSheet } from './Settle'
import { useSettleStore, type Settlement } from './settleStore'
import { masterShort } from './TandemMaster'
import PersonPanel from './PersonPanel'
import { GuestPayDrawer, PayBadge, useGuestPay } from './GuestPayment'

const statusTone: Record<DayStatus, 'ok' | 'info' | 'neutral' | 'bad'> = { aktiv: 'ok', geplant: 'info', abgeschlossen: 'neutral', abgesagt: 'bad' }
const statusLabel: Record<DayStatus, string> = { aktiv: 'Läuft', geplant: 'Geplant', abgeschlossen: 'Abgeschlossen', abgesagt: 'Abgesagt' }

/** `/manifest/:dayId`: finds the day, everything else happens in the board. */
export default function DayBoard() {
  const { dayId } = useParams()
  const { days } = useApp()
  const nav = useNavigate()
  const day = days.find((d) => d.id === dayId)
  if (!day) return <Card className="mx-auto mt-10 max-w-md p-8 text-center"><div className="font-semibold">Diesen Tag gibt es nicht</div><Button className="mt-4" onClick={() => nav('/manifest')}>Zurück zu Manifest</Button></Card>
  return <Board key={day.id} day={day} />
}

function Board({ day }: { day: ManifestDay }) {
  const { loads, setLoads, setDays, bookings, checkedIn, weights, can, reservations, setReservations, settings, memberCan, docsOf, ledger } = useApp()
  const nav = useNavigate()
  const { label, back } = useBack({ label: 'Manifest', to: '/manifest' })
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<'betrieb' | 'abschluss'>('betrieb')
  const [selected, setSelected] = useState<string[]>([])
  const [dragging, setDragging] = useState<string[]>([])
  const [bulkPilot, setBulkPilot] = useState('')
  const [docsFor, setDocsFor] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [ticketFor, setTicketFor] = useState<string | null>(null)
  // [Entwurf] The side panel of one person in Wartend / Schon eingeplant / In der Luft / Erwartet: all options in one place.
  const [panelFor, setPanelFor] = useState<string | null>(null)
  const guestPay = useGuestPay()
  // [Entwurf] The closing of the day and its check; `?pruefen=1` (task on the dashboard) opens the Tagesabschluss at once.
  const closing = useDayCheck().current(ledger.dayReports, day.id)
  const review = useDayReview()
  const [reportOpen, setReportOpen] = useState(() => params.get('pruefen') === '1' && !!closing)
  const [dialog, setDialog] = useState<null | 'checkin' | 'kiosk' | 'edit' | 'flights' | 'cancel' | 'duties' | 'pilot'>(null)

  const missing = missingDuties(day, settings.roles)
  const mayAssign = can('manifest.jumpers.assign'), mayCreateFlight = can('manifest.flights.create'), mayClose = can('manifest.payments.update'), mayCheckInOthers = can('manifest.checkin.others'), mayEditDay = can('manifest.operation_days.edit')
  const running = day.status === 'aktiv', open = day.status === 'geplant' || running
  const capacity = capacityOf(day.aircraft)
  const hasTandem = day.windows.length > 0 || bookings.some((b) => b.dayId === day.id && b.state === 'gebucht')
  const tab = hasTandem && params.get('tab') === 'tandem' ? 'tandem' : 'fluege'

  const dayLoads = loads.filter((l) => l.dayId === day.id).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id)
  // A tandem guest flies once: from the first flight on they are not available. A sport jumper is available again once the flight is down,
  // and can already be planned on a further flight while still in the air; only a flight that has not left yet takes them out of the list.
  const onLoad = new Set(dayLoads.flatMap((l) => l.jumpers.map((j) => j.id)))
  const pendingLoads = (id: string) => dayLoads.filter((l) => (l.status === 'geplant' || l.status === 'boarding') && l.jumpers.some((j) => j.id === id))
  const airLoad = (id: string) => dayLoads.find((l) => l.status === 'in_air' && l.jumpers.some((j) => j.id === id))
  const flown = (id: string) => dayLoads.filter((l) => l.status === 'gelandet' && l.jumpers.some((j) => j.id === id && !j.noShow)).length
  const byId = (id: string) => members.find((m) => m.id === id)!
  // The price of the day itself: a later price change does not touch this day.
  const sportPrice = sportPriceOn(settings, day.date)
  const mine = bookings.filter((b) => b.dayId === day.id && b.state === 'gebucht')

  // Who can be put on a flight. Present = here and waiting. Expected = booked, not here yet (can be planned in advance, V1 "Vorab einplanen").
  // A sport jumper can be planned on several flights that have not left yet: everyone who is here stays selectable. They are listed under
  // "Wartend" (not planned), "Schon eingeplant" or "In der Luft", depending on where they are right now.
  const sportHere = running ? checkedIn.map((id) => sportJumper(byId(id), weights[id], sportPrice)) : []
  const airborne = sportHere.filter((j) => airLoad(j.id))
  const planned = sportHere.filter((j) => !airLoad(j.id) && pendingLoads(j.id).length > 0)
  const present: Jumper[] = [
    ...mine.filter((b) => b.checkin && !onLoad.has(`t-${b.id}`)).map(tandemJumper),
    ...sportHere.filter((j) => !airLoad(j.id) && pendingLoads(j.id).length === 0),
  ]
  const expected = mine.filter((b) => !b.checkin && !onLoad.has(`t-${b.id}`))
  const everyone = [...present, ...planned, ...airborne, ...expected.map(tandemJumper)]
  const planTag = (id: string) => { const f = pendingLoads(id).map((l) => `Flug ${flightNo(loads, l)}`); return f.length > 0 ? `eingeplant: ${f.join(', ')}` : undefined }

  // Nobody sits twice on the same flight.
  const addable = (l: Load, ids: string[]) => everyone.filter((j) => ids.includes(j.id) && !l.jumpers.some((x) => x.id === j.id))
  const place = (loadId: number, ids: string[]) => {
    const target = dayLoads.find((l) => l.id === loadId)
    const picked = target ? addable(target, ids) : []
    if (picked.length === 0) return
    setLoads((ls) => ls.map((l) => (l.id === loadId ? { ...l, jumpers: [...l.jumpers, ...picked] } : l)))
    setSelected([])
    setDragging([])
  }
  // Tandems come first: guests who are here, then those expected in the window the flight lies in. Sport jumpers fill what is left.
  const autoFill = (l: Load) => {
    const w = windowAt(day.windows, l.time)
    const order = [...present.filter((j) => j.kind === 'tandem'), ...expected.filter((b) => w && b.windowId === w.id).map(tandemJumper), ...present.filter((j) => j.kind === 'sport')]
    let free = capacity - slots(l.jumpers)
    const ids: string[] = []
    for (const j of order) { const s = slots([j]); if (s <= free) { ids.push(j.id); free -= s } }
    return ids
  }
  // Per window: how many tandems are booked, how many sit on a flight, and whether the flights in the window have room for the rest.
  const coverage = day.windows.map((w) => {
    const guests = mine.filter((b) => b.windowId === w.id)
    const open = guests.filter((b) => !onLoad.has(`t-${b.id}`)).length
    const flights = dayLoads.filter((l) => l.status === 'geplant' && windowAt(day.windows, l.time)?.id === w.id)
    const room = flights.reduce((n, l) => n + Math.floor((capacity - slots(l.jumpers)) / 2), 0)
    return { w, total: guests.length, planned: guests.length - open, open, room, flights: dayLoads.filter((l) => windowAt(day.windows, l.time)?.id === w.id).length }
  })
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const fitsLoad = (l: Load, ids: string[]) => ids.length > 0 && mayAssign && l.status === 'geplant' && addable(l, ids).length > 0 && slots(l.jumpers) + slots(addable(l, ids)) <= capacity

  // Flights that have not left yet: the pilot can be changed for all of them at once.
  const notDeparted = dayLoads.filter((l) => l.status === 'geplant' || l.status === 'boarding')
  const nextTime = () => (dayLoads.length > 0 ? hm(minutes(dayLoads[dayLoads.length - 1].time) + settings.loadGap) : day.from)
  // A new flight starts with the pilot of the flight before it.
  const addFlights = (times: string[], pilotId?: string) => setLoads((ls) => { let id = Math.max(0, ...ls.map((l) => l.id)); return [...ls, ...times.map((time): Load => ({ id: ++id, dayId: day.id, time, status: 'geplant', pilotId, jumpers: [] }))] })
  const setStatus = (status: DayStatus, extra: Partial<ManifestDay> = {}) => setDays((all) => all.map((d) => (d.id === day.id ? { ...d, status, ...extra } : d)))
  // [Entwurf] A sport jumper who goes home is settled first ("Abrechnen und auschecken"): today's open jumps are charged, cash is booked in the
  // Kassa at once. Then he leaves the waiting list and the flights that have not started.
  const [settleFor, setSettleFor] = useState<{ id: string; checkout: boolean; extrasOnly?: boolean; fix?: Settlement } | null>(null)
  const [depositFor, setDepositFor] = useState<string | null>(null)
  const settleStore = useSettleStore()
  const leave = (memberId: string) => setSettleFor({ id: memberId, checkout: true })
  const cancelDay = (reason: string) => {
    setStatus('abgesagt', { cancelReason: reason })
    const f = toAbs(day.date, day.from), t = toAbs(day.date, day.to)
    setReservations(reservations.filter((r) => !(r.priority && r.aircraft === day.aircraft && r.from === f && r.to === t)))
    setDialog(null)
  }

  if (mode === 'abschluss') {
    const landed = dayLoads.filter((l) => l.status === 'gelandet')
    return (
      <Closing
        day={day}
        flights={landed.length}
        jumped={perPerson(landed.flatMap((l) => l.jumpers), sportPrice)}
        onBack={() => setMode('betrieb')}
        onBooked={() => setStatus('abgeschlossen', { done: { flights: landed.length, jumps: landed.reduce((n, l) => n + l.jumpers.filter((j) => !j.noShow).length, 0) } })}
      />
    )
  }

  const poolItem = (j: Jumper, dim = false, tag?: string) => {
    const on = selected.includes(j.id)
    const m = j.memberId ? byId(j.memberId) : undefined
    const b = j.bookingId ? bookings.find((x) => x.id === j.bookingId) : undefined
    const w = day.windows.find((x) => x.id === b?.windowId)
    const issue = m ? docIssue(docsOf(m.id)) : null
    const pay = b ? guestPay.of(b) : undefined
    const sub = [j.weight ? `${j.weight} kg` : 'Gewicht fehlt', w ? windowLabel(w) : '', j.kind === 'sport' && flown(j.id) > 0 ? `${flown(j.id)}× gesprungen` : '', tag ?? ''].filter(Boolean).join(' · ')
    return (
      <div key={j.id} draggable={mayAssign} onDragStart={(e) => { e.dataTransfer.setData('text/plain', j.id); e.dataTransfer.effectAllowed = 'move'; setDragging(on ? selected : [j.id]) }} onDragEnd={() => setDragging([])}
        className={clsx('flex min-h-16 min-w-0 items-stretch rounded-xl border transition', on ? 'border-brand bg-brand-soft' : 'border-line bg-surface', dim && !on && 'border-dashed')}>
        {mayAssign && (
          <button onClick={() => toggle(j.id)} aria-pressed={on} aria-label={`${j.name} auswählen`} className="grid w-14 shrink-0 place-items-center rounded-l-xl hover:bg-slate-50">
            <span className={clsx('grid h-7 w-7 place-items-center rounded-full border-2', on ? 'border-brand bg-brand text-white' : 'border-slate-300')}>{on && <Check size={15} />}</span>
          </button>
        )}
        <button onClick={() => setPanelFor(j.id)} aria-label={`${j.name} öffnen`} className={clsx('flex min-w-0 flex-1 items-center gap-2 rounded-r-xl py-2 pr-2 text-left hover:bg-slate-50', !mayAssign && 'rounded-l-xl pl-4')}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-medium">{j.name}</span>
            <span className="block text-sm text-muted">{sub}</span>
            {pay?.code && <span className="block truncate text-sm text-muted"><span className="font-mono">{pay.code}</span>{pay.state === 'bezahlt' && <span className="text-ok"> · bezahlt</span>}{pay.state === 'vor_ort' && ' · zahlt vor Ort'}</span>}
            <span className="mt-1 flex flex-wrap gap-1 empty:hidden">
            {j.kind === 'tandem' && <Badge tone="info">Tandem · 2</Badge>}
            {pay && (pay.state === 'offen' || pay.state === 'nachweis') && <PayBadge short pay={pay} name={j.name} />}
            {b && pay && pay.state === 'vor_ort' && !pay.item && <Badge tone="warn">Kein Ticket</Badge>}
            {b && <Badge tone={b.masterId ? 'neutral' : 'warn'}>{b.masterId ? masterShort(b.masterId) : 'Master fehlt'}</Badge>}
            {issue && <Badge tone={issue.tone}>Dokument</Badge>}
            </span>
          </span>
          <ChevronRight size={22} className="shrink-0 text-muted" />
        </button>
      </div>
    )
  }

  const header = (
    <>
      <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Zurück zu {label}</button>
      <PageHeader
        title={dayName(day.date)}
        subtitle={`${day.aircraft} · ${day.from}–${day.to}${day.note ? ` · ${day.note}` : ''}`}
        actions={<>
          {day.status === 'abgeschlossen' && closing ? <Badge tone={DAY_CHECK[closing.state].tone}>{DAY_CHECK[closing.state].label}</Badge> : <Badge tone={statusTone[day.status]}>{statusLabel[day.status]}</Badge>}
          {running && mayCheckInOthers && <Button onClick={() => setDialog('checkin')}><UserCheck size={16} /> Springer am Platz</Button>}
          {running && mayCheckInOthers && day.windows.length + mine.length > 0 && <Button onClick={() => setDialog('kiosk')}><ExternalLink size={16} /> Tandem-Check-in</Button>}
          {day.status === 'geplant' && mayEditDay && <Button variant="primary" onClick={() => setStatus('aktiv')}>Tag starten</Button>}
          {running && mayClose && <Button variant="primary" onClick={() => setMode('abschluss')}>Tag abschließen</Button>}
          {open && mayEditDay && <RowMenu actions={[{ label: 'Tag bearbeiten', onSelect: () => setDialog('edit') }, { label: 'Tag absagen', danger: true, onSelect: () => setDialog('cancel') }]} />}
        </>}
      />
    </>
  )

  if (day.status === 'abgesagt') return <>{header}<Banner tone="warn">Abgesagt: {day.cancelReason}</Banner></>

  return (
    <>
      {header}
      {day.status === 'geplant' && <div className="mb-4"><Banner>Dieser Tag läuft noch nicht. Mit „Tag starten“ können Sportspringer einchecken.</Banner></div>}
      {settings.roles.length > 0 && <div className="mb-4"><DutySummary day={day} roles={settings.roles} onEdit={mayEditDay && open ? () => setDialog('duties') : undefined} /></div>}
      {!mayAssign && <div className="mb-4"><Banner>Du siehst das Manifest lesend. Springer einsetzen und Flüge steuern darf das Manifest-Team.</Banner></div>}
      {day.status === 'abgeschlossen' && day.done && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1 basis-56">
            <div className="font-medium">{day.done.flights} Flüge, {day.done.jumps} Sprünge</div>
            {closing?.review.check && <div className="mt-0.5 text-sm text-muted">Festgeschrieben von {closing.review.check.by}, {closing.review.check.time} Uhr</div>}
          </div>
          {closing && <Button size="lg" variant={review.mayCheck(closing.report) ? 'primary' : 'secondary'} onClick={() => setReportOpen(true)}><FileText size={16} /> {review.mayCheck(closing.report) ? 'Tagesabschluss prüfen' : 'Tagesabschluss'}</Button>}
        </Card>
      )}
      {hasTandem && (
        <div className="mb-4 flex items-start justify-between gap-x-4">
          <Segmented value={tab} onChange={(v) => setParams(v === 'tandem' ? { tab: v } : {}, { replace: true })} options={[{ value: 'fluege', label: 'Flüge' }, { value: 'tandem', label: `Tandem-Buchungen (${mine.length})` }]} />
          {tab === 'fluege' && coverage.length > 0 && (
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-end gap-2">
              {coverage.map(({ w, total, planned, open, room, flights }) => (
                <span key={w.id} className={clsx('rounded-lg border px-2.5 py-1 text-xs leading-snug', total === 0 ? 'border-line text-muted' : open === 0 ? 'border-ok/40 bg-ok-soft text-ok' : open > room ? 'border-bad/40 bg-bad-soft text-bad' : 'border-warn/40 bg-warn-soft text-amber-900')}>
                  <span className="block whitespace-nowrap"><b>{windowLabel(w)}</b> · {total} Tandems{total > 0 && `, ${planned} eingeplant`}</span>
                  {open > 0 && <span className="block whitespace-nowrap">{open > room ? `Platz fehlt für ${open - room}${flights === 0 ? ', noch kein Flug im Fenster' : ', ein weiterer Flug nötig'}` : 'Platz für alle offenen'}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tandem' ? <Bookings day={day} capacity={capacity} /> : (
        <div className={clsx('grid gap-5', open && 'lg:grid-cols-[340px_1fr]')}>
          {open && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{running ? `Wartend (${present.length})` : 'Gäste'}</h2>
                {everyone.length > 0 && mayAssign && <button className="text-sm font-medium text-brand" onClick={() => setSelected(selected.length === everyone.length ? [] : everyone.map((j) => j.id))}>{selected.length === everyone.length ? 'Keine' : 'Alle wählen'}</button>}
              </div>
              {running && mayCheckInOthers && <Button className="mb-2 w-full" onClick={() => setDialog('checkin')}><UserPlus size={15} /> Springer hinzufügen</Button>}
              <div className="space-y-2">
                {present.map((j) => poolItem(j))}
                {running && present.length === 0 && <Card className="p-4 text-sm text-muted">Niemand wartet. Mit „Springer hinzufügen“ und dem Tandem-Check-in kommen Gäste dazu.</Card>}
                {!running && everyone.length === 0 && <Card className="p-4 text-sm text-muted">Keine Tandem-Buchungen für diesen Tag.</Card>}
              </div>
              {planned.length > 0 && (
                <>
                  <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Schon eingeplant ({planned.length})</h2>
                  <div className="space-y-2">{planned.map((j) => poolItem(j, true, planTag(j.id)))}</div>
                </>
              )}
              {airborne.length > 0 && (
                <>
                  <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">In der Luft ({airborne.length})</h2>
                  <div className="space-y-2">{airborne.map((j) => poolItem(j, true, [`Flug ${flightNo(loads, airLoad(j.id)!)}`, planTag(j.id)].filter(Boolean).join(' · ')))}</div>
                </>
              )}
              {expected.length > 0 && (
                <>
                  <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Erwartet ({expected.length})</h2>
                  <div className="space-y-2">{expected.map((b) => poolItem(tandemJumper(b), true))}</div>
                </>
              )}
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Flüge · {day.aircraft}</h2>
              {open && mayCreateFlight && (
                <span className="flex items-center gap-3">
                  <button className="text-sm font-medium text-brand" onClick={() => setDialog('flights')}>+ Flüge anlegen</button>
                  {can('manifest.flights.edit') && notDeparted.length > 0 && <button className="text-sm text-muted hover:text-ink" onClick={() => { setBulkPilot(''); setDialog('pilot') }}>Pilot für alle …</button>}
                </span>
              )}
            </div>
            {selected.length > 0 && <div className="mb-3"><Banner>{selected.length} gewählt ({slots(everyone.filter((j) => selected.includes(j.id)))} Plätze). Tippe auf „Hier einsetzen“ bei einem Flug oder ziehe sie auf einen Flug.</Banner></div>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
              {dayLoads.map((l) => {
                const auto = autoFill(l)
                return (
                  <FlightCard key={l.id} load={l} no={flightNo(loads, l)} day={day} capacity={capacity}
                    fits={fitsLoad(l, selected)} dropping={dragging.length > 0 && fitsLoad(l, dragging)}
                    onPlace={() => place(l.id, selected)} onDrop={() => fitsLoad(l, dragging) && place(l.id, dragging)}
                    onAuto={mayAssign && auto.length > 0 ? () => place(l.id, auto) : null} />
                )
              })}
              {dayLoads.length === 0 && <Card className="p-6 text-sm text-muted col-span-full">Noch kein Flug. {open && mayCreateFlight ? 'Mit „+ Flug“ legst du den ersten an.' : ''}</Card>}
            </div>
          </section>
        </div>
      )}

      {panelFor && (() => { const pj = everyone.find((x) => x.id === panelFor); return pj && (
        <PersonPanel day={day} jumper={pj} capacity={capacity} onClose={() => setPanelFor(null)} onPlace={(loadId) => place(loadId, [pj.id])}
          onDocs={setDocsFor} onDeposit={setDepositFor} onCheckout={(id) => { setPanelFor(null); leave(id) }} onExtras={(id) => setSettleFor({ id, checkout: false, extrasOnly: true })} onCorrect={(id) => { const st = settleStore.of(day.id).filter((x) => x.memberId === id && (x.loadIds.length > 0 || x.extras.length > 0)).pop(); if (st) { setPanelFor(null); setSettleFor({ id, checkout: false, fix: st }) } }} onPay={setPayFor} onTicket={setTicketFor} />
      ) })()}
      {reportOpen && closing && <DayReportDrawer report={closing.report} onClose={() => { setReportOpen(false); if (params.get('pruefen')) setParams({}, { replace: true }) }} />}
      {ticketFor && bookings.find((x) => x.id === ticketFor) && <QuickTicket booking={bookings.find((x) => x.id === ticketFor)!} onClose={() => setTicketFor(null)} />}
      {payFor && bookings.find((x) => x.id === payFor) && <GuestPayDrawer booking={bookings.find((x) => x.id === payFor)!} onClose={() => setPayFor(null)} />}
      <Drawer open={!!docsFor} title={`Dokumente · ${docsFor ? byId(docsFor)?.name : ''}`} onClose={() => setDocsFor(null)}>
        {docsFor && <MemberDocuments memberId={docsFor} />}
      </Drawer>
      <SportCheckIn open={dialog === 'checkin'} dayId={day.id} onClose={() => setDialog(null)} onLeave={leave} />
      <KioskDrawer open={dialog === 'kiosk'} dayId={day.id} onClose={() => setDialog(null)} />
      {dialog === 'edit' && <DayForm open day={day} onClose={() => setDialog(null)} />}
      {dialog === 'flights' && <FlightsDrawer open first={nextTime()} gap={settings.loadGap} pilotId={dayLoads[dayLoads.length - 1]?.pilotId} onClose={() => setDialog(null)} onCreate={addFlights} />}
      <Drawer open={dialog === 'duties'} title={`Dienste · ${dayName(day.date)}`} size="xl" onClose={() => setDialog(null)}>
        <DutyFields roles={settings.roles} duties={day.duties} hours={dayHours(day)} onChange={(r, sh) => setDays((all) => all.map((d) => (d.id === day.id ? withShifts(d, r, sh) : d)))} />
      </Drawer>
      <Drawer open={dialog === 'pilot'} title="Pilot für alle offenen Flüge" onClose={() => setDialog(null)}
        footer={<div className="flex justify-end gap-2"><Button onClick={() => setDialog(null)}>Abbrechen</Button><Button variant="primary" disabled={!bulkPilot} onClick={() => { setLoads((ls) => ls.map((l) => (l.dayId === day.id && (l.status === 'geplant' || l.status === 'boarding') ? { ...l, pilotId: bulkPilot } : l))); setDialog(null) }}>{notDeparted.length} {notDeparted.length === 1 ? 'Flug' : 'Flüge'} übernehmen</Button></div>}>
        <div className="space-y-3">
          <MemberPicker ariaLabel="Pilot" value={bulkPilot} placeholder="Pilot wählen" onChange={setBulkPilot} allow={(m) => memberCan(m.id, 'manifest.flights.pilot')} />
          <p className="text-sm text-muted">Gilt für alle Flüge, die noch nicht abgeflogen sind.</p>
        </div>
      </Drawer>
      <Drawer open={dialog === 'cancel'} title="Tag absagen" onClose={() => setDialog(null)}><CancelDay count={mine.length} onCancel={cancelDay} /></Drawer>
      {settleFor && <SettleSheet day={day} memberId={settleFor.id} checkout={settleFor.checkout} extrasOnly={settleFor.extrasOnly} fix={settleFor.fix} onClose={() => setSettleFor(null)} />}
      {depositFor && <DepositSheet day={day} memberId={depositFor} onClose={() => setDepositFor(null)} />}
    </>
  )
}

function CancelDay({ count, onCancel }: { count: number; onCancel: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-4">
      <p className="text-sm">{count > 0 ? `${count} gebuchte Gäste bekommen die Absage per Mail.` : 'Es gibt keine Buchungen für diesen Tag.'}</p>
      <div className="flex flex-wrap gap-2">{['Wetter', 'Zu wenig Anmeldungen', 'Flugzeug nicht verfügbar', 'Sonstiges'].map((r) => <button key={r} onClick={() => setReason(r)} className={clsx('rounded-lg border px-3 py-2 text-sm', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface')}>{r}</button>)}</div>
      <Button variant="danger" disabled={!reason} onClick={() => onCancel(reason)}>Tag absagen</Button>
    </div>
  )
}
