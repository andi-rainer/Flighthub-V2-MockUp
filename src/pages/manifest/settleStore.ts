import { useSyncExternalStore } from 'react'

/**
 * [Entwurf] Settling a sport jumper during the day ("Abrechnen und auschecken"): the jumps flown so far and any Zusatzkosten are charged to
 * the Betriebskonto at once, cash goes into the Kassa as its own booking with a Quittung. The closing of the day only shows what was settled
 * and what is open. Prototype state only, kept beside the ledger.
 */
/**
 * [Entwurf] A correction of a settlement ("Korrigieren"): what was set at "Abrechnen" can change, the payment (cash) and the Zusatzkosten.
 * Only the differences are booked; `changes` says them in plain words. The reason is optional.
 */
export interface SettleFix {
  fromCash: number; toCash: number; reason: string; by: string; time: string
  /** The Kassa booking of the difference and its Quittung (more cash only). */ cashLineId?: string; doc?: string
  /** [Entwurf] The Zusatzkosten before the correction (after: the settlement). */ fromExtras?: SettleExtra[]
  /** [Entwurf] The bookings of the correction ("Packen: 8,00 € belastet"). */ changes?: string[]
  /** [Entwurf] "Load bearbeiten": a flight taken out of the settlement, its seat credited back. */ uncover?: { amount: number; noShow: boolean }
}
/** [Entwurf] One Zusatzkosten item charged with a settlement (Leihgebühr Rig, Packen, Sonstiges with own text). */
export interface SettleExtra { name: string; price: number }
export interface Settlement {
  id: string; dayId: string; memberId: string; name: string
  /** The landed flights this settlement covers; later flights are open again. */ loadIds: number[]
  jumps: number; paidSeats: number; flight?: string
  /** The price of the jumps (without Zusatzkosten). */ price: number
  /** [Entwurf] Zusatzkosten charged with it. */ extras: SettleExtra[]
  /** `bar` as soon as some cash came in; `cash` is the cash after corrections. */ how: 'konto' | 'bar'; cash: number
  /** Betriebskonto before. */ before: number
  time: string; by: string
  /** The member went home with it. */ checkedOut: boolean
  cashLineId?: string; doc?: string
  /** Corrections of the payment at the closing: each books only the difference. */ fixes: SettleFix[]
}
const r2 = (n: number) => Math.round(n * 100) / 100
export const extrasTotal = (xs: SettleExtra[]) => r2(xs.reduce((n, x) => n + x.price, 0))
/** What the member pays for this settlement: jumps plus Zusatzkosten. Corrections never change it. */
export const settledPrice = (s: Settlement) => r2(s.price + extrasTotal(s.extras))

/** A cash deposit of a member during the day (not a settlement). */
export interface DayDeposit { id: string; dayId: string; memberId: string; name: string; amount: number; time: string; by: string; cashLineId?: string; doc?: string }

let state: { settlements: Settlement[]; deposits: DayDeposit[] } = { settlements: [], deposits: [] }
const listeners = new Set<() => void>()
const set = (next: typeof state) => { state = next; listeners.forEach((l) => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export const nowHm = () => new Date().toTimeString().slice(0, 5)
const nid = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export function useSettleStore() {
  const s = useSyncExternalStore(subscribe, () => state)
  return {
    of: (dayId: string) => s.settlements.filter((x) => x.dayId === dayId),
    deposits: (dayId: string) => s.deposits.filter((x) => x.dayId === dayId),
    add: (x: Omit<Settlement, 'id' | 'fixes'>) => set({ ...state, settlements: [...state.settlements, { ...x, id: nid('st'), fixes: [] }] }),
    fix: (id: string, f: SettleFix, extras?: SettleExtra[]) => set({ ...state, settlements: state.settlements.map((x) => (x.id === id ? { ...x, cash: f.toCash, how: f.toCash > 0 ? 'bar' : 'konto', extras: extras ?? x.extras, fixes: [...x.fixes, f] } : x)) }),
    /** [Entwurf] A flight was taken out of a settlement ("Load bearbeiten": the member was not on it); the credit is booked by the caller. */
    uncover: (id: string, p: Pick<Settlement, 'loadIds' | 'jumps' | 'paidSeats' | 'price' | 'flight'>, f: SettleFix) => set({ ...state, settlements: state.settlements.map((x) => (x.id === id ? { ...x, ...p, fixes: [...x.fixes, f] } : x)) }),
    deposit: (x: Omit<DayDeposit, 'id'>) => set({ ...state, deposits: [...state.deposits, { ...x, id: nid('dp') }] }),
  }
}
