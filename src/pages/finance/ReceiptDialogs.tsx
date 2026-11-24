import clsx from 'clsx'
import { AlertTriangle, FilePlus2, X } from 'lucide-react'
import { useState } from 'react'
import { eur, type BankLine, type Receipt } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp, TODAY_ISO } from '../../state'
import { useSession } from '../../session/session'
import { Badge, Button, Drawer, Segmented, useConfirm } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { DIFF_LABEL, dmOf, NO_RECEIPT_REASONS, ROUND_LIMIT, type Ledger, type LineDiff, type NoReceipt, type OwnReceipt, type OwnSignature } from './ledger'
import { diffCents, firstSignerOf, LATER, receiptTarget, shareOf, STATEMENT } from './status'
import { Dot, openReceiptFile } from './parts'
import { useSuppliers } from './supplierStore'

/** `ausgang`: the club's own document for money in (Ausgangsrechnung, Beitragsvorschreibung, payout report of the shop). */
type Kind = 'rechnung' | 'gutschrift' | 'ausgang'
type Paid = '' | 'bank' | 'kassa' | 'privat'
const num = (v: string) => Number(v.replace(',', '.')) || 0

/** Invoices that look like the same one: same supplier and number, or same supplier, amount and date. */
export function duplicatesOf(ledger: Ledger, c: { supplier: string; number: string; date: string; total: string }): Receipt[] {
  const s = c.supplier.trim().toLowerCase()
  const amount = num(c.total)
  if (!s || amount <= 0) return []
  return ledger.receipts.filter((r) => r.supplier.toLowerCase() === s && ((!!c.number.trim() && r.number === c.number.trim()) || (Math.abs(r.amount) === amount && r.date === c.date)))
}

/**
 * Create a receipt: the file (the supplier's invoice) AND its data, which stays searchable and bookable on its own. Without a booking it
 * also says how it is paid: the debit follows (with Zahlungsziel), cash from the Kassa (receipt and Kassa line in one step) or privately
 * by a member (an Auslage, credited at once). A Gutschrift is a negative invoice. A possible duplicate must be confirmed.
 */
