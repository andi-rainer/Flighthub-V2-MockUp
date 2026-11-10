import clsx from 'clsx'
import { AlertTriangle, Check, Droplet, Fuel, Info, Minus, Paperclip, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { aircraft, eur, members } from '../data'
import { offeredFor } from '../kinds'
import { useApp, type LogEntry, type Supply } from '../state'
import MemberPicker from '../MemberPicker'
import { Badge, Banner, Button, Card, Drawer, PageHeader, Segmented, Switch, usePaging } from '../ui'
import { openReceiptFile } from './finance/parts'
import { adjustText, FuelAdjustFields, FuelMissingNotice, useFuelAdjust } from './fuel/FuelAdjust'
import { SupplyFields, useSupplyForm } from './SupplyReceipt'
const KIND_BAR: Record<string, string> = { Sprungbetrieb: 'bg-brand', Charter: 'bg-warn', Schulung: 'bg-ok', Privat: 'bg-slate-400' } // other kinds: grey
/** Counter readings (hours) of each aircraft after the newest entry. */
const COUNTER: Record<string, number> = { 'OE-DZA': 4821.4, 'OE-KFR': 2310.8, 'OE-AXB': 1503.2 }
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmt = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`
const fmtHm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const fmtCounter = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60).toLocaleString('de-AT')}:${String(m % 60).padStart(2, '0')}` }

