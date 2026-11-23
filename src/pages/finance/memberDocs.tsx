import clsx from 'clsx'
import { FileCheck2, Plus, X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { CASH_ID, eur, members, type BankLine, type Member } from '../../data'
import MemberPicker from '../../MemberPicker'
import { TODAY_ISO, useApp } from '../../state'
import { useSession } from '../../session/session'
import { ActionPanel, Badge, Button, Drawer, field, Segmented } from '../../ui'
import LetterHead, { LetterFoot } from '../members/LetterHead'
import { dmOf, type Entry, type Ledger } from './ledger'

/**
 * [Entwurf] Documents of the money of a Betriebskonto that is not income: a deposit (Einzahlungsbestätigung for a transfer, Quittung for
 * cash) and a payout of credit (Auszahlungsbeleg). A deposit is a liability (Guthaben, Vorauszahlung); income arises with the charges, and
 * their document is the Monatsrechnung. Prototype state only.
 */
export type MoneyDocKind = 'einzahlung' | 'quittung' | 'auszahlung'
export interface MoneyDoc {
  no: string; kind: MoneyDocKind; memberId: string
  /** Always positive. */ amount: number
  /** "dd.MM." of the booking. */ dm: string
  /** The booking on the money account (bank, Kassa), when known. */ lineId?: string
  /** Balance before and after; unknown for documents made from older bookings. */ before?: number; after?: number
  /** Above the cap (Obergrenze Guthaben): confirmed by the treasurer with a reason. */ over?: { reason: string; by: string }
  /** Payout: why, and the member's IBAN. */ reason?: string; iban?: string
  by: string
}
export const DOC_TITLE: Record<MoneyDocKind, string> = { einzahlung: 'Einzahlungsbestätigung', quittung: 'Quittung', auszahlung: 'Auszahlungsbeleg' }
const PREFIX: Record<MoneyDocKind, string> = { einzahlung: 'EZ', quittung: 'QU', auszahlung: 'AB' }

/**
 * [Entwurf] A Zwischenrechnung: a member asks for an invoice of everything charged up to today that is not invoiced yet. It has its own
 * number and is there at once; the Monatsrechnung of the month later lists only what is left.
 */
export interface Interim { no: string; memberId: string; /** ISO */ date: string; time: string; /** The charges it covers (`chargeKey`). */ keys: string[]; total: number; by: string }

interface Store { defaultCap: number; caps: Record<string, number>; docs: MoneyDoc[]; seq: number; interims: Interim[]; interimSeq: number }
let store: Store = { defaultCap: 2000, caps: { m2: 3000 }, docs: [], seq: 120, interims: [], interimSeq: 0 }
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const set = (p: Partial<Store>) => { store = { ...store, ...p }; listeners.forEach((l) => l()) }

export const useMoneyDocs = () => useSyncExternalStore(subscribe, () => store)
export const capOf = (memberId: string, s: Store = store) => s.caps[memberId] ?? s.defaultCap
export const setCaps = (defaultCap: number, caps: Record<string, number>) => set({ defaultCap, caps })
export const addMoneyDoc = (d: Omit<MoneyDoc, 'no'>): MoneyDoc => {
  const doc = { ...d, no: `${PREFIX[d.kind]}-2026-${String(store.seq + 1).padStart(4, '0')}` }
  set({ docs: [doc, ...store.docs], seq: store.seq + 1 })
  return doc
}

/** [Entwurf] The member's IBAN for a payout. The dummy has no IBAN in the member data, so one is made up from the member number. */
export const memberIban = (m: Pick<Member, 'id'>) => `AT48 3400 0000 0${String(1000 + Number(m.id.replace(/\D/g, '')))} 0042`

/** How a deposit is split: what settles the minus, what becomes credit (Vorauszahlung), and the balance after. */
export function splitDeposit(balance: number, amount: number) {
  const settle = balance < 0 ? Math.min(amount, -balance) : 0
  const r = (n: number) => Math.round(n * 100) / 100
  return { settle: r(settle), credit: r(amount - settle), after: r(balance + amount) }
}

const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9000, 7)

