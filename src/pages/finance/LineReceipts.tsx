import { Download, FileCheck2, FileText, Link2 } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { eur, type BankLine } from '../../data'
import { Button, useConfirm } from '../../ui'
import { dmy } from '../manifest/data'
import { DIFF_LABEL, type Ledger } from './ledger'
import { DayReportDrawer } from './DayReport'
import { openReceiptFile } from './parts'
import { NoReceiptForm, OwnReceiptDoc, ReceiptPicker, SecondSignForm, useCountersign } from './ReceiptDialogs'
import { coverageOf, diffCents, isInternal, LATER, needsProof, ownDocsOf, ownStateOf, receiptsOf, receiptTarget, shareOf, STATEMENT } from './status'
import { useActor } from '../tickets/parts'

/**
 * The Belege of one booking: first the club's own documents that come with the assignment, then the receipts. Receipts are changed only
 * together in the picker, so their sum is exact or empty; a quick suggestion is offered only when it makes the sum exact. Or note that there
 * is none. Works on every booking, also on one that is not booked yet and on income. `onDialog` tells the host when a dialog covers it, so
 * drawers never pile up.
 */
export default function LineReceipts({ line, ledger, locked = false, booked, onInvoice, onDialog }: {
  line: BankLine; ledger: Ledger; locked?: boolean
  /** The booking is booked: only then can an invoice be missing. */ booked: boolean
  onInvoice?: (id: string) => void; onDialog: (open: boolean) => void
}) {
  const cf = useConfirm()
  const actor = useActor()
  const [sub, setSub] = useState<null | 'pick' | 'none' | 'own' | 'sign'>(null)
  const [doc, setDoc] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const reportOf = (id: string | null) => (id ? ledger.dayReports.find((d) => d.receiptId === id) : undefined)
  const show = (v: typeof sub) => { setSub(v); onDialog(v !== null) }
  const ro = locked || ledger.isLocked(line.date)
  const rs = receiptsOf(line, ledger)
  const docs = ownDocsOf(line, ledger)
  const ex = ledger.exempt[line.id]
  const { want, covered } = coverageOf(line, ledger)
  const rest = receiptTarget(line, ledger) - rs.reduce((n, r) => n + shareOf(line, r), 0) - diffCents(line, ledger)
  const fits = !ro && rest > 0 ? ledger.receipts.filter((r) => !r.lineId && !ledger.expenseOf(r.id) && shareOf(line, r) === rest).slice(0, 2) : []
  const missing = booked && needsProof(line, ledger) && rs.length === 0
  const own = ownStateOf(line, ledger)
  const mayCountersign = useCountersign()(ex)

  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold">Belege{(rs.length > 0 || docs.length > 0) && covered !== want && <span className="ml-2 text-xs font-medium text-warn">{eur(covered / 100)} von {eur(Math.abs(line.amount))}</span>}</div>
      <div className="space-y-1.5 text-sm">
        {docs.map((d, i) => (
          <div key={`${d.kind}-${i}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
            <FileText size={15} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1"><span className="block truncate font-medium">{d.label}</span><span className="text-xs text-muted">{d.kind === 'gegenbuchung' ? 'Umbuchung' : 'von uns ausgestellt'}</span></div>
            <span className="font-medium tabular-nums">{eur(d.amount)}</span>
          </div>
        ))}
        {rs.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
            <FileCheck2 size={15} className="shrink-0 text-ok" />
            <div className="min-w-0 flex-1">
              {onInvoice ? <button onClick={() => onInvoice(r.id)} className="block max-w-full truncate text-left font-medium hover:text-brand">{r.supplier}{r.number ? ` · ${r.number}` : ''}</button> : <span className="block truncate font-medium">{r.supplier}{r.number ? ` · ${r.number}` : ''}</span>}
              <span className="text-xs text-muted">{dmy(r.date)}</span>
            </div>
            <span className="font-medium tabular-nums">{eur(r.amount)}</span>
            <button aria-label={`${r.name} öffnen`} title="Datei öffnen" onClick={() => (r.source === 'Kassa' && reportOf(r.id) ? setReport(r.id) : openReceiptFile(r.name))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink"><Download size={15} /></button>
          </div>
        ))}
        {(ledger.diffs[line.id] ?? []).map((d, i) => (
          <div key={`diff-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2">
            <div className="min-w-0 flex-1"><span className="block truncate font-medium">Differenz: {DIFF_LABEL[d.kind]}</span><span className="block truncate text-xs text-muted">{d.reason} · {d.by}, {d.at}</span></div>
            <span className="font-medium tabular-nums">{d.amount > 0 ? '+' : '−'} {eur(Math.abs(d.amount))}</span>
          </div>
        ))}
        {fits.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-dashed border-brand/50 bg-brand-soft/40 px-3 py-2">
            <div className="min-w-0 flex-1"><span className="block truncate font-medium">{r.supplier}{r.number ? ` · ${r.number}` : ''}</span><span className="text-xs text-muted">Betrag passt · {dmy(r.date)}</span></div>
            <span className="font-medium tabular-nums">{eur(r.amount)}</span>
            <Button onClick={() => cf.ask({ title: 'Rechnung zuordnen?', lines: [`${r.supplier}${r.number ? ` · ${r.number}` : ''}: ${eur(r.amount)}`, `zur Buchung „${line.bookingText ?? line.text}“ vom ${dmy(line.date)}`], confirm: 'Zuordnen', run: () => ledger.setLineReceipts(line.id, [...rs.map((x) => x.id), r.id], actor) })}>Zuordnen</Button>
          </div>
        ))}
        {missing && ex && (
          <div className={own === 'gedeckt' || ex.reason === STATEMENT ? 'rounded-lg bg-ok-soft px-3 py-2 text-ok' : 'rounded-lg bg-warn-soft px-3 py-2 text-amber-900'}>
            <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{ex.reason === STATEMENT ? 'Kontoauszug genügt' : own === 'gedeckt' ? 'Durch Eigenbeleg gedeckt' : own === 'unterschrift' ? 'Zweite Unterschrift fehlt' : ex.reason === LATER ? 'Beleg kommt später' : 'Beleg fehlt'}{ex.reason !== LATER && ex.reason !== STATEMENT && `: ${ex.reason}`} <span className="text-xs">({ex.own?.first?.by ?? ex.by} am {ex.own?.first?.at ?? ex.at}{ex.own?.second ? `, ${ex.own.second.by} am ${ex.own.second.at}` : ''})</span></span>
              {own === 'unterschrift' && !ro && mayCountersign && <button onClick={() => show('sign')} className="text-xs font-medium text-brand">Gegenzeichnen</button>}
              {ex.own ? <button onClick={() => setDoc(!doc)} className="text-xs font-medium text-brand">{doc ? 'Eigenbeleg ausblenden' : `Eigenbeleg ${ex.own.no}`}</button>
                : !ro && ex.reason !== STATEMENT && <button onClick={() => show('own')} className="text-xs font-medium text-brand">Eigenbeleg erstellen</button>}
            </div>
            {doc && ex.own && <div className="mt-2"><OwnReceiptDoc own={ex.own} reason={ex.reason} by={ex.by} at={ex.at} /></div>}
          </div>
        )}
        {missing && !ex && <div className="rounded-lg bg-warn-soft px-3 py-2 text-warn">Beleg fehlt</div>}
        {rs.length === 0 && docs.length === 0 && !missing && fits.length === 0 && <div className="rounded-lg border border-dashed border-line px-3 py-2 text-muted">{isInternal(line, ledger) ? 'Kein Beleg nötig' : 'Keine Rechnung'}</div>}
      </div>
      {!ro && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button className="border-brand/40 text-brand" onClick={() => show('pick')}><Link2 size={14} /> {rs.length > 0 ? 'Belege ändern' : 'Belege zuordnen'}</Button>
          {missing && !ex && <Button onClick={() => show('none')}>Kein Beleg</Button>}
        </div>
      )}
      {createPortal(<>
      <ReceiptPicker line={sub === 'pick' ? line : null} ledger={ledger} onClose={() => show(null)} />
      {sub === 'none' && <NoReceiptForm line={line} ledger={ledger} onClose={() => show(null)} />}
      {reportOf(report) && <DayReportDrawer report={reportOf(report)!} onClose={() => setReport(null)} />}
      {sub === 'own' && <NoReceiptForm line={line} ledger={ledger} ownOnly onClose={() => show(null)} />}
      {sub === 'sign' && <SecondSignForm line={line} ledger={ledger} onClose={() => show(null)} />}
      {cf.dialog}
      </>, document.body)}
    </div>
  )
}
