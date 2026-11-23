import { Download, FileText } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { eur, type BankLine } from '../../data'
import { Badge, Button, Card, Drawer, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { csv } from './Invoices'
import { type Ledger } from './ledger'
import { openReceiptFile } from './parts'
import { NoReceiptForm, OwnReceiptDoc } from './ReceiptDialogs'

/** Booked lines that need an invoice and have none: noted exceptions, and those where it is simply missing. */
export function uncovered(ledger: Ledger) {
  const need = ledger.lines.filter((l) => l.needsReceipt && ledger.done[l.id])
  const bare = need.filter((l) => !ledger.receipts.some((r) => r.lineId === l.id))
  return {
    covered: need.length - bare.length,
    exempt: bare.filter((l) => ledger.exempt[l.id]).sort((a, b) => b.date.localeCompare(a.date)),
    missing: bare.filter((l) => !ledger.exempt[l.id]),
  }
}

/**
 * [Entwurf] Every booking without an invoice in one place, for the treasurer and the auditor: the reason, who noted it and when, and the
 * Eigenbeleg (created here for an exception that has none yet). Bookings where the invoice is simply missing lead to the bookings.
 */
export default function Exceptions({ ledger, onLine }: { ledger: Ledger; onLine: (lineId: string) => void }) {
  const [, setParams] = useSearchParams()
  const { covered, exempt, missing } = uncovered(ledger)
  const [own, setOwn] = useState<BankLine | null>(null)
  const [doc, setDoc] = useState<BankLine | null>(null)
  const paging = usePaging(exempt, String(exempt.length))
  const exportCsv = () => csv('ohne-beleg.csv', 'Datum;Konto;Buchung;Betrag;Grund;Vermerkt von;Vermerkt am;Eigenbeleg',
    exempt.map((l) => { const e = ledger.exempt[l.id]; return [dmy(l.date), ledger.accountName(l.accountId), l.bookingText ?? l.text, String(l.amount).replace('.', ','), e.reason, e.by, e.at, e.own?.no ?? ''] }))
  const docEx = doc ? ledger.exempt[doc.id] : undefined
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-ok-soft px-3 py-1 text-ok">Mit Beleg {covered}</span>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">Ausnahme vermerkt {exempt.length}</span>
        {missing.length > 0 && <button onClick={() => setParams({ tab: 'bank', offen: '1' })} className="rounded-full bg-warn-soft px-3 py-1 text-amber-900 hover:underline">Beleg fehlt {missing.length} · zu den Buchungen</button>}
        <span className="flex-1" />
        <Button onClick={exportCsv} disabled={exempt.length === 0}><Download size={16} /> CSV exportieren</Button>
      </div>
      <Card className="divide-y divide-line">
        {paging.rows.map((l) => {
          const e = ledger.exempt[l.id]
          const later = e.reason === 'Beleg kommt später'
          return (
            <div key={l.id} role="button" tabIndex={0} onClick={() => onLine(l.id)} onKeyDown={(k) => k.key === 'Enter' && onLine(l.id)} className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-slate-50">
              <div className="w-20 text-xs text-muted">{dmy(l.date)}</div>
              <div className="min-w-0 flex-1 basis-56"><div className="truncate font-medium">{l.bookingText ?? l.text}</div><div className="truncate text-xs text-muted">{ledger.accountName(l.accountId)} · {e.reason} · {e.by} am {e.at}</div></div>
              <div className="w-24 text-right font-semibold tabular-nums">{eur(l.amount)}</div>
              <div className="w-44 text-right" onClick={(k) => k.stopPropagation()}>
                {e.own ? <button onClick={() => setDoc(l)} className="inline-flex items-center gap-1.5 text-brand hover:underline"><FileText size={14} /> {e.own.no}</button>
                  : later ? <Badge tone="warn">Beleg kommt später</Badge>
                  : <Button onClick={() => setOwn(l)}>Eigenbeleg erstellen</Button>}
              </div>
            </div>
          )
        })}
        {exempt.length === 0 && <p className="p-6 text-center text-sm text-muted">Keine Buchung ohne Beleg.</p>}
        {exempt.length > 25 && paging.bar}
      </Card>
      {own && <NoReceiptForm line={own} ledger={ledger} ownOnly onClose={() => setOwn(null)} />}
      {doc && docEx?.own && (
        <Drawer open title={`Eigenbeleg ${docEx.own.no}`} onClose={() => setDoc(null)} footer={<div className="flex justify-end gap-2"><Button onClick={() => { const id = doc.id; setDoc(null); onLine(id) }}>Zur Buchung</Button><Button onClick={() => openReceiptFile(docEx.own!.file)}><Download size={15} /> PDF</Button></div>}>
          <OwnReceiptDoc own={docEx.own} reason={docEx.reason} by={docEx.by} />
        </Drawer>
      )}
    </>
  )
}
