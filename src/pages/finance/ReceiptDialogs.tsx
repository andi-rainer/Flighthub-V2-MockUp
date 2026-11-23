import clsx from 'clsx'
import { AlertTriangle, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { eur, type BankLine, type Receipt } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp, TODAY_ISO } from '../../state'
import { Badge, Button, Drawer, Segmented } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { captureProblem, EMPTY_CAPTURE, ReceiptCapture, toNewReceipt, type Captured } from './capture'
import { NO_RECEIPT_REASONS, type Ledger, type OwnReceipt } from './ledger'
import { Dot, openReceiptFile } from './parts'
import { useSuppliers } from './supplierStore'

type Kind = 'rechnung' | 'gutschrift'
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
export function ReceiptForm({ line, ledger, onClose, start, onSaved }: {
  line?: BankLine; ledger: Ledger; onClose: () => void
  /** Prefilled data: a file from the inbox, or the supplier of an expected invoice. */ start?: Partial<Captured>
  onSaved?: () => void
}) {
  const { hasAccount } = useApp()
  const sup = useSuppliers()
  const have = line ? ledger.receipts.filter((r) => r.lineId === line.id).reduce((n, r) => n + Math.abs(r.amount), 0) : 0
  const rest = line ? Math.max(0, Math.round((Math.abs(line.amount) - have) * 100) / 100) : 0
  const [kind, setKind] = useState<Kind>('rechnung')
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
    else ledger.createReceipt({ ...base, amount, lineId: line?.id, splits: line ? undefined : splits, due: paid === 'bank' ? due || undefined : undefined, cashAccountId: paid === 'kassa' ? cashId : undefined })
    onSaved?.()
    onClose()
  }
  const payLabel = credit
    ? [{ value: 'bank' as Paid, label: 'Gutschrift folgt aufs Konto' }, { value: 'kassa' as Paid, label: 'Bar erhalten (Kassa)' }]
    : [{ value: 'bank' as Paid, label: 'Abbuchung oder Überweisung folgt' }, { value: 'kassa' as Paid, label: 'Bar aus der Kassa' }, { value: 'privat' as Paid, label: 'Privat ausgelegt' }]

  return (
    <Drawer open title={credit ? 'Gutschrift erstellen' : 'Beleg erstellen'} onClose={onClose}
      footer={<div className="flex items-center justify-end gap-2">{problem && cap.file && <span className="mr-auto text-xs text-warn">{problem}</span>}<Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!!problem} onClick={save}>{paid === 'kassa' ? `Erstellen und ${eur(credit ? total : -total)} in der Kassa buchen` : paid === 'privat' ? 'Erstellen und gutschreiben' : credit ? 'Gutschrift erstellen' : 'Beleg erstellen'}</Button></div>}>
      <div className="space-y-4 text-sm">
        {line && <div className="rounded-xl bg-slate-50 p-3"><div>{line.text}</div><div className="font-semibold tabular-nums">{eur(line.amount)}</div></div>}
        {!line && <Segmented<Kind> value={kind} onChange={(k) => { setKind(k); setPaid('') }} options={[{ value: 'rechnung', label: 'Rechnung' }, { value: 'gutschrift', label: 'Gutschrift' }]} />}
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

/** The Eigenbeleg as a document: what the auditor sees instead of the supplier's invoice. */
export function OwnReceiptDoc({ own, reason, by }: { own: OwnReceipt; reason: string; by: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 font-serif text-[13px] text-ink shadow-sm">
      <div className="flex items-start justify-between border-b border-line pb-2"><div className="text-base font-semibold">Eigenbeleg</div><div className="text-right text-xs"><div className="font-semibold">{own.no}</div><div>{dmy(own.date)}</div></div></div>
      <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1">
        <dt className="text-muted">Betrag</dt><dd className="font-semibold tabular-nums">{eur(own.amount)}</dd>
        <dt className="text-muted">Empfänger</dt><dd>{own.payee || '–'}</dd>
        <dt className="text-muted">Zweck</dt><dd>{own.purpose || '–'}</dd>
        <dt className="text-muted">Kein Originalbeleg</dt><dd>{reason || '–'}</dd>
      </dl>
      <div className="mt-3 border-t border-line pt-2 text-xs text-muted">Erstellt und bestätigt von {by} am {dmy(TODAY_ISO)}</div>
    </div>
  )
}

/**
 * An exception, never silent: the reason, the person and the day stay on the booking until a receipt is linked. Optionally the club writes
 * an Eigenbeleg (payee, purpose) as the document of the exception. `ownOnly`: the exception exists, only the Eigenbeleg is added.
 */
