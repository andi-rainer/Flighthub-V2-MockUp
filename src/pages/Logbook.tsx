import clsx from 'clsx'
import { AlertTriangle, Check, Droplet, FileUp, Fuel, Info, Minus, Paperclip, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { aircraft, eur, members } from '../data'
import { RATE_PER_MIN, splitFor, useApp, type LogEntry, type Supply, type Rcpt } from '../state'
import { Badge, Banner, Button, Card, Drawer, PageHeader, Segmented, Switch, usePaging } from '../ui'

const kinds = ['Sprungbetrieb', 'Charter', 'Schulung', 'Privat'] as const
const reasons = ['Beleg kommt später', 'Beleg verloren', 'Vereinstankstelle, kein Beleg', 'Barzahlung ohne Beleg', 'Sonstiges'] as const
const KIND_BAR: Record<string, string> = { Sprungbetrieb: 'bg-brand', Charter: 'bg-warn', Schulung: 'bg-ok', Privat: 'bg-slate-400' }
/** Counter readings (hours) of each aircraft after the newest entry. */
const COUNTER: Record<string, number> = { 'OE-DZA': 4821.4, 'OE-KFR': 2310.8, 'OE-AXB': 1503.2 }
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmt = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`
const fmtHm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const fmtCounter = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60).toLocaleString('de-AT')}:${String(m % 60).padStart(2, '0')}` }

