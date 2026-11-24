import clsx from 'clsx'
import { Download, FilePlus2, Lock } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AUSLAGE_ID, eur, members, type BankLine, type Receipt } from '../../data'
import { Badge, Button, Card, Segmented, usePaging } from '../../ui'
import { TODAY_ISO } from '../../state'
import { dmy } from '../manifest/data'
import { type Captured } from './capture'
import { useDetail } from './Details'
import Exceptions, { uncovered } from './Exceptions'
import { amountOk, codingOk, FilterBar, inRange, NO_FILTERS, textOk, type Filters } from './filters'
import Inbox from './InvoiceInbox'
import { useInbox } from './inbox'
import { type Coding, type Ledger } from './ledger'
import { fuelStats, openReceiptFile, perLiter } from './parts'
import { ReceiptForm } from './ReceiptDialogs'
import Suppliers from './Suppliers'
import { missingPeriods, periodLabel, useSuppliers } from './supplierStore'

/** `ohne`: no booking yet (Abbuchung offen). `eingang`: files that still need their data checked. `ausnahmen`: bookings without an invoice. */
type Status = 'alle' | 'eingang' | 'ohne' | 'ausnahmen'
type View = 'liste' | 'auswertung' | 'lieferanten'
const COLS = 'md:grid-cols-[5.5rem_minmax(0,1.6fr)_minmax(0,1.4fr)_6.5rem_minmax(0,1.5fr)_2.5rem]'
const THREE_YEARS_AGO = `${Number(TODAY_ISO.slice(0, 4)) - 3}${TODAY_ISO.slice(4)}`
export const csv = (name: string, head: string, rows: (string | number | undefined)[][]) => {
  const q = (s: string | number | undefined) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([`﻿${[head, ...rows.map((r) => r.map(q).join(';'))].join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
}

/** Where an invoice stands: paid by a booking, waiting for its debit (maybe overdue), or an Auslage. */
function stateOf(r: Receipt, line: BankLine | undefined, ledger: Ledger): { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' } {
  const x = ledger.expenseOf(r.id)
  if (!line && x) return x.status === 'abgelehnt' ? { label: 'Auslage abgelehnt', tone: 'bad' } : { label: 'Auslage zur Prüfung', tone: 'info' }
  if (line?.accountId === AUSLAGE_ID) return { label: 'Auslage, gutgeschrieben', tone: 'ok' }
  if (line) return { label: 'Bezahlt', tone: 'ok' }
  if (r.due && r.due < TODAY_ISO) return { label: `Überfällig seit ${dmy(r.due)}`, tone: 'bad' }
  return { label: r.due ? `Abbuchung offen · fällig ${dmy(r.due)}` : r.amount < 0 ? 'Gutschrift offen' : 'Abbuchung offen', tone: 'warn' }
}

/**
 * Every invoice, also those that arrived but are not paid yet (an invoice by e-mail, the SEPA debit a week later). Filter by supplier,
 * amount, date, cost center and cost category; "Auswertung" adds them up per cost center and year (maintenance of the last three years).
 * [Entwurf] Eingang (files to check), Ohne Beleg (exceptions and Eigenbelege), Lieferanten (master data, expected recurring invoices).
 */
export default function Invoices({ ledger }: { ledger: Ledger }) {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as Status) || 'alle'
  const view = (params.get('ansicht') as View) || 'liste'
  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); n.set(k, v); return n }, { replace: true })
  const setStatus = (s: Status) => setParam('status', s)
  const setView = (v: View) => setParam('ansicht', v)
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [creating, setCreating] = useState<Partial<Captured> | null>(null)
  const { show, node } = useDetail(ledger)
  const inbox = useInbox()
  const sup = useSuppliers()

  // Supplier invoices and credit notes; the club's own documents for money in stay with their bookings.
  const invoices = ledger.receipts.filter((r) => !r.outgoing)
  const all = invoices.map((r) => { const line = ledger.lines.find((l) => l.id === r.lineId); return { r, line, coding: ledger.codingOfReceipt(r), state: stateOf(r, line, ledger) } })
  const isUnpaid = (x: { r: Receipt; line?: BankLine }) => !x.line && !ledger.expenseOf(x.r.id)
  const unpaid = all.filter(isUnpaid)
  const overdue = unpaid.filter((x) => x.r.due && x.r.due < TODAY_ISO).length
  const missing = sup.list.flatMap((s) => missingPeriods(s, ledger.receipts).map((p) => ({ s, p })))
  const exceptions = uncovered(ledger)
  const suppliers = [...new Set(invoices.map((r) => r.supplier))].sort((a, b) => a.localeCompare(b, 'de'))
  const shown = all
    .filter((x) => (status === 'alle' || isUnpaid(x)) && inRange(x.r.date, f) && amountOk(x.r.amount, f) && (!f.supplier || x.r.supplier === f.supplier) && codingOk(x.coding, f) && textOk([x.r.supplier, x.r.number, x.r.name, x.r.note, eur(x.r.amount), String(x.r.amount).replace('.', ','), x.line?.text], f.q))
    .sort((a, b) => (status === 'ohne' ? (a.r.due ?? '9999').localeCompare(b.r.due ?? '9999') : 0) || b.r.date.localeCompare(a.r.date))
  const paging = usePaging(shown, JSON.stringify([status, f, view]))
  const sum = shown.reduce((n, x) => n + x.r.amount, 0)
  const fuel = fuelStats(shown.map((x) => x.r))
  const name = (id: string) => ledger.costCenters.find((c) => c.id === id)?.name ?? '?'
  const catName = (id: string) => ledger.categories.find((c) => c.id === id)?.name ?? '?'
  const where = (c: Coding[]) => c.map((x) => `${name(x.costCenterId)} · ${catName(x.categoryId)}`).join(', ')

  const exportCsv = () => csv('rechnungen.csv', 'Rechnungsdatum;Lieferant;Rechnungsnummer;Betrag;Zahlungsziel;Status;Kostenstelle und Kostenart;Buchung;Datei',
    shown.map(({ r, line, coding, state }) => [dmy(r.date), r.supplier, r.number, String(r.amount).replace('.', ','), r.due ? dmy(r.due) : '', state.label, where(coding), line ? `${dmy(line.date)} ${line.bookingText ?? line.text}` : '', r.name]))
  const maintenance = ledger.categories.find((c) => c.name.startsWith('Wartung'))?.id ?? ''
  const preset = (p: Partial<Filters>) => { setF({ ...NO_FILTERS, ...p }); setParams((q) => { const n = new URLSearchParams(q); n.set('status', 'alle'); n.set('ansicht', 'liste'); return n }, { replace: true }) }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {view === 'liste' ? (
          <Segmented<Status> value={status} onChange={setStatus} options={[
            { value: 'alle', label: `Alle (${all.length})` },
            { value: 'eingang', label: `Eingang (${inbox.list.length})` },
            { value: 'ohne', label: `Abbuchung offen (${unpaid.length}${overdue ? ` · ${overdue} überfällig` : ''})` },
            { value: 'ausnahmen', label: `Ohne Beleg (${exceptions.sign.length + exceptions.later.length + exceptions.missing.length})` },
          ]} />
        ) : <span />}
        <div className="flex flex-wrap gap-2">
          <Segmented<View> value={view} onChange={setView} options={[{ value: 'liste', label: 'Rechnungen' }, { value: 'auswertung', label: 'Nach Kostenstelle und Jahr' }, { value: 'lieferanten', label: `Lieferanten${missing.length ? ` (${missing.length} fehlt)` : ''}` }]} />
          {view !== 'lieferanten' && <Button onClick={() => setCreating({})}><FilePlus2 size={16} /> Beleg erstellen</Button>}
          {view === 'liste' && (status === 'alle' || status === 'ohne') && <Button onClick={exportCsv} disabled={shown.length === 0}><Download size={16} /> CSV exportieren</Button>}
        </div>
      </div>

      {view === 'lieferanten' && <Suppliers ledger={ledger} onInvoices={(supplier) => preset({ supplier })} onCreate={(supplier) => setCreating({ supplier })} />}
      {view === 'liste' && status === 'eingang' && <Inbox ledger={ledger} />}
      {view === 'liste' && status === 'ausnahmen' && <Exceptions ledger={ledger} onLine={(id) => show({ line: id })} />}

      {view !== 'lieferanten' && (status === 'alle' || status === 'ohne' || view === 'auswertung') && (
        <>
          {view === 'liste' && missing.length > 0 && (
            <Card className="divide-y divide-line border-l-4 border-l-warn">
              {missing.map(({ s, p }) => (
                <div key={`${s.id}-${p}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                  <Badge tone="warn">Rechnung fehlt</Badge>
                  <span className="min-w-0 flex-1 truncate"><b className="font-medium">{s.name}</b> · {periodLabel(p)}{s.recurring?.amount ? ` · erwartet ${eur(s.recurring.amount)}` : ''}</span>
                  <Button onClick={() => setCreating({ supplier: s.name })}>Beleg erstellen</Button>
                </div>
              ))}
            </Card>
          )}

          <FilterBar value={f} onChange={setF} ledger={ledger} suppliers={suppliers}>
            {maintenance && <button onClick={() => preset({ cat: maintenance, from: THREE_YEARS_AGO })} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink">Wartung, letzte 3 Jahre</button>}
          </FilterBar>

          {view === 'liste' ? (
            <Card className="overflow-hidden">
              <div className={clsx('hidden gap-x-3 border-b border-line bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid', COLS)}>
                <span>Datum</span><span>Lieferant · Nr.</span><span>Kostenstelle · Kostenart</span><span className="text-right">Betrag</span><span>Zahlung</span><span />
              </div>
              <div className="divide-y divide-line">
                {paging.rows.map(({ r, line, coding, state }) => (
                  <div key={r.id} role="button" tabIndex={0} onClick={() => show({ invoice: r.id })} onKeyDown={(e) => e.key === 'Enter' && show({ invoice: r.id })} className={clsx('grid cursor-pointer gap-x-3 gap-y-1 border-l-4 px-3 py-2 hover:bg-slate-50 md:items-center', COLS, state.tone === 'bad' ? 'border-l-bad' : 'border-l-transparent')}>
                    <div className="text-xs text-muted">{dmy(r.date)}</div>
                    <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{r.supplier}</span>{r.amount < 0 && <Badge tone="info">Gutschrift</Badge>}</div><div className="truncate text-xs text-muted">{r.number ?? 'ohne Nummer'} · {r.source}</div></div>
                    <div className="min-w-0 truncate text-sm" title={where(coding)}>{coding.length > 0 ? where(coding) : <span className="text-muted">Noch offen</span>}</div>
                    <div className="text-sm font-semibold tabular-nums md:text-right">{eur(r.amount)}</div>
                    <div className="min-w-0 text-sm">{line?.accountId === AUSLAGE_ID
                      ? <span className="flex items-center gap-1.5 text-muted">{ledger.isLocked(line.date) && <Lock size={12} className="shrink-0" />}<span className="truncate">Auslage {members.find((m) => m.id === r.paidBy)?.name ?? ''} · gutgeschrieben {dmy(line.date)}</span></span>
                      : line
                      ? <span className="flex items-center gap-1.5 text-muted">{ledger.isLocked(line.date) && <Lock size={12} className="shrink-0" />}<span className="truncate">{dmy(line.date)} · {ledger.accountName(line.accountId)} · {line.bookingText ?? line.text}</span></span>
                      : <Badge tone={state.tone}>{state.label}</Badge>}</div>
                    <button aria-label={`${r.name} öffnen`} title="Datei öffnen" onClick={(e) => { e.stopPropagation(); openReceiptFile(r.name) }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink"><Download size={15} /></button>
                  </div>
                ))}
                {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">Keine Rechnungen für diese Auswahl.</p>}
              </div>
              {paging.bar}
              <div className="flex flex-wrap items-center justify-end gap-x-5 border-t border-line bg-slate-50 px-4 py-2 text-xs text-muted">
                <span>{shown.length} Rechnungen</span>{fuel && <span>Treibstoff <b className="tabular-nums text-ink">{Math.round(fuel.liters).toLocaleString('de-AT')} L</b> · Ø <b className="tabular-nums text-ink">{perLiter(fuel.avg)}</b></span>}<span>Summe <b className="tabular-nums text-ink">{eur(sum)}</b></span>
              </div>
            </Card>
          ) : (
            <Pivot rows={shown.map((x) => ({ r: x.r, coding: x.coding }))} f={f} name={name} onPick={(cc, year) => { setF({ ...f, cc: cc ?? f.cc, ...(year ? { from: `${year}-01-01`, to: `${year}-12-31` } : {}) }); setView('liste') }} />
          )}
        </>
      )}

      {node}
      {creating && <ReceiptForm ledger={ledger} start={creating} onClose={() => setCreating(null)} />}
    </div>
  )
}

