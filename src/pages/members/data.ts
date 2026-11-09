// THROWAWAY mock data for membership applications, forms and fees.

export type AppKind = 'Neu' | 'Änderung' | 'Beendigung'
/** Link aktiv: the 72 hour link exists (mailed or copied), waiting for the person. Papier erwartet: blank PDF handed out. Unterzeichnet: signed, waiting for the decision. */
export type AppStatus = 'Entwurf' | 'Link aktiv' | 'Papier erwartet' | 'Abgelaufen' | 'Unterzeichnet' | 'Genehmigt' | 'Abgelehnt'
/** How the form was filled: online by link (no login), on paper and uploaded, at the club on a device, or by the board without signature. */
export type Channel = 'Link' | 'Papier' | 'Vor Ort' | 'Vorstand'
// ---------- Club data: ONE place, used by every form, PDF and invoice ----------
export interface ClubData {
  name: string; street: string; city: string; email: string; phone: string; web: string
  zvr: string; iban: string
  /** Place of jurisdiction, used in contract texts. */
  court: string
  /** A picture as data URL, or none (then the initials of the club are shown). */
  logo: string | null
}
export const defaultClub: ClubData = { name: 'Skydive Club Beispiel', street: 'Flugplatz 1', city: '1234 Beispiel', email: 'office@club.example', phone: '+43 1 234 567', web: 'club.example', zvr: '123456789', iban: 'AT12 3456 7890 1234 5678', court: 'Beispiel', logo: null }

/** The parts of the club data a form can show or override. */
export type Part = 'logo' | 'name' | 'address' | 'contact' | 'footer'
export const PARTS: { key: Part; label: string; fields: (keyof ClubData)[] }[] = [
  { key: 'logo', label: 'Logo', fields: ['logo'] },
  { key: 'name', label: 'Vereinsname', fields: ['name'] },
  { key: 'address', label: 'Adresse', fields: ['street', 'city'] },
  { key: 'contact', label: 'E-Mail, Telefon, Web', fields: ['email', 'phone', 'web'] },
  { key: 'footer', label: 'Fußzeile (ZVR, IBAN)', fields: ['zvr', 'iban'] },
]
export const footerText = (d: Pick<ClubData, 'zvr' | 'iban'>) => [d.zvr && `ZVR ${d.zvr}`, d.iban && `IBAN ${d.iban}`].filter(Boolean).join(' · ')

/** How the head of a document looks: what is shown, alignment, accent colour. The standard layout is the template for new forms. */
export interface Layout { align: 'links' | 'mitte' | 'rechts'; show: Record<Part, boolean>; accent: string }
export const defaultLayout: Layout = { align: 'links', show: { logo: true, name: true, address: true, contact: true, footer: true }, accent: '#0b5fff' }

/**
 * The design of ONE form version: club data as it was when the version was made (frozen, so a used form never changes)
 * plus the layout. Parts in `own` do not follow the club data, they hold a value only this form uses.
 */
export interface Branding extends ClubData, Layout { own: Part[] }
export const designFrom = (club: ClubData, layout: Layout): Branding => ({ ...club, ...layout, show: { ...layout.show }, own: [] })
export const cloneDesign = (d: Branding): Branding => ({ ...d, show: { ...d.show }, own: [...d.own] })
/** The same design with all parts that are not overridden taken from the current club data. */
export function syncDesign(d: Branding, c: ClubData): Branding {
  const n = cloneDesign(d); n.court = c.court
  for (const p of PARTS) if (!d.own.includes(p.key)) for (const k of p.fields) (n as unknown as Record<string, unknown>)[k] = c[k]
  return n
}
/** What in this design is out of date compared to the club data (names of the parts). */
export const outdatedParts = (d: Branding, c: ClubData): string[] => [
  ...PARTS.filter((p) => !d.own.includes(p.key) && p.fields.some((k) => d[k] !== c[k])).map((p) => p.label),
  ...(d.court !== c.court ? ['Gerichtsstand'] : []),
]

/** Placeholders for texts: `{Vereinsname}` is replaced by the data of the version's design. */
export const PLACEHOLDERS: [string, (d: ClubData) => string][] = [
  ['Vereinsname', (d) => d.name], ['Adresse', (d) => [d.street, d.city].filter(Boolean).join(', ')], ['E-Mail', (d) => d.email], ['Telefon', (d) => d.phone],
  ['Website', (d) => d.web], ['ZVR', (d) => d.zvr], ['IBAN', (d) => d.iban], ['Gerichtsstand', (d) => d.court],
]
export const fillText = (t: string, d: ClubData) => PLACEHOLDERS.reduce((s, [k, fn]) => s.split(`{${k}}`).join(fn(d)), t)

// ---------- Forms: ONE system for applications, the tandem carriage agreement, invoices and own forms ----------
/** A form is an application, a contract signed at the tandem check-in, a generated document (invoice) or an own form. */
export type FormKind = AppKind | 'Beförderung' | 'Dokument' | 'Eigenes'
export const KIND_LABEL: Record<FormKind, string> = { Neu: 'Aufnahme', Änderung: 'Änderung der Mitgliedschaft', Beendigung: 'Austritt oder Ausschluss', Beförderung: 'Tandem-Check-in vor Ort', Dokument: 'Wird automatisch erzeugt', Eigenes: 'Eigenes Formular' }

