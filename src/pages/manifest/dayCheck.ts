import { useSyncExternalStore } from 'react'
import type { DayReport } from '../finance/cashDocs'

/**
 * [Entwurf] The check of a closed Sprungtag. Everyone with manifest rights may close a day; afterwards it waits for the check by the treasurer
 * or the chairman (`manifest.close.confirm`). They correct what is wrong themselves (a member's amount, with a reason) and lock it
 * ("Prüfen und festschreiben"). There is no way back to the manifest. Prototype state only, kept beside the report.
 */
export interface DayStamp { by: string; /** ISO */ at: string; time: string }
/** A member's amount corrected by the checker. */
export interface DayCorrection extends DayStamp { who: string; memberId: string; from: number; to: number; reason: string }
export interface DayReview {
  /** Checked and locked. */ check?: DayStamp
  /** Corrections by the checker before locking: each one is booked as the difference on the member's Betriebskonto. */ corrections?: DayCorrection[]
}
export type DayCheckState = 'pruefung' | 'fest'
export const DAY_CHECK: Record<DayCheckState, { label: string; tone: 'warn' | 'bad' | 'ok' }> = {
  pruefung: { label: 'Abgeschlossen, Prüfung offen', tone: 'warn' },
  fest: { label: 'Festgeschrieben', tone: 'ok' },
}

/** [Entwurf] A message to a member whose Betriebskonto is in minus after a Sprungtag (mail "Konto im Minus" plus the notice in the app). */
export interface MinusMessage { id: string; memberId: string; balance: number; /** ISO day of the Sprungtag. */ dayDate: string; reportId: string }

let state: { reviews: Record<string, DayReview>; messages: MinusMessage[] } = { reviews: {}, messages: [] }
const listeners = new Set<() => void>()
const set = (next: typeof state) => { state = next; listeners.forEach((l) => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const patch = (id: string, p: Partial<DayReview>) => set({ ...state, reviews: { ...state.reviews, [id]: { ...state.reviews[id], ...p } } })

export const checkStateOf = (r: DayReview | undefined): DayCheckState => (r?.check ? 'fest' : 'pruefung')

export function useDayCheck() {
  const s = useSyncExternalStore(subscribe, () => state)
  return {
    reviewOf: (reportId: string): DayReview => s.reviews[reportId] ?? {},
    /** The current closing of a day (the newest one that was not replaced) and where its check stands. */
    current: (reports: DayReport[], dayId: string) => {
      const report = reports.find((r) => r.dayId === dayId)
      return report ? { report, review: s.reviews[report.id] ?? {}, state: checkStateOf(s.reviews[report.id]) } : undefined
    },
    /** Closings waiting for the check, oldest day first. */
    open: (reports: DayReport[]) => reports.filter((r) => checkStateOf(s.reviews[r.id]) === 'pruefung').sort((a, b) => a.date.localeCompare(b.date)),
    confirm: (reportId: string, stamp: DayStamp) => patch(reportId, { check: stamp }),
    correct: (reportId: string, c: DayCorrection) => patch(reportId, { corrections: [...(state.reviews[reportId]?.corrections ?? []), c] }),
    messages: s.messages,
    sendMinus: (list: Omit<MinusMessage, 'id'>[]) => set({ ...state, messages: [...list.map((m, i) => ({ ...m, id: `mm-${Date.now()}-${i}` })), ...state.messages] }),
  }
}
