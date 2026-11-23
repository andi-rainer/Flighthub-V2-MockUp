import type { BankLine } from '../../data'
import type { Ledger } from './ledger'

/**
 * Where a booking stands. Only `gebucht`, `eigenbeleg` and `gesperrt` are final. `unterschrift`: an Eigenbeleg still waits for its second
 * signature. `ausnahme`: the invoice is announced ("Beleg kommt später"), a reminder that stays open.
 */
export type LineStatus = 'offen' | 'beleg' | 'abweichung' | 'unterschrift' | 'ausnahme' | 'eigenbeleg' | 'gebucht' | 'gesperrt'

export const STATUS: Record<LineStatus, { label: string; tone: 'warn' | 'ok' | 'info' | 'neutral' }> = {
  offen: { label: 'Offen', tone: 'warn' },
  beleg: { label: 'Beleg fehlt', tone: 'warn' },
  abweichung: { label: 'Belege weichen ab', tone: 'warn' },
  unterschrift: { label: 'Zweite Unterschrift fehlt', tone: 'warn' },
  ausnahme: { label: 'Beleg kommt später', tone: 'warn' },
  eigenbeleg: { label: 'Durch Eigenbeleg gedeckt', tone: 'ok' },
  gebucht: { label: 'Gebucht', tone: 'ok' },
  gesperrt: { label: 'Gesperrt', tone: 'neutral' },
}

/** The invoices on a booking and whether they cover its amount. */
export const receiptsOf = (l: BankLine, ledger: Ledger) => ledger.receipts.filter((r) => r.lineId === l.id)
/** Signed: a credit note (negative) reduces the invoices it belongs to; compared with the line as an absolute amount. */
export const receiptSum = (rs: { amount: number }[]) => Math.abs(Math.round(rs.reduce((n, r) => n + r.amount, 0) * 100))

/** [Entwurf] Money between the club's own accounts (Umbuchung, ATM into the Kassa, Sparbuch) never needs a receipt. */
export const isInternal = (l: BankLine, ledger: Ledger) => ledger.done[l.id]?.kind === 'umbuchung'
/** The booking needs a supplier invoice (or an Eigenbeleg). */
export const needsProof = (l: BankLine, ledger: Ledger) => l.needsReceipt && !isInternal(l, ledger)

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
  const rs = receiptsOf(l, ledger)
  const need = needsProof(l, ledger)
  if (need) {
    const ex = ledger.exempt[l.id]
    if (rs.length > 0 && receiptSum(rs) !== Math.round(Math.abs(l.amount) * 100)) return 'abweichung'
    if (rs.length === 0 && !ex?.own) return ex?.reason === LATER ? 'ausnahme' : 'beleg'
    if (rs.length === 0 && ownStateOf(l, ledger) === 'unterschrift') return 'unterschrift'
  }
  if (ledger.isLocked(l.date)) return 'gesperrt'
  if (need && rs.length === 0) return 'eigenbeleg'
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
export type Proof = 'rechnung' | 'eigenbeleg' | 'unterschrift' | 'ausnahme' | 'fehlt' | 'intern' | 'offen'
export const PROOF: Record<Proof, string> = { rechnung: 'Mit Rechnung', eigenbeleg: 'Durch Eigenbeleg gedeckt', unterschrift: 'Zweite Unterschrift fehlt', ausnahme: 'Beleg kommt später', fehlt: 'Beleg fehlt', intern: 'Kein Beleg nötig', offen: 'Noch nicht zugeordnet' }
export function proofOf(l: BankLine, ledger: Ledger): Proof {
  if (receiptsOf(l, ledger).length > 0) return 'rechnung'
  if (!ledger.done[l.id]) return 'offen'
  if (!needsProof(l, ledger)) return 'intern'
  const ex = ledger.exempt[l.id]
  if (ex?.own) return ex.own.second ? 'eigenbeleg' : 'unterschrift'
  return ex?.reason === LATER ? 'ausnahme' : 'fehlt'
}

/** Still to do before the period can be released: every booking that needs a receipt has an invoice or a fully signed Eigenbeleg. */
export const isTodo = (s: LineStatus) => s === 'offen' || s === 'beleg' || s === 'abweichung' || s === 'unterschrift' || s === 'ausnahme'
