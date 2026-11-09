// THROWAWAY mock data for Shop & Mails. Structure mirrors what FlightHub V1 can do today
// (CMS texts, 17 mail types with trigger rules, voucher/ticket types, PDF templates).

export type Lang = 'de' | 'en'

export interface Field { key: string; label: string; de: string; en: string; multiline?: boolean }
export interface Block { id: string; title: string; kind: 'hero' | 'card' | 'info' | 'legal' | 'footer'; fields: Field[]; alsoIn?: string[] }
export interface ShopPage { id: string; label: string; path: string; blocks: Block[] }

export const shopPages: ShopPage[] = [
  {
    id: 'home', label: 'Startseite', path: '/',
    blocks: [
      { id: 'home-hero', title: 'Kopfbereich', kind: 'hero', fields: [
        { key: 't', label: 'Titel', de: 'Tandemsprung über den Alpen', en: 'Tandem skydive over the Alps' },
        { key: 's', label: 'Untertitel', de: 'Erlebe den freien Fall mit erfahrenen Tandem-Mastern.', en: 'Experience freefall with experienced tandem masters.', multiline: true } ] },
      { id: 'home-voucher', title: 'Karte „Gutschein“', kind: 'card', fields: [
        { key: 't', label: 'Titel', de: 'Gutschein verschenken', en: 'Give a voucher' },
        { key: 'd', label: 'Beschreibung', de: 'Ein Geschenk, das man nie vergisst. 12 Monate gültig.', en: 'A gift nobody forgets. Valid for 12 months.', multiline: true } ] },
      { id: 'home-booking', title: 'Karte „Termin buchen“', kind: 'card', fields: [
        { key: 't', label: 'Titel', de: 'Direkt buchen', en: 'Book directly' },
        { key: 'd', label: 'Beschreibung', de: 'Wähle deinen Sprungtag und zahle online.', en: 'Choose your jump day and pay online.', multiline: true } ] },
      { id: 'home-redeem', title: 'Karte „Gutschein einlösen“', kind: 'card', fields: [
        { key: 't', label: 'Titel', de: 'Gutschein einlösen', en: 'Redeem a voucher' },
        { key: 'd', label: 'Beschreibung', de: 'Du hast einen Code? Such dir hier deinen Termin aus.', en: 'Got a code? Pick your date here.', multiline: true } ] },
      { id: 'home-footer', title: 'Fußzeile', kind: 'footer', fields: [
        { key: 'f', label: 'Text', de: 'Skydive Club Beispiel · Flugplatz 1 · 1234 Beispiel', en: 'Skydive Club Beispiel · Airfield 1 · 1234 Beispiel' } ] },
    ],
  },
  {
    id: 'vouchers', label: 'Gutscheine', path: '/vouchers',
    blocks: [
      { id: 'v-hero', title: 'Seitenkopf', kind: 'hero', fields: [
        { key: 't', label: 'Titel', de: 'Gutschein kaufen', en: 'Buy a voucher' },
        { key: 's', label: 'Untertitel', de: 'Wähle das passende Paket.', en: 'Choose the right package.' } ] },
      { id: 'v-info', title: 'Infobereich unter den Produkten', kind: 'info', fields: [
        { key: 't', label: 'Überschrift', de: 'So funktioniert’s', en: 'How it works' },
        { key: 'b', label: 'Text', de: 'Du erhältst den Gutschein sofort per E-Mail als PDF. Den Termin suchst du dir später aus.', en: 'You receive the voucher as a PDF by email right away. You choose the date later.', multiline: true } ],
        alsoIn: ['Mail „Gutschein-Kauf“'] },
    ],
  },
  {
    id: 'bookings', label: 'Termin buchen', path: '/bookings',
    blocks: [
      { id: 'b-hero', title: 'Seitenkopf', kind: 'hero', fields: [
        { key: 't', label: 'Titel', de: 'Tandemsprung buchen', en: 'Book a tandem jump' },
        { key: 's', label: 'Untertitel', de: 'Freie Sprungtage und Preise.', en: 'Available jump days and prices.' } ] },
      { id: 'b-info', title: 'Infobereich', kind: 'info', fields: [
        { key: 't', label: 'Überschrift', de: 'Gut zu wissen', en: 'Good to know' },
        { key: 'b', label: 'Text', de: 'Bei Schlechtwetter bieten wir kostenlos einen neuen Termin an.', en: 'In bad weather we offer a free new date.', multiline: true } ] },
    ],
  },
  {
    id: 'checkout', label: 'Bezahlen', path: '/checkout',
    blocks: [
      { id: 'c-terms', title: 'AGB', kind: 'legal', fields: [
        { key: 't', label: 'Überschrift', de: 'Allgemeine Geschäftsbedingungen', en: 'Terms & Conditions' },
        { key: 'b', label: 'Text', de: 'Es gelten die AGB des Skydive Club Beispiel …', en: 'The terms of Skydive Club Beispiel apply …', multiline: true } ],
        alsoIn: ['Gutschein-PDF', 'Ticket-PDF'] },
      { id: 'c-cancel', title: 'Stornobedingungen', kind: 'legal', fields: [
        { key: 't', label: 'Überschrift', de: 'Stornierung', en: 'Cancellation' },
        { key: 'b', label: 'Text', de: 'Kostenlose Stornierung bis 14 Tage vor dem Termin …', en: 'Free cancellation up to 14 days before the date …', multiline: true } ],
        alsoIn: ['Ticket-PDF', 'Mail „Ticket-Kauf“'] },
    ],
  },
  {
    id: 'success', label: 'Danke-Seite', path: '/success',
    blocks: [
      { id: 's-hero', title: 'Bestätigung', kind: 'hero', fields: [
        { key: 't', label: 'Titel', de: 'Danke für deine Bestellung!', en: 'Thank you for your order!' },
        { key: 's', label: 'Text', de: 'Wir haben dir eine E-Mail geschickt. Schau auch im Spam-Ordner nach.', en: 'We sent you an email. Please also check your spam folder.', multiline: true } ] },
    ],
  },
]

