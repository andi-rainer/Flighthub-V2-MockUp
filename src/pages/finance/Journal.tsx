import clsx from 'clsx'
import { ArrowLeftRight, FilePlus2, Lock, Plus, Receipt, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { eur, type BankLine } from '../../data'
import { Badge, Button, Card, Drawer, Segmented, usePaging } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { dmy } from '../manifest/data'
import { Field, field } from '../tickets/parts'
import AccountStrip, { Transfer } from './AccountStrip'
import AwaitingMoney from './AwaitingMoney'
import { useDetail } from './Details'
import { ExpenseDrawer } from './Expense'
import ExpenseQueue from './Expenses'
import { amountOk, codingOk, FilterBar, inRange, isFiltered, NO_FILTERS, textOk, type Filters } from './filters'
import { type Ledger } from './ledger'
import { cents, confLabel, Dot, SAFE } from './parts'
import { ReceiptForm } from './ReceiptDialogs'
import { isTodo, lineStatus, receiptsOf, STATUS, type LineStatus } from './status'

type View = 'alle' | 'bearbeiten'
/** What the tab opens with when another tab sends the person here (an account, a month with open items). */
export interface JournalPreset { account?: string; month?: string; todo?: boolean }

const COLS = 'md:grid-cols-[5.5rem_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_6.5rem_8.5rem]'
const EDGE: Record<LineStatus, string> = {
  offen: 'border-l-warn', beleg: 'border-l-warn/50', abweichung: 'border-l-warn/50', ausnahme: 'border-l-transparent', gebucht: 'border-l-transparent', gesperrt: 'border-l-slate-200 bg-slate-50/70',
}
const monthRange = (m: string) => ({ from: `${m}-01`, to: `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate()).padStart(2, '0')}` })

/**
 * Every booking of every account, newest first. What is still to do shows at a glance (amber edge, status, button); "Zu bearbeiten" is the
 * quick view of exactly those. A booked line can still change (cost center, text) until its period is released.
 */
export default function Journal({ ledger, preset }: { ledger: Ledger; preset?: JournalPreset }) {
  const [view, setView] = useState<View>(preset?.todo ? 'bearbeiten' : 'alle')
  const [f, setF] = useState<Filters>({ ...NO_FILTERS, account: preset?.account ?? '', ...(preset?.month ? monthRange(preset.month) : {}) })
  const [creating, setCreating] = useState<null | 'receipt' | 'line' | 'transfer' | 'expense'>(null)
  const [bulk, setBulk] = useState(false)
  const { show, node } = useDetail(ledger)
  const { can } = useApp()
  const reviewExpenses = can('billing.bank.manage')
  const expensesOpen = reviewExpenses ? ledger.expenses.filter((x) => x.status === 'offen').length : 0

  const items = ledger.lines.map((l) => ({ l, status: lineStatus(l, ledger) }))
  const todo = items.filter((i) => isTodo(i.status))
  const safe = todo.filter((i) => i.status === 'offen' && i.l.suggestion && i.l.suggestion.confidence >= SAFE).map((i) => i.l)
  const shown = items
    .filter(({ l, status }) => (view === 'alle' || isTodo(status)) && (!f.account || l.accountId === f.account) && inRange(l.date, f) && amountOk(l.amount, f) && codingOk(ledger.codingOfLine(l), f) && textOk(haystack(l, ledger), f.q))
    .sort((a, b) => b.l.date.localeCompare(a.l.date) || b.l.id.localeCompare(a.l.id))
  const paging = usePaging(shown, JSON.stringify([view, f]))
  const income = shown.filter((i) => i.l.amount > 0).reduce((n, i) => n + i.l.amount, 0)
  const cost = shown.filter((i) => i.l.amount < 0).reduce((n, i) => n + i.l.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'alle', label: `Alle (${items.length})` }, { value: 'bearbeiten', label: `Zu bearbeiten (${todo.length + expensesOpen})` }]} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreating('line')}><Plus size={16} /> Buchung erfassen</Button>
          <Button onClick={() => setCreating('expense')}><Receipt size={16} /> Auslage erfassen</Button>
          <Button onClick={() => setCreating('transfer')}><ArrowLeftRight size={16} /> Umbuchung</Button>
          <Button onClick={() => setCreating('receipt')}><FilePlus2 size={16} /> Beleg erstellen</Button>
          <Button>Kontoauszug importieren</Button>
          {view === 'bearbeiten' && <Button variant="primary" disabled={safe.length === 0} onClick={() => setBulk(true)}>{safe.length} sichere prüfen</Button>}
        </div>
      </div>

      <AccountStrip ledger={ledger} value={f.account} onChange={(account) => setF({ ...f, account })} />
      <FilterBar value={f} onChange={setF} ledger={ledger} />
      {view === 'bearbeiten' && reviewExpenses && <ExpenseQueue ledger={ledger} />}
      {view === 'bearbeiten' && <AwaitingMoney />}

      <Card className="overflow-hidden">
        <div className={clsx('hidden gap-x-3 border-b border-line bg-slate-50 px-3 py-2 pl-[calc(0.75rem+4px)] text-xs font-medium uppercase tracking-wide text-muted md:grid', COLS)}>
          <span>Datum</span><span>Buchung</span><span>Rechnung</span><span>Kostenstelle · Kostenart</span><span className="text-right">Betrag</span><span>Status</span>
        </div>
        <div className="divide-y divide-line">
          {paging.rows.map(({ l, status }) => (
            <Line key={l.id} line={l} status={status} ledger={ledger} onOpen={() => show({ line: l.id })} onAssign={() => show({ assign: l.id })} onInvoice={(id) => show({ invoice: id })} />
          ))}
          {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">{view === 'bearbeiten' && !isFiltered(f) ? 'Alles zugeordnet.' : 'Keine Buchungen für diese Auswahl.'}</p>}
        </div>
        {paging.bar}
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-line bg-slate-50 px-4 py-2 text-xs text-muted">
          <span>{shown.length} Buchungen</span>
          <span>Einnahmen <b className="tabular-nums text-ok">{eur(income)}</b></span>
          <span>Ausgaben <b className="tabular-nums text-bad">{eur(cost)}</b></span>
          <span>Saldo <b className="tabular-nums text-ink">{eur(income + cost)}</b></span>
        </div>
      </Card>

      {node}
      {creating === 'receipt' && <ReceiptForm ledger={ledger} onClose={() => setCreating(null)} />}
      {creating === 'expense' && <ExpenseDrawer ledger={ledger} onClose={() => setCreating(null)} />}
      {creating === 'transfer' && <Transfer ledger={ledger} onClose={() => setCreating(null)} />}
      {creating === 'line' && <NewLine ledger={ledger} account={f.account} onClose={() => setCreating(null)} />}
      {bulk && <BulkConfirm lines={safe} ledger={ledger} onClose={() => setBulk(false)} />}
    </div>
  )
}