/** Sum per cost center (rows) and year (columns). A cell opens the invoices behind it. */
function Pivot({ rows, f, name, onPick }: { rows: { r: Receipt; coding: Coding[] }[]; f: Filters; name: (id: string) => string; onPick: (cc: string | null, year: string | null) => void }) {
  const NONE = ''
  const cells = new Map<string, Map<string, number>>()
  const years = new Set<string>()
  for (const { r, coding } of rows) {
    const year = r.date.slice(0, 4)
    years.add(year)
    const parts = coding.filter((c) => (!f.cc || c.costCenterId === f.cc) && (!f.cat || c.categoryId === f.cat))
    for (const c of parts.length > 0 ? parts : [{ costCenterId: NONE, categoryId: NONE, amount: r.amount }]) {
      const row = cells.get(c.costCenterId) ?? new Map<string, number>()
      row.set(year, (row.get(year) ?? 0) + c.amount)
      cells.set(c.costCenterId, row)
    }
  }
  const cols = [...years].sort()
  const keys = [...cells.keys()].sort((a, b) => (a === NONE ? 1 : b === NONE ? -1 : name(a).localeCompare(name(b), 'de')))
  const total = (m: Map<string, number>) => [...m.values()].reduce((n, v) => n + v, 0)
  const colTotal = (y: string) => keys.reduce((n, k) => n + (cells.get(k)!.get(y) ?? 0), 0)
  if (keys.length === 0) return <Card className="p-6 text-center text-sm text-muted">Keine Rechnungen für diese Auswahl.</Card>
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
          <tr><th className="px-4 py-2 font-medium">Kostenstelle</th>{cols.map((y) => <th key={y} className="px-3 py-2 text-right font-medium">{y}</th>)}<th className="px-4 py-2 text-right font-medium">Summe</th></tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {keys.map((k) => (
            <tr key={k}>
              <td className="px-4 py-2 font-medium">{k === NONE ? <span className="text-muted">Noch offen</span> : <button onClick={() => onPick(k, null)} className="hover:text-brand">{name(k)}</button>}</td>
              {cols.map((y) => { const v = cells.get(k)!.get(y); return <td key={y} className="px-3 py-2 text-right">{v ? <button title="Zu den Rechnungen" onClick={() => onPick(k === NONE ? null : k, y)} className="hover:text-brand hover:underline">{eur(v)}</button> : <span className="text-muted">–</span>}</td> })}
              <td className="px-4 py-2 text-right font-semibold">{eur(total(cells.get(k)!))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-line bg-slate-50 font-semibold tabular-nums">
          <tr><td className="px-4 py-2">Summe</td>{cols.map((y) => <td key={y} className="px-3 py-2 text-right">{eur(colTotal(y))}</td>)}<td className="px-4 py-2 text-right">{eur(cols.reduce((n, y) => n + colTotal(y), 0))}</td></tr>
        </tfoot>
      </table>
    </Card>
  )
}
