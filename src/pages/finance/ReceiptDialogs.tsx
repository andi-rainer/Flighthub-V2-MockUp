import clsx from 'clsx'
import { FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { eur, type BankLine, type Receipt, type Split } from '../../data'
import { Badge, Button, Drawer, FilePick, type PickedFile } from '../../ui'
import { TODAY_ISO } from '../../state'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { NO_RECEIPT_REASONS, type Ledger } from './ledger'
import { cents, Dot, euros } from './parts'

/** Create a receipt: the file (the supplier's invoice) AND its data, which stays searchable and bookable on its own. */
export function ReceiptForm({ line, ledger, onClose }: { line?: BankLine; ledger: Ledger; onClose: () => void }) {
  const have = line ? ledger.receipts.filter((r) => r.lineId === line.id).reduce((n, r) => n + r.amount, 0) : 0
  const rest = line ? Math.max(0, Math.round((Math.abs(line.amount) - have) * 100)) : 0
  const [file, setFile] = useState<PickedFile | null>(null)
  const [supplier, setSupplier] = useState('')
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(TODAY_ISO)
  const [amount, setAmount] = useState(rest ? euros(rest) : '')
  const [note, setNote] = useState('')
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  const [cc, setCc] = useState('')
  const [cat, setCat] = useState('')
  const valid = !!file && supplier.trim() !== '' && date !== '' && cents(amount) > 0
  const save = () => { ledger.createReceipt({ file: file!.name, supplier: supplier.trim(), number: number.trim(), date, amount: cents(amount) / 100, note: note.trim() || undefined, lineId: line?.id, splits: !line && cc && cat ? [{ costCenterId: cc, categoryId: cat, percent: 100 }] : undefined }); onClose() }
  return (
    <Drawer open title="Beleg erstellen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>Beleg erstellen</Button></div>}>
      <div className="space-y-4 text-sm">
        {line && <div className="rounded-xl bg-slate-50 p-3"><div>{line.text}</div><div className="font-semibold tabular-nums">{eur(line.amount)}</div></div>}
        <Field label="Datei (Rechnung oder Lieferschein)"><FilePick file={file} onPick={setFile} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lieferant" className="col-span-2"><input aria-label="Lieferant" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Belegnummer"><input aria-label="Belegnummer" value={number} onChange={(e) => setNumber(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Belegdatum"><input type="date" aria-label="Belegdatum" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Betrag (€)"><input aria-label="Betrag" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          <Field label="Hinweis (optional)"><input aria-label="Hinweis" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} w-full`} /></Field>
          {!line && (
            <>
              <Field label="Kostenstelle (optional)"><select aria-label="Kostenstelle" value={cc} onChange={(e) => setCc(e.target.value)} className={`${field} w-full`}><option value="">Noch offen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Kostenart (optional)"><select aria-label="Kostenart" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-full`}><option value="">Noch offen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </>
          )}
        </div>
      </div>
    </Drawer>
  )
}

/** An exception, never silent: the reason, the person and the day stay on the booking until a receipt is linked. */
export function NoReceiptForm({ line, ledger, onClose }: { line: BankLine; ledger: Ledger; onClose: () => void }) {
  const actor = useActor()
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const [sure, setSure] = useState(false)
  const text = reason === 'Sonstiges' ? other.trim() : reason
  return (
    <Drawer open title="Ohne Beleg buchen" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!text || !sure} onClick={() => { ledger.markNoReceipt(line.id, text, actor); onClose() }}>Als Ausnahme vermerken</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><div>{line.text}</div><div className="font-semibold tabular-nums">{eur(line.amount)}</div></div>
        <div className="font-medium">Warum gibt es keinen Beleg?</div>
        <div className="flex flex-wrap gap-2">{NO_RECEIPT_REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={clsx('rounded-lg border px-3 py-2', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
        {reason === 'Sonstiges' && <input aria-label="Grund" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Grund kurz beschreiben" className={`${field} w-full`} />}
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich bestätige, dass es dazu keinen Beleg gibt.</label>
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
          <div className="text-sm font-medium">Belege im Eingang ({list.length})</div>
          {list.map((r) => {
            const match = Math.abs(r.amount) === Math.abs(line.amount)
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.supplier}{r.number ? ` · ${r.number}` : ''}</div><div className="truncate text-xs text-muted">{r.name} · {r.amount ? eur(r.amount) : 'Betrag fehlt'} {match && <Badge tone="ok">Betrag passt</Badge>}</div></div>
                <Button onClick={() => { ledger.linkReceipt(r.id, line.id); onClose() }}>Zuordnen</Button>
              </div>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">Kein freier Beleg im Eingang.</p>}
          <Button className="w-full" size="lg" onClick={() => onCreate(line)}><FilePlus2 size={16} /> Beleg erstellen</Button>
        </div>
      )}
    </Drawer>
  )
}

export function LinePicker({ receipt, ledger, onClose }: { receipt: Receipt | null; ledger: Ledger; onClose: () => void }) {
  const sug = receipt?.suggestion
  const list = ledger.lines.filter((l) => l.id === sug?.lineId || (l.needsReceipt && !ledger.isLocked(l.date) && !ledger.receipts.some((r) => r.lineId === l.id))).sort((a, b) => Number(b.id === sug?.lineId) - Number(a.id === sug?.lineId))
  return (
    <Drawer open={!!receipt} title={sug ? 'Vorschlag prüfen' : 'Zu welcher Buchung gehört der Beleg?'} onClose={onClose}>
      {receipt && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="font-medium">{receipt.supplier}{receipt.number ? ` · ${receipt.number}` : ''}</div><div className="text-muted">{receipt.name} · {receipt.amount ? eur(receipt.amount) : '–'}</div></div>
          {list.map((l) => {
            const proposed = l.id === sug?.lineId
            return (
              <button key={l.id} onClick={() => { ledger.linkReceipt(receipt.id, l.id); onClose() }} className={clsx('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm hover:bg-slate-50', proposed ? 'border-brand' : 'border-line')}>
                <span className="min-w-0"><span className="block text-xs text-muted">{dmy(l.date)}{proposed && sug && <> · <Dot c={sug.confidence} /> Vorschlag: {sug.why}</>}</span>{l.text}</span><span className="font-semibold tabular-nums">{eur(l.amount)}</span>
              </button>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">Alle Buchungen haben schon einen Beleg.</p>}
        </div>
      )}
    </Drawer>
  )
}

