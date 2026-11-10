import { members } from '../../data'

/** What happened to a document of a member (history, newest last). */
export interface DocEvent { at: string; by: string; text: string }
/** A newer document that a member announced and that still has to be checked against the original. */
export interface Submission { expires: string; number?: string; by: string; at: string }
/** A licence, medical or other document of a member. `expires` is ISO. No file is stored (privacy): a person who checked the original confirms it, and that is in the history. */
export interface MemberDoc { id: string; label: string; expires: string; number?: string; history: DocEvent[]; submitted?: Submission }

export type DocState = 'ok' | 'bald' | 'abgelaufen'
export type MemberDocView = MemberDoc & { state: DocState }
/** A document that runs out within this many days is shown as "läuft bald ab". */
export const SOON_DAYS = 45
export const STATE_LABEL: Record<DocState, string> = { ok: 'gültig', bald: 'läuft bald ab', abgelaufen: 'abgelaufen' }
export const STATE_TONE = { ok: 'ok', bald: 'warn', abgelaufen: 'bad' } as const

export function docStateOf(expires: string, todayIso: string): DocState {
  if (expires < todayIso) return 'abgelaufen'
  return (Date.parse(expires) - Date.parse(todayIso)) / 86400000 <= SOON_DAYS ? 'bald' : 'ok'
}

/** The one thing the manifest shows next to a person: the first document that needs attention, and whether a newer one waits for a check. */
export function docIssue(docs: MemberDocView[]): { label: string; tone: 'bad' | 'warn' } | null {
  const bad = docs.filter((d) => d.state === 'abgelaufen')
  if (bad.length === 0) return null
  const first = bad[0]
  const more = bad.length > 1 ? ` +${bad.length - 1}` : ''
  return first.submitted ? { label: `${first.label}: zur Prüfung${more}`, tone: 'warn' } : { label: `${first.label} abgelaufen${more}`, tone: 'bad' }
}

const iso = (dmy: string) => dmy.split('.').reverse().join('-')
/** Dummy: the documents of the seed members, one pending submission to show the check. */
export const seedMemberDocs: Record<string, MemberDoc[]> = Object.fromEntries(members.map((m) => [m.id, m.docs.map((d, i): MemberDoc => ({
  id: `${m.id}-${i}`, label: d.label, expires: iso(d.expires), history: [{ at: '2026-01-12', by: 'Eva Steiner', text: 'Erfasst' }],
  ...(m.id === 'm5' && d.label === 'Medical' ? { submitted: { expires: '2028-11-19', by: 'Eva Steiner', at: '2026-11-06' } } : {}),
}))]))