/**
 * The document of a booking of the Betriebskonto that is money in or out (bank or Kassa): the one made when it was booked, or (for bookings
 * made elsewhere, such as a Sprungtag) the automatic one. Charges have none here: their document is the Monatsrechnung.
 */
export function docOfEntry(memberId: string, e: Entry, docs: MoneyDoc[] = store.docs): MoneyDoc | undefined {
  const s = e.source
  if (!s || (s.kind !== 'kassa' && s.kind !== 'bank') || e.storno) return undefined
  const out = e.amount < 0
  const fits = (d: MoneyDoc) => d.memberId === memberId && (d.kind === 'auszahlung') === out && d.amount === Math.abs(e.amount)
  const stored = docs.find((d) => fits(d) && !!s.lineId && d.lineId === s.lineId) ?? docs.find((d) => fits(d) && !d.lineId && d.dm === e.date)
  if (stored || out) return stored
  const kind: MoneyDocKind = s.kind === 'kassa' ? 'quittung' : 'einzahlung'
  return { no: `${PREFIX[kind]}-2026-${String(hash(`${memberId}${e.date}${e.amount}${s.lineId ?? ''}`)).padStart(4, '0')}`, kind, memberId, amount: e.amount, dm: e.date, lineId: s.lineId, by: 'automatisch' }
}

/** The documents of a line on a money account that is booked on Betriebskonten (one per member; a Tageskasse can hold several). */
export function docsOfLine(l: BankLine, ledger: Ledger, docs: MoneyDoc[] = store.docs): MoneyDoc[] {
  const t = ledger.done[l.id]
  const ids = !t ? [] : t.kind === 'konto' ? [t.memberId] : t.kind === 'teilung' ? t.parts.flatMap((p) => (p.target.kind === 'konto' ? [p.target.memberId] : [])) : []
  return [...new Set(ids)].flatMap((id) => {
    const e = (ledger.history[id] ?? []).find((x) => x.source?.lineId === l.id && !x.storno)
    const d = e && docOfEntry(id, e, docs)
    return d ? [d] : []
  })
}

/** [Entwurf] Number of the Monatsrechnung of one member and month: MR-2026-10-0042. */
export const invoiceNo = (m: Pick<Member, 'id'>, mm: string) => `MR-2026-${mm}-${String(40 + Number(m.id.replace(/\D/g, ''))).padStart(4, '0')}`
/** A charge of the Betriebskonto (flight, jump, fee, ticket …): an amount owed, not money in or out. Its document is the Monatsrechnung. */
export const isCharge = (e: Entry) => e.amount < 0 && e.source?.kind !== 'bank' && e.source?.kind !== 'kassa'

/** The dummy keeps no id on an entry of a Betriebskonto: day, text and amount stand for it. */
export const chargeKey = (e: Entry) => `${e.date}|${e.text}|${e.amount}`
/** The Zwischenrechnung that covers this charge, if any. */
export const interimOf = (memberId: string, e: Entry, s: Store = store) => s.interims.find((i) => i.memberId === memberId && i.keys.includes(chargeKey(e)))
/** Charges not invoiced yet: not in a Monatsrechnung that was sent, not in a Zwischenrechnung. */
export const uninvoiced = (memberId: string, history: Entry[], statements: Ledger['statements'], s: Store = store) =>
  history.filter((e) => isCharge(e) && !e.storno && !e.reversed && statements[`2026-${e.date.slice(3, 5)}`]?.state !== 'versendet' && !interimOf(memberId, e, s))
/** Creates the Zwischenrechnung of everything not invoiced yet; nothing to invoice: none. */
export function requestInterim(memberId: string, history: Entry[], statements: Ledger['statements'], by: string): Interim | undefined {
  const open = uninvoiced(memberId, history, statements)
  if (open.length === 0) return undefined
  const i: Interim = { no: `ZR-2026-${String(store.interimSeq + 1).padStart(4, '0')}`, memberId, date: TODAY_ISO, time: new Date().toTimeString().slice(0, 5), keys: open.map(chargeKey), total: Math.round(-open.reduce((n, e) => n + e.amount, 0) * 100) / 100, by }
  set({ interims: [i, ...store.interims], interimSeq: store.interimSeq + 1 })
  return i
}

