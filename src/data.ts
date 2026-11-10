// THROWAWAY mock data for the click dummy.

export type Pay = 'konto' | 'bar'

export interface Member {
  id: string
  type: 'ord' | 'kurz' | 'foerd' | 'tandem' // membership type, decides whether the member has a Betriebskonto
  weight?: number // kg, required for sport jumpers (load CG)
  name: string
  functions: string[]
  balance: number // EUR, negative = owes the club
  membership: 'aktiv' | 'ruhend' | 'offen'
  docs: { label: string; expires: string; state: 'ok' | 'bald' | 'abgelaufen' }[]
  /** Set when the person was created WITHOUT a form (the exception). Shown in the list and the member file. */
  manual?: { reason: string; at: string; by: string }
}

export const members: Member[] = [
  { id: 'm1', type: 'ord', name: 'Anna Berger', weight: 62, functions: ['Sportspringer'], balance: -42, membership: 'aktiv', docs: [{ label: 'Medical', expires: '14.03.2027', state: 'ok' }, { label: 'Lizenz C', expires: '01.12.2026', state: 'bald' }] },
  { id: 'm2', type: 'ord', name: 'Bernd Huber', weight: 85, functions: ['Sportspringer', 'Skydive-Pilot', 'Pilot'], balance: 130, membership: 'aktiv', docs: [{ label: 'Medical', expires: '02.09.2026', state: 'abgelaufen' }] },
  { id: 'm3', type: 'ord', name: 'Clara Wimmer', weight: 64, functions: ['Tandem-Master'], balance: 0, membership: 'aktiv', docs: [{ label: 'TM Rating', expires: '30.06.2027', state: 'ok' }] },
  { id: 'm4', type: 'ord', name: 'David Gruber', weight: 90, functions: ['Sportspringer', 'Tandem-Master'], balance: -118, membership: 'aktiv', docs: [{ label: 'Lizenz B', expires: '19.05.2027', state: 'ok' }] },
  { id: 'm5', type: 'ord', name: 'Eva Steiner', weight: 70, functions: ['Pilot', 'Fluglehrer', 'Kassier'], balance: 55, membership: 'aktiv', docs: [{ label: 'PPL', expires: '11.01.2027', state: 'ok' }, { label: 'Medical', expires: '20.11.2026', state: 'bald' }] },
  { id: 'm6', type: 'ord', name: 'Florian Maier', functions: [], balance: 0, membership: 'offen', docs: [] },
  { id: 'm7', type: 'kurz', name: 'Greta Lang', weight: 58, functions: ['Sportspringer'], balance: 12, membership: 'ruhend', docs: [{ label: 'Lizenz A', expires: '03.03.2027', state: 'ok' }] },
  { id: 'm8', type: 'ord', name: 'Hannes Pichler', weight: 82, functions: ['Manifest-Koordinator'], balance: 0, membership: 'aktiv', docs: [] },
  { id: 'm9', type: 'tandem', name: 'Lukas Moser', weight: 78, functions: [], balance: 0, membership: 'aktiv', docs: [] },
]

/** Mock roster only: the real project stores members in the database. */
export const registerMember = (m: Member) => { members.push(m) }

export interface Aircraft {
  id: string
  reg: string
  type: string
  uses: ('Sprung' | 'Charter')[]
  status: 'bereit' | 'wartung' | 'dokument'
  note: string
  hours: number
  nextService: string
}

export const aircraft: Aircraft[] = [
  { id: 'a1', reg: 'OE-DZA', type: 'Cessna 182', uses: ['Sprung', 'Charter'], status: 'bereit', note: 'Nächster Check in 18 h', hours: 4821.4, nextService: '100h-Check bei 4839 h' },
  { id: 'a2', reg: 'OE-KFR', type: 'Piper PA-28', uses: ['Charter'], status: 'dokument', note: 'Versicherung läuft in 12 Tagen ab', hours: 7310.2, nextService: 'Jahresnachprüfung 03/2027' },
  { id: 'a3', reg: 'OE-AXB', type: 'Pilatus PC-6', uses: ['Sprung'], status: 'wartung', note: 'In Wartung bis 24.11.', hours: 2260.9, nextService: 'Motorüberholung läuft' },
]

