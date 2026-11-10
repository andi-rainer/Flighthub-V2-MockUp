import clsx from 'clsx'
import { FileText, Plane, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aircraft, members } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp, type Load, type LoadStatus } from '../../state'
import { Badge, Button, Card, Drawer, RowMenu } from '../../ui'
import { paxTone, type PaxTone } from '../aircraft/data'
import AfpPdf from '../afp/AfpPdf'
import { flightPath } from '../FlightPage'
import { dmy, type ManifestDay } from './data'
import { slots } from './slots'
import { MasterPick } from './TandemMaster'
import { GuestPayDrawer, PayBadge, useGuestPay } from './GuestPayment'
import type { TandemBooking } from './data'

const statusLabel: Record<LoadStatus, string> = { geplant: 'Geplant', boarding: 'Boarding', in_air: 'In der Luft', gelandet: 'Gelandet' }
const statusTone = { geplant: 'neutral', boarding: 'warn', in_air: 'info', gelandet: 'ok' } as const
const nextLabel: Record<LoadStatus, string | null> = { geplant: 'Boarding starten', boarding: 'Abflug', in_air: 'Gelandet', gelandet: null }
const nextStatus: Record<LoadStatus, LoadStatus> = { geplant: 'boarding', boarding: 'in_air', in_air: 'gelandet', gelandet: 'gelandet' }

interface Props {
  load: Load; no: number; day: ManifestDay; capacity: number
  /** Places the current selection (tap) or the dragged people (drop) on this flight. */
  fits: boolean; dropping: boolean; onPlace: () => void
  /** Fills the free places with the people who are here. `null`: nobody is waiting who fits. */
  onAuto: (() => void) | null
  onDrop: () => void
}

/**
 * One flight of the day: who sits on it, their total weight against the thresholds of the aircraft, the pilot and the next step. The AFP is
 * the pilot's: the manifest only shows its state and never prepares it.
 */
