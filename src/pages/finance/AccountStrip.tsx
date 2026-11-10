import clsx from 'clsx'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { AUSLAGE_ID, eur, type MoneyAccount } from '../../data'
import { useSession } from '../../session/session'
import { Button, Drawer, Switch } from '../../ui'
import { TODAY_ISO } from '../../state'
import { Field, field } from '../tickets/parts'
import { type Ledger } from './ledger'
import { cents } from './parts'
import { isTodo, lineStatus } from './status'

const KIND = { bank: 'Bankkonto', bar: 'Bargeld', spar: 'Sparbuch' } as const
const HINT = { bank: 'Bank oder IBAN', bar: 'Wo liegt das Bargeld?', spar: 'Bank oder Nummer' } as const

/**
 * The accounts of the club above the bookings: what is on each one, what is still to do on it. A click filters the bookings to that account,
 * so "what is booked where" is one glance. Money moves between accounts by a transfer; every posting stays in the bookings.
 */
export default function AccountStrip({ ledger, value, onChange }: { ledger: Ledger; value: string; onChange: (accountId: string) => void }) {
  const [form, setForm] = useState<MoneyAccount | 'new' | null>(null)
  const [archived, setArchived] = useState(false)
  const active = ledger.accounts.filter((a) => !a.archived)
  const old = ledger.accounts.filter((a) => a.archived)
  const todoOf = (id: string) => ledger.lines.filter((l) => l.accountId === id && isTodo(lineStatus(l, ledger))).length
  const toggle = (id: string) => onChange(value === id ? '' : id)
  const card = (id: string, selected: boolean) => clsx('group relative rounded-xl border p-3 text-left', selected ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-slate-300')

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <button onClick={() => onChange('')} className={card('', value === '')}>
          <div className="text-xs font-medium text-muted">Alle Konten</div>
          <div className="text-lg font-semibold tabular-nums">{eur(active.reduce((n, a) => n + ledger.balanceOf(a.id), 0))}</div>
          <div className="text-xs text-muted">{active.length} Konten</div>
        </button>
        {[...active, ...(archived ? old : [])].map((a) => {
          const todo = todoOf(a.id)
          return (
            <div key={a.id} className={clsx(card(a.id, value === a.id), a.archived && 'opacity-60')}>
              <button onClick={() => toggle(a.id)} className="block w-full text-left" aria-pressed={value === a.id}>
                <div className="truncate pr-6 text-xs font-medium text-muted">{a.name}</div>
                <div className={clsx('text-lg font-semibold tabular-nums', ledger.balanceOf(a.id) < 0 && 'text-bad')}>{eur(ledger.balanceOf(a.id))}</div>
                <div className="truncate text-xs text-muted">{KIND[a.kind]} · {todo > 0 ? <span className="font-medium text-amber-900">{todo} zu bearbeiten</span> : 'alles zugeordnet'}</div>
              </button>
              <button onClick={() => setForm(a)} aria-label={`${a.name} bearbeiten`} className="absolute right-2 top-2 rounded p-1 text-muted opacity-60 hover:bg-slate-100 hover:opacity-100"><Pencil size={13} /></button>
            </div>
          )
        })}
        <button onClick={() => toggle(AUSLAGE_ID)} className={card(AUSLAGE_ID, value === AUSLAGE_ID)} aria-pressed={value === AUSLAGE_ID}>
          <div className="text-xs font-medium text-muted">Auslagen</div>
          <div className="text-lg font-semibold tabular-nums">{ledger.lines.filter((l) => l.accountId === AUSLAGE_ID).length}</div>
          <div className="text-xs text-muted">privat bezahlt, gutgeschrieben</div>
        </button>
        <button onClick={() => setForm('new')} className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line p-3 text-sm text-muted hover:border-brand hover:text-brand"><Plus size={15} /> Konto anlegen</button>
      </div>
      {old.length > 0 && <button onClick={() => setArchived(!archived)} className="text-xs text-brand">{archived ? 'Archivierte Konten ausblenden' : `${old.length} archivierte Konten anzeigen`}</button>}
      {form && <AccountForm key={form === 'new' ? 'new' : form.id} account={form === 'new' ? null : form} ledger={ledger} onClose={() => setForm(null)} />}
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
export function Transfer({ ledger, onClose }: { ledger: Ledger; onClose: () => void }) {
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