/** Everything a person may type to find a booking: the text, the account, the target, the invoices and the amount. */
function haystack(l: BankLine, ledger: Ledger) {
  const target = ledger.done[l.id]
  const rs = receiptsOf(l, ledger)
  return [l.text, l.bookingText, ledger.accountName(l.accountId), target ? ledger.label(target) : l.suggestion && ledger.label(l.suggestion.target), eur(l.amount), String(Math.abs(l.amount)).replace('.', ','), ...rs.flatMap((r) => [r.supplier, r.number, r.name])]
}

function Line({ line: l, status, ledger, onOpen, onAssign, onInvoice }: { line: BankLine; status: LineStatus; ledger: Ledger; onOpen: () => void; onAssign: () => void; onInvoice: (id: string) => void }) {
  const target = ledger.done[l.id]
  const s = l.suggestion
  const rs = receiptsOf(l, ledger)
  const ex = ledger.exempt[l.id]
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={clsx('grid cursor-pointer gap-x-3 gap-y-1 border-l-4 px-3 py-2 hover:bg-slate-50 md:items-center', COLS, EDGE[status])}>
      <div className="text-xs text-muted">{dmy(l.date)}</div>

      <div className="min-w-0">
        <div className="text-sm font-medium leading-snug" title={l.bookingText ? `Bank: ${l.text}` : undefined}>{l.bookingText ?? l.text}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted"><span className="rounded bg-slate-100 px-1.5 py-px">{ledger.accountName(l.accountId)}</span>{l.check && <span title={l.check.text} className={l.check.tone === 'ok' ? 'text-ok' : 'text-warn'}><Sparkles size={12} /></span>}</div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {rs.slice(0, 2).map((r) => (
          <button key={r.id} onClick={stop(() => onInvoice(r.id))} title={`${r.supplier}${r.number ? ` · ${r.number}` : ''}`} className="max-w-[11rem] truncate rounded-full bg-ok-soft px-2 py-px text-[11px] font-medium text-ok hover:underline">{r.supplier}{r.number ? ` ${r.number}` : ''}</button>
        ))}
        {rs.length > 2 && <span className="text-[11px] text-muted">+{rs.length - 2}</span>}
        {rs.length === 0 && l.needsReceipt && target && <span className="rounded-full bg-warn-soft px-2 py-px text-[11px] font-medium text-amber-900">{ex ? `Ohne Beleg: ${ex.reason}` : 'Beleg fehlt'}</span>}
      </div>

      <div className="min-w-0 text-sm">
        {target ? <div className="truncate" title={ledger.label(target)}>{ledger.label(target)}</div>
          : s ? <div className="flex items-center gap-1.5 text-muted" title={s.why}><Dot c={s.confidence} /><span className="truncate">{ledger.label(s.target)}<span className="text-xs"> · {confLabel(s.confidence)}</span></span></div>
          : <div className="text-warn">Kein Vorschlag</div>}
      </div>

      <div className={clsx('text-sm font-semibold tabular-nums md:text-right', l.amount < 0 ? 'text-bad' : 'text-ok')}>{eur(l.amount)}</div>

      <div className="md:flex md:justify-start">
        {status === 'offen'
          ? <Button variant="primary" onClick={stop(onAssign)}>{s ? 'Bestätigen' : 'Zuordnen'}</Button>
          : <Badge tone={STATUS[status].tone}>{status === 'gesperrt' && <Lock size={11} className="mr-1" />}{STATUS[status].label}</Badge>}
      </div>
    </div>
  )
}