/** Every form exists in German and English. */
export type Lang = 'de' | 'en'
export const LANGS: { id: Lang; label: string }[] = [{ id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }]
export type FieldType = 'Text' | 'Datum' | 'Zustimmung' | 'Auswahl'
/** Free content between the fields: a heading, a paragraph (optionally highlighted, e.g. a waiver) or a page break in the PDF. */
export type BlockType = 'Überschrift' | 'Absatz' | 'Seitenumbruch'
export const BLOCK_LABEL: Record<BlockType, string> = { Überschrift: 'Überschrift', Absatz: 'Text', Seitenumbruch: 'Neue Seite im PDF' }
/** Where the choices of a selection field come from: the memberships of the club (some can be left out) or an own list. */
export type Options = { kind: 'mitgliedschaften'; exclude: string[]; hideCurrent: boolean } | { kind: 'liste'; items: string[] }
/** What the answer does when an application is approved. */
export type Effect = 'mitgliedschaft' | 'gueltigAb' | 'austrittZum'
export const EFFECT_LABEL: Record<Effect, string> = { mitgliedschaft: 'Mitgliedschaft wird auf die Auswahl gesetzt', gueltigAb: 'Datum, ab dem die Änderung gilt', austrittZum: 'Datum, zu dem die Mitgliedschaft endet' }
/**
 * `source`: the field is filled by the system and shown locked (not changeable), e.g. "Mitgliederdaten: Vorname".
 * No source: the person fills the field in. `system`: part of a generated document, cannot be edited at all.
 */
export interface FormField {
  id: string; label: string; type: FieldType | BlockType; required: boolean; source?: string; options?: Options; effect?: Effect; system?: boolean
  /** Paragraph text (type Absatz). May contain placeholders like {Vereinsname}. */
  text?: string
  /** Paragraph is shown in a box, e.g. the waiver or the health declaration. */
  highlight?: boolean
  /** English text of the label (fields, headings) or of the paragraph. `stale`: the German text was changed after it was translated. */
  en?: { label?: string; text?: string; stale?: boolean }
}
/** `fields` holds fields AND free content in the order they appear on the form. */
export interface FormVersion { v: number; status: 'aktiv' | 'entwurf' | 'archiviert'; since?: string; fields: FormField[]; /** Frozen with the version: a used form never changes its look. */ design: Branding }
/** Title of a form in a language (English falls back to German). */
export const nameOf = (t: FormTemplate, lang: Lang = 'de') => (lang === 'en' ? t.nameEn?.trim() || t.name : t.name)
export const isInput = (f: FormField): f is FormField & { type: FieldType } => f.type !== 'Überschrift' && f.type !== 'Absatz' && f.type !== 'Seitenumbruch'
/** Label and paragraph text of an item in a language (English falls back to German if still missing). */
export const lab = (f: FormField, lang: Lang = 'de') => (lang === 'en' ? f.en?.label?.trim() || f.label : f.label)
export const txt = (f: FormField, lang: Lang = 'de') => (lang === 'en' ? f.en?.text?.trim() || f.text || '' : f.text ?? '')
/** State of the English text of an item: missing, German changed since (check it), or done. `undefined`: nothing to translate. */
export type TState = 'ok' | 'fehlt' | 'pruefen'
export function enState(f: FormField): TState | undefined {
  if (f.type === 'Seitenumbruch') return undefined
  const de = f.type === 'Absatz' ? f.text : f.label
  if (!de?.trim()) return undefined
  const en = f.type === 'Absatz' ? f.en?.text : f.en?.label
  if (!en?.trim()) return 'fehlt'
  return f.en?.stale ? 'pruefen' : 'ok'
}
/** Items whose English text is missing or needs a check. A version can only be published when this is empty. */
/** Number of English texts still open in a version, including the title of the form. */
export const openCount = (t: FormTemplate, v: FormVersion) => openEn(v).length + (t.nameEn?.trim() ? 0 : 1)
export const openEn = (v: FormVersion) => v.fields.filter((f) => { const st = enState(f); return !!st && st !== 'ok' })
/** The paragraphs of a version as one text (used by generated documents like the invoice). */
export const textOf = (v: FormVersion, lang: Lang = 'de') => v.fields.filter((x) => x.type === 'Absatz').map((x) => fillText(txt(x, lang), v.design)).join('\n\n')
export interface FormTemplate { id: string; name: string; /** English title. */ nameEn?: string; kind: FormKind; purpose: string; versions: FormVersion[] }

/** What the system can fill into a field, by kind of form. */
export const SOURCES: Partial<Record<FormKind, { group: string; items: string[] }>> = {
  Neu: undefined,
  Änderung: { group: 'Mitgliederdaten', items: ['Vorname', 'Nachname', 'E-Mail', 'Geburtsdatum', 'Gewicht', 'Aktuelle Mitgliedschaft'] },
  Beendigung: { group: 'Mitgliederdaten', items: ['Vorname', 'Nachname', 'E-Mail', 'Geburtsdatum', 'Gewicht', 'Aktuelle Mitgliedschaft'] },
  Beförderung: { group: 'Tandem-Buchung', items: ['Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Gewicht', 'Flugdatum'] },
}
/** Example values for the preview, by source. */
export const SAMPLE: Record<string, string> = { Vorname: 'Anna', Nachname: 'Berger', 'E-Mail': 'anna.berger@example.at', Geburtsdatum: '14.04.1992', Gewicht: '62', 'Aktuelle Mitgliedschaft': 'Ordentlich', Flugdatum: '07.11.2026', Telefon: '+43 660 1234567' }

