import { useState } from 'react'
import { bankLines, eur, initialCategories, initialCostCenters, initialReceipts, members, type BankLine, type Category, type CostCenter, type Receipt, type Target } from '../../data'

export interface Entry { date: string; text: string; amount: number; reversed?: boolean; storno?: boolean }

export interface Ledger {
  lines: BankLine[]
  done: Record<string, Target>
  balances: Record<string, number>
  cash: number
  history: Record<string, Entry[]>
  receipts: Receipt[]
  costCenters: CostCenter[]
  categories: Category[]
  toast: string | null
  label: (t: Target) => string
  kindOf: (t: Target) => string
  assign: (lineId: string, target: Target) => void
  assignMany: (items: { lineId: string; target: Target }[]) => void
  /** `date` is the day the money came in ("dd.MM."), it may be days before the booking. Default: today. */
  cashDeposit: (memberId: string, amount: number, text?: string, date?: string) => void
  charge: (memberId: string, amount: number, text: string) => void
  storno: (memberId: string, index: number) => void
  linkReceipt: (receiptId: string, lineId: string) => void
  unlinkReceipt: (receiptId: string) => void
  uploadReceipt: (name: string, lineId?: string) => void
  createCashLine: (receiptId: string) => void
  addCostCenter: (name: string, kind: CostCenter['kind']) => void
  addCategory: (name: string, type: Category['type'], fixed: boolean) => void
  patchCostCenter: (id: string, p: Partial<CostCenter>) => void
  patchCategory: (id: string, p: Partial<Category>) => void
}

/** Prototype state only. In the real app every one of these is a ledger posting. */
export function useLedger(): Ledger {
  const [lines, setLines] = useState<BankLine[]>(bankLines)
  const [done, setDone] = useState<Record<string, Target>>({})
  const [balances, setBalances] = useState<Record<string, number>>(() => Object.fromEntries(members.map((m) => [m.id, m.balance])))
  const [cash, setCash] = useState(412)
  const [history, setHistory] = useState<Record<string, Entry[]>>(() =>
    Object.fromEntries(members.map((m) => [m.id, [
      { date: '31.10.', text: 'Sprungtag: 1 Sprung', amount: -28 },
      { date: '24.10.', text: 'Einzahlung bar', amount: 100 },
    ]])))
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts)
  const [costCenters, setCostCenters] = useState<CostCenter[]>(initialCostCenters)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [toast, setToast] = useState<string | null>(null)

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500) }
  /** The list is newest first by booking date; an entry with an earlier date goes below the newer ones. */
  const dayKey = (d: string) => Number(d.slice(3, 5)) * 100 + Number(d.slice(0, 2))
  const addHistory = (id: string, e: Entry) => setHistory((h) => {
    const list = h[id] ?? []
    const at = list.findIndex((x) => dayKey(x.date) <= dayKey(e.date))
    return { ...h, [id]: at < 0 ? [...list, e] : [...list.slice(0, at), e, ...list.slice(at)] }
  })
  const ccName = (id: string) => costCenters.find((c) => c.id === id)?.name ?? '?'
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '?'

  const label = (t: Target): string => {
    if (t.kind === 'konto') return `Betriebskonto ${members.find((m) => m.id === t.memberId)?.name}`
    if (t.splits.length === 1) return `${ccName(t.splits[0].costCenterId)} · ${catName(t.splits[0].categoryId)}`
    return `Aufgeteilt: ${t.splits.map((s) => `${ccName(s.costCenterId)} ${s.percent} %`).join(', ')}`
  }
  const kindOf = (t: Target) => (t.kind === 'konto' ? 'Betriebskonto' : 'Kostenstelle')

  const apply = (items: { lineId: string; target: Target }[]) => {
    setDone((d) => ({ ...d, ...Object.fromEntries(items.map((i) => [i.lineId, i.target])) }))
    const credits = items.flatMap((i) => {
      const line = lines.find((l) => l.id === i.lineId)!
      return i.target.kind === 'konto' ? [{ memberId: i.target.memberId, line }] : []
    })
    setBalances((b) => {
      const n = { ...b }
      for (const c of credits) n[c.memberId] = (n[c.memberId] ?? 0) + c.line.amount
      return n
    })
    for (const c of credits) addHistory(c.memberId, { date: c.line.date, text: `Überweisung zugewiesen: ${c.line.text}`, amount: c.line.amount })
  }

  const newId = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  return {
    lines, done, balances, cash, history, receipts, costCenters, categories, toast, label, kindOf,
    assign: (lineId, target) => {
      apply([{ lineId, target }])
      const line = lines.find((l) => l.id === lineId)!
      say(`Gebucht: ${eur(line.amount)} → ${label(target)}`)
    },
    assignMany: (items) => { apply(items); say(`${items.length} Zeilen gebucht`) },
    cashDeposit: (memberId, amount, text, date = '07.11.') => {
      const booking = text?.trim() || 'Einzahlung bar' // optional text, default as before
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) + amount }))
      setCash((c) => c + amount)
      addHistory(memberId, { date, text: booking, amount })
      say(`Bar eingezahlt${date === '07.11.' ? '' : ` (${date})`}: ${eur(amount)} auf Betriebskonto ${members.find((m) => m.id === memberId)?.name}`)
    },
    charge: (memberId, amount, text) => {
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) - amount }))
      addHistory(memberId, { date: '07.11.', text, amount: -amount })
    },
    storno: (memberId, index) => {
      const e = history[memberId]?.[index]
      if (!e || e.reversed || e.storno) return
      setBalances((b) => ({ ...b, [memberId]: (b[memberId] ?? 0) - e.amount }))
      setHistory((h) => ({ ...h, [memberId]: [{ date: '07.11.', text: `Storno: ${e.text}`, amount: -e.amount, storno: true }, ...h[memberId].map((x, i) => (i === index ? { ...x, reversed: true } : x))] }))
      say(`Storno gebucht: ${eur(-e.amount)}`)
    },
    linkReceipt: (receiptId, lineId) => {
      setReceipts((rs) => rs.map((r) => (r.id === receiptId ? { ...r, lineId, suggestion: undefined } : r)))
      say('Beleg zugeordnet')
    },
    unlinkReceipt: (receiptId) => setReceipts((rs) => rs.map((r) => (r.id === receiptId ? { ...r, lineId: undefined } : r))),
    uploadReceipt: (name, lineId) => {
      setReceipts((rs) => [{ id: newId('r'), name, supplier: 'wird ausgelesen …', amount: 0, date: '07.11.', source: 'Upload', lineId }, ...rs])
      say('Beleg hochgeladen. Die KI liest Lieferant und Betrag aus.')
    },
    createCashLine: (receiptId) => {
      const r = receipts.find((x) => x.id === receiptId)!
      const id = newId('k')
      setLines((ls) => [{ id, date: r.date, text: `Barausgabe: ${r.supplier}`, amount: -r.amount, source: 'Kassa', needsReceipt: true }, ...ls])
      setReceipts((rs) => rs.map((x) => (x.id === receiptId ? { ...x, lineId: id } : x)))
      setCash((c) => c - r.amount)
      say(`Kassa-Buchung angelegt: ${eur(-r.amount)}. Jetzt noch Kostenstelle wählen.`)
    },
    addCostCenter: (name, kind) => setCostCenters((c) => [...c, { id: newId('cc'), name, kind }]),
    addCategory: (name, type, fixed) => setCategories((c) => [...c, { id: newId('cat'), name, type, fixed }]),
    patchCostCenter: (id, p) => setCostCenters((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x))),
    patchCategory: (id, p) => setCategories((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x))),
  }
}