/** A small chip on a booking that opens its document. */
export function DocChip({ label, onOpen, tone = 'ok' }: { label: string; onOpen: () => void; tone?: 'ok' | 'muted' }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onOpen() }} title={label}
      className={clsx('ml-2 inline-flex items-center gap-1 rounded-full px-2 py-px text-xs font-medium hover:underline', tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-slate-100 text-muted')}>
      <FileCheck2 size={11} />{label}
    </button>
  )
}

/**
 * The split of a deposit before it is booked: what settles the minus and what becomes credit, the balance after. Above the cap the treasurer
 * confirms with a reason (`reason` and `onReason`; without them the line only shows the cap).
 */
export function DepositSplit({ memberId, balance, amount, reason, onReason }: { memberId: string; balance: number; amount: number; reason?: string; onReason?: (r: string) => void }) {
  const docs = useMoneyDocs()
  if (!(amount > 0)) return null
  const { settle, credit, after } = splitDeposit(balance, amount)
  const cap = capOf(memberId, docs)
  const over = after > cap
  return (
    <div className="space-y-2">
      <div className="divide-y divide-line rounded-lg border border-line text-sm">
        {settle > 0 && <div className="flex justify-between px-3 py-1.5"><span>Ausgleich Minus</span><span className="tabular-nums">{eur(settle)}</span></div>}
        {credit > 0 && <div className="flex justify-between px-3 py-1.5"><span>Guthaben</span><span className="tabular-nums">{eur(credit)}</span></div>}
        <div className="flex justify-between px-3 py-1.5 text-xs text-muted"><span>Stand {eur(balance)} → danach</span><b className={clsx('tabular-nums', after < 0 ? 'text-bad' : 'text-ink')}>{eur(after)}</b></div>
      </div>
      {over && (
        <div className="space-y-1.5 rounded-lg border border-warn/40 bg-warn-soft p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2"><span className="font-medium text-amber-900">Über der Obergrenze Guthaben</span><span className="text-xs tabular-nums text-amber-900">{eur(cap)}</span></div>
          {onReason && <label className="block text-xs text-amber-900">Grund<input aria-label="Grund für die Ausnahme" value={reason ?? ''} onChange={(e) => onReason(e.target.value)} className={clsx(field, 'mt-0.5 w-full text-ink')} /></label>}
        </div>
      )}
    </div>
  )
}
/** True when the deposit needs the exception (above the cap) and has no reason yet. */
export const depositBlocked = (memberId: string, balance: number, amount: number, reason: string) => amount > 0 && splitDeposit(balance, amount).after > capOf(memberId) && !reason.trim()

/** Records the document of a deposit that was just booked. */
export function recordDeposit(p: { memberId: string; amount: number; balance: number; via: 'bank' | 'kassa'; dateIso: string; lineId?: string; reason?: string; by: string }) {
  const { after } = splitDeposit(p.balance, p.amount)
  return addMoneyDoc({
    kind: p.via === 'kassa' ? 'quittung' : 'einzahlung', memberId: p.memberId, amount: p.amount, dm: dmOf(p.dateIso), lineId: p.lineId, before: p.balance, after, by: p.by,
    over: after > capOf(p.memberId) ? { reason: p.reason?.trim() ?? '', by: p.by } : undefined,
  })
}

