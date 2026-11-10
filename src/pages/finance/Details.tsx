import { Download, Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { eur, type BankLine, type Receipt, type Split } from '../../data'
import { useSession } from '../../session/session'
import { Badge, Banner, Button, Drawer } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { Assign, SplitsEditor } from './Assign'
import { ExpenseDrawer } from './Expense'
import LineReceipts from './LineReceipts'
import { LinePicker } from './ReceiptDialogs'
import { monthOf, type Ledger } from './ledger'
import { confLabel, Dot, monthLabel, openReceiptFile } from './parts'
import { lineStatus, STATUS } from './status'

/** What the detail pane shows: a booking, an invoice, or the assignment of an open booking. One at a time, so drawers never pile up. */
export type View = { line: string } | { invoice: string } | { assign: string }

/** The one place that opens booking, invoice and assignment. Bookings and invoices lead to each other through `show`. */
export function useDetail(ledger: Ledger) {
  const [view, setView] = useState<View | null>(null)
  const close = () => setView(null)
  let node: ReactNode = null
  if (view && 'invoice' in view) {
    const r = ledger.receipts.find((x) => x.id === view.invoice)
    if (r) node = <InvoiceDrawer key={r.id} receipt={r} ledger={ledger} show={setView} onClose={close} />
  } else if (view) {
    const id = 'line' in view ? view.line : view.assign
    const l = ledger.lines.find((x) => x.id === id)
    if (l) node = 'assign' in view || !ledger.done[l.id] ? <Assign key={l.id} line={l} ledger={ledger} onClose={close} /> : <LineDrawer key={l.id} line={l} ledger={ledger} show={setView} onClose={close} />
  }
  return { show: setView, node }
}

const Head = ({ children }: { children: ReactNode }) => <div className="mb-1.5 text-sm font-semibold">{children}</div>

/**
 * A booking that is booked: its text and cost centers can still change while the period is open, its invoices can be swapped. Once the
 * period is released it is only read.
 */
function LineDrawer({ line, ledger, show, onClose }: { line: BankLine; ledger: Ledger; show: (v: View) => void; onClose: () => void }) {
  const actor = useActor()
  const { guarded } = useSession()
  const target = ledger.done[line.id]
  const locked = ledger.isLocked(line.date)
  const period = ledger.released[monthOf(line.date)]
  const status = lineStatus(line, ledger)
  const [hidden, setHidden] = useState(false)
  const [text, setText] = useState(line.bookingText ?? '')
  const [splits, setSplits] = useState<Split[] | null>(null)
  const editable = target && (target.kind === 'buchung' || target.kind === 'auslage') ? target : undefined
  const cur = editable ? (splits ?? editable.splits) : undefined
  const type = line.amount < 0 ? 'Kosten' : 'Ertrag'
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === type)
  const splitsChanged = !!cur && !!editable && JSON.stringify(cur) !== JSON.stringify(editable.splits)
  const splitsValid = !cur || (cur.reduce((n, s) => n + s.percent, 0) === 100 && cur.every((s) => s.categoryId))
  const changed = text.trim() !== (line.bookingText ?? '') || splitsChanged
  const save = () => { guarded('billing.bank.manage', () => ledger.editLine(line.id, { bookingText: text, splits: splitsChanged ? cur : undefined }, actor)); onClose() }

  return (
    <>
      <Drawer open={!hidden} title="Buchung" size="md" onClose={onClose}
        footer={locked || !changed ? <div className="flex justify-end"><Button onClick={onClose}>Schließen</Button></div> : <div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!splitsValid} onClick={save}>Änderungen speichern</Button></div>}>
        <div className="space-y-5 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="text-xs text-muted">{dmy(line.date)} · {ledger.accountName(line.accountId)}</div><div className="mt-0.5">{line.text}</div></div>
              <div className={`shrink-0 text-lg font-semibold tabular-nums ${line.amount < 0 ? 'text-bad' : 'text-ok'}`}>{eur(line.amount)}</div>
            </div>
            <div className="mt-2"><Badge tone={STATUS[status].tone}>{status === 'gesperrt' && <Lock size={11} className="mr-1" />}{STATUS[status].label}</Badge></div>
          </div>

          {locked && period && <Banner><Lock size={14} className="mr-1.5 inline" />{monthLabel(monthOf(line.date))} ist freigegeben (von {period.by} am {dmy(period.at)}). Die Buchung ist gesperrt.</Banner>}

          <Field label="Buchungstext"><input aria-label="Buchungstext" disabled={locked} value={text} placeholder={line.text} onChange={(e) => setText(e.target.value)} className={`${field} w-full disabled:bg-slate-50`} /></Field>

          <div>
            <Head>Gebucht auf</Head>
            {cur && !locked ? (
              <SplitsEditor type={type} splits={cur} amount={line.amount} ccs={ccs} cats={cats} onChange={setSplits} />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"><Badge>{ledger.kindOf(target!)}</Badge><span className="min-w-0">{ledger.label(target!)}</span></div>
            )}
          </div>

          <LineReceipts line={line} ledger={ledger} locked={locked} booked onInvoice={(id) => show({ invoice: id })} onDialog={setHidden} />

          {line.check && <div className={`rounded-lg px-3 py-2 text-xs ${line.check.tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-amber-900'}`}><b>KI-Abgleich mit dem Bordbuch:</b> {line.check.text}{line.check.lines && <> ({line.check.lines.join('; ')})</>}</div>}

          {(ledger.log[line.id] ?? []).length > 0 && (
            <div>
              <Head>Änderungen</Head>
              <ul className="space-y-1 text-xs text-muted">{ledger.log[line.id].map((e, i) => <li key={i}>{dmy(e.at)} · {e.by}: {e.text}</li>)}</ul>
            </div>
          )}
        </div>
      </Drawer>
    </>
  )
}

