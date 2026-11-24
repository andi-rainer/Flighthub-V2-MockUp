import { eur, type BankLine } from '../../data'
import { STATEMENT, type Ledger } from './ledger'
export { STATEMENT }
import { docsOfLine, DOC_TITLE } from './memberDocs'

/**
 * Where a booking stands. Only `gebucht`, `eigenbeleg` and `gesperrt` are final. `unterschrift`: an Eigenbeleg still waits for its second
 * signature. `ausnahme`: the invoice is announced ("Beleg kommt später"), a reminder that stays open.
 */
export type LineStatus = 'offen' | 'beleg' | 'abweichung' | 'unterschrift' | 'ausnahme' | 'eigenbeleg' | 'gebucht' | 'gesperrt'

export const STATUS: Record<LineStatus, { label: string; tone: 'warn' | 'ok' | 'info' | 'neutral' }> = {
  offen: { label: 'Zuordnung fehlt', tone: 'warn' },
  beleg: { label: 'Rechnung fehlt', tone: 'warn' },
  abweichung: { label: 'Rechnungen decken den Betrag nicht', tone: 'warn' },
  unterschrift: { label: 'Zweite Unterschrift fehlt', tone: 'warn' },
  ausnahme: { label: 'Rechnung kommt später', tone: 'warn' },
  eigenbeleg: { label: 'Fertig, Eigenbeleg', tone: 'ok' },
  gebucht: { label: 'Fertig', tone: 'ok' },
  gesperrt: { label: 'Fertig, gesperrt', tone: 'ok' },
}

/** The invoices on a booking and whether they cover its amount. */
export const receiptsOf = (l: BankLine, ledger: Ledger) => ledger.receipts.filter((r) => r.lineId === l.id)
/** Signed: a credit note (negative) reduces the invoices it belongs to; compared with the line as an absolute amount. */
export const receiptSum = (rs: { amount: number }[]) => Math.abs(Math.round(rs.reduce((n, r) => n + r.amount, 0) * 100))

/** [Entwurf] Money between the club's own accounts (Umbuchung, ATM into the Kassa, Sparbuch) never needs a receipt. */
export const isInternal = (l: BankLine, ledger: Ledger) => ledger.done[l.id]?.kind === 'umbuchung'
const centsOf = (n: number) => Math.round(Math.abs(n) * 100)
/**
 * Every booking needs documents that cover its amount exactly. Part of it may be covered by the club's own documents that come with the
 * assignment (voucher, ticket, Betriebskonto, transfer); the rest needs an invoice, a credit note, the bank statement (interest, fees,
 * donations) or an Eigenbeleg. Before the assignment, `needsReceipt` of the line says whether it looks like a supplier payment.
 */
export const needsProof = (l: BankLine, ledger: Ledger) => (ledger.done[l.id] ? ownCents(l, ledger) < centsOf(l.amount) : l.needsReceipt)
const ownCents = (l: BankLine, ledger: Ledger) => ownDocsOf(l, ledger).reduce((n, d) => n + centsOf(d.amount), 0)
/**
 * A receipt's share of a booking in cents, in the booking's direction: for money out the supplier's invoices count and their credit notes
 * subtract; for money in the club's own documents (Ausgangsbeleg) and the supplier's credit notes count.
 */
export const shareOf = (line: BankLine, r: { amount: number; outgoing?: boolean }) => Math.round(r.amount * 100) * (r.outgoing || line.amount < 0 ? 1 : -1)
/** Differenzposten count toward the booking with their sign (Skonto takes away, Bankspesen and a rounding fill up). */
export const diffCents = (l: BankLine, ledger: Ledger) => (ledger.diffs[l.id] ?? []).reduce((n, d) => n + Math.round(d.amount * 100), 0)
/** What the linked receipts have to cover, in cents: the amount minus what the club's own documents of the assignment already cover. */
export const receiptTarget = (l: BankLine, ledger: Ledger) => centsOf(l.amount) - ownCents(l, ledger)
/** How far the documents of a booking cover it, in cents: own documents plus linked receipts. `open` < 0 is too much. */
export function coverageOf(l: BankLine, ledger: Ledger) {
  const rs = receiptsOf(l, ledger)
  const own = ownDocsOf(l, ledger)
  const want = centsOf(l.amount)
  const covered = ownCents(l, ledger) + rs.reduce((n, r) => n + shareOf(l, r), 0) + diffCents(l, ledger)
  return { rs, own, want, covered, open: want - covered }
}

