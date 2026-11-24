import clsx from 'clsx'
import { Banknote, Bell, ExternalLink, FileText, HandCoins, Landmark, Paperclip, Printer, Receipt, Search, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { TODAY_ISO, useApp } from '../../state'
import { CASH_ID, eur, members, type Member } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useSession } from '../../session/session'
import { ActionPanel, Badge, Button, Card, Drawer, field, RowMenu, Segmented, Stat, useConfirm, usePaging } from '../../ui'
import { comingFrom } from '../../backTo'
import { dmy } from '../manifest/data'
import { Provisional, useProvisional } from '../manifest/closingPreview'
import { ExpenseDrawer, ExpenseForm } from './Expense'
import { type Entry, type Ledger } from './ledger'
import { openReceiptFile } from './parts'
import { InterimDrawer, payRef, StatementDrawer, StatementSheet } from './Statement'
import { CapSettings, capOf, DepositSplit, depositBlocked, DocChip, docOfEntry, DOC_TITLE, interimOf, invoiceNo, isCharge, MoneyDocDrawer, PayoutPanel, recordDeposit, setCaps, useMoneyDocs, type Interim, type MoneyDoc } from './memberDocs'

const FROM_ACCOUNTS = comingFrom({ label: 'Betriebskonten', to: '/finanzen?tab=konten' })

type Chip = 'nonzero' | 'minus' | 'active'
type View = 'alle' | 'offen'

const dm = (iso: string) => dmy(iso).slice(0, 6)
const lastPayment = (h: Entry[]) => h.find((e) => e.amount > 0 && !e.storno && !e.reversed)

