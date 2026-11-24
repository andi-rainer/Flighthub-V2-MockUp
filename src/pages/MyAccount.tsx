import clsx from 'clsx'
import { Copy, FileText, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { eur, members } from '../data'
import { useApp } from '../state'
import { Badge, Banner, Button, Card, PageHeader, usePaging } from '../ui'
import { ExpenseSubmitDrawer, MyExpenses } from './finance/ExpenseSubmit'
import { openReceiptFile } from './finance/parts'
import { InterimDrawer, payRef, StatementDrawer } from './finance/Statement'
import { DocChip, docOfEntry, DOC_TITLE, interimOf, invoiceNo, isCharge, MoneyDocDrawer, requestInterim, uninvoiced, useMoneyDocs, type Interim, type MoneyDoc } from './finance/memberDocs'
import { dmy } from './manifest/data'
import MinusNotice from './manifest/MinusNotice'

const dm = (iso: string) => dmy(iso).slice(0, 6)
const SOURCE = { flug: 'Bordbuch', sprungtag: 'Sprungtag', bank: 'Überweisung', kassa: 'Bar', auslage: 'Auslage', beitrag: 'Beitrag' } as const
const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/** Strictly the own account. Looking at other accounts needs the permission of the treasurer (Mitglieder or Finanzen). */
export default function MyAccount() {
  const { persona, ledger, club } = useApp()
  const m = members.find((x) => x.id === persona.memberId)!
  const balance = ledger.balances[m.id] ?? 0
  const history = ledger.history[m.id] ?? []
  const paging = usePaging(history, `${m.id}|${history.length}`, [10, 25, 50])
  const reminder = ledger.reminders[m.id]
  const [expense, setExpense] = useState(false)
  const [stmt, setStmt] = useState<string | null>(null)
  const [doc, setDoc] = useState<MoneyDoc | null>(null)
  const money = useMoneyDocs()
  const [interim, setInterim] = useState<Interim | null>(null)
  const interims = money.interims.filter((z) => z.memberId === m.id)
  const toInvoice = uninvoiced(m.id, history, ledger.statements, money)
  const askInterim = () => { const z = requestInterim(m.id, history, ledger.statements, m.name); if (z) { setInterim(z); ledger.notify(`Zwischenrechnung ${z.no} erstellt: ${eur(z.total)}`) } }
  const released = (mm: string) => ledger.statements[`2026-${mm}`]?.state === 'versendet'
  const [copied, setCopied] = useState(false)
  const ref = payRef(m)
  const copy = () => { try { void navigator.clipboard?.writeText(ref) } catch { /* the dummy works without it */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const statements = Object.entries(ledger.statements).sort(([a], [b]) => b.localeCompare(a))

  return (
    <>
      <PageHeader title="Mein Konto" subtitle={m.name} actions={<Button variant="primary" onClick={() => setExpense(true)}>Auslage einreichen</Button>} />
      <MinusNotice memberId={m.id} onTopUp={() => document.getElementById('einzahlen')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="mb-5" />
      {expense && <ExpenseSubmitDrawer onClose={() => setExpense(false)} />}
      <StatementDrawer released memberId={stmt ? m.id : null} month={stmt ?? undefined} onClose={() => setStmt(null)} />
      <MoneyDocDrawer doc={doc} onClose={() => setDoc(null)} />
      <InterimDrawer interim={interim} onClose={() => setInterim(null)} />
      {(balance < 0 || balance < ledger.accountRules.lowBelow) && (
        <div className="mb-5"><Banner tone="warn">
          {balance < 0 ? `Dein Konto ist im Minus: ${eur(-balance)} sind offen.` : `Dein Guthaben ist niedrig (unter ${eur(ledger.accountRules.lowBelow)}).`}
          {reminder && balance < 0 && ` Zahlungserinnerung vom ${dm(reminder.at)}.`}
        </Banner></div>
      )}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{balance > 0 ? 'Guthaben' : 'Kontostand'}</div>
            <div className={clsx('mt-1 text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad', balance > 0 && 'text-brand')}>{eur(balance)}</div>
          </Card>
          <div id="einzahlen"><Card className="space-y-3 p-5 text-sm">
            <div className="font-semibold">Einzahlen</div>
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <div><div className="text-xs text-muted">IBAN</div><div className="font-medium tabular-nums">{club.iban}</div></div>
              <div className="flex items-end justify-between gap-2"><div><div className="text-xs text-muted">Verwendungszweck</div><div className="font-medium">{ref}</div></div><button onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand hover:bg-white"><Copy size={13} />{copied ? 'Kopiert' : 'Kopieren'}</button></div>
            </div>
            {balance < 0 && <div className="text-xs text-muted">Zum Ausgleich: <b className="text-ink">{eur(-balance)}</b>. Bar geht auch beim Kassier.</div>}
          </Card></div>
          <Card className="p-5 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="font-semibold">Rechnungen</span><Button disabled={toInvoice.length === 0} onClick={askInterim}>Rechnung bis heute anfordern</Button></div>
            <div className="divide-y divide-line">
              {interims.map((z) => <button key={z.no} onClick={() => setInterim(z)} className="flex w-full items-center justify-between py-2 text-left hover:text-brand"><span className="inline-flex items-center gap-2"><FileText size={14} />Zwischenrechnung bis {dm(z.date)}</span><span className="text-xs text-muted">{z.no} · {eur(z.total)} · PDF</span></button>)}
              {statements.map(([month, s]) => {
                const mm = month.slice(5)
                const label = `${MONTHS[Number(mm) - 1]} ${month.slice(0, 4)}`
                return s.state === 'versendet'
                  ? <button key={month} onClick={() => setStmt(mm)} className="flex w-full items-center justify-between py-2 text-left hover:text-brand"><span className="inline-flex items-center gap-2"><FileText size={14} />{label}</span><span className="text-xs text-muted">{invoiceNo(m, mm)} · PDF</span></button>
                  : <div key={month} className="flex items-center justify-between py-2 text-muted"><span className="inline-flex items-center gap-2"><FileText size={14} />{label}</span><span>kommt nach Freigabe</span></div>
              })}
            </div>
          </Card>
        </div>
        <div className="space-y-5 self-start">
        <MyExpenses />
        <Card>
          <div className="border-b border-line px-5 py-3 font-semibold">Buchungen</div>
          <div className="divide-y divide-line">
            {paging.rows.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className={clsx(e.reversed && 'text-muted line-through')}>
                  <span className="text-muted">{e.date}</span> {e.text}
                  {e.storno && <Badge>Storno</Badge>}
                  {e.source && <span className="ml-2 rounded-full bg-slate-100 px-2 py-px text-xs text-muted">{SOURCE[e.source.kind]}</span>}
                  {e.receiptId && <ReceiptLink id={e.receiptId} />}
                  {(() => { const d = docOfEntry(m.id, e, money.docs); return d && <DocChip label={`${DOC_TITLE[d.kind]} ${d.no}`} onOpen={() => setDoc(d)} /> })()}
                  {(() => { const z = isCharge(e) ? interimOf(m.id, e, money) : undefined; return z && <DocChip label={`Zwischenrechnung ${z.no}`} onOpen={() => setInterim(z)} /> })()}
                  {isCharge(e) && !e.storno && !interimOf(m.id, e, money) && released(e.date.slice(3, 5)) && <DocChip label={`Monatsrechnung ${invoiceNo(m, e.date.slice(3, 5))}`} onOpen={() => setStmt(e.date.slice(3, 5))} />}
                </span>
                <span className={clsx('font-medium tabular-nums', e.amount < 0 ? 'text-bad' : 'text-ok', e.reversed && 'opacity-50')}>{e.amount > 0 ? '+ ' : '− '}{eur(Math.abs(e.amount))}</span>
              </div>
            ))}
          </div>
          {history.length > 10 && paging.bar}
        </Card>
        </div>
      </div>
    </>
  )
}

function ReceiptLink({ id }: { id: string }) {
  const { ledger } = useApp()
  const r = ledger.receipts.find((x) => x.id === id)
  if (!r) return null
  return <button onClick={() => openReceiptFile(r.name)} title={r.name} className="ml-2 inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-px text-xs font-medium text-ok hover:underline"><Paperclip size={11} />Beleg</button>
}
