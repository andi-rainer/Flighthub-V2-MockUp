import { useLocation, useNavigate } from 'react-router-dom'

/** Where a page was opened from. The member file shows a "Zurück zu …" link for it, the browser's back button does the same. */
export interface From { label: string; to: string }
/** Pass as the second argument of `navigate()` when opening a detail page from a list. */
export const comingFrom = (from: From) => ({ state: { from } })

/** The origin of this page (if it was opened from a list) and a function that goes back there. */
export function useBack(fallback: From): { label: string; back: () => void } {
  const nav = useNavigate()
  const from = (useLocation().state as { from?: From } | null)?.from
  // Opened from a list: step back in the history, so the browser's back button and this link behave the same.
  return from ? { label: from.label, back: () => nav(-1) } : { label: fallback.label, back: () => nav(fallback.to) }
}
