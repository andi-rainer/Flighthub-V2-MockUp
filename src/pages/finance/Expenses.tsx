import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AUSLAGE_ID, eur, members, type BankLine } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp } from '../../state'
import { useSession } from '../../session/session'
import { Badge, Button, Card, Drawer, Segmented, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { captureOf, captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { useDetail } from './Details'
import { ExpenseDrawer } from './Expense'
import { edgeOf, GapsText } from './Journal'
import { type ExpenseRequest, type Ledger } from './ledger'
import { openReceiptFile, perLiter } from './parts'
import { OwnReceiptDoc } from './ReceiptDialogs'
import { gapsOf, receiptsOf } from './status'

const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?'
type View = 'pruefung' | 'gebucht' | 'abgelehnt'
const COLS = 'md:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_6.5rem_8.5rem]'
const chip = 'max-w-[11rem] truncate rounded-full px-2 py-px text-[11px] font-medium hover:underline'
/** The text of a credited Auslage without the "Auslage Name:" the booking carries. */
const whatOf = (l: BankLine) => l.bookingText ?? l.text.replace(/^Auslage [^:]+: /, '')

/**
 * [Entwurf] Auslagen: what members paid privately for the club, apart from the bookings of the money accounts. "Zur Prüfung": handed in,
 * nothing booked or credited yet, fuel included. "Gebucht": credited to the Betriebskonto and booked on cost centers exactly as if the club
 * had paid itself, so the cost figures stay right; the invoice is linked and listed under Rechnungen like any other. "Abgelehnt" with the
 * reason the member sees.
 */
export default function Auslagen({ ledger, line }: { ledger: Ledger; line?: string }) {
  const { can } = useApp()
  const mayReview = can('billing.bank.manage')
  const [params, setParams] = useSearchParams()
  const pending = ledger.expenses.filter((x) => x.status === 'offen')
  const turnedDown = ledger.expenses.filter((x) => x.status === 'abgelehnt')
  const booked = ledger.lines.filter((l) => l.accountId === AUSLAGE_ID).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const view = (params.get('ansicht') as View) || (pending.length ? 'pruefung' : 'gebucht')
  const setView = (v: View) => setParams((p) => { const n = new URLSearchParams(p); n.set('ansicht', v); n.delete('line'); return n }, { replace: true })
  const [open, setOpen] = useState<ExpenseRequest | null>(null)
  const [creating, setCreating] = useState(false)
  const { show, node } = useDetail(ledger)
  // A link to one Auslage (from a Betriebskonto) opens it once.
  useEffect(() => { if (line) show({ line }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const requests = view === 'abgelehnt' ? turnedDown : pending
  const reqPaging = usePaging(requests, view)
  const bookPaging = usePaging(booked, view)
  const amountOf = (x: ExpenseRequest) => ledger.receipts.find((r) => r.id === x.receiptId)?.amount ?? x.own?.doc.amount ?? 0
  const total = view === 'gebucht' ? -booked.reduce((n, l) => n + l.amount, 0) : requests.reduce((n, x) => n + amountOf(x), 0)
  const count = view === 'gebucht' ? booked.length : requests.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<View> value={view} onChange={setView} options={[
          { value: 'pruefung', label: `Zur Prüfung (${pending.length})` },
          { value: 'gebucht', label: `Gebucht (${booked.length})` },
          ...(turnedDown.length ? [{ value: 'abgelehnt' as View, label: `Abgelehnt (${turnedDown.length})` }] : []),
        ]} />
        <Button onClick={() => setCreating(true)}>Auslage erfassen</Button>
      </div>

      <Card className="overflow-hidden">
        <div className={clsx('hidden gap-x-3 border-b border-line bg-slate-50 px-3 py-2 pl-[calc(0.75rem+3px)] text-xs font-medium uppercase tracking-wide text-muted md:grid', COLS)}>
          <span>{view === 'gebucht' ? 'Datum' : 'Eingereicht'}</span><span>Mitglied</span><span>Was</span><span>Rechnung</span><span>{view === 'abgelehnt' ? 'Grund' : 'Kostenstelle · Kostenart'}</span><span className="text-right">Betrag</span><span>Status</span>
        </div>
        <div className="divide-y divide-line">
          {view === 'gebucht' ? bookPaging.rows.map((l) => {
            const t = ledger.done[l.id]
            const rs = receiptsOf(l, ledger)
            const own = ledger.exempt[l.id]?.own
            const locked = ledger.isLocked(l.date)
            const coding = ledger.codingOfLine(l).map((c) => `${ledger.costCenters.find((x) => x.id === c.costCenterId)?.name ?? '?'} · ${ledger.categories.find((x) => x.id === c.categoryId)?.name ?? '?'}`).join(', ')
            return (
              <div key={l.id} role="button" tabIndex={0} onClick={() => show({ line: l.id })} onKeyDown={(e) => e.key === 'Enter' && show({ line: l.id })} className={clsx('grid cursor-pointer gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-slate-50 md:items-center', COLS, edgeOf(gapsOf(l, ledger), locked))}>
                <div className="text-xs text-muted">{dmy(l.date)}</div>
                <div className="truncate font-medium">{t?.kind === 'auslage' ? nameOf(t.memberId) : '?'}</div>
                <div className="truncate">{whatOf(l)}</div>
                <div className="flex min-w-0 flex-wrap gap-1">
                  {rs.map((r) => <button key={r.id} onClick={(e) => { e.stopPropagation(); show({ invoice: r.id }) }} className={clsx(chip, 'bg-ok-soft text-ok')}>{r.supplier}{r.number ? ` ${r.number}` : ''}</button>)}
                  {rs.length === 0 && own && <span className={clsx(chip, 'bg-ok-soft text-ok hover:no-underline')}>Eigenbeleg {own.no}</span>}
                </div>
                <div className="truncate" title={coding}>{coding}</div>
                <div className="font-semibold tabular-nums md:text-right">{eur(-l.amount)}</div>
                <div className="min-w-0"><GapsText gaps={gapsOf(l, ledger)} locked={locked} /></div>
              </div>
            )
          }) : reqPaging.rows.map((x) => {
            const r = ledger.receipts.find((y) => y.id === x.receiptId)
            const pendingRow = x.status === 'offen'
            const canOpen = pendingRow && mayReview
            return (
              <div key={x.id} role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined} onClick={canOpen ? () => setOpen(x) : undefined} onKeyDown={canOpen ? (e) => e.key === 'Enter' && setOpen(x) : undefined}
                className={clsx('grid gap-x-3 gap-y-1 border-l-[3px] px-3 py-2 text-sm md:items-center', COLS, pendingRow ? 'border-l-amber-400' : 'border-l-transparent', canOpen && 'cursor-pointer hover:bg-slate-50')}>
                <div className="text-xs text-muted">{dmy(x.submitted)}</div>
                <div className="truncate font-medium">{nameOf(x.memberId)}</div>
                <div className="min-w-0"><div className="truncate">{x.description}</div><div className="truncate text-xs text-muted">{x.origin}{r?.fuel ? ` · ${r.fuel.liters} L · ${perLiter(r.fuel.perLiter)}` : ''}</div></div>
                <div className="flex min-w-0 flex-wrap gap-1">
                  {r && <button onClick={(e) => { e.stopPropagation(); show({ invoice: r.id }) }} className={clsx(chip, 'bg-slate-100 text-ink')}>{r.supplier}{r.number ? ` ${r.number}` : ''}</button>}
                  {x.own && <span className={clsx(chip, 'bg-slate-100 text-ink hover:no-underline')}>Eigenbeleg {x.own.doc.no}</span>}
                </div>
                <div className="truncate text-muted">{pendingRow ? (x.suggested ? `Vorschlag: ${ledger.costCenters.find((c) => c.id === x.suggested!.costCenterId)?.name ?? '?'}` : 'bei der Prüfung') : x.rejectReason}</div>
                <div className="font-semibold tabular-nums md:text-right">{eur(amountOf(x))}</div>
                <div>{pendingRow ? (mayReview ? <Button onClick={(e) => { e.stopPropagation(); setOpen(x) }}>Prüfen</Button> : <span className="text-xs font-medium text-amber-900">Wartet auf Prüfung</span>) : <span className="text-xs text-muted">Abgelehnt{x.decidedBy ? ` von ${x.decidedBy}` : ''}</span>}</div>
              </div>
            )
          })}
          {count === 0 && <p className="p-6 text-center text-sm text-muted">{view === 'pruefung' ? 'Keine Auslagen zur Prüfung.' : view === 'gebucht' ? 'Noch keine Auslagen gebucht.' : 'Keine abgelehnten Auslagen.'}</p>}
        </div>
        {count > 10 && (view === 'gebucht' ? bookPaging.bar : reqPaging.bar)}
        <div className="flex flex-wrap items-center justify-end gap-x-5 border-t border-line bg-slate-50 px-4 py-2 text-xs text-muted">
          <span>{count} Auslagen</span><span>Summe <b className="tabular-nums text-ink">{eur(total)}</b></span>
        </div>
      </Card>

      {open && <Review key={open.id} request={open} ledger={ledger} onClose={() => setOpen(null)} />}
      {creating && <ExpenseDrawer ledger={ledger} onClose={() => setCreating(false)} />}
      {node}
    </div>
  )
}

/**
 * The check: the numbers as read (correct them if needed), where it is booked, then credit it or send it back with a reason. Without a
 * receipt the Eigenbeleg signed by the member is shown; [Entwurf] who may countersign does it with the credit.
 */
function Review({ request: x, ledger, onClose }: { request: ExpenseRequest; ledger: Ledger; onClose: () => void }) {
  const { guarded } = useSession()
  const actor = useActor()
  const r = ledger.receipts.find((y) => y.id === x.receiptId)
  const own = x.own
  const { hasAccount, can } = useApp()
  const countersign = !!own && can('billing.receipts.countersign') && (own.doc.first?.by ?? nameOf(x.memberId)) !== actor
  const [member, setMember] = useState(x.memberId)
  const [text, setText] = useState(x.description)
  const [cap, setCap] = useState<Captured>(r ? captureOf(r) : { ...EMPTY_CAPTURE, file: own?.doc.file ?? '', supplier: own?.doc.payee ?? '', date: own?.doc.date ?? EMPTY_CAPTURE.date, total: String(own?.doc.amount ?? '').replace('.', ',') })
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const [cc, setCc] = useState(x.suggested?.costCenterId ?? '')
  const [cat, setCat] = useState(x.suggested?.categoryId ?? '')
  const [rejecting, setRejecting] = useState(false)
  const [why, setWhy] = useState('')
  const fuel = cat === 'k-fuel'
  const problem = (own ? null : captureProblem(cap, fuel)) ?? (!member ? 'Mitglied wählen.' : !cc || !cat ? 'Kostenstelle und Kostenart wählen.' : null)
  const total = own ? own.doc.amount : Number(cap.total.replace(',', '.')) || 0
  const receipt = own ? { file: own.doc.file, supplier: own.doc.payee, number: '', date: own.doc.date, amount: own.doc.amount } : toNewReceipt(cap, fuel, { source: r?.source })
  const approve = () => { guarded('billing.bank.manage', () => ledger.approveExpense(x.id, { memberId: member, receipt, splits: [{ costCenterId: cc, categoryId: cat, percent: 100 }], text, countersign }, actor)); onClose() }
  const reject = () => { guarded('billing.bank.manage', () => ledger.rejectExpense(x.id, why.trim(), actor)); onClose() }
  return (
    <Drawer open title={`Auslage von ${nameOf(x.memberId)}`} onClose={onClose}
      footer={rejecting
        ? <div className="flex gap-2"><Button onClick={() => setRejecting(false)}>Zurück</Button><Button variant="danger" className="flex-1" disabled={!why.trim()} onClick={reject}>Ablehnen</Button></div>
        : <div className="flex gap-2"><Button onClick={() => setRejecting(true)}>Ablehnen</Button><Button variant="primary" size="lg" className="flex-1" disabled={!!problem} onClick={approve}>{problem ? 'Gutschreiben' : `${countersign ? 'Gegenzeichnen und ' : ''}${eur(total)} gutschreiben`}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{x.description}</div><div className="text-xs text-muted">{dmy(x.submitted)} · {x.origin}{r && <> · <button onClick={() => openReceiptFile(r.name)} className="text-brand hover:underline">{r.name}</button></>}</div></div>
        {rejecting ? (
          <Field label="Grund für die Ablehnung (das Mitglied sieht ihn)"><input autoFocus aria-label="Grund" value={why} onChange={(e) => setWhy(e.target.value)} className={`${field} h-11 w-full`} /></Field>
        ) : (
          <>
            <div className="block">Gutschrift für
              <MemberPicker ariaLabel="Mitglied" className="mt-1" value={member || undefined} allow={(m) => hasAccount(m.id)} onChange={(id) => setMember(id ?? '')} />
              {member !== x.memberId && member && <p className="mt-1 text-xs text-warn">Eingereicht von {nameOf(x.memberId)}. Die Gutschrift geht an {nameOf(member)}.</p>}
            </div>
            <Field label="Buchungstext"><input aria-label="Buchungstext" value={text} onChange={(e) => setText(e.target.value)} className={`${field} h-11 w-full`} /></Field>
            {own ? <OwnReceiptDoc own={own.doc} reason={own.reason} by={nameOf(x.memberId)} /> : <ReceiptCapture value={cap} onChange={setCap} fuel={fuel} />}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kostenstelle"><select aria-label="Kostenstelle" value={cc} onChange={(e) => setCc(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Kostenart"><select aria-label="Kostenart" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </div>
            {problem && cap.total && <p className="text-warn">{problem}</p>}
          </>
        )}
      </div>
    </Drawer>
  )
}
