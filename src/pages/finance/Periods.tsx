import clsx from 'clsx'
import { ArrowLeft, Check, Circle, Download, Lock, Printer } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AUSLAGE_ID, eur, members, type BankLine, type MoneyAccount } from '../../data'
import { useSession } from '../../session/session'
import { ActionPanel, Badge, Banner, Button, Card, Drawer, field, Segmented, useConfirm, usePaging } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { dmy } from '../manifest/data'
import { useActor } from '../tickets/parts'
import { monthOf, type Ledger } from './ledger'
import { monthLabel } from './parts'
import { balanceAt, computeClosing, monthEnd, useExtras, type Recon } from './results'
import { ownCsv } from './Exceptions'
import { isTodo, lineStatus, needsProof, ownStateOf, PROOF, proofOf, receiptsOf } from './status'

type View = '' | 'monat' | 'jahr' | 'pruefung' | 'export'
const thisYear = Number(TODAY_ISO.slice(0, 4))
const thisMonth = monthOf(TODAY_ISO)
const monthsOf = (year: string) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
/** Money accounts of the club that are checked at a closing (Auslagen are on no account). */
const moneyAccounts = (ledger: Ledger) => ledger.accounts.filter((a) => a.id !== AUSLAGE_ID && !a.archived)
const sum = (ls: BankLine[], sign: 1 | -1) => ls.filter((l) => l.amount * sign > 0).reduce((n, l) => n + l.amount, 0)

/** One item of the closing checklist of a month: how many are still open and where they are. */
interface Check { id: string; label: string; open: number; go?: () => void; goLabel?: string }

/** Everything a month needs before its release, as a checklist. Each item links to the exact list behind it. */
function useChecks(ledger: Ledger) {
  const { flights } = useApp()
  const { reconOf } = useExtras()
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  return (m: string): Check[] => {
    const lines = ledger.lines.filter((l) => monthOf(l.date) === m)
    const st = lines.map((l) => lineStatus(l, ledger))
    const end = monthEnd(m)
    const expenses = ledger.expenses.filter((x) => x.status === 'offen' && (ledger.receipts.find((r) => r.id === x.receiptId)?.date ?? x.submitted) <= end)
    const toCharge = flights.filter((f) => f.state === 'offen' && `${thisYear}-${f.date.slice(3, 5)}` === m)
    const unchecked = moneyAccounts(ledger).filter((a) => !reconOf(m, a.id))
    const bookings = () => setParams({ tab: 'bank', monat: m, offen: '1' })
    return [
      { id: 'ende', label: m < thisMonth ? 'Monat ist zu Ende' : 'Monat läuft noch', open: m < thisMonth ? 0 : 1 },
      { id: 'zuordnen', label: 'Alle Buchungen zugeordnet', open: st.filter((s) => s === 'offen').length, go: bookings, goLabel: 'Zu den Buchungen' },
      { id: 'beleg', label: 'Jede Buchung mit Rechnung oder Eigenbeleg', open: st.filter((s) => s === 'beleg' || s === 'abweichung' || s === 'ausnahme').length, go: bookings, goLabel: 'Zu den Buchungen' },
      ...(lines.some((l) => ledger.exempt[l.id]?.own) ? [{ id: 'unterschrift', label: 'Eigenbelege mit zwei Unterschriften', open: st.filter((s) => s === 'unterschrift').length, go: () => setParams({ tab: 'rechnungen', status: 'ausnahmen' }), goLabel: 'Zum Gegenzeichnen' }] : []),
      { id: 'auslagen', label: 'Auslagen entschieden', open: expenses.length, go: () => setParams({ tab: 'auslagen', ansicht: 'pruefung' }), goLabel: 'Zu den Auslagen' },
      { id: 'fluege', label: 'Flüge verrechnet', open: toCharge.length, go: () => navigate('/bordbuch?nur=verrechnen'), goLabel: 'Zum Bordbuch' },
      { id: 'konten', label: 'Kontenabgleich (Soll und Ist je Konto)', open: unchecked.length },
    ]
  }
}

/**
 * Closing of the periods. A month is released with a checklist (bookings assigned, invoice or exception, Auslagen decided, flights charged,
 * every money account checked against statement or count); the year closing (Einnahmen-Ausgaben-Rechnung, Vermögensübersicht), the view of
 * the Rechnungsprüfer and the export for the tax adviser hang off the same tab. The view lives in the address, so the back key works.
 */