/**
 * A document of the club itself that backs (part of) a booking, so no supplier invoice is needed for that part: for money in, the voucher
 * or ticket sold (our own sales document) and the Einzahlungsbestätigung of a Betriebskonto; for money out, the refund of a ticket and the
 * Auszahlungsbeleg; for a transfer between own accounts, its counter booking. It comes with the assignment, nobody attaches it by hand.
 */
export interface OwnDoc { kind: 'gutschein' | 'ticket' | 'betriebskonto' | 'gegenbuchung'; label: string; /** Positive, in euros. */ amount: number; code?: string; memberId?: string }
export function ownDocsOf(l: BankLine, ledger: Ledger): OwnDoc[] {
  const t = ledger.done[l.id]
  if (!t) return []
  const parts = t.kind === 'teilung' ? t.parts.map((p) => ({ amount: p.amount, target: p.target })) : [{ amount: Math.abs(l.amount), target: t }]
  const docs = docsOfLine(l, ledger)
  return parts.flatMap(({ amount, target }): OwnDoc[] => {
    if (target.kind === 'zahlung') return [{ kind: target.label.startsWith('Gutschein') ? 'gutschein' : 'ticket', label: target.label, amount, code: target.code }]
    if (target.kind === 'konto') {
      const d = docs.find((x) => x.memberId === target.memberId)
      return [{ kind: 'betriebskonto', label: d ? `${DOC_TITLE[d.kind]} ${d.no}` : l.amount > 0 ? 'Einzahlungsbestätigung' : 'Auszahlungsbeleg', amount, memberId: target.memberId, code: d?.no }]
    }
    if (target.kind === 'umbuchung') return [{ kind: 'gegenbuchung', label: 'Gegenbuchung', amount }]
    return []
  })
}

/** The reason that only reminds: the invoice is on its way. It never covers a booking. */
export const LATER = 'Beleg kommt später'
/**
 * The Eigenbeleg of a booking without an invoice: `gedeckt` once both signatures are there, `unterschrift` while the second one (Kassier or
 * Obmann, not the first signer) is missing.
 */
export type OwnState = 'gedeckt' | 'unterschrift'
export function ownStateOf(l: BankLine, ledger: Ledger): OwnState | undefined {
  const own = ledger.exempt[l.id]?.own
  if (!own) return undefined
  return own.second ? 'gedeckt' : 'unterschrift'
}
/** The first signature of an Eigenbeleg (older ones: who created it). */
export const firstSignerOf = (ex: { by: string; own?: { first?: { by: string } } }) => ex.own?.first?.by ?? ex.by

export function lineStatus(l: BankLine, ledger: Ledger): LineStatus {
  if (!ledger.done[l.id]) return 'offen'
  const { rs, open } = coverageOf(l, ledger)
  const ex = ledger.exempt[l.id]
  // The bank statement or an Eigenbeleg covers what invoices and own documents leave open (an Eigenbeleg only where there is no invoice).
  const statement = ex?.reason === STATEMENT
  const ownReceipt = !!ex?.own && rs.length === 0
  if (open !== 0 && !statement && !ownReceipt) return rs.length > 0 ? 'abweichung' : ex?.reason === LATER ? 'ausnahme' : 'beleg'
  if (ownReceipt && open !== 0 && ownStateOf(l, ledger) === 'unterschrift') return 'unterschrift'
  if (ledger.isLocked(l.date)) return 'gesperrt'
  if (ownReceipt && open !== 0) return 'eigenbeleg'
  return 'gebucht'
}
/**
 * The counter booking of a transfer between the club's own accounts: the linked one, or (for transfers booked as a pair) the line on the
 * other account with the opposite amount on the same day that points back.
 */