const f = (id: string, label: string, type: FieldType = 'Text', required = true, extra: Partial<FormField> = {}): FormField => ({ id, label, type, required, ...extra })
const src = (source: string): Partial<FormField> => ({ source })
const memberships: Options = { kind: 'mitgliedschaften', exclude: [], hideCurrent: false }
const D = designFrom(defaultClub, defaultLayout)
/** Free content: heading, paragraph, page break. */
const h = (id: string, text: string): FormField => ({ id, label: text, type: 'Überschrift', required: false })
const p = (id: string, text: string, highlight = false): FormField => ({ id, label: 'Text', type: 'Absatz', required: false, text, highlight })
const pb = (id: string): FormField => ({ id, label: 'Neue Seite', type: 'Seitenumbruch', required: false })

const rawForms: FormTemplate[] = [
  { id: 'neu', name: 'Aufnahmeantrag', kind: 'Neu', purpose: 'Eine Person will Mitglied werden.', versions: [
    { v: 3, status: 'aktiv', since: '12.01.2026', design: D, fields: [f('vn', 'Vorname'), f('nn', 'Nachname'), f('g', 'Geburtsdatum', 'Datum'), f('st', 'Straße'), f('hn', 'Hausnummer'), f('plz', 'PLZ'), f('ort', 'Stadt'), f('land', 'Land'), f('mail', 'E-Mail'), f('m', 'Gewünschte Mitgliedschaft', 'Auswahl', true, { options: memberships, effect: 'mitgliedschaft' }), f('d', 'Datenschutz zugestimmt', 'Zustimmung'), f('s', 'Satzung anerkannt', 'Zustimmung'), p('legal', 'Mit meiner Unterschrift beantrage ich die Aufnahme als Mitglied und erkenne die Satzung an. Meine Daten dürfen zur Vereinsverwaltung verarbeitet werden.')] },
    { v: 2, status: 'archiviert', since: '03.02.2024', design: D, fields: [f('n', 'Name'), f('g', 'Geburtsdatum', 'Datum'), f('a', 'Adresse'), p('legal', 'Ich beantrage die Aufnahme.')] },
  ] },
  { id: 'aenderung', name: 'Änderung der Mitgliedschaft', kind: 'Änderung', purpose: 'Ein Mitglied wechselt in eine andere Mitgliedschaft.', versions: [
    { v: 1, status: 'aktiv', since: '12.01.2026', design: D, fields: [f('vn', 'Vorname', 'Text', true, src('Mitgliederdaten: Vorname')), f('nn', 'Nachname', 'Text', true, src('Mitgliederdaten: Nachname')), f('von', 'Bisherige Mitgliedschaft', 'Auswahl', true, src('Mitgliederdaten: Aktuelle Mitgliedschaft')), f('zu', 'Neue Mitgliedschaft', 'Auswahl', true, { options: { kind: 'mitgliedschaften', exclude: [], hideCurrent: true }, effect: 'mitgliedschaft' }), f('ab', 'Gültig ab', 'Datum', true, { effect: 'gueltigAb' }), p('legal', 'Ich beantrage die Änderung meiner Mitgliedschaft. Der Beitrag richtet sich nach der neuen Mitgliedschaft.')] },
  ] },
  { id: 'ende', name: 'Austritt aus dem Verein', kind: 'Beendigung', purpose: 'Ein Mitglied tritt aus. Ein Ausschluss geht auch ohne Unterschrift durch den Vorstand.', versions: [
    { v: 1, status: 'aktiv', since: '12.01.2026', design: D, fields: [f('vn', 'Vorname', 'Text', true, src('Mitgliederdaten: Vorname')), f('nn', 'Nachname', 'Text', true, src('Mitgliederdaten: Nachname')), f('von', 'Bisherige Mitgliedschaft', 'Auswahl', true, src('Mitgliederdaten: Aktuelle Mitgliedschaft')), f('ab', 'Austritt zum', 'Datum', true, { effect: 'austrittZum' }), f('gr', 'Grund (optional)', 'Text', false), p('legal', 'Ich kündige meine Mitgliedschaft zum angegebenen Zeitpunkt. Offene Beiträge bleiben fällig.')] },
  ] },
  { id: 'befoerderung', name: 'Beförderungsvertrag (Tandem)', kind: 'Beförderung', purpose: 'Der Passagier unterschreibt ihn beim Check-in vor Ort.', versions: [
    { v: 1, status: 'aktiv', since: '12.01.2026', design: D, fields: [
      p('p1', 'Beförderer und Luftfrachtführer ist der {Vereinsname}. Er führt mit dem unten genannten Tandem-Gast einen Tandem-Fallschirmsprung durch.'),
      h('t2', 'Angaben zum Tandem-Gast'),
      f('vn', 'Vorname', 'Text', true, src('Tandem-Buchung: Vorname')), f('nn', 'Nachname', 'Text', true, src('Tandem-Buchung: Nachname')), f('g', 'Geburtsdatum', 'Datum'),
      f('st', 'Straße und Hausnummer'), f('ort', 'PLZ und Ort'), f('tel', 'Telefon', 'Text', true, src('Tandem-Buchung: Telefon')), f('mail', 'E-Mail', 'Text', true, src('Tandem-Buchung: E-Mail')),
      f('cm', 'Größe in cm'), f('kg', 'Gewicht in kg', 'Text', true, src('Tandem-Buchung: Gewicht')), f('en', 'Notfallkontakt Name'), f('et', 'Notfallkontakt Telefon'),
      p('p2', 'Der Tandem-Gast erklärt seine Mitgliedschaft im {Vereinsname} als zeitlich befristetes Mitglied. Diese Mitgliedschaft ist mit keinen finanziellen Verpflichtungen verbunden.'),
      p('p3', 'Für alle Beförderungen von Personen und Gütern mit den Tandem-Fallschirmen im Eigentum und Betrieb des {Vereinsname} handelt der Verein ausschließlich als Beförderer und Luftfrachtführer.'),
      p('p4', 'Tandem-Fallschirmsprünge werden nicht gewerblich durchgeführt, sondern ausschließlich zur Mitgliederwerbung und zur Förderung des Fallschirmsports.'),
      p('p5', 'Ein vereinbarter Beitrag zu den Beförderungskosten (Mitgliedsbeitrag) wird zur Gänze und direkt an den gemeinnützigen {Vereinsname} geleistet. Dieser ist daher alleiniger Vertragspartner des Tandem-Gasts im Beförderungsvertrag.'),
      p('p6', 'Der jeweilige Tandempilot bzw. die natürliche Person, die die Beförderung mit dem Tandem-Gast abwickelt, handelt als Vertreter des {Vereinsname} und nicht im eigenen Namen.'),
      p('p7', 'Zugunsten jedes Tandem-Gasts (und der mitgeführten Gegenstände) besteht eine gesetzlich vorgeschriebene Haftpflicht- und Unfallversicherung des Betreibers der Tandem-Fallschirme.'),
      pb('b1'),
      h('t3', 'Haftungsausschluss'),
      p('p8', 'Im Schadens- oder Verletzungsfall verzichtet der Tandem-Gast ausdrücklich auf Ansprüche (z. B. Schadenersatz, Schmerzengeld, Verdienstentgang, Rente u. Ä.) gegen den jeweiligen Tandempiloten, es sei denn, diesem kann grobe Fahrlässigkeit oder Vorsatz nachgewiesen werden.\n\nDie Haftung des Beförderers und Luftfrachtführers für Gegenstände, die der Tandem-Gast mitführt, ist mit dem Betrag der dafür abgeschlossenen Versicherung begrenzt. Darüber hinausgehende Ansprüche können nur bei Vorsatz oder grober Fahrlässigkeit geltend gemacht werden.', true),
      f('z1', 'Ich habe den Haftungsausschluss gelesen und akzeptiere ihn.', 'Zustimmung'),
      h('t4', 'Gesundheitserklärung'),
      p('p9', 'Jeder Punkt muss einzeln bestätigt werden. Kann ein Punkt nicht bestätigt werden, bitte vor dem Sprung den Tandempiloten ansprechen.', true),
      f('g1', 'Ich hatte in den letzten 12 Monaten keinen schweren Unfall (Knochenbruch, Bänderriss, Gehirnerschütterung oder Ähnliches).', 'Zustimmung'),
      f('g2', 'Ich war und bin in den letzten 12 Monaten wegen keiner ernsten Erkrankung in ärztlicher Behandlung (Herz, Wirbelsäule, Bandscheiben, Bluthochdruck, Organerkrankungen oder Ähnliches).', 'Zustimmung'),
      f('g3', 'Ich hatte und habe in den letzten 12 Monaten keine psychische Erkrankung oder Störung (Drogensucht, Bewusstlosigkeit oder Ähnliches).', 'Zustimmung'),
      f('g4', 'Ich habe in den letzten 12 Stunden weder Alkohol noch Drogen konsumiert.', 'Zustimmung'),
      f('g5', 'Ich trage keine Prothese.', 'Zustimmung'),
      h('t5', 'Einweisung und Briefing'),
      p('p10', 'Der Tandem-Gast erklärt, vom Tandempiloten ausreichend und verständlich über den gesamten Sprungablauf eingewiesen worden zu sein, insbesondere zu den folgenden Punkten, und den Sprung aus freiem Willen zu unternehmen:\n• Verhalten am Flugplatz (das Flugzeug nur von hinten annähern, niemals dem Propeller nähern)\n• Einweisung in den Sprungablauf (Bodentraining)\n• Notfallsituationen (nur den Anweisungen des Tandempiloten folgen)\n• Kein Versicherungsschutz für Brillen, Kontaktlinsen, Schmuck, Uhren, Smartphones, Kameras und ähnliche Gegenstände bei Beschädigung oder Verlust\n• Gesundheitsrisiken wie rasche Druckwechsel, ungeplante Landung, Schirmfehlfunktion u. Ä.'),
      f('z2', 'Ich wurde eingewiesen und unternehme den Sprung aus freiem Willen.', 'Zustimmung'),
      h('t6', 'Film- und Fotorechte'),
      p('p11', 'Alle Film- und Fotorechte liegen beim {Vereinsname}. Der Verein darf das Material zu Werbezwecken auf seinen eigenen Social-Media-Kanälen und vergleichbaren Plattformen sowie auf seiner Website verwenden.'),
      h('t7', 'Gerichtsstand'),
      p('p12', 'Für alle Streitigkeiten aus diesem Beförderungsvertrag gilt ausschließlich österreichisches Recht. Ausschließlicher Gerichtsstand ist {Gerichtsstand}.'),
    ] },
  ] },
  { id: 'rechnung', name: 'Rechnung und Zahlungsaufforderung', kind: 'Dokument', purpose: 'Entsteht beim Beitragslauf.', versions: [
    { v: 1, status: 'aktiv', since: '12.01.2026', design: D, fields: [f('e', 'Empfänger', 'Text', true, { source: 'Beitragslauf: Mitglied', system: true }), f('p', 'Posten', 'Text', true, { source: 'Beitragslauf: Beitrag', system: true }), f('b', 'Betrag', 'Text', true, { source: 'Beitragslauf: Betrag', system: true }), f('z', 'Zahlbar bis', 'Datum', true, { source: 'Beitragslauf: Zahlungsfrist', system: true }), p('legal', 'Bitte überweise den Betrag mit dem angegebenen Verwendungszweck.')] },
  ] },
]

