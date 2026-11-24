import { Download, FileText } from 'lucide-react'
import { useState } from 'react'
import { eur, type BankLine } from '../../data'
import { Badge, Button, Card, Drawer, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { csv } from './Invoices'
import { type Ledger } from './ledger'
import { openReceiptFile } from './parts'
import { NoReceiptForm, OwnReceiptDoc, SecondSignForm, useCountersign } from './ReceiptDialogs'
import { firstSignerOf, gapsOf, lineStatus, needsProof, PROOF, proofOf } from './status'

const newest = (a: BankLine, b: BankLine) => b.date.localeCompare(a.date)

/**
 * Booked lines that need an invoice and have none: Eigenbelege waiting for their second signature (`sign`), invoices announced for later
 * (`later`, a reminder), bookings where it is simply missing (also older exceptions without an Eigenbeleg) and those covered by a fully
 * signed Eigenbeleg (`own`). Transfers between own accounts need none.
 */
export function uncovered(ledger: Ledger) {
  // Driven by the status of the booking, so this list and the bookings agree (receipts that do not cover the amount count as missing).
  const need = ledger.lines.filter((l) => needsProof(l, ledger) && ledger.done[l.id])
  const st = (l: BankLine) => lineStatus(l, ledger)
  const proof = (l: BankLine) => proofOf(l, ledger)
  return {
    covered: need.filter((l) => gapsOf(l, ledger).length === 0).length,
    sign: need.filter((l) => st(l) === 'unterschrift').sort(newest),
    later: need.filter((l) => st(l) === 'ausnahme').sort(newest),
    own: need.filter((l) => proof(l) === 'eigenbeleg').sort(newest),
    missing: need.filter((l) => st(l) === 'beleg' || st(l) === 'abweichung').sort(newest),
  }
}

/** [Entwurf] CSV of the bookings with an Eigenbeleg, for the auditor. */
export function ownCsv(ledger: Ledger, lines: BankLine[], name = 'eigenbelege.csv') {
  csv(name, 'Datum;Konto;Buchung;Betrag;Eigenbeleg;Grund;1. Unterschrift;am;2. Unterschrift;am',
    lines.map((l) => { const e = ledger.exempt[l.id]; return [dmy(l.date), ledger.accountName(l.accountId), l.bookingText ?? l.text, String(l.amount).replace('.', ','), e.own?.no ?? '', e.reason, firstSignerOf(e), e.own?.first?.at ?? e.at, e.own?.second?.by ?? '', e.own?.second?.at ?? ''] }))
}

/**
 * [Entwurf] Every booking without an invoice in one place, for the treasurer and the auditor. Open: Eigenbelege to countersign (the task of
 * Kassier and Obmann), invoices announced for later, bookings without anything (create the Eigenbeleg here). Then the bookings covered by
 * an Eigenbeleg with both signatures.
 */
export default function Exceptions({ ledger, onLine }: { ledger: Ledger; onLine: (lineId: string) => void }) {
  const { covered, sign: toSign, later, own: owned, missing } = uncovered(ledger)
  const mayCountersign = useCountersign()
  const open = [...toSign, ...later, ...missing]
  const [own, setOwn] = useState<BankLine | null>(null)
  const [sign, setSign] = useState<BankLine | null>(null)
  const [doc, setDoc] = useState<BankLine | null>(null)
  const paging = usePaging(open, String(open.length))
  const pagingOwn = usePaging(owned, String(owned.length))
  const exportCsv = () => csv('ohne-beleg.csv', 'Datum;Konto;Buchung;Betrag;Stand;Grund;Vermerkt von;Vermerkt am;Eigenbeleg',
    open.map((l) => { const e = ledger.exempt[l.id]; return [dmy(l.date), ledger.accountName(l.accountId), l.bookingText ?? l.text, String(l.amount).replace('.', ','), PROOF[proofOf(l, ledger)], e?.reason ?? '', e?.by ?? '', e?.at ?? '', e?.own?.no ?? ''] }))
  const docEx = doc ? ledger.exempt[doc.id] : undefined
  const rowCls = 'flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-slate-50'
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-ok-soft px-3 py-1 text-ok">Mit Beleg {covered}</span>
        <span className="rounded-full bg-ok-soft px-3 py-1 text-ok">Durch Eigenbeleg gedeckt {owned.length}</span>
        {toSign.length > 0 && <span className="rounded-full bg-warn-soft px-3 py-1 text-amber-900">Zweite Unterschrift fehlt {toSign.length}</span>}
        {later.length > 0 && <span className="rounded-full bg-warn-soft px-3 py-1 text-amber-900">Beleg kommt später {later.length}</span>}
        {missing.length > 0 && <span className="rounded-full bg-warn-soft px-3 py-1 text-amber-900">Beleg fehlt {missing.length}</span>}
        <span className="flex-1" />
        <Button onClick={exportCsv} disabled={open.length === 0}><Download size={16} /> CSV exportieren</Button>
      </div>
      <Card className="divide-y divide-line">
        {paging.rows.map((l) => {
          const e = ledger.exempt[l.id]
          const p = proofOf(l, ledger)
          const locked = ledger.isLocked(l.date)
          return (
            <div key={l.id} role="button" tabIndex={0} onClick={() => onLine(l.id)} onKeyDown={(k) => k.key === 'Enter' && onLine(l.id)} className={rowCls}>
              <div className="w-20 text-xs text-muted">{dmy(l.date)}</div>
              <div className="min-w-0 flex-1 basis-56"><div className="truncate font-medium">{l.bookingText ?? l.text}</div><div className="truncate text-xs text-muted">{ledger.accountName(l.accountId)}{e && <> · {e.reason} · {firstSignerOf(e)} am {e.own?.first?.at ?? e.at}</>}</div></div>
              <div className="w-24 text-right font-semibold tabular-nums">{eur(l.amount)}</div>
              <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap text-right" onClick={(k) => k.stopPropagation()}>
                <Badge tone="warn">{PROOF[p]}</Badge>
                {e?.own && <button onClick={() => setDoc(l)} className="inline-flex items-center gap-1.5 text-brand hover:underline"><FileText size={14} /> {e.own.no}</button>}
                {p === 'unterschrift' && !locked && mayCountersign(e) && <Button variant="primary" onClick={() => setSign(l)}>Gegenzeichnen</Button>}
                {(p === 'ausnahme' || p === 'fehlt') && !locked && <Button onClick={() => setOwn(l)}>Eigenbeleg erstellen</Button>}
              </div>
            </div>
          )
        })}
        {open.length === 0 && <p className="p-6 text-center text-sm text-muted">Jede Buchung hat eine Rechnung oder einen Eigenbeleg.</p>}
        {open.length > 25 && paging.bar}
      </Card>
      {owned.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <h3 className="font-semibold">Durch Eigenbeleg gedeckt ({owned.length})</h3>
            <span className="flex-1" />
            <Button onClick={() => ownCsv(ledger, owned)}><Download size={16} /> CSV exportieren</Button>
          </div>
          <Card className="divide-y divide-line">
            {pagingOwn.rows.map((l) => {
              const e = ledger.exempt[l.id]
              return (
                <div key={l.id} role="button" tabIndex={0} onClick={() => onLine(l.id)} onKeyDown={(k) => k.key === 'Enter' && onLine(l.id)} className={rowCls}>
                  <div className="w-20 text-xs text-muted">{dmy(l.date)}</div>
                  <div className="min-w-0 flex-1 basis-56"><div className="truncate font-medium">{l.bookingText ?? l.text}</div><div className="truncate text-xs text-muted">{ledger.accountName(l.accountId)} · {e.reason} · {firstSignerOf(e)} am {e.own?.first?.at ?? e.at}{e.own?.second && <> · gegengezeichnet von {e.own.second.by} am {e.own.second.at}</>}</div></div>
                  <div className="w-24 text-right font-semibold tabular-nums">{eur(l.amount)}</div>
                  <div className="w-72 text-right" onClick={(k) => k.stopPropagation()}>
                    <button onClick={() => setDoc(l)} className="inline-flex items-center gap-1.5 text-brand hover:underline"><FileText size={14} /> {e.own!.no}</button>
                  </div>
                </div>
              )
            })}
            {owned.length > 25 && pagingOwn.bar}
          </Card>
        </>
      )}
      {own && <NoReceiptForm line={own} ledger={ledger} ownOnly onClose={() => setOwn(null)} />}
      {sign && <SecondSignForm line={sign} ledger={ledger} onClose={() => setSign(null)} />}
      {doc && docEx?.own && (
        <Drawer open title={`Eigenbeleg ${docEx.own.no}`} onClose={() => setDoc(null)} footer={<div className="flex justify-end gap-2"><Button onClick={() => { const id = doc.id; setDoc(null); onLine(id) }}>Zur Buchung</Button><Button onClick={() => openReceiptFile(docEx.own!.file)}><Download size={15} /> PDF</Button></div>}>
          <OwnReceiptDoc own={docEx.own} reason={docEx.reason} by={docEx.by} at={docEx.at} />
        </Drawer>
      )}
    </>
  )
}