export function NoReceiptForm({ line, ledger, onClose, ownOnly }: { line: BankLine; ledger: Ledger; onClose: () => void; ownOnly?: boolean }) {
  const actor = useActor()
  const ex = ledger.exempt[line.id]
  const known = ex && (NO_RECEIPT_REASONS as readonly string[]).includes(ex.reason) ? ex.reason : ex ? 'Sonstiges' : ''
  const [reason, setReason] = useState(known)
  const [other, setOther] = useState(known === 'Sonstiges' ? ex?.reason ?? '' : '')
  const [sure, setSure] = useState(!!ownOnly)
  const [own, setOwn] = useState(!!ownOnly)
  const [payee, setPayee] = useState('')
  const [purpose, setPurpose] = useState(line.bookingText ?? line.text)
  const text = reason === 'Sonstiges' ? other.trim() : reason
  const later = reason === 'Beleg kommt später'
  const n = Object.values(ledger.exempt).filter((e) => e.own).length + 1
  const no = `EB-${line.date.slice(0, 4)}-${String(n).padStart(3, '0')}`
  const doc: OwnReceipt = { no, payee: payee.trim(), purpose: purpose.trim(), date: line.date, amount: Math.abs(line.amount), file: `${no}.pdf` }
  const ok = !!text && sure && (!own || (!!doc.payee && !!doc.purpose))
  const save = () => { if (own && !later) ledger.markOwnReceipt(line.id, text, actor, doc); else ledger.markNoReceipt(line.id, text, actor); onClose() }
  return (
    <Drawer open title={ownOnly ? 'Eigenbeleg erstellen' : 'Ohne Beleg buchen'} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!ok} onClick={save}>{own && !later ? 'Eigenbeleg erstellen' : 'Als Ausnahme vermerken'}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">{dmy(line.date)} · {ledger.accountName(line.accountId)}</div><div>{line.text}</div><div className="font-semibold tabular-nums">{eur(line.amount)}</div></div>
        {!ownOnly && (
          <>
            <div className="font-medium">Warum gibt es keinen Beleg?</div>
            <div className="flex flex-wrap gap-2">{NO_RECEIPT_REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={clsx('rounded-lg border px-3 py-2', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
            {reason === 'Sonstiges' && <input aria-label="Grund" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Grund kurz beschreiben" className={`${field} w-full`} />}
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich bestätige, dass es dazu keinen Beleg gibt.</label>
            {text && !later && <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={own} onChange={(e) => setOwn(e.target.checked)} />Eigenbeleg dazu erstellen</label>}
          </>
        )}
        {own && !later && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Empfänger (wer bekam das Geld)"><input aria-label="Empfänger" value={payee} onChange={(e) => setPayee(e.target.value)} className={`${field} w-full`} /></Field>
              <Field label="Zweck"><input aria-label="Zweck" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${field} w-full`} /></Field>
            </div>
            <OwnReceiptDoc own={doc} reason={text} by={actor} />
          </div>
        )}
      </div>
    </Drawer>
  )
}

export function ReceiptPicker({ line, ledger, onClose, onCreate }: { line: BankLine | null; ledger: Ledger; onClose: () => void; onCreate: (line: BankLine) => void }) {
  const list = ledger.receipts.filter((r) => !r.lineId && !ledger.expenseOf(r.id)).sort((a, b) => Number(Math.abs(b.amount) === Math.abs(line?.amount ?? 0)) - Number(Math.abs(a.amount) === Math.abs(line?.amount ?? 0)))
  return (
    <Drawer open={!!line} title="Beleg zuordnen" onClose={onClose}>
      {line && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-sm">{line.text}</div><div className="text-xl font-semibold tabular-nums">{eur(line.amount)}</div></div>
          <div className="text-sm font-medium">Rechnungen ohne Zahlung ({list.length})</div>
          {list.map((r) => {
            const match = Math.abs(r.amount) === Math.abs(line.amount)
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.supplier}{r.number ? ` · ${r.number}` : ''}{r.amount < 0 && <span className="ml-1.5"><Badge tone="info">Gutschrift</Badge></span>}</div><div className="truncate text-xs text-muted">{dmy(r.date)} · {r.amount ? eur(r.amount) : 'Betrag fehlt'} {match && <Badge tone="ok">Betrag passt</Badge>}</div></div>
                <Button onClick={() => { ledger.linkReceipt(r.id, line.id); onClose() }}>Zuordnen</Button>
              </div>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">Keine Rechnung ohne Zahlung.</p>}
          <Button className="w-full" size="lg" onClick={() => onCreate(line)}><FilePlus2 size={16} /> Beleg erstellen</Button>
        </div>
      )}
    </Drawer>
  )
}

/** Which booking paid this invoice. A Gutschrift (negative) is matched with money that came in. */
export function LinePicker({ receipt, ledger, onClose }: { receipt: Receipt | null; ledger: Ledger; onClose: () => void }) {
  const sug = receipt?.suggestion
  const credit = (receipt?.amount ?? 0) < 0
  const free = (l: BankLine) => !ledger.isLocked(l.date) && !ledger.receipts.some((r) => r.lineId === l.id) && (credit ? l.amount > 0 : l.needsReceipt)
  const fits = (l: BankLine) => Math.abs(l.amount) === Math.abs(receipt?.amount ?? 0)
  const list = ledger.lines.filter((l) => l.id === sug?.lineId || free(l)).sort((a, b) => Number(b.id === sug?.lineId) - Number(a.id === sug?.lineId) || Number(fits(b)) - Number(fits(a)) || b.date.localeCompare(a.date))
  return (
    <Drawer open={!!receipt} title={sug ? 'Vorschlag prüfen' : 'Zu welcher Buchung gehört der Beleg?'} onClose={onClose}>
      {receipt && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="font-medium">{receipt.supplier}{receipt.number ? ` · ${receipt.number}` : ''}</div><div className="text-muted">{receipt.name} · {receipt.amount ? eur(receipt.amount) : '–'}</div></div>
          {list.map((l) => {
            const proposed = l.id === sug?.lineId
            return (
              <button key={l.id} onClick={() => { ledger.linkReceipt(receipt.id, l.id); onClose() }} className={clsx('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm hover:bg-slate-50', proposed ? 'border-brand' : 'border-line')}>
                <span className="min-w-0"><span className="block text-xs text-muted">{dmy(l.date)} · {ledger.accountName(l.accountId)}{proposed && sug && <> · <Dot c={sug.confidence} /> Vorschlag: {sug.why}</>}{!proposed && fits(l) && ' · Betrag passt'}</span>{l.text}</span><span className="font-semibold tabular-nums">{eur(l.amount)}</span>
              </button>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">Alle Buchungen haben schon einen Beleg.</p>}
        </div>
      )}
    </Drawer>
  )
}