export function ReceiptForm({ line, ledger, onClose, start, onSaved, remaining, onCreated }: {
  line?: BankLine; ledger: Ledger; onClose: () => void
  /** Prefilled data: a file from the inbox, or the supplier of an expected invoice. */ start?: Partial<Captured>
  onSaved?: () => void
  /** From the receipts picker of `line`: the receipt amount still open there (negative: a credit note is missing). */ remaining?: number
  /** Set by the receipts picker: the receipt is created WITHOUT a link, the picker selects it and links it only when the sum is exact. */
  onCreated?: (id: string) => void
}) {
  const { hasAccount } = useApp()
  const sup = useSuppliers()
  const have = line ? ledger.receipts.filter((r) => r.lineId === line.id).reduce((n, r) => n + Math.abs(r.amount), 0) : 0
  const rest = remaining !== undefined ? Math.abs(remaining) : line ? Math.max(0, Math.round((Math.abs(line.amount) - have) * 100) / 100) : 0
  // Money that came in is backed by the club's own document, rarely by a supplier's credit note.
  const moneyIn = !!onCreated && !!line && line.amount > 0
  const [kind, setKind] = useState<Kind>(moneyIn ? 'ausgang' : remaining !== undefined && remaining < 0 ? 'gutschrift' : 'rechnung')
  const [cap, setCapState] = useState<Captured>({ ...EMPTY_CAPTURE, ...(rest ? { total: String(rest).replace('.', ',') } : {}), ...start })
  const known = sup.byName(start?.supplier ?? '')
  const [cc, setCc] = useState(known?.costCenterId ?? '')
  const [cat, setCat] = useState(known?.categoryId ?? '')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [paid, setPaid] = useState<Paid>('')
  const cashBoxes = ledger.accounts.filter((a) => a.kind === 'bar' && !a.archived)
  const [cashId, setCashId] = useState(cashBoxes[0]?.id ?? '')
  const [member, setMember] = useState('')
  const [notDup, setNotDup] = useState(false)
  const setCap = (c: Captured) => {
    // The reading of a file for a booking: the amount of the booking stays (the dummy reads a random sum).
    const next = line && c.read && rest ? { ...c, total: String(rest).replace('.', ',') } : c
    setCapState(next)
    const s = sup.byName(next.supplier)
    if (s && !cc && !cat) { setCc(s.costCenterId ?? ''); setCat(s.categoryId ?? '') }
    setNotDup(false)
  }
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const fuel = cat === 'k-fuel'
  const credit = kind === 'gutschrift'
  const dups = duplicatesOf(ledger, cap)
  const needsCoding = paid === 'kassa' || paid === 'privat'
  const problem = captureProblem(cap, fuel)
    ?? (!line && !paid ? 'Wie wird bezahlt?' : null)
    ?? (needsCoding && (!cc || !cat) ? 'Kostenstelle und Kostenart wählen.' : null)
    ?? (paid === 'kassa' && !cashId ? 'Kassa wählen.' : null)
    ?? (paid === 'privat' && !member ? 'Mitglied wählen, das bezahlt hat.' : null)
    ?? (dups.length > 0 && !notDup ? 'Mögliches Duplikat prüfen.' : null)
  const total = num(cap.total)
  const splits = cc && cat ? [{ costCenterId: cc, categoryId: cat, percent: 100 }] : undefined

  const save = () => {
    const base = toNewReceipt(cap, fuel, { note: note.trim() || undefined, source: start?.file ? 'E-Mail' : 'Upload' })
    const amount = credit ? -base.amount : base.amount
    if (paid === 'privat') ledger.bookExpense({ memberId: member, receipt: base, splits: splits!, text: note.trim() || undefined })
    else {
      const id = ledger.createReceipt({ ...base, amount, outgoing: kind === 'ausgang' || undefined, lineId: onCreated ? undefined : line?.id, splits: line ? undefined : splits, due: paid === 'bank' ? due || undefined : undefined, cashAccountId: paid === 'kassa' ? cashId : undefined })
      onCreated?.(id)
    }
    onSaved?.()
    onClose()
  }
  const payLabel = credit
    ? [{ value: 'bank' as Paid, label: 'Gutschrift folgt aufs Konto' }, { value: 'kassa' as Paid, label: 'Bar erhalten (Kassa)' }]
    : [{ value: 'bank' as Paid, label: 'Abbuchung oder Überweisung folgt' }, { value: 'kassa' as Paid, label: 'Bar aus der Kassa' }, { value: 'privat' as Paid, label: 'Privat ausgelegt' }]

  return (
    <Drawer open title={credit ? 'Gutschrift erstellen' : kind === 'ausgang' ? 'Ausgangsbeleg erfassen' : 'Beleg erstellen'} onClose={onClose}
      footer={<div className="flex items-center justify-end gap-2">{problem && cap.file && <span className="mr-auto text-xs text-warn">{problem}</span>}<Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!!problem} onClick={save}>{paid === 'kassa' ? `Erstellen und ${eur(credit ? total : -total)} in der Kassa buchen` : paid === 'privat' ? 'Erstellen und gutschreiben' : credit ? 'Gutschrift erstellen' : 'Beleg erstellen'}</Button></div>}>
      <div className="space-y-4 text-sm">
        {line && <div className="rounded-xl bg-slate-50 p-3"><div>{line.text}</div><div className="font-semibold tabular-nums">{eur(line.amount)}</div></div>}
        {(!line || onCreated) && <Segmented<Kind> value={kind} onChange={(k) => { setKind(k); setPaid('') }} options={moneyIn ? [{ value: 'ausgang', label: 'Eigener Ausgangsbeleg' }, { value: 'gutschrift', label: 'Gutschrift eines Lieferanten' }] : [{ value: 'rechnung', label: 'Rechnung' }, { value: 'gutschrift', label: 'Gutschrift' }]} />}
        <ReceiptCapture value={cap} onChange={setCap} fuel={fuel} suppliers={sup.list.map((s) => s.name)} />
        {dups.length > 0 && (
          <div className="space-y-2 rounded-xl border-2 border-warn bg-warn-soft p-3 text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={15} /> Diese Rechnung gibt es vielleicht schon</div>
            {dups.map((r) => <button key={r.id} onClick={() => openReceiptFile(r.name)} className="block text-left hover:underline">{r.supplier}{r.number ? ` · ${r.number}` : ''} · {dmy(r.date)} · {eur(r.amount)}{r.lineId ? ' · bezahlt' : ''}</button>)}
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={notDup} onChange={(e) => setNotDup(e.target.checked)} />Kein Duplikat, trotzdem erstellen</label>
          </div>
        )}
        {cap.file && (
          <>
            {!line && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={needsCoding ? 'Kostenstelle' : 'Kostenstelle (optional)'}><select aria-label="Kostenstelle" value={cc} onChange={(e) => setCc(e.target.value)} className={`${field} w-full`}><option value="">{needsCoding ? 'Bitte wählen' : 'Noch offen'}</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label={needsCoding ? 'Kostenart' : 'Kostenart (optional)'}><select aria-label="Kostenart" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-full`}><option value="">{needsCoding ? 'Bitte wählen' : 'Noch offen'}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              </div>
            )}
            {!line && (
              <div className="space-y-2">
                <div className="font-medium">Wie wird bezahlt?</div>
                <div className="flex flex-wrap gap-2">{payLabel.map((o) => <button key={o.value} onClick={() => setPaid(o.value)} className={clsx('rounded-lg border px-3 py-2', paid === o.value ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{o.label}</button>)}</div>
                {paid === 'bank' && <Field label="Zahlungsziel (optional)"><input type="date" aria-label="Zahlungsziel" min={cap.date} value={due} onChange={(e) => setDue(e.target.value)} className={`${field} w-48`} /></Field>}
                {paid === 'kassa' && cashBoxes.length > 1 && <Field label="Aus welcher Kasse?"><select aria-label="Kasse" value={cashId} onChange={(e) => setCashId(e.target.value)} className={`${field} w-full`}>{cashBoxes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
                {paid === 'privat' && <MemberPicker ariaLabel="Bezahlt von" placeholder="Wer hat bezahlt?" value={member || undefined} allow={(m) => hasAccount(m.id)} onChange={(id) => setMember(id ?? '')} />}
              </div>
            )}
            <Field label="Hinweis (optional)"><input aria-label="Hinweis" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} w-full`} /></Field>
          </>
        )}
      </div>
    </Drawer>
  )
}