export interface Jumper {
  id: string
  memberId?: string
  weight?: number // kg without gear
  name: string
  kind: 'sport' | 'tandem'
  /** Tandem guests only: the booking they come from (check-in and contract are read from it). */
  bookingId?: string
  /** Sport jumper who did not come but pays the seat so the others can fly: the seat stays taken, nobody is on board. */
  noShow?: boolean
  /** Closing only: one line per person, so several jumps of the day are summed up (`price` is the total). */
  jumps?: number
  paidSeats?: number
  paid?: Pay
  price: number
  note?: string
}

export const eur = (n: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)

// ---- Cost centers, categories (both user-managed), receipts, bank lines ----
export interface CostCenter { id: string; name: string; kind: 'Flugzeug' | 'Sparte' | 'Allgemein'; archived?: boolean }
export interface Category { id: string; name: string; type: 'Kosten' | 'Ertrag'; fixed?: boolean; archived?: boolean }

export const initialCostCenters: CostCenter[] = [
  { id: 'cc-oedza', name: 'OE-DZA', kind: 'Flugzeug' },
  { id: 'cc-oekfr', name: 'OE-KFR', kind: 'Flugzeug' },
  { id: 'cc-oeaxb', name: 'OE-AXB', kind: 'Flugzeug' },
  { id: 'cc-sport', name: 'Sportspringen', kind: 'Sparte' },
  { id: 'cc-tandem', name: 'Tandem', kind: 'Sparte' },
  { id: 'cc-mcharter', name: 'Mitglieder-Charter', kind: 'Sparte' },
  { id: 'cc-fcharter', name: 'Fremd-Charter', kind: 'Sparte' },
  { id: 'cc-verein', name: 'Verein allgemein', kind: 'Allgemein' },
  { id: 'cc-platz', name: 'Platz und Gebäude', kind: 'Allgemein' },
  { id: 'cc-ausr', name: 'Fallschirme und Ausrüstung', kind: 'Allgemein' },
]
export const initialCategories: Category[] = [
  { id: 'k-fuel', name: 'Treibstoff', type: 'Kosten', fixed: false },
  { id: 'k-maint', name: 'Wartung und Reparatur', type: 'Kosten', fixed: false },
  { id: 'k-ins', name: 'Versicherung', type: 'Kosten', fixed: true },
  { id: 'k-hangar', name: 'Hangar und Miete', type: 'Kosten', fixed: true },
  { id: 'k-fees', name: 'Landegebühren', type: 'Kosten', fixed: false },
  { id: 'k-admin', name: 'Verwaltung und Beiträge', type: 'Kosten', fixed: true },
  { id: 'e-ticket', name: 'Ticketverkauf', type: 'Ertrag' },
  { id: 'e-tandem', name: 'Tandem online', type: 'Ertrag' },
  { id: 'e-charter', name: 'Charter', type: 'Ertrag' },
  { id: 'e-fees', name: 'Mitgliedsbeiträge', type: 'Ertrag' },
  { id: 'e-donation', name: 'Spenden', type: 'Ertrag' },
]

/** One part of a booking. A booking can be split across several cost centers (shared hangar, insurance for all aircraft, ...). */
export interface Split { costCenterId: string; categoryId: string; percent: number }
/** `zahlung`: the money of a voucher or ticket (or its refund). Until the flight it is a liability, the revenue is booked on the flight. `umbuchung`: money moved to another account of the club. `auslage`: a member paid a cost of the club privately: it is booked on cost centers and credited to the member's Betriebskonto. */
export type SingleTarget = { kind: 'konto'; memberId: string } | { kind: 'buchung'; splits: Split[] } | { kind: 'zahlung'; code: string; label: string } | { kind: 'umbuchung'; accountId: string; label: string } | { kind: 'auslage'; memberId: string; splits: Split[] }
/** One part of a bank line that is split: `amount` is the positive part of the line, `receiptId` the invoice it settles (collective debit). */
export interface Part { amount: number; target: SingleTarget; receiptId?: string }
/**
 * Where the money of a bank line goes: ONE target, or `teilung` when one transfer covers several things (ticket + donation, flight costs +
 * membership fee) or one debit settles several invoices. The parts always add up to the whole line.
 */
