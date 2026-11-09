import clsx from 'clsx'
import { ArrowLeft, Check, CloudOff, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fmtAbs } from '../dates'
import { aircraft, members } from '../data'
import { useApp, type AfpData, type FlightTimes, type Load } from '../state'
import { Badge, Banner, Button, Card, Segmented } from '../ui'
import { Chart } from './aircraft/Envelope'
import { details, inside } from './aircraft/data'

/**
 * The flight page: AFP (Abbreviated Flight Plan), release and the four flight times of ONE flight.
 * It has its own page (no dialog) and no menu item: it is opened from a manifest load, a reservation or the dashboard.
 * Steps 1 to 4 can be walked forward and back, the times are logged in order after the release.
 * Built for iPad mini and phone: the aircraft is away from the dropzone.
 */
export type FlightSource = { kind: 'load'; loadId: number } | { kind: 'res'; resId: number }
export const flightKey = (s: FlightSource) => (s.kind === 'load' ? `load-${s.loadId}` : `res-${s.resId}`)
const parseKey = (k: string): FlightSource | null => {
  const [kind, id] = k.split('-')
  return kind === 'load' && Number(id) ? { kind: 'load', loadId: Number(id) } : kind === 'res' && Number(id) ? { kind: 'res', resId: Number(id) } : null
}
export const flightPath = (s: FlightSource) => `/flug/${flightKey(s)}`

const RESERVE_MIN = 30 // final reserve, set per club
const GEAR_KG = 8, TM_KG = 80
const ARM_PILOT = 1.0, ARM_CABIN = 1.55, ARM_BAG = 2.43, ARM_FUEL = 1.22, DENSITY = 0.72
const hm = (min: number) => `${Math.floor(Math.max(0, min) / 60)}:${String(Math.round(Math.max(0, min) % 60)).padStart(2, '0')} h`
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const nowHm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const STEPS = ['Flug', 'Beladung', 'Treibstoff', 'Prüfung', 'Zeiten'] as const
const TIMES: [keyof FlightTimes, string][] = [['off', 'Off-block'], ['to', 'Take-off'], ['ld', 'Landing'], ['on', 'On-block']]

interface Pax { id: number; name: string; kg: number }
let seq = 1
/** Only skydive loads come with weights, from the manifest. Charter and private flights: the pilot enters every weight himself. */
const fromLoad = (load?: Load): Pax[] => (load?.jumpers ?? []).flatMap((j): Pax[] =>
  j.kind === 'tandem'
    ? [{ id: seq++, name: j.name.replace('Tandem: ', ''), kg: (j.weight ?? 0) + GEAR_KG }, { id: seq++, name: 'Tandem-Master', kg: TM_KG + GEAR_KG }]
    : [{ id: seq++, name: j.name, kg: (j.weight ?? 0) + GEAR_KG }])

export default function FlightPage() {
  const { key = '' } = useParams()
  const source = parseKey(key)
  if (!source) return <Card className="mx-auto mt-10 max-w-md p-8 text-center text-sm text-muted">Diesen Flug gibt es nicht.</Card>
  return <Flight key={key} source={source} />
}

