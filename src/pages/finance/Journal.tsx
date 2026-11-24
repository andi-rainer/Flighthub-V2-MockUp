import clsx from 'clsx'
import { ArrowLeftRight, ChevronRight, FilePlus2, Lock, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { eur, members, type BankLine } from '../../data'
import { Badge, Button, Card, Drawer, FilePick, Segmented, SplitButton, usePaging, type PickedFile } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { Provisional, useProvisionalCash } from '../manifest/closingPreview'
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
import { ReceiptForm, useCountersign } from './ReceiptDialogs'
import { RulesDrawer } from './Rules'
import { suggestionOf, useRules, type Rule } from './ruleStore'
import { counterCandidates, counterOf, isTodo, isInternal, LATER, lineStatus, needsProof, ownStateOf, PROOF, proofOf, receiptsOf, STATUS, type LineStatus, type Proof } from './status'

type View = 'alle' | 'bearbeiten'
/** What the tab opens with when another tab sends the person here (an account, a month with open items, a kind of proof). */
export interface JournalPreset { account?: string; month?: string; todo?: boolean; proof?: Proof; /** Open this booking at once (a link from a Betriebskonto, an invoice). */ line?: string }

const COLS = 'md:grid-cols-[5.5rem_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_6.5rem_8.5rem]'
const EDGE: Record<LineStatus, string> = {
  offen: 'border-l-warn', beleg: 'border-l-warn/50', abweichung: 'border-l-warn/50', unterschrift: 'border-l-warn/50', eigenbeleg: 'border-l-transparent', ausnahme: 'border-l-warn/50', gebucht: 'border-l-transparent', gesperrt: 'border-l-slate-200 bg-slate-50/70',
}
const monthRange = (m: string) => ({ from: `${m}-01`, to: `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate()).padStart(2, '0')}` })

/**
 * Every booking of every account, newest first. What is still to do shows at a glance (amber edge, status, button); "Zu bearbeiten" is the
 * quick view of exactly those, plus the other open points of the treasurer as counted links. A booked line can still change (cost center,
 * text) until its period is released.
 */
export default function Journal({ ledger, preset }: { ledger: Ledger; preset?: JournalPreset }) {
  const { can } = useApp()
  const rules = useRules()
  const reviewExpenses = can('billing.bank.manage')
  // Opens on what is to do; with nothing to do it opens on everything.
  const [view, setView] = useState<View>(() => (preset?.proof ? 'alle' : preset?.todo || ledger.lines.some((l) => isTodo(lineStatus(l, ledger))) || (reviewExpenses && ledger.expenses.some((x) => x.status === 'offen')) ? 'bearbeiten' : 'alle'))
  const [f, setF] = useState<Filters>({ ...NO_FILTERS, account: preset?.account ?? '', ...(preset?.month ? monthRange(preset.month) : {}) })
  const [proof, setProof] = useState<Proof | ''>(preset?.proof ?? '')
  const [creating, setCreating] = useState<null | 'receipt' | 'line' | 'transfer' | 'expense' | 'import' | 'rules'>(null)
  const [bulk, setBulk] = useState(false)
  const { show, node } = useDetail(ledger)
  // A link to one booking opens it once; closing it leaves the list.
  useEffect(() => { if (preset?.line) show({ line: preset.line }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const expensesOpen = reviewExpenses ? ledger.expenses.filter((x) => x.status === 'offen').length : 0

  const items = ledger.lines.map((l) => ({ l, status: lineStatus(l, ledger) }))
  const todo = items.filter((i) => isTodo(i.status))
  const safe = todo.flatMap((i) => {
    const s = i.status === 'offen' ? suggestionOf(i.l, ledger, rules) : undefined
    return s && s.confidence >= SAFE ? [{ line: i.l, target: s.target }] : []
  })
  const shown = items
    .filter(({ l, status }) => (view === 'alle' || isTodo(status)) && (!f.account || l.accountId === f.account) && (!proof || proofOf(l, ledger) === proof) && inRange(l.date, f) && amountOk(l.amount, f) && codingOk(ledger.codingOfLine(l), f) && textOk(haystack(l, ledger), f.q))
    .sort((a, b) => b.l.date.localeCompare(a.l.date) || b.l.id.localeCompare(a.l.id))
  const paging = usePaging(shown, JSON.stringify([view, f, proof]))
  const income = shown.filter((i) => i.l.amount > 0).reduce((n, i) => n + i.l.amount, 0)
  const cost = shown.filter((i) => i.l.amount < 0).reduce((n, i) => n + i.l.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'alle', label: `Alle (${items.length})` }, { value: 'bearbeiten', label: `Zu bearbeiten (${todo.length + expensesOpen})` }]} />
        <div className="flex flex-wrap gap-2">
          <SplitButton onClick={() => setCreating('line')} actions={[
            { label: 'Auslage erfassen', onSelect: () => setCreating('expense') },
            { label: 'Umbuchung', onSelect: () => setCreating('transfer') },
            { label: 'Kontoauszug importieren', onSelect: () => setCreating('import') },
          ]}>Buchung erfassen</SplitButton>
          <Button onClick={() => setCreating('receipt')}><FilePlus2 size={16} /> Beleg erstellen</Button>
          <Button onClick={() => setCreating('rules')}><Wand2 size={16} /> Regeln</Button>
          {view === 'bearbeiten' && <Button variant="primary" disabled={safe.length === 0} onClick={() => setBulk(true)}>{safe.length} sichere prüfen</Button>}
        </div>
      </div>

      <AccountStrip ledger={ledger} value={f.account} onChange={(account) => setF({ ...f, account })} />
      <FilterBar value={f} onChange={(next) => { setF(next); if (!isFiltered(next)) setProof('') }} ledger={ledger}>
        <select aria-label="Beleg" value={proof} onChange={(e) => setProof(e.target.value as Proof | '')} className={clsx(field, proof && 'border-brand')}>
          <option value="">Alle Belege</option>
          {(Object.keys(PROOF) as Proof[]).map((p) => <option key={p} value={p}>{PROOF[p]}</option>)}
        </select>
      </FilterBar>
      {view === 'bearbeiten' && <MoreTodo ledger={ledger} />}
      {view === 'bearbeiten' && reviewExpenses && <ExpenseQueue ledger={ledger} />}
      {view === 'bearbeiten' && <AwaitingMoney />}

      <Card className="overflow-hidden">
        <div className={clsx('hidden gap-x-3 border-b border-line bg-slate-50 px-3 py-2 pl-[calc(0.75rem+4px)] text-xs font-medium uppercase tracking-wide text-muted md:grid', COLS)}>
          <span>Datum</span><span>Buchung</span><span>Rechnung</span><span>Kostenstelle · Kostenart</span><span className="text-right">Betrag</span><span>Status</span>
        </div>
        <div className="divide-y divide-line">
          {paging.rows.map(({ l, status }) => (
            <Line key={l.id} line={l} status={status} ledger={ledger} rules={rules} onOpen={() => show({ line: l.id })} onAssign={() => show({ assign: l.id })} onInvoice={(id) => show({ invoice: id })} onLine={(id) => show({ line: id })} />
          ))}
          {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">{view === 'bearbeiten' && !isFiltered(f) && !proof ? 'Alles zugeordnet.' : 'Keine Buchungen für diese Auswahl.'}</p>}
        </div>
        {paging.bar}
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-line bg-slate-50 px-4 py-2 text-xs text-muted">
          <span>{shown.length} Buchungen</span>
          <span>Einnahmen <b className="tabular-nums text-ok">{eur(income)}</b></span>
          <span>Ausgaben <b className="tabular-nums text-bad">{eur(cost)}</b></span>
          <span>Saldo <b className="tabular-nums text-ink">{eur(income + cost)}</b></span>
        </div>
      </Card>

      {creating === 'receipt' && <ReceiptForm ledger={ledger} onClose={() => setCreating(null)} />}
      {creating === 'expense' && <ExpenseDrawer ledger={ledger} onClose={() => setCreating(null)} />}
      {creating === 'transfer' && <Transfer ledger={ledger} onClose={() => setCreating(null)} />}
      {creating === 'line' && <NewLine ledger={ledger} account={f.account} onClose={() => setCreating(null)} />}
      {creating === 'import' && <ImportStatement ledger={ledger} account={f.account} onClose={() => setCreating(null)} />}
      {creating === 'rules' && <RulesDrawer ledger={ledger} onClose={() => setCreating(null)} />}
      {bulk && <BulkConfirm items={safe} ledger={ledger} onEdit={(id) => show({ assign: id })} onClose={() => setBulk(false)} />}
      {node}
    </div>
  )
}

/** Everything a person may type to find a booking: the text, the account, the target, the invoices and the amount. */
function haystack(l: BankLine, ledger: Ledger) {
  const target = ledger.done[l.id]
  const rs = receiptsOf(l, ledger)
  return [l.text, l.bookingText, ledger.accountName(l.accountId), target ? ledger.label(target) : l.suggestion && ledger.label(l.suggestion.target), eur(l.amount), String(Math.abs(l.amount)).replace('.', ','), ...rs.flatMap((r) => [r.supplier, r.number, r.name])]
}

/**
 * [Entwurf] The other open points of the treasurer, counted, each a link to where it is done: invoices waiting for their payment, members in
 * the minus, flights to charge, bookings without a receipt. "Zu bearbeiten" is the one inbox; the work itself stays in its own place.
 */
function MoreTodo({ ledger }: { ledger: Ledger }) {
  const { can, flights, hasAccount } = useApp()
  const unpaid = ledger.receipts.filter((r) => !r.lineId && !ledger.expenseOf(r.id))
  const minus = members.filter((m) => hasAccount(m.id) && (ledger.balances[m.id] ?? m.balance) < 0)
  const toCharge = flights.filter((x) => x.state === 'offen')
  const mayCountersign = useCountersign()
  const toSign = ledger.lines.filter((l) => proofOf(l, ledger) === 'unterschrift' && mayCountersign(ledger.exempt[l.id]))
  const links: { label: string; hint: string; to?: string; onClick?: () => void }[] = [
    ...(unpaid.length ? [{ label: `${unpaid.length} Rechnungen ohne Zahlung`, hint: eur(unpaid.reduce((n, r) => n + r.amount, 0)), to: '/finanzen?tab=rechnungen&status=ohne' }] : []),
    ...(minus.length && can('billing.accounts.view') ? [{ label: `${minus.length} Mitglieder im Minus`, hint: eur(minus.reduce((n, m) => n + (ledger.balances[m.id] ?? m.balance), 0)), to: '/finanzen?tab=konten&filter=minus' }] : []),
    ...(toCharge.length && can('billing.flights.charge') ? [{ label: `${toCharge.length} Flüge zu verrechnen`, hint: eur(toCharge.reduce((n, x) => n + x.amount, 0)), to: '/bordbuch?nur=verrechnen' }] : []),
    ...(toSign.length ? [{ label: `${toSign.length} Eigenbelege gegenzeichnen`, hint: eur(toSign.reduce((n, l) => n + l.amount, 0)), to: '/finanzen?tab=rechnungen&status=ausnahmen' }] : []),
  ]
  if (links.length === 0) return null
  const chip = 'inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:border-brand hover:text-brand'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">Außerdem offen</span>
      {links.map((x) => {
        const inner = <><span className="font-medium">{x.label}</span><span className="text-xs tabular-nums text-muted">{x.hint}</span><ChevronRight size={14} className="text-muted" /></>
        return x.to ? <Link key={x.label} to={x.to} className={chip}>{inner}</Link> : <button key={x.label} onClick={x.onClick} className={chip}>{inner}</button>
      })}
    </div>
  )
}

function Line({ line: l, status, ledger, rules, onOpen, onAssign, onInvoice, onLine }: { line: BankLine; status: LineStatus; ledger: Ledger; rules: Rule[]; onOpen: () => void; onAssign: () => void; onInvoice: (id: string) => void; onLine: (id: string) => void }) {
  const target = ledger.done[l.id]
  const s = target ? undefined : suggestionOf(l, ledger, rules)
  const rs = receiptsOf(l, ledger)
  const ex = ledger.exempt[l.id]
  const own = ownStateOf(l, ledger)
  const counter = counterOf(l, ledger)
  const counterAt = !target && s?.target.kind === 'umbuchung' ? counterCandidates(l, s.target.accountId, ledger)[0] : undefined
  const proposed = !target && rs.length === 0 ? ledger.receipts.find((r) => !r.lineId && r.suggestion?.lineId === l.id) : undefined
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
  const provisional = useProvisionalCash()(l)
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={clsx('grid cursor-pointer gap-x-3 gap-y-1 border-l-4 px-3 py-2 hover:bg-slate-50 md:items-center', COLS, EDGE[status])}>
      <div className="text-xs text-muted">{dmy(l.date)}</div>

      <div className="min-w-0">
        <div className="text-sm font-medium leading-snug" title={l.bookingText ? `Bank: ${l.text}` : undefined}>{l.bookingText ?? l.text}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted"><span className="rounded bg-slate-100 px-1.5 py-px">{ledger.accountName(l.accountId)}</span>{provisional && <Provisional />}{l.check && <span title={l.check.text} className={l.check.tone === 'ok' ? 'text-ok' : 'text-warn'}><Sparkles size={12} /></span>}</div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {rs.slice(0, 2).map((r) => (
          <button key={r.id} onClick={stop(() => onInvoice(r.id))} title={`${r.supplier}${r.number ? ` · ${r.number}` : ''}`} className="max-w-[11rem] truncate rounded-full bg-ok-soft px-2 py-px text-[11px] font-medium text-ok hover:underline">{r.supplier}{r.number ? ` ${r.number}` : ''}</button>
        ))}
        {rs.length > 2 && <span className="text-[11px] text-muted">+{rs.length - 2}</span>}
        {proposed && <button onClick={stop(() => onInvoice(proposed.id))} title="Vorgeschlagene Rechnung" className="max-w-[11rem] truncate rounded-full border border-dashed border-ok/60 px-2 py-px text-[11px] font-medium text-ok hover:underline">{proposed.supplier}{proposed.number ? ` ${proposed.number}` : ''}?</button>}
        {counter && <button onClick={stop(() => onLine(counter.id))} title="Gegenbuchung öffnen" className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full bg-slate-100 px-2 py-px text-[11px] font-medium text-ink hover:underline"><ArrowLeftRight size={11} />{ledger.accountName(counter.accountId)}</button>}
        {counterAt && <span title="Gegenbuchung schon erfasst" className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-px text-[11px] text-muted"><ArrowLeftRight size={11} />{ledger.accountName(counterAt.accountId)} {dmy(counterAt.date)}</span>}
        {rs.length === 0 && target && (needsProof(l, ledger)
          ? <span className={clsx('rounded-full px-2 py-px text-[11px] font-medium', own === 'gedeckt' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-amber-900')}>{ex ? (ex.own ? `Eigenbeleg ${ex.own.no}` : ex.reason === LATER ? LATER : 'Beleg fehlt') : 'Beleg fehlt'}</span>
          : isInternal(l, ledger) && <span className="rounded-full bg-slate-100 px-2 py-px text-[11px] text-muted">Kein Beleg nötig</span>)}
      </div>

      <div className="min-w-0 text-sm">
        {target ? <div className="truncate" title={ledger.label(target)}>{ledger.label(target)}</div>
          : s ? <div className="flex items-center gap-1.5 text-muted" title={s.why}><Dot c={s.confidence} /><span className="truncate">{ledger.label(s.target)}<span className="text-xs"> · {s.rule ? 'Regel' : confLabel(s.confidence)}</span></span></div>
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

/**
 * [Entwurf] A statement file for an account without bank sync (savings book, a second bank) or as a fallback: pick the account and the file,
 * see what is new, import. Lines that are already there are skipped, never booked twice. The dummy brings two fixed lines.
 */
function ImportStatement({ ledger, account, onClose }: { ledger: Ledger; account: string; onClose: () => void }) {
  const accounts = ledger.accounts.filter((a) => !a.archived && a.kind !== 'bar')
  const [acc, setAcc] = useState(accounts.some((a) => a.id === account) ? account : '')
  const [file, setFile] = useState<PickedFile | null>(null)
  const rows = [
    { date: '2026-10-31', text: 'Habenzinsen 3. Quartal', amount: 18.4 },
    { date: '2026-10-31', text: 'Kontoführung Oktober', amount: -6.9 },
  ]
  const known = 3
  return (
    <Drawer open title="Kontoauszug importieren" onClose={onClose}
      footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!acc || !file} onClick={() => { rows.forEach((r) => ledger.addLine({ accountId: acc, ...r })); ledger.notify(`${rows.length} Umsätze importiert, ${known} schon vorhanden`); onClose() }}>{rows.length} Umsätze importieren</Button></div>}>
      <div className="space-y-4 text-sm">
        <Field label="Konto"><select aria-label="Konto" value={acc} onChange={(e) => setAcc(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Datei (CAMT.053, MT940 oder CSV)"><FilePick file={file} onPick={setFile} /></Field>
        {acc && file && (
          <div className="rounded-xl border border-line">
            <div className="border-b border-line bg-slate-50 px-3 py-1.5 text-xs font-medium text-muted">{rows.length} neu · {known} schon vorhanden, werden übersprungen</div>
            <ul className="divide-y divide-line">
              {rows.map((r) => <li key={r.text} className="flex items-center gap-3 px-3 py-1.5"><span className="w-16 shrink-0 text-xs text-muted">{dmy(r.date)}</span><span className="min-w-0 flex-1 truncate">{r.text}</span><span className={clsx('tabular-nums', r.amount < 0 ? 'text-bad' : 'text-ok')}>{eur(r.amount)}</span></li>)}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  )
}

/**
 * The safe suggestions at a glance: nothing is booked before the list was seen. Untick what does not fit, or change a booking directly
 * ("Ändern" opens it; once it is booked differently it leaves the list). A transfer between own accounts links (or creates) its counter booking.
 */
function BulkConfirm({ items, ledger, onEdit, onClose }: { items: { line: BankLine; target: NonNullable<BankLine['suggestion']>['target'] }[]; ledger: Ledger; onEdit: (lineId: string) => void; onClose: () => void }) {
  const [off, setOff] = useState<string[]>([])
  const picked = items.filter((i) => !off.includes(i.line.id))
  const toggle = (id: string) => setOff(off.includes(id) ? off.filter((x) => x !== id) : [...off, id])
  const confirm = () => {
    const transfers = picked.filter((i) => i.target.kind === 'umbuchung')
    const rest = picked.filter((i) => i.target.kind !== 'umbuchung')
    const linked = new Set<string>()
    for (const i of transfers) {
      if (i.target.kind !== 'umbuchung' || linked.has(i.line.id)) continue
      const counter = counterCandidates(i.line, i.target.accountId, ledger)[0]?.id
      if (counter) linked.add(counter)
      ledger.bookTransferLine(i.line.id, i.target.accountId, counter)
    }
    if (rest.length > 0) ledger.assignMany(rest.map((i) => ({ lineId: i.line.id, target: i.target })))
    onClose()
  }
  return (
    <Drawer open title="Sichere Vorschläge prüfen" onClose={onClose}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={picked.length === 0} onClick={confirm}>{picked.length} von {items.length} bestätigen</Button>}>
      <div className="divide-y divide-line rounded-xl border border-line text-sm">
        {items.map(({ line: l, target }) => (
          <div key={l.id} className={clsx('flex items-center gap-3 px-3 py-2', off.includes(l.id) && 'bg-slate-50 opacity-60')}>
            <input type="checkbox" aria-label={`${l.text} bestätigen`} checked={!off.includes(l.id)} onChange={() => toggle(l.id)} />
            <div className="min-w-0 flex-1"><div className="font-medium leading-snug">{l.text}</div><div className="text-xs text-muted">{dmy(l.date)} · {ledger.label(target)}</div></div>
            <div className={clsx('shrink-0 font-semibold tabular-nums', l.amount < 0 ? 'text-bad' : 'text-ok')}>{eur(l.amount)}</div>
            <Button onClick={() => onEdit(l.id)}>Ändern</Button>
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-muted">Keine sicheren Vorschläge mehr.</p>}
      </div>
    </Drawer>
  )
}