export type Target = SingleTarget | { kind: 'teilung'; parts: Part[] }

export interface Receipt {
  /** `name` is the file (an invoice of the supplier is always a file), the rest is the data record: it is kept digitally too. */
  id: string; name: string; supplier: string; /** The invoice number of the supplier. */ number?: string; amount: number
  /** Invoice date (ISO). */ date: string
  source: 'Upload' | 'Bordbuch' | 'E-Mail'; note?: string
  /** Fuel invoices carry the liters and the price per liter: they give the average fuel cost. */
  fuel?: { liters: number; perLiter: number }
  /** A member who paid it privately (Auslage). */
  paidBy?: string
  lineId?: string
  /** Planned coding of an invoice that is not booked yet. Once it is on a booking, the booking codes it. */
  splits?: Split[]
  suggestion?: { lineId: string; confidence: number; why: string }
}

/** A place where the club's money is: bank account, cash box, savings book. Its balance is the opening balance plus every line on it. */
export interface MoneyAccount { id: string; name: string; kind: 'bank' | 'bar' | 'spar'; /** Bank, IBAN or where the box stands. */ detail?: string; opening: number; archived?: boolean }
export const CASH_ID = 'acc-kassa'
/** Bookings without money moving on an account of the club (a member paid privately): they are on no money account. */
export const AUSLAGE_ID = 'acc-auslage'
export const initialMoneyAccounts: MoneyAccount[] = [
  { id: 'acc-bank', name: 'Hauptkonto', kind: 'bank', detail: 'Girokonto des Vereins', opening: -5_550 },
  { id: CASH_ID, name: 'Kassa', kind: 'bar', detail: 'Bargeld im Büro', opening: 412 },
  { id: 'acc-spar', name: 'Sparbuch', kind: 'spar', detail: 'Rücklage Flugzeuge', opening: 12_000 },
]

export interface BankLine {
  id: string; /** ISO */ date: string; /** What the bank says. */ text: string; amount: number
  accountId: string
  /** The text of the booking, when it should read differently from the bank text. */
  bookingText?: string
  needsReceipt: boolean
  suggestion?: { target: Target; confidence: number; why: string }
  /** LLM cross-check of an invoice or delivery note against the Bordbuch. */
  check?: { tone: 'ok' | 'warn'; text: string; lines?: string[] }
}

const one = (costCenterId: string, categoryId: string): SingleTarget => ({ kind: 'buchung', splits: [{ costCenterId, categoryId, percent: 100 }] })
const BANK = 'acc-bank'