export function counterOf(l: BankLine, ledger: Ledger): BankLine | undefined {
  const t = ledger.done[l.id]
  if (t?.kind !== 'umbuchung') return undefined
  if (t.lineId) return ledger.lines.find((x) => x.id === t.lineId)
  return ledger.lines.find((x) => {
    const o = ledger.done[x.id]
    return x.id !== l.id && x.accountId === t.accountId && x.amount === -l.amount && x.date === l.date && o?.kind === 'umbuchung' && o.accountId === l.accountId
  })
}

/** Lines on another account that could be the counter booking of `l`: not booked yet, the opposite amount, at most a week apart. */
export function counterCandidates(l: BankLine, accountId: string, ledger: Ledger): BankLine[] {
  const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000
  return ledger.lines.filter((x) => x.accountId === accountId && !ledger.done[x.id] && x.amount === -l.amount && Math.abs(day(x.date) - day(l.date)) <= 7)
}

/**
 * [Entwurf] What backs a booking: an invoice, an Eigenbeleg with both signatures, an Eigenbeleg still without its second signature, an
 * invoice announced for later (`ausnahme`, a reminder), the linked counter booking (transfer), the system record (voucher, ticket,
 * Betriebskonto), or nothing yet. Used for the "Beleg" filter, so every booking can be checked for its proof.
 */
export type Proof = 'rechnung' | 'eigen' | 'kontoauszug' | 'eigenbeleg' | 'unterschrift' | 'ausnahme' | 'fehlt' | 'offen'
export const PROOF: Record<Proof, string> = { rechnung: 'Mit Rechnung', eigen: 'Eigener Beleg (Gutschein, Ticket, Betriebskonto, Umbuchung)', kontoauszug: 'Kontoauszug', eigenbeleg: 'Durch Eigenbeleg gedeckt', unterschrift: 'Zweite Unterschrift fehlt', ausnahme: 'Beleg kommt später', fehlt: 'Beleg fehlt', offen: 'Noch nicht zugeordnet' }
export function proofOf(l: BankLine, ledger: Ledger): Proof {
  if (receiptsOf(l, ledger).length > 0) return 'rechnung'
  if (!ledger.done[l.id]) return 'offen'
  if (!needsProof(l, ledger)) return 'eigen'
  const ex = ledger.exempt[l.id]
  if (ex?.reason === STATEMENT) return 'kontoauszug'
  if (ex?.own) return ex.own.second ? 'eigenbeleg' : 'unterschrift'
  return ex?.reason === LATER ? 'ausnahme' : 'fehlt'
}

/**
 * A booking is a fact: it needs no confirmation, only its connections. What is still missing: the assignment (cost center, Betriebskonto,
 * voucher, transfer …) and, where needed, invoices that cover the amount (one or several) or a fully signed Eigenbeleg. Empty: done.
 */
export function gapsOf(l: BankLine, ledger: Ledger): string[] {
  // Money out needs an invoice; money in needs a document of ours (or the statement), so it is called Beleg there.
  const word = l.amount < 0 ? 'Rechnung' : 'Beleg'
  if (!ledger.done[l.id]) return l.needsReceipt && receiptsOf(l, ledger).length === 0 ? ['Zuordnung', word] : ['Zuordnung']
  const { rs, open } = coverageOf(l, ledger)
  if (open === 0) return []
  const ex = ledger.exempt[l.id]
  if (ex?.reason === STATEMENT) return []
  if (ex?.own && rs.length === 0) return ex.own.second ? [] : ['zweite Unterschrift']
  if (open < 0) return [`Belege ${eur(-open / 100)} zu hoch`]
  if (rs.length === 0 && ex?.reason === LATER) return [`${word} (kommt später)`]
  return [open === centsOf(l.amount) ? word : `${word} über ${eur(open / 100)}`]
}

/** Still to do before the period can be released: every booking that needs a receipt has an invoice or a fully signed Eigenbeleg. */
export const isTodo = (s: LineStatus) => s === 'offen' || s === 'beleg' || s === 'abweichung' || s === 'unterschrift' || s === 'ausnahme'