export default function Logbook() {
  const { entries, addEntry, patchEntry, flights, kinds, restFuel, setRestFuel, aircraftData, persona } = useApp()
  const [params] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [reg, setReg] = useState(params.get('flugzeug') ?? 'OE-DZA')
  const [pilot, setPilot] = useState(() => (params.get('nur') === 'beleg' ? members.find((m) => m.id === persona.memberId)?.name ?? '' : ''))
  const [kind, setKind] = useState('')
  const [only, setOnly] = useState<'' | 'beleg' | 'offen'>(params.get('nur') === 'beleg' ? 'beleg' : '')
  const [open, setOpen] = useState<LogEntry | null>(null)
  const [late, setLate] = useState<{ id: number; key: 'fuel' | 'oil' } | null>(null)
  const { ledger } = useApp()

  // The own flights whose fuel receipt is missing: one quick filter for the pilot (all aircraft), also reachable from the notice.
  const meName = members.find((m) => m.id === persona.memberId)?.name
  const mineMissing = entries.filter((e) => e.pilot === meName && e.fuel?.receipt.state === 'fehlt')
  const mineOn = pilot === meName && only === 'beleg'
  const showMine = () => { setReg(mineMissing[0]?.aircraft ?? reg); setPilot(meName ?? ''); setOnly('beleg') }
  const ofAircraft = entries.filter((e) => e.aircraft === reg)
  const openFlight = (e: LogEntry) => flights.find((f) => f.logId === e.id)?.state === 'offen'
  const missingOf = (e: LogEntry) => [e.fuel, e.oil].filter((s) => s?.receipt.state === 'fehlt').length
  const missing = ofAircraft.reduce((n, e) => n + missingOf(e), 0)
  const toCharge = ofAircraft.filter(openFlight).length
  // Counter after each entry: start with the current reading, subtract newer entries going back in time.
  const counter = new Map<number, number>()
  let running = COUNTER[reg] ?? 0
  for (const e of ofAircraft) { counter.set(e.id, running); running -= e.minutes / 60 }

  const rows = ofAircraft.filter((e) => (!pilot || e.pilot === pilot) && (!kind || e.kind === kind) && (only !== 'beleg' || missingOf(e) > 0) && (only !== 'offen' || openFlight(e)))
  const paging = usePaging(rows, `${reg}|${pilot}|${kind}|${only}|${entries.length}`)
  const shown = paging.rows
  const pilots = [...new Set(ofAircraft.map((e) => e.pilot))].sort()

  /** An entry changes the tank: it starts with the content (after de-fueling or a correction), the flight burns fuel, an uplift adds to it. */
  const applyTank = (e: LogEntry) => {
    const content = restFuel[e.aircraft] ?? 0
    const start = e.fuelAdjust ? (e.fuelAdjust.kind === 'defuel' ? Math.max(0, content - e.fuelAdjust.liters) : e.fuelAdjust.liters) : content
    const burn = ((aircraftData[aircraft.find((a) => a.reg === e.aircraft)?.id ?? '']?.burnLph ?? 0) * e.minutes) / 60
    setRestFuel(e.aircraft, Math.round((Math.max(0, start - burn) + (e.fuel?.amount ?? 0)) * 10) / 10)
  }

  if (adding) return <NewEntry aircraft={reg} last={ofAircraft[0]} onCancel={() => setAdding(false)} onSave={(e, note) => { addEntry(e); applyTank(e); setAdding(false); setSaved(note) }} />

  const fix = (id: number, key: 'fuel' | 'oil') => setLate({ id, key })
  const sel = 'h-9 rounded-lg border border-line bg-surface px-2 text-sm'
  const chip = (id: '' | 'beleg' | 'offen', label: string, n: number, tone: string) => n > 0 && (
    <button key={id} onClick={() => setOnly(only === id ? '' : id)} className={clsx('h-9 rounded-full border px-3 text-sm font-medium', only === id ? 'border-brand bg-brand-soft text-brand' : `border-line hover:bg-slate-50 ${tone}`)}>{label} · {n}</button>
  )

  return (
    <>
      <PageHeader title={`Bordbuch ${reg}`} actions={<Button variant="primary" onClick={() => { setSaved(null); setAdding(true) }}><Plus size={16} /> Neuer Eintrag</Button>} />
      {saved && <div className="mb-3"><Banner>{saved}</Banner></div>}
      {!mineOn && <FuelMissingNotice className="mb-3" onFilter={showMine} />}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Flugzeug" value={reg} onChange={(e) => { setReg(e.target.value); setPilot('') }} className={sel}>{aircraft.map((a) => <option key={a.id}>{a.reg}</option>)}</select>
        <MemberPicker ariaLabel="Pilot" className="w-56" clearable placeholder="Alle Piloten" value={members.find((m) => m.name === pilot)?.id} allow={(m) => pilots.includes(m.name)} onChange={(id) => setPilot(members.find((m) => m.id === id)?.name ?? '')} />
        <select aria-label="Betriebsart" value={kind} onChange={(e) => setKind(e.target.value)} className={sel}><option value="">Alle Betriebsarten</option>{[...new Set([...kinds.map((k) => k.name), ...entries.map((e) => e.kind)])].map((k) => <option key={k}>{k}</option>)}</select>
        {mineMissing.length > 0 && <button onClick={() => (mineOn ? (setPilot(''), setOnly('')) : showMine())} className={clsx('h-9 rounded-full border px-3 text-sm font-medium', mineOn ? 'border-brand bg-brand-soft text-brand' : 'border-line text-warn hover:bg-slate-50')}>Meine Flüge ohne Tankbeleg · {mineMissing.length}</button>}
        {chip('beleg', 'Beleg fehlt', missing, 'text-warn')}
        {chip('offen', 'Zu verrechnen', toCharge, 'text-warn')}
        <span className="ml-auto text-xs text-muted">{rows.length} {rows.length === 1 ? 'Eintrag' : 'Einträge'}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_td]:!px-2 [&_th]:!px-2 sm:[&_td]:!px-2.5 sm:[&_th]:!px-2.5">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted [&_th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2">Datum</th>
                <th className="hidden px-3 py-2 2xl:table-cell">Strecke</th>
                <th className="hidden px-3 py-2 xl:table-cell" title="Off-block · Take-off · Landing · On-block">Zeiten</th>
                <th className="px-3 py-2">Pilot</th>
                <th className="hidden px-3 py-2 md:table-cell">Art</th>
                <th className="px-3 py-2 text-right" title="Blockzeit / Flugzeit">Block / Flug</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">Ldg.</th>
                <th className="hidden px-3 py-2 md:table-cell">Betankung</th>
                <th className="hidden px-3 py-2 text-right lg:table-cell">Zähler</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-muted">Keine Einträge für diese Auswahl.</td></tr>}
              {shown.map((e) => (
                <tr key={e.id} onClick={() => setOpen(e)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2"><span className="flex items-center gap-2"><i className={clsx('h-4 w-1 rounded-full', KIND_BAR[e.kind])} title={e.kind} /><span className="hidden sm:inline">{e.date}</span><span className="sm:hidden">{e.date.slice(0, 6)}{e.date.slice(8)}</span>{e.from !== e.to && <span className="font-mono text-xs text-muted 2xl:hidden" title="Strecke">{e.from}→{e.to}</span>}</span></td>
                  <td className="hidden whitespace-nowrap px-3 py-2 font-mono text-xs 2xl:table-cell">{e.from === e.to ? e.from : `${e.from} → ${e.to}`}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 font-mono text-xs text-muted xl:table-cell">{e.times ? `${e.times.off} · ${e.times.to} · ${e.times.ld} · ${e.times.on}` : '–'}</td>
                  <td className="max-w-[7.5rem] truncate whitespace-nowrap px-3 py-2 sm:max-w-none">{e.pilot}</td>
                  <td className="hidden px-3 py-2 md:table-cell"><Badge tone={e.kind === 'Charter' ? 'warn' : 'neutral'}>{e.kind}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums">{e.blockMin ? fmtHm(e.blockMin) : '–'} / {fmtHm(e.minutes)}</td>
                  <td className="hidden px-3 py-2 text-right font-mono text-xs tabular-nums md:table-cell">{e.landings}×</td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    {!e.fuel && !e.oil && !e.fuelAdjust ? <span className="text-muted">–</span> : <span className="flex items-center gap-x-3 whitespace-nowrap">
                      {e.fuel && <SupplyChip icon={<Fuel size={13} />} label={`${e.fuel.amount} L`} s={e.fuel} onFix={() => fix(e.id, 'fuel')} />}
                      {e.fuelAdjust && <span title={adjustText(e.fuelAdjust)} className="text-xs font-medium text-warn">{e.fuelAdjust.kind === 'defuel' ? 'abgetankt' : 'Inhalt korrigiert'}</span>}
                      {e.oil && <SupplyChip icon={<Droplet size={13} />} label={`${e.oil.amount} L`} s={e.oil} onFix={() => fix(e.id, 'oil')} />}
                    </span>}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums lg:table-cell">{fmtCounter(counter.get(e.id) ?? 0)}</td>
                  <td className="px-3 py-2"><span className="flex items-center gap-1.5">
                    {e.afp === 'ja' && <span className="hidden sm:inline"><Badge tone="ok">{e.kind === 'Sprungbetrieb' ? 'AFP' : 'Flug'}</Badge></span>}
                    {openFlight(e) ? <Badge tone="warn"><span className="sm:hidden" title="zu verrechnen">offen</span><span className="hidden sm:inline">zu verrechnen</span></Badge> : <span title="verrechnet" aria-label="verrechnet" className="text-ok"><Check size={14} /></span>}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paging.bar}
      </Card>

      <Drawer open={!!open} title={open ? `Eintrag ${open.date} · ${open.aircraft}` : ''} onClose={() => setOpen(null)}>
        {open && <Detail e={open} counter={counter.get(open.id) ?? 0} charged={!openFlight(open)} />}
      </Drawer>
      {late && entries.find((x) => x.id === late.id)?.[late.key] && <LateReceipt key={`${late.id}${late.key}`} entry={entries.find((x) => x.id === late.id)!} which={late.key} onClose={() => setLate(null)} onDone={(sup) => { const e = entries.find((x) => x.id === late.id)!; const old = e[late.key]?.amount; patchEntry(late.id, { [late.key]: sup }); if (late.key === 'fuel' && old !== undefined && sup.amount !== old) setRestFuel(e.aircraft, Math.max(0, Math.round(((restFuel[e.aircraft] ?? 0) + sup.amount - old) * 10) / 10)); setLate(null) }} />}
    </>
  )
}

function SupplyChip({ icon, label, s, onFix }: { icon: React.ReactNode; label: string; s: Supply; onFix: () => void }) {
  return (
    <span className="inline-flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
      <span className="text-muted">{icon}</span>{label}
      {s.receipt.state === 'ja' && <span title="Beleg vorhanden" aria-label="Beleg vorhanden" className="text-ok"><Paperclip size={13} /></span>}
      {s.receipt.state === 'fehlt' && <button onClick={onFix} title="Beleg nachreichen" className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn hover:bg-amber-200"><AlertTriangle size={11} />Beleg fehlt</button>}
      {s.receipt.state === 'grund' && <span title={`Kein Beleg: ${s.receipt.reason}`} aria-label={`Kein Beleg: ${s.receipt.reason}`} className="text-muted"><Info size={13} /></span>}
    </span>
  )
}

function Detail({ e, counter, charged }: { e: LogEntry; counter: number; charged: boolean }) {
  const { ledger } = useApp()
  const supply = (s?: Supply) => {
    if (!s) return 'nein'
    const r = s.receiptId ? ledger.receipts.find((x) => x.id === s.receiptId) : undefined
    const text = s.receipt.state === 'entfaellt' ? `${s.amount} L` : `${s.amount} L · ${s.receipt.state === 'ja' ? 'Beleg vorhanden' : s.receipt.state === 'fehlt' ? 'Beleg fehlt' : `kein Beleg: ${s.receipt.reason}`}`
    return r ? <span>{text}{r.fuel && ` · ${eur(r.amount)} · ${eur(r.fuel.perLiter)}/L`}{r.paidBy && (() => { const x = ledger.expenseOf(r.id); return x ? ` · Auslage ${x.status === 'offen' ? 'zur Prüfung' : x.status === 'abgelehnt' ? 'abgelehnt' : 'gutgeschrieben'}` : ' · privat bezahlt' })()} <button onClick={() => openReceiptFile(r.name)} className="ml-1 inline-flex items-center gap-1 text-brand hover:underline"><Paperclip size={12} />Beleg</button></span> : text
  }
  const rows: [string, React.ReactNode][] = [
    ['Pilot', e.pilot], ['Betriebsart', e.kind], ['Strecke', e.from === e.to ? e.from : `${e.from} → ${e.to}`],
    ['Off-block / Take-off', e.times ? `${e.times.off} / ${e.times.to}` : '–'], ['Landing / On-block', e.times ? `${e.times.ld} / ${e.times.on}` : '–'],
    ['Blockzeit', e.blockMin ? fmt(e.blockMin) : '–'], ['Flugzeit', fmt(e.minutes)], ['Landungen', String(e.landings)], ['Zähler danach', `${fmtCounter(counter)} h`],
    ['Treibstoff', supply(e.fuel)], ...(e.fuelAdjust ? [['Tank', adjustText(e.fuelAdjust)] as [string, React.ReactNode]] : []), ['Öl', supply(e.oil)],
    ['Quelle', e.afp === 'ja' ? (e.kind === 'Sprungbetrieb' ? 'AFP' : 'Flug beginnen') : 'von Hand oder aus der Zeit vor V2'], ['Verrechnung', charged ? 'verrechnet' : 'wartet auf den Kassier'],
  ]
  return <dl className="divide-y divide-line text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>
}

function NewEntry({ aircraft: reg, last, onCancel, onSave }: { aircraft: string; last?: LogEntry; onCancel: () => void; onSave: (e: LogEntry, note: string) => void }) {
  const { memberCan, persona } = useApp()
  const pilots = members.filter((m) => memberCan(m.id, 'flight.log.create')).map((m) => m.name)
  const [pilot, setPilot] = useState(members.find((m) => m.id === persona.memberId && pilots.includes(m.name))?.name ?? pilots[0])
  const { kinds, splitFor, rateOf, modules } = useApp()
  const offered = offeredFor(kinds, reg, modules)
  const [kind, setKind] = useState<string>((offered.find((k) => k.manifest) ?? offered[0])?.name ?? '')
  const [from, setFrom] = useState(last?.to ?? 'LOLW') // carried over from the previous entry
  const [to, setTo] = useState(last?.to ?? 'LOLW')
  const [blockOff, setBlockOff] = useState('09:20')
  const [takeoff, setTakeoff] = useState('09:25')
  const [landing, setLanding] = useState('09:42')
  const [blockOn, setBlockOn] = useState('09:47')
  const [landings, setLandings] = useState(1)
  const [notes, setNotes] = useState('')

  // Fuel and oil are independent: either, both or none.
  const fuelF = useSupplyForm(true)
  const oilF = useSupplyForm(false)
  const { ledger, restFuel } = useApp()
  const content = restFuel[reg] ?? 0
  const adj = useFuelAdjust(content)

  const flight = toMin(landing) - toMin(takeoff)
  const block = toMin(blockOn) - toMin(blockOff)
  const errors = [
    flight <= 0 && 'Landung muss nach dem Start liegen.',
    toMin(takeoff) < toMin(blockOff) && 'Start liegt vor Block-off.',
    toMin(blockOn) < toMin(landing) && 'Block-on liegt vor der Landung.',
    adj.mode && adj.problem,
    fuelF.problem,
    oilF.problem,
  ].filter(Boolean) as string[]
  const cost = Math.max(0, flight) * rateOf(kind, reg)
  const billTo = splitFor(kind, pilot).map((x) => `${x.who}${x.percent < 100 ? ` (${x.percent} %)` : ''}`).join(', ')
  const missing = [fuelF.missing && 'Treibstoff', oilF.missing && 'Öl'].filter(Boolean)

  const field = 'h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand'
  const Time = ({ label, v, set }: { label: string; v: string; set: (s: string) => void }) => (
    <label className="block text-sm font-medium">{label}<input type="time" value={v} onChange={(e) => set(e.target.value)} className={clsx(field, 'mt-1 tabular-nums')} /></label>
  )

  return (
    <>
      <PageHeader title="Neuer Eintrag" actions={<Button onClick={onCancel}>Abbrechen</Button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold">1 · Flug</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="block text-sm font-medium">Pilot<MemberPicker ariaLabel="Pilot" className="mt-1" value={members.find((m) => m.name === pilot)?.id} allow={(m) => pilots.includes(m.name)} onChange={(id) => { const n = members.find((m) => m.id === id)?.name; if (n) setPilot(n) }} /></div>
              <label className="block text-sm font-medium">Datum<input defaultValue="07.11.2026" className={clsx(field, 'mt-1')} /></label>
            </div>
            <div><div className="mb-1 text-sm font-medium">Betriebsart</div><Segmented value={kind} onChange={setKind} options={offered.map((k) => ({ value: k.name, label: k.name }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">Von<input value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} className={clsx(field, 'mt-1 uppercase')} /></label>
              <label className="block text-sm font-medium">Nach<input value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} className={clsx(field, 'mt-1 uppercase')} /></label>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold">2 · Zeiten und Landungen</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Time label="Block-off" v={blockOff} set={setBlockOff} /><Time label="Start" v={takeoff} set={setTakeoff} /><Time label="Landung" v={landing} set={setLanding} /><Time label="Block-on" v={blockOn} set={setBlockOn} /></div>
            <div>
              <div className="mb-1 text-sm font-medium">Landungen</div>
              <div className="flex flex-wrap items-center gap-2">
                <button aria-label="Weniger" onClick={() => setLandings(Math.max(1, landings - 1))} className="grid h-12 w-12 place-items-center rounded-xl border border-line"><Minus size={18} /></button>
                <span className="w-12 text-center text-xl font-semibold tabular-nums">{landings}</span>
                <button aria-label="Mehr" onClick={() => setLandings(landings + 1)} className="grid h-12 w-12 place-items-center rounded-xl border border-line"><Plus size={18} /></button>
                {[5, 10, 15].map((n) => <button key={n} onClick={() => setLandings(n)} className="h-12 rounded-xl bg-slate-100 px-4 text-sm font-medium hover:bg-slate-200">{n}</button>)}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Fuel size={16} /> 3 · Betankung</h2><label className="flex items-center gap-2 text-sm">Getankt<Switch checked={fuelF.on} onChange={fuelF.setOn} label="Getankt" /></label></div>
            <FuelAdjustFields a={adj} content={content} />
            {fuelF.on && <SupplyFields f={fuelF.fields} />}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Droplet size={16} /> 4 · Öl</h2><label className="flex items-center gap-2 text-sm">Öl nachgefüllt<Switch checked={oilF.on} onChange={oilF.setOn} label="Öl nachgefüllt" /></label></div>
            {oilF.on && <SupplyFields f={oilF.fields} />}
          </Card>

          <Card className="p-5"><label className="block text-sm font-medium">Notizen (optional)<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-line p-3 font-normal outline-none focus:border-brand" /></label></Card>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="space-y-3 p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Zusammenfassung</div>
            <Row k="Flugzeit" v={flight > 0 ? fmt(flight) : '–'} />
            <Row k="Blockzeit" v={block > 0 ? fmt(block) : '–'} />
            <Row k="Zähler danach" v={`${fmtCounter((COUNTER[reg] ?? 0) + Math.max(0, flight) / 60)} h`} />
            <hr className="border-line" />
            <Row k="Flugkosten" v={eur(cost)} />
            <div className="text-xs text-muted">{fmt(Math.max(0, flight))} × {eur(rateOf(kind, reg))}/min · vorgesehen für: <b className="text-ink">{billTo}</b>. Der Kassier bestätigt die Verrechnung.</div>
            {errors.map((e) => <p key={e} className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{e}</p>)}
            {missing.length > 0 && errors.length === 0 && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-amber-900">Beleg fehlt für: {missing.join(', ')}. Speichern geht, der Eintrag bleibt dann markiert.</p>}
            <Button variant="primary" size="lg" className="w-full" disabled={errors.length > 0} onClick={() => onSave({
              id: Date.now(), aircraft: reg, times: { off: blockOff, to: takeoff, ld: landing, on: blockOn }, blockMin: block > 0 ? block : undefined, date: '07.11.2026', pilot, kind, from, to, minutes: flight, landings,
              fuel: fuelF.commit(ledger, reg), fuelAdjust: adj.adjust,
              oil: oilF.commit(ledger, reg),
            }, `Eintrag gespeichert: ${fmt(flight)}, ${landings} Landung(en). Der Flug wartet beim Kassier auf die Verrechnung${missing.length ? `. Beleg fehlt noch: ${missing.join(', ')}.` : '.'}`)}>
              <Check size={18} /> Eintrag speichern
            </Button>
          </Card>
        </aside>
      </div>
    </>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between text-sm"><span className="text-muted">{k}</span><span className="font-semibold tabular-nums">{v}</span></div>

/** Hands in the receipt of a fill-up that was entered without one. */
function LateReceipt({ entry, which, onClose, onDone }: { entry: LogEntry; which: 'fuel' | 'oil'; onClose: () => void; onDone: (s: Supply) => void }) {
  const { ledger } = useApp()
  const sup = entry[which]!
  const f = useSupplyForm(which === 'fuel', sup.amount)
  const L = (n: number) => `${String(n).replace('.', ',')} L`
  const changed = f.fields.amount !== sup.amount
  return (
    <Drawer open title={`${which === 'fuel' ? 'Treibstoff' : 'Öl'}-Beleg ${entry.date} · ${entry.aircraft}`} onClose={onClose}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={!!f.problem || !f.cap.file} onClick={() => { const s = f.commit(ledger, entry.aircraft); if (s) onDone(s) }}>{changed ? `Beleg speichern, Eintrag auf ${L(f.fields.amount)} ändern` : 'Beleg speichern'}</Button>}>
      <div className="space-y-4">
        {changed && <p className="rounded-xl border-2 border-warn bg-warn-soft p-3 text-sm font-semibold text-amber-900">Der Eintrag wird von {L(sup.amount)} auf {L(f.fields.amount)} geändert. Der Tankinhalt wird nachgezogen.</p>}
        <SupplyFields f={f.fields} hideAmount />
        {f.problem && f.cap.file && <p className="text-sm text-warn">{f.problem}</p>}
      </div>
    </Drawer>
  )
}
