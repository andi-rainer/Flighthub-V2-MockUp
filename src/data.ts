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
  { id: 'm4', type: 'ord', name: 'David Gruber', weight: 90, functions: ['Sportspringer'], balance: -118, membership: 'aktiv', docs: [{ label: 'Lizenz B', expires: '19.05.2027', state: 'ok' }] },
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
  paid?: Pay
  price: number
  note?: string
}

export const arrivedJumpers: Jumper[] = [
  { id: 'j1', name: 'Anna Berger', kind: 'sport', price: 28 },
  { id: 'j2', name: 'Bernd Huber', kind: 'sport', price: 28 },
  { id: 'j3', name: 'David Gruber', kind: 'sport', price: 28 },
  { id: 'j4', name: 'Greta Lang', kind: 'sport', price: 28 },
  { id: 'j5', name: 'Tandem: M. Köhler', kind: 'tandem', weight: 92, price: 220, note: 'Voucher V-1042' },
  { id: 'j6', name: 'Tandem: S. Auer', kind: 'tandem', weight: 71, price: 220, note: 'Online bezahlt' },
]

export const eur = (n: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)

// Sparten per aircraft (Finanz-Screen)
export const sparten = [
  { id: 's1', name: 'Sportspringen', minutes: 5200, income: 24_900 },
  { id: 's2', name: 'Tandem', minutes: 3600, income: 31_900 },
  { id: 's3', name: 'Mitglieder-Charter', minutes: 2400, income: 9_600 },
  { id: 's4', name: 'Fremd-Charter', minutes: 600, income: 3_900 },
]
export const varPerMinute = 1.9 // fuel + engine reserve, from real invoices
export const fixedCostsYear = 38_400 // insurance, hangar, depreciation, annual inspection ...
export const currentCharterRatePerMin = 4 // what members pay today

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
]

/** One part of a booking. A booking can be split across several cost centers (shared hangar, insurance for all aircraft, ...). */
export interface Split { costCenterId: string; categoryId: string; percent: number }
export type Target = { kind: 'konto'; memberId: string } | { kind: 'buchung'; splits: Split[] }

export interface Receipt {
  id: string; name: string; supplier: string; amount: number; date: string
  source: 'Upload' | 'Bordbuch' | 'E-Mail'; note?: string
  lineId?: string
  suggestion?: { lineId: string; confidence: number; why: string }
}

export interface BankLine {
  id: string; date: string; text: string; amount: number
  source: 'Bank' | 'Kassa'
  needsReceipt: boolean
  suggestion?: { target: Target; confidence: number; why: string }
  /** LLM cross-check of an invoice or delivery note against the Bordbuch. */
  check?: { tone: 'ok' | 'warn'; text: string; lines?: string[] }
}

const one = (costCenterId: string, categoryId: string): Target => ({ kind: 'buchung', splits: [{ costCenterId, categoryId, percent: 100 }] })