export const bankLines: BankLine[] = [
  { id: 'b1', date: '2026-11-04', text: 'ÜW Berger Anna – Einzahlung Konto', amount: 150, accountId: BANK, needsReceipt: false, suggestion: { target: { kind: 'konto', memberId: 'm1' }, confidence: 0.98, why: 'Name und Verwendungszweck passen' } },
  { id: 'b6', date: '2026-11-05', text: 'ÜW Gruber David – Sprungtag 31.10.', amount: 28, accountId: BANK, needsReceipt: false, suggestion: { target: { kind: 'konto', memberId: 'm4' }, confidence: 0.96, why: 'Betrag und Name passen zum offenen Sprung vom 31.10.' } },
  { id: 'b2', date: '2026-11-03', text: 'Shell Austria – Rechn. 88231', amount: -254.8, accountId: BANK, needsReceipt: true, suggestion: { target: one('cc-oedza', 'k-fuel'), confidence: 0.91, why: 'Shell wurde bisher immer als Treibstoff OE-DZA gebucht' }, check: { tone: 'ok', text: 'Bordbuch passt: 85 L am 31.10. (Bernd Huber) entsprechen der Rechnung über 85 L.' } },
  { id: 'b3', date: '2026-11-02', text: 'Wiener Städtische – Prämie Q4', amount: -2100, accountId: BANK, needsReceipt: true, suggestion: { target: { kind: 'buchung', splits: [{ costCenterId: 'cc-oedza', categoryId: 'k-ins', percent: 60 }, { costCenterId: 'cc-oekfr', categoryId: 'k-ins', percent: 40 }] }, confidence: 0.88, why: 'Prämie für zwei Flugzeuge, Aufteilung 60/40 wie im Q3' } },
  { id: 'b9', date: '2026-11-01', text: 'Flughafen Wels Betriebs GmbH – Sammelrechnung Oktober', amount: -312, accountId: BANK, needsReceipt: true, suggestion: { target: one('cc-oedza', 'k-fees'), confidence: 0.8, why: 'Landegebühren, der Platz wurde bisher immer so gebucht' }, check: { tone: 'warn', text: 'Bordbuch weicht ab: Rechnung weist 26 Landungen aus, das Bordbuch von OE-DZA im Oktober 24. Zwei Landungen ohne Eintrag.', lines: ['17.10.: Rechnung 12, Bordbuch 11', '31.10.: Rechnung 14, Bordbuch 13'] } },
  { id: 'b8', date: '2026-11-01', text: 'Österr. Fallschirmsportverband – Beitrag 2026', amount: -180, accountId: BANK, needsReceipt: true, suggestion: { target: one('cc-verein', 'k-admin'), confidence: 0.9, why: 'Passt zu keinem Flugzeug, bisher immer „Verein allgemein“' } },
  { id: 'b7', date: '2026-11-02', text: 'ÜW F. Maier – Einzahlung', amount: 50, accountId: BANK, needsReceipt: false, suggestion: { target: { kind: 'konto', memberId: 'm6' }, confidence: 0.55, why: 'Nachname passt, Vorname nur abgekürzt' } },
  { id: 'b4', date: '2026-11-02', text: 'Tandem-Shop Stripe Auszahlung', amount: 1980, accountId: BANK, needsReceipt: false, suggestion: { target: one('cc-tandem', 'e-tandem'), confidence: 0.72, why: '9 Shop-Bestellungen à € 220, Differenz entspricht Gebühren' } },
  { id: 'b10', date: '2026-11-06', text: 'ÜW Winkler Thomas – Gutschein GS-1045', amount: 220, accountId: BANK, needsReceipt: false, suggestion: { target: { kind: 'zahlung', code: 'GS-1045', label: 'Gutschein GS-1045 · Thomas Winkler' }, confidence: 0.97, why: 'Code im Verwendungszweck, Betrag passt' } },
  { id: 'b11', date: '2026-11-06', text: 'ÜW an Gruber Paul – Erstattung TB-1075', amount: -220, accountId: BANK, needsReceipt: false, suggestion: { target: { kind: 'zahlung', code: 'TB-1075', label: 'Ticket TB-1075 · Paul Gruber' }, confidence: 0.95, why: 'Code im Verwendungszweck, Betrag passt zur offenen Erstattung' } },
  { id: 'b5', date: '2026-10-31', text: 'Fa. Hofer Schlosserei – Re 2024-77', amount: -312.5, accountId: BANK, needsReceipt: true },
  { id: 'b12', date: '2026-11-06', text: 'ÜW Kofler Maria – Gutschein GS-1049 und Spende', amount: 250, accountId: BANK, needsReceipt: false, suggestion: { target: { kind: 'teilung', parts: [{ amount: 220, target: { kind: 'zahlung', code: 'GS-1049', label: 'Gutschein GS-1049 · Maria Kofler' } }, { amount: 30, target: one('cc-verein', 'e-donation') }] }, confidence: 0.7, why: 'Code GS-1049 im Verwendungszweck, die übrigen 30 € sind vermutlich eine Spende' } },
  { id: 'b13', date: '2026-11-03', text: 'SEPA-Lastschrift Hangar Wels GmbH und Aero-Versicherung', amount: -2000, accountId: BANK, needsReceipt: true },
]

