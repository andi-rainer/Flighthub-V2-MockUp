import { FuelMissingNotice } from './fuel/FuelAdjust'
import { ExpenseSubmitCard } from './finance/ExpenseSubmit'
import clsx from 'clsx'
import MemberDocuments from './members/MemberDocuments'
import { AlertTriangle, ArrowRight, CheckCircle2, Plane } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aircraft, eur, members } from '../data'
import { flightNo, TODAY_ISO, useApp } from '../state'
import { useNavigate } from 'react-router-dom'
import { fmtAbs } from '../dates'
import { flightKey, flightPath, type FlightSource } from './FlightPage'
import { Badge, Button, Card, PageHeader, Stat } from '../ui'
import { dueList } from './aircraft/data'
import { computeResults } from './finance/results'
import { initialFees } from './members/data'
import { MANIFEST_TODAY, TODAY_DAY } from './manifest/data'

export default function Dashboard() {
  const { can, modules } = useApp()
  // The dashboard follows what a person may do, not a fixed role.
  if (can('billing.view.all')) return <Treasurer />
  if (can('manifest.operation_days.edit') && modules.skydive) return <ManifestDay />
  if (can('afp.create')) return <PilotHome />
  return <MemberHome />
}

/** Every card is a task or a number that leads to the exact place where it is handled. */
function Task({ to, n, label, hint }: { to: string; n: number; label: string; hint: string }) {
  return (
    <Link to={to} className={clsx('group flex items-center gap-4 rounded-xl border bg-surface p-4 transition hover:border-brand', n > 0 ? 'border-line' : 'border-line opacity-70')}>
      <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-semibold tabular-nums', n > 0 ? 'bg-brand-soft text-brand' : 'bg-ok-soft text-ok')}>{n > 0 ? n : <CheckCircle2 size={20} />}</span>
      <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="block text-sm text-muted">{n > 0 ? hint : 'Nichts offen'}</span></span>
      <ArrowRight size={16} className="text-muted group-hover:text-brand" />
    </Link>
  )
}