/** [Entwurf] Time of a signature, "14:32". */
export const nowTime = () => new Date().toTimeString().slice(0, 5)
const signed = (x?: OwnSignature) => (x ? `${x.by}, ${x.at}${x.time ? ` ${x.time}` : ''}` : '–')

/** Next number of an Eigenbeleg in the year of `iso` (bookings and Auslagen still waiting for the treasurer). */
export function nextOwnNo(ledger: Ledger, iso: string) {
  const y = iso.slice(0, 4)
  const n = Object.values(ledger.exempt).filter((e) => e.own?.no.startsWith(`EB-${y}`)).length + ledger.expenses.filter((x) => x.own && x.status === 'offen' && x.own.doc.no.startsWith(`EB-${y}`)).length + 1
  return `EB-${y}-${String(n).padStart(3, '0')}`
}

/** Who may countersign this Eigenbeleg now: the permission, and never the person who signed first. */
export function useCountersign() {
  const { can } = useApp()
  const actor = useActor()
  return (ex: NoReceipt | undefined) => !!ex?.own && !ex.own.second && can('billing.receipts.countersign') && firstSignerOf(ex) !== actor
}

/** The Eigenbeleg as a document: what the auditor sees instead of the supplier's invoice, with both signatures. */
export function OwnReceiptDoc({ own, reason, by, at }: { own: OwnReceipt; reason: string; /** First signer of older ones. */ by: string; at?: string }) {
  const first = own.first ?? { by, at: at ?? '' }
  return (
    <div className="rounded-lg border border-line bg-white p-4 font-serif text-[13px] text-ink shadow-sm">
      <div className="flex items-start justify-between border-b border-line pb-2"><div className="text-base font-semibold">Eigenbeleg</div><div className="text-right text-xs"><div className="font-semibold">{own.no}</div><div>{dmy(own.date)}</div></div></div>
      <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1">
        <dt className="text-muted">Betrag</dt><dd className="font-semibold tabular-nums">{eur(own.amount)}</dd>
        <dt className="text-muted">Empfänger</dt><dd>{own.payee || '–'}</dd>
        <dt className="text-muted">Zweck</dt><dd>{own.purpose || '–'}</dd>
        <dt className="text-muted">Kein Originalbeleg</dt><dd>{reason || '–'}</dd>
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="border-t border-line pt-1"><div className="text-muted">1. Unterschrift</div><div className="font-sans font-medium">{signed(first)}</div></div>
        <div className="border-t border-line pt-1"><div className="text-muted">2. Unterschrift (Kassier oder Obmann)</div><div className={clsx('font-sans font-medium', !own.second && 'text-warn')}>{own.second ? signed(own.second) : 'fehlt'}</div></div>
      </div>
    </div>
  )
}