export default function Periods({ ledger }: { ledger: Ledger; onShow?: (month: string) => void }) {
  const [params, setParams] = useSearchParams()
  const first = Math.min(thisYear, ...ledger.lines.map((l) => Number(l.date.slice(0, 4))))
  const years = Array.from({ length: thisYear - first + 1 }, (_, i) => String(thisYear - i))
  const year = params.get('jahr') ?? String(thisYear)
  const view = (params.get('ansicht') ?? '') as View
  const go = (p: { ansicht?: View; jahr?: string; monat?: string }, replace = false) =>
    setParams({ tab: 'zeitraeume', jahr: p.jahr ?? year, ...(p.ansicht ? { ansicht: p.ansicht } : {}), ...(p.monat ? { monat: p.monat } : {}) }, { replace })
  const back = () => go({})
  const yearPick = <Segmented value={year} onChange={(y) => go({ ansicht: view, jahr: y }, true)} options={years.map((y) => ({ value: y, label: y }))} />

  if (view === 'jahr') return <YearClosing ledger={ledger} year={year} picker={yearPick} onBack={back} onMonth={(m) => go({ ansicht: 'monat', monat: m })} />
  if (view === 'pruefung') return <Audit ledger={ledger} year={year} picker={yearPick} onBack={back} />
  if (view === 'export') return <Export ledger={ledger} year={year} onBack={back} />
  return <MonthList ledger={ledger} year={year} picker={yearPick} month={view === 'monat' ? params.get('monat') : null} go={go} />
}

