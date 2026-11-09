import clsx from 'clsx'
import { Banknote, ExternalLink, Landmark, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TODAY_ISO, useApp } from '../../state'
import { eur, members, type Member } from '../../data'
import { Badge, Button, Card, Drawer, RowMenu, Stat, usePaging } from '../../ui'
import { comingFrom } from '../../backTo'
import { type Ledger } from './ledger'

const FROM_ACCOUNTS = comingFrom({ label: 'Betriebskonten', to: '/finanzen?tab=konten' })

type Chip = 'nonzero' | 'minus' | 'active' | 'attention'

const ATTENTION_BELOW = -100 // balances deeper in the minus than this need a look

export default function Accounts({ ledger }: { ledger: Ledger }) {
  const nav = useNavigate()
  const { hasAccount, windDown } = useApp()
  const [q, setQ] = useState('')
  const [chips, setChips] = useState<Chip[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const bal = (m: Member) => ledger.balances[m.id] ?? 0
  // Only members whose membership type has a Betriebskonto show up here at all. No filter workaround needed.
  const withAccount = members.filter((m) => hasAccount(m.id))
  const hidden = members.length - withAccount.length
  const test: Record<Chip, (m: Member) => boolean> = {
    nonzero: (m) => bal(m) !== 0, minus: (m) => bal(m) < 0, active: (m) => m.membership === 'aktiv', attention: (m) => bal(m) < ATTENTION_BELOW,
  }
  const toggleChip = (c: Chip) => setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))

  const list = withAccount.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) && chips.every((c) => test[c](m)))
  const paging = usePaging(list, `${q}|${chips.join()}`)
  const owed = withAccount.reduce((n, m) => n + Math.min(0, bal(m)), 0)
  const credit = withAccount.reduce((n, m) => n + Math.max(0, bal(m)), 0)
  const incoming = ledger.lines.filter((l) => l.amount > 0 && !ledger.done[l.id])
  const open = withAccount.find((m) => m.id === openId) ?? null
  const chipLabels: [Chip, string][] = [['nonzero', 'Saldo ungleich 0'], ['minus', 'Im Minus'], ['active', 'Nur aktive'], ['attention', `Braucht Aufmerksamkeit (unter ${eur(ATTENTION_BELOW)})`]]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Offen bei Mitgliedern" value={eur(owed)} tone={owed < 0 ? 'bad' : undefined} hint="Betriebskonten im Minus" />
        <Stat label="Guthaben der Mitglieder" value={eur(credit)} hint="Verbindlichkeit des Vereins" />
        <Stat label="Kassa (Bargeld)" value={eur(ledger.cash)} hint="steigt mit jeder Bar-Einzahlung" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mitglied suchen" className="h-9 w-56 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand" />
        </div>
        <Button onClick={() => setPicking(true)}><Banknote size={16} /> Einzahlung bar buchen</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chipLabels.map(([c, label]) => (
          <button key={c} onClick={() => toggleChip(c)} className={clsx('rounded-full border px-3 py-1 text-sm', chips.includes(c) ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink')}>{label}</button>
        ))}
        {chips.length > 0 && <button onClick={() => setChips([])} className="text-sm text-brand">Zurücksetzen</button>}
        <span className="ml-auto text-xs text-muted">{list.length} von {withAccount.length} Konten{hidden > 0 && ` · ${hidden} Mitglieder ohne Konto nicht gelistet`}</span>
      </div>

      {incoming.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warn/40 bg-warn-soft px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><Landmark size={16} /> {incoming.length} eingegangene Überweisung(en) sind noch keinem Konto zugewiesen.</span>
          <span className="text-muted">Im Konto des Mitglieds zuweisen oder unter Bank und Belege bestätigen.</span>
        </Card>
      )}

      <Statements count={withAccount.length} minus={withAccount.filter((m) => bal(m) < 0).length} plus={withAccount.filter((m) => bal(m) > 0).length} />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3 font-medium">Mitglied</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Letzte Buchung</th><th className="px-4 py-3 text-right font-medium">Kontostand</th><th className="w-52 px-2 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paging.rows.map((m) => {
              const last = ledger.history[m.id]?.[0]
              return (
                <tr key={m.id} onClick={() => nav(`/mitglieder/${m.id}?tab=konto`, FROM_ACCOUNTS)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{m.name}{windDown(m.id) && <span className="ml-2"><Badge tone="warn">läuft aus</Badge></span>}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{last ? `${last.date} ${last.text}` : '–'}</td>
                  <td className={clsx('px-4 py-3 text-right font-semibold tabular-nums', bal(m) < 0 && 'text-bad')}>{eur(bal(m))}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button onClick={() => setOpenId(m.id)}>Einzahlung</Button>
                      <RowMenu actions={[{ label: 'Konto öffnen', onSelect: () => nav(`/mitglieder/${m.id}?tab=konto`, FROM_ACCOUNTS) }]} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {paging.bar}
      </Card>

      <MemberPicker open={picking} onClose={() => setPicking(false)} onPick={(id) => { setPicking(false); setOpenId(id) }} />
      <AccountDrawer member={open} ledger={ledger} onClose={() => setOpenId(null)} />
    </div>
  )
}

type StmtState = 'entwurf' | 'freigabe' | 'versendet'
const stmtSteps: { id: StmtState; label: string }[] = [{ id: 'entwurf', label: 'Entwurf' }, { id: 'freigabe', label: 'Zur Freigabe' }, { id: 'versendet', label: 'Versendet' }]

/** Month-end statements: drafted automatically, sent only after the treasurer approved them. */
function Statements({ count, minus, plus }: { count: number; minus: number; plus: number }) {
  const [state, setState] = useState<StmtState>('entwurf')
  const at = stmtSteps.findIndex((s) => s.id === state)
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-semibold">Kontoauszüge Oktober 2026</div>
          <div className="mt-1 text-sm text-muted">{count} Auszüge · {minus} im Minus (mit Zahlungshinweis) · {plus} im Plus. Versand erst nach Freigabe durch den Kassier.</div>
          <ol className="mt-3 flex items-center gap-2 text-xs">
            {stmtSteps.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className={clsx('rounded-full px-2.5 py-1 font-medium', i <= at ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-muted')}>{s.label}</span>
                {i < stmtSteps.length - 1 && <span className="text-slate-300">→</span>}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Vorschau ansehen</Button>
          {state === 'entwurf' && <Button variant="primary" onClick={() => setState('freigabe')}>Zur Freigabe vorlegen</Button>}
          {state === 'freigabe' && (
            <>
              <Button onClick={() => setState('entwurf')}>Zurück an Entwurf</Button>
              <Button variant="primary" onClick={() => setState('versendet')}>Freigeben und an {count} Mitglieder senden</Button>
            </>
          )}
          {state === 'versendet' && <Badge tone="ok">Versendet am 07.11. an {count} Mitglieder</Badge>}
        </div>
      </div>
      {state === 'freigabe' && <p className="mt-3 text-xs text-muted">Nur Personen mit der Berechtigung „Kontoauszüge freigeben“ sehen diesen Button. Nichts wird automatisch verschickt.</p>}
    </Card>
  )
}

function MemberPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const { hasAccount } = useApp()
  const [q, setQ] = useState('')
  return (
    <Drawer open={open} title="Für wen?" onClose={onClose}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mitglied suchen" className="h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand" />
      <div className="mt-3 space-y-2">
        {members.filter((m) => hasAccount(m.id) && m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-line px-4 text-left hover:bg-slate-50"><span className="font-medium">{m.name}</span></button>
        ))}
      </div>
    </Drawer>
  )
}

function AccountDrawer({ member, ledger, onClose }: { member: Member | null; ledger: Ledger; onClose: () => void }) {
  if (!member) return null
  return (
    <Drawer open title={member.name} onClose={onClose}>
      <AccountPanel member={member} ledger={ledger} />
    </Drawer>
  )
}

/** Cash deposit, assigning incoming transfers and the booking history of one Betriebskonto. Used in a drawer and in the Mitgliederakte. */
export function AccountPanel({ member, ledger, wide = false }: { member: Member; ledger: Ledger; wide?: boolean }) {
  const nav = useNavigate()
  const [amount, setAmount] = useState('')
  const [text, setText] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [day, setDay] = useState(TODAY_ISO)
  const balance = ledger.balances[member.id] ?? 0
  const suggested = balance < 0 ? -balance : 0
  const value = Number((amount || String(suggested)).replace(',', '.')) || 0
  // Transfers are assigned in Finanzen > Bank. Here only a likely match is offered (a part of the name is in the transfer text).
  const hint = (name: string) => member.name.split(' ').some((p) => name.toLowerCase().includes(p.toLowerCase()))
  const likely = ledger.lines.filter((l) => l.amount > 0 && !ledger.done[l.id] && hint(l.text))
  const history = ledger.history[member.id] ?? []
  const paging = usePaging(history, `${member.id}|${history.length}`, [10, 25, 50])
  const closeDeposit = () => { setDepositing(false); setAmount(''); setText(''); setDay(TODAY_ISO) }

  const actions = (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Kontostand</div>
            <div className={clsx('text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</div>
          </div>
          {!depositing && <button onClick={() => setDepositing(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-ink"><Banknote size={15} /> Bar einzahlen</button>}
        </div>
        <div className="mt-1 text-xs text-muted">{balance < 0 ? 'Mitglied schuldet dem Verein diesen Betrag.' : balance > 0 ? 'Guthaben, wird mit den nächsten Sprüngen verbraucht.' : 'ausgeglichen'}</div>
      </div>

      {depositing && (
        <section className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Bar einzahlen</h3><button onClick={closeDeposit} className="text-xs text-muted hover:text-ink">Abbrechen</button></div>
          <div className="flex gap-2">
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={suggested ? String(suggested) : 'Betrag'} className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 tabular-nums outline-none focus:border-brand" />
            <Button variant="primary" disabled={value <= 0 || !day || day > TODAY_ISO} onClick={() => { ledger.cashDeposit(member.id, value, text, `${day.slice(8)}.${day.slice(5, 7)}.`); closeDeposit() }}>Buchen {value > 0 ? eur(value) : ''}</Button>
          </div>
          <div className="flex gap-2">
            <label className="shrink-0 text-xs text-muted">Eingezahlt am<input type="date" value={day} max={TODAY_ISO} onChange={(e) => setDay(e.target.value)} className="mt-0.5 block h-10 rounded-lg border border-line px-2 text-sm text-ink outline-none focus:border-brand" /></label>
            <label className="min-w-0 flex-1 text-xs text-muted">Buchungstext (optional)<input value={text} onChange={(e) => setText(e.target.value)} className="mt-0.5 block h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-brand" /></label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[50, 100, 200, 500].map((n) => <button key={n} onClick={() => setAmount(String(n))} className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">{eur(n)}</button>)}
          </div>
        </section>
      )}

      {likely.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Landmark size={16} /> Diese Überweisung passt zum Namen</h3>
          {likely.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.text}</div><div className="text-xs text-muted">{l.date}</div></div>
              <div className="font-semibold tabular-nums">{eur(l.amount)}</div>
              <Button onClick={() => ledger.assign(l.id, { kind: 'konto', memberId: member.id })}>Zuweisen</Button>
            </div>
          ))}
        </section>
      )}

      {wide && <div className="flex flex-wrap gap-4 text-sm"><button onClick={() => nav('/finanzen?tab=konten')} className="inline-flex items-center gap-1 text-brand hover:underline"><ExternalLink size={14} /> Alle Betriebskonten in Finanzen</button><button onClick={() => nav('/finanzen?tab=bank')} className="inline-flex items-center gap-1 text-brand hover:underline"><ExternalLink size={14} /> Bank und Belege</button></div>}
    </div>
  )

  const list = (
    <section>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Buchungen</h3>{wide && <Button>Kontoauszug als PDF</Button>}</div>
      <div className="divide-y divide-line rounded-xl border border-line">
        {paging.rows.map((e, k) => { const i = paging.start + k; return (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className={clsx(e.reversed && 'text-muted line-through')}><span className="text-muted">{e.date}</span> {e.text}{e.storno && <Badge>Storno</Badge>}</span>
            <span className="flex items-center gap-3">
              <span className={clsx('font-medium tabular-nums', e.amount < 0 ? 'text-bad' : 'text-ok', e.reversed && 'opacity-50')}>{e.amount > 0 ? '+ ' : '− '}{eur(Math.abs(e.amount))}</span>
              {wide && !e.reversed && !e.storno && <button onClick={() => ledger.storno(member.id, i)} className="text-xs text-muted hover:text-bad">Stornieren</button>}
            </span>
          </div>
        )})}
        {history.length > 10 && paging.bar}
      </div>
      {wide && <p className="mt-2 text-xs text-muted">Buchungen werden nie geändert oder gelöscht. Ein Storno erzeugt eine Gegenbuchung und bleibt sichtbar.</p>}
    </section>
  )

  return wide ? <div className="grid gap-6 lg:grid-cols-[380px_1fr]">{actions}{list}</div> : <div className="space-y-6">{actions}{list}</div>
}