// ---------- Mails ----------
export type SendRule = 'immer' | 'schalter' | 'aktion'
export interface Mail {
  id: string; phase: string; name: string
  when: string; to: string; rule: SendRule; defaultOn: boolean
  conditions: string[]; attachment?: string; whereTriggered: string
  subject: { de: string; en: string }; body: { de: string; en: string }
}

export const phases = ['Kauf', 'Termin', 'Sprungtag', 'Absagen und Probleme', 'Betriebskonto', 'Intern und Flugzeug'] as const

const m = (x: Mail) => x
export const mails: Mail[] = [
  m({ id: 'ticket', phase: 'Kauf', name: 'Ticket-Kauf', when: 'Sofort nach dem Online-Kauf eines Tickets', to: 'Käufer', rule: 'immer', defaultOn: true, conditions: [], whereTriggered: 'Shop → Bezahlen',
    subject: { de: 'Deine Buchung {Code}', en: 'Your booking {Code}' }, body: { de: 'Hallo {Vorname}, danke für deine Buchung. Dein Sprungtag: {Datum}.', en: 'Hi {Vorname}, thanks for your booking. Your jump day: {Datum}.' } }),
  m({ id: 'voucher', phase: 'Kauf', name: 'Gutschein-Kauf', when: 'Sofort nach Online-Kauf, manueller Erstellung oder erneutem Versand', to: 'Käufer', rule: 'immer', defaultOn: true, attachment: 'Gutschein-PDF', conditions: ['Dem Gutschein muss eine PDF-Vorlage zugewiesen sein'], whereTriggered: 'Shop → Bezahlen · Tickets → Gutschein ausstellen · Tickets → Erneut senden',
    subject: { de: 'Dein Gutschein {Code}', en: 'Your voucher {Code}' }, body: { de: 'Hallo {Vorname}, im Anhang findest du deinen Gutschein. Einlösbar bis {Ablaufdatum}. Termin wählen: {Link}', en: 'Hi {Vorname}, your voucher is attached. Valid until {Ablaufdatum}. Pick a date: {Link}' } }),
  m({ id: 'redemption', phase: 'Termin', name: 'Gutschein eingelöst', when: 'Wenn ein Gutschein eingelöst wird, vom Kunden im Shop oder vom Personal', to: 'Käufer', rule: 'immer', defaultOn: true, conditions: ['Nicht bei nur vorläufiger Reservierung'], whereTriggered: 'Shop → Einlösen · Tickets → Einlösen',
    subject: { de: 'Dein Termin am {Datum}', en: 'Your date: {Datum}' }, body: { de: 'Hallo {Vorname}, dein Gutschein ist eingelöst. Wir erwarten dich am {Datum}.', en: 'Hi {Vorname}, your voucher is redeemed. See you on {Datum}.' } }),
  m({ id: 'booking_assigned', phase: 'Termin', name: 'Buchung zugewiesen', when: 'Wenn der Koordinator die Buchung einem Flug zuweist', to: 'Käufer', rule: 'aktion', defaultOn: true, conditions: ['Beim Zuweisen ist „Benachrichtigung senden“ aktiv', 'Pro Buchung und Flug nur einmal'], whereTriggered: 'Sprungtag → Vorab einplanen',
    subject: { de: 'Du bist eingeplant', en: 'You are scheduled' }, body: { de: 'Hallo {Vorname}, du bist für {Datum} um {Uhrzeit} eingeplant.', en: 'Hi {Vorname}, you are scheduled for {Datum} at {Uhrzeit}.' } }),
  m({ id: 'booking_rescheduled', phase: 'Termin', name: 'Buchung verschoben', when: 'Wenn das Personal eine Buchung auf einen neuen Tag verschiebt', to: 'Käufer', rule: 'aktion', defaultOn: true, conditions: ['Im Dialog ist „Benachrichtigung senden“ aktiv', 'Käufer-E-Mail vorhanden'], whereTriggered: 'Tickets → Verschieben',
    subject: { de: 'Dein Termin wurde verschoben', en: 'Your date was moved' }, body: { de: 'Hallo {Vorname}, dein Sprung findet jetzt am {Datum} statt (vorher: {AlterTermin}).', en: 'Hi {Vorname}, your jump is now on {Datum} (was: {AlterTermin}).' } }),
  m({ id: 'operation_day_active', phase: 'Sprungtag', name: 'Sprungtag startet', when: 'Wenn der Sprungtag auf „aktiv“ gesetzt wird', to: 'Alle eingeplanten Gäste des Tages', rule: 'schalter', defaultOn: true, conditions: ['Pro Buchung nur einmal'], whereTriggered: 'Sprungtag → Tag starten',
    subject: { de: 'Heute wird gesprungen', en: 'Jumping today' }, body: { de: 'Hallo {Vorname}, heute ist Sprungtag. Bitte sei um {Uhrzeit} am Flugplatz.', en: 'Hi {Vorname}, today is jump day. Please be at the airfield at {Uhrzeit}.' } }),
  m({ id: 'flight_ready', phase: 'Sprungtag', name: 'Flug bereit', when: 'Wenn dein Flug auf „Boarding“ gesetzt wird', to: 'Gäste auf diesem Flug', rule: 'schalter', defaultOn: false, conditions: ['Pro Buchung und Flug nur einmal'], whereTriggered: 'Sprungtag → Flug: Boarding starten',
    subject: { de: 'Dein Flug ist bereit', en: 'Your flight is ready' }, body: { de: 'Hallo {Vorname}, bitte komm jetzt zum Boarding.', en: 'Hi {Vorname}, please come to boarding now.' } }),
  m({ id: 'signed_agreement_customer', phase: 'Sprungtag', name: 'Beförderungsvertrag (Kunde)', when: 'Direkt nach der Unterschrift am Kiosk', to: 'Unterzeichnender Gast', rule: 'immer', defaultOn: true, attachment: 'Unterschriebenes PDF', conditions: ['Beim Check-in wurde eine E-Mail erfasst'], whereTriggered: 'Kiosk → Unterschrift',
    subject: { de: 'Dein unterschriebener Vertrag', en: 'Your signed agreement' }, body: { de: 'Hallo {Vorname}, anbei dein unterschriebener Beförderungsvertrag.', en: 'Hi {Vorname}, attached is your signed carriage agreement.' } }),
  m({ id: 'jump_completed', phase: 'Sprungtag', name: 'Sprung abgeschlossen', when: 'Wenn der Flug gelandet ist und ein Zertifikat vorliegt', to: 'Gäste auf diesem Flug', rule: 'schalter', defaultOn: false, conditions: [], whereTriggered: 'Sprungtag → Flug: Gelandet',
    subject: { de: 'Danke fürs Mitspringen', en: 'Thanks for jumping' }, body: { de: 'Hallo {Vorname}, hier ist dein Zertifikat: {Link}.', en: 'Hi {Vorname}, here is your certificate: {Link}.' } }),
  m({ id: 'operation_day_cancelled', phase: 'Absagen und Probleme', name: 'Sprungtag abgesagt', when: 'Wenn ein Sprungtag abgesagt wird', to: 'Alle Buchungen des Tages', rule: 'immer', defaultOn: true, conditions: [], whereTriggered: 'Sprungtag → Tag absagen',
    subject: { de: 'Sprungtag abgesagt', en: 'Jump day cancelled' }, body: { de: 'Hallo {Vorname}, der Sprungtag am {Datum} muss leider entfallen. Wir melden uns mit einem neuen Termin.', en: 'Hi {Vorname}, jump day {Datum} is cancelled. We will contact you.' } }),
  m({ id: 'booking_cancelled_operator', phase: 'Absagen und Probleme', name: 'Storniert mit Umbuchungs-Link', when: 'Wenn das Personal eine Buchung wegen Betrieb storniert und online bezahlt wurde', to: 'Käufer', rule: 'schalter', defaultOn: true, conditions: ['Ohne Umbuchungs-Link wird die Mail „Storniert ohne Erstattung“ verwendet'], whereTriggered: 'Sprungtag → Nicht geflogen klären',
    subject: { de: 'Wir müssen dir absagen', en: 'We have to cancel' }, body: { de: 'Hallo {Vorname}, leider klappt es nicht. Neuen Termin wählen oder Geld zurück: {Link}', en: 'Hi {Vorname}, unfortunately it did not work. Pick a new date or get a refund: {Link}' } }),
  m({ id: 'booking_cancelled_contact', phase: 'Absagen und Probleme', name: 'Storniert ohne Erstattung', when: 'Bei No-Show oder zu später Stornierung', to: 'Käufer', rule: 'schalter', defaultOn: true, conditions: [], whereTriggered: 'Sprungtag → Nicht geflogen klären',
    subject: { de: 'Deine Buchung wurde storniert', en: 'Your booking was cancelled' }, body: { de: 'Hallo {Vorname}, bitte melde dich bei uns.', en: 'Hi {Vorname}, please contact us.' } }),
  m({ id: 'signed_agreement_coordinator', phase: 'Intern und Flugzeug', name: 'Vertrag an Koordinator', when: 'Direkt nach der Unterschrift am Kiosk', to: 'Manifest-Koordinator (intern)', rule: 'immer', defaultOn: true, attachment: 'Unterschriebenes PDF', conditions: ['Koordinator-E-Mail ist hinterlegt'], whereTriggered: 'Kiosk → Unterschrift',
    subject: { de: 'Neuer Vertrag: {Name}', en: 'New agreement: {Name}' }, body: { de: 'Ein Gast hat unterschrieben. PDF im Anhang.', en: 'A guest signed. PDF attached.' } }),
  m({ id: 'account_statement', phase: 'Betriebskonto', name: 'Kontoauszug (Monatsende)', when: 'Am Monatsende, nachdem der Kassier die Auszüge freigegeben hat', to: 'Jedes Mitglied mit Buchungen im Monat', rule: 'aktion', defaultOn: true, attachment: 'Kontoauszug-PDF', conditions: ['Nur nach Freigabe durch den Kassier', 'Mitglieder im Minus erhalten einen Zahlungshinweis'], whereTriggered: 'Finanzen → Betriebskonten → Kontoauszüge',
    subject: { de: 'Dein Kontoauszug {Monat}', en: 'Your account statement {Monat}' }, body: { de: 'Hallo {Vorname}, anbei dein Kontoauszug für {Monat}. Kontostand: {Kontostand}.', en: 'Hi {Vorname}, your statement for {Monat} is attached. Balance: {Kontostand}.' } }),
  m({ id: 'afp_reminder', phase: 'Intern und Flugzeug', name: 'Erinnerung: AFP oder Flug beginnen', when: '60 Minuten vor Beginn einer Reservierung (Flug beginnen) oder eines Sprungflugs im Manifest (AFP)', to: 'Pilot der Reservierung oder des Flugs', rule: 'schalter', defaultOn: true, conditions: ['Nur wenn für den Flug noch kein AFP freigegeben ist'], whereTriggered: 'Reservierungen, Sprungtag',
    subject: { de: 'Dein Flug um {Uhrzeit}: AFP vorbereiten', en: 'Your flight at {Uhrzeit}: prepare the AFP' }, body: { de: 'Hallo {Vorname}, dein Flug beginnt um {Uhrzeit}. Das AFP geht in einer Minute: {Link}', en: 'Hi {Vorname}, your flight starts at {Uhrzeit}. The AFP takes a minute: {Link}' } }),
  m({ id: 'reservation_promoted', phase: 'Intern und Flugzeug', name: 'Reservierung aktiviert', when: 'Wenn eine Standby-Reservierung nachrückt', to: 'Inhaber der Reservierung', rule: 'immer', defaultOn: true, conditions: [], whereTriggered: 'Flugzeuge → Reservierung storniert oder gekürzt',
    subject: { de: 'Deine Reservierung ist aktiv', en: 'Your reservation is active' }, body: { de: 'Hallo {Vorname}, du bist nachgerückt.', en: 'Hi {Vorname}, you moved up.' } }),
  m({ id: 'reservation_kicked', phase: 'Intern und Flugzeug', name: 'Reservierung auf Standby', when: 'Wenn ein Sprungtag deine Reservierung überlagert', to: 'Inhaber der Reservierung', rule: 'immer', defaultOn: true, conditions: [], whereTriggered: 'Sprungtag wird angelegt',
    subject: { de: 'Deine Reservierung wurde verschoben', en: 'Your reservation was bumped' }, body: { de: 'Hallo {Vorname}, du stehst jetzt auf Standby, Position {Position}.', en: 'Hi {Vorname}, you are on standby, position {Position}.' } }),
]