/** English texts of the seed forms by field id. Archived versions are not translated. */
const EN: Record<string, Record<string, string>> = {
  neu: { vn: 'First name', nn: 'Last name', g: 'Date of birth', st: 'Street', hn: 'House number', plz: 'ZIP code', ort: 'City', land: 'Country', mail: 'E-mail', m: 'Desired membership', d: 'Privacy policy accepted', s: 'Statutes accepted', legal: 'By signing I apply for membership and accept the statutes. My data may be processed for club administration.' },
  aenderung: { vn: 'First name', nn: 'Last name', von: 'Previous membership', zu: 'New membership', ab: 'Valid from', legal: 'I apply to change my membership. The fee follows the new membership.' },
  ende: { vn: 'First name', nn: 'Last name', von: 'Previous membership', ab: 'Leaving on', gr: 'Reason (optional)', legal: 'I terminate my membership as of the stated date. Open fees remain due.' },
  rechnung: { e: 'Recipient', p: 'Item', b: 'Amount', z: 'Payable by', legal: 'Please transfer the amount with the stated payment reference.' },
  befoerderung: {
    p1: 'Carrier and air carrier: {Vereinsname} conducts a tandem parachute jump with the tandem student identified below.', t2: 'Details of the tandem student',
    vn: 'First name', nn: 'Last name', g: 'Date of birth', st: 'Street and house number', ort: 'ZIP and city', tel: 'Phone', mail: 'E-mail', cm: 'Height (cm)', kg: 'Weight (kg)', en: 'Emergency contact name', et: 'Emergency contact phone',
    p2: 'The tandem student declares their membership in the {Vereinsname} as a temporary member. This membership does not entail any financial obligations.',
    p3: 'For all carriage of persons and goods using the tandem parachutes owned and operated by the {Vereinsname}, the club acts exclusively as the carrier and air carrier.',
    p4: 'Tandem parachute jumps are not conducted on a commercial basis, but solely for the purpose of recruiting members and promoting the sport of skydiving.',
    p5: 'Any agreed contribution towards the cost of carriage (membership fee) is transferred in full and directly to the non-profit {Vereinsname}, which is therefore the sole contractual partner of the tandem student in the carriage agreement.',
    p6: 'The respective tandem pilot, or the natural person who makes arrangements related to the carriage with the tandem student, acts as a representative of the {Vereinsname} and not in their own name.',
    p7: 'For the benefit of each tandem student (and any items carried with them), a legally required liability and accident insurance has been taken out by the operator of the tandem parachutes.',
    t3: 'Disclaimer of liability',
    p8: 'In the event of damage or injury, the tandem student expressly waives any claims (e.g. damages, compensation for pain and suffering, loss of earnings, pension, etc.) against the respective tandem pilot, unless the tandem pilot can be proven to have acted with gross negligence or intent.\n\nThe liability of the carrier and air carrier for items carried along with the tandem student is limited to the amount covered by the insurance taken out for this purpose. Any further claims may only be asserted in cases of intent or gross negligence.',
    z1: 'I have read and accept the disclaimer of liability.', t4: 'Health declaration',
    p9: 'Each point must be confirmed individually. If a point cannot be confirmed, please speak to the tandem pilot before the jump.',
    g1: 'I have not suffered a serious accident within the last 12 months (bone fracture, torn ligaments, concussion or similar).',
    g2: 'I have not received and am not receiving medical treatment for a serious illness within the last 12 months (heart, spine, intervertebral discs, high blood pressure, organ diseases or similar).',
    g3: 'I have not suffered and am not suffering from mental or psychological disorders within the last 12 months (drug addiction, loss of consciousness or similar).',
    g4: 'I have not consumed alcohol or drugs within the last 12 hours.', g5: 'I do not wear a prosthesis.', t5: 'Instruction and briefing',
    p10: 'The tandem student declares that they have been sufficiently and clearly instructed and briefed by the tandem pilot on the entire jump procedure, in particular on the following points, and undertakes the jump of their own free will:\n• Conduct at the airfield (always approach the aircraft from behind, never approach the propeller)\n• Instruction on the jump procedure (ground training)\n• Emergency situations (follow only the instructions of the tandem pilot)\n• No insurance coverage for glasses, contact lenses, jewelry, watches, smartphones, cameras and similar items in case of damage or loss\n• Health risks such as rapid pressure changes, unplanned landing, parachute malfunction, etc.',
    z2: 'I have been instructed and undertake the jump of my own free will.', t6: 'Film and photo rights',
    p11: 'All film and photo rights remain with the {Vereinsname}. The club may use the material for advertising purposes on its own social media channels and similar platforms, as well as on its website.',
    t7: 'Place of jurisdiction', p12: 'All disputes arising from this carriage agreement shall be governed exclusively by Austrian law. The exclusive place of jurisdiction is {Gerichtsstand}.',
  },
}
const tr = (fields: FormField[], m: Record<string, string>): FormField[] => fields.map((x) => (m[x.id] ? { ...x, en: x.type === 'Absatz' ? { text: m[x.id] } : { label: m[x.id] } } : x))
const NAME_EN: Record<string, string> = { neu: 'Membership application', aenderung: 'Membership change', ende: 'Leaving the club', befoerderung: 'Contract of Carriage (Tandem)', rechnung: 'Invoice and payment request' }
export const initialForms: FormTemplate[] = rawForms.map((t) => ({ ...t, nameEn: NAME_EN[t.id], versions: t.versions.map((v) => (v.status === 'archiviert' ? v : { ...v, fields: tr(v.fields, EN[t.id] ?? {}) })) }))


