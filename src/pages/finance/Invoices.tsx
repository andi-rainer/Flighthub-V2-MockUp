import clsx from 'clsx'
import { Download, FilePlus2, Lock } from 'lucide-react'
import { useState } from 'react'
import { eur, type Receipt } from '../../data'
import { Badge, Button, Card, Segmented, usePaging } from '../../ui'
import { TODAY_ISO } from '../../state'
import { dmy } from '../manifest/data'
import { useDetail } from './Details'
import { amountOk, codingOk, FilterBar, inRange, NO_FILTERS, textOk, type Filters } from './filters'
import { type Coding, type Ledger } from './ledger'
import { fuelStats, openReceiptFile, perLiter } from './parts'
import { ReceiptForm } from './ReceiptDialogs'

type Status = 'alle' | 'ohne'
type Mode = 'liste' | 'auswertung'
const COLS = 'md:grid-cols-[5.5rem_minmax(0,1.6fr)_minmax(0,1.4fr)_6.5rem_minmax(0,1.5fr)_2.5rem]'
const THREE_YEARS_AGO = `${Number(TODAY_ISO.slice(0, 4)) - 3}${TODAY_ISO.slice(4)}`

/**
 * Every invoice, also those that arrived but are not paid yet (an invoice by e-mail, the SEPA debit a week later). Filter by supplier,
 * amount, date, cost center and cost category; "Auswertung" adds them up per cost center and year (maintenance of the last three years).
 */
export default function Invoices({ ledger }: { ledger: Ledger }) {
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [status, setStatus] = useState<Status>('alle')
  const [mode, setMode] = useState<Mode>('liste')
  const [creating, setCreating] = useState(false)
  const { show, node } = useDetail(ledger)

  const all = ledger.receipts.map((r) => ({ r, line: ledger.lines.find((l) => l.id === r.lineId), coding: ledger.codingOfReceipt(r) }))
  const unpaid = all.filter((x) => !x.line && !ledger.expenseOf(x.r.id)).length
  const suppliers = [...new Set(ledger.receipts.map((r) => r.supplier))].sort((a, b) => a.localeCompare(b, 'de'))
  const shown = all
    .filter(({ r, line, coding }) => (status === 'alle' || (!line && !ledger.expenseOf(r.id))) && inRange(r.date, f) && amountOk(r.amount, f) && (!f.supplier || r.supplier === f.supplier) && codingOk(coding, f) && textOk([r.supplier, r.number, r.name, r.note, eur(r.amount), String(r.amount).replace('.', ','), line?.text], f.q))
    .sort((a, b) => b.r.date.localeCompare(a.r.date))
  const paging = usePaging(shown, JSON.stringify([status, f, mode]))
  const sum = shown.reduce((n, x) => n + x.r.amount, 0)
  const fuel = fuelStats(shown.map((x) => x.r))
  const name = (id: string) => ledger.costCenters.find((c) => c.id === id)?.name ?? '?'
  const catName = (id: string) => ledger.categories.find((c) => c.id === id)?.name ?? '?'
  const where = (c: Coding[]) => c.map((x) => `${name(x.costCenterId)} · ${catName(x.categoryId)}`).join(', ')

  const exportCsv = () => {
    const q = (s: string | number | undefined) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const rows = shown.map(({ r, line, coding }) => [dmy(r.date), r.supplier, r.number, String(r.amount).replace('.', ','), where(coding), line ? `${dmy(line.date)} ${line.bookingText ?? line.text}` : 'Abbuchung offen'].map(q).join(';'))
    const csv = ['Rechnungsdatum;Lieferant;Rechnungsnummer;Betrag;Kostenstelle und Kostenart;Buchung', ...rows].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    a.download = 'rechnungen.csv'
    a.click()
  }
  const maintenance = ledger.categories.find((c) => c.name.startsWith('Wartung'))?.id ?? ''
  const preset = (p: Partial<Filters>, s: Status = 'alle') => { setF({ ...NO_FILTERS, ...p }); setStatus(s) }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<Status> value={status} onChange={setStatus} options={[{ value: 'alle', label: `Alle (${all.length})` }, { value: 'ohne', label: `Abbuchung offen (${unpaid})` }]} />
        <div className="flex flex-wrap gap-2">
          <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: 'liste', label: 'Liste' }, { value: 'auswertung', label: 'Nach Kostenstelle und Jahr' }]} />
          <Button onClick={() => setCreating(true)}><FilePlus2 size={16} /> Beleg erstellen</Button>
          <Button onClick={exportCsv} disabled={shown.length === 0}><Download size={16} /> CSV exportieren</Button>
        </div>
      </div>

      <FilterBar value={f} onChange={setF} ledger={ledger} suppliers={suppliers}>
        {maintenance && <button onClick={() => preset({ cat: maintenance, from: THREE_YEARS_AGO })} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink">Wartung, letzte 3 Jahre</button>}
      </FilterBar>

      {mode === 'liste' ? (
        <Card className="overflow-hidden">
          <div className={clsx('hidden gap-x-3 border-b border-line bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid', COLS)}>
            <span>Datum</span><span>Lieferant · Nr.</span><span>Kostenstelle · Kostenart</span><span className="text-right">Betrag</span><span>Buchung</span><span />
          </div>
          <div className="divide-y divide-line">
            {paging.rows.map(({ r, line, coding }) => (
              <div key={r.id} role="button" tabIndex={0} onClick={() => show({ invoice: r.id })} onKeyDown={(e) => e.key === 'Enter' && show({ invoice: r.id })} className={clsx('grid cursor-pointer gap-x-3 gap-y-1 px-3 py-2 hover:bg-slate-50 md:items-center', COLS)}>
                <div className="text-xs text-muted">{dmy(r.date)}</div>
                <div className="min-w-0"><div className="truncate text-sm font-medium">{r.supplier}</div><div className="truncate text-xs text-muted">{r.number ?? 'ohne Nummer'} · {r.source}</div></div>
                <div className="min-w-0 truncate text-sm" title={where(coding)}>{coding.length > 0 ? where(coding) : <span className="text-muted">Noch offen</span>}</div>
                <div className="text-sm font-semibold tabular-nums md:text-right">{eur(r.amount)}</div>
                <div className="min-w-0 text-sm">{line
                  ? <span className="flex items-center gap-1.5 text-muted">{ledger.isLocked(line.date) && <Lock size={12} className="shrink-0" />}<span className="truncate">{dmy(line.date)} · {line.bookingText ?? line.text}</span></span>
                  : ledger.expenseOf(r.id) ? <Badge tone={ledger.expenseOf(r.id)!.status === 'abgelehnt' ? 'bad' : 'info'}>{ledger.expenseOf(r.id)!.status === 'abgelehnt' ? 'Auslage abgelehnt' : 'Auslage zur Prüfung'}</Badge>
                  : <Badge tone="warn">Abbuchung offen</Badge>}</div>
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
        <Pivot rows={shown.map((x) => ({ r: x.r, coding: x.coding }))} f={f} name={name} onPick={(cc, year) => { setF({ ...f, cc: cc ?? f.cc, ...(year ? { from: `${year}-01-01`, to: `${year}-12-31` } : {}) }); setMode('liste') }} />
      )}

      {node}
      {creating && <ReceiptForm ledger={ledger} onClose={() => setCreating(false)} />}
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
