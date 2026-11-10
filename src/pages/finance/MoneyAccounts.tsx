import { ArrowLeftRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { eur, type MoneyAccount } from '../../data'
import { useSession } from '../../session/session'
import { Badge, Button, Card, Drawer, Stat, Switch } from '../../ui'
import { TODAY_ISO } from '../../state'
import { dmy } from '../manifest/data'
import { Field, field } from '../tickets/parts'
import { type Ledger } from './ledger'
import { cents, euros } from './parts'
import { isTodo, lineStatus } from './status'

const KIND = { bank: 'Bankkonto', bar: 'Bargeld', spar: 'Sparbuch' } as const
const HINT = { bank: 'Bank oder IBAN', bar: 'Wo liegt das Bargeld?', spar: 'Bank oder Nummer' } as const

/** The accounts of the club and what is on them. Money moves between them by a transfer; every posting stays in the bookings. */
export default function MoneyAccounts({ ledger, onShow }: { ledger: Ledger; onShow: (accountId: string) => void }) {
  const [form, setForm] = useState<MoneyAccount | 'new' | null>(null)
  const [moving, setMoving] = useState(false)
  const active = ledger.accounts.filter((a) => !a.archived)
  const sum = (k?: MoneyAccount['kind']) => active.filter((a) => !k || a.kind === k).reduce((n, a) => n + ledger.balanceOf(a.id), 0)
  const rows = ledger.accounts.map((a) => {
    const lines = ledger.lines.filter((l) => l.accountId === a.id)
    return { a, balance: ledger.balanceOf(a.id), todo: lines.filter((l) => isTodo(lineStatus(l, ledger))).length, count: lines.length, last: lines.reduce((d, l) => (l.date > d ? l.date : d), '') }
  }).sort((x, y) => Number(!!x.a.archived) - Number(!!y.a.archived))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat compact label="Gesamt" value={eur(sum())} hint={`${active.length} Konten`} />
        <Stat compact label="Bankkonten" value={eur(sum('bank'))} />
        <Stat compact label="Bargeld" value={eur(sum('bar'))} />
        <Stat compact label="Sparbücher" value={eur(sum('spar'))} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => setMoving(true)}><ArrowLeftRight size={16} /> Umbuchung</Button>
        <Button variant="primary" onClick={() => setForm('new')}><Plus size={16} /> Konto anlegen</Button>
      </div>

      <Card className="divide-y divide-line">
        {rows.map(({ a, balance, todo, count, last }) => (
          <div key={a.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${a.archived ? 'opacity-60' : ''}`}>
            <button onClick={() => setForm(a)} className="min-w-0 flex-1 basis-48 text-left">
              <span className="flex items-center gap-2 font-medium">{a.name}<Badge>{KIND[a.kind]}</Badge>{a.archived && <Badge tone="neutral">Archiviert</Badge>}</span>
              <span className="block truncate text-xs text-muted">{a.detail || ' '}</span>
            </button>
            <div className="w-40 text-xs text-muted">{count} Buchungen{last && <> · zuletzt {dmy(last)}</>}</div>
            <div className="w-28">{todo > 0 ? <Badge tone="warn">{todo} zu bearbeiten</Badge> : <span className="text-xs text-muted">alles zugeordnet</span>}</div>
            <div className="w-32 text-right text-lg font-semibold tabular-nums">{eur(balance)}</div>
            <Button onClick={() => onShow(a.id)}>Buchungen</Button>
          </div>
        ))}
      </Card>

      {form && <AccountForm key={form === 'new' ? 'new' : form.id} account={form === 'new' ? null : form} ledger={ledger} onClose={() => setForm(null)} />}
      {moving && <Transfer ledger={ledger} onClose={() => setMoving(false)} />}
    </div>
  )
}

function AccountForm({ account, ledger, onClose }: { account: MoneyAccount | null; ledger: Ledger; onClose: () => void }) {
  const { guarded } = useSession()
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<MoneyAccount['kind'] | ''>(account?.kind ?? '')
  const [detail, setDetail] = useState(account?.detail ?? '')
  const [opening, setOpening] = useState('')
  const balance = account ? ledger.balanceOf(account.id) : 0
  const valid = name.trim() !== '' && (!!account || (!!kind && opening.trim() !== '' && cents(opening) >= 0))
  const save = () => {
    guarded('billing.bank.manage', () => {
      if (account) ledger.patchAccount(account.id, { name: name.trim(), detail: detail.trim() })
      else if (kind) ledger.addAccount({ name: name.trim(), kind, detail: detail.trim(), opening: (cents(opening) || 0) / 100 })
    })
    onClose()
  }
  return (
    <Drawer open title={account ? account.name : 'Konto anlegen'} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>{account ? 'Speichern' : 'Konto anlegen'}</Button></div>}>
      <div className="space-y-4 text-sm">
        <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Barkasse Hangar" className={`${field} w-full`} /></Field>
        {!account && <Field label="Art"><select aria-label="Art" value={kind} onChange={(e) => setKind(e.target.value as MoneyAccount['kind'])} className={`${field} w-full`}><option value="">Bitte wählen</option>{(Object.keys(KIND) as MoneyAccount['kind'][]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select></Field>}
        <Field label={`${kind ? HINT[kind] : 'Hinweis'} (optional)`}><input aria-label="Hinweis" value={detail} onChange={(e) => setDetail(e.target.value)} className={`${field} w-full`} /></Field>
        {!account && <Field label="Stand heute (€)"><input aria-label="Anfangsbestand" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>}
        {account && (
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <span><span className="font-medium">Aktiv</span><span className="block text-xs text-muted">{balance === 0 ? 'Stand ist 0 €, das Konto kann archiviert werden.' : `Stand ${eur(balance)}: erst umbuchen, dann archivieren.`}</span></span>
            <Switch checked={!account.archived} disabled={balance !== 0 && !account.archived} onChange={(v) => { ledger.patchAccount(account.id, { archived: !v }); onClose() }} label={`${account.name} aktiv`} />
          </div>
        )}
      </div>
    </Drawer>
  )
}

/** Money from one account to another: a posting on each, both booked at once. */
function Transfer({ ledger, onClose }: { ledger: Ledger; onClose: () => void }) {
  const { guarded } = useSession()
  const accounts = ledger.accounts.filter((a) => !a.archived)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(TODAY_ISO)
  const [text, setText] = useState('')
  const value = cents(amount)
  const after = ledger.balanceOf(from) - value / 100
  const valid = !!from && !!to && from !== to && value > 0 && date !== ''
  return (
    <Drawer open title="Umbuchung" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => { guarded('billing.bank.manage', () => ledger.transfer({ from, to, amount: value / 100, date, text })); onClose() }}>{valid ? `${eur(value / 100)} umbuchen` : 'Umbuchen'}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von"><select aria-label="Von" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo('') }} className={`${field} w-full`}><option value="">Bitte wählen</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {eur(ledger.balanceOf(a.id))}</option>)}</select></Field>
          <Field label="Nach"><select aria-label="Nach" value={to} onChange={(e) => setTo(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{accounts.filter((a) => a.id !== from).map((a) => <option key={a.id} value={a.id}>{a.name} · {eur(ledger.balanceOf(a.id))}</option>)}</select></Field>
          <Field label="Betrag (€)"><input aria-label="Betrag" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          <Field label="Datum"><input type="date" aria-label="Datum" max={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Buchungstext (optional)" className="col-span-2"><input aria-label="Buchungstext" value={text} onChange={(e) => setText(e.target.value)} placeholder="Umbuchung" className={`${field} w-full`} /></Field>
        </div>
        {from && value > 0 && after < 0 && <p className="text-bad">Das Konto „{ledger.accountName(from)}“ hätte danach {eur(after)}.</p>}
      </div>
    </Drawer>
  )
}