/** The printable document of a deposit or a payout. */
export function MoneyDocSheet({ doc }: { doc: MoneyDoc }) {
  const { branding, club } = useApp()
  const m = members.find((x) => x.id === doc.memberId)
  const split = doc.before !== undefined && doc.kind !== 'auszahlung' ? splitDeposit(doc.before, doc.amount) : undefined
  const row = (label: string, value: string, strong = false) => <tr className={strong ? 'font-semibold' : undefined}><td className="py-1.5 text-muted">{label}</td><td className="py-1.5 text-right tabular-nums">{value}</td></tr>
  return (
    <PrintFrame name={`${DOC_TITLE[doc.kind]} ${doc.no} ${m?.name ?? ''}`}>
      <div {...PRINT_PAGE} className="rounded-xl border border-line bg-white p-5 text-sm shadow-sm">
        <LetterHead design={branding} />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><div className="text-xs text-muted">Betriebskonto</div><div className="font-medium">{m?.name}</div></div>
          <div className="text-right"><div className="font-semibold">{DOC_TITLE[doc.kind]}</div><div className="text-xs text-muted">{doc.no} · {doc.dm}2026</div></div>
        </div>
        <table className="mt-4 w-full text-xs">
          <tbody className="divide-y divide-line">
            {row(doc.kind === 'auszahlung' ? 'Ausgezahlt' : doc.kind === 'quittung' ? 'Bar erhalten' : 'Überweisung erhalten', eur(doc.amount), true)}
            {split && split.settle > 0 && row('Ausgleich Minus', eur(split.settle))}
            {split && split.credit > 0 && row('Guthaben (Vorauszahlung)', eur(split.credit))}
            {doc.before !== undefined && row('Stand vorher', eur(doc.before))}
            {doc.after !== undefined && row('Stand danach', eur(doc.after))}
            {doc.kind === 'auszahlung' && doc.iban && row('Überwiesen auf', doc.iban)}
            {doc.kind === 'auszahlung' && !doc.iban && row('Weg', 'Bar aus der Kassa')}
            {doc.reason && row('Grund', doc.reason)}
            {doc.over && row('Über der Obergrenze bestätigt', `${doc.over.reason} (${doc.over.by})`)}
          </tbody>
        </table>
        {(doc.kind === 'quittung' || (doc.kind === 'auszahlung' && !doc.iban)) && (
          <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-muted">
            <div className="border-t border-line pt-1">{doc.kind === 'quittung' ? `Kassier${doc.by !== 'automatisch' ? `: ${doc.by}` : ''}` : `Erhalten: ${m?.name ?? ''}`}</div>
            <div className="border-t border-line pt-1">{club.name}</div>
          </div>
        )}
        <div className="mt-4 border-t border-line pt-2"><LetterFoot design={branding} /></div>
      </div>
    </PrintFrame>
  )
}

export function MoneyDocDrawer({ doc, onClose }: { doc: MoneyDoc | null; onClose: () => void }) {
  if (!doc) return null
  return <Drawer open title={`${DOC_TITLE[doc.kind]} ${doc.no}`} onClose={onClose}><MoneyDocSheet doc={doc} /></Drawer>
}