export const bankLines: BankLine[] = [
  { id: 'b1', date: '04.11.', text: 'ÜW Berger Anna – Einzahlung Konto', amount: 150, source: 'Bank', needsReceipt: false, suggestion: { target: { kind: 'konto', memberId: 'm1' }, confidence: 0.98, why: 'Name und Verwendungszweck passen' } },
  { id: 'b6', date: '05.11.', text: 'ÜW Gruber David – Sprungtag 31.10.', amount: 28, source: 'Bank', needsReceipt: false, suggestion: { target: { kind: 'konto', memberId: 'm4' }, confidence: 0.96, why: 'Betrag und Name passen zum offenen Sprung vom 31.10.' } },
  { id: 'b2', date: '03.11.', text: 'Shell Austria – Rechn. 88231', amount: -254.8, source: 'Bank', needsReceipt: true, suggestion: { target: one('cc-oedza', 'k-fuel'), confidence: 0.91, why: 'Shell wurde bisher immer als Treibstoff OE-DZA gebucht' }, check: { tone: 'ok', text: 'Bordbuch passt: 85 L am 31.10. (Bernd Huber) entsprechen der Rechnung über 85 L.' } },
  { id: 'b3', date: '02.11.', text: 'Wiener Städtische – Prämie Q4', amount: -2100, source: 'Bank', needsReceipt: true, suggestion: { target: { kind: 'buchung', splits: [{ costCenterId: 'cc-oedza', categoryId: 'k-ins', percent: 60 }, { costCenterId: 'cc-oekfr', categoryId: 'k-ins', percent: 40 }] }, confidence: 0.88, why: 'Prämie für zwei Flugzeuge, Aufteilung 60/40 wie im Q3' } },
  { id: 'b9', date: '01.11.', text: 'Flughafen Wels Betriebs GmbH – Sammelrechnung Oktober', amount: -312, source: 'Bank', needsReceipt: true, suggestion: { target: one('cc-oedza', 'k-fees'), confidence: 0.8, why: 'Landegebühren, der Platz wurde bisher immer so gebucht' }, check: { tone: 'warn', text: 'Bordbuch weicht ab: Rechnung weist 26 Landungen aus, das Bordbuch von OE-DZA im Oktober 24. Zwei Landungen ohne Eintrag.', lines: ['17.10.: Rechnung 12, Bordbuch 11', '31.10.: Rechnung 14, Bordbuch 13'] } },
  { id: 'b8', date: '01.11.', text: 'Österr. Fallschirmsportverband – Beitrag 2026', amount: -180, source: 'Bank', needsReceipt: true, suggestion: { target: one('cc-verein', 'k-admin'), confidence: 0.9, why: 'Passt zu keinem Flugzeug, bisher immer „Verein allgemein“' } },
  { id: 'b7', date: '02.11.', text: 'ÜW F. Maier – Einzahlung', amount: 50, source: 'Bank', needsReceipt: false, suggestion: { target: { kind: 'konto', memberId: 'm6' }, confidence: 0.55, why: 'Nachname passt, Vorname nur abgekürzt' } },
  { id: 'b4', date: '02.11.', text: 'Tandem-Shop Stripe Auszahlung', amount: 1980, source: 'Bank', needsReceipt: false, suggestion: { target: one('cc-tandem', 'e-tandem'), confidence: 0.72, why: '9 Shop-Bestellungen à € 220, Differenz entspricht Gebühren' } },
  { id: 'b5', date: '31.10.', text: 'Fa. Hofer Schlosserei – Re 2024-77', amount: -312.5, source: 'Bank', needsReceipt: true },
]

export const initialReceipts: Receipt[] = [
  { id: 'r1', name: 'Rechnung-88231.pdf', supplier: 'Shell Austria', amount: 254.8, date: '03.11.', source: 'Upload', lineId: 'b2' },
  { id: 'r2', name: 'Hofer-Re-2024-77.pdf', supplier: 'Fa. Hofer Schlosserei', amount: 312.5, date: '31.10.', source: 'E-Mail', suggestion: { lineId: 'b5', confidence: 0.97, why: 'Betrag und Lieferant identisch' } },
  { id: 'r3', name: 'Tankbeleg-17.10.jpg', supplier: 'Tankstelle LOLW', amount: 118.7, date: '17.10.', source: 'Bordbuch', note: 'Bordbuch 17.10., 62 L, bar bezahlt', suggestion: undefined },
  { id: 'r5', name: 'Flughafen-Wels-Okt-2026.pdf', supplier: 'Flughafen Wels Betriebs GmbH', amount: 312, date: '01.11.', source: 'E-Mail', suggestion: { lineId: 'b9', confidence: 0.96, why: 'Betrag und Absender passen' } },
  { id: 'r4', name: 'Beitrag-OEFSV-2026.pdf', supplier: 'Österr. Fallschirmsportverband', amount: 180, date: '01.11.', source: 'E-Mail', suggestion: { lineId: 'b8', confidence: 0.95, why: 'Betrag und Absender passen' } },
]

export const tickets = [
  { id: 'V-1042', type: 'Tandem Voucher', holder: 'M. Köhler', status: 'eingelöst heute', price: 220, source: 'Webshop' },
  { id: 'V-1043', type: 'Tandem Voucher', holder: 'Geschenk für J. Reiter', status: 'offen', price: 220, source: 'Webshop' },
  { id: 'V-1044', type: 'Tandem + Video', holder: 'S. Auer', status: 'gebucht 22.11.', price: 290, source: 'Webshop' },
  { id: 'T-0310', type: '10er Sprungkarte', holder: 'David Gruber', status: '6 von 10 übrig', price: 250, source: 'Kassa' },
  { id: 'V-1038', type: 'Tandem Voucher', holder: 'Fam. Lehner', status: 'läuft ab in 9 Tagen', price: 220, source: 'Webshop' },
]
