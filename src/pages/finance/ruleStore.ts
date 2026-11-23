import { useSyncExternalStore } from 'react'
import { type BankLine, type Split, type Target } from '../../data'
import { type Ledger } from './ledger'

/**
 * [Entwurf] An assignment rule of the club: "bank text (or IBAN) contains X" → a target. A rule only SUGGESTS; the person still confirms.
 * Rules are the club's own, so the suggestions are not a black box: every suggestion from a rule names it.
 */
export interface Rule {
  id: string; name: string
  /** The bank text contains this (case does not matter). */ match: string
  iban?: string
  dir: 'alle' | 'ein' | 'aus'
  target: { kind: 'buchung'; splits: Split[] } | { kind: 'umbuchung'; accountId: string } | { kind: 'konto'; memberId: string }
  /** The invoice is expected from this supplier: its open invoice is suggested for the booking. */ supplier?: string
  active: boolean
  by: string; at: string
}

let rules: Rule[] = [
  { id: 'rule-1', name: 'Shell Treibstoff', match: 'Shell Austria', dir: 'aus', target: { kind: 'buchung', splits: [{ costCenterId: 'cc-oedza', categoryId: 'k-fuel', percent: 100 }] }, supplier: 'Shell Austria', active: true, by: 'Eva Steiner', at: '2026-03-12' },
  { id: 'rule-2', name: 'Bankomat in die Kassa', match: 'Bankomat', dir: 'aus', target: { kind: 'umbuchung', accountId: 'acc-kassa' }, active: true, by: 'Eva Steiner', at: '2026-01-08' },
  { id: 'rule-3', name: 'Sparbuch-Rücklage', match: 'Sparbuch', dir: 'aus', target: { kind: 'umbuchung', accountId: 'acc-spar' }, active: true, by: 'Eva Steiner', at: '2026-01-08' },
  { id: 'rule-4', name: 'Landegebühren Wels', match: 'Flughafen Wels', dir: 'aus', target: { kind: 'buchung', splits: [{ costCenterId: 'cc-oedza', categoryId: 'k-fees', percent: 100 }] }, supplier: 'Flughafen Wels Betriebs GmbH', active: true, by: 'Eva Steiner', at: '2025-11-20' },
  { id: 'rule-5', name: 'Hofer Schlosserei', match: 'Hofer Schlosserei', dir: 'aus', target: { kind: 'buchung', splits: [{ costCenterId: 'cc-oeaxb', categoryId: 'k-maint', percent: 100 }] }, supplier: 'Fa. Hofer Schlosserei', active: false, by: 'Eva Steiner', at: '2025-02-03' },
]
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export const useRules = () => useSyncExternalStore(subscribe, () => rules)
export const saveRule = (r: Rule) => { rules = rules.some((x) => x.id === r.id) ? rules.map((x) => (x.id === r.id ? r : x)) : [...rules, r]; emit() }
export const removeRule = (id: string) => { rules = rules.filter((r) => r.id !== id); emit() }
export const newRuleId = () => `rule-${Date.now()}`

export const ruleHits = (r: Rule, l: BankLine) =>
  r.match.trim() !== '' && l.text.toLowerCase().includes(r.match.trim().toLowerCase()) && (r.dir === 'alle' || (r.dir === 'ein') === l.amount > 0)
/** The first active rule that fits the line. */
export const ruleOf = (l: BankLine, all: Rule[]) => all.find((r) => r.active && ruleHits(r, l))

export const ruleTarget = (r: Rule, ledger: Ledger): Target =>
  r.target.kind === 'umbuchung' ? { kind: 'umbuchung', accountId: r.target.accountId, label: `Umbuchung auf ${ledger.accountName(r.target.accountId)}` } : r.target

/** What is suggested for a line: its own suggestion (bank match, AI), or else the suggestion of a rule. `rule` names the rule behind it. */
export function suggestionOf(l: BankLine, ledger: Ledger, all: Rule[]): (NonNullable<BankLine['suggestion']> & { rule?: Rule }) | undefined {
  const r = ruleOf(l, all)
  if (l.suggestion) return { ...l.suggestion, rule: r && JSON.stringify(ruleTarget(r, ledger)) === JSON.stringify(l.suggestion.target) ? r : undefined }
  if (!r) {
    // The counter booking of a transfer that another account already suggests (cash deposit in the Kassa ↔ ATM withdrawal on the bank).
    const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000
    const other = ledger.lines.find((x) => {
      if (x.id === l.id || x.accountId === l.accountId || ledger.done[x.id] || x.amount !== -l.amount || Math.abs(day(x.date) - day(l.date)) > 7) return false
      const t = x.suggestion?.target ?? (ruleOf(x, all) ? ruleTarget(ruleOf(x, all)!, ledger) : undefined)
      return t?.kind === 'umbuchung' && t.accountId === l.accountId
    })
    return other && { target: { kind: 'umbuchung', accountId: other.accountId, label: `Umbuchung ${l.amount < 0 ? 'auf' : 'von'} ${ledger.accountName(other.accountId)}` }, confidence: 0.85, why: `Gegenstück zu „${other.text}“` }
  }
  const t = ruleTarget(r, ledger)
  const label = t.kind === 'umbuchung' ? { ...t, label: `Umbuchung ${l.amount < 0 ? 'auf' : 'von'} ${ledger.accountName(t.accountId)}` } : t
  return { target: label, confidence: 0.9, why: `Regel „${r.name}“`, rule: r }
}
