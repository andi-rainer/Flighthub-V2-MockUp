import { useSyncExternalStore } from 'react'
import { fakeRead, type Captured } from './capture'

/**
 * [Entwurf] Belegeingang: files that reached the club (its own mail address, an upload, a phone scan) and are not a receipt yet.
 * The reading runs at once; a person checks the data, then the receipt is created. Prototype only: a small module store.
 */
export const INBOX_ADDRESS = 'belege@sfc-wels.at'
export interface InboxItem {
  id: string; file: string; /** Sender address, "Upload" or "Handy-Scan". */ from: string; /** ISO */ at: string
  /** What was read; null: not read yet. */ read: Captured | null
}

const read = (file: string, p: Partial<Captured>): Captured => ({ ...fakeRead(file, false), ...p, file, read: true })
let items: InboxItem[] = [
  { id: 'in1', file: 'Rechnung_AAT-26-0987.pdf', from: 'rechnungen@aat.at', at: '2026-11-07', read: read('Rechnung_AAT-26-0987.pdf', { supplier: 'Austro Aero Technik GmbH', number: 'AAT-26-0987', date: '2026-11-06', total: '420' }) },
  { id: 'in2', file: 'Hangarmiete-Nov-2026 (1).pdf', from: 'buchhaltung@hangar-wels.at', at: '2026-11-06', read: read('Hangarmiete-Nov-2026 (1).pdf', { supplier: 'Hangar Wels GmbH', number: 'HM-2026-11', date: '2026-11-03', total: '1000' }) },
  { id: 'in3', file: 'Scan-2026-11-07-0912.pdf', from: 'Handy-Scan', at: '2026-11-07', read: null },
]
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => items
const set = (next: InboxItem[]) => { items = next; listeners.forEach((l) => l()) }

export function useInbox() {
  const list = useSyncExternalStore(subscribe, snapshot)
  return {
    list,
    remove: (id: string) => set(items.filter((x) => x.id !== id)),
    /** The reading of a file that was not read yet (the dummy reads on demand). */
    readNow: (id: string) => set(items.map((x) => (x.id === id && !x.read ? { ...x, read: fakeRead(x.file, false) } : x))),
  }
}
