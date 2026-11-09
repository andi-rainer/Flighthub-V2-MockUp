import { type Lang } from './data'

/** Fixed texts around a form (not part of its content), in both languages: PDF frame, online form, public page, invoice. */
const de = {
  blank: 'Blanko-Formular', prefilledForm: 'Vorausgefülltes Formular', application: 'Antrag', version: 'Version', formVersion: 'Formularversion',
  placeDate: 'Ort, Datum', signature: 'Unterschrift', noSignature: 'ohne Unterschrift, Vorstandsbeschluss', page: (n: number, m: number) => `Seite ${n} von ${m}`,
  printHint: 'Bitte in Druckschrift ergänzen, unterschreiben und beim Verein abgeben oder einscannen.', created: 'Erstellt', channel: 'Weg', verified: 'Identität bestätigt',
  signHint: 'Hier mit Finger oder Stift unterschreiben', clear: 'Löschen', choose: 'Bitte wählen', prefilled: 'Vorbelegt', byClub: 'vom Verein vorgegeben', send: 'Absenden', sendGetPdf: 'Absenden und PDF erhalten', open: 'Noch offen',
  hello: (n: string) => `Hallo ${n}`, welcome: 'Willkommen', fillIn: (until?: string) => `bitte fülle den Antrag aus und unterschreibe am Ende. Der Link gilt bis ${until ?? ''}.`, secure: 'gesicherte Verbindung',
  privacy: 'Deine Angaben gehen nur an den Verein und werden für die Mitgliederverwaltung gespeichert.', thanks: 'Danke, dein Antrag ist beim Verein', thanksText: 'Dein unterschriebenes PDF ist erstellt. Der Verein prüft den Antrag und meldet sich bei dir.', download: 'PDF herunterladen',
  invalid: 'Dieser Link ist nicht gültig', invalidText: 'Bitte frage beim Verein nach einem neuen Link.', expired: 'Dieser Link ist abgelaufen', expiredText: 'Links gelten 72 Stunden. Bitte frage beim Verein nach einem neuen Link, er schickt dir sofort einen.',
  paper: 'Dieser Antrag läuft auf Papier', paperText: 'Bitte gib das ausgefüllte und unterschriebene Formular beim Verein ab oder schicke den Scan.', received: 'Dieser Antrag ist schon eingegangen', receivedText: 'Danke, der Verein hat deinen Antrag und prüft ihn.',
  invoice: 'Rechnung', reminder: 'Zahlungsaufforderung', to: 'An', fee: 'Mitgliedsbeitrag', payableBy: 'Zahlbar bis', after14: '14 Tage nach Erhalt', after7: '7 Tage nach Erhalt', paymentRef: 'Verwendungszweck',
  overdue: (due: string) => `Der Beitrag war am ${due} fällig und ist noch offen. Bitte überweise ihn bis zum angegebenen Datum.`,
}
const en: typeof de = {
  blank: 'Blank form', prefilledForm: 'Pre-filled form', application: 'Application', version: 'Version', formVersion: 'Form version',
  placeDate: 'Place, date', signature: 'Signature', noSignature: 'no signature, board decision', page: (n, m) => `Page ${n} of ${m}`,
  printHint: 'Please complete in block letters, sign and hand it in at the club or scan it.', created: 'Created', channel: 'Channel', verified: 'Identity confirmed',
  signHint: 'Sign here with your finger or a pen', clear: 'Clear', choose: 'Please choose', prefilled: 'Pre-filled', byClub: 'set by the club', send: 'Submit', sendGetPdf: 'Submit and get the PDF', open: 'Still missing',
  hello: (n) => `Hello ${n}`, welcome: 'Welcome', fillIn: (until) => `please fill in the application and sign at the end. The link is valid until ${until ?? ''}.`, secure: 'secure connection',
  privacy: 'Your details go to the club only and are stored for membership administration.', thanks: 'Thank you, your application has reached the club', thanksText: 'Your signed PDF has been created. The club will review the application and get back to you.', download: 'Download PDF',
  invalid: 'This link is not valid', invalidText: 'Please ask the club for a new link.', expired: 'This link has expired', expiredText: 'Links are valid for 72 hours. Please ask the club for a new link, they will send one right away.',
  paper: 'This application is on paper', paperText: 'Please hand in the completed and signed form at the club or send the scan.', received: 'This application has already been received', receivedText: 'Thank you, the club has your application and is reviewing it.',
  invoice: 'Invoice', reminder: 'Payment request', to: 'To', fee: 'Membership fee', payableBy: 'Payable by', after14: '14 days after receipt', after7: '7 days after receipt', paymentRef: 'Payment reference',
  overdue: (due) => `The fee was due on ${due} and is still open. Please transfer it by the stated date.`,
}
export const ui = (lang: Lang = 'de') => (lang === 'en' ? en : de)
