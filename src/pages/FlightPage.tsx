import clsx from 'clsx'
import { ArrowLeft, Check, CloudOff, FileText, Fuel, Mail, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fmtAbs } from '../dates'
import { aircraft, members, type Member } from '../data'
import { flightNo, useApp, type AfpData, type FlightTimes, type Load } from '../state'
import MemberPicker from '../MemberPicker'
import { Badge, Banner, Button, Card, Drawer, Segmented, Switch } from '../ui'
import { FuelAdjustFields, FuelMissingNotice, useFuelAdjust } from './fuel/FuelAdjust'
import { SupplyFields, useSupplyForm } from './SupplyReceipt'
import SignaturePad from './members/SignaturePad'
import { Chart } from './aircraft/Envelope'
import { converter } from './aircraft/units'
import { offeredFor } from '../kinds'
import ModuleGate from './club/ModuleOff'
import AfpPdf from './afp/AfpPdf'
import { afpCalc, GEAR_KG, hm, TM_KG } from './afp/calc'

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

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const nowHm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const STEPS = ['Flug', 'Beladung', 'Treibstoff', 'Prüfung', 'Zeiten'] as const
const TIMES: [keyof FlightTimes, string][] = [['off', 'Off-block'], ['to', 'Take-off'], ['ld', 'Landing'], ['on', 'On-block']]

interface Pax { id: number; name: string; kg: number }
let seq = 1
/** Only skydive loads come with weights, from the manifest. Charter and private flights: the pilot enters every weight himself. */
const fromLoad = (load: Load | undefined, masterOf: (bookingId?: string) => Member | undefined): Pax[] => (load?.jumpers ?? []).filter((j) => !j.noShow).flatMap((j): Pax[] =>
  j.kind === 'tandem'
    ? [{ id: seq++, name: j.name.replace('Tandem: ', ''), kg: (j.weight ?? 0) + GEAR_KG }, { id: seq++, name: masterOf(j.bookingId)?.name ?? 'Tandem-Master', kg: (masterOf(j.bookingId)?.weight ?? TM_KG) + GEAR_KG }]
    : [{ id: seq++, name: j.name, kg: (j.weight ?? 0) + GEAR_KG }])

export default function FlightPage() {
  const { key = '' } = useParams()
  const { afpConfig } = useApp()
  const source = parseKey(key)
  if (!source) return <Card className="mx-auto mt-10 max-w-md p-8 text-center text-sm text-muted">Diesen Flug gibt es nicht.</Card>
  if (source.kind === 'load') return <ModuleGate area="skydive"><FlightGate source={source} on={afpConfig.enabled} /></ModuleGate>
  return <ModuleGate area="charter"><FlightGate source={source} on={afpConfig.enabled} /></ModuleGate>
}

function FlightGate({ source, on }: { source: FlightSource; on: boolean }) {
  const key = flightKey(source)
  if (!on) return <Card className="mx-auto mt-10 max-w-md space-y-3 p-8 text-center"><div className="font-semibold">Der AFP ist für diesen Verein ausgeschaltet</div><p className="text-sm text-muted">{source.kind === 'load' ? 'Die Vorbereitung läuft auf Papier. Boarding und Status schaltet das Manifest.' : 'Die Vorbereitung läuft auf Papier. Den Flug trägst du danach im Bordbuch ein.'}</p>{source.kind === 'res' && <Link to="/bordbuch"><Button variant="primary">Zum Bordbuch</Button></Link>}</Card>
  return <Flight key={key} source={source} />
}