/** An invoice: its data and file, where it is coded, and the booking that paid it (or the wait for it). */
function InvoiceDrawer({ receipt: r, ledger, show, onClose }: { receipt: Receipt; ledger: Ledger; show: (v: View) => void; onClose: () => void }) {
  const [picking, setPicking] = useState(false)
  const [expense, setExpense] = useState(false)
  const line = ledger.lines.find((l) => l.id === r.lineId)
  const locked = !!line && ledger.isLocked(line.date)
  const booked = !!line && !!ledger.done[line.id]
  const coding = ledger.codingOfReceipt(r)
  const own = r.splits?.[0]
  const set = (p: Partial<Split>) => ledger.patchReceipt(r.id, { splits: [{ costCenterId: own?.costCenterId ?? '', categoryId: own?.categoryId ?? '', percent: 100, ...p }] })
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const name = (id: string) => ledger.costCenters.find((c) => c.id === id)?.name ?? '?'
  const catName = (id: string) => ledger.categories.find((c) => c.id === id)?.name ?? '?'

  return (
    <>
      <Drawer open={!picking && !expense} title="Rechnung" onClose={onClose} footer={<div className="flex justify-end"><Button onClick={onClose}>Schließen</Button></div>}>
        <div className="space-y-5 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="font-medium">{r.supplier}</div><div className="text-xs text-muted">{r.number ? `Rechnung ${r.number} · ` : ''}{dmy(r.date)} · {r.source}</div></div>
              <div className="shrink-0 text-lg font-semibold tabular-nums">{eur(r.amount)}</div>
            </div>
            <button onClick={() => openReceiptFile(r.name)} className="mt-2 inline-flex items-center gap-1.5 text-brand hover:underline"><Download size={14} /> {r.name}</button>
            {r.note && <div className="mt-1 text-xs text-muted">{r.note}</div>}
          </div>

          <div>
            <Head>Kostenstelle</Head>
            {booked ? (
              coding.length > 0
                ? <ul className="space-y-1">{coding.map((c, i) => <li key={i} className="flex items-center justify-between rounded-lg border border-line px-3 py-2"><span>{name(c.costCenterId)} · {catName(c.categoryId)}</span><span className="tabular-nums text-muted">{eur(c.amount)}</span></li>)}</ul>
                : <div className="rounded-lg border border-line px-3 py-2 text-muted">Die Buchung ist keiner Kostenstelle zugeordnet.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Kostenstelle" value={own?.costCenterId ?? ''} onChange={(e) => set({ costCenterId: e.target.value })} className={field}><option value="">Noch offen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select aria-label="Kostenart" value={own?.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value })} className={field}><option value="">Noch offen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
            )}
          </div>

          <div>
            <Head>Buchung</Head>
            {line ? (
              <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                {locked && <Lock size={14} className="shrink-0 text-muted" />}
                <button onClick={() => show({ line: line.id })} className="min-w-0 flex-1 text-left"><span className="block text-xs text-muted">{dmy(line.date)} · {ledger.accountName(line.accountId)}</span><span className="block truncate hover:text-brand">{line.bookingText ?? line.text}</span></button>
                <span className="font-medium tabular-nums">{eur(line.amount)}</span>
                {!locked && <button onClick={() => ledger.unlinkReceipt(r.id)} className="text-xs text-muted hover:text-ink">Lösen</button>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Badge tone="warn">Abbuchung offen</Badge>{r.suggestion && <span className="flex items-center gap-1.5 text-xs text-muted"><Dot c={r.suggestion.confidence} />{confLabel(r.suggestion.confidence)} · {r.suggestion.why}</span>}</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => setPicking(true)}>{r.suggestion ? 'Bestätigen' : 'Zuordnen'}</Button>
                  {!r.suggestion && r.amount > 0 && <Button onClick={() => { ledger.createCashLine(r.id); onClose() }}>Bar bezahlt (Kassa)</Button>}
                  <Button onClick={() => setExpense(true)}>Privat bezahlt (Auslage)</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Drawer>
      <LinePicker receipt={picking ? r : null} ledger={ledger} onClose={() => setPicking(false)} />
      {expense && <ExpenseDrawer ledger={ledger} from={r} onClose={() => setExpense(false)} />}
    </>
  )
}