function Treasurer() {
  const { ledger, flights, apps, hasAccount, persona, can, aircraftData, docsOf, entries } = useApp()
  const year = TODAY_ISO.slice(0, 4)
  const res = computeResults(ledger, entries, year)
  const { income, cost } = res
  const rows = res.rows.filter((r) => r.cc.kind === 'Sparte')
  const withAccount = members.filter((m) => hasAccount(m.id))
  const toCharge = flights.filter((f) => f.state === 'offen').length
  const openLines = ledger.lines.filter((l) => !ledger.done[l.id]).length
  const openExpenses = ledger.expenses.filter((x) => x.status === 'offen').length
  const noReceipt = ledger.lines.filter((l) => l.needsReceipt && !ledger.receipts.some((r) => r.lineId === l.id)).length
  const decide = apps.filter((a) => a.status === 'Unterzeichnet').length
  const feesDue = initialFees.filter((f) => f.state === 'faellig').length
  const owed = withAccount.reduce((n, m) => n + Math.min(0, ledger.balances[m.id] ?? 0), 0)
  const credit = withAccount.reduce((n, m) => n + Math.max(0, ledger.balances[m.id] ?? 0), 0)
  const dues = aircraft.flatMap((a) => dueList(aircraftData[a.id], TODAY_ISO).map((d) => ({ ...d, reg: a.reg }))).sort((a, b) => a.days - b.days).slice(0, 4)
  const expiring = members.reduce((n, m) => n + docsOf(m.id).filter((d) => d.state !== 'ok').length, 0)
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.result)))

  return (
    <>
      <PageHeader title={`Guten Morgen, ${members.find((m) => m.id === persona.memberId)!.name.split(' ')[0]}`} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Task to="/finanzen?tab=verrechnen" n={toCharge} label="Flüge verrechnen" hint="aus dem Bordbuch, wartet auf deine Bestätigung" />
        <Task to="/finanzen?tab=auslagen" n={openExpenses} label="Auslagen prüfen" hint="Bar-Auslagen von Mitgliedern warten auf deine Prüfung" />
        <Task to="/finanzen?tab=bank" n={openLines} label="Bankzeilen zuordnen" hint="Vorschläge der KI warten auf dich" />
        <Task to="/finanzen?tab=bank" n={noReceipt} label="Belege fehlen" hint="Buchungen ohne Rechnung oder Lieferschein" />
        <Task to="/mitglieder?tab=antraege" n={decide} label="Anträge entscheiden" hint="unterschrieben, warten auf Genehmigung" />
        <Task to="/mitglieder?tab=beitraege" n={feesDue} label="Beitragslauf" hint="Rechnungen sind bereit zur Freigabe" />
        <Task to="/finanzen?tab=konten" n={1} label="Kontoauszüge Oktober" hint="zur Freigabe vor dem Versand" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Kassa" value={eur(ledger.cash)} hint="Bargeld" />
        <Stat label="Offen bei Mitgliedern" value={eur(owed)} tone={owed < 0 ? 'bad' : undefined} hint="Betriebskonten im Minus" />
        <Stat label="Guthaben der Mitglieder" value={eur(credit)} hint="Vorauszahlungen" />
        <Stat label={`Ergebnis ${year}`} value={eur(income - cost)} tone={income - cost >= 0 ? 'ok' : 'bad'} hint="Erträge minus Kosten" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><div className="mb-3 font-semibold">Geldfluss 2026</div><Cashflow /></Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between font-semibold">Ergebnis je Sparte<Link to="/finanzen?tab=ergebnis" className="text-sm font-normal text-brand">Details</Link></div>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.cc.id} className="grid grid-cols-[140px_1fr_90px] items-center gap-3 text-sm">
                <span>{r.cc.name}</span>
                <div className="relative h-5"><div className="absolute left-1/2 top-0 h-5 w-px bg-line" /><div className={clsx('absolute top-0.5 h-4 rounded-sm', r.result >= 0 ? 'left-1/2 bg-ok' : 'right-1/2 bg-bad')} style={{ width: `${(Math.abs(r.result) / max) * 50}%` }} /></div>
                <span className={clsx('text-right font-medium tabular-nums', r.result < 0 && 'text-bad')}>{eur(r.result)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 font-semibold">Als Nächstes fällig</div>
          <div className="divide-y divide-line">
            {dues.map((d) => <div key={d.reg + d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span><b>{d.reg}</b> {d.name}</span><span className={clsx(d.days < 30 ? 'font-medium text-bad' : 'text-muted')}>{d.label}</span></div>)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 font-semibold">Mitglieder</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Dokumente laufen ab oder sind abgelaufen</span><Badge tone={expiring ? 'warn' : 'ok'}>{expiring}</Badge></div>
            <div className="flex justify-between"><span className="text-muted">Ohne Gewichtsangabe</span><Badge tone="warn">{members.filter((m) => !m.weight).length}</Badge></div>
            <div className="flex justify-between"><span className="text-muted">Aktive Mitglieder</span><span className="font-medium">{members.filter((m) => m.membership === 'aktiv').length}</span></div>
          </div>
          <div className="mt-3"><Link to="/mitglieder" className="text-sm text-brand">Zur Mitgliederverwaltung</Link></div>
        </Card>
      </div>
    </>
  )
}

const inc = [4.1, 3.2, 5.8, 7.9, 9.4, 10.8, 11.5, 9.6, 8.2, 6.5]
const exp = [5.2, 4.8, 5.1, 6.0, 6.9, 7.3, 7.8, 7.1, 6.6, 6.4]
const mon = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O']
function Cashflow() {
  const W = 520, H = 200, L = 34, B = 24, max = 12
  const y = (v: number) => H - B - (v / max) * (H - B - 8)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Einnahmen und Ausgaben je Monat">
        {[0, 4, 8, 12].map((t) => <g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#e2e8f0" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#64748b">{t}k</text></g>)}
        {mon.map((m, i) => {
          const x = L + 10 + i * 48
          return (
            <g key={m + i}>
              <rect x={x} y={y(inc[i])} width="16" height={H - B - y(inc[i])} rx="2" fill="#0b5fff" />
              <rect x={x + 18} y={y(exp[i])} width="16" height={H - B - y(exp[i])} rx="2" fill="#94a3b8" />
              <text x={x + 17} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{m}</text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand" />Einnahmen</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-400" />Ausgaben</span><span>Beispielwerte in Tausend Euro</span></div>
    </>
  )
}

function ManifestDay() {
  const { checkedIn, weights, docsOf } = useApp()
  const here = members.filter((m) => checkedIn.includes(m.id))
  const warnings = here.flatMap((m) => [
    ...docsOf(m.id).filter((d) => d.state === 'abgelaufen').map((d) => `${m.name}: ${d.label} abgelaufen`),
    ...(weights[m.id] ? [] : [`${m.name}: Gewicht fehlt`]),
  ])
  const ac = aircraft[0]
  return (
    <>
      <PageHeader title="Heute, Samstag 07.11." subtitle="Sprungtag aktiv" actions={<Link to={MANIFEST_TODAY}><Button variant="primary" size="lg">Zum Manifest</Button></Link>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Am Platz eingecheckt" value={String(here.length)} hint="Sportspringer" />
        <Stat label="Tandem heute" value="2" hint="1 Voucher, 1 online bezahlt" />
        <Stat label="Flugzeug" value={ac.reg} hint="einsatzbereit" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-warn" /> Hinweise</div>
          {warnings.length === 0 ? <p className="text-sm text-muted">Keine Hinweise.</p> : <ul className="space-y-1.5 text-sm">{warnings.map((w) => <li key={w} className="rounded-lg bg-warn-soft px-3 py-2">{w}</li>)}</ul>}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold"><Plane size={16} /> {ac.reg}</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Nächster Check</span><span>100-h-Check in 17,6 h</span></div>
            <div className="flex justify-between"><span className="text-muted">Masse und Schwerpunkt</span><Link to="/flugzeuge/a1/rechner" className="text-brand">Envelope ansehen</Link></div>
          </div>
        </Card>
      </div>
    </>
  )
}

function MemberHome() {
  const { persona, ledger, checkedIn, toggleCheckIn, weights, setWeight, modules } = useApp()
  const m = members.find((x) => x.id === persona.memberId)!
  const here = checkedIn.includes(m.id)
  const balance = ledger.balances[m.id] ?? 0
  const kg = weights[m.id]
  return (
    <>
      <PageHeader title={`Hallo ${m.name.split(' ')[0]}`} subtitle={modules.skydive ? 'Heute am Platz?' : undefined} />
      <FuelMissingNotice className="mb-5" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2"><ExpenseSubmitCard /></div>
        {modules.skydive && <Card className="p-5">
          <div className="text-sm font-semibold">Check-in</div>
          <p className="mt-1 text-sm text-muted">{here ? 'Du bist eingecheckt. Das Manifest sieht dich und kann dich auf einen Flug setzen.' : 'Check dich ein, damit dich das Manifest auf einen Flug setzen kann.'}</p>
          <Button variant={here ? 'secondary' : 'primary'} size="lg" className="mt-4 w-full" onClick={() => toggleCheckIn(m.id)} disabled={!kg}>{here ? 'Ich bin wieder weg' : 'Ich bin am Platz'}</Button>
          <label className="mt-4 block text-sm font-medium">Mein Gewicht (kg)
            <input inputMode="numeric" value={kg ?? ''} onChange={(e) => setWeight(m.id, Number(e.target.value) || 0)} className="mt-1 h-11 w-32 rounded-lg border border-line px-3 outline-none focus:border-brand" />
          </label>
          <p className="mt-1 text-xs text-muted">Pflicht, damit der Schwerpunkt im Flugzeug stimmt. Bitte aktuell halten. Ohne Gewicht ist kein Check-in möglich.</p>
        </Card>}
        <Card className="p-5">
          <div className="text-sm font-semibold">Mein Betriebskonto</div>
          <div className={clsx('mt-1 text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</div>
          <p className="mt-1 text-sm text-muted">{balance < 0 ? 'Bitte bei Gelegenheit einzahlen oder überweisen.' : 'Guthaben vorhanden.'}</p>
          <Link to="/mein-konto" className="mt-3 inline-block text-sm text-brand">Buchungen und Einzahlen</Link>
        </Card>
        <Card className="p-5">
          <MemberDocuments memberId={m.id} title="Meine Dokumente" />
        </Card>
        {modules.skydive && <Card className="p-5">
          <div className="mb-2 text-sm font-semibold">Meine letzten Sprünge</div>
          <div className="divide-y divide-line text-sm">{[['31.10.', '4 Sprünge'], ['24.10.', '3 Sprünge'], ['17.10.', '5 Sprünge']].map(([d, t]) => <div key={d} className="flex justify-between py-2"><span className="text-muted">{d}</span>{t}</div>)}</div>
        </Card>}
      </div>
    </>
  )
}

/** The pilot sees the whole flying day: his flights and AFPs, the aircraft, who is at the field, his account and documents. */
function PilotHome() {
  const { loads, afps, persona, checkedIn, ledger, entries, can, reservations, afpConfig, modules } = useApp()
  const m = members.find((x) => x.id === persona.memberId)!
  const nav = useNavigate()
  // The flights of today with this pilot entered in the manifest, in time order; the first one is the next flight.
  const open = !modules.skydive ? [] : loads.filter((l) => l.dayId === TODAY_DAY && l.pilotId === m.id && l.status !== 'gelandet').sort((a, b) => a.time.localeCompare(b.time))
  const next = open[0]
  const myRes = !modules.charter ? [] : reservations.filter((r) => r.memberId === m.id && !r.standby)
  const balance = ledger.balances[m.id] ?? 0
  const mine = entries.filter((e) => e.pilot === m.name).slice(0, 3)
  const ac = aircraft[0]
  const row = (src: FlightSource, title: string, sub: string) => {
    const a = afps[flightKey(src)]
    if (!afpConfig.enabled) return <div key={flightKey(src)} className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{title}</div><div className="text-sm text-muted">{sub}</div></div>
    return (
      <div key={flightKey(src)} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
        <div className="min-w-0 flex-1 basis-56"><div className="font-medium">{title}</div><div className="text-sm text-muted">{sub}</div></div>
        {a ? <Badge tone="ok">{src.kind === 'load' ? 'AFP' : 'Flug'} {a.status === 'Gelandet' ? 'beendet' : 'läuft'}</Badge> : <Badge tone="warn">{src.kind === 'load' ? 'AFP offen' : 'bereit'}</Badge>}
        <Button variant={a ? 'secondary' : 'primary'} size="lg" className="ml-auto" onClick={() => nav(flightPath(src))}>{a ? (src.kind === 'load' ? 'AFP ansehen' : 'Flug ansehen') : src.kind === 'load' ? 'AFP starten' : 'Flug beginnen'}</Button>
      </div>
    )
  }
  return (
    <>
      <PageHeader title={`Hallo ${m.name.split(' ')[0]}`} actions={modules.charter ? <Link to="/reservierungen"><Button>Flugzeug reservieren</Button></Link> : undefined} />
      {next && (
        <Card className="mb-5 flex flex-wrap items-center gap-4 border-brand/40 bg-brand-soft/50 p-5">
          <div className="min-w-0 flex-1 basis-56">
            <div className="text-sm font-medium text-brand">Dein nächster Flug</div>
            <div className="text-xl font-semibold">Sprungflug {flightNo(loads, next)} · {next.time}</div>
            <div className="text-sm text-muted">{next.jumpers.length === 0 ? 'Noch niemand eingeteilt' : `${next.jumpers.length} im Manifest`} · OE-DZA{afpConfig.enabled && afps[flightKey({ kind: 'load', loadId: next.id })] ? ' · AFP läuft' : ''}</div>
          </div>
          {afpConfig.enabled && <Button variant="primary" size="lg" onClick={() => nav(flightPath({ kind: 'load', loadId: next.id }))}>{afps[flightKey({ kind: 'load', loadId: next.id })] ? 'AFP ansehen' : 'AFP starten'}</Button>}
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2"><ExpenseSubmitCard /></div>
        <Card className="space-y-3 p-5 lg:col-span-2">
          <div className="font-semibold">Deine Flüge heute</div>
          {myRes.filter((r) => r.from < 24).map((r) => row({ kind: 'res', resId: r.id }, `Freier Flug · ${r.aircraft} · ${fmtAbs(r.from)} bis ${fmtAbs(r.to)}`, 'aus deiner Reservierung'))}
          {open.slice(1).map((l) => row({ kind: 'load', loadId: l.id }, `Sprungflug ${flightNo(loads, l)} · ${l.time}`, `${l.jumpers.length} im Manifest · OE-DZA`))}
          {open.length <= 1 && myRes.filter((r) => r.from < 24).length === 0 && <p className="text-sm text-muted">{next ? 'Sonst keine weiteren Flüge heute.' : 'Du bist heute auf keinem Sprungflug eingetragen. Reserviere ein Flugzeug für einen freien Flug.'}</p>}
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Plane size={16} /> {ac.reg}</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Status</span><Badge tone="ok">einsatzbereit</Badge></div>
            <div className="flex justify-between"><span className="text-muted">Nächster Check</span><span>100-h-Check in 17,6 h</span></div>
            <div className="flex justify-between"><span className="text-muted">Masse und Schwerpunkt</span><Link to="/flugzeuge/a1/rechner" className="text-brand">Envelope ansehen</Link></div>
          </div>
        </Card>
        {modules.skydive && <Card className="p-5">
          <div className="mb-2 font-semibold">Am Platz</div>
          <div className="text-sm"><b className="text-2xl tabular-nums">{checkedIn.length}</b> Springer eingecheckt</div>
          <p className="mt-1 text-sm text-muted">{can('manifest.jumpers.assign') ? '' : 'Du siehst das Manifest lesend. Einsetzen macht der Koordinator.'}</p>
          <Link to={MANIFEST_TODAY} className="mt-2 inline-block text-sm text-brand">Manifest ansehen</Link>
        </Card>}
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between font-semibold">Meine letzten Flüge<Link to="/bordbuch" className="text-sm font-normal text-brand">Bordbuch</Link></div>
          <div className="divide-y divide-line text-sm">
            {mine.map((e) => <div key={e.id} className="flex justify-between py-2"><span className="text-muted">{e.date}</span><span>{e.minutes} min · {e.landings} Landungen</span></div>)}
            {mine.length === 0 && <p className="py-2 text-muted">Noch keine Einträge.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-2 font-semibold">Mein Betriebskonto</div>
          <div className={clsx('text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</div>
          <Link to="/mein-konto" className="mt-2 inline-block text-sm text-brand">Buchungen ansehen</Link>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <MemberDocuments memberId={m.id} title="Meine Dokumente" />
        </Card>
      </div>
    </>
  )
}
