import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { AUSLAGE_ID } from '../../data'
import { field } from '../../ui'
import type { Coding, Ledger } from './ledger'

/** The filters of the bookings and of the invoices: the same fields, so a person finds an invoice and its cost center the same way in both. */
export interface Filters { q: string; account: string; cc: string; cat: string; supplier: string; from: string; to: string; min: string; max: string }
export const NO_FILTERS: Filters = { q: '', account: '', cc: '', cat: '', supplier: '', from: '', to: '', min: '', max: '' }
export const isFiltered = (f: Filters) => Object.values(f).some(Boolean)

const num = (s: string) => Number(s.replace(',', '.'))
export const inRange = (iso: string, f: Filters) => (!f.from || iso >= f.from) && (!f.to || iso <= f.to)
export const amountOk = (amount: number, f: Filters) => (!f.min || Math.abs(amount) >= num(f.min)) && (!f.max || Math.abs(amount) <= num(f.max))
/** Cost center and cost category must both hit the SAME part of a booking. Nothing to compare: only an empty filter passes. */
export const codingOk = (codings: Coding[], f: Filters) =>
  (!f.cc && !f.cat) || codings.some((c) => (!f.cc || c.costCenterId === f.cc) && (!f.cat || c.categoryId === f.cat))
export const textOk = (haystack: (string | number | undefined)[], q: string) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const text = haystack.filter((x) => x !== undefined).join(' ').toLowerCase()
  return words.every((w) => text.includes(w))
}

const small = `${field} w-36`

export function FilterBar({ value, onChange, ledger, accounts, suppliers, amounts = true, children }: {
  value: Filters; onChange: (f: Filters) => void; ledger: Ledger
  /** Show the account filter. */ accounts?: boolean
  /** The suppliers to choose from; none: no supplier filter. */ suppliers?: string[]
  amounts?: boolean
  /** Quick filters next to the fields. */ children?: ReactNode
}) {
  const set = (p: Partial<Filters>) => onChange({ ...value, ...p })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search size={15} className="absolute left-3 top-2.5 text-muted" />
        <input aria-label="Suchen" value={value.q} onChange={(e) => set({ q: e.target.value })} placeholder="Text, Lieferant, Rechnungsnr., Betrag" className={`${field} w-full pl-9`} />
      </div>
      {accounts && (
        <select aria-label="Konto" value={value.account} onChange={(e) => set({ account: e.target.value })} className={field}>
          <option value="">Alle Konten</option>
          {ledger.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value={AUSLAGE_ID}>Auslagen (privat bezahlt)</option>
        </select>
      )}
      {suppliers && (
        <select aria-label="Lieferant" value={value.supplier} onChange={(e) => set({ supplier: e.target.value })} className={`${field} max-w-48`}>
          <option value="">Alle Lieferanten</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <select aria-label="Kostenstelle" value={value.cc} onChange={(e) => set({ cc: e.target.value })} className={field}>
        <option value="">Alle Kostenstellen</option>
        {ledger.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Kostenart" value={value.cat} onChange={(e) => set({ cat: e.target.value })} className={`${field} max-w-52`}>
        <option value="">Alle Kosten- und Ertragsarten</option>
        {ledger.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <span className="flex items-center gap-1 text-xs text-muted">
        <input type="date" aria-label="Datum von" value={value.from} onChange={(e) => set({ from: e.target.value })} className={small} />
        bis
        <input type="date" aria-label="Datum bis" value={value.to} onChange={(e) => set({ to: e.target.value })} className={small} />
      </span>
      {amounts && (
        <span className="flex items-center gap-1 text-xs text-muted">
          <input inputMode="decimal" aria-label="Betrag von" placeholder="Betrag ab" value={value.min} onChange={(e) => set({ min: e.target.value })} className={`${field} w-24 text-right tabular-nums`} />
          bis
          <input inputMode="decimal" aria-label="Betrag bis" placeholder="Betrag bis" value={value.max} onChange={(e) => set({ max: e.target.value })} className={`${field} w-24 text-right tabular-nums`} />
        </span>
      )}
      {children}
      {Object.values(value).some(Boolean) && <button onClick={() => onChange(NO_FILTERS)} className="inline-flex items-center gap-1 text-sm text-brand"><X size={14} /> Zurücksetzen</button>}
    </div>
  )
}
