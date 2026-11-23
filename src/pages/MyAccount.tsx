import clsx from 'clsx'
import { Banknote, Copy, FileText, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { eur, members } from '../data'
import { TODAY_ISO, useApp } from '../state'
import { Badge, Banner, Button, Card, Drawer, field, PageHeader, Segmented, usePaging } from '../ui'
import { ExpenseSubmitDrawer, MyExpenses } from './finance/ExpenseSubmit'
import { openReceiptFile } from './finance/parts'
import { payRef, StatementDrawer } from './finance/Statement'
import { dmy } from './manifest/data'

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
  const told = ledger.announcements.filter((a) => a.memberId === m.id)
  const [expense, setExpense] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [stmt, setStmt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const ref = payRef(m)
  const copy = () => { try { void navigator.clipboard?.writeText(ref) } catch { /* the dummy works without it */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const statements = Object.entries(ledger.statements).sort(([a], [b]) => b.localeCompare(a))

  return (
    <>
      <PageHeader title="Mein Konto" subtitle={m.name} actions={<><Button onClick={() => setReporting(true)}><Banknote size={16} /> Einzahlung melden</Button><Button variant="primary" onClick={() => setExpense(true)}>Auslage einreichen</Button></>} />
      {expense && <ExpenseSubmitDrawer onClose={() => setExpense(false)} />}
      <ReportDrawer open={reporting} onClose={() => setReporting(false)} />
      <StatementDrawer memberId={stmt ? m.id : null} month={stmt ?? undefined} onClose={() => setStmt(null)} />
      {(balance < 0 || balance < ledger.accountRules.lowBelow) && (
        <div className="mb-5"><Banner tone="warn">
          {balance < 0 ? `Dein Konto ist im Minus: ${eur(-balance)} sind offen.` : `Dein Guthaben ist niedrig (unter ${eur(ledger.accountRules.lowBelow)}).`}
          {reminder && balance < 0 && ` Zahlungserinnerung vom ${dm(reminder.at)}.`}
        </Banner></div>
      )}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Kontostand</div>
            <div className={clsx('mt-1 text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</div>
          </Card>
          <Card className="space-y-3 p-5 text-sm">
            <div className="font-semibold">Einzahlen</div>
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <div><div className="text-xs text-muted">IBAN</div><div className="font-medium tabular-nums">{club.iban}</div></div>
              <div className="flex items-end justify-between gap-2"><div><div className="text-xs text-muted">Verwendungszweck</div><div className="font-medium">{ref}</div></div><button onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand hover:bg-white"><Copy size={13} />{copied ? 'Kopiert' : 'Kopieren'}</button></div>
            </div>
            {balance < 0 && <div className="text-xs text-muted">Zum Ausgleich: <b className="text-ink">{eur(-balance)}</b>. Bar geht auch beim Kassier.</div>}
            {told.length > 0 && (
              <div className="divide-y divide-line rounded-lg border border-line">
                {told.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs"><span>{a.kind === 'bar' ? 'Bar' : 'Überweisung'} am {dm(a.date)}</span><span className="flex items-center gap-2"><b className="tabular-nums">{eur(a.amount)}</b><Badge tone={a.status === 'offen' ? 'warn' : 'ok'}>{a.status === 'offen' ? 'wird zugeordnet' : 'gebucht'}</Badge></span></div>)}
              </div>
            )}
          </Card>
          <Card className="p-5 text-sm">
            <div className="mb-2 font-semibold">Kontoauszüge</div>
            <div className="divide-y divide-line">
              {statements.map(([month, s]) => {
                const mm = month.slice(5)
                const label = `${MONTHS[Number(mm) - 1]} ${month.slice(0, 4)}`
                return s.state === 'versendet'
                  ? <button key={month} onClick={() => setStmt(mm)} className="flex w-full items-center justify-between py-2 text-left hover:text-brand"><span className="inline-flex items-center gap-2"><FileText size={14} />{label}</span><span className="text-muted">PDF</span></button>
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

/** [Entwurf] The member says money is on its way or was handed over; the treasurer finds it in the account and matches it with the bank line or books the cash. */
function ReportDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ledger, persona } = useApp()
  const [kind, setKind] = useState<'ueberweisung' | 'bar'>('ueberweisung')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(TODAY_ISO)
  const [note, setNote] = useState('')
  const value = Number(amount.replace(',', '.')) || 0
  const close = () => { setAmount(''); setNote(''); setDate(TODAY_ISO); onClose() }
  return (
    <Drawer open={open} title="Einzahlung melden" onClose={close}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={value <= 0 || !date || date > TODAY_ISO} onClick={() => { ledger.announce({ memberId: persona.memberId, amount: value, kind, date, note: note.trim() || undefined }); close() }}>{value > 0 ? `${eur(value)} melden` : 'Einzahlung melden'}</Button>}>
      <div className="space-y-4 text-sm">
        <Segmented<'ueberweisung' | 'bar'> value={kind} onChange={setKind} options={[{ value: 'ueberweisung', label: 'Überwiesen' }, { value: 'bar', label: 'Bar übergeben' }]} />
        <label className="block font-medium">Betrag (€)<input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={clsx(field, 'mt-1 h-11 w-full tabular-nums')} /></label>
        <label className="block font-medium">{kind === 'bar' ? 'Übergeben am' : 'Überwiesen am'}<input type="date" value={date} max={TODAY_ISO} onChange={(e) => setDate(e.target.value)} className={clsx(field, 'mt-1 h-11 w-full')} /></label>
        <label className="block font-medium">Kommentar (optional)<input value={note} onChange={(e) => setNote(e.target.value)} className={clsx(field, 'mt-1 h-11 w-full')} /></label>
      </div>
    </Drawer>
  )
}