function Flight({ source }: { source: FlightSource }) {
  const nav = useNavigate()
  const { loads, setLoads, reservations, afps, setAfp, addEntry, weights, persona, can, memberCan, restFuel, setRestFuel } = useApp()
  const key = flightKey(source)
  const load = source.kind === 'load' ? loads.find((l) => l.id === source.loadId) : undefined
  const res = source.kind === 'res' ? reservations.find((r) => r.id === source.resId) : undefined
  const sky = !!load // AFP is a skydive term. Charter and private flights say "Flug beginnen", with the same logic.
  const W = sky ? 'AFP' : 'Flug'
  const ac = aircraft.find((a) => a.reg === (res?.aircraft ?? 'OE-DZA'))!
  const d = details[ac.id]
  const env = d.envelope
  const released = afps[key]
  const mayRelease = can('afp.create')
  const pilotOptions = members.filter((m) => memberCan(m.id, 'afp.create'))
  const saved = released?.data

  const [step, setStep] = useState(released ? 4 : 0)
  const [pilotId, setPilotId] = useState(saved?.pilotId ?? (res?.memberId && memberCan(res.memberId, 'afp.create') ? res.memberId : mayRelease ? persona.memberId : pilotOptions[0]?.id ?? 'm2'))
  const [pilotKg, setPilotKg] = useState(saved?.pilotKg ?? weights[pilotId] ?? 0)
  const [pax, setPax] = useState<Pax[]>(() => saved?.pax ?? fromLoad(load))
  const [bag, setBag] = useState(saved?.bag ?? 0)
  const [fuelL, setFuelL] = useState(saved?.fuelL ?? restFuel[ac.reg] ?? 90)
  const [planned, setPlanned] = useState(saved?.planned ?? (load ? 30 : 45))
  const [kind, setKind] = useState<'Privat' | 'Charter' | 'Schulung'>((saved?.kind as 'Privat') ?? 'Privat')
  const times: FlightTimes = released?.times ?? {}
  const finished = released?.status === 'Gelandet'
  const locked = !!released || !mayRelease

  // The next flight of this pilot, ready to open in one tap after this one is done.
  const candidates: { src: FlightSource; title: string }[] = (() => {
    const l = loads.filter((x) => x.id !== load?.id && x.status !== 'gelandet' && x.jumpers.length > 0 && afps[`load-${x.id}`]?.status !== 'Gelandet').map((x) => ({ src: { kind: 'load', loadId: x.id } as FlightSource, title: `Sprungflug ${x.id} · ${x.time} (${x.jumpers.length} im Manifest)` }))
    const r = reservations.filter((x) => x.memberId === persona.memberId && !x.standby && x.id !== res?.id && afps[`res-${x.id}`]?.status !== 'Gelandet' && x.to > (res?.from ?? 0)).sort((a, b) => a.from - b.from).map((x) => ({ src: { kind: 'res', resId: x.id } as FlightSource, title: `${x.aircraft} · ${fmtAbs(x.from)}` }))
    return sky ? [...l, ...r] : [...r, ...l]
  })()
  const next = mayRelease ? candidates[0] : undefined

  // ---- mass, balance, endurance ----
  const sum = (litres: number) => {
    const paxKg = pax.reduce((n, p) => n + p.kg, 0)
    const fuelKg = litres * DENSITY
    const w = d.emptyKg + pilotKg + paxKg + bag + fuelKg
    return { w, arm: (d.emptyKg * d.emptyArm + pilotKg * ARM_PILOT + paxKg * ARM_CABIN + bag * ARM_BAG + fuelKg * ARM_FUEL) / w }
  }
  const start = sum(fuelL)
  const land = sum(Math.max(0, fuelL - (d.burnLph * planned) / 60))
  const endurance = d.burnLph ? (fuelL / d.burnLph) * 60 : 0
  const need = planned + RESERVE_MIN
  const weightsOk = pilotKg > 0 && pax.every((p) => p.kg > 0)
  const checks = env ? [
    { label: 'Gewichte vollständig', ok: weightsOk, text: weightsOk ? 'Pilot und alle Passagiere eingetragen' : 'Gewicht fehlt' },
    { label: 'Abflugmasse', ok: start.w <= d.mtow, text: `${Math.round(start.w)} kg von ${d.mtow} kg MTOM (${start.w <= d.mtow ? `${Math.round(d.mtow - start.w)} kg frei` : `${Math.round(start.w - d.mtow)} kg zu viel`})` },
    { label: 'Schwerpunkt Abflug', ok: inside(env, start.arm, start.w), text: `${start.arm.toFixed(3)} m` },
    { label: 'Schwerpunkt Landung', ok: inside(env, land.arm, land.w), text: `${land.arm.toFixed(3)} m bei ${Math.round(land.w)} kg` },
    { label: 'Treibstoff', ok: fuelL > 0 && fuelL <= d.maxFuelL, text: `${fuelL} L von max. ${d.maxFuelL} L (${Math.round(fuelL * DENSITY)} kg)` },
    { label: 'Endurance', ok: endurance >= need, text: `${hm(endurance)}, benötigt ${hm(need)} (Flug ${planned} min + Reserve ${RESERVE_MIN} min)` },
  ] : []
  const go = !!env && checks.every((c) => c.ok)
  const flightKind = load ? 'Sprungbetrieb' : kind

  const data = (): AfpData => ({ pilotId, pilotKg, pax, bag, fuelL, planned, kind })
  const release = () => {
    setAfp({ key, pilot: members.find((m) => m.id === pilotId)!.name, fuelL, tow: Math.round(start.w), arm: start.arm, enduranceMin: Math.round(endurance), status: 'Freigegeben', releasedAt: nowHm(), data: data(), times: {} })
    setStep(4)
  }

  // ---- the four times: logged in order, only these can be changed ----
  const nextIdx = TIMES.findIndex(([k]) => !times[k])
  const saveTimes = (next: FlightTimes, changed?: keyof FlightTimes) => {
    if (!released) return
    setAfp({ ...released, times: next })
    if (load && changed === 'to') setLoads((ls) => ls.map((l) => (l.id === load.id ? { ...l, status: 'in_air' } : l)))
    if (load && changed === 'ld') setLoads((ls) => ls.map((l) => (l.id === load.id ? { ...l, status: 'gelandet' } : l)))
  }
  const logNow = (k: keyof FlightTimes) => saveTimes({ ...times, [k]: nowHm() }, k)
  const chrono = (() => {
    const t = times
    if (t.off && t.to && toMin(t.to) < toMin(t.off)) return 'Take-off liegt vor Off-block.'
    if (t.to && t.ld && toMin(t.ld) < toMin(t.to)) return 'Landing liegt vor Take-off.'
    if (t.ld && t.on && toMin(t.on) < toMin(t.ld)) return 'On-block liegt vor Landing.'
    return null
  })()
  const blockMin = times.off && times.on ? toMin(times.on) - toMin(times.off) : null
  const flightMin = times.to && times.ld ? toMin(times.ld) - toMin(times.to) : null
  const usedMin = flightMin ?? planned
  const afterFuel = Math.max(0, fuelL - (d.burnLph * usedMin) / 60)
  const afterEnd = d.burnLph ? (afterFuel / d.burnLph) * 60 : 0
  const allLogged = TIMES.every(([k]) => times[k])
  const finish = () => {
    addEntry({ id: Date.now(), aircraft: ac.reg, times: released!.times, afp: 'ja', date: '07.11.2026', pilot: released!.pilot, kind: flightKind, from: 'LOLW', to: 'LOLW', minutes: flightMin ?? 0, blockMin: blockMin ?? undefined, landings: 1 })
    setAfp({ ...released!, status: 'Gelandet' })
    setRestFuel(ac.reg, Math.round(afterFuel))
  }

  const inp = 'h-12 rounded-xl border border-line bg-surface px-3 text-lg outline-none focus:border-brand disabled:bg-slate-50'
  const num = (v: string) => Number(v.replace(',', '.')) || 0
  const title = load ? `AFP · Sprungflug ${load.id} · ${load.time} · ${ac.reg}` : `Flug beginnen · ${ac.reg}${res ? ` · ${fmtAbs(res.from)} bis ${fmtAbs(res.to)}` : ''}`
  const canOpen = (i: number) => i < 4 || !!released
  const fieldsLocked = locked || !env

  const body = [
    // 1 Flug
    <Card key="s0" className="space-y-3 p-4">
      <h2 className="font-semibold">1 · Pilot und Flug</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Pilot
          <select disabled={fieldsLocked} value={pilotId} onChange={(e) => { setPilotId(e.target.value); setPilotKg(weights[e.target.value] ?? 0) }} className={clsx(inp, 'mt-1 w-full text-base')}>{pilotOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Pilot kg<input disabled={fieldsLocked} inputMode="decimal" value={pilotKg || ''} onChange={(e) => setPilotKg(num(e.target.value))} className={clsx(inp, 'mt-1 w-full')} /></label>
        <label className="block text-sm font-medium">Flugzeug<input disabled value={ac.reg} className={clsx(inp, 'mt-1 w-full')} /></label>
        <label className="block text-sm font-medium">Geplante Flugzeit (min)<input disabled={fieldsLocked} inputMode="numeric" value={planned || ''} onChange={(e) => setPlanned(num(e.target.value))} className={clsx(inp, 'mt-1 w-full')} /></label>
      </div>
      {!load && <div className="text-sm font-medium">Art des Flugs<div className="mt-1"><Segmented value={kind} onChange={setKind} options={[{ value: 'Privat', label: 'Privat' }, { value: 'Charter', label: 'Charter' }, { value: 'Schulung', label: 'Schulung' }]} /></div></div>}
      <p className="text-xs text-muted">{load ? 'Aus dem Manifest übernommen.' : 'Aus deiner Reservierung übernommen.'}</p>
    </Card>,
    // 2 Beladung
    <Card key="s1" className="space-y-3 p-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold">2 · Passagiere und Gepäck</h2><span className="text-sm text-muted">{pax.length} Personen · {pax.reduce((n, p) => n + p.kg, 0)} kg</span></div>
      <p className="text-xs text-muted">{load ? 'Aus dem Manifest übernommen, Gewichte inklusive Ausrüstung. Am Flugzeug änderbar.' : 'Bei Charter und privaten Flügen trägt der Pilot jedes Gewicht selbst ein.'}</p>
      <div className="space-y-2">
        {pax.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <input disabled={fieldsLocked} value={p.name} onChange={(e) => setPax(pax.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} placeholder="Name" className={clsx(inp, 'min-w-0 flex-1 text-base')} />
            <input disabled={fieldsLocked} inputMode="decimal" value={p.kg || ''} onChange={(e) => setPax(pax.map((x) => (x.id === p.id ? { ...x, kg: num(e.target.value) } : x)))} placeholder="kg" className={clsx(inp, 'w-24 text-right')} />
            {!fieldsLocked && <button aria-label="Entfernen" onClick={() => setPax(pax.filter((x) => x.id !== p.id))} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line"><X size={16} /></button>}
          </div>
        ))}
        {pax.length === 0 && <p className="text-sm text-muted">{load ? 'Noch niemand eingetragen.' : 'Allein unterwegs? Dann nichts eintragen.'}</p>}
      </div>
      {!fieldsLocked && (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => setPax([...pax, { id: seq++, name: '', kg: 0 }])}><Plus size={16} /> Passagier</Button>
          {load && <Button size="lg" onClick={() => setPax([...pax, { id: seq++, name: '', kg: 0 }, { id: seq++, name: 'Tandem-Master', kg: TM_KG + GEAR_KG }])}><Plus size={16} /> Tandem-Paar</Button>}
        </div>
      )}
      <label className="block text-sm font-medium">Gepäck (kg)<input disabled={fieldsLocked} inputMode="decimal" value={bag || ''} onChange={(e) => setBag(num(e.target.value))} className={clsx(inp, 'mt-1 block w-32')} /></label>
    </Card>,
    // 3 Treibstoff
    <Card key="s2" className="space-y-3 p-4">
      <h2 className="font-semibold">3 · Treibstoff</h2>
      <div className="flex items-center gap-2">
        <button disabled={fieldsLocked} aria-label="10 Liter weniger" onClick={() => setFuelL(Math.max(0, fuelL - 10))} className="grid h-14 w-14 place-items-center rounded-xl border border-line disabled:opacity-40"><Minus size={20} /></button>
        <input disabled={fieldsLocked} inputMode="decimal" value={fuelL || ''} onChange={(e) => setFuelL(num(e.target.value))} className={clsx(inp, 'h-14 w-28 text-center text-2xl font-semibold')} />
        <span className="text-lg">L</span>
        <button disabled={fieldsLocked} aria-label="10 Liter mehr" onClick={() => setFuelL(fuelL + 10)} className="grid h-14 w-14 place-items-center rounded-xl border border-line disabled:opacity-40"><Plus size={20} /></button>
      </div>
      {!fieldsLocked && <div className="flex flex-wrap gap-2">{[60, 90, 120, 150, d.maxFuelL].filter(Boolean).map((n) => <button key={n} onClick={() => setFuelL(n)} className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-medium">{n === d.maxFuelL ? 'Voll' : `${n} L`}</button>)}</div>}
      <p className="text-sm text-muted">Das ergibt <b className="text-ink">{hm(endurance)}</b> Endurance bei {d.burnLph} L/h. Den Treibstoff kennt nur der Pilot am Flugzeug.</p>
      {restFuel[ac.reg] !== undefined && !released && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">Vom letzten Flug übernommen: {restFuel[ac.reg]} L. Getankt? Dann die Menge erhöhen.</p>}
    </Card>,
    // 4 Prüfung
    <Card key="s3" className="space-y-4 p-4">
      <h2 className="font-semibold">4 · Prüfung und Freigabe</h2>
      {env && (
        <div className="grid gap-4 md:grid-cols-2">
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2"><span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white', c.ok ? 'bg-ok' : 'bg-bad')}>{c.ok ? <Check size={12} /> : <X size={12} />}</span><span><b>{c.label}</b><span className="block text-muted">{c.text}</span></span></li>
            ))}
          </ul>
          <div><Chart env={env} start={start} land={land} mtow={d.mtow} /><p className="mt-1 text-xs text-muted">Abflug und Landung nach {planned} min. Demo mit erfundenen Werten.</p></div>
        </div>
      )}
      {!released && mayRelease && <Button variant="primary" size="lg" className="w-full" disabled={!go} onClick={release}>{W} freigeben</Button>}
      {!released && !go && env && <p className="text-sm text-bad">Solange Masse und Schwerpunkt nicht im Limit sind, gibt es keine Freigabe und kein Off-block.</p>}
      {released && <Banner>{W} freigegeben um {released.releasedAt} von {released.pilot}. Gesperrt, Änderungen gehen nur über {sky ? 'ein neues AFP' : 'eine neue Freigabe'}.</Banner>}
    </Card>,
    // 5 Zeiten
    <Card key="s4" className="space-y-4 p-4">
      <h2 className="font-semibold">5 · Zeiten</h2>
      <p className="text-sm text-muted">Die vier Zeiten werden der Reihe nach erfasst. Block- und Flugzeit rechnet das System, sie lassen sich nicht ändern.</p>
      <div className="space-y-2">
        {TIMES.map(([k, label], i) => {
          const logged = times[k]
          const offBlockBlocked = k === 'off' && !go
          return (
            <div key={k} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold', logged ? 'bg-ok text-white' : i === nextIdx ? 'bg-brand text-white' : 'bg-slate-100 text-muted')}>{logged ? <Check size={14} /> : i + 1}</span>
              <span className="w-24 font-medium">{label}</span>
              {logged ? (
                <input type="time" disabled={finished || !mayRelease} value={logged} onChange={(e) => saveTimes({ ...times, [k]: e.target.value })} className={clsx(inp, 'w-36 tabular-nums')} />
              ) : i === nextIdx && mayRelease && !offBlockBlocked ? (
                <Button variant="primary" size="lg" onClick={() => logNow(k)}>Jetzt erfassen</Button>
              ) : <span className="text-sm text-muted">{offBlockBlocked ? 'erst bei Masse und Schwerpunkt im Limit' : '–'}</span>}
            </div>
          )
        })}
      </div>
      {chrono && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{chrono} Die Zeiten müssen in der Reihenfolge Off-block, Take-off, Landing, On-block liegen.</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Blockzeit</div><div className="text-xl font-semibold tabular-nums">{blockMin !== null ? hm(blockMin) : '–'}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Flugzeit</div><div className="text-xl font-semibold tabular-nums">{flightMin !== null ? hm(flightMin) : '–'}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Treibstoff {flightMin !== null ? 'übrig' : 'geplant übrig'}</div><div className="text-xl font-semibold tabular-nums">{Math.round(afterFuel)} L</div></div>
        <div className={clsx('rounded-xl p-3', afterEnd >= RESERVE_MIN ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}><div className="text-xs">Remaining Endurance</div><div className="text-xl font-semibold tabular-nums">{hm(afterEnd)}</div></div>
      </div>
      {finished && next && <Card className="space-y-2 border-brand/40 bg-brand-soft p-4"><div className="text-sm font-semibold">Nächster Flug</div><div className="text-sm">{next.title}</div><Button variant="primary" size="lg" className="w-full" onClick={() => nav(flightPath(next.src))}>Nächsten Flug öffnen</Button></Card>}
      {finished ? <Banner>Ins Bordbuch übernommen: Flugzeit {flightMin !== null ? hm(flightMin) : '–'}, Blockzeit {blockMin !== null ? hm(blockMin) : '–'}, {flightKind}. Der Kassier verrechnet den Flug. <Link to="/bordbuch" className="font-medium underline">Zum Bordbuch</Link></Banner>
        : mayRelease && <Button variant="primary" size="lg" className="w-full" disabled={!allLogged || !!chrono || (flightMin ?? 0) <= 0} onClick={finish}>Flug abschließen und ins Bordbuch übernehmen</Button>}
    </Card>,
  ]

  return (
    <div className="mx-auto max-w-3xl pb-24 md:pb-28">
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Zurück</button>
      <div className="mb-3"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="info">{load ? 'aus dem Manifest' : 'aus der Reservierung'}</Badge><span className="inline-flex items-center gap-1.5"><CloudOff size={14} /> funktioniert ohne Netz, Eingaben werden später abgeglichen</span></div></div>

      {!env && <div className="mb-3"><Banner tone="warn">Für {ac.reg} ist kein CG-Envelope hinterlegt. Ohne die AFM-Daten ist {sky ? 'kein AFP' : 'kein Flug'} möglich. Der Chefpilot trägt sie am Flugzeug ein.</Banner></div>}
      {env && !mayRelease && !released && <div className="mb-3"><Banner>Du kannst {sky ? 'das AFP' : 'den Flug'} ansehen. Erstellen und freigeben dürfen nur Piloten.</Banner></div>}

      <ol className="mb-3 flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button disabled={!canOpen(i)} onClick={() => setStep(i)} className={clsx('w-full whitespace-nowrap rounded-lg border px-2 py-2 text-xs font-medium sm:text-sm', step === i ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface', !canOpen(i) && 'opacity-40')}>{i + 1} {s}</button>
          </li>
        ))}
      </ol>

      {env && (
        <div className={clsx('mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3', go ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
          <span className="font-semibold">{go ? 'Alles im Limit' : 'Nicht freigebbar'}</span>
          <span className="text-sm">{Math.round(start.w)} kg · CG {start.arm.toFixed(3)} m · Endurance {hm(endurance)}</span>
        </div>
      )}

      {body[step]}

      <div className="fixed inset-x-0 bottom-14 z-10 border-t border-line bg-surface p-3 md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-3xl gap-3">
          {finished ? (
            <>
              <Button size="lg" className="flex-1" onClick={() => nav('/dashboard')}>Zur Übersicht</Button>
              {next ? <Button variant="primary" size="lg" className="flex-[2]" onClick={() => nav(flightPath(next.src))}>Nächster Flug: {next.title}</Button> : <Button variant="primary" size="lg" className="flex-[2]" onClick={() => nav('/bordbuch')}>Zum Bordbuch</Button>}
            </>
          ) : (<>
          <Button size="lg" className="flex-1" disabled={step === 0} onClick={() => setStep(step - 1)}>Zurück</Button>
          <Button variant="primary" size="lg" className="flex-1" disabled={step === 4 || !canOpen(step + 1)} onClick={() => setStep(step + 1)}>{step === 3 && !released ? `Erst ${W} freigeben` : 'Weiter'}</Button>
          </>)}
        </div>
      </div>
    </div>
  )
}