export interface Application {
  id: string; kind: AppKind; person: string; date: string; status: AppStatus
  formName: string; formVersion: number
  answers: Record<string, string>
  channel?: Channel; email?: string; memberId?: string
  /** Language of the form for this person (link page, PDF). */
  lang?: Lang
  /** End of the 72 hour link, as shown to people. */
  expires?: string
  /** The link was sent by mail to this address. */
  mailedTo?: string
  /** Fields the club already filled in when creating the application (e.g. new membership and date). The person sees them but cannot change them. */
  fixed?: string[]
  pdf?: string; signedAt?: string; decidedBy?: string
  /** Set when the board acted without a signature: what and why. */
  note?: string
  /** Who confirmed their identity before signing at the club, and how. */
  verified?: string
}

const addr = { Straße: 'Hauptstraße', Hausnummer: '4', PLZ: '1234', Stadt: 'Beispiel', Land: 'Österreich' }
export const initialApplications: Application[] = [
  { id: 'a1', kind: 'Neu', person: 'Florian Maier', memberId: 'm6', date: '05.11.2026', status: 'Unterzeichnet', channel: 'Link', email: 'florian.maier@example.at', formName: 'Aufnahmeantrag', formVersion: 3, answers: { Vorname: 'Florian', Nachname: 'Maier', Geburtsdatum: '14.04.1994', ...addr, 'E-Mail': 'florian.maier@example.at', 'Gewünschte Mitgliedschaft': 'Ordentlich', 'Datenschutz zugestimmt': 'Ja', 'Satzung anerkannt': 'Ja' }, pdf: 'Aufnahmeantrag-Maier-2026-11-05.pdf', signedAt: '05.11.2026 14:12' },
  { id: 'a2', kind: 'Änderung', person: 'Greta Lang', memberId: 'm7', date: '06.11.2026', status: 'Link aktiv', channel: 'Link', email: 'greta.lang@example.at', mailedTo: 'greta.lang@example.at', expires: '09.11.2026 16:20', formName: 'Änderung der Mitgliedschaft', formVersion: 1, answers: { Vorname: 'Greta', Nachname: 'Lang', 'Bisherige Mitgliedschaft': 'Kurzzeit' } },
  { id: 'a3', kind: 'Beendigung', person: 'Hannes Pichler', memberId: 'm8', date: '20.10.2026', status: 'Genehmigt', channel: 'Link', email: 'hannes.pichler@example.at', formName: 'Austritt aus dem Verein', formVersion: 1, answers: { Vorname: 'Hannes', Nachname: 'Pichler', 'Bisherige Mitgliedschaft': 'Ordentlich', 'Austritt zum': '31.12.2026', 'Grund (optional)': 'Umzug' }, pdf: 'Austritt-Pichler-2026-10-20.pdf', signedAt: '20.10.2026 09:30', decidedBy: 'Schriftführer, 22.10.2026' },
  { id: 'a5', kind: 'Änderung', person: 'Eva Steiner', memberId: 'm5', date: '12.01.2026', status: 'Genehmigt', channel: 'Vor Ort', email: 'eva.steiner@example.at', formName: 'Änderung der Mitgliedschaft', formVersion: 1, answers: { Vorname: 'Eva', Nachname: 'Steiner', 'Bisherige Mitgliedschaft': 'Kurzzeit', 'Neue Mitgliedschaft': 'Ordentlich', 'Gültig ab': '12.01.2026' }, pdf: 'Aenderung-Steiner-2026-01-12.pdf', signedAt: '12.01.2026 10:40', decidedBy: 'Schriftführer, 12.01.2026' },
  { id: 'a4', kind: 'Neu', person: 'Julia Reiter', date: '12.09.2026', status: 'Genehmigt', channel: 'Papier', email: 'julia.reiter@example.at', formName: 'Aufnahmeantrag', formVersion: 3, answers: { Vorname: 'Julia', Nachname: 'Reiter', Geburtsdatum: '02.08.1999', Straße: 'Seeweg', Hausnummer: '9', PLZ: '1234', Stadt: 'Beispiel', Land: 'Österreich', 'E-Mail': 'julia.reiter@example.at', 'Gewünschte Mitgliedschaft': 'Kurzzeit', 'Datenschutz zugestimmt': 'Ja', 'Satzung anerkannt': 'Ja' }, pdf: 'Aufnahmeantrag-Reiter-scan.pdf', signedAt: '12.09.2026 16:40', decidedBy: 'Schriftführer, 14.09.2026' },
]