export const initialReceipts: Receipt[] = [
  { id: 'r6', name: 'Hangarmiete-Nov-2026.pdf', supplier: 'Hangar Wels GmbH', number: 'HM-2026-11', amount: 1000, date: '2026-11-03', source: 'E-Mail', lineId: 'b13' },
  { id: 'r7', name: 'Praemie-Hangarhaftpflicht-Q4.pdf', supplier: 'Aero-Versicherung AG', number: 'P-4471', amount: 1000, date: '2026-11-03', source: 'E-Mail', lineId: 'b13' },
  { id: 'r1', name: 'Rechnung-88231.pdf', supplier: 'Shell Austria', number: '88231', amount: 254.8, date: '2026-11-03', source: 'Upload', lineId: 'b2', fuel: { liters: 85, perLiter: 2.998 } },
  { id: 'r2', name: 'Hofer-Re-2024-77.pdf', supplier: 'Fa. Hofer Schlosserei', number: '2024-77', amount: 312.5, date: '2026-10-31', source: 'E-Mail', splits: [{ costCenterId: 'cc-oeaxb', categoryId: 'k-maint', percent: 100 }], suggestion: { lineId: 'b5', confidence: 0.97, why: 'Betrag und Lieferant identisch' } },
  { id: 'r3', name: 'Tankbeleg-17.10.jpg', supplier: 'Tankstelle LOLW', amount: 181.4, date: '2026-10-17', source: 'Bordbuch', note: 'Bordbuch 17.10., 62 L, bar bezahlt', fuel: { liters: 62, perLiter: 2.926 }, paidBy: 'm1', suggestion: undefined },
  { id: 'r5', name: 'Flughafen-Wels-Okt-2026.pdf', supplier: 'Flughafen Wels Betriebs GmbH', number: 'LF-1026', amount: 312, date: '2026-11-01', source: 'E-Mail', suggestion: { lineId: 'b9', confidence: 0.96, why: 'Betrag und Absender passen' } },
  { id: 'r4', name: 'Beitrag-OEFSV-2026.pdf', supplier: 'Österr. Fallschirmsportverband', number: 'M-2026-0180', amount: 180, date: '2026-11-01', source: 'E-Mail', suggestion: { lineId: 'b8', confidence: 0.95, why: 'Betrag und Absender passen' } },
  // Cash expenses of members, waiting for the treasurer (see the seed of the expense requests in the ledger).
  { id: 'r9', name: 'Scan-Tankbeleg-OEDZA.pdf', supplier: 'Tankstelle LOLW', number: '20417', amount: 140.6, date: '2026-11-06', source: 'Bordbuch', note: 'Treibstoff OE-DZA, 48 L', fuel: { liters: 48, perLiter: 2.929 }, paidBy: 'm2' },
  { id: 'r10', name: 'Baumarkt-Wels-Kassenbon.jpg', supplier: 'Baumarkt Wels', number: '88104', amount: 36.9, date: '2026-11-05', source: 'Upload', note: 'Schrauben und Klebeband für den Hangar', paidBy: 'm1' },
  { id: 'r11', name: 'Scan-Tankbeleg-OEKFR.pdf', supplier: 'OMV Aviation', number: '55012', amount: 181.4, date: '2026-11-04', source: 'Upload', note: 'getankt vor dem Charterflug', fuel: { liters: 62, perLiter: 2.926 }, paidBy: 'm4' },
  { id: 'r12', name: 'Kaffeehaus-Rechnung.jpg', supplier: 'Café Zentral', number: '3391', amount: 24.5, date: '2026-10-30', source: 'Upload', note: 'Kaffee für den Vereinsabend', paidBy: 'm3' },
  // An invoice that arrived by e-mail; the SEPA debit follows a week later.
  { id: 'r8', name: 'AAT-26-0911.pdf', supplier: 'Austro Aero Technik GmbH', number: 'AAT-26-0911', amount: 1840, date: '2026-11-05', source: 'E-Mail', splits: [{ costCenterId: 'cc-oedza', categoryId: 'k-maint', percent: 100 }] },
]

