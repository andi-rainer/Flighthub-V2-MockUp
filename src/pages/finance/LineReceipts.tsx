import { Download, FileCheck2, Link2 } from 'lucide-react'
import { useState } from 'react'
import { eur, type BankLine } from '../../data'
import { Button } from '../../ui'
import { dmy } from '../manifest/data'
import { type Ledger } from './ledger'
import { openReceiptFile } from './parts'
import { NoReceiptForm, ReceiptForm, ReceiptPicker } from './ReceiptDialogs'
import { receiptsOf, receiptSum } from './status'

/**
 * The invoices of one booking: attach (an invoice that waits for its debit, or a new one), detach, or note that there is none. Works on
 * every booking, also on one that is not booked yet and on income. `onDialog` tells the host when a dialog covers it, so drawers never pile up.
 */
export default function LineReceipts({ line, ledger, locked = false, booked, onInvoice, onDialog }: {
  line: BankLine; ledger: Ledger; locked?: boolean
  /** The booking is booked: only then can an invoice be missing. */ booked: boolean
  onInvoice?: (id: string) => void; onDialog: (open: boolean) => void
}) {
  const [sub, setSub] = useState<null | 'pick' | 'create' | 'none'>(null)
  const show = (v: typeof sub) => { setSub(v); onDialog(v !== null) }
  const rs = receiptsOf(line, ledger)
  const ex = ledger.exempt[line.id]
  const want = Math.round(Math.abs(line.amount) * 100)
  const rest = want - receiptSum(rs)
  const fits = !locked && rest > 0 ? ledger.receipts.filter((r) => !r.lineId && !ledger.expenseOf(r.id) && Math.round(r.amount * 100) === rest).slice(0, 2) : []
  const missing = booked && line.needsReceipt && rs.length === 0

  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold">Rechnungen{line.needsReceipt && rs.length > 0 && rest !== 0 && <span className="ml-2 text-xs font-medium text-warn">{eur(receiptSum(rs) / 100)} von {eur(Math.abs(line.amount))}</span>}</div>
      <div className="space-y-1.5 text-sm">
        {rs.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
            <FileCheck2 size={15} className="shrink-0 text-ok" />
            <div className="min-w-0 flex-1">
              {onInvoice ? <button onClick={() => onInvoice(r.id)} className="block max-w-full truncate text-left font-medium hover:text-brand">{r.supplier}{r.number ? ` · ${r.number}` : ''}</button> : <span className="block truncate font-medium">{r.supplier}{r.number ? ` · ${r.number}` : ''}</span>}
              <span className="text-xs text-muted">{dmy(r.date)}</span>
            </div>
            <span className="font-medium tabular-nums">{eur(r.amount)}</span>
            <button aria-label={`${r.name} öffnen`} title="Datei öffnen" onClick={() => openReceiptFile(r.name)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink"><Download size={15} /></button>
            {!locked && <button onClick={() => ledger.unlinkReceipt(r.id)} className="text-xs text-muted hover:text-ink">Lösen</button>}
          </div>
        ))}
        {fits.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-dashed border-brand/50 bg-brand-soft/40 px-3 py-2">
            <div className="min-w-0 flex-1"><span className="block truncate font-medium">{r.supplier}{r.number ? ` · ${r.number}` : ''}</span><span className="text-xs text-muted">Betrag passt · {dmy(r.date)}</span></div>
            <span className="font-medium tabular-nums">{eur(r.amount)}</span>
            <Button onClick={() => ledger.linkReceipt(r.id, line.id)}>Zuordnen</Button>
          </div>
        ))}
        {missing && ex && <div className="rounded-lg bg-warn-soft px-3 py-2 text-amber-900">Ohne Beleg: {ex.reason} <span className="text-xs">({ex.by} am {ex.at})</span></div>}
        {missing && !ex && <div className="rounded-lg bg-warn-soft px-3 py-2 text-warn">Beleg fehlt</div>}
        {rs.length === 0 && !missing && fits.length === 0 && <div className="rounded-lg border border-dashed border-line px-3 py-2 text-muted">Keine Rechnung</div>}
      </div>
      {!locked && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => show('pick')}><Link2 size={14} /> Rechnung zuordnen</Button>
          <Button onClick={() => show('create')}>Beleg erstellen</Button>
          {missing && !ex && <Button onClick={() => show('none')}>Kein Beleg</Button>}
        </div>
      )}
      <ReceiptPicker line={sub === 'pick' ? line : null} ledger={ledger} onClose={() => show(null)} onCreate={() => show('create')} />
      {sub === 'create' && <ReceiptForm line={line} ledger={ledger} onClose={() => show(null)} />}
      {sub === 'none' && <NoReceiptForm line={line} ledger={ledger} onClose={() => show(null)} />}
    </div>
  )
}
