import { useState } from 'react'
import {
  AUSLAGE_ID, bankLines, CASH_ID, eur, historyDone, historyLines, historyReceipts, incomeDone, incomeLines, initialCategories, initialCostCenters, initialMoneyAccounts, initialReceipts, initialReleased, members,
  type BankLine, type Category, type CostCenter, type MoneyAccount, type Receipt, type Released, type SingleTarget, type Split, type Target,
} from '../../data'

/** A voucher or ticket was paid (amount > 0) or refunded (amount < 0): by a bank line that was assigned, or by cash. */
export interface PaymentEvent { code: string; amount: number; method: 'cash' | 'bank'; /** "dd.MM." */ date: string; lineId: string; by: string }
export type PaymentTarget = Extract<Target, { kind: 'zahlung' }>
const TODAY = '2026-11-07'
/** "2026-11-07" → "07.11." */
export const dmOf = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`
/** "2026-11-07" → "2026-11" */
export const monthOf = (iso: string) => iso.slice(0, 7)

/** A booking without a receipt is an exception: it is allowed, but never silent (reason, person, day). It ends when a receipt is linked. */
/** Why a booking has no receipt (shared with the Bordbuch). */
export const NO_RECEIPT_REASONS = ['Beleg kommt später', 'Beleg verloren', 'Vereinstankstelle, kein Beleg', 'Barzahlung ohne Beleg', 'Sonstiges'] as const
/** A new receipt: the file AND its data. */
export interface NewReceipt { file: string; supplier: string; number: string; date: string; amount: number; note?: string; lineId?: string; splits?: Split[]; fuel?: { liters: number; perLiter: number }; source?: Receipt['source'] }
export interface NoReceipt { reason: string; by: string; /** "dd.MM." */ at: string }
export interface Entry { date: string; text: string; amount: number; reversed?: boolean; storno?: boolean; /** The invoice behind it (an Auslage): the account links to it. */ receiptId?: string }
/** A change to a booking after it was booked. */
export interface LogEntry { at: string; by: string; text: string }
/** Where an amount of a booking or an invoice is coded: always positive. */
export interface Coding { costCenterId: string; categoryId: string; amount: number }
/**
 * A cash expense of a member (paid privately, for example fuel) waiting for the treasurer. Nothing is booked and nothing is credited before
 * the check; then it is booked on cost centers and credited to the Betriebskonto. Every cash expense goes this way, fuel too.
 */
export interface ExpenseRequest {
  id: string; memberId: string; receiptId: string; description: string; /** ISO */ submitted: string
  status: 'offen' | 'gutgeschrieben' | 'abgelehnt'; rejectReason?: string; decidedBy?: string
  /** Who submitted it, when the treasurer credited someone else (a wrong person was chosen). */
  changedFrom?: string
  origin: 'Mitglied' | 'Bordbuch'
  /** What the member said it was for (fuel of an aircraft): the treasurer starts from it. */
  suggested?: { costCenterId: string; categoryId: string }
}
/** What the treasurer books of an expense: who gets the credit, the receipt as read, the cost coding and the booking text (empty: supplier and number). */
export interface ExpenseBooking { memberId: string; receipt: NewReceipt; splits: Split[]; text?: string }
export type { Released }

/** The cost center coding of an amount: a booking on cost centers codes it by percent, other targets code nothing. */
export function targetCoding(t: Target | undefined, amount: number, receiptId?: string): Coding[] {
  if (!t) return []
  if (t.kind === 'buchung' || t.kind === 'auslage') return t.splits.map((s) => ({ costCenterId: s.costCenterId, categoryId: s.categoryId, amount: Math.round(amount * s.percent) / 100 }))
  if (t.kind === 'teilung') return t.parts.filter((p) => (receiptId ? p.receiptId === receiptId : true)).flatMap((p) => targetCoding(p.target, receiptId ? amount : p.amount))
  return []
}

export interface Ledger {
  lines: BankLine[]
  done: Record<string, Target>
  balances: Record<string, number>
  /** The cash box (Kassa), as a balance of the money account of the same name. */
  cash: number
  history: Record<string, Entry[]>
  receipts: Receipt[]
  /** Lines that are booked without a receipt on purpose. */
  exempt: Record<string, NoReceipt>
  costCenters: CostCenter[]
  categories: Category[]
  accounts: MoneyAccount[]
  /** Released periods ("YYYY-MM"): what they hold is locked. */
  released: Record<string, Released>
  /** Changes made to a booking after it was booked. */
  log: Record<string, LogEntry[]>
  toast: string | null
  label: (t: Target) => string
  kindOf: (t: Target) => string
  balanceOf: (accountId: string) => number
  accountName: (accountId: string) => string
  /** Locked: its period was released. */
  isLocked: (iso: string) => boolean
  /** Where an invoice is coded: by its booking, or, while it is not booked, by what was entered with it. */
  codingOfReceipt: (r: Receipt) => Coding[]
  codingOfLine: (l: BankLine) => Coding[]
  assign: (lineId: string, target: Target) => void
  assignMany: (items: { lineId: string; target: Target }[]) => void
  /** Text and cost centers of a booking that is already booked (its period must be open). */
  editLine: (lineId: string, p: { bookingText?: string; splits?: Split[] }, by: string) => void
  /** A booking by hand, for a cash box, a savings book or whatever the statement does not bring. */
  addLine: (l: { accountId: string; date: string; text: string; amount: number }) => void
  /** Money moves from one account of the club to another: two postings. */
  transfer: (t: { from: string; to: string; amount: number; date: string; text?: string }) => void
  addAccount: (a: Omit<MoneyAccount, 'id'>) => void
  patchAccount: (id: string, p: Partial<MoneyAccount>) => void
  release: (month: string, by: string) => void
  reopen: (month: string, by: string) => void
  /** `date` is the day the money came in (ISO), it may be days before the booking. Default: today. */
  cashDeposit: (memberId: string, amount: number, text?: string, date?: string) => void
  charge: (memberId: string, amount: number, text: string) => void
  storno: (memberId: string, index: number) => void
  /** Cash that came in (amount > 0) or went out for a voucher or ticket: a cash posting with its date, the cash box moves. */
  bookCash: (target: PaymentTarget, amount: number, dateIso: string, by: string) => void
  linkReceipt: (receiptId: string, lineId: string) => void
  unlinkReceipt: (receiptId: string) => void
  markNoReceipt: (lineId: string, reason: string, by: string) => void
  clearNoReceipt: (lineId: string) => void
  /** Returns the id of the new receipt. */
  createReceipt: (r: NewReceipt) => string
  expenses: ExpenseRequest[]
  expenseOf: (receiptId: string) => ExpenseRequest | undefined
  /** A member hands in a cash expense: the receipt is kept, nothing is booked yet. Returns the id of the receipt. */
  submitExpense: (e: { memberId: string; receipt: NewReceipt; description: string; suggested?: ExpenseRequest['suggested']; origin: ExpenseRequest['origin'] }) => string
  /** The treasurer checked it: booked on cost centers and credited to the member. `receipt` is what was checked (corrected if needed). */
  approveExpense: (id: string, e: ExpenseBooking, by: string) => void
  rejectExpense: (id: string, reason: string, by: string) => void
  /** A member paid privately: the invoice is booked on cost centers and the amount is credited to the member's Betriebskonto. */
  bookExpense: (e: ExpenseBooking & { receiptId?: string }) => string
  patchReceipt: (id: string, p: Partial<Pick<Receipt, 'splits'>>) => void
  createCashLine: (receiptId: string) => void
  addCostCenter: (name: string, kind: CostCenter['kind']) => void
  addCategory: (name: string, type: Category['type'], fixed: boolean) => void
  patchCostCenter: (id: string, p: Partial<CostCenter>) => void
  patchCategory: (id: string, p: Partial<Category>) => void
}

/** Cash expenses of members as the treasurer finds them: three to check (one of them fuel from the Bordbuch), one sent back. */
const seedExpenses: ExpenseRequest[] = [
  { id: 'x1', memberId: 'm2', receiptId: 'r9', description: 'Treibstoff OE-DZA, 48 L', submitted: '2026-11-06', status: 'offen', origin: 'Bordbuch', suggested: { costCenterId: 'cc-oedza', categoryId: 'k-fuel' } },
  { id: 'x2', memberId: 'm1', receiptId: 'r10', description: 'Schrauben und Klebeband für den Hangar', submitted: '2026-11-05', status: 'offen', origin: 'Mitglied' },
  { id: 'x3', memberId: 'm4', receiptId: 'r11', description: 'getankt vor dem Charterflug', submitted: '2026-11-04', status: 'offen', origin: 'Mitglied', suggested: { costCenterId: 'cc-oekfr', categoryId: 'k-fuel' } },
  { id: 'x4', memberId: 'm3', receiptId: 'r12', description: 'Kaffee für den Vereinsabend', submitted: '2026-10-30', status: 'abgelehnt', origin: 'Mitglied', rejectReason: 'Bewirtung bitte vorab mit dem Vorstand abstimmen', decidedBy: 'Eva Steiner' },
]

/** Prototype state only. In the real app every one of these is a ledger posting. */
export function useLedger(onPayment?: (e: PaymentEvent) => void): Ledger {
  const [lines, setLines] = useState<BankLine[]>([...bankLines, ...historyLines, ...incomeLines])
  const [done, setDone] = useState<Record<string, Target>>({ ...historyDone, ...incomeDone })
  const [balances, setBalances] = useState<Record<string, number>>(() => Object.fromEntries(members.map((m) => [m.id, m.balance])))
  const [history, setHistory] = useState<Record<string, Entry[]>>(() =>
    Object.fromEntries(members.map((m) => [m.id, [
      { date: '31.10.', text: 'Sprungtag: 1 Sprung', amount: -28 },
      { date: '24.10.', text: 'Einzahlung bar', amount: 100 },
    ]])))
  const [receipts, setReceipts] = useState<Receipt[]>([...initialReceipts, ...historyReceipts])
  const [exempt, setExempt] = useState<Record<string, NoReceipt>>({})
  const dropExempt = (lineId?: string) => lineId && setExempt((e) => { const { [lineId]: _gone, ...rest } = e; return rest })
  const [costCenters, setCostCenters] = useState<CostCenter[]>(initialCostCenters)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [accounts, setAccounts] = useState<MoneyAccount[]>(initialMoneyAccounts)
  const [released, setReleased] = useState<Record<string, Released>>(initialReleased)
  const [log, setLog] = useState<Record<string, LogEntry[]>>({})
  const [expenses, setExpenses] = useState<ExpenseRequest[]>(seedExpenses)
  const [toast, setToast] = useState<string | null>(null)

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500) }
  const note = (lineId: string, by: string, text: string) => setLog((l) => ({ ...l, [lineId]: [{ at: TODAY, by, text }, ...(l[lineId] ?? [])] }))
  /** The list is newest first by booking date; an entry with an earlier date goes below the newer ones. */
  const dayKey = (d: string) => Number(d.slice(3, 5)) * 100 + Number(d.slice(0, 2))
  const addHistory = (id: string, e: Entry) => setHistory((h) => {
    const list = h[id] ?? []
    const at = list.findIndex((x) => dayKey(x.date) <= dayKey(e.date))
    return { ...h, [id]: at < 0 ? [...list, e] : [...list.slice(0, at), e, ...list.slice(at)] }
  })
  const ccName = (id: string) => costCenters.find((c) => c.id === id)?.name ?? '?'
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '?'
  const accountName = (id: string) => (id === AUSLAGE_ID ? 'Auslage' : accounts.find((a) => a.id === id)?.name ?? '?')
  const isLocked = (iso: string) => !!released[monthOf(iso)]
  /** A posting never lands in a released period: it goes to the first open month after it. */
  const postingDate = (iso: string) => {
    let d = iso
    while (released[monthOf(d)]) { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` }
    return d
  }

  const label = (t: Target): string => {
    if (t.kind === 'teilung') return `Aufgeteilt in ${t.parts.length} Teile: ${t.parts.map((p) => `${eur(p.amount)} ${label(p.target)}`).join(' · ')}`
    if (t.kind === 'zahlung' || t.kind === 'umbuchung') return t.label
    if (t.kind === 'konto') return `Betriebskonto ${members.find((m) => m.id === t.memberId)?.name}`
    if (t.kind === 'auslage') return `Auslage ${members.find((m) => m.id === t.memberId)?.name}: ${t.splits.length === 1 ? `${ccName(t.splits[0].costCenterId)} · ${catName(t.splits[0].categoryId)}` : t.splits.map((x) => `${ccName(x.costCenterId)} ${x.percent} %`).join(', ')}`
    if (t.splits.length === 1) return `${ccName(t.splits[0].costCenterId)} · ${catName(t.splits[0].categoryId)}`
    return `Aufgeteilt: ${t.splits.map((s) => `${ccName(s.costCenterId)} ${s.percent} %`).join(', ')}`
  }
  const kindOf = (t: Target) => (t.kind === 'konto' ? 'Betriebskonto' : t.kind === 'zahlung' ? 'Gutschein / Ticket' : t.kind === 'teilung' ? 'Aufgeteilt' : t.kind === 'umbuchung' ? 'Umbuchung' : t.kind === 'auslage' ? 'Auslage' : 'Kostenstelle')
  const balanceOf = (accountId: string) => (accounts.find((a) => a.id === accountId)?.opening ?? 0) + lines.filter((l) => l.accountId === accountId).reduce((n, l) => n + l.amount, 0)

  /** A single target or every part of a split: what each part does (credit an account, pay a voucher or ticket, book on cost centers). */
  const partsOf = (t: Target, line: BankLine): { amount: number; target: SingleTarget; receiptId?: string }[] =>
    t.kind === 'teilung' ? t.parts.map((p) => ({ ...p, amount: line.amount < 0 ? -p.amount : p.amount })) : [{ amount: line.amount, target: t }]

  const apply = (items: { lineId: string; target: Target }[]) => {
    setDone((d) => ({ ...d, ...Object.fromEntries(items.map((i) => [i.lineId, i.target])) }))
    const work = items.flatMap((i) => { const line = lines.find((l) => l.id === i.lineId)!; return partsOf(i.target, line).map((p) => ({ ...p, line })) })
    const credits = work.flatMap((p) => (p.target.kind === 'konto' ? [{ memberId: p.target.memberId, amount: p.amount, line: p.line }] : []))
    setBalances((b) => {
      const n = { ...b }
      for (const c of credits) n[c.memberId] = (n[c.memberId] ?? 0) + c.amount
      return n
    })
    for (const c of credits) addHistory(c.memberId, { date: dmOf(c.line.date), text: `Überweisung zugewiesen: ${c.line.text}`, amount: c.amount })
    for (const p of work) {
      if (p.target.kind === 'zahlung') onPayment?.({ code: p.target.code, amount: p.amount, method: 'bank', date: dmOf(p.line.date), lineId: p.line.id, by: 'Finanzen' })
    }
    // Invoices named in a part are linked to the line, so the collective debit shows all of them.
    const linked = work.flatMap((p) => (p.receiptId ? [{ id: p.receiptId, lineId: p.line.id }] : []))
    if (linked.length > 0) {
      setReceipts((rs) => rs.map((r) => { const hit = linked.find((x) => x.id === r.id); return hit ? { ...r, lineId: hit.lineId, suggestion: undefined } : r }))
      for (const x of linked) dropExempt(x.lineId)
    }
  }

  const newId = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  /** A new line on an account that is booked at once (cash, transfer between accounts). */
  const post = (l: Omit<BankLine, 'id'>, target: Target) => {
    const id = newId('k')
    setLines((ls) => [{ ...l, id }, ...ls])
    setDone((d) => ({ ...d, [id]: target }))
    return id
  }

  const book = ({ memberId, receiptId, receipt, splits, text }: ExpenseBooking & { receiptId?: string }): string => {
      const date = postingDate(receipt.date)
      const lineId = newId('k')
      const rid = receiptId ?? newId('r')
      const who = members.find((m) => m.id === memberId)?.name ?? '?'
      const what = text?.trim() || `${receipt.supplier}${receipt.number ? ` ${receipt.number}` : ''}`
      const mine = { name: receipt.file, supplier: receipt.supplier, number: receipt.number || undefined, amount: receipt.amount, date: receipt.date, note: receipt.note, fuel: receipt.fuel, splits: undefined, paidBy: memberId, lineId, suggestion: undefined }
      setReceipts((rs) => (receiptId ? rs.map((r) => (r.id === receiptId ? { ...r, ...mine } : r)) : [{ id: rid, source: receipt.source ?? 'Upload', ...mine }, ...rs]))
      setLines((ls) => [{ id: lineId, date, text: `Auslage ${who}: ${what}`, amount: -receipt.amount, accountId: AUSLAGE_ID, needsReceipt: true }, ...ls])
      setDone((d) => ({ ...d, [lineId]: { kind: 'auslage', memberId, splits } }))
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) + receipt.amount }))
      addHistory(memberId, { date: dmOf(date), text: `Auslage: ${what}`, amount: receipt.amount, receiptId: rid })
      say(`Auslage gebucht: ${eur(receipt.amount)} · ${who} gutgeschrieben`)
      return rid
    }

  return {
    lines, done, balances, cash: balanceOf(CASH_ID), history, receipts, exempt, costCenters, categories, accounts, released, log, expenses, toast, label, kindOf, balanceOf, accountName, isLocked,
    codingOfLine: (l) => targetCoding(done[l.id], Math.abs(l.amount)),
    codingOfReceipt: (r) => {
      const t = r.lineId ? done[r.lineId] : undefined
      if (t) return targetCoding(t, r.amount, r.id)
      return (r.splits ?? []).map((s) => ({ costCenterId: s.costCenterId, categoryId: s.categoryId, amount: Math.round(r.amount * s.percent) / 100 }))
    },
    assign: (lineId, target) => {
      apply([{ lineId, target }])
      const line = lines.find((l) => l.id === lineId)!
      say(`Gebucht: ${eur(line.amount)} → ${label(target)}`)
    },
    assignMany: (items) => { apply(items); say(`${items.length} Zeilen gebucht`) },
    editLine: (lineId, p, by) => {
      const line = lines.find((l) => l.id === lineId)
      if (!line || isLocked(line.date)) return
      if (p.bookingText !== undefined && (p.bookingText.trim() || undefined) !== line.bookingText) {
        setLines((ls) => ls.map((l) => (l.id === lineId ? { ...l, bookingText: p.bookingText!.trim() || undefined } : l)))
        note(lineId, by, `Buchungstext geändert: ${p.bookingText.trim() || '(wie Bank)'}`)
      }
      const cur = done[lineId]
      if (p.splits && (cur?.kind === 'buchung' || cur?.kind === 'auslage') && JSON.stringify(cur.splits) !== JSON.stringify(p.splits)) {
        const next: Target = { ...cur, splits: p.splits }
        setDone((d) => ({ ...d, [lineId]: next }))
        note(lineId, by, `Kostenstelle geändert: ${label(cur)} → ${label(next)}`)
      }
      say('Buchung geändert')
    },
    addLine: (l) => {
      const date = postingDate(l.date)
      setLines((ls) => [{ id: newId('k'), date, text: l.text, amount: l.amount, accountId: l.accountId, needsReceipt: l.amount < 0 }, ...ls])
      say(`Buchung erfasst auf ${accountName(l.accountId)}${date !== l.date ? ` (im ersten offenen Monat, ${date.split('-').reverse().join('.')})` : ''}`)
    },
    transfer: (t) => {
      const date = postingDate(t.date)
      const text = t.text?.trim() || 'Umbuchung'
      post({ date, text: `${text} an ${accountName(t.to)}`, amount: -t.amount, accountId: t.from, needsReceipt: false }, { kind: 'umbuchung', accountId: t.to, label: `Umbuchung auf ${accountName(t.to)}` })
      post({ date, text: `${text} von ${accountName(t.from)}`, amount: t.amount, accountId: t.to, needsReceipt: false }, { kind: 'umbuchung', accountId: t.from, label: `Umbuchung von ${accountName(t.from)}` })
      say(`Umgebucht: ${eur(t.amount)} von ${accountName(t.from)} auf ${accountName(t.to)}`)
    },
    addAccount: (a) => { setAccounts((x) => [...x, { ...a, id: newId('acc') }]); say(`Konto angelegt: ${a.name}`) },
    patchAccount: (id, p) => setAccounts((x) => x.map((a) => (a.id === id ? { ...a, ...p } : a))),
    release: (month, by) => { setReleased((r) => ({ ...r, [month]: { by, at: TODAY } })); say('Zeitraum freigegeben, die Buchungen sind gesperrt') },
    reopen: (month, by) => {
      const was = released[month]
      setReleased((r) => { const { [month]: _gone, ...rest } = r; return rest })
      for (const l of lines.filter((x) => monthOf(x.date) === month)) note(l.id, by, `Freigabe aufgehoben${was ? ` (war von ${was.by} am ${was.at.split('-').reverse().join('.')} freigegeben)` : ''}`)
      say('Freigabe aufgehoben, die Buchungen sind wieder offen')
    },
    cashDeposit: (memberId, amount, text, date = TODAY) => {
      const booking = text?.trim() || 'Einzahlung bar' // optional text, default as before
      const when = postingDate(date)
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) + amount }))
      post({ date: when, text: `${booking}: ${members.find((m) => m.id === memberId)?.name}`, amount, accountId: CASH_ID, needsReceipt: false }, { kind: 'konto', memberId })
      addHistory(memberId, { date: dmOf(when), text: booking, amount })
      say(`Bar eingezahlt${when === TODAY ? '' : ` (${dmOf(when)})`}: ${eur(amount)} auf Betriebskonto ${members.find((m) => m.id === memberId)?.name}`)
    },
    charge: (memberId, amount, text) => {
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) - amount }))
      addHistory(memberId, { date: dmOf(TODAY), text, amount: -amount })
    },
    storno: (memberId, index) => {
      const e = history[memberId]?.[index]
      if (!e || e.reversed || e.storno) return
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) - e.amount }))
      setHistory((h) => ({ ...h, [memberId]: [{ date: dmOf(TODAY), text: `Storno: ${e.text}`, amount: -e.amount, storno: true }, ...h[memberId].map((x, i) => (i === index ? { ...x, reversed: true } : x))] }))
      say(`Storno gebucht: ${eur(-e.amount)}`)
    },
    bookCash: (target, amount, dateIso, by) => {
      const date = postingDate(dateIso)
      const id = post({ date, text: `${amount > 0 ? 'Bar eingegangen' : 'Bar ausgezahlt'}: ${target.label}`, amount, accountId: CASH_ID, needsReceipt: false }, target)
      onPayment?.({ code: target.code, amount, method: 'cash', date: dmOf(date), lineId: id, by })
      say(`${amount > 0 ? 'Bar gebucht' : 'Bar ausgezahlt'}: ${eur(Math.abs(amount))} · ${target.label}`)
    },
    linkReceipt: (receiptId, lineId) => {
      setReceipts((rs) => rs.map((r) => (r.id === receiptId ? { ...r, lineId, suggestion: undefined } : r)))
      dropExempt(lineId)
      say('Beleg zugeordnet')
    },
    unlinkReceipt: (receiptId) => setReceipts((rs) => rs.map((r) => (r.id === receiptId ? { ...r, lineId: undefined } : r))),
    markNoReceipt: (lineId, reason, by) => { setExempt((e) => ({ ...e, [lineId]: { reason, by, at: dmOf(TODAY) } })); say('Ohne Beleg gebucht: als Ausnahme vermerkt') },
    clearNoReceipt: (lineId) => dropExempt(lineId),
    createReceipt: (r) => {
      const id = newId('r')
      setReceipts((rs) => [{ id, name: r.file, supplier: r.supplier, number: r.number || undefined, amount: r.amount, date: r.date, source: r.source ?? 'Upload', note: r.note, lineId: r.lineId, splits: r.splits, fuel: r.fuel }, ...rs])
      dropExempt(r.lineId)
      say(`Beleg erstellt: ${r.supplier}${r.number ? ` ${r.number}` : ''}`)
      return id
    },
    bookExpense: book,
    expenseOf: (receiptId) => expenses.find((x) => x.receiptId === receiptId),
    submitExpense: ({ memberId, receipt, description, suggested, origin }) => {
      const rid = newId('r')
      setReceipts((rs) => [{ id: rid, name: receipt.file, supplier: receipt.supplier, number: receipt.number || undefined, amount: receipt.amount, date: receipt.date, source: receipt.source ?? 'Upload', fuel: receipt.fuel, paidBy: memberId, note: description }, ...rs])
      setExpenses((x) => [{ id: newId('x'), memberId, receiptId: rid, description, submitted: TODAY, status: 'offen', origin, suggested }, ...x])
      say(`Auslage eingereicht: ${eur(receipt.amount)}. Der Kassier prüft sie, danach wird sie gutgeschrieben.`)
      return rid
    },
    approveExpense: (id, e, by) => {
      const x = expenses.find((r) => r.id === id)
      if (!x || x.status !== 'offen') return
      const { memberId } = e
      book({ ...e, receiptId: x.receiptId })
      setExpenses((all) => all.map((r) => (r.id === id ? { ...r, memberId, description: e.text?.trim() || r.description, changedFrom: memberId !== x.memberId ? x.memberId : undefined, status: 'gutgeschrieben', decidedBy: by } : r)))
    },
    rejectExpense: (id, reason, by) => {
      setExpenses((all) => all.map((e) => (e.id === id ? { ...e, status: 'abgelehnt', rejectReason: reason, decidedBy: by } : e)))
      say('Auslage abgelehnt, das Mitglied sieht den Grund')
    },
    patchReceipt: (id, p) => setReceipts((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r))),
    createCashLine: (receiptId) => {
      const r = receipts.find((x) => x.id === receiptId)!
      const id = newId('k')
      setLines((ls) => [{ id, date: postingDate(r.date), text: `Barausgabe: ${r.supplier}`, amount: -r.amount, accountId: CASH_ID, needsReceipt: true }, ...ls])
      setReceipts((rs) => rs.map((x) => (x.id === receiptId ? { ...x, lineId: id } : x)))
      say(`Kassa-Buchung angelegt: ${eur(-r.amount)}. Jetzt noch Kostenstelle wählen.`)
    },
    addCostCenter: (name, kind) => setCostCenters((c) => [...c, { id: newId('cc'), name, kind }]),
    addCategory: (name, type, fixed) => setCategories((c) => [...c, { id: newId('cat'), name, type, fixed }]),
    patchCostCenter: (id, p) => setCostCenters((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x))),
    patchCategory: (id, p) => setCategories((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x))),
  }
}
