import { useSyncExternalStore } from 'react'
import type { Receipt } from '../../data'
import { TODAY_ISO } from '../../state'

/**
 * [Entwurf] Lieferanten as master data: name, IBAN, where their invoices usually go (cost center and category) and, for recurring
 * invoices (insurance, hangar rent), how often one is expected. A period without an invoice is flagged as missing.
 * Prototype only: kept in a small module store so it survives switching tabs.
 */
export type Rhythm = 'monatlich' | 'quartal' | 'jaehrlich'
export const RHYTHM_LABEL: Record<Rhythm, string> = { monatlich: 'monatlich', quartal: 'je Quartal', jaehrlich: 'jährlich' }
export interface Supplier {
  id: string; name: string; iban?: string; email?: string
  /** Where its invoices usually go: prefilled when an invoice of this supplier is created. */
  costCenterId?: string; categoryId?: string
  /** Recurring invoices: one is expected per period from `since` (ISO month "YYYY-MM") on. */
  recurring?: { rhythm: Rhythm; since: string; amount?: number }
}

let suppliers: Supplier[] = [
  { id: 's-hangar', name: 'Hangar Wels GmbH', iban: 'AT61 2032 0000 1234 5678', email: 'buchhaltung@hangar-wels.at', costCenterId: 'cc-oedza', categoryId: 'k-hangar', recurring: { rhythm: 'monatlich', since: '2026-10', amount: 1000 } },
  { id: 's-aero', name: 'Aero-Versicherung AG', iban: 'AT48 1100 0000 9876 5432', costCenterId: 'cc-verein', categoryId: 'k-ins', recurring: { rhythm: 'quartal', since: '2026-10', amount: 1000 } },
  { id: 's-ws', name: 'Wiener Städtische', iban: 'AT02 2011 1000 0000 4711', categoryId: 'k-ins', recurring: { rhythm: 'jaehrlich', since: '2024-01' } },
  { id: 's-aat', name: 'Austro Aero Technik GmbH', iban: 'AT85 3400 0000 0222 1840', email: 'office@aat.at', categoryId: 'k-maint' },
  { id: 's-shell', name: 'Shell Austria', categoryId: 'k-fuel' },
  { id: 's-flugh', name: 'Flughafen Wels Betriebs GmbH', iban: 'AT13 2032 0000 0044 1026', categoryId: 'k-fees', recurring: { rhythm: 'monatlich', since: '2026-11' } },
  { id: 's-hofer', name: 'Fa. Hofer Schlosserei', categoryId: 'k-maint' },
]
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => suppliers
export function useSuppliers() {
  const list = useSyncExternalStore(subscribe, snapshot)
  return {
    list,
    save: (s: Supplier) => { suppliers = suppliers.some((x) => x.id === s.id) ? suppliers.map((x) => (x.id === s.id ? s : x)) : [...suppliers, s]; emit() },
    byName: (name: string) => list.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()),
  }
}
export const newSupplierId = () => `s-${Date.now()}`

/** "2026-10" → the period key and label of the rhythm: "2026-10" / "2026-Q4" / "2026". */
const periodOf = (iso: string, r: Rhythm) => (r === 'monatlich' ? iso.slice(0, 7) : r === 'quartal' ? `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}` : iso.slice(0, 4))
export function periodLabel(key: string) {
  if (/^\d{4}$/.test(key)) return key
  if (key.includes('Q')) return `${key.slice(6)}. Quartal ${key.slice(0, 4)}`
  return new Date(`${key}-01T12:00:00`).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })
}

/** The periods of a recurring supplier up to today that have no invoice of it. */
export function missingPeriods(s: Supplier, receipts: Receipt[]): string[] {
  if (!s.recurring) return []
  const { rhythm, since } = s.recurring
  const have = new Set(receipts.filter((r) => r.supplier === s.name).map((r) => periodOf(r.date, rhythm)))
  const out: string[] = []
  let y = Number(since.slice(0, 4)), m = Number(since.slice(5, 7))
  const end = TODAY_ISO.slice(0, 7)
  const seen = new Set<string>()
  while (`${y}-${String(m).padStart(2, '0')}` <= end) {
    const k = periodOf(`${y}-${String(m).padStart(2, '0')}-01`, rhythm)
    if (!seen.has(k)) { seen.add(k); if (!have.has(k)) out.push(k) }
    m += 1; if (m > 12) { m = 1; y += 1 }
  }
  return out
}