export default function FlightCard({ load: l, no, day, capacity, fits, dropping, onPlace, onAuto, onDrop }: Props) {
  const { afps, bookings, loads, setLoads, can, memberCan, paxLimits, branding, afpConfig, aircraftData } = useApp()
  const [pdf, setPdf] = useState(false)
  const [payFor, setPayFor] = useState<TandemBooking | null>(null)
  const guestPay = useGuestPay()
  const flightsToday = (id: string) => loads.filter((x) => x.dayId === l.dayId && x.pilotId === id).length
  const mayRemove = can('manifest.jumpers.remove'), mayFlights = can('manifest.flights.edit'), mayDelete = can('manifest.flights.delete')
  const running = day.status === 'aktiv'
  const used = slots(l.jumpers)
  const locked = l.status === 'in_air' || l.status === 'gelandet' || day.status === 'abgeschlossen' || day.status === 'abgesagt'
  const afp = afps[`load-${l.id}`]
  const ac = aircraft.find((a) => a.reg === day.aircraft)
  const limits = paxLimits[ac?.id ?? '']
  const aboard = l.jumpers.filter((j) => !j.noShow)
  const kg = aboard.reduce((n, j) => n + (j.weight ?? 0), 0), noWeight = aboard.filter((j) => !j.weight).length
  const tone: PaxTone = limits ? paxTone(kg, limits) : 'ok'
  const needsAfp = afpConfig.enabled && l.jumpers.length > 0 && l.status !== 'gelandet' && running
  const guestOf = (id?: string) => bookings.find((b) => b.id === id)
  // A tandem guest who has not checked in yet has no signed contract: the flight cannot leave without them.
  const absent = l.jumpers.filter((j) => j.kind === 'tandem' && !guestOf(j.bookingId)?.checkin)
  // Every tandem needs a master, and one master flies one guest per flight.
  const tandems = l.jumpers.filter((j) => j.kind === 'tandem' && !j.noShow)
  const noMaster = tandems.filter((j) => !guestOf(j.bookingId)?.masterId)
  const unpaid = tandems.filter((j) => { const g = guestOf(j.bookingId); return g && guestPay.of(g).state === 'offen' })
  const doubled = [...new Set(tandems.map((j) => guestOf(j.bookingId)?.masterId).filter((id, i, all): id is string => !!id && all.indexOf(id) !== i))]
  const blockers = [absent.length > 0 && 'Check-in', noMaster.length > 0 && 'Tandemmaster', doubled.length > 0 && 'Tandemmaster doppelt', unpaid.length > 0 && 'Zahlung'].filter(Boolean) as string[]
  const advance = () => setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, status: nextStatus[x.status] } : x)))
  const patch = (p: Partial<Load>) => setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...p } : x)))
  const patchJumper = (id: string, p: { noShow: boolean }) => setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, jumpers: x.jumpers.map((y) => (y.id === id ? { ...y, ...p } : y)) } : x)))
  const removeJumper = (id: string) => setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, jumpers: x.jumpers.filter((y) => y.id !== id) } : x)))
  const paidSeats = l.jumpers.filter((j) => j.noShow).length
  const next = nextLabel[l.status]
  // Once landed, the state, the landing time and the M&B proof of the AFP are ONE mark at the top right.
  const landed = l.status === 'gelandet'
  const proof = !!(afp?.release && afp.data)

  return (
    <Card className={clsx('flex flex-col p-4 transition', (fits || dropping) && 'ring-2 ring-brand')}>
      <div onDragOver={(e) => { if (!locked) e.preventDefault() }} onDrop={(e) => { e.preventDefault(); onDrop() }} className="flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 whitespace-nowrap font-semibold">
            <Plane size={16} /> Flug {no}
            <input type="time" aria-label="Uhrzeit" value={l.time} disabled={locked || !mayFlights} onChange={(e) => e.target.value && patch({ time: e.target.value })}
              className="w-[5.5rem] rounded-md border border-transparent bg-transparent px-1 font-normal text-muted enabled:hover:border-line enabled:focus:border-brand disabled:opacity-100" />
          </div>
          <span className="flex items-center gap-1.5">
            {needsAfp && (afp ? <Badge tone="ok">AFP ✓</Badge> : <Link to={flightPath({ kind: 'load', loadId: l.id })} title="AFP öffnen" className="hover:opacity-70"><Badge>AFP offen</Badge></Link>)}
            <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}{landed && afp && ` · ${afp.times?.ld ?? afp.releasedAt}`}</Badge>
            {landed && proof && <button onClick={() => setPdf(true)} title="M&B-Nachweis öffnen" aria-label="M&B-Nachweis öffnen" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-slate-100 hover:text-ink"><FileText size={15} /></button>}
            {mayDelete && !locked && l.jumpers.length === 0 && <RowMenu actions={[{ label: 'Flug löschen', danger: true, onSelect: () => setLoads((ls) => ls.filter((x) => x.id !== l.id)) }]} />}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted">Pilot</span>
          {locked || !mayFlights ? <span className="font-medium">{members.find((m) => m.id === l.pilotId)?.name ?? '–'}</span> : (
            <MemberPicker ariaLabel="Pilot" className="flex-1" value={l.pilotId} placeholder="Pilot wählen" onChange={(id) => patch({ pilotId: id || undefined })}
              allow={(m) => memberCan(m.id, 'manifest.flights.pilot') || m.id === l.pilotId}
              rank={(m) => flightsToday(m.id)} rankHint="Wenigste Flüge heute zuerst" info={(m) => `${flightsToday(m.id)} Flüge heute`} />
          )}
          {!l.pilotId && <Badge tone="warn">Pilot fehlt</Badge>}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={clsx('h-full', used >= capacity ? 'bg-warn' : 'bg-brand')} style={{ width: `${Math.min(100, (used / capacity) * 100)}%` }} /></div>
        <div className="mt-1 text-xs text-muted">{used} von {capacity} Plätzen{paidSeats > 0 && ` (${paidSeats} bezahlt, nicht da)`}</div>
        <ul className="mt-3 flex-1 space-y-1">
          {l.jumpers.map((j) => {
            const guest = guestOf(j.bookingId)
            return (
              <li key={j.id} className={clsx('flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg px-3 text-sm', j.kind === 'tandem' ? 'py-1.5' : 'min-h-10', j.noShow ? 'border border-dashed border-warn bg-surface text-muted' : j.kind === 'tandem' && !guest?.checkin ? 'border border-dashed border-warn bg-surface' : 'bg-slate-50')}>
                <span className="min-w-0 flex-1 truncate">{j.name} <span className="text-xs text-muted">{j.weight ? `${j.weight} kg` : ''}</span></span>
                {j.noShow && <Badge tone="warn">Platz bezahlt</Badge>}
                {j.kind === 'tandem' && (guest?.checkin ? <Badge tone="ok">Vertrag ✓</Badge> : <Badge tone="warn">Check-in fehlt</Badge>)}
                {!locked && j.kind === 'sport' && mayRemove && (
                  <RowMenu actions={[
                    j.noShow ? { label: 'Doch erschienen', onSelect: () => patchJumper(j.id, { noShow: false }) } : { label: 'Nicht erschienen, zahlt den Platz', onSelect: () => patchJumper(j.id, { noShow: true }) },
                    { label: 'Von Flug nehmen (kein Platz bezahlt)', onSelect: () => removeJumper(j.id) },
                  ]} />
                )}
                {!locked && mayRemove && <button aria-label="Entfernen" onClick={() => removeJumper(j.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-slate-200"><X size={14} /></button>}
                {j.kind === 'tandem' && guest && !j.noShow && (
                  <div className="flex w-full items-center gap-2">
                    <span className="w-12 shrink-0 text-xs text-muted">Master</span>
                    <MasterPick booking={guest} className="min-w-0 flex-1" />
                    {guest.masterId && doubled.includes(guest.masterId) && <Badge tone="bad">doppelt</Badge>}
                  </div>
                )}
                {j.kind === 'tandem' && guest && !j.noShow && (() => {
                  const pay = guestPay.of(guest)
                  return (
                    <div className="flex w-full items-center gap-2 text-xs">
                      <span className="w-12 shrink-0 text-muted">{pay.what ?? 'Zahlung'}</span>
                      {pay.code && <span className="font-mono">{pay.code}</span>}
                      <PayBadge pay={pay} name={j.name.replace('Tandem: ', '')} onOpen={!locked && guestPay.mayClear ? () => setPayFor(guest) : undefined} />
                    </div>
                  )
                })()}
              </li>
            )
          })}
          {l.jumpers.length === 0 && <li className="text-sm text-muted">Noch leer</li>}
        </ul>
        {afpConfig.enabled && afp && !landed && (
          <div className="mt-3 rounded-lg bg-ok-soft px-3 py-1.5 text-xs text-ok">
            <b>AFP {afp.status === 'Gelandet' ? 'gelandet' : 'freigegeben'}</b> um {afp.releasedAt}{afp.release && afp.data && <> · <button onClick={() => setPdf(true)} className="underline hover:no-underline">M&B-PDF</button></>}
          </div>
        )}
        {aboard.length > 0 && !landed && (
          <div title="Summe der eingetragenen Gewichte der Springer, ohne Ausrüstung und Tandem-Master" className={clsx('mt-3 rounded-lg px-3 py-1.5 text-xs', { ok: 'bg-ok-soft text-ok', yellow: 'bg-warn-soft text-amber-900', orange: 'bg-orange-100 text-orange-800', red: 'bg-bad-soft text-bad' }[tone])}>
            Springer gesamt <b>{kg} kg</b>{limits && <> · max. {limits.max} kg</>}{noWeight > 0 && <> · Gewicht fehlt bei {noWeight}</>}
          </div>
        )}
        {l.status === 'geplant' && running && blockers.length > 0 && <p className="mt-3 text-xs text-warn">Vor dem Boarding offen: {blockers.join(', ')}</p>}
        <div className="mt-3 flex gap-2">
          {fits && <Button variant="primary" size="lg" className="flex-1" onClick={onPlace}>Hier einsetzen</Button>}
          {!fits && !locked && onAuto && l.status === 'geplant' && <Button size="lg" onClick={onAuto}><Wand2 size={16} /> Auffüllen</Button>}
          {!fits && running && mayFlights && next && (
            <Button size="lg" className="flex-1" onClick={advance} disabled={l.jumpers.length === 0 || (l.status === 'geplant' && blockers.length > 0)}>{next}</Button>
          )}
        </div>
      </div>
      {payFor && <GuestPayDrawer booking={payFor} onClose={() => setPayFor(null)} />}
      {afp?.release && afp.data && (
        <Drawer open={pdf} title={`M&B-Nachweis · Flug ${no}`} size="xl" onClose={() => setPdf(false)}>
          <AfpPdf title={`AFP · Sprungflug ${no} · ${l.time} · ${day.aircraft}`} date={dmy(day.date)} reg={day.aircraft} type={ac?.type ?? ''} d={aircraftData[ac?.id ?? 'a1']} data={afp.data} result={afp} design={branding} />
        </Drawer>
      )}
    </Card>
  )
}