export default function Logbook() {
  const { entries, addEntry, patchEntry, flights } = useApp()
  const [adding, setAdding] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [reg, setReg] = useState('OE-DZA')
  const [pilot, setPilot] = useState('')
  const [kind, setKind] = useState('')
  const [only, setOnly] = useState<'' | 'beleg' | 'offen'>('')
  const [open, setOpen] = useState<LogEntry | null>(null)

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

  if (adding) return <NewEntry aircraft={reg} last={ofAircraft[0]} onCancel={() => setAdding(false)} onSave={(e, note) => { addEntry(e); setAdding(false); setSaved(note) }} />

  const fix = (id: number, key: 'fuel' | 'oil') => { const e = entries.find((x) => x.id === id); if (e?.[key]) patchEntry(id, { [key]: { ...e[key]!, receipt: { state: 'ja' } } }) }
  const sel = 'h-9 rounded-lg border border-line bg-surface px-2 text-sm'
  const chip = (id: '' | 'beleg' | 'offen', label: string, n: number, tone: string) => n > 0 && (
    <button key={id} onClick={() => setOnly(only === id ? '' : id)} className={clsx('h-9 rounded-full border px-3 text-sm font-medium', only === id ? 'border-brand bg-brand-soft text-brand' : `border-line hover:bg-slate-50 ${tone}`)}>{label} · {n}</button>
  )

  return (
    <>
      <PageHeader title={`Bordbuch ${reg}`} actions={<Button variant="primary" onClick={() => { setSaved(null); setAdding(true) }}><Plus size={16} /> Neuer Eintrag</Button>} />
      {saved && <div className="mb-3"><Banner>{saved}</Banner></div>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Flugzeug" value={reg} onChange={(e) => { setReg(e.target.value); setPilot('') }} className={sel}>{aircraft.map((a) => <option key={a.id}>{a.reg}</option>)}</select>
        <select aria-label="Pilot" value={pilot} onChange={(e) => setPilot(e.target.value)} className={sel}><option value="">Alle Piloten</option>{pilots.map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Betriebsart" value={kind} onChange={(e) => setKind(e.target.value)} className={sel}><option value="">Alle Betriebsarten</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
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
                    {!e.fuel && !e.oil ? <span className="text-muted">–</span> : <span className="flex items-center gap-x-3 whitespace-nowrap">
                      {e.fuel && <SupplyChip icon={<Fuel size={13} />} label={`${e.fuel.amount} L`} s={e.fuel} onFix={() => fix(e.id, 'fuel')} />}
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
  const supply = (s?: Supply) => !s ? 'nein' : `${s.amount} L · ${s.receipt.state === 'ja' ? 'Beleg vorhanden' : s.receipt.state === 'fehlt' ? 'Beleg fehlt' : `kein Beleg: ${s.receipt.reason}`}`
  const rows: [string, string][] = [
    ['Pilot', e.pilot], ['Betriebsart', e.kind], ['Strecke', e.from === e.to ? e.from : `${e.from} → ${e.to}`],
    ['Off-block / Take-off', e.times ? `${e.times.off} / ${e.times.to}` : '–'], ['Landing / On-block', e.times ? `${e.times.ld} / ${e.times.on}` : '–'],
    ['Blockzeit', e.blockMin ? fmt(e.blockMin) : '–'], ['Flugzeit', fmt(e.minutes)], ['Landungen', String(e.landings)], ['Zähler danach', `${fmtCounter(counter)} h`],
    ['Treibstoff', supply(e.fuel)], ['Öl', supply(e.oil)],
    ['Quelle', e.afp === 'ja' ? (e.kind === 'Sprungbetrieb' ? 'AFP' : 'Flug beginnen') : 'von Hand oder aus der Zeit vor V2'], ['Verrechnung', charged ? 'verrechnet' : 'wartet auf den Kassier'],
  ]
  return <dl className="divide-y divide-line text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>
}

/** Upload OR a reason why there is no receipt. Used for fuel and oil. */
function ReceiptField({ files, setFiles, noReceipt, setNoReceipt, reason, setReason, other, setOther }: {
  files: string[]; setFiles: (f: string[]) => void; noReceipt: boolean; setNoReceipt: (b: boolean) => void
  reason: string; setReason: (s: string) => void; other: string; setOther: (s: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Rechnung oder Lieferschein</div>
      {!noReceipt ? (
        <>
          <input ref={ref} type="file" accept="application/pdf,image/*" capture="environment" multiple className="hidden" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)])} />
          <button onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line py-5 text-sm text-muted hover:border-brand hover:text-brand"><FileUp size={22} /> Foto aufnehmen oder PDF wählen</button>
          {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((f) => <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-medium text-ok"><Paperclip size={12} />{f}<button aria-label="Entfernen" onClick={() => setFiles(files.filter((x) => x !== f))}><X size={12} /></button></span>)}</div>}
          {files.length === 0 && <button onClick={() => setNoReceipt(true)} className="mt-2 text-sm text-brand">Kein Beleg vorhanden</button>}
          {files.length > 0 && <p className="mt-2 text-xs text-muted">Der Beleg wird mit der passenden Bankbuchung in Finanzen verknüpft.</p>}
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="text-sm font-medium">Warum gibt es keinen Beleg?</div>
          <div className="flex flex-wrap gap-2">{reasons.map((r) => <button key={r} onClick={() => setReason(r)} className={clsx('rounded-lg border px-3 py-2 text-sm', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
          {reason === 'Sonstiges' && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Grund kurz beschreiben" className="h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />}
          <button onClick={() => { setNoReceipt(false); setReason(''); setOther('') }} className="text-sm text-brand">Doch einen Beleg hochladen</button>
        </div>
      )}
    </div>
  )
}

function NewEntry({ aircraft: reg, last, onCancel, onSave }: { aircraft: string; last?: LogEntry; onCancel: () => void; onSave: (e: LogEntry, note: string) => void }) {
  const { memberCan, persona } = useApp()
  const pilots = members.filter((m) => memberCan(m.id, 'flight.log.create')).map((m) => m.name)
  const [pilot, setPilot] = useState(members.find((m) => m.id === persona.memberId && pilots.includes(m.name))?.name ?? pilots[0])
  const [kind, setKind] = useState<(typeof kinds)[number]>('Sprungbetrieb')
  const [from, setFrom] = useState(last?.to ?? 'LOLW') // carried over from the previous entry
  const [to, setTo] = useState(last?.to ?? 'LOLW')
  const [blockOff, setBlockOff] = useState('09:20')
  const [takeoff, setTakeoff] = useState('09:25')
  const [landing, setLanding] = useState('09:42')
  const [blockOn, setBlockOn] = useState('09:47')
  const [landings, setLandings] = useState(1)
  const [notes, setNotes] = useState('')

  // Fuel and oil are independent: either, both or none.
  const [fueled, setFueled] = useState(false)
  const [litres, setLitres] = useState(0)
  const [price, setPrice] = useState('')
  const fuelR = useReceiptState()
  const [oiled, setOiled] = useState(false)
  const [oilL, setOilL] = useState(0)
  const oilR = useReceiptState()

  const flight = toMin(landing) - toMin(takeoff)
  const block = toMin(blockOn) - toMin(blockOff)
  const errors = [
    flight <= 0 && 'Landung muss nach dem Start liegen.',
    toMin(takeoff) < toMin(blockOff) && 'Start liegt vor Block-off.',
    toMin(blockOn) < toMin(landing) && 'Block-on liegt vor der Landung.',
    fueled && litres <= 0 && 'Bei „Getankt“ bitte die Liter angeben.',
    fueled && fuelR.invalid && 'Treibstoff: Grund für den fehlenden Beleg angeben.',
    oiled && oilL <= 0 && 'Bei „Öl“ bitte die Menge angeben.',
    oiled && oilR.invalid && 'Öl: Grund für den fehlenden Beleg angeben.',
  ].filter(Boolean) as string[]
  const cost = Math.max(0, flight) * RATE_PER_MIN
  const billTo = splitFor(kind, pilot).map((x) => x.who).join(', ')
  const missing = [fueled && litres > 0 && fuelR.state.state === 'fehlt' && 'Treibstoff', oiled && oilL > 0 && oilR.state.state === 'fehlt' && 'Öl'].filter(Boolean)

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
              <label className="block text-sm font-medium">Pilot<select value={pilot} onChange={(e) => setPilot(e.target.value)} className={clsx(field, 'mt-1')}>{pilots.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label className="block text-sm font-medium">Datum<input defaultValue="07.11.2026" className={clsx(field, 'mt-1')} /></label>
            </div>
            <div><div className="mb-1 text-sm font-medium">Betriebsart</div><Segmented value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: k }))} /></div>
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
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Fuel size={16} /> 3 · Betankung</h2><label className="flex items-center gap-2 text-sm">Getankt<Switch checked={fueled} onChange={setFueled} label="Getankt" /></label></div>
            {fueled && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">Liter<input inputMode="decimal" value={litres || ''} onChange={(e) => setLitres(Number(e.target.value.replace(',', '.')) || 0)} className={clsx(field, 'mt-1')} /></label>
                  <label className="block text-sm font-medium">Preis gesamt (optional)<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="aus dem Beleg" className={clsx(field, 'mt-1')} /></label>
                </div>
                <ReceiptField {...fuelR.props} />
              </>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Droplet size={16} /> 4 · Öl</h2><label className="flex items-center gap-2 text-sm">Öl nachgefüllt<Switch checked={oiled} onChange={setOiled} label="Öl nachgefüllt" /></label></div>
            {oiled && (
              <>
                <label className="block text-sm font-medium">Menge (Liter)<input inputMode="decimal" value={oilL || ''} onChange={(e) => setOilL(Number(e.target.value.replace(',', '.')) || 0)} className={clsx(field, 'mt-1 sm:w-48')} /></label>
                <ReceiptField {...oilR.props} />
              </>
            )}
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
            <div className="text-xs text-muted">{fmt(Math.max(0, flight))} × {eur(RATE_PER_MIN)}/min · vorgesehen für: <b className="text-ink">{billTo}</b>. Der Kassier bestätigt die Verrechnung.</div>
            {errors.map((e) => <p key={e} className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{e}</p>)}
            {missing.length > 0 && errors.length === 0 && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-amber-900">Beleg fehlt für: {missing.join(', ')}. Speichern geht, der Eintrag bleibt dann markiert.</p>}
            <Button variant="primary" size="lg" className="w-full" disabled={errors.length > 0} onClick={() => onSave({
              id: Date.now(), aircraft: reg, times: { off: blockOff, to: takeoff, ld: landing, on: blockOn }, blockMin: block > 0 ? block : undefined, date: '07.11.2026', pilot, kind, from, to, minutes: flight, landings,
              fuel: fueled ? { amount: litres, receipt: fuelR.state } : undefined,
              oil: oiled ? { amount: oilL, receipt: oilR.state } : undefined,
            }, `Eintrag gespeichert: ${fmt(flight)}, ${landings} Landung(en). Der Flug wartet beim Kassier auf die Verrechnung${missing.length ? `. Beleg fehlt noch: ${missing.join(', ')}.` : '.'}`)}>
              <Check size={18} /> Eintrag speichern
            </Button>
          </Card>
        </aside>
      </div>
    </>
  )
}

function useReceiptState() {
  const [files, setFiles] = useState<string[]>([])
  const [noReceipt, setNoReceipt] = useState(false)
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const text = reason === 'Sonstiges' ? other.trim() : reason
  const state: Rcpt = files.length > 0 ? { state: 'ja' } : noReceipt && text ? { state: 'grund', reason: text } : { state: 'fehlt' }
  return { state, invalid: noReceipt && !text, props: { files, setFiles, noReceipt, setNoReceipt, reason, setReason, other, setOther } }
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between text-sm"><span className="text-muted">{k}</span><span className="font-semibold tabular-nums">{v}</span></div>