// ---- Earlier years: booked and released, so the evaluations (maintenance of the last three years) have something to show ----
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
/** [invoice date, supplier, invoice number, amount, cost center, category, liters (fuel only)] */
type HistoryRow = [string, string, string, number, string, string, number?]
const HISTORY_BASE: HistoryRow[] = [
  ['2024-02-14', 'Fa. Hofer Schlosserei', 'HS-2024-014', 480, 'cc-oedza', 'k-maint'],
  ['2024-03-05', 'Shell Austria', '71204', 612.4, 'cc-oedza', 'k-fuel', 211],
  ['2024-04-22', 'Austro Aero Technik GmbH', 'AAT-24-0388', 2350, 'cc-oedza', 'k-maint'],
  ['2024-06-03', 'Austro Aero Technik GmbH', 'AAT-24-0611', 1120.5, 'cc-oekfr', 'k-maint'],
  ['2024-09-18', 'Propeller Service Linz', 'PS-4410', 3480, 'cc-oekfr', 'k-maint'],
  ['2024-11-12', 'Austro Aero Technik GmbH', 'AAT-24-1002', 760, 'cc-oeaxb', 'k-maint'],
  ['2025-01-29', 'Fa. Hofer Schlosserei', 'HS-2025-003', 295, 'cc-oeaxb', 'k-maint'],
  ['2025-03-11', 'Austro Aero Technik GmbH', 'AAT-25-0207', 2680, 'cc-oedza', 'k-maint'],
  ['2025-05-20', 'Fallschirm-Service Linz', 'FS-2025-71', 640, 'cc-ausr', 'k-maint'],
  ['2025-06-24', 'Shell Austria', '80377', 701.9, 'cc-oekfr', 'k-fuel', 240],
  ['2025-07-08', 'Austro Aero Technik GmbH', 'AAT-25-0544', 1390, 'cc-oekfr', 'k-maint'],
  ['2025-10-02', 'Propeller Service Linz', 'PS-4977', 890, 'cc-oeaxb', 'k-maint'],
  ['2025-12-04', 'Fa. Hofer Schlosserei', 'HS-2025-041', 410, 'cc-oedza', 'k-maint'],
  ['2026-02-17', 'Austro Aero Technik GmbH', 'AAT-26-0121', 2940, 'cc-oekfr', 'k-maint'],
  ['2026-04-09', 'Austro Aero Technik GmbH', 'AAT-26-0302', 1760, 'cc-oedza', 'k-maint'],
  ['2026-05-12', 'Shell Austria', '86015', 540.2, 'cc-oedza', 'k-fuel', 185],
  ['2026-08-18', 'Shell Austria', '91220', 498, 'cc-oedza', 'k-fuel', 160],
  ['2026-06-23', 'Fallschirm-Service Linz', 'FS-2026-38', 720, 'cc-ausr', 'k-maint'],
  ['2026-09-15', 'Austro Aero Technik GmbH', 'AAT-26-0788', 1215.4, 'cc-oeaxb', 'k-maint'],
]
/** Running costs of every aircraft per year (insurance, hangar, fuel by quarter): generated, so the evaluations have a full picture. */
const RUNNING: HistoryRow[] = []
for (const y of [2024, 2025, 2026]) {
  for (const [cc, tag, insurance, hangar, fuel] of [['cc-oedza', 'DZA', 2400, 1800, 3100], ['cc-oekfr', 'KFR', 1800, 1800, 1900], ['cc-oeaxb', 'AXB', 3100, 2400, 3400]] as const) {
    RUNNING.push([`${y}-01-15`, 'Wiener Städtische', `WS-${y}-${tag}`, insurance, cc, 'k-ins'], [`${y}-04-02`, 'Hangar Wels GmbH', `HM-${y}-${tag}`, hangar, cc, 'k-hangar'])
    for (const m of y === 2026 ? ['03', '06', '09'] : ['03', '06', '09', '12']) RUNNING.push([`${y}-${m}-12`, 'Shell Austria', `SH-${y}${m}-${tag}`, fuel, cc, 'k-fuel', Math.round(fuel / 2.95)])
  }
}
const HISTORY: HistoryRow[] = [...HISTORY_BASE, ...RUNNING]
export const historyLines: BankLine[] = HISTORY.map(([d, supplier, no, amount], i) => ({ id: `h${i + 1}`, date: plusDays(d, 8), text: `${supplier} – Rechn. ${no}`, amount: -amount, accountId: BANK, needsReceipt: true }))
export const historyReceipts: Receipt[] = HISTORY.map(([d, supplier, no, amount, , , liters], i) => ({ id: `rh${i + 1}`, name: `${no}.pdf`, supplier, number: no, amount, date: d, source: 'E-Mail', lineId: `h${i + 1}`, fuel: liters ? { liters, perLiter: Math.round((amount / liters) * 1000) / 1000 } : undefined }))
export const historyDone: Record<string, Target> = Object.fromEntries(HISTORY.map(([, , , , cc, cat], i) => [`h${i + 1}`, one(cc, cat)]))