export default function Accounts({ ledger }: { ledger: Ledger }) {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { hasAccount, windDown, can } = useApp()
  const { guarded } = useSession()
  const { accountRules: rules, reminders } = ledger
  const view: View = params.get('ansicht') === 'offen' ? 'offen' : 'alle'
  // The view lives in the address, next to the tab.
  const setView = (v: View) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'offen') n.set('ansicht', 'offen'); else n.delete('ansicht'); n.delete('filter'); return n }, { replace: true })
  const [q, setQ] = useState('')
  const [chips, setChips] = useState<Chip[]>(() => (params.get('filter') === 'minus' ? ['minus'] : []))
  const [sel, setSel] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [expense, setExpense] = useState(false)
  const [remind, setRemind] = useState<string[] | null>(null)
  const [stmt, setStmt] = useState<string | null>(null)
  const [limits, setLimits] = useState<{ remind: string; low: string; cap: string; caps: { memberId: string; amount: string }[] } | null>(null)
  const money = useMoneyDocs()
  const bal = (m: Member) => ledger.balances[m.id] ?? 0
  // Only members whose membership type has a Betriebskonto show up here at all.
  const withAccount = members.filter((m) => hasAccount(m.id))
  const hidden = members.length - withAccount.length
  const test: Record<Chip, (m: Member) => boolean> = { nonzero: (m) => bal(m) !== 0, minus: (m) => bal(m) < 0, active: (m) => m.membership === 'aktiv' }
  const toggleChip = (c: Chip) => setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))

  const matches = withAccount.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
  const overdue = withAccount.filter((m) => bal(m) < rules.remindBelow).sort((a, b) => bal(a) - bal(b))
  const list = view === 'offen' ? overdue.filter((m) => matches.includes(m)) : matches.filter((m) => chips.every((c) => test[c](m)))
  const paging = usePaging(list, `${view}|${q}|${chips.join()}`)
  const owed = withAccount.reduce((n, m) => n + Math.min(0, bal(m)), 0)
  const credit = withAccount.reduce((n, m) => n + Math.max(0, bal(m)), 0)
  const inMinus = withAccount.filter((m) => bal(m) < 0).length
  const incoming = ledger.lines.filter((l) => l.amount > 0 && !ledger.done[l.id])
  const open = withAccount.find((m) => m.id === openId) ?? null
  const chipLabels: [Chip, string][] = [['nonzero', 'Saldo ungleich 0'], ['minus', 'Im Minus'], ['active', 'Nur aktive']]
  const allSelected = list.length > 0 && list.every((m) => sel.includes(m.id))
  const chosen = sel.filter((id) => list.some((m) => m.id === id))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat compact label="Offen bei Mitgliedern" value={eur(owed)} tone={owed < 0 ? 'bad' : undefined} hint={`${inMinus} im Minus`} />
        <Stat compact label="Vorauszahlungen" value={eur(credit)} hint={`${withAccount.filter((m) => bal(m) > 0).length} mit Guthaben`} />
        <Stat compact label="Offene Posten" value={`${overdue.length}`} tone={overdue.length ? 'bad' : undefined} hint={`ab ${eur(rules.remindBelow)}`} />
        <Link to={`/finanzen?tab=bank&konto=${CASH_ID}`} className="block"><Stat compact label="Kassa (Bargeld)" value={eur(ledger.cash)} hint="Buchungen der Kassa" /></Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'alle', label: 'Alle Konten' }, { value: 'offen', label: `Offene Posten (${overdue.length})` }]} />
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mitglied suchen" className="h-9 w-48 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand" />
        </div>
        {view === 'alle' && chipLabels.map(([c, label]) => (
          <button key={c} onClick={() => toggleChip(c)} className={clsx('rounded-full border px-3 py-1 text-sm', chips.includes(c) ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink')}>{label}</button>
        ))}
        {view === 'alle' && chips.length > 0 && <button onClick={() => setChips([])} className="text-sm text-brand">Zurücksetzen</button>}
        <span className="ml-auto text-xs text-muted">{list.length} von {view === 'offen' ? overdue.length : withAccount.length}{hidden > 0 && view === 'alle' && ` · ${hidden} ohne Konto nicht gelistet`}</span>
        {can('billing.accounts.manage') && <Button onClick={() => setLimits({ remind: String(-rules.remindBelow), low: String(rules.lowBelow), cap: String(money.defaultCap), caps: Object.entries(money.caps).map(([memberId, n]) => ({ memberId, amount: String(n) })) })}><Settings2 size={16} /> Grenzen</Button>}
        <Button onClick={() => setExpense(true)}><Receipt size={16} /> Auslage erfassen</Button>
        <Button onClick={() => setPicking(true)}><Banknote size={16} /> Einzahlung bar buchen</Button>
      </div>

      {limits && (
        <ActionPanel title="Grenzen der Betriebskonten" confirm="Speichern" onCancel={() => setLimits(null)} disabled={!(Number(limits.remind) > 0) || !(Number(limits.low) >= 0) || !(Number(limits.cap) > 0) || limits.caps.some((c) => !(Number(c.amount) > 0))}
          onConfirm={() => { guarded('billing.accounts.manage', () => { ledger.setAccountRules({ remindBelow: -Math.abs(Number(limits.remind)), lowBelow: Math.abs(Number(limits.low)) }); setCaps(Number(limits.cap), Object.fromEntries(limits.caps.map((c) => [c.memberId, Number(c.amount)]))); setLimits(null) }) }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Offene Posten ab einem Minus von (€)<input inputMode="decimal" value={limits.remind} onChange={(e) => setLimits({ ...limits, remind: e.target.value })} className={clsx(field, 'mt-1 w-full tabular-nums')} /></label>
            <label className="block text-sm font-medium">Hinweis an das Mitglied unter einem Guthaben von (€)<input inputMode="decimal" value={limits.low} onChange={(e) => setLimits({ ...limits, low: e.target.value })} className={clsx(field, 'mt-1 w-full tabular-nums')} /></label>
          </div>
          <div className="mt-3 border-t border-line pt-3"><CapSettings value={limits} onChange={(v) => setLimits({ ...limits, ...v })} /></div>
        </ActionPanel>
      )}

      {incoming.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warn/40 bg-warn-soft px-4 py-2 text-sm">
          <span className="flex items-center gap-2"><Landmark size={16} /> {incoming.length} eingegangene Überweisung(en) sind noch keinem Konto zugewiesen.</span>
          <Link to="/finanzen?tab=bank" className="font-medium text-brand hover:underline">Zu den Buchungen</Link>
        </Card>
      )}

      <Statements count={withAccount.length} minus={inMinus} plus={withAccount.filter((m) => bal(m) > 0).length} />

      {view === 'offen' && chosen.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2 text-sm">
          <span>{chosen.length} ausgewählt, zusammen {eur(chosen.reduce((n, id) => n + (ledger.balances[id] ?? 0), 0))}</span>
          <Button variant="primary" onClick={() => setRemind(chosen)}><Bell size={16} /> Zahlungserinnerung senden ({chosen.length})</Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {view === 'offen' && <th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Alle auswählen" checked={allSelected} onChange={() => setSel(allSelected ? sel.filter((id) => !list.some((m) => m.id === id)) : [...new Set([...sel, ...list.map((m) => m.id)])])} /></th>}
              <th className="px-4 py-2 font-medium">Mitglied</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">{view === 'offen' ? 'Letzte Einzahlung' : 'Letzte Buchung'}</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Zahlungserinnerung</th>
              <th className="hidden px-4 py-2 text-right font-medium lg:table-cell">Vorauszahlung</th>
              <th className="px-4 py-2 text-right font-medium">Kontostand</th><th className="w-52 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paging.rows.map((m) => {
              const h = ledger.history[m.id] ?? []
              const last = h[0]
              const pay = lastPayment(h)
              const r = reminders[m.id]
              return (
                <tr key={m.id} onClick={() => nav(`/mitglieder/${m.id}?tab=konto`, FROM_ACCOUNTS)} className="cursor-pointer hover:bg-slate-50">
                  {view === 'offen' && <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`${m.name} auswählen`} checked={sel.includes(m.id)} onChange={() => setSel(sel.includes(m.id) ? sel.filter((id) => id !== m.id) : [...sel, m.id])} /></td>}
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{m.name}{windDown(m.id) && <span className="ml-2"><Badge tone="warn">läuft aus</Badge></span>}</td>
                  <td className="hidden px-4 py-2 text-muted sm:table-cell">{view === 'offen' ? (pay ? `${pay.date} ${eur(pay.amount)}` : '–') : last ? `${last.date} ${last.text}` : '–'}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{r ? <span className="text-xs text-muted">erinnert am {dm(r.at)}{r.count > 1 && ` (${r.count}×)`}</span> : bal(m) < 0 ? <span className="text-xs text-muted">nicht erinnert</span> : null}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-brand lg:table-cell">{bal(m) > 0 ? <span className={clsx(bal(m) > capOf(m.id, money) && 'font-semibold text-amber-900')}>{eur(bal(m))}</span> : ''}</td>
                  <td className={clsx('px-4 py-2 text-right font-semibold tabular-nums', bal(m) < 0 && 'text-bad')}>{eur(bal(m))}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {view === 'offen' ? <Button onClick={() => setRemind([m.id])}><Bell size={14} /> Erinnern</Button> : <Button onClick={() => setOpenId(m.id)}>Einzahlung</Button>}
                      <RowMenu actions={[
                        { label: 'Konto öffnen', onSelect: () => nav(`/mitglieder/${m.id}?tab=konto`, FROM_ACCOUNTS) },
                        { label: 'Monatsrechnung ansehen', onSelect: () => setStmt(m.id) },
                        ...(view === 'offen' ? [{ label: 'Einzahlung buchen', onSelect: () => setOpenId(m.id) }] : bal(m) < 0 ? [{ label: 'Zahlungserinnerung senden', onSelect: () => setRemind([m.id]) }] : []),
                      ]} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">{view === 'offen' ? `Kein Konto liegt unter ${eur(rules.remindBelow)}.` : 'Keine Konten.'}</td></tr>}
          </tbody>
        </table>
        {paging.bar}
      </Card>

      {expense && <ExpenseDrawer ledger={ledger} onClose={() => setExpense(false)} />}
      <Drawer open={picking} title="Einzahlung bar buchen" onClose={() => setPicking(false)}>
        <div className="space-y-2 text-sm font-medium">
          Für wen?
          <MemberPicker onChange={(id) => { setPicking(false); setOpenId(id) }} allow={(m) => hasAccount(m.id)} placeholder="Mitglied wählen" info={(m) => <span className={clsx('tabular-nums', bal(m) < 0 && 'text-bad')}>{eur(bal(m))}</span>} />
        </div>
      </Drawer>
      <AccountDrawer member={open} ledger={ledger} onClose={() => setOpenId(null)} />
      <ReminderDrawer ids={remind} ledger={ledger} onClose={() => setRemind(null)} onSent={(ids) => setSel(sel.filter((id) => !ids.includes(id)))} />
      <StatementDrawer memberId={stmt} onClose={() => setStmt(null)} />
    </div>
  )
}

const stmtSteps: { id: 'entwurf' | 'freigabe' | 'versendet'; label: string }[] = [{ id: 'entwurf', label: 'Entwurf' }, { id: 'freigabe', label: 'Zur Freigabe' }, { id: 'versendet', label: 'Versendet' }]
const STMT_MONTH = '2026-10'

/** [Entwurf] Monatsrechnungen (the income document of the Betriebskonten): drafted automatically, sent only after the treasurer approved them. The state is kept in the ledger, the members see it in Mein Konto. */
function Statements({ count, minus, plus }: { count: number; minus: number; plus: number }) {
  const { ledger, can, persona } = useApp()
  const { guarded } = useSession()
  const [preview, setPreview] = useState(false)
  const cf = useConfirm()
  const s = ledger.statements[STMT_MONTH] ?? { state: 'entwurf' as const }
  const at = stmtSteps.findIndex((x) => x.id === s.state)
  const by = members.find((m) => m.id === persona.memberId)?.name ?? ''
  const set = (state: typeof s.state) => guarded('billing.statements.approve', () => ledger.setStatement(STMT_MONTH, state, by))
  const mayApprove = can('billing.statements.approve')
  return (
    <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <div className="min-w-0">
        <div className="font-semibold">Monatsrechnungen Oktober 2026</div>
        <div className="text-xs text-muted">{count} Rechnungen · {minus} im Minus (mit Zahlungshinweis) · {plus} mit Guthaben</div>
      </div>
      <ol className="flex items-center gap-1.5 text-xs">
        {stmtSteps.map((x, i) => (
          <li key={x.id} className="flex items-center gap-1.5">
            <span className={clsx('rounded-full px-2.5 py-1 font-medium', i <= at ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-muted')}>{x.label}</span>
            {i < stmtSteps.length - 1 && <span className="text-slate-300">→</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPreview(true)}>Vorschau ansehen</Button>
        {mayApprove && s.state === 'entwurf' && <Button variant="primary" onClick={() => set('freigabe')}>Zur Freigabe vorlegen</Button>}
        {mayApprove && s.state === 'freigabe' && (
          <>
            <Button onClick={() => set('entwurf')}>Zurück an Entwurf</Button>
            <Button variant="primary" onClick={() => cf.ask({ title: 'Monatsrechnungen senden?', lines: [`${count} Rechnungen Oktober 2026 gehen an die Mitglieder.`, `${minus} davon mit Zahlungshinweis.`, 'Danach nicht mehr änderbar.'], confirm: `An ${count} Mitglieder senden`, run: () => set('versendet') })}>Freigeben und an {count} Mitglieder senden</Button>
          </>
        )}
        {s.state === 'versendet' && <Badge tone="ok">Versendet am {s.at ? dmy(s.at).slice(0, 6) : ''} an {count} Mitglieder{s.by ? ` · ${s.by}` : ''}</Badge>}
      </div>
      <StatementPreview open={preview} onClose={() => setPreview(false)} />
      {cf.dialog}
    </Card>
  )
}

function StatementPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ledger, hasAccount } = useApp()
  const [id, setId] = useState('m4')
  const m = members.find((x) => x.id === id)
  return (
    <Drawer open={open} title="Vorschau Monatsrechnungen Oktober 2026" onClose={onClose}>
      <div className="space-y-4">
        <MemberPicker value={id} onChange={setId} allow={(x) => hasAccount(x.id)} ariaLabel="Mitglied für die Vorschau" info={(x) => <span className={clsx('tabular-nums', (ledger.balances[x.id] ?? 0) < 0 && 'text-bad')}>{eur(ledger.balances[x.id] ?? 0)}</span>} />
        {m && <StatementSheet member={m} month="10" balance={ledger.balances[m.id] ?? 0} history={ledger.history[m.id] ?? []} />}
      </div>
    </Drawer>
  )
}

/** The payment reminder: the treasurer sees the mail of each member before it goes out. */
function ReminderDrawer({ ids, ledger, onClose, onSent }: { ids: string[] | null; ledger: Ledger; onClose: () => void; onSent: (ids: string[]) => void }) {
  const { club, persona } = useApp()
  const [i, setI] = useState(0)
  if (!ids) return null
  const people = ids.map((id) => members.find((m) => m.id === id)!).filter(Boolean)
  const m = people[Math.min(i, people.length - 1)]
  const bal = ledger.balances[m.id] ?? 0
  const by = members.find((x) => x.id === persona.memberId)?.name ?? ''
  return (
    <Drawer open title="Zahlungserinnerung" onClose={() => { setI(0); onClose() }}
      footer={<Button variant="primary" size="lg" className="w-full" onClick={() => { ledger.remind(ids, by); onSent(ids); setI(0); onClose() }}>{people.length === 1 ? 'Zahlungserinnerung senden' : `${people.length} Zahlungserinnerungen senden`}</Button>}>
      <div className="space-y-4 text-sm">
        {people.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {people.map((p, k) => <button key={p.id} onClick={() => setI(k)} className={clsx('rounded-full border px-3 py-1 text-xs', k === i ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:text-ink')}>{p.name} · {eur(ledger.balances[p.id] ?? 0)}</button>)}
          </div>
        )}
        <div className="space-y-3 rounded-xl border border-line bg-white p-4">
          <div className="text-xs text-muted">An: {m.name}</div>
          <div className="font-semibold">Dein Betriebskonto ist im Minus</div>
          <p>Hallo {m.name.split(' ')[0]}, auf deinem Betriebskonto fehlen {eur(Math.max(0, -bal))}. Bitte zahle den Betrag ein, bar beim Kassier oder per Überweisung.</p>
          <div className="rounded-lg bg-slate-50 p-3 text-xs">IBAN {club.iban}<br />Verwendungszweck: <b>{payRef(m)}</b></div>
          <p className="text-xs text-muted">Die letzte Monatsrechnung hängt als PDF an.</p>
        </div>
        {ledger.reminders[m.id] && <p className="text-xs text-muted">Zuletzt erinnert am {dm(ledger.reminders[m.id].at)} von {ledger.reminders[m.id].by}.</p>}
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

const SOURCE_LABEL = { flug: 'Bordbuch', sprungtag: 'Sprungtag', bank: 'Bank', kassa: 'Kassa', auslage: 'Buchung', beitrag: 'Beitrag' } as const

/** Where a booking of the account comes from, as a link to the source and its booking on the money account. */
function SourceLink({ e, ledger }: { e: Entry; ledger: Ledger }) {
  const s = e.source
  if (!s) return null
  const line = s.lineId ? ledger.lines.find((l) => l.id === s.lineId) : undefined
  const to = s.kind === 'flug' ? '/bordbuch' : s.kind === 'sprungtag' ? '/manifest'
    : s.kind === 'bank' ? `/finanzen?tab=bank&konto=${line?.accountId ?? 'acc-bank'}${line ? `&line=${line.id}` : ''}`
    : s.kind === 'kassa' ? `/finanzen?tab=bank&konto=${CASH_ID}${line ? `&line=${line.id}` : ''}`
    : s.kind === 'auslage' ? `/finanzen?tab=auslagen${line ? `&ansicht=gebucht&line=${line.id}` : ''}` : '/finanzen?tab=bank'
  return <Link to={to} state={FROM_ACCOUNTS.state} title="Zur Quelle der Buchung" className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-px text-xs font-medium text-muted hover:text-brand">{SOURCE_LABEL[s.kind]}<ExternalLink size={10} /></Link>
}

/** Cash deposit, assigning incoming transfers and the booking history of one Betriebskonto. Used in a drawer and in the Mitgliederakte. */
export function AccountPanel({ member, ledger, wide = false }: { member: Member; ledger: Ledger; wide?: boolean }) {
  const nav = useNavigate()
  const { club, can, persona } = useApp()
  const { guarded } = useSession()
  const money = useMoneyDocs()
  const cf = useConfirm()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [paying, setPaying] = useState(false)
  const [doc, setDoc] = useState<MoneyDoc | null>(null)
  const [justMade, setJustMade] = useState<MoneyDoc | null>(null)
  const [stmtMonth, setStmtMonth] = useState<string | undefined>(undefined)
  const [interim, setInterim] = useState<Interim | null>(null)
  const interims = money.interims.filter((z) => z.memberId === member.id)
  const [text, setText] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [expensing, setExpensing] = useState(false)
  const [day, setDay] = useState(TODAY_ISO)
  const [stornoAt, setStornoAt] = useState<number | null>(null)
  const [why, setWhy] = useState('')
  const [stmt, setStmt] = useState(false)
  const [remind, setRemind] = useState(false)
  const balance = ledger.balances[member.id] ?? 0
  const suggested = balance < 0 ? -balance : 0
  const value = Number((amount || String(suggested)).replace(',', '.')) || 0
  // Transfers are assigned in Finanzen > Bank. Here only a likely match is offered (a part of the name is in the transfer text).
  const hint = (name: string) => member.name.split(' ').some((p) => name.toLowerCase().includes(p.toLowerCase()))
  const likely = ledger.lines.filter((l) => l.amount > 0 && !ledger.done[l.id] && hint(l.text))
  const history = ledger.history[member.id] ?? []
  const provisional = useProvisional()
  const paging = usePaging(history, `${member.id}|${history.length}`, [10, 25, 50])
  const reminder = ledger.reminders[member.id]
  const closeDeposit = () => { setDepositing(false); setAmount(''); setText(''); setDay(TODAY_ISO); setReason('') }
  const by = members.find((m) => m.id === persona.memberId)?.name ?? ''
  /** A deposit is booked and its document (Quittung for cash, Einzahlungsbestätigung for a transfer) is made at once. Above the cap only by the treasurer. */
  const deposit = (via: 'bank' | 'kassa', value: number, dateIso: string, book: () => void, why = '', lineId?: string) => {
    const run = () => { book(); setJustMade(recordDeposit({ memberId: member.id, amount: value, balance, via, dateIso, lineId, reason: why, by })) }
    if (balance + value > capOf(member.id, money)) guarded('billing.accounts.manage', run)
    else run()
  }
  const askDeposit = (via: 'bank' | 'kassa', value: number, dateIso: string, book: () => void, why: string | undefined, lineId?: string, text?: string) => cf.ask({ title: via === 'kassa' ? 'Bar einbuchen?' : 'Überweisung zuweisen?', lines: [`${member.name}: ${eur(value)} auf das Betriebskonto`, text ?? (via === 'kassa' ? `Bar eingezahlt am ${dmy(dateIso)}, Kassa wird mehr.` : `Bankzeile vom ${dmy(dateIso)}`)], confirm: `${eur(value)} buchen`, run: () => deposit(via, value, dateIso, book, why, lineId) })
  const manage = wide && can('billing.accounts.manage')
  const stornoEntry = stornoAt !== null ? history[stornoAt] : undefined

  const actions = (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{balance > 0 ? 'Guthaben' : 'Kontostand'}</div>
            <div className={clsx('text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad', balance > 0 && 'text-brand')}>{eur(balance)}</div>
            {balance > 0 && <div className={clsx('text-xs', balance > capOf(member.id, money) ? 'font-medium text-amber-900' : 'text-muted')}>Obergrenze {eur(capOf(member.id, money))}</div>}
          </div>
          {!depositing && !expensing && !paying && (
            <div className="flex flex-col items-end">
              <button onClick={() => setDepositing(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-ink"><Banknote size={15} /> Bar einzahlen</button>
              <button onClick={() => setExpensing(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-ink"><Receipt size={15} /> Auslage erfassen</button>
              {balance < 0 && <button onClick={() => setRemind(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-ink"><Bell size={15} /> Zahlungserinnerung</button>}
              {balance > 0 && can('billing.accounts.manage') && <button onClick={() => setPaying(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-ink"><HandCoins size={15} /> Guthaben auszahlen</button>}
            </div>
          )}
        </div>
        {reminder && <div className="mt-1 text-xs text-muted">erinnert am {dm(reminder.at)}{reminder.count > 1 && ` (${reminder.count}×)`} · {reminder.by}</div>}
        <div className="mt-2 border-t border-line pt-2 text-xs text-muted">IBAN {club.iban} · Verwendungszweck <b className="text-ink">{payRef(member)}</b></div>
      </div>

      {justMade && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-ok/30 bg-ok-soft px-3 py-2 text-sm">
          <span>{DOC_TITLE[justMade.kind]} {justMade.no}</span>
          <span className="flex items-center gap-2"><Button onClick={() => setDoc(justMade)}><Printer size={14} /> Drucken</Button><button aria-label="Schließen" onClick={() => setJustMade(null)} className="text-xs text-muted hover:text-ink">✕</button></span>
        </div>
      )}

      {paying && <PayoutPanel member={member} ledger={ledger} onDone={(d) => { setPaying(false); if (d) setJustMade(d) }} />}

      {expensing && (
        <section className="space-y-3 rounded-xl border border-line p-3">
          <h3 className="text-sm font-semibold">Auslage erfassen</h3>
          <ExpenseForm ledger={ledger} memberId={member.id} onDone={() => setExpensing(false)} onCancel={() => setExpensing(false)} />
        </section>
      )}

      {depositing && (
        <section className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Bar einzahlen</h3><button onClick={closeDeposit} className="text-xs text-muted hover:text-ink">Abbrechen</button></div>
          <div className="flex gap-2">
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={suggested ? String(suggested) : 'Betrag'} className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 tabular-nums outline-none focus:border-brand" />
            <Button variant="primary" disabled={value <= 0 || !day || day > TODAY_ISO || depositBlocked(member.id, balance, value, reason)} onClick={() => { deposit('kassa', value, day, () => ledger.cashDeposit(member.id, value, text, day), reason); closeDeposit() }}>Buchen {value > 0 ? eur(value) : ''}</Button>
          </div>
          <div className="flex gap-2">
            <label className="shrink-0 text-xs text-muted">Eingezahlt am<input type="date" value={day} max={TODAY_ISO} onChange={(e) => setDay(e.target.value)} className="mt-0.5 block h-10 rounded-lg border border-line px-2 text-sm text-ink outline-none focus:border-brand" /></label>
            <label className="min-w-0 flex-1 text-xs text-muted">Buchungstext (optional)<input value={text} onChange={(e) => setText(e.target.value)} className="mt-0.5 block h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-brand" /></label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[50, 100, 200, 500].map((n) => <button key={n} onClick={() => setAmount(String(n))} className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">{eur(n)}</button>)}
            {value > 0 && <span className="ml-auto text-xs text-muted">Kassa {eur(ledger.cash)} → <b className="text-ink">{eur(ledger.cash + value)}</b></span>}
          </div>
          <DepositSplit memberId={member.id} balance={balance} amount={value} reason={reason} onReason={setReason} />
        </section>
      )}

      {likely.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Landmark size={16} /> Diese Überweisung passt zum Namen</h3>
          {likely.map((l) => (
            <div key={l.id} className="space-y-2 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.text}</div><div className="text-xs text-muted">{dmy(l.date)}</div></div>
                <div className="font-semibold tabular-nums">{eur(l.amount)}</div>
                <Button disabled={depositBlocked(member.id, balance, l.amount, reasons[l.id] ?? '')} onClick={() => askDeposit('bank', l.amount, l.date, () => ledger.assign(l.id, { kind: 'konto', memberId: member.id }), reasons[l.id], l.id, l.text)}>Zuweisen</Button>
              </div>
              <div className="rounded-lg bg-white/70"><DepositSplit memberId={member.id} balance={balance} amount={l.amount} reason={reasons[l.id]} onReason={(r) => setReasons({ ...reasons, [l.id]: r })} /></div>
            </div>
          ))}
        </section>
      )}

      {wide && <div className="flex flex-wrap gap-4 text-sm"><button onClick={() => nav('/finanzen?tab=konten')} className="inline-flex items-center gap-1 text-brand hover:underline"><ExternalLink size={14} /> Alle Betriebskonten in Finanzen</button><button onClick={() => nav('/finanzen?tab=bank')} className="inline-flex items-center gap-1 text-brand hover:underline"><ExternalLink size={14} /> Buchungen</button></div>}
    </div>
  )

  const list = (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Buchungen</h3><Button onClick={() => { setStmtMonth(undefined); setStmt(true) }}><FileText size={14} /> Monatsrechnung</Button></div>
      {interims.length > 0 && <div className="flex flex-wrap items-center gap-1 text-xs text-muted">Zwischenrechnungen{interims.map((z) => <DocChip key={z.no} label={`${z.no} · ${eur(z.total)}`} onOpen={() => setInterim(z)} />)}</div>}
      {stornoEntry && stornoAt !== null && (
        <ActionPanel danger title={`Storno: ${stornoEntry.text}`} confirm={`${eur(-stornoEntry.amount)} stornieren`} disabled={!why.trim()} onCancel={() => { setStornoAt(null); setWhy('') }}
          onConfirm={() => guarded('billing.accounts.manage', () => { ledger.storno(member.id, stornoAt, why); setStornoAt(null); setWhy('') })}>
          <label className="block text-sm font-medium">Grund<input autoFocus value={why} onChange={(e) => setWhy(e.target.value)} className={clsx(field, 'mt-1 w-full')} /></label>
          {stornoEntry.source?.kind === 'kassa' && <p className="text-xs text-muted">Die Kassa wird mit gegengebucht ({eur(ledger.cash)} → {eur(ledger.cash - stornoEntry.amount)}).</p>}
          {stornoEntry.source?.kind === 'bank' && <p className="text-xs text-muted">Die Bankzeile ist danach wieder offen.</p>}
        </ActionPanel>
      )}
      <div className="divide-y divide-line rounded-xl border border-line">
        {paging.rows.map((e, k) => { const i = paging.start + k; const d = docOfEntry(member.id, e, money.docs); const mm = e.date.slice(3, 5); return (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className={clsx(e.reversed && 'text-muted line-through')}><span className="text-muted">{e.date}</span> {e.text}{e.storno && <Badge>Storno</Badge>}{provisional(e.text) && <Provisional className="ml-1.5" />}{e.receiptId && <ReceiptLink ledger={ledger} id={e.receiptId} />}<SourceLink e={e} ledger={ledger} />
              {d && <DocChip label={`${DOC_TITLE[d.kind]} ${d.no}`} onOpen={() => setDoc(d)} />}
              {(() => { const z = isCharge(e) ? interimOf(member.id, e, money) : undefined; return z && <DocChip label={`Zwischenrechnung ${z.no}`} onOpen={() => setInterim(z)} /> })()}
              {isCharge(e) && !e.storno && !interimOf(member.id, e, money) && <DocChip tone={ledger.statements[`2026-${mm}`]?.state === 'versendet' ? 'ok' : 'muted'} label={`Monatsrechnung ${invoiceNo(member, mm)}`} onOpen={() => { setStmtMonth(mm); setStmt(true) }} />}</span>
            <span className="flex items-center gap-3">
              <span className={clsx('font-medium tabular-nums', e.amount < 0 ? 'text-bad' : 'text-ok', e.reversed && 'opacity-50')}>{e.amount > 0 ? '+ ' : '− '}{eur(Math.abs(e.amount))}</span>
              {manage && !e.reversed && !e.storno && !e.receiptId && <button onClick={() => { setStornoAt(i); setWhy('') }} className="text-xs text-muted hover:text-bad">Stornieren</button>}
            </span>
          </div>
        )})}
        {history.length > 10 && paging.bar}
      </div>
      <StatementDrawer memberId={stmt ? member.id : null} month={stmtMonth} onClose={() => setStmt(false)} />
      <MoneyDocDrawer doc={doc} onClose={() => setDoc(null)} />
      <InterimDrawer interim={interim} onClose={() => setInterim(null)} />
      {cf.dialog}
      <ReminderDrawer ids={remind ? [member.id] : null} ledger={ledger} onClose={() => setRemind(false)} onSent={() => undefined} />
    </section>
  )

  return wide ? <div className="grid gap-6 lg:grid-cols-[380px_1fr]">{actions}{list}</div> : <div className="space-y-6">{actions}{list}</div>
}

/** The link from a booking of the account to the invoice behind it. */
function ReceiptLink({ ledger, id }: { ledger: Ledger; id: string }) {
  const r = ledger.receipts.find((x) => x.id === id)
  if (!r) return null
  return <button onClick={() => openReceiptFile(r.name)} title={r.name} className="ml-2 inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-px text-xs font-medium text-ok hover:underline"><Paperclip size={11} />Beleg</button>
}