/** Payee, purpose and the reason of an Eigenbeleg: shared by the booking and the Auslage without receipt. */
export function OwnFields({ reasons, reason, onReason, other, onOther, payee, onPayee, purpose, onPurpose }: {
  reasons: readonly string[]; reason: string; onReason: (r: string) => void; other: string; onOther: (s: string) => void
  payee: string; onPayee: (s: string) => void; purpose: string; onPurpose: (s: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="font-medium">Warum gibt es keinen Beleg?</div>
      <div className="flex flex-wrap gap-2">{reasons.map((r) => <button key={r} onClick={() => onReason(r)} className={clsx('rounded-lg border px-3 py-2', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
      {reason === 'Sonstiges' && <input aria-label="Grund" value={other} onChange={(e) => onOther(e.target.value)} placeholder="Grund kurz beschreiben" className={`${field} w-full`} />}
      {reason && reason !== LATER && reason !== STATEMENT && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empfänger (wer bekam das Geld)"><input aria-label="Empfänger" value={payee} onChange={(e) => onPayee(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Zweck"><input aria-label="Zweck" value={purpose} onChange={(e) => onPurpose(e.target.value)} className={`${field} w-full`} /></Field>
        </div>
      )}
    </div>
  )
}

/**
 * Kein Beleg: one way, the Eigenbeleg. The reason, who got the money and what for; the person creating it signs first, Kassier or Obmann
 * countersign. "Beleg kommt später" is a reminder without Eigenbeleg (stays open); "Kontoauszug genügt" (interest, fees, donations) makes the
 * bank statement the document, no Eigenbeleg. `ownOnly`: a reminder or an older exception exists.
 */
export function NoReceiptForm({ line, ledger, onClose, ownOnly }: { line: BankLine; ledger: Ledger; onClose: () => void; ownOnly?: boolean }) {
  const actor = useActor()
  const { guarded } = useSession()
  const ex = ledger.exempt[line.id]
  const reasons = ownOnly ? NO_RECEIPT_REASONS.filter((r) => r !== LATER) : NO_RECEIPT_REASONS
  const known = ex && ex.reason !== LATER ? ((NO_RECEIPT_REASONS as readonly string[]).includes(ex.reason) ? ex.reason : 'Sonstiges') : ''
  const [reason, setReason] = useState(known)
  const [other, setOther] = useState(known === 'Sonstiges' ? ex?.reason ?? '' : '')
  const [payee, setPayee] = useState('')
  const [purpose, setPurpose] = useState(line.bookingText ?? line.text)
  const [sure, setSure] = useState(false)
  const text = reason === 'Sonstiges' ? other.trim() : reason
  const later = reason === LATER
  const statement = reason === STATEMENT
  const no = nextOwnNo(ledger, line.date)
  const doc: OwnReceipt = { no, payee: payee.trim(), purpose: purpose.trim(), date: line.date, amount: Math.abs(line.amount), file: `${no}.pdf`, needsSecond: true, first: { by: actor, at: dmOf(TODAY_ISO), time: nowTime() } }
  const ok = !!text && (later || statement || (!!doc.payee && !!doc.purpose && sure))
  const save = () => {
    if (later || statement) ledger.markNoReceipt(line.id, text, actor)
    else guarded('billing.bank.manage', () => ledger.markOwnReceipt(line.id, text, actor, doc))
    onClose()
  }
  return (
    <Drawer open title={ownOnly ? 'Eigenbeleg erstellen' : 'Kein Beleg'} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!ok} onClick={save}>{later ? 'Erinnerung vermerken' : statement ? 'Kontoauszug als Beleg vermerken' : 'Unterschreiben und erstellen'}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">{dmy(line.date)} · {ledger.accountName(line.accountId)}</div><div>{line.text}</div><div className="font-semibold tabular-nums">{eur(line.amount)}</div></div>
        <OwnFields reasons={reasons} reason={reason} onReason={setReason} other={other} onOther={setOther} payee={payee} onPayee={setPayee} purpose={purpose} onPurpose={setPurpose} />
        {text && !later && !statement && (
          <>
            <OwnReceiptDoc own={doc} reason={text} by={actor} />
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich unterschreibe den Eigenbeleg als {actor}.</label>
          </>
        )}
      </div>
    </Drawer>
  )
}

/** The second signature of an Eigenbeleg: Kassier or Obmann, never the person who signed first. Only then does it cover the booking. */
export function SecondSignForm({ line, ledger, onClose }: { line: BankLine; ledger: Ledger; onClose: () => void }) {
  const ex = ledger.exempt[line.id]
  const actor = useActor()
  const { guarded } = useSession()
  const may = useCountersign()(ex)
  const [sure, setSure] = useState(false)
  if (!ex?.own) return null
  const save = () => { guarded('billing.receipts.countersign', () => ledger.signOwnReceipt(line.id, actor, nowTime())); onClose() }
  return (
    <Drawer open title={`Eigenbeleg ${ex.own.no} gegenzeichnen`} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!may || !sure} onClick={save}>Gegenzeichnen</Button></div>}>
      <div className="space-y-4 text-sm">
        <OwnReceiptDoc own={ex.own} reason={ex.reason} by={ex.by} at={ex.at} />
        {may
          ? <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich habe den Eigenbeleg geprüft und unterschreibe als {actor}.</label>
          : <p className="text-warn">{firstSignerOf(ex) === actor ? 'Die erste Unterschrift ist von dir.' : 'Kein Recht zum Gegenzeichnen.'}</p>}
      </div>
    </Drawer>
  )
}

const recLabel = (r: Receipt) => `${r.supplier}${r.number ? ` · ${r.number}` : ''}`

/**
 * The receipts of one booking, chosen together: saved only when their sum covers the amount exactly (a credit note reduces it), or all
 * removed at once. A new receipt is captured here without a link and joins the selection. `preselect`: chosen in addition (from an invoice).
 */
export function ReceiptPicker({ line, ...rest }: { line: BankLine | null; ledger: Ledger; onClose: () => void; preselect?: string[]; onSaved?: () => void }) {
  // Keyed by the booking: the selection starts fresh from what is linked whenever the picker opens.
  return line ? <ReceiptSelect key={line.id} line={line} {...rest} /> : null
}

function ReceiptSelect({ line, ledger, onClose, preselect = [], onSaved }: { line: BankLine; ledger: Ledger; onClose: () => void; preselect?: string[]; onSaved?: () => void }) {
  const cf = useConfirm()
  const actor = useActor()
  const linked = ledger.receipts.filter((r) => r.lineId === line.id)
  const [sel, setSel] = useState<string[]>(() => [...new Set([...linked.map((r) => r.id), ...preselect])])
  const [created, setCreated] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const ro = ledger.isLocked(line.date)
  const out = line.amount < 0
  // Own documents of the assignment (voucher, Betriebskonto) cover their part already; the receipts cover the rest exactly.
  const want = receiptTarget(line, ledger)
  const [diffs, setDiffs] = useState<LineDiff[]>(() => ledger.diffs[line.id] ?? [])
  const rest = want - ledger.receipts.filter((r) => sel.includes(r.id)).reduce((n, r) => n + shareOf(line, r), 0) - diffs.reduce((n, d) => n + Math.round(d.amount * 100), 0)
  const hay = `${line.bookingText ?? ''} ${line.text}`.toLowerCase()
  const named = (r: Receipt) => (!!r.number && hay.includes(r.number.toLowerCase())) || r.supplier.toLowerCase().split(/[\s,.–-]+/).some((w) => w.length > 3 && hay.includes(w))
  const pool = ro ? linked : ledger.receipts.filter((r) => sel.includes(r.id) || r.lineId === line.id || (!r.lineId && !ledger.expenseOf(r.id) && (out ? !r.outgoing : r.amount < 0 || r.outgoing || r.suggestion?.lineId === line.id)))
  // Order does not change while ticking: linked, new, suggested for this booking, same amount, named in the booking text, newest.
  const rank = (r: Receipt) => [r.lineId === line.id, created.includes(r.id), r.suggestion?.lineId === line.id, Math.abs(Math.round(r.amount * 100)) === want, named(r)]
  const sorted = [...pool].sort((a, b) => { const x = rank(a), y = rank(b); const i = x.findIndex((v, k) => v !== y[k]); return i >= 0 ? Number(y[i]) - Number(x[i]) : b.date.localeCompare(a.date) })
  const needle = q.trim().toLowerCase()
  const shown = needle ? sorted.filter((r) => sel.includes(r.id) || `${r.supplier} ${r.number ?? ''} ${eur(r.amount)} ${r.amount}`.toLowerCase().includes(needle)) : sorted
  const same = sel.length === linked.length && linked.every((r) => sel.includes(r.id)) && JSON.stringify(diffs) === JSON.stringify(ledger.diffs[line.id] ?? [])
  const clearing = sel.length === 0 && linked.length > 0
  const ok = !ro && !same && (clearing || (sel.length > 0 && rest === 0))
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const save = () => {
    const removed = linked.filter((r) => !sel.includes(r.id))
    const run = () => { ledger.setLineReceipts(line.id, sel, actor, diffs); onSaved?.(); onClose() }
    if (removed.length === 0) return run()
    cf.ask({ title: removed.length === 1 ? 'Rechnung lösen?' : `${removed.length} Rechnungen lösen?`, lines: [...removed.map((r) => `${recLabel(r)}: ${eur(r.amount)}`), `von der Buchung „${line.bookingText ?? line.text}“ vom ${dmy(line.date)}`], confirm: 'Lösen', run })
  }
  const covered = rest === 0 && sel.length > 0

  return (
    <>
      {creating
        ? <ReceiptForm line={line} ledger={ledger} remaining={(rest / 100) * (out ? 1 : -1)} onCreated={(id) => { setSel((s) => [...s, id]); setCreated((c) => [...c, id]) }} onClose={() => setCreating(false)} />
        : (
          <Drawer open title="Belege der Buchung" onClose={onClose}
            footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>{ro ? 'Schließen' : 'Abbrechen'}</Button>{!ro && <Button variant="primary" disabled={!ok} onClick={save}>{clearing ? (linked.length === 1 ? 'Rechnung lösen' : 'Rechnungen lösen') : 'Belege speichern'}</Button>}</div>}>
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-muted">{dmy(line.date)} · {ledger.accountName(line.accountId)}</div><div className="text-sm">{line.bookingText ?? line.text}</div><div className="text-xl font-semibold tabular-nums">{eur(line.amount)}</div></div>
              {!ro && <div className={clsx('sticky -top-5 z-10 flex items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium', covered ? 'bg-ok-soft text-ok' : rest > 0 ? 'bg-warn-soft text-amber-900' : 'bg-bad-soft text-bad')}><span>{covered ? 'Betrag gedeckt' : rest > 0 ? 'Noch offen' : 'Zu viel'}</span><span className="tabular-nums">{eur((covered ? want : Math.abs(rest)) / 100)}</span></div>}
              {pool.length > 6 && <input aria-label="Belege suchen" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lieferant, Nummer oder Betrag" className={`${field} w-full`} />}
              {shown.map((r) => {
                const on = sel.includes(r.id)
                const sug = r.suggestion?.lineId === line.id ? r.suggestion : undefined
                return (
                  <label key={r.id} className={clsx('flex items-center gap-3 rounded-xl border p-3 text-sm', !ro && 'cursor-pointer', on ? 'border-brand bg-brand-soft/30' : 'border-line hover:bg-slate-50')}>
                    {!ro && <input type="checkbox" checked={on} onChange={() => toggle(r.id)} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{recLabel(r)}{r.amount < 0 && <span className="ml-1.5"><Badge tone="info">Gutschrift</Badge></span>}{r.outgoing && <span className="ml-1.5"><Badge>Ausgangsbeleg</Badge></span>}</div>
                      <div className="flex items-center gap-1.5 truncate text-xs text-muted">{dmy(r.date)}{sug && <> · <Dot c={sug.confidence} /> Vorschlag</>}{!on && rest > 0 && shareOf(line, r) === rest && <> · <span className="font-medium text-ok">Betrag passt</span></>}</div>
                    </div>
                    <span className="font-medium tabular-nums">{r.amount ? eur(r.amount) : '–'}</span>
                  </label>
                )
              })}
              {shown.length === 0 && <p className="text-sm text-muted">{ro ? 'Keine Belege.' : needle ? 'Nichts gefunden.' : 'Keine offenen Belege.'}</p>}
              {diffs.map((d, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
                  <div className="min-w-0 flex-1"><div className="font-medium">Differenz: {DIFF_LABEL[d.kind]}</div><div className="truncate text-xs text-muted">{d.reason}</div></div>
                  <span className="font-medium tabular-nums">{d.amount > 0 ? '+' : '−'} {eur(Math.abs(d.amount))}</span>
                  {!ro && <button aria-label="Differenz entfernen" onClick={() => setDiffs(diffs.filter((_, k) => k !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100"><X size={15} /></button>}
                </div>
              ))}
              {!ro && sel.length > 0 && rest !== 0 && <DiffForm line={line} ledger={ledger} rest={rest} onAdd={(d) => setDiffs([...diffs, { ...d, by: actor, at: dmOf(TODAY_ISO) }])} />}
              {!ro && <Button className="w-full" onClick={() => setCreating(true)}><FilePlus2 size={16} /> Neuen Beleg erfassen</Button>}
            </div>
          </Drawer>
        )}
      {cf.dialog}
    </>
  )
}

/**
 * [Entwurf] Explain what the documents leave open (or exceed) with a named Differenzposten instead of another document. What fits depends on
 * the direction: documents above the payment are Skonto (or, for money in, Bankspesen the bank kept); a payment above the documents is
 * Bankspesen of the transfer; a small amount up to ROUND_LIMIT can be Rundung. Bankspesen that left the club need a cost center.
 */
function DiffForm({ line, ledger, rest, onAdd }: { line: BankLine; ledger: Ledger; rest: number; onAdd: (d: Omit<LineDiff, 'by' | 'at'>) => void }) {
  const out = line.amount < 0
  const small = Math.abs(rest) <= ROUND_LIMIT * 100
  const kinds: LineDiff['kind'][] = rest < 0 ? (out ? ['skonto'] : ['spesen', 'skonto']) : (out ? ['spesen'] : [])
  if (small) kinds.push('rundung')
  const [kind, setKind] = useState<LineDiff['kind'] | ''>('')
  const [why, setWhy] = useState('')
  const [cc, setCc] = useState('cc-verein')
  const [cat, setCat] = useState('k-bank')
  // A choice that no longer fits (the ticked receipts changed the sign or the size of the rest) is dropped.
  const k = kind && kinds.includes(kind) ? kind : ''
  const coded = k === 'spesen' && out
  if (kinds.length === 0) return null
  const hint: Record<LineDiff['kind'], string> = { skonto: 'z. B. 2 % Skonto laut Rechnung', spesen: 'z. B. Spesen der Auslandsüberweisung laut Kontoauszug', rundung: 'z. B. Rundung beim Bezahlen' }
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-line p-3 text-sm">
      <div className="font-medium">Differenz {eur(Math.abs(rest) / 100)} begründen</div>
      <div className="flex flex-wrap gap-2">{kinds.map((kk) => <button key={kk} onClick={() => setKind(kk)} className={clsx('rounded-lg border px-3 py-1.5', k === kk ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{DIFF_LABEL[kk]}</button>)}</div>
      {k && (
        <>
          <input aria-label="Begründung" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={hint[k]} className={`${field} w-full`} />
          {coded && (
            <div className="grid gap-2 sm:grid-cols-2">
              <select aria-label="Kostenstelle der Spesen" value={cc} onChange={(e) => setCc(e.target.value)} className={`${field} w-full`}>{ledger.costCenters.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select aria-label="Kostenart der Spesen" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-full`}>{ledger.categories.filter((c) => !c.archived && c.type === 'Kosten').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          )}
          <Button disabled={!why.trim()} onClick={() => onAdd({ kind: k, amount: rest / 100, reason: why.trim(), ...(coded ? { costCenterId: cc, categoryId: cat } : {}) })}>Als {DIFF_LABEL[k]} übernehmen</Button>
        </>
      )}
    </div>
  )
}

/**
 * Which booking paid this invoice. A Gutschrift (negative) is matched with money that came in or reduces a payment. A booking can be
 * chosen directly only when this receipt makes its receipts exact; otherwise it opens the receipts of that booking with this one ticked.
 */
export function LinePicker({ receipt, ledger, onClose }: { receipt: Receipt | null; ledger: Ledger; onClose: () => void }) {
  const cf = useConfirm()
  const actor = useActor()
  const [multi, setMulti] = useState<BankLine | null>(null)
  const sug = receipt?.suggestion
  const credit = (receipt?.amount ?? 0) < 0
  const linkedOf = (l: BankLine) => ledger.receipts.filter((r) => r.lineId === l.id)
  const restOf = (l: BankLine) => receiptTarget(l, ledger) - linkedOf(l).reduce((n, r) => n + shareOf(l, r), 0) - diffCents(l, ledger)
  const fits = (l: BankLine) => !!receipt && shareOf(l, receipt) === restOf(l)
  const free = (l: BankLine) => restOf(l) !== 0 && (credit ? l.amount > 0 || l.needsReceipt : l.needsReceipt)
  const list = ledger.lines.filter((l) => !ledger.isLocked(l.date) && (l.id === sug?.lineId || free(l))).sort((a, b) => Number(b.id === sug?.lineId) - Number(a.id === sug?.lineId) || Number(fits(b)) - Number(fits(a)) || b.date.localeCompare(a.date))
  return (
    <>
      <Drawer open={!!receipt && !multi} title={sug ? 'Vorschlag prüfen' : 'Zu welcher Buchung gehört der Beleg?'} onClose={onClose}>
      {receipt && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="font-medium">{recLabel(receipt)}</div><div className="text-muted">{receipt.name} · {receipt.amount ? eur(receipt.amount) : '–'}</div></div>
          {list.map((l) => {
            const proposed = l.id === sug?.lineId
            const has = linkedOf(l).length > 0
            const head = <span className="block text-xs text-muted">{dmy(l.date)} · {ledger.accountName(l.accountId)}{proposed && sug && <> · <Dot c={sug.confidence} /> Vorschlag: {sug.why}</>}{has && ` · noch offen ${eur(restOf(l) / 100)}`}</span>
            if (fits(l)) return (
              <button key={l.id} onClick={() => cf.ask({ title: 'Rechnung zuordnen?', lines: [`${recLabel(receipt)}: ${receipt.amount ? eur(receipt.amount) : '–'}`, `zur Buchung „${l.text}“ (${eur(l.amount)}) vom ${dmy(l.date)}`], confirm: 'Zuordnen', run: () => { ledger.setLineReceipts(l.id, [...linkedOf(l).map((r) => r.id), receipt.id], actor); onClose() } })} className={clsx('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm hover:bg-slate-50', proposed ? 'border-brand' : 'border-line')}>
                <span className="min-w-0">{head}{l.text}<span className="block text-xs font-medium text-ok">Betrag passt</span></span><span className="font-semibold tabular-nums">{eur(l.amount)}</span>
              </button>
            )
            return (
              <div key={l.id} className={clsx('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-sm', proposed ? 'border-brand' : 'border-line')}>
                <span className="min-w-0">{head}{l.text}<span className="mt-1 flex items-center gap-2 text-xs"><span className="text-muted">Betrag passt nicht</span><button onClick={() => setMulti(l)} className="font-medium text-brand hover:underline">Mit weiteren Belegen</button></span></span><span className="font-semibold tabular-nums">{eur(l.amount)}</span>
              </div>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">Alle Buchungen haben schon einen Beleg.</p>}
        </div>
      )}
    </Drawer>
      <ReceiptPicker line={receipt ? multi : null} ledger={ledger} preselect={receipt ? [receipt.id] : []} onSaved={onClose} onClose={() => setMulti(null)} />
      {cf.dialog}
    </>
  )
}