function Flight({ source }: { source: FlightSource }) {
  const nav = useNavigate()
  const { loads, setLoads, bookings, reservations, afps, setAfp, addEntry, weights, persona, can, memberCan, restFuel, setRestFuel, settings, profileOf, branding, afpConfig, kinds, modules, aircraftData, ledger } = useApp()
  const key = flightKey(source)
  const load = source.kind === 'load' ? loads.find((l) => l.id === source.loadId) : undefined
  const res = source.kind === 'res' ? reservations.find((r) => r.id === source.resId) : undefined
  const sky = !!load // AFP is a skydive term. Charter and private flights say "Flug beginnen", with the same logic.
  const W = sky ? 'AFP' : 'Flug'
  const ac = aircraft.find((a) => a.reg === (res?.aircraft ?? 'OE-DZA'))!
  const d = aircraftData[ac.id]
  const u = converter(d.units) // fuel and masses of the aircraft are shown in its units (stored metric)
  const env = d.envelope
  const released = afps[key]
  const mayRelease = can('afp.create')
  const pilotOptions = members.filter((m) => memberCan(m.id, 'afp.create'))
  const saved = released?.data

  const [step, setStep] = useState(released ? 4 : 0)
  const [pilotId, setPilotId] = useState(saved?.pilotId ?? load?.pilotId ?? (res?.memberId && memberCan(res.memberId, 'afp.create') ? res.memberId : mayRelease ? persona.memberId : pilotOptions[0]?.id ?? 'm2'))
  const [pilotKg, setPilotKg] = useState(saved?.pilotKg ?? weights[pilotId] ?? 0)
  const [pax, setPax] = useState<Pax[]>(() => saved?.pax ?? fromLoad(load, (id) => members.find((m) => m.id === bookings.find((b) => b.id === id)?.masterId)))
  const [bag, setBag] = useState(saved?.bag ?? 0)
  // The content of the tank is what the last entry left in it. It changes here: fuel in (uplift), fuel out, or in an exception set by hand.
  // Once the AFP is released it keeps the value it was made with. Everything ends up in the Bordbuch entry of this flight.
  const content = restFuel[ac.reg] ?? 0
  const adj = useFuelAdjust(content)
  const refuel = useSupplyForm(true)
  const [when, setWhen] = useState<'vor' | 'nach'>('vor')
  const fuelL = saved?.fuelL ?? adj.start + (refuel.on && when === 'vor' ? refuel.amount : 0)
  const fuelBlock = (adj.mode && adj.problem) || (refuel.on && refuel.problem) || null
  const [planned, setPlanned] = useState(saved?.planned ?? (load ? settings.cycleMin : 45))
  const [alternate, setAlternate] = useState(saved?.alternateMin ?? afpConfig.alternateMin)
  // The kind of a flight that is not a jump flight comes from the club's operation kinds (price and booking are set there).
  const offered = offeredFor(kinds, ac.reg, modules).filter((k) => !k.manifest)
  const [kind, setKind] = useState<string>(saved?.kind ?? offered[0]?.name ?? '')
  const [ack, setAck] = useState(false)
  const [sig, setSig] = useState('')
  const [pdfOpen, setPdfOpen] = useState(false)
  const [resent, setResent] = useState(false)
  const times: FlightTimes = released?.times ?? {}
  const finished = released?.status === 'Gelandet'
  const locked = !!released || !mayRelease

  // The next flight of this pilot, ready to open in one tap after this one is done.
  const candidates: { src: FlightSource; title: string }[] = (() => {
    const l = loads.filter((x) => x.id !== load?.id && x.status !== 'gelandet' && x.jumpers.length > 0 && afps[`load-${x.id}`]?.status !== 'Gelandet').map((x) => ({ src: { kind: 'load', loadId: x.id } as FlightSource, title: `Sprungflug ${flightNo(loads, x)} · ${x.time} (${x.jumpers.length} im Manifest)` }))
    const r = reservations.filter((x) => x.memberId === persona.memberId && !x.standby && x.id !== res?.id && afps[`res-${x.id}`]?.status !== 'Gelandet' && x.to > (res?.from ?? 0)).sort((a, b) => a.from - b.from).map((x) => ({ src: { kind: 'res', resId: x.id } as FlightSource, title: `${x.aircraft} · ${fmtAbs(x.from)}` }))
    return sky ? [...l, ...r] : [...r, ...l]
  })()
  const next = mayRelease ? candidates[0] : undefined

  // ---- mass, balance, endurance: one calculation for this page and for the PDF ----
  const reserveMin = saved?.reserveMin ?? afpConfig.reserveMin
  const { start, land, endurance, need, checks, go: mbGo } = afpCalc(d, { pilotKg, pax, bag, fuelL, planned, alternateMin: alternate, reserveMin })
  // Without weights and CG limits of the aircraft no mass and balance can be made. The flight itself is still possible, the pilot is responsible.
  const mb = !!env && d.emptyKg > 0 && d.mtow > 0
  const go = mb ? mbGo : true
  const noMb = `Für ${ac.reg} sind keine Gewichte oder CG-Grenzen hinterlegt. Ein Nachweis von Masse und Schwerpunkt kann nicht erstellt werden. Als Pilot sorgst du selbst dafür, ihn zu erstellen und mitzuführen, und du verantwortest ihn. Der Chefpilot trägt die Daten in den Flugzeug-Details ein.`
  const flightKind = load ? (kinds.find((k) => k.manifest)?.name ?? 'Sprungbetrieb') : kind

  const data = (): AfpData => ({ pilotId, pilotKg, pax, bag, fuelL, planned, kind, reserveMin, alternateMin: alternate })
  // The pilot of the AFP is the pilot of the flight in the manifest, too.
  const syncPilot = (id: string) => { if (load) setLoads((ls) => ls.map((x) => (x.id === load.id ? { ...x, pilotId: id } : x))) }
  // Release = signature and the confirmation of the pre-flight check. The PDF is made from it and goes to the pilot by mail.
  const release = () => {
    syncPilot(pilotId)
    const fuelSupply = refuel.on && when === 'vor' ? (() => { const sp = refuel.commit(ledger, ac.reg); return sp && { ...sp, when: 'vor' as const } })() : undefined
    setRestFuel(ac.reg, Math.round(fuelL * 10) / 10)
    const pdf = `AFP-${ac.reg}-2026-11-07-${load ? `Flug${flightNo(loads, load)}` : `Res${res?.id ?? ''}`}.pdf`
    setAfp({ key, pilot: members.find((m) => m.id === pilotId)!.name, fuelL, tow: Math.round(start.w), arm: start.arm, enduranceMin: Math.round(endurance), status: 'Freigegeben', releasedAt: nowHm(), data: { ...data(), fuelSupply, fuelAdjust: adj.adjust }, times: {}, release: afpConfig.evidence && mb ? { signature: sig, signedAt: `07.11.2026 ${nowHm()}`, pdf, mailedTo: afpConfig.mailPdf ? profileOf(pilotId).email : '' } : undefined })
    setStep(4)
  }

  // ---- the four times: logged in order, only these can be changed ----
  const nextIdx = TIMES.findIndex(([k]) => !times[k])
  const saveTimes = (next: FlightTimes, changed?: keyof FlightTimes) => {
    if (!released) return
    setAfp({ ...released, times: next })
    // Off-block already shows the flight as in the air in the manifest.
    if (load && changed === 'off') setLoads((ls) => ls.map((l) => (l.id === load.id && l.status !== 'gelandet' ? { ...l, status: 'in_air' } : l)))
    if (load && changed === 'ld') setLoads((ls) => ls.map((l) => (l.id === load.id ? { ...l, status: 'gelandet' } : l)))
  }
  /** The dummy is clicked within seconds: block-off and take-off (and landing and block-on) may be the same minute, take-off and landing are at least one minute apart. */
  const logNow = (k: keyof FlightTimes) => {
    const order: (keyof FlightTimes)[] = ['off', 'to', 'ld', 'on']
    const prev = times[order[order.indexOf(k) - 1]]
    const now = nowHm()
    const least = prev ? toMin(prev) + (k === 'ld' ? 1 : 0) : 0
    const at = toMin(now) < least ? `${String(Math.floor(least / 60) % 24).padStart(2, '0')}:${String(least % 60).padStart(2, '0')}` : now
    saveTimes({ ...times, [k]: at }, k)
  }
  const chrono = (() => {
    const t = times
    if (t.off && t.to && toMin(t.to) < toMin(t.off)) return 'Take-off liegt vor Off-block.'
    if (t.to && t.ld && toMin(t.ld) <= toMin(t.to)) return 'Zwischen Take-off und Landing muss mindestens eine Minute liegen.'
    if (t.ld && t.on && toMin(t.on) < toMin(t.ld)) return 'On-block liegt vor Landing.'
    return null
  })()
  const blockMin = times.off && times.on ? toMin(times.on) - toMin(times.off) : null
  const flightMin = times.to && times.ld ? toMin(times.ld) - toMin(times.to) : null
  // Remaining fuel and endurance are only known exactly after the landing, until then they are not available.
  const known = flightMin !== null && flightMin > 0
  const burn = (d.burnLph * (flightMin ?? 0)) / 60
  const afterFuel = finished ? content : Math.max(0, content - burn)
  const afterEnd = d.burnLph ? (afterFuel / d.burnLph) * 60 : 0
  const allLogged = TIMES.every(([k]) => times[k])
  const finish = () => {
    const after = refuel.on && when === 'nach' ? refuel.commit(ledger, ac.reg) : undefined
    const fuel = saved?.fuelSupply ?? (after && { ...after, when: 'nach' as const })
    addEntry({ id: Date.now(), aircraft: ac.reg, times: released!.times, afp: 'ja', date: '07.11.2026', pilot: released!.pilot, kind: flightKind, from: 'LOLW', to: 'LOLW', minutes: flightMin ?? 0, blockMin: blockMin ?? undefined, landings: 1, fuel, fuelAdjust: saved?.fuelAdjust })
    setAfp({ ...released!, status: 'Gelandet' })
    setRestFuel(ac.reg, Math.round((Math.max(0, content - burn) + (after?.amount ?? 0)) * 10) / 10)
  }

  const inp = 'h-12 rounded-xl border border-line bg-surface px-3 text-lg outline-none focus:border-brand disabled:bg-slate-50'
  const num = (v: string) => Number(v.replace(',', '.')) || 0
  const title = load ? `AFP · Sprungflug ${flightNo(loads, load)} · ${load.time} · ${ac.reg}` : `Flug beginnen · ${ac.reg}${res ? ` · ${fmtAbs(res.from)} bis ${fmtAbs(res.to)}` : ''}`
  const canOpen = (i: number) => i < 4 || !!released
  const fieldsLocked = locked

  const body = [
    // 1 Flug
    <Card key="s0" className="space-y-3 p-4">
      <h2 className="font-semibold">1 · Pilot und Flug</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Pilot
          <MemberPicker ariaLabel="Pilot" className="mt-1" disabled={fieldsLocked} value={pilotId} allow={(m) => memberCan(m.id, 'afp.create')} onChange={(id) => { if (!id) return; setPilotId(id); setPilotKg(weights[id] ?? 0); syncPilot(id) }} />
        </label>
        <label className="block text-sm font-medium">Pilot kg<input disabled={fieldsLocked} inputMode="decimal" value={pilotKg || ''} onChange={(e) => setPilotKg(num(e.target.value))} className={clsx(inp, 'mt-1 w-full')} /></label>
        <label className="block text-sm font-medium">Flugzeug<input disabled value={ac.reg} className={clsx(inp, 'mt-1 w-full')} /></label>
        <label className="block text-sm font-medium">Geplante Flugzeit (min)<input disabled={fieldsLocked} inputMode="numeric" value={planned || ''} onChange={(e) => setPlanned(num(e.target.value))} className={clsx(inp, 'mt-1 w-full')} /></label>
        <label className="block text-sm font-medium">Flugzeit zum Alternate (min)<input aria-label="Flugzeit zum Alternate" disabled={fieldsLocked} inputMode="numeric" value={alternate} onChange={(e) => setAlternate(num(e.target.value))} className={clsx(inp, 'mt-1 w-full')} /></label>
      </div>
      {!load && <div className="text-sm font-medium">Art des Flugs<div className="mt-1">{offered.length > 0 ? <Segmented value={kind} onChange={setKind} options={offered.map((k) => ({ value: k.name, label: k.name }))} /> : <p className="text-sm text-bad">Für {ac.reg} ist in keiner Betriebsart ein Preis hinterlegt.</p>}</div></div>}
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
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">Im Tank laut System: <b className="text-ink">{u.fuelText(released ? fuelL : content)}</b>. Das war der Stand nach dem letzten Eintrag im Bordbuch.</p>
      {!fieldsLocked && <FuelAdjustFields a={adj} content={content} />}
      {!fieldsLocked && !(refuel.on && when === 'nach') && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Fuel size={16} /> Getankt vor dem Flug (Uplift)</h3><Switch checked={refuel.on && when === 'vor'} onChange={(v) => { setWhen('vor'); refuel.setOn(v) }} label="Getankt vor dem Flug" /></div>
          {refuel.on && <SupplyFields f={refuel.fields} />}
        </div>
      )}
      {fuelBlock && !fieldsLocked && <p className="text-xs text-muted">Treibstoff: {fuelBlock}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Treibstoff beim Start</div><div className="text-2xl font-semibold tabular-nums">{u.fuelText(fuelL)}</div><div className="text-xs text-muted">{u.massText(fuelL * 0.72)}</div></div>
        <div className={clsx('rounded-xl p-3', endurance >= need ? 'bg-slate-50' : 'bg-bad-soft text-bad')}><div className={clsx('text-xs', endurance >= need ? 'text-muted' : '')}>Endurance beim Start</div><div className="text-2xl font-semibold tabular-nums">{hm(endurance)}</div><div className={clsx('text-xs', endurance >= need ? 'text-muted' : '')}>benötigt {hm(need)} (Flug {planned} + Alternate {alternate} + Reserve {reserveMin} min, mindestens {u.fuelText(Math.ceil((d.burnLph * need) / 60))})</div></div>
      </div>
      <p className="text-sm text-muted">Den Treibstoff kennt nur der Pilot am Flugzeug.</p>
    </Card>,
    // 4 Prüfung
    <Card key="s3" className="space-y-4 p-4">
      <h2 className="font-semibold">4 · Prüfung und Freigabe</h2>
      {!mb && <Banner tone="warn">{noMb}</Banner>}
      {mb && env && (
        <div className="grid gap-4 md:grid-cols-2">
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2"><span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white', c.ok ? 'bg-ok' : 'bg-bad')}>{c.ok ? <Check size={12} /> : <X size={12} />}</span><span><b>{c.label}</b><span className="block text-muted">{c.text}</span></span></li>
            ))}
          </ul>
          <div><Chart c={u} env={env} start={start} land={land} mtow={d.mtow} /><p className="mt-1 text-xs text-muted">Abflug und Landung nach {planned} min. Demo mit erfundenen Werten.</p></div>
        </div>
      )}
      {!released && mayRelease && (!afpConfig.evidence || !mb) && (
        <div className="space-y-3">
          {!mb && <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" /><span>Ich habe verstanden: Masse und Schwerpunkt erstelle und führe ich selbst mit, ich verantworte sie.</span></label>}
          <Button variant="primary" size="lg" className="w-full" disabled={!go || (!mb && !ack) || !!fuelBlock} onClick={release}>{W} freigeben</Button>
        </div>
      )}
      {!released && mayRelease && afpConfig.evidence && mb && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" /><span>Ich bestätige, dass die Vorflugkontrolle ordnungsgemäß durchgeführt wurde.</span></label>
          <div><div className="mb-1 text-sm font-medium">Unterschrift</div><SignaturePad onInk={(b) => !b && setSig('')} onImage={setSig} /></div>
          <p className="text-xs text-muted">Als Pilot bist du dafür verantwortlich, dass die Angaben richtig sind und mit den Werten des AFM/POH übereinstimmen.</p>
          <Button variant="primary" size="lg" className="w-full" disabled={!go || !ack || !sig || !!fuelBlock} onClick={release}>{W} freigeben{afpConfig.mailPdf ? <> und an {profileOf(pilotId).email} senden</> : ' und unterschreiben'}</Button>
        </div>
      )}
      {!released && !go && mb && <p className="text-sm text-bad">Solange Masse und Schwerpunkt nicht im Limit sind, gibt es keine Freigabe und kein Off-block.</p>}
      {released && <Banner>{W} freigegeben um {released.releasedAt} von {released.pilot}. Gesperrt, Änderungen gehen nur über {sky ? 'ein neues AFP' : 'eine neue Freigabe'}.</Banner>}
      {released?.release && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-sm">
          <Button onClick={() => setPdfOpen(true)}><FileText size={16} /> {W} als PDF öffnen</Button>
          {released.release.mailedTo && <><span className="inline-flex items-center gap-1.5 text-muted"><Mail size={14} /> PDF an {released.release.mailedTo} gesendet{resent ? ' (erneut)' : ''}</span>
          <button className="text-brand hover:underline" onClick={() => setResent(true)}>Erneut senden</button></>}
        </div>
      )}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Blockzeit</div><div className="text-xl font-semibold tabular-nums">{blockMin !== null ? hm(blockMin) : '–'}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Flugzeit</div><div className="text-xl font-semibold tabular-nums">{flightMin !== null ? hm(flightMin) : '–'}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Treibstoff beim Start</div><div className="text-xl font-semibold tabular-nums">{fuelL} L</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Endurance beim Start</div><div className="text-xl font-semibold tabular-nums">{hm(endurance)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Remaining Fuel</div><div className="text-xl font-semibold tabular-nums">{known ? `${Math.round(afterFuel)} L` : '–'}</div>{!known && <div className="text-xs text-muted">nach der Landung</div>}</div>
        <div className={clsx('rounded-xl p-3', !known ? 'bg-slate-50' : afterEnd >= reserveMin ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}><div className={clsx('text-xs', !known && 'text-muted')}>Remaining Endurance</div><div className="text-xl font-semibold tabular-nums">{known ? hm(afterEnd) : '–'}</div>{!known && <div className="text-xs text-muted">nach der Landung</div>}</div>
      </div>
      {!finished && mayRelease && !saved?.fuelSupply && !(refuel.on && when === 'vor') && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Fuel size={16} /> Getankt nach dem Flug (Uplift)</h3><Switch checked={refuel.on && when === 'nach'} onChange={(v) => { setWhen('nach'); refuel.setOn(v) }} label="Getankt nach dem Flug" /></div>
          {refuel.on && when === 'nach' && <SupplyFields f={refuel.fields} />}
          {refuel.on && when === 'nach' && refuel.problem && <p className="text-xs text-muted">{refuel.problem}</p>}
        </div>
      )}
      {finished && next && <Card className="space-y-2 border-brand/40 bg-brand-soft p-4"><div className="text-sm font-semibold">Nächster Flug</div><div className="text-sm">{next.title}</div><Button variant="primary" size="lg" className="w-full" onClick={() => nav(flightPath(next.src))}>Nächsten Flug öffnen</Button></Card>}
      {finished ? <Banner>Ins Bordbuch übernommen: Flugzeit {flightMin !== null ? hm(flightMin) : '–'}, Blockzeit {blockMin !== null ? hm(blockMin) : '–'}, {flightKind}. Der Kassier verrechnet den Flug. <Link to="/bordbuch" className="font-medium underline">Zum Bordbuch</Link></Banner>
        : mayRelease && <Button variant="primary" size="lg" className="w-full" disabled={!allLogged || !!chrono || (flightMin ?? 0) <= 0 || (refuel.on && when === 'nach' && !!refuel.problem)} onClick={finish}>Flug abschließen und ins Bordbuch übernehmen</Button>}
    </Card>,
  ]

  return (
    <div className="mx-auto max-w-3xl pb-24 md:pb-28">
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Zurück</button>
      <div className="mb-3"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="info">{load ? 'aus dem Manifest' : 'aus der Reservierung'}</Badge><span className="inline-flex items-center gap-1.5"><CloudOff size={14} /> funktioniert ohne Netz, Eingaben werden später abgeglichen</span></div></div>

      <FuelMissingNotice subtle className="mb-3" />
      {released?.data && released.release && mb && (
        <Drawer open={pdfOpen} title={`${W} als PDF`} size="xl" onClose={() => setPdfOpen(false)}>
          <AfpPdf title={title} date="07.11.2026" reg={ac.reg} type={ac.type} d={d} data={released.data} result={released} design={branding} />
        </Drawer>
      )}
      {!mb && <div className="mb-3"><Banner tone="warn">{noMb}</Banner></div>}
      {!mayRelease && !released && <div className="mb-3"><Banner>Du kannst {sky ? 'das AFP' : 'den Flug'} ansehen. Erstellen und freigeben dürfen nur Piloten.</Banner></div>}

      <ol className="mb-3 flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button disabled={!canOpen(i)} onClick={() => setStep(i)} className={clsx('w-full whitespace-nowrap rounded-lg border px-2 py-2 text-xs font-medium sm:text-sm', step === i ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface', !canOpen(i) && 'opacity-40')}>{i + 1} {s}</button>
          </li>
        ))}
      </ol>

      {mb && (
        <div className={clsx('mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3', go ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
          <span className="font-semibold">{go ? 'Alles im Limit' : 'Nicht freigebbar'}</span>
          <span className="text-sm">{u.massText(start.w)} · CG {u.lengthText(start.arm)} · Endurance {hm(endurance)}</span>
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