/** A booking by hand: for a cash box, a savings book, interest, anything a statement does not bring. */
function NewLine({ ledger, account, onClose }: { ledger: Ledger; account: string; onClose: () => void }) {
  const accounts = ledger.accounts.filter((a) => !a.archived)
  const [acc, setAcc] = useState(account)
  const [date, setDate] = useState(TODAY_ISO)
  const [text, setText] = useState('')
  const [dir, setDir] = useState<'' | 'ein' | 'aus'>('')
  const [amount, setAmount] = useState('')
  const value = cents(amount)
  const valid = !!acc && !!dir && text.trim() !== '' && value > 0 && date !== ''
  return (
    <Drawer open title="Buchung erfassen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => { ledger.addLine({ accountId: acc, date, text: text.trim(), amount: (dir === 'ein' ? value : -value) / 100 }); onClose() }}>Buchung erfassen</Button></div>}>
      <div className="space-y-4 text-sm">
        <Field label="Konto"><select aria-label="Konto" value={acc} onChange={(e) => setAcc(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Segmented value={dir} onChange={setDir} options={[{ value: 'aus', label: 'Ausgabe' }, { value: 'ein', label: 'Einnahme' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum"><input type="date" aria-label="Datum" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Betrag (€)"><input aria-label="Betrag" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          <Field label="Buchungstext" className="col-span-2"><input aria-label="Buchungstext" value={text} onChange={(e) => setText(e.target.value)} className={`${field} w-full`} /></Field>
        </div>
      </div>
    </Drawer>
  )
}

/** The safe suggestions at a glance: nothing is booked before the list was seen. */
function BulkConfirm({ lines, ledger, onClose }: { lines: BankLine[]; ledger: Ledger; onClose: () => void }) {
  return (
    <Drawer open title="Sichere Vorschläge prüfen" onClose={onClose}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={lines.length === 0} onClick={() => { ledger.assignMany(lines.map((l) => ({ lineId: l.id, target: l.suggestion!.target }))); onClose() }}>{lines.length} Buchungen bestätigen</Button>}>
      <div className="divide-y divide-line rounded-xl border border-line text-sm">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.text}</div><div className="truncate text-xs text-muted">{dmy(l.date)} · {ledger.label(l.suggestion!.target)}</div></div>
            <div className={clsx('shrink-0 font-semibold tabular-nums', l.amount < 0 ? 'text-bad' : 'text-ok')}>{eur(l.amount)}</div>
          </div>
        ))}
        {lines.length === 0 && <p className="p-4 text-muted">Keine sicheren Vorschläge mehr.</p>}
      </div>
    </Drawer>
  )
}
