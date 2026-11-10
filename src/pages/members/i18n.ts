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
  checkinTitle: 'Tandem-Check-in', whoAreYou: 'Wer bist du?', pickName: 'Tippe auf deinen Namen.', windowAt: (w: string) => `Zeitfenster ${w}`, noOneExpected: 'Heute ist kein Gast mehr zu erwarten.', notInList: 'Ich finde mich nicht in der Liste', notInListText: 'Bitte melde dich beim Manifest. Wir legen deine Buchung kurz an.',
  hi: (n: string) => `Hallo ${n}`, contractIntro: 'Bitte lies den Beförderungsvertrag, fülle die offenen Angaben aus und unterschreibe am Ende.', sign: 'Unterschreiben und einchecken', changeGuest: 'Das bin ich nicht', checkedIn: 'Du bist eingecheckt', checkedInText: 'Danke. Bitte warte in der Nähe des Manifests, wir rufen dich auf. Dein unterschriebener Vertrag ist gespeichert.', mailCopy: (m: string) => `Eine Kopie geht an ${m}.`, nextGuest: 'Nächster Gast', alreadyIn: 'Schon eingecheckt',
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
  checkinTitle: 'Tandem check-in', whoAreYou: 'Who are you?', pickName: 'Tap your name.', windowAt: (w) => `Time window ${w}`, noOneExpected: 'No more guests are expected today.', notInList: 'I cannot find myself in the list', notInListText: 'Please see the manifest desk. We will create your booking quickly.',
  hi: (n) => `Hello ${n}`, contractIntro: 'Please read the carriage agreement, fill in the open details and sign at the end.', sign: 'Sign and check in', changeGuest: 'This is not me', checkedIn: 'You are checked in', checkedInText: 'Thank you. Please wait near the manifest desk, we will call you. Your signed agreement is saved.', mailCopy: (m) => `A copy goes to ${m}.`, nextGuest: 'Next guest', alreadyIn: 'Already checked in',
  overdue: (due) => `The fee was due on ${due} and is still open. Please transfer it by the stated date.`,
}
export const ui = (lang: Lang = 'de') => (lang === 'en' ? en : de)
