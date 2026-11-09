import clsx from 'clsx'
import { AlertTriangle, Check, Plane, Scale, Search, UserCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { arrivedJumpers, members, type Jumper, type Member } from '../data'
import { sportJumper, useApp, type LoadStatus } from '../state'
import { Badge, Banner, Button, Card, Drawer, PageHeader } from '../ui'
import { aftLimit, details, inside } from './aircraft/data'
import Closing from './Closing'
import { flightPath } from './FlightPage'

const CAPACITY = 5 // slots; tandem pair = 2
const slots = (js: Jumper[]) => js.reduce((n, j) => n + (j.kind === 'tandem' ? 2 : 1), 0)

// Assumptions for the load check (shown to the user, later set per flight): pilot, fuel, gear, tandem master
const PILOT_KG = 85, FUEL_L = 60, GEAR_KG = 8, TM_KG = 80, ARM_PILOT = 1.0, ARM_FUEL = 1.22, ARM_CABIN = 1.55, FUEL_DENSITY = 0.72

const statusLabel: Record<LoadStatus, string> = { geplant: 'Geplant', boarding: 'Boarding', in_air: 'In der Luft', gelandet: 'Gelandet' }
const statusTone = { geplant: 'neutral', boarding: 'warn', in_air: 'info', gelandet: 'ok' } as const
const nextLabel: Record<LoadStatus, string | null> = { geplant: 'Boarding starten', boarding: 'Abflug', in_air: 'Gelandet', gelandet: null }
const nextStatus: Record<LoadStatus, LoadStatus> = { geplant: 'boarding', boarding: 'in_air', in_air: 'gelandet', gelandet: 'gelandet' }

/** Mass and balance of one load against the AFM envelope of OE-DZA. */
function loadCheck(js: Jumper[]) {
  const d = details.a1
  if (js.length === 0 || !d.envelope) return null
  const missing = js.filter((j) => !j.weight).length
  const kg = js.reduce((n, j) => n + (j.kind === 'tandem' ? (j.weight ?? 0) + TM_KG + 2 * GEAR_KG : (j.weight ?? 0) + GEAR_KG), 0)
  const fuelKg = FUEL_L * FUEL_DENSITY
  const w = d.emptyKg + PILOT_KG + fuelKg + kg
  const arm = (d.emptyKg * d.emptyArm + PILOT_KG * ARM_PILOT + fuelKg * ARM_FUEL + kg * ARM_CABIN) / w
  const over = w > d.mtow
  const ok = !over && inside(d.envelope, arm, w)
  return { missing, w, arm, over, ok, reserveMm: Math.round((aftLimit(d.envelope, Math.min(w, d.mtow)) - arm) * 1000), overKg: Math.round(w - d.mtow) }
}

export default function Manifest() {
  const { checkedIn, toggleCheckIn, weights, setWeight, loads, setLoads, afps, waived, waive, can } = useApp()
  const mayAssign = can('manifest.jumpers.assign'), mayRemove = can('manifest.jumpers.remove'), mayFlights = can('manifest.flights.edit'), mayCreateFlight = can('manifest.flights.create'), mayClose = can('manifest.payments.update'), mayCheckInOthers = can('manifest.checkin.others')
  const nav = useNavigate()
  const [mode, setMode] = useState<'betrieb' | 'abschluss'>('betrieb')
  const sport = (m: Member): Jumper => sportJumper(m, weights[m.id])
  const byId = (id: string) => members.find((m) => m.id === id)!
  const [tandems, setTandems] = useState<Jumper[]>(arrivedJumpers.filter((j) => j.kind === 'tandem'))
  const [selected, setSelected] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [skip, setSkip] = useState<number | null>(null)
  const [skipReason, setSkipReason] = useState('')

  // Who is waiting = checked in and not on a load. There is no separate list to maintain.
  const onLoad = new Set(loads.flatMap((l) => l.jumpers.map((j) => j.id)))
  const pool = [...checkedIn.map((id) => sport(byId(id))).filter((j) => !onLoad.has(j.id)), ...tandems.filter((t) => !onLoad.has(t.id))]

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const place = (loadId: number) => {
    const picked = pool.filter((j) => selected.includes(j.id))
    setLoads((ls) => ls.map((l) => (l.id === loadId ? { ...l, jumpers: [...l.jumpers, ...picked] } : l)))
    setSelected([])
  }
  const unplace = (loadId: number, j: Jumper) => setLoads((ls) => ls.map((l) => (l.id === loadId ? { ...l, jumpers: l.jumpers.filter((x) => x.id !== j.id) } : l)))
  const advance = (loadId: number) => setLoads((ls) => ls.map((l) => (l.id === loadId ? { ...l, status: nextStatus[l.status] } : l)))
  const newLoad = () => setLoads((ls) => [...ls, { id: ls.length + 1, time: '–', status: 'geplant', jumpers: [] }])
  const discard = (id: string) => {
    setLoads((ls) => ls.map((l) => (l.status === 'gelandet' ? l : { ...l, jumpers: l.jumpers.filter((j) => j.id !== id) })))
    if (id.startsWith('s-')) toggleCheckIn(id.slice(2), false)
    else setTandems((t) => t.filter((x) => x.id !== id))
  }

  const selSlots = slots(pool.filter((j) => selected.includes(j.id)))
  const expired = (m?: Member) => !!m?.docs.some((d) => d.state === 'abgelaufen')

  if (mode === 'abschluss') {
    return (
      <Closing
        jumped={loads.filter((l) => l.status === 'gelandet').flatMap((l) => l.jumpers)}
        notFlown={[...pool, ...loads.filter((l) => l.status !== 'gelandet').flatMap((l) => l.jumpers)]}
        onBack={() => setMode('betrieb')}
        onDiscard={discard}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Sprungtag Samstag, 07.11."
        actions={<>{mayCheckInOthers && <Button onClick={() => setChecking(true)}><UserCheck size={16} /> Einchecken</Button>}{mayClose && <Button variant="primary" onClick={() => setMode('abschluss')}>Tag abschließen</Button>}</>}
      />

      {!mayAssign && <div className="mb-4"><Banner>Du siehst den Sprungtag lesend. Springer einsetzen und Flüge steuern darf das Manifest.</Banner></div>}
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Wartend ({pool.length})</h2>
            {pool.length > 0 && <button className="text-sm font-medium text-brand" onClick={() => setSelected(selected.length === pool.length ? [] : pool.map((j) => j.id))}>{selected.length === pool.length ? 'Keine' : 'Alle wählen'}</button>}
          </div>
          <div className="space-y-2">
            {pool.map((j) => {
              const on = selected.includes(j.id)
              const m = j.memberId ? byId(j.memberId) : undefined
              return (
                <button key={j.id} onClick={() => toggle(j.id)} className={clsx('flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left transition', on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-slate-50')}>
                  <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full border', on ? 'border-brand bg-brand text-white' : 'border-slate-300')}>{on && <Check size={14} />}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{j.name}</span>
                    <span className="text-xs text-muted">{j.weight ? `${j.weight} kg` : 'Gewicht fehlt'}{j.note ? ` · ${j.note}` : ''}</span>
                  </span>
                  {j.kind === 'tandem' && <Badge tone="info">Tandem · 2</Badge>}
                  {expired(m) && <Badge tone="bad">Dokument</Badge>}
                </button>
              )
            })}
            {pool.length === 0 && <Card className="p-4 text-sm text-muted">Niemand wartet. Über „Einchecken“ kommen Springer dazu.</Card>}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Flüge · OE-DZA</h2>
            {mayCreateFlight && <button className="text-sm font-medium text-brand" onClick={newLoad}>+ Flug</button>}
          </div>
          {selected.length > 0 && <div className="mb-3"><Banner>{selected.length} gewählt ({selSlots} Plätze). Tippe auf „Hier einsetzen“ bei einem Flug.</Banner></div>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loads.map((l) => {
              const used = slots(l.jumpers)
              const locked = l.status === 'in_air' || l.status === 'gelandet'
              const fits = selected.length > 0 && !locked && used + selSlots <= CAPACITY
              const chk = loadCheck(l.jumpers)
              const key = `load-${l.id}`
              const afp = afps[key]
              const waivedReason = waived[key]
              const needsAfp = l.jumpers.length > 0 && l.status !== 'gelandet'
              return (
                <Card key={l.id} className={clsx('flex flex-col p-4', fits && 'ring-2 ring-brand')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold"><Plane size={16} /> Flug {l.id} <span className="font-normal text-muted">{l.time}</span></div>
                    <span className="flex items-center gap-1.5">
                      {needsAfp && (afp ? <Badge tone="ok">AFP ✓</Badge> : waivedReason ? <Badge tone="bad">ohne AFP</Badge> : <Badge tone="warn">AFP offen</Badge>)}
                      <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}</Badge>
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={clsx('h-full', used >= CAPACITY ? 'bg-warn' : 'bg-brand')} style={{ width: `${(used / CAPACITY) * 100}%` }} /></div>
                  <div className="mt-1 text-xs text-muted">{used} von {CAPACITY} Plätzen</div>
                  <ul className="mt-3 flex-1 space-y-1">
                    {l.jumpers.map((j) => (
                      <li key={j.id} className="flex min-h-10 items-center justify-between rounded-lg bg-slate-50 px-3 text-sm">
                        <span>{j.name} <span className="text-xs text-muted">{j.weight ? `${j.weight} kg` : ''}</span></span>
                        {!locked && mayRemove && <button aria-label="Entfernen" onClick={() => unplace(l.id, j)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-slate-200"><X size={14} /></button>}
                      </li>
                    ))}
                    {l.jumpers.length === 0 && <li className="text-sm text-muted">Noch leer</li>}
                  </ul>
                  {afp && (
                    <div className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
                      <b>AFP vom Piloten {afp.status === 'Gelandet' ? '(gelandet)' : 'freigegeben'}</b>: {afp.pilot}, {afp.fuelL} L, {afp.tow} kg, CG {afp.arm.toFixed(3)} m
                    </div>
                  )}
                  {waivedReason && <div className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad"><b>Ohne AFP gestartet:</b> {waivedReason}. Wird zur Kontrolle gemeldet.</div>}
                  {chk && !afp && (
                    <div title={`Annahmen: Pilot ${PILOT_KG} kg, ${FUEL_L} L Treibstoff, ${GEAR_KG} kg Ausrüstung je Springer, Tandem-Master ${TM_KG} kg`} className={clsx('mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs', chk.missing > 0 ? 'bg-warn-soft text-amber-900' : chk.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
                      {chk.missing > 0 ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Scale size={14} className="mt-0.5 shrink-0" />}
                      <span>
                        {chk.missing > 0 ? `Gewicht fehlt bei ${chk.missing}, Schwerpunkt nicht prüfbar.`
                          : chk.over ? `Überladen: ${chk.overKg} kg über MTOM (${Math.round(chk.w)} kg).`
                          : !chk.ok ? `Schwerpunkt außerhalb: ${chk.arm.toFixed(3)} m bei ${Math.round(chk.w)} kg.`
                          : `Vorläufig im Limit: ${chk.arm.toFixed(3)} m, ${Math.round(chk.w)} kg, ${chk.reserveMm} mm Reserve hinten. Verbindlich ist das AFP des Piloten.`}
                      </span>
                    </div>
                  )}
                  {needsAfp && <Button variant={afp ? 'secondary' : 'primary'} className="mt-3" onClick={() => nav(flightPath({ kind: 'load', loadId: l.id }))}>{afp ? 'AFP ansehen' : 'AFP vorbereiten'}</Button>}
                  {skip === l.id && (
                    <div className="mt-3 space-y-2 rounded-xl border border-warn/50 bg-warn-soft p-3 text-sm">
                      <div className="font-medium">Für diesen Flug gibt es noch kein AFP. Warum starten ohne?</div>
                      <div className="flex flex-wrap gap-2">{['Pilot macht das AFP auf Papier', 'Kurzer Platzflug', 'Pilot noch nicht am Flugzeug', 'Sonstiges'].map((r) => <button key={r} onClick={() => setSkipReason(r)} className={clsx('rounded-lg border px-3 py-2 text-xs', skipReason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface')}>{r}</button>)}</div>
                      <div className="flex gap-2"><Button variant="primary" disabled={!skipReason} onClick={() => { waive(key, skipReason); advance(l.id); setSkip(null); setSkipReason('') }}>Trotzdem Boarding</Button><Button onClick={() => { setSkip(null); setSkipReason('') }}>Abbrechen</Button></div>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {fits && <Button variant="primary" size="lg" className="flex-1" onClick={() => place(l.id)}>Hier einsetzen</Button>}
                    {!fits && mayFlights && nextLabel[l.status] && <Button size="lg" className="flex-1" onClick={() => (l.status === 'geplant' && !afp && !waivedReason ? setSkip(l.id) : advance(l.id))} disabled={l.jumpers.length === 0}>{nextLabel[l.status]}</Button>}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </div>

      <CheckIn open={checking} onClose={() => setChecking(false)} checkedIn={checkedIn} weights={weights} setWeight={setWeight} onToggle={toggleCheckIn} />
    </>
  )
}

/** Presence replaces booking: whoever is checked in can be put on a load. Weight is mandatory (needed for the CG). */
function CheckIn({ open, onClose, checkedIn, weights, setWeight, onToggle }: { open: boolean; onClose: () => void; checkedIn: string[]; weights: Record<string, number>; setWeight: (id: string, kg: number) => void; onToggle: (id: string, on?: boolean) => void }) {
  const { hasFunction } = useApp()
  const [q, setQ] = useState('')
  const list = useMemo(() => members.filter((m) => hasFunction(m.id, 'sport_jumper') && m.name.toLowerCase().includes(q.toLowerCase())), [q, hasFunction])
  return (
    <Drawer open={open} title="Springer einchecken" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Springer können sich auch selbst am Handy einchecken. Hier checkst du für jemanden ein.</p>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mitglied suchen" className="h-12 w-full rounded-xl border border-line pl-9 pr-3 text-base outline-none focus:border-brand" />
      </div>
      <div className="mt-3 space-y-2">
        {list.map((m) => {
          const here = checkedIn.includes(m.id)
          const kg = weights[m.id]
          return (
            <div key={m.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <div><div className="font-medium">{m.name}</div>{m.docs.some((d) => d.state === 'abgelaufen') && <Badge tone="bad">Dokument abgelaufen</Badge>}</div>
                <Button variant={here ? 'secondary' : 'primary'} disabled={!here && !kg} onClick={() => onToggle(m.id)}>{here ? 'Auschecken' : 'Einchecken'}</Button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">Gewicht
                <input inputMode="numeric" value={kg ?? ''} onChange={(e) => setWeight(m.id, Number(e.target.value) || 0)} className="h-9 w-20 rounded-lg border border-line px-2 text-right text-ink" /> kg
                {!kg && <span className="text-bad">Pflicht für den Check-in</span>}
              </label>
            </div>
          )
        })}
      </div>
    </Drawer>
  )
}