// ---------- Beitragsmuster: WHEN and HOW a fee is billed. Reusable, linked from the membership types ----------
export type Model = 'stichtag' | 'jahrestag'
export type Prorata = 'voll' | 'monatsgenau' | 'stufen'
export type Interval = 'jahr' | 'monat'
/**
 * interval 'jahr': one fee per year, on a fixed Stichtag for everybody or on the anniversary of the admission.
 * interval 'monat': one fee per month, on a fixed day of the month or on the day of admission.
 * Pro rata (first fee): voll, monatsgenau (yearly: by months, monthly: by days) or stufen (yearly only).
 */
export interface FeePattern { id: string; name: string; interval: Interval; model: Model; stichtagDay: number; stichtagMonth: number; prorata: Prorata; steps: { fromMonth: number; pct: number }[] }
export type Billing = FeePattern

export const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export const initialPatterns: FeePattern[] = [
  { id: 'p-jahr-stichtag', name: 'Jahresbeitrag zum 1. Jänner', interval: 'jahr', model: 'stichtag', stichtagDay: 1, stichtagMonth: 1, prorata: 'stufen', steps: [{ fromMonth: 1, pct: 100 }, { fromMonth: 6, pct: 50 }] },
  { id: 'p-jahr-eintritt', name: 'Jahresbeitrag am Eintrittstag', interval: 'jahr', model: 'jahrestag', stichtagDay: 1, stichtagMonth: 1, prorata: 'voll', steps: [{ fromMonth: 1, pct: 100 }] },
  { id: 'p-monat', name: 'Monatsbeitrag zum 1.', interval: 'monat', model: 'stichtag', stichtagDay: 1, stichtagMonth: 1, prorata: 'monatsgenau', steps: [{ fromMonth: 1, pct: 100 }] },
]
export const newPattern = (n: number): FeePattern => ({ id: `p-${Date.now()}`, name: `Neues Muster ${n}`, interval: 'jahr', model: 'stichtag', stichtagDay: 1, stichtagMonth: 1, prorata: 'voll', steps: [{ fromMonth: 1, pct: 100 }] })