/** Income of earlier years that came in through the bank (shop payouts, ticket sales, charter of other clubs, membership fees, donations). Generated. */
type IncomeRow = [string, string, number, string, string]
const INCOME: IncomeRow[] = []
for (const [y, tandem, ticket, charter, fees] of [[2024, 3400, 2100, 1900, 16_200], [2025, 4100, 2600, 2300, 17_100], [2026, 4800, 3100, 2700, 18_000]] as const) {
  INCOME.push([`${y}-02-20`, `Mitgliedsbeiträge ${y}`, fees, 'cc-verein', 'e-fees'])
  for (const m of ['05', '06', '07', '08', '09']) INCOME.push([`${y}-${m}-28`, 'Tandem-Shop Stripe Auszahlung', tandem, 'cc-tandem', 'e-tandem'], [`${y}-${m}-29`, 'Ticketverkauf Sprungbetrieb', ticket, 'cc-sport', 'e-ticket'])
  for (const m of ['03', '06', '09']) INCOME.push([`${y}-${m}-25`, 'Charter an Fallschirmclub Linz', charter, 'cc-fcharter', 'e-charter'])
}
INCOME.push(['2024-12-18', 'Spende Weihnachtsaktion', 400, 'cc-verein', 'e-donation'], ['2025-08-09', 'Spende Fliegerfest', 650, 'cc-verein', 'e-donation'], ['2026-06-14', 'Spende Platzfest', 300, 'cc-verein', 'e-donation'])
export const incomeLines: BankLine[] = INCOME.map(([date, text, amount], i) => ({ id: `i${i + 1}`, date, text, amount, accountId: BANK, needsReceipt: false }))
export const incomeDone: Record<string, Target> = Object.fromEntries(INCOME.map(([, , , cc, cat], i) => [`i${i + 1}`, one(cc, cat)]))

/** Flight minutes per year and aircraft that are not in the Bordbuch of the prototype (before it starts; for the running year January to September). */
export const EARLIER_MINUTES: Record<string, Record<string, number>> = {
  '2024': { 'OE-DZA': 7200, 'OE-KFR': 4200, 'OE-AXB': 3000 },
  '2025': { 'OE-DZA': 7800, 'OE-KFR': 4500, 'OE-AXB': 3300 },
  '2026': { 'OE-DZA': 6900, 'OE-KFR': 3900, 'OE-AXB': 2700 },
}

/** Released periods ("YYYY-MM"): every month up to September 2026. Their bookings cannot be changed any more. */
export interface Released { by: string; /** ISO */ at: string }
export const initialReleased: Record<string, Released> = Object.fromEntries(
  Array.from({ length: 33 }, (_, i) => {
    const y = 2024 + Math.floor(i / 12), m = (i % 12) + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const next = m === 12 ? `${y + 1}-01-06` : `${y}-${String(m + 1).padStart(2, '0')}-06`
    return [key, { by: 'Eva Steiner', at: next }] as const
  }),
)