function MonthList({ ledger, year, picker, month, go }: { ledger: Ledger; year: string; picker: ReactNode; month: string | null; go: (p: { ansicht?: View; monat?: string }) => void }) {
  const checks = useChecks(ledger)
  const months = monthsOf(year).filter((m) => m <= thisMonth).reverse()
  const stat = (m: string) => {
    const lines = ledger.lines.filter((l) => monthOf(l.date) === m)
    return { count: lines.length, income: sum(lines, 1), cost: sum(lines, -1) }
  }
  const open = months.filter((m) => !ledger.released[m] && stat(m).count > 0).length
  const COLS = 'md:grid-cols-[minmax(0,1.2fr)_5rem_7rem_7rem_minmax(0,1.3fr)_minmax(0,1.5fr)]'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">{picker}<span className="text-sm text-muted">{open > 0 ? `${open} Monate offen` : 'Alle Monate freigegeben'}</span></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => go({ ansicht: 'jahr' })}>Jahresabschluss {year}</Button>
          <Button onClick={() => go({ ansicht: 'pruefung' })}>Prüfung {year}</Button>
          <Button onClick={() => go({ ansicht: 'export' })}><Download size={16} /> Export Steuerberater</Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className={clsx('hidden gap-x-3 border-b border-line bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid', COLS)}>
          <span>Monat</span><span className="text-right">Buchungen</span><span className="text-right">Einnahmen</span><span className="text-right">Ausgaben</span><span>Abschluss</span><span>Freigabe</span>
        </div>
        <div className="divide-y divide-line">
          {months.map((m) => {
            const s = stat(m)
            const rel = ledger.released[m]
            const cs = checks(m)
            const todo = cs.filter((c) => c.open > 0)
            const running = m >= thisMonth
            return (
              <div key={m} onClick={() => go({ ansicht: 'monat', monat: m })} className={clsx('grid cursor-pointer items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50', COLS, rel && 'bg-slate-50/70')}>
                <div className="flex items-center gap-2 font-medium">{rel && <Lock size={14} className="text-muted" />}{monthLabel(m)}</div>
                <div className="text-sm tabular-nums md:text-right">{s.count}</div>
                <div className="text-sm tabular-nums text-ok md:text-right">{eur(s.income)}</div>
                <div className="text-sm tabular-nums text-bad md:text-right">{eur(s.cost)}</div>
                <div>
                  {rel ? <span className="text-xs text-muted">abgeschlossen</span>
                    : running ? <span className="text-xs text-muted">läuft noch</span>
                    : todo.length === 0 ? <Badge tone="ok">bereit</Badge>
                    : <Badge tone="warn">{cs.length - todo.length} von {cs.length} erledigt</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {rel ? <span className="text-xs text-muted">Freigegeben von {rel.by} am {dmy(rel.at)}</span>
                    : s.count === 0 ? <span className="text-xs text-muted">keine Buchungen</span>
                    : <Button variant={todo.length === 0 ? 'primary' : 'secondary'} disabled={running}>{todo.length === 0 ? 'Freigeben' : 'Abschluss prüfen'}</Button>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      {month && <MonthClose key={month} month={month} ledger={ledger} onClose={() => go({})} />}
    </div>
  )
}

/** The closing of one month: the checklist, the balance check of every money account, the exceptions, then the release (or lifting it). */
function MonthClose({ month, ledger, onClose }: { month: string; ledger: Ledger; onClose: () => void }) {
  const { can } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const x = useExtras()
  const checks = useChecks(ledger)(month)
  const [sure, setSure] = useState(false)
  const [lift, setLift] = useState(false)
  const may = can('billing.periods.release')
  const rel = ledger.released[month]
  const lines = ledger.lines.filter((l) => monthOf(l.date) === month)
  const invoices = ledger.receipts.filter((r) => lines.some((l) => l.id === r.lineId)).length
  // Booked but not covered exactly (no or too few documents, a reminder, a missing second signature), the same test as the list.
  const exceptions = lines.filter((l) => ledger.done[l.id] && ['beleg', 'abweichung', 'ausnahme', 'unterschrift'].includes(lineStatus(l, ledger)))
  const ownCovered = lines.filter((l) => proofOf(l, ledger) === 'eigenbeleg').length
  const ready = checks.every((c) => c.open === 0)
  const release = () => { guarded('billing.periods.release', () => ledger.release(month, actor)); onClose() }
  const reopen = () => { guarded('billing.periods.release', () => { ledger.reopen(month, actor); x.dropRecons(month) }); onClose() }

  const footer = rel
    ? (may && !lift ? <div className="flex justify-end"><Button variant="danger" onClick={() => setLift(true)}>Freigabe aufheben</Button></div> : undefined)
    : (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={clsx('flex items-center gap-2 text-sm', !ready && 'opacity-40')}><input type="checkbox" disabled={!ready} checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich habe {monthLabel(month)} geprüft.</label>
        <div className="flex gap-2"><Button onClick={onClose}>Schließen</Button><Button variant="primary" disabled={!may || !ready || !sure} onClick={release}>Freigeben und sperren</Button></div>
      </div>
    )

  return (
    <Drawer open size="xl" title={`Abschluss ${monthLabel(month)}`} onClose={onClose} footer={footer}>
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Tile value={String(lines.length)} label="Buchungen" />
          <Tile value={String(invoices)} label="Rechnungen" />
          <Tile value={eur(sum(lines, 1) + sum(lines, -1))} label="Saldo" />
        </div>
        {rel && <Banner>Freigegeben von {rel.by} am {dmy(rel.at)}. Die Buchungen und Rechnungen sind gesperrt.</Banner>}
        {lift && (
          <ActionPanel danger title="Freigabe aufheben" confirm="Freigabe aufheben" onCancel={() => setLift(false)} onConfirm={reopen}>
            <p>Die Buchungen von {monthLabel(month)} sind danach wieder änderbar, der Kontenabgleich ist neu zu machen. Wer die Freigabe aufhebt, steht bei jeder Buchung.</p>
          </ActionPanel>
        )}

        <section>
          <h3 className="mb-2 font-semibold">Checkliste</h3>
          <div className="divide-y divide-line rounded-xl border border-line">
            {checks.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                {c.open === 0 ? <Check size={16} className="shrink-0 text-ok" /> : <Circle size={16} className="shrink-0 text-warn" />}
                <span className={clsx('flex-1', c.open === 0 && 'text-muted')}>{c.label}</span>
                {c.open > 0 && c.id !== 'ende' && <Badge tone="warn">{c.open} offen</Badge>}
                {c.open > 0 && c.go && <button onClick={c.go} className="text-brand hover:underline">{c.goLabel}</button>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-semibold">Kontenabgleich zum {dmy(monthEnd(month))}</h3>
          <div className="space-y-2">{moneyAccounts(ledger).map((a) => <ReconRow key={a.id} account={a} month={month} ledger={ledger} locked={!!rel} />)}</div>
        </section>

        <section>
          <h3 className="mb-2 font-semibold">Ohne Beleg ({exceptions.length}){ownCovered > 0 && <span className="ml-2 text-xs font-normal text-muted">{ownCovered} durch Eigenbeleg gedeckt</span>}</h3>
          {exceptions.length === 0 ? <p className="text-muted">Jede Buchung hat eine Rechnung oder einen Eigenbeleg.</p> : (
            <div className="divide-y divide-line rounded-xl border border-line">
              {exceptions.map((l) => { const e = ledger.exempt[l.id]; return (
                <div key={l.id} className="grid grid-cols-[4rem_minmax(0,1fr)_6rem] gap-x-3 px-3 py-2">
                  <span className="tabular-nums text-muted">{dmy(l.date).slice(0, 6)}</span>
                  <span className="min-w-0"><span className="block truncate">{l.bookingText ?? l.text}</span><span className="text-xs text-muted">{PROOF[proofOf(l, ledger)]}{e && <> · {e.reason} · {e.by}, {e.at}</>}{e?.own && <> · {e.own.no}</>}</span></span>
                  <span className="text-right tabular-nums">{eur(l.amount)}</span>
                </div>
              ) })}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  )
}

const Tile = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-semibold tabular-nums">{value}</div><div className="text-xs text-muted">{label}</div></div>
)

const NOTES = [500, 200, 100, 50, 20, 10, 5]
const COINS = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]
const KIND = { bank: 'Kontoauszug', bar: 'gezählt', spar: 'laut Sparbuch' } as const

/**
 * Soll (the books at month end) against Ist (statement, count, savings book). A difference is never confirmed away: it becomes a booking on
 * that account (which then needs its invoice or an exception) and the check is done again.
 */
function ReconRow({ account: a, month, ledger, locked }: { account: MoneyAccount; month: string; ledger: Ledger; locked: boolean }) {
  const { can } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const x = useExtras()
  const cf = useConfirm()
  const done = x.reconOf(month, a.id)
  const soll = balanceAt(ledger, a.id, monthEnd(month))
  // The statement of a synced bank account brings its closing balance; cash and savings books are entered.
  const [ist, setIst] = useState(a.kind === 'bank' ? soll.toFixed(2).replace('.', ',') : '')
  const [count, setCount] = useState<Record<string, number> | null>(null)
  const value = count ? Object.entries(count).reduce((n, [k, v]) => n + Number(k) * v, 0) : Number(ist.replace(/\./g, '').replace(',', '.'))
  const has = count ? Object.values(count).some((v) => v > 0) : ist.trim() !== '' && !Number.isNaN(value)
  const diff = Math.round((value - soll) * 100) / 100
  const may = can('billing.periods.release')
  const confirm = () => guarded('billing.periods.release', () => x.addRecon({ month, accountId: a.id, diff: 0, by: actor, at: TODAY_ISO, counted: count ?? undefined }))
  const book = () => guarded('billing.bank.manage', () => ledger.addLine({ accountId: a.id, date: monthEnd(month), text: a.kind === 'bar' ? `Kassendifferenz ${monthLabel(month)}` : `Abweichung ${KIND[a.kind]} ${monthLabel(month)}`, amount: diff }))

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1"><div className="font-medium">{a.name}</div><div className="text-xs text-muted">Soll {eur(soll)}</div></div>
        {done ? (
          <span className="flex items-center gap-2 text-xs text-muted"><Check size={14} className="text-ok" />Ist {eur(soll + done.diff)} · abgeglichen von {done.by} am {dmy(done.at)}</span>
        ) : locked ? <span className="text-xs text-muted">bei der Freigabe abgeglichen</span> : (
          <>
            <label className="flex flex-col items-end text-xs text-muted">Ist {KIND[a.kind]}
              {count ? <span className="w-28 text-right text-sm font-medium tabular-nums text-ink">{eur(value)}</span>
                : <input value={ist} onChange={(e) => setIst(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${field} w-28 text-right`} />}
            </label>
            {a.kind === 'bar' && <button onClick={() => setCount(count ? null : {})} className="text-xs text-brand hover:underline">{count ? 'Betrag' : 'Zählen'}</button>}
            <span className={clsx('w-20 text-right text-xs tabular-nums', !has ? 'text-muted' : diff === 0 ? 'text-ok' : 'font-medium text-bad')}>{has ? (diff === 0 ? 'stimmt' : eur(diff)) : ''}</span>
            {has && diff !== 0 ? <Button disabled={!may} onClick={() => cf.ask({ title: 'Differenz buchen?', lines: [`${a.name}: Soll ${eur(soll)}, Ist ${eur(value)}`, `Eine Buchung über ${eur(diff)} zum ${dmy(monthEnd(month))} wird angelegt.`], confirm: `${eur(diff)} buchen`, run: book })}>Differenz buchen</Button> : <Button variant="primary" disabled={!may || !has} onClick={confirm}>Bestätigen</Button>}
          </>
        )}
      </div>
      {count && !done && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 sm:grid-cols-5">
          {[...NOTES, ...COINS].map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-12 text-right tabular-nums">{d >= 1 ? `${d} €` : `${Math.round(d * 100)} ct`}</span>
              <input value={count[d] || ''} onChange={(e) => setCount({ ...count, [d]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} inputMode="numeric" aria-label={`Anzahl ${d} €`} className={`${field} h-8 w-14 text-right`} />
            </label>
          ))}
        </div>
      )}
      {cf.dialog}
    </div>
  )
}

function SubHeader({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"><ArrowLeft size={15} />Zurück zu Zeiträume</button>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{title}</h2><div className="flex flex-wrap items-center gap-2">{children}</div></div>
    </div>
  )
}

const download = (name: string, rows: (string | number)[][]) => {
  const csv = rows.map((r) => r.map((c) => (typeof c === 'number' ? c.toFixed(2).replace('.', ',') : /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
}

/** Einnahmen-Ausgaben-Rechnung and Vermögensübersicht of a year (§ 21 VerG), printable and as CSV. */
function YearClosing({ ledger, year, picker, onBack, onMonth }: { ledger: Ledger; year: string; picker: ReactNode; onBack: () => void; onMonth: (m: string) => void }) {
  const { audits } = useExtras()
  const c = computeClosing(ledger, year)
  const months = monthsOf(year)
  const released = months.filter((m) => ledger.released[m]).length
  const firstOpen = months.find((m) => !ledger.released[m] && m < thisMonth)
  const signed = audits.filter((a) => a.year === year)
  const start = c.accounts.reduce((n, a) => n + a.start, 0)
  const end = c.accounts.reduce((n, a) => n + a.end, 0)
  const surplus = c.totalIn - c.totalOut
  const running = Number(year) === thisYear
  const owed = members.filter((m) => (ledger.balances[m.id] ?? 0) < 0).reduce((n, m) => n + ledger.balances[m.id], 0)
  const credit = members.filter((m) => (ledger.balances[m.id] ?? 0) > 0).reduce((n, m) => n + ledger.balances[m.id], 0)
  const unpaid = ledger.receipts.filter((r) => !r.lineId && !r.outgoing && !ledger.expenseOf(r.id)).reduce((n, r) => n + r.amount, 0)
  const csv = () => download(`Einnahmen-Ausgaben-${year}.csv`, [
    ['Einnahmen-Ausgaben-Rechnung', year], [], ['Einnahmen', ''], ...c.income.map((r) => [r.name, r.amount]), ['Summe Einnahmen', c.totalIn], [],
    ['Ausgaben', ''], ...c.cost.map((r) => [r.name, r.amount]), ['Summe Ausgaben', c.totalOut], [], [surplus >= 0 ? 'Überschuss' : 'Fehlbetrag', surplus], [],
    ['Vermögensübersicht', '1.1.', '31.12.'], ...c.accounts.map((a) => [a.account.name, a.start, a.end]), ['Geldbestand', start, end],
  ])

  return (
    <div className="space-y-4">
      <SubHeader title={`Jahresabschluss ${year}`} onBack={onBack}>
        {picker}
        <Button onClick={() => window.print()}><Printer size={16} /> Drucken</Button>
        <Button onClick={csv}><Download size={16} /> CSV</Button>
      </SubHeader>
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone={released === 12 ? 'ok' : 'warn'}>{released} von 12 Monaten freigegeben</Badge>
        <Badge tone={signed.length >= 2 ? 'ok' : 'neutral'}>{signed.length === 0 ? 'nicht geprüft' : `geprüft von ${signed.map((a) => a.by).join(', ')}`}</Badge>
        <Badge>Frist 31.05.{Number(year) + 1}</Badge>
      </div>
      {(c.openCount > 0 || firstOpen) && (
        <Banner tone="warn">
          {c.openCount > 0 && <>{c.openCount} Buchungen noch nicht zugeordnet. </>}
          {firstOpen && <button onClick={() => onMonth(firstOpen)} className="font-medium underline">{monthLabel(firstOpen)} abschließen</button>}
        </Banner>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-2 font-semibold">Einnahmen-Ausgaben-Rechnung</div>
          <table className="w-full text-sm tabular-nums">
            <tbody>
              <Group title="Einnahmen" rows={c.income} total={c.totalIn} />
              <Group title="Ausgaben" rows={c.cost} total={c.totalOut} />
              <tr className="border-t-2 border-line font-semibold"><td className="px-4 py-2">{surplus >= 0 ? 'Überschuss' : 'Fehlbetrag'}</td><td className={clsx('px-4 py-2 text-right', surplus >= 0 ? 'text-ok' : 'text-bad')}>{eur(surplus)}</td></tr>
              {c.auslagen > 0 && <tr className="text-xs text-muted"><td className="px-4 pb-2">Auslagen, über Betriebskonten gutgeschrieben</td><td className="px-4 pb-2 text-right">{eur(c.auslagen)}</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-2 font-semibold">Vermögensübersicht</div>
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2 text-left font-medium">Geldkonto</th><th className="px-3 py-2 text-right font-medium">1.1.</th><th className="px-4 py-2 text-right font-medium">{running ? 'heute' : '31.12.'}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {c.accounts.map((a) => <tr key={a.account.id}><td className="px-4 py-2">{a.account.name}</td><td className="px-3 py-2 text-right">{eur(a.start)}</td><td className="px-4 py-2 text-right">{eur(a.end)}</td></tr>)}
              <tr className="font-semibold"><td className="px-4 py-2">Geldbestand</td><td className="px-3 py-2 text-right">{eur(start)}</td><td className="px-4 py-2 text-right">{eur(end)}</td></tr>
              <tr className="text-xs text-muted"><td className="px-4 py-2" colSpan={2}>Geldbestand 1.1. + Überschuss</td><td className="px-4 py-2 text-right">{eur(start + surplus)} {Math.abs(start + surplus - end) < 0.01 ? <Check size={12} className="inline text-ok" /> : <span className="text-bad">weicht ab</span>}</td></tr>
            </tbody>
          </table>
          {running && (
            <table className="w-full border-t border-line text-sm tabular-nums">
              <tbody className="divide-y divide-line">
                <tr className="bg-slate-50/60 text-xs uppercase tracking-wide text-muted"><td className="px-4 py-1" colSpan={2}>Forderungen und Verbindlichkeiten, Stand heute</td></tr>
                <tr><td className="px-4 py-2">Betriebskonten im Minus (Forderungen)</td><td className="px-4 py-2 text-right">{eur(-owed)}</td></tr>
                <tr><td className="px-4 py-2">Guthaben auf Betriebskonten (Verbindlichkeiten)</td><td className="px-4 py-2 text-right">{eur(credit)}</td></tr>
                <tr><td className="px-4 py-2">Rechnungen ohne Abbuchung (Verbindlichkeiten)</td><td className="px-4 py-2 text-right">{eur(unpaid)}</td></tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

function Group({ title, rows, total }: { title: string; rows: { name: string; amount: number }[]; total: number }) {
  return (
    <>
      <tr className="bg-slate-50/60"><td colSpan={2} className="px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</td></tr>
      {rows.map((r) => <tr key={r.name}><td className="px-4 py-1.5">{r.name}</td><td className="px-4 py-1.5 text-right">{eur(r.amount)}</td></tr>)}
      {rows.length === 0 && <tr><td colSpan={2} className="px-4 py-1.5 text-muted">Keine.</td></tr>}
      <tr className="font-medium"><td className="px-4 py-1.5">Summe {title}</td><td className="px-4 py-1.5 text-right">{eur(total)}</td></tr>
    </>
  )
}

/**
 * What the Rechnungsprüfer looks at, read-only: every booking without an invoice (reason, person, day), every change after booking, the
 * releases with their balance checks. The sign-off ("geprüft") needs its own right, which the board does not hold by default.
 */
function Audit({ ledger, year, picker, onBack }: { ledger: Ledger; year: string; picker: ReactNode; onBack: () => void }) {
  const { can } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const x = useExtras()
  const [part, setPart] = useState<'ausnahmen' | 'eigenbelege' | 'aenderungen' | 'freigaben'>('ausnahmen')
  const [signing, setSigning] = useState(false)
  const [note, setNote] = useState('')
  const [sure, setSure] = useState(false)
  const lines = ledger.lines.filter((l) => l.date.startsWith(year))
  const name = (id: string) => ledger.lines.find((l) => l.id === id)
  const newest = (a: BankLine, b: BankLine) => b.date.localeCompare(a.date)
  const missing = lines.filter((l) => ledger.done[l.id] && ['beleg', 'abweichung', 'ausnahme', 'unterschrift'].includes(lineStatus(l, ledger))).sort(newest).map((l) => ({ l, e: ledger.exempt[l.id] }))
  const owned = lines.filter((l) => proofOf(l, ledger) === 'eigenbeleg').sort(newest)
  const changes = Object.entries(ledger.log).flatMap(([id, es]) => { const l = name(id); return l && l.date.startsWith(year) ? es.map((e) => ({ l, e })) : [] }).sort((a, b) => b.e.at.localeCompare(a.e.at))
  const months = monthsOf(year).filter((m) => m <= thisMonth)
  const signed = x.audits.filter((a) => a.year === year)
  const complete = monthsOf(year).every((m) => ledger.released[m])
  const mine = signed.some((a) => a.by === actor)
  const pageA = usePaging(missing, year)
  const pageB = usePaging(changes, year)
  const pageC = usePaging(owned, year)
  const sign = () => { guarded('billing.periods.audit', () => x.addAudit({ year, by: actor, at: TODAY_ISO, note: note.trim() || undefined })); setSigning(false) }

  return (
    <div className="space-y-4">
      <SubHeader title={`Prüfung ${year}`} onBack={onBack}>
        {picker}
        <Button onClick={() => window.print()}><Printer size={16} /> Prüfbericht drucken</Button>
        {can('billing.periods.audit') && !mine && <Button variant="primary" disabled={!complete} onClick={() => setSigning(true)}>Als geprüft bestätigen</Button>}
      </SubHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile value={`${monthsOf(year).filter((m) => ledger.released[m]).length} / 12`} label="Monate freigegeben" />
        <Tile value={String(missing.length)} label="Buchungen ohne Beleg" />
        <Tile value={String(changes.length)} label="Änderungen nach dem Buchen" />
      </div>
      {signed.length > 0 && (
        <Card className="divide-y divide-line">
          {signed.map((a) => <div key={a.by} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"><Check size={15} className="text-ok" /><span className="font-medium">Geprüft von {a.by}</span><span className="text-muted">am {dmy(a.at)}</span>{a.note && <span className="text-muted">· {a.note}</span>}</div>)}
        </Card>
      )}
      {signing && (
        <ActionPanel title={`${year} als geprüft bestätigen`} confirm="Bestätigen" disabled={!sure} onCancel={() => setSigning(false)} onConfirm={sign}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Bemerkung (Stichproben, Beanstandungen)" className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich habe die Bücher {year} geprüft.</label>
        </ActionPanel>
      )}
      <Segmented value={part} onChange={setPart} options={[{ value: 'ausnahmen', label: `Ohne Beleg (${missing.length})` }, { value: 'eigenbelege', label: `Durch Eigenbeleg gedeckt (${owned.length})` }, { value: 'aenderungen', label: `Änderungen (${changes.length})` }, { value: 'freigaben', label: 'Freigaben und Kontenabgleich' }]} />
      {part === 'ausnahmen' && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line text-sm">
            {pageA.rows.map(({ l, e }) => (
              <div key={l.id} className="grid gap-x-3 px-4 py-2 md:grid-cols-[5.5rem_minmax(0,1.5fr)_8rem_minmax(0,1.5fr)_7rem]">
                <span className="tabular-nums text-muted">{dmy(l.date)}</span>
                <span className="truncate">{l.bookingText ?? l.text}</span>
                <span className="text-muted">{ledger.accountName(l.accountId)}</span>
                <span>{e && <>{e.reason} <span className="text-xs text-muted">· {e.by}, {e.at}</span> </>}<Badge tone="warn">{e?.own ? `${e.own.no}: ${PROOF.unterschrift}` : PROOF[proofOf(l, ledger)]}</Badge></span>
                <span className="text-right tabular-nums">{eur(l.amount)}</span>
              </div>
            ))}
            {missing.length === 0 && <p className="p-6 text-center text-muted">Jede Buchung {year} hat eine Rechnung.</p>}
          </div>
          {missing.length > 0 && pageA.bar}
        </Card>
      )}
      {part === 'eigenbelege' && (
        <Card className="overflow-hidden">
          {owned.length > 0 && <div className="flex justify-end border-b border-line px-4 py-2"><Button onClick={() => ownCsv(ledger, owned, `eigenbelege-${year}.csv`)}><Download size={16} /> CSV exportieren</Button></div>}
          <div className="divide-y divide-line text-sm">
            {pageC.rows.map((l) => { const e = ledger.exempt[l.id]; return (
              <div key={l.id} className="grid gap-x-3 px-4 py-2 md:grid-cols-[5.5rem_minmax(0,1.5fr)_7rem_minmax(0,1.8fr)_7rem]">
                <span className="tabular-nums text-muted">{dmy(l.date)}</span>
                <span className="truncate">{l.bookingText ?? l.text}</span>
                <span className="font-medium">{e.own?.no}</span>
                <span>{e.reason} <span className="text-xs text-muted">· 1. Unterschrift {e.own?.first?.by ?? e.by}, {e.own?.first?.at ?? e.at}{e.own?.second && <> · 2. Unterschrift {e.own.second.by}, {e.own.second.at}</>}</span></span>
                <span className="text-right tabular-nums">{eur(l.amount)}</span>
              </div>
            ) })}
            {owned.length === 0 && <p className="p-6 text-center text-muted">Kein Eigenbeleg {year}.</p>}
          </div>
          {owned.length > 0 && pageC.bar}
        </Card>
      )}
      {part === 'aenderungen' && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line text-sm">
            {pageB.rows.map(({ l, e }, i) => (
              <div key={`${l.id}-${i}`} className="grid gap-x-3 px-4 py-2 md:grid-cols-[5.5rem_minmax(0,1.2fr)_minmax(0,2fr)_9rem]">
                <span className="tabular-nums text-muted">{dmy(e.at)}</span>
                <span className="truncate">{dmy(l.date).slice(0, 6)} {l.bookingText ?? l.text}</span>
                <span>{e.text}</span>
                <span className="text-muted">{e.by}</span>
              </div>
            ))}
            {changes.length === 0 && <p className="p-6 text-center text-muted">Keine Änderungen nach dem Buchen.</p>}
          </div>
          {changes.length > 0 && pageB.bar}
        </Card>
      )}
      {part === 'freigaben' && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line text-sm">
            {[...months].reverse().map((m) => {
              const rel = ledger.released[m]
              const rs = moneyAccounts(ledger).map((a) => ({ a, r: x.reconOf(m, a.id) }))
              const diffs = rs.filter(({ r }) => r && r.diff !== 0)
              return (
                <div key={m} className="grid gap-x-3 px-4 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]">
                  <span className="font-medium">{monthLabel(m)}</span>
                  <span className={rel ? '' : 'text-muted'}>{rel ? `freigegeben von ${rel.by} am ${dmy(rel.at)}` : 'offen'}</span>
                  <span className="text-muted">{rs.every(({ r }) => r) ? (diffs.length ? `${diffs.length} Differenzen gebucht` : 'alle Konten abgeglichen') : rel ? 'bei der Freigabe abgeglichen' : `${rs.filter(({ r }) => !r).length} Konten offen`}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

/** The export for the tax adviser: a range of months, as CSV or in a DATEV-like layout, with the invoices and the lists of the closing. */
function Export({ ledger, year, onBack }: { ledger: Ledger; year: string; onBack: () => void }) {
  const opts = Array.from(new Set(ledger.lines.map((l) => monthOf(l.date)))).sort().reverse()
  const [from, setFrom] = useState(`${year}-01`)
  const [to, setTo] = useState(Number(year) === thisYear ? opts.find((m) => ledger.released[m]) ?? thisMonth : `${year}-12`)
  const [format, setFormat] = useState<'csv' | 'datev'>('csv')
  const [parts, setParts] = useState({ belege: true, ausnahmen: true, abgleich: true, ear: true })
  const [made, setMade] = useState<string | null>(null)
  const x = useExtras()
  const lines = ledger.lines.filter((l) => monthOf(l.date) >= from && monthOf(l.date) <= to).sort((a, b) => a.date.localeCompare(b.date))
  const receipts = ledger.receipts.filter((r) => r.lineId && lines.some((l) => l.id === r.lineId))
  const months = opts.filter((m) => m >= from && m <= to)
  const unreleased = months.filter((m) => !ledger.released[m])
  const exceptions = lines.filter((l) => needsProof(l, ledger) && ledger.exempt[l.id]?.own && receiptsOf(l, ledger).length === 0)
  const recons = x.recons.filter((r) => months.includes(r.month))
  const base = `Buchungen_${from}_${to}`
  const cc = (l: BankLine) => ledger.codingOfLine(l).map((c) => `${ledger.costCenters.find((x) => x.id === c.costCenterId)?.name} / ${ledger.categories.find((x) => x.id === c.categoryId)?.name}`).join(', ')
  const no = (l: BankLine) => receiptsOf(l, ledger).map((r) => r.number ?? r.name).join(', ')
  const csv = () => download(`${base}${format === 'datev' ? '_DATEV' : ''}.csv`, format === 'datev'
    ? [['Umsatz', 'Soll/Haben', 'Konto', 'Gegenkonto (Kostenstelle)', 'Belegdatum', 'Belegfeld 1', 'Buchungstext'], ...lines.map((l) => [Math.abs(l.amount), l.amount < 0 ? 'H' : 'S', ledger.accountName(l.accountId), cc(l), dmy(l.date), no(l), l.bookingText ?? l.text])]
    : [['Datum', 'Konto', 'Buchung', 'Betrag', 'Kostenstelle / Kostenart', 'Rechnung', 'Eigenbeleg', 'Status'], ...lines.map((l) => [dmy(l.date), ledger.accountName(l.accountId), l.bookingText ?? l.text, l.amount, cc(l), no(l), ledger.exempt[l.id]?.own?.no ?? '', ledger.isLocked(l.date) ? 'freigegeben' : 'offen'])])
  const files = [`${base}${format === 'datev' ? '_DATEV' : ''}.csv`, ...(parts.belege ? [`Belege/ (${receipts.length} PDF)`] : []), ...(parts.ausnahmen ? [`Eigenbelege.csv (${exceptions.length})`] : []), ...(parts.abgleich ? [`Kontenabgleich.csv (${recons.length})`] : []), ...(parts.ear ? ['Einnahmen-Ausgaben.pdf'] : [])]

  return (
    <div className="max-w-3xl space-y-4">
      <SubHeader title="Export für den Steuerberater" onBack={onBack} />
      <Card className="space-y-4 p-4 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block font-medium">Von<select value={from} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1 block w-44`}>{opts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
          <label className="block font-medium">Bis<select value={to} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 block w-44`}>{opts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
          <Segmented value={format} onChange={setFormat} options={[{ value: 'csv', label: 'CSV' }, { value: 'datev', label: 'DATEV-Format' }]} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([['belege', `Rechnungen als PDF (${receipts.length})`], ['ausnahmen', `Eigenbelege (${exceptions.length})`], ['abgleich', 'Kontenabgleich'], ['ear', 'Einnahmen-Ausgaben-Rechnung']] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={parts[k]} onChange={(e) => setParts({ ...parts, [k]: e.target.checked })} />{label}</label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-muted">{lines.length} Buchungen, {months.length} Monate</span>
          {unreleased.length > 0 && <Badge tone="warn">{unreleased.length} Monate nicht freigegeben, vorläufig</Badge>}
          <div className="ml-auto flex gap-2">
            <Button onClick={csv}>Nur Buchungen (CSV)</Button>
            <Button variant="primary" disabled={from > to || lines.length === 0} onClick={() => setMade(`Steuerberater_${from}_${to}.zip`)}><Download size={16} /> ZIP erstellen</Button>
          </div>
        </div>
      </Card>
      {made && (
        <Card className="p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium"><Check size={16} className="text-ok" />{made}</div>
          <ul className="space-y-0.5 pl-6 text-muted">{files.map((f) => <li key={f}>{f}</li>)}</ul>
        </Card>
      )}
    </div>
  )
}