/** One sentence that says what a pattern does, shown wherever a pattern is chosen. */
export function describe(p: FeePattern): string {
  if (p.interval === 'monat') {
    if (p.model === 'jahrestag') return 'Monatlich am Tag der Aufnahme, immer der volle Beitrag.'
    return `Monatlich am ${p.stichtagDay}. des Monats. ${p.prorata === 'monatsgenau' ? 'Der erste Monat wird nach Tagen anteilig verrechnet.' : 'Der erste Monat wird voll verrechnet.'}`
  }
  if (p.model === 'jahrestag') return 'Jährlich am Tag der Aufnahme, immer der volle Beitrag.'
  const mid = p.prorata === 'voll' ? 'Bei Eintritt unterm Jahr wird der volle Beitrag fällig.'
    : p.prorata === 'monatsgenau' ? 'Bei Eintritt unterm Jahr zahlt man anteilig nach den verbleibenden Monaten.'
    : `Bei Eintritt unterm Jahr: ${[...p.steps].sort((a, c) => a.fromMonth - c.fromMonth).map((s) => `ab ${MONTHS[s.fromMonth - 1]} ${s.pct} %`).join(', ')}.`
  return `Jährlich am ${p.stichtagDay}. ${MONTHS[p.stichtagMonth - 1]} für alle. ${mid}`
}

/** Membership types: amount (per year or per month, as the pattern says), pattern, Betriebskonto. Members point to one type. */
export type Unit = 'Tage' | 'Wochen' | 'Monate'
/**
 * `renew`: the membership continues by itself (fees keep coming per pattern). Without it the membership ends after `duration`, the fee is
 * due once and nothing renews. `checkin`: the membership people get when they register at the tandem check-in (only one type has it).
 */
export interface MembershipType { id: string; name: string; amount: number; patternId: string; note: string; account: boolean; renew: boolean; duration?: { n: number; unit: Unit }; checkin?: boolean }
export const durationText = (d?: { n: number; unit: Unit }) => (d ? `${d.n} ${d.n === 1 ? { Tage: 'Tag', Wochen: 'Woche', Monate: 'Monat' }[d.unit] : d.unit}` : '')
/** The day a limited membership ends, counted from the start. */
export function endDate(start: Date, d: { n: number; unit: Unit }): Date {
  const e = new Date(start)
  if (d.unit === 'Monate') e.setMonth(e.getMonth() + d.n); else e.setDate(e.getDate() + d.n * (d.unit === 'Wochen' ? 7 : 1))
  return e
}
export const membershipTypes: MembershipType[] = [
  { id: 'ord', name: 'Ordentlich', amount: 100, patternId: 'p-jahr-stichtag', note: 'Voller Zugang, Stimmrecht', account: true, renew: true },
  { id: 'kurz', name: 'Kurzzeit', amount: 30, patternId: 'p-jahr-eintritt', note: 'Begrenzte Zeit, kein Stimmrecht', account: true, renew: false, duration: { n: 6, unit: 'Monate' } },
  { id: 'foerd', name: 'Fördernd', amount: 40, patternId: 'p-jahr-stichtag', note: 'Unterstützer ohne Flugbetrieb', account: false, renew: true },
  { id: 'tandem', name: 'Tandem-Monatsmitglied', amount: 15, patternId: 'p-monat', note: 'Einmalig fällig, springt über den Tandembetrieb', account: false, renew: false, duration: { n: 1, unit: 'Monate' } },
  { id: 'gast', name: 'Tandem-Gast', amount: 0, patternId: 'p-monat', note: 'Kurze Mitgliedschaft für Tandem-Gäste', account: false, renew: false, duration: { n: 1, unit: 'Wochen' }, checkin: true },
]

export interface Due { date: Date; amount: number; pct: number; note: string }
const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