export const placeholders = ['{Vorname}', '{Name}', '{Datum}', '{Uhrzeit}', '{Code}', '{Link}', '{Ablaufdatum}', '{AlterTermin}', '{Monat}', '{Kontostand}']

// ---------- Products & PDF templates ----------
export interface PdfTemplate { id: string; name: string; type: 'Gutschein' | 'Ticket'; active: boolean }
export const pdfTemplates: PdfTemplate[] = [
  { id: 't1', name: 'Gutschein Standard', type: 'Gutschein', active: true },
  { id: 't2', name: 'Gutschein Weihnachten', type: 'Gutschein', active: true },
  { id: 't3', name: 'Ticket Standard', type: 'Ticket', active: true },
]

export interface Product {
  id: string; kind: 'Gutschein' | 'Ticket'; name: string; nameEn: string; price: number
  validityMonths?: number; prefix: string; active: boolean; templateId: string
  description: string; features: string[]; shownOn: { page: string; label: string }[]
}
export const products: Product[] = [
  { id: 'p1', kind: 'Ticket', name: 'Tandemsprung', nameEn: 'Tandem jump', price: 220, prefix: 'TB', active: true, templateId: 't3', description: 'Ca. 45 Sekunden freier Fall aus 4.000 m.', features: ['Tandem-Master', 'Ausrüstung', 'Einweisung'], shownOn: [{ page: 'bookings', label: 'Seite „Termin buchen“' }, { page: 'home', label: 'Karte „Direkt buchen“' }] },
  { id: 'p2', kind: 'Ticket', name: 'Tandem + Video', nameEn: 'Tandem + video', price: 290, prefix: 'TV', active: true, templateId: 't3', description: 'Tandemsprung inklusive Video.', features: ['Tandem-Master', 'Ausrüstung', 'Video in HD'], shownOn: [{ page: 'bookings', label: 'Seite „Termin buchen“' }] },
  { id: 'p3', kind: 'Gutschein', name: 'Tandem-Gutschein', nameEn: 'Tandem voucher', price: 220, validityMonths: 12, prefix: 'GS', active: true, templateId: 't1', description: 'Gültig für einen Tandemsprung.', features: ['Tandemsprung', '12 Monate gültig'], shownOn: [{ page: 'vouchers', label: 'Seite „Gutscheine“' }, { page: 'home', label: 'Karte „Gutschein verschenken“' }] },
  { id: 'p4', kind: 'Gutschein', name: 'Tandem + Video Gutschein', nameEn: 'Tandem + video voucher', price: 290, validityMonths: 12, prefix: 'GV', active: false, templateId: 't2', description: 'Mit Video-Paket.', features: ['Tandemsprung', 'Video'], shownOn: [{ page: 'vouchers', label: 'Seite „Gutscheine“' }] },
]

export const requirements = [
  { id: 'r1', text: 'Ich bin mindestens 16 Jahre alt.', required: true, active: true },
  { id: 'r2', text: 'Ich wiege weniger als 100 kg.', required: true, active: true },
  { id: 'r3', text: 'Ich möchte Neuigkeiten des Clubs erhalten.', required: false, active: true },
]