/** [Entwurf] Guthaben auszahlen: credit goes back to the member by transfer to the member's IBAN or in cash; reason and confirmation required. */
export function PayoutPanel({ member, ledger, onDone }: { member: Member; ledger: Ledger; onDone: (doc?: MoneyDoc) => void }) {
  const { persona } = useApp()
  const { guarded } = useSession()
  const balance = ledger.balances[member.id] ?? 0
  const [amount, setAmount] = useState(String(balance).replace('.', ','))
  const [via, setVia] = useState<'' | 'bank' | 'kassa'>('')
  const [iban, setIban] = useState(memberIban(member))
  const [reason, setReason] = useState('')
  const [sure, setSure] = useState(false)
  const value = Math.round((Number(amount.replace(',', '.')) || 0) * 100) / 100
  const bank = ledger.accounts.find((a) => a.kind === 'bank' && !a.archived)
  const ok = value > 0 && value <= balance && !!via && reason.trim() !== '' && sure && (via === 'kassa' || iban.trim() !== '') && (via === 'kassa' || !!bank)
  const by = members.find((m) => m.id === persona.memberId)?.name ?? ''
  const pay = () => guarded('billing.accounts.manage', () => {
    const lineId = ledger.payout({ memberId: member.id, amount: value, accountId: via === 'kassa' ? CASH_ID : bank!.id, text: `Auszahlung Guthaben ${via === 'bank' ? 'per Überweisung' : 'bar'}` })
    onDone(addMoneyDoc({ kind: 'auszahlung', memberId: member.id, amount: value, dm: dmOf(TODAY_ISO), lineId, before: balance, after: Math.round((balance - value) * 100) / 100, reason: reason.trim(), iban: via === 'bank' ? iban.trim() : undefined, by }))
  })
  return (
    <ActionPanel title="Guthaben auszahlen" confirm={value > 0 ? `${eur(value)} auszahlen` : 'Auszahlen'} disabled={!ok} onCancel={() => onDone()} onConfirm={pay}>
      <div className="space-y-3 text-sm">
        <label className="block font-medium">Betrag (€)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={clsx(field, 'mt-1 w-full tabular-nums')} /></label>
        {value > balance && <p className="text-xs text-bad">Höchstens das Guthaben von {eur(balance)}.</p>}
        <Segmented<'' | 'bank' | 'kassa'> value={via} onChange={setVia} options={[{ value: 'bank', label: 'Überweisung' }, { value: 'kassa', label: 'Bar aus der Kassa' }]} />
        {via === 'bank' && <label className="block font-medium">IBAN des Mitglieds<input value={iban} onChange={(e) => setIban(e.target.value)} className={clsx(field, 'mt-1 w-full tabular-nums')} /></label>}
        {via === 'kassa' && <p className="text-xs text-muted">Kassa {eur(ledger.cash)} → <b className="text-ink">{eur(ledger.cash - value)}</b></p>}
        <label className="block font-medium">Grund<input value={reason} onChange={(e) => setReason(e.target.value)} className={clsx(field, 'mt-1 w-full')} /></label>
        <div className="flex justify-between text-xs text-muted"><span>Stand {eur(balance)} → danach</span><b className="tabular-nums text-ink">{eur(balance - value)}</b></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> Auszahlung an {member.name} bestätigen</label>
      </div>
    </ActionPanel>
  )
}

/** [Entwurf] The cap of credit (Obergrenze Guthaben): one for all, different ones for single members. Part of the "Grenzen" dialog. */
export function CapSettings({ value, onChange }: { value: { cap: string; caps: { memberId: string; amount: string }[] }; onChange: (v: { cap: string; caps: { memberId: string; amount: string }[] }) => void }) {
  const { hasAccount } = useApp()
  const [adding, setAdding] = useState(false)
  const patch = (i: number, p: Partial<{ memberId: string; amount: string }>) => onChange({ ...value, caps: value.caps.map((c, k) => (k === i ? { ...c, ...p } : c)) })
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Obergrenze Guthaben (€)<input inputMode="decimal" value={value.cap} onChange={(e) => onChange({ ...value, cap: e.target.value })} className={clsx(field, 'mt-1 block w-full tabular-nums sm:w-48')} /></label>
      {value.caps.length > 0 && (
        <div className="divide-y divide-line rounded-lg border border-line">
          {value.caps.map((c, i) => (
            <div key={c.memberId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{members.find((m) => m.id === c.memberId)?.name}</span>
              <input aria-label="Obergrenze" inputMode="decimal" value={c.amount} onChange={(e) => patch(i, { amount: e.target.value })} className={clsx(field, 'w-28 text-right tabular-nums')} />
              <button aria-label="Entfernen" onClick={() => onChange({ ...value, caps: value.caps.filter((_, k) => k !== i) })} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {adding
        ? <MemberPicker placeholder="Mitglied wählen" allow={(m) => hasAccount(m.id) && !value.caps.some((c) => c.memberId === m.id)} onChange={(id) => { if (id) onChange({ ...value, caps: [...value.caps, { memberId: id, amount: value.cap }] }); setAdding(false) }} />
        : <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm text-brand"><Plus size={14} /> Abweichende Obergrenze für ein Mitglied</button>}
    </div>
  )
}

/** The credit of an account, shown distinctly from a minus. */
export function CreditBadge({ balance }: { balance: number }) {
  return balance > 0 ? <Badge tone="info">Guthaben</Badge> : null
}