/** First fee on admission (possibly pro rata), then the following ones as the pattern says. `amount` is per year or per month. */
export function schedule(join: Date, amount: number, b: FeePattern, count = 3, renew = true): Due[] {
  if (!renew) count = 1 // a limited membership: the fee is due once
  const out: Due[] = []
  const round = (n: number) => Math.round(n * 100) / 100
  if (b.interval === 'monat') {
    const day = b.model === 'stichtag' ? b.stichtagDay : Math.min(join.getDate(), 28)
    const left = dim(join.getFullYear(), join.getMonth()) - join.getDate() + 1
    const pct = b.model === 'stichtag' && b.prorata === 'monatsgenau' ? Math.round((left / dim(join.getFullYear(), join.getMonth())) * 100) : 100
    out.push({ date: join, amount: round((amount * pct) / 100), pct, note: pct === 100 ? 'Eintritt, voller Monat' : `Eintritt, anteilig ${left} Tage` })
    for (let i = 1; i < count; i++) out.push({ date: new Date(join.getFullYear(), join.getMonth() + i, day), amount, pct: 100, note: b.model === 'stichtag' ? `Monatsbeitrag zum ${day}.` : 'Monatsbeitrag am Eintrittstag' })
    return out
  }
  if (b.model === 'jahrestag') {
    for (let i = 0; i < count; i++) {
      const d = new Date(join); d.setFullYear(join.getFullYear() + i)
      out.push({ date: d, amount, pct: 100, note: i === 0 ? 'Eintritt, voller Beitrag' : 'Jahrestag der Aufnahme' })
    }
    return out
  }
  let next = new Date(join.getFullYear(), b.stichtagMonth - 1, b.stichtagDay)
  if (next <= join) next = new Date(join.getFullYear() + 1, b.stichtagMonth - 1, b.stichtagDay)
  let pct = 100
  if (b.prorata === 'monatsgenau') {
    const months = (next.getFullYear() - join.getFullYear()) * 12 + (next.getMonth() - join.getMonth()) - (join.getDate() > 1 ? 1 : 0)
    pct = Math.round((Math.max(0, Math.min(12, months)) / 12) * 100)
  } else if (b.prorata === 'stufen') {
    const m = join.getMonth() + 1
    pct = [...b.steps].sort((a, c) => a.fromMonth - c.fromMonth).filter((s) => s.fromMonth <= m).pop()?.pct ?? 100
  }
  out.push({ date: join, amount: round((amount * pct) / 100), pct, note: pct === 100 ? 'Eintritt, voller Beitrag' : `Eintritt, anteilig ${pct} %` })
  for (let i = 0; i < count - 1; i++) out.push({ date: new Date(next.getFullYear() + i, next.getMonth(), next.getDate()), amount, pct: 100, note: 'Stichtag' })
  return out
}

export const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
export const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

// ---------- Fees ----------
export type FeeState = 'faellig' | 'rechnung' | 'ueberfaellig' | 'bezahlt' | 'beendet'
export interface Fee { id: string; person: string; type: string; amount: number; note: string; due: string; state: FeeState; invoice?: string }
export const initialFees: Fee[] = [
  { id: 'f1', person: 'Anna Berger', type: 'Ordentlich', amount: 100, note: 'Jahresbeitrag 2027', due: '01.01.2027', state: 'faellig' },
  { id: 'f2', person: 'Bernd Huber', type: 'Ordentlich', amount: 100, note: 'Jahresbeitrag 2027', due: '01.01.2027', state: 'faellig' },
  { id: 'f3', person: 'David Gruber', type: 'Ordentlich', amount: 100, note: 'Jahresbeitrag 2027', due: '01.01.2027', state: 'faellig' },
  { id: 'f4', person: 'Florian Maier', type: 'Ordentlich', amount: 50, note: 'Eintritt 05.11., anteilig 50 %', due: '05.11.2026', state: 'rechnung', invoice: 'RE-2026-0148' },
  { id: 'f5', person: 'Clara Wimmer', type: 'Ordentlich', amount: 100, note: 'Jahresbeitrag 2026', due: '31.01.2026', state: 'ueberfaellig', invoice: 'RE-2026-0012' },
  { id: 'f6', person: 'Eva Steiner', type: 'Ordentlich', amount: 100, note: 'Jahresbeitrag 2026', due: '01.01.2026', state: 'bezahlt', invoice: 'RE-2026-0004' },
  { id: 'f7', person: 'Greta Lang', type: 'Kurzzeit', amount: 30, note: 'Kurzzeit bis 31.12.2026', due: '15.06.2026', state: 'bezahlt', invoice: 'RE-2026-0097' },
  { id: 'f8', person: 'Hannes Pichler', type: 'Ordentlich', amount: 0, note: 'Austritt zum 31.12.2026', due: '–', state: 'beendet' },
]

/** The fee that matters for the list: overdue first, then due, then sent, then paid, then ended. */
const FEE_ORDER: FeeState[] = ['ueberfaellig', 'faellig', 'rechnung', 'bezahlt', 'beendet']
export const feeOf = (fees: Fee[], person: string): Fee | undefined =>
  fees.filter((x) => x.person === person).sort((x, y) => FEE_ORDER.indexOf(x.state) - FEE_ORDER.indexOf(y.state))[0]
export const feeLabel: Record<FeeState, string> = { faellig: 'Fällig', rechnung: 'Rechnung offen', ueberfaellig: 'Überfällig', bezahlt: 'Bezahlt', beendet: 'Beendet' }
export const feeTone: Record<FeeState, 'warn' | 'info' | 'bad' | 'ok' | 'neutral'> = { faellig: 'warn', rechnung: 'info', ueberfaellig: 'bad', bezahlt: 'ok', beendet: 'neutral' }
export const feeIsOpen = (x?: Fee) => !!x && (x.state === 'faellig' || x.state === 'rechnung' || x.state === 'ueberfaellig')
