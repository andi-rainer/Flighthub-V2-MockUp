# 03 · Der Klickdummy: was er zeigt und wie er gebaut ist

Stand: 09.11.2026. Lies zuerst die Statuslegende in [README.md](README.md).

Der Klickdummy ist **kein Produkt**. Er zeigt UI, UX und Abläufe, damit nach Screenshots und Klickfolgen in einem neuen Projekt gebaut werden kann `[N 07.11.]`. Alle Daten sind erfundene Beispieldaten, nichts wird gespeichert, es gibt kein Backend. Was hier steht, beschreibt den **Ist-Stand des Dummys**; was V2 wirklich wird, steht in [02](02-v2-beschluesse.md).

Marken: `[N dd.mm.]` Andreas hat es verlangt oder entschieden. `[C]` **Claude-Entwurf**: so hat Claude es im Dummy gelöst, Andreas hat es gesehen, aber **nicht ausdrücklich bestätigt**. Wer V2 baut, darf `[C]` nicht als Vorgabe lesen.

## 1. Betrieb und Technik

- Repository: `andi-rainer/Flighthub-V2-MockUp` (öffentlich). Die Seite wird bei **jedem Push auf `main`** automatisch veröffentlicht: <https://andi-rainer.github.io/Flighthub-V2-MockUp/> (GitHub Actions, `.github/workflows/pages.yml`). `[N 09.11.]`
- Technik, von Claude gewählt (Andreas: „Du entscheidest“): Vite 8, React, TypeScript (strikt), Tailwind v4, `react-router-dom` mit **HashRouter**, `lucide-react`, `clsx`. Keine weiteren Bibliotheken. `[C]`
- Lokal: `npm install`, `npm run dev` (Port 5173), `npm run build` (Typprüfung und Build). Der Basispfad kommt aus `VITE_BASE` (Pages: `/<Repo>/`, lokal `/`); Bilder über `import.meta.env.BASE_URL`.
- Zustand: `src/state.tsx` (`useApp()`), Rechte `src/permissions.ts`, Sitzung `src/session/session.tsx` (`useSession().guarded(recht, aktion)` löst bei sensiblen Rechten die Bestätigung aus). Mitgliederdaten sind das Feld `members` in `src/data.ts`.
- Anmeldung im Dummy: Vorauswahl ist Eva Steiner (Pilot, Fluglehrer, Kassier). Im Benutzermenü lässt sich die Person wechseln; das Demo-Passwort steht in `src/pages/Login.tsx`.
- Das Verhalten der Oberfläche prüft man im Browser (Desktop 1440×900); automatische Tests gibt es nicht.

## 2. Seiten

| Adresse | Seite | Recht (Menü hängt daran) |
|---|---|---|
| `/dashboard` | Übersicht | alle |
| `/reservierungen` | Reservierungen, Tage untereinander `[N 07.11.]` | `aircraft.view` |
| `/flugzeuge`, `/flugzeuge/:id` | Flugzeuge, Details mit einer Fälligkeitsliste, Masse und Schwerpunkt `[C]` | `aircraft.view` |
| `/flug/:key` | Flugseite (AFP bzw. „Flug beginnen“), kein Menüpunkt `[N 06.11.]` | `afp.view` |
| `/bordbuch` | Bordbuch je Flugzeug, schlank, mit Pagination `[N 07.11.]` | `flight.log.view` |
| `/sprungtag` | Manifest, Check-in, Abschluss | `manifest.view` |
| `/tickets` | Tickets und Voucher | `vouchers.view` |
| `/mitglieder` | Reiter Mitglieder, Anträge, Beiträge, Funktionen und Rechte, Mitgliedschaft einrichten | `members.view.all` |
| `/mitglieder/:id` | Mitgliederakte: Stammdaten, Betriebskonto, Mitgliedschaft, Dokumente und Funktionen, Verlauf | `members.view.all` |
| `/formulare` | Alle Formulare, Editor, Gestaltung, Versionen `[N 08.11.]` | `pdf_templates.manage` |
| `/antrag/<id>` | Öffentliche Antragsseite ohne Login, DE/EN `[N 07.11.]` | keines |
| `/shop` | Shop und Mails | Shop-Rechte |
| `/finanzen` | Reiter Bank und Belege, Flüge verrechnen, Betriebskonten, Ergebnis, Kostenstellen | `billing.view.all` |
| `/einstellungen` | Mein Profil, Passwort und Sicherheit, Meine Geräte, Vereinsdaten | alle (Vereinsdaten: `settings.edit.system`) |
| `/mein-konto` | Eigenes Konto | `billing.view.own` |

Reiter von Finanzen und Mitglieder stehen in der Adresse (`?tab=`), damit die Zurücktaste funktioniert `[N 09.11.]`. Detailseiten, die aus einer Liste geöffnet werden, zeigen „Zurück zu …“ (`src/backTo.ts`).

## 3. Verhalten der Kernflüsse

### Anmeldung und Geräte (Modell aus V1 `[N 07.11.]`)
- Passwort mit „Diesem Gerät vertrauen“ (Standard aus) oder QR-Anmeldung (immer öffentliches Gerät). Öffentliche Geräte: Abmeldung nach 30 Minuten ohne Aktivität oder 3 Stunden, Warnung, Restzeit oben rechts. Sensible Aktionen brauchen dort eine Bestätigung per Passwort oder QR (15 Minuten gültig, 5 falsche Passwörter sperren 5 Minuten). Alle Grenzen in `src/session/policy.ts`. `[V1]`
- Kopfleiste oben rechts mit kleiner Pille für öffentliche Geräte und Benutzermenü; die Seitenleiste enthält nur Navigation. `[N 07.11.]`
- Einstellungen: Profil, Passwort, Geräte; Datensatz identisch mit der Mitgliederakte. `[N 07.11.]`

### Mitglieder
- Liste: Beitragsstatus, Hinweise, „Austritt zum …“, keine Aktionsknöpfe in der Zeile, Klick öffnet die Akte. `[N 07.11.]`
- **Aufnehmen:** Hauptknopf „Mitglied aufnehmen“ öffnet den Aufnahmeantrag. Daneben ein „…“-Menü mit **„Ohne Formular anlegen (Ausnahme)“** (Recht `members.create`, sensibel): Name, E-Mail, Mitgliedschaft, Beginn, **Pflichtgrund (mind. 10 Zeichen)**, Zusammenfassung, ausdrückliche Bestätigung. Dokumentiert im Verlauf, mit Marke „Ohne Formular“ in Liste und Akte, Filter „Ohne Formular (n)“. `[N 09.11.]` Ablauf und Marken sind `[C]`.
- **Akte:** Reiter Stammdaten (getrennte Felder), Betriebskonto, Mitgliedschaft (Beiträge, Antrag stellen, Ausnahme ohne Formular), Dokumente und Funktionen (Funktion zuweisen in drei Schritten `[C]`), Verlauf. `[N 07.11.]`
- **Verlauf:** nur Formulare, Stammdaten (alt → neu), Mitgliedschaft (Formular verlinkt oder Ausnahme mit Grund). `[N 08.11.]`
- **Mitgliedschaft ohne Formular ändern:** diskreter Link, Hinweis, neue Mitgliedschaft, Datum, Pflichtgrund, Bestätigungsschritt mit Zusammenfassung. `[N 08.11.]`
- **Betriebskonto bleibt bestehen**, solange der Saldo nicht 0 ist, auch nach dem Wechsel auf eine Mitgliedschaft ohne Konto; Kennzeichnung „läuft aus“. `[N 08.11.]`
- **Funktionen und Rechte:** Startliste mit elf Funktionen; umbenennen (Name, Gruppe), löschen (nennt vorher alle Inhaber, Sperrschutz bleibt), neu anlegen (optional Rechte einer anderen Funktion übernehmen). `[N 09.11.]`
- **Mitgliedschaft einrichten:** Liste der Mitgliedschaften (Name, Betrag, Laufzeit „verlängert sich automatisch“ oder „endet nach …“, Betriebskonto ja/nein), Beitragsmuster als zweite Liste, Vorschau „Was zahlt ein neues Mitglied?“. Auswahl, welche Mitgliedschaft Gäste beim Tandem-Check-in bekommen. `[N 09.11.]` Die Gestaltung der Seite ist `[C]`.
- **Beitragsmuster:** jährlich oder monatlich; fester Stichtag oder am Eintrittsdatum; erster Beitrag voll, anteilig (monats- bzw. tagesgenau) oder in Stufen. `[N 06.11.]` Details der Bedienung `[C]`.

### Anträge und Formulare
- Antragsarten: Aufnahme (Neu), Änderung, Beendigung. Wege: **Link** (72 Stunden, ohne Login, zuerst erzeugen, dann kopieren oder mailen), **Blanko-PDF** (Scan oder Foto hochladen, Daten manuell übernehmen), **Vor Ort** am Tablet (nur Mitglieder, mit Passwort oder QR bestätigt), **Vorstand ohne Unterschrift** (nur Austritt oder Ausschluss, bei Ausschluss mit Grund). `[N 07.11.]`
- Ein neuer Antrag derselben Art für dieselbe Person oder Adresse ersetzt einen unfertigen. Nur sinnvolle Anträge sind möglich. `[N 07.11.]`
- Genehmigen weist die Mitgliedschaft zu bzw. beendet sie. `[C]`
- **Ein Editor je Formular** (Reiter Inhalt, Gestaltung, Versionen) mit Live-Vorschau als PDF oder Online-Formular. **Die Gestaltung gehört zur Version** und wird mit ihr gesperrt. Neue Version = Entwurf, Veröffentlichen, alte wird archiviert. `[N 08.11.]`
- **Inhalt** ist eine geordnete Liste aus Feldern (Text, Datum, Auswahl, Bestätigung) und freien Blöcken (Überschrift, Text mit Hervorhebung und Platzhaltern wie `{Vereinsname}`, Neue Seite). `[N 09.11.]`
- **Feld „Wer füllt es aus?“** (Person oder vorbelegt aus benannter Quelle) statt eines unklaren Schalters „Vorbelegt“; **Auswahlfeld** zeigt seine Auswahlmöglichkeiten; **Wirkung bei Genehmigung** (z. B. „Mitgliedschaft wird auf die Auswahl gesetzt“) ist am Feld einstellbar. `[N 08.11.]` Die konkrete Form ist `[C]`.
- **Vereinsdaten zentral** (Einstellungen → Vereinsdaten). Beim Speichern fragt die App, welche Formulare noch die alten Daten zeigen: „Neue Versionen als Entwurf anlegen“, „Neue Versionen gleich veröffentlichen“ oder „Formulare nicht ändern“. Pro Formular lässt sich je Teil (Logo, Name, Adresse, Kontakt, Fußzeile) wählen, ob er angezeigt wird, und überschreiben. Standard-Gestaltung nur als Vorlage für Neues. `[N 09.11.]`
- **Rechnung und Zahlungsaufforderung** sind Dokumente im selben System mit Vereinsdesign. `[N 08.11.]`
- **Beförderungsvertrag** nach dem Papierformular digitalisiert: Angaben, Vertragstexte, Haftungsausschluss und Gesundheitserklärung hervorgehoben und ausgeschrieben, jeder Gesundheitspunkt einzeln bestätigt, Einweisung, Film- und Fotorechte, Gerichtsstand. `[N 09.11.]`
- **Zweisprachig:** Editor-Schalter „Sprache: Deutsch | English · n offen“; Englisch-Ansicht mit Fortschritt; Zustände **fehlt**, **Deutsch geändert, prüfen**, **fertig**; **Veröffentlichen gesperrt**, bis beide Sprachen vollständig sind. Sprache der Person beim Antrag (aus dem Profil vorgeschlagen); öffentliche Seite hat DE | EN; Rechnungen in der Sprache des Mitglieds. `[N 09.11.]` Details der Übersetzungsansicht `[C]`.

### Finanzen
- **Bank und Belege:** Buchungen zuordnen (Vorschlag und Bestätigung), Belege, Barausgaben. `[N 06.11.]`
- **Flüge verrechnen:** Bordbuch-Einträge werden nie automatisch gebucht, der Kassier bestätigt einzeln oder gesammelt. `[N 06.11.]`
- **Betriebskonten:** Liste mit Filtern (Saldo ungleich 0, im Minus, nur aktive, braucht Aufmerksamkeit), Klick öffnet die Akte, Kontoauszüge nach Freigabe des Kassiers `[C]`. Bar-Einzahlung mit **wählbarem Datum**, dezent; Überweisung nur bei Namensvermutung. `[N 09.11.]`
- **Ergebnis** je Sparte und **Kostenstellen**. `[N 06.11.]` Aufbau `[C]`.

### Sprungtag, Flug, Reservierung
- **Check-in** für Sportspringer mit Pflichtgewicht; **Manifest** mit Liften. `[N 06.11.]`
- **Flugseite** in Schritten (Flug, Beladung, Treibstoff, Prüfung und Freigabe, Zeiten) mit den vier Zeiten, nächster Flug bereit nach Abschluss. `[N 06.11.]` Die genauen Schritte sind `[C]`.
- **Reservierungen:** mehrere Tage, mehrere je Person, Standby bei Überlappung. `[N 06.11.]` `[N 07.11.]`

## 4. Claude-Entwürfe im Dummy, nicht bestätigt `[C]`

Diese Dinge hat Claude im Dummy entworfen, ohne dass Andreas sie ausdrücklich verlangt oder bestätigt hat. Sie sind **keine** Vorgabe.

- Das Bedienmuster für Tabellen: ein sichtbarer Knopf je Zeile, der Rest im „…“-Menü; Klick auf die Zeile öffnet das Detail (Andreas hat die Unübersichtlichkeit bemängelt, nicht das Muster vorgegeben).
- **AFP-Entwurf** (aus dem Ausgangsdokument; nicht alles davon ist im Dummy sichtbar): Sperre nach der Freigabe; Erinnerungsmail 60 Minuten vorher; Marke „AFP offen“; Boarding ohne AFP nur mit Grund und als Prüfaufgabe „Sprungflüge ohne AFP prüfen“; ohne Schwerpunktdaten des Flugzeugs kein AFP (der Chefpilot trägt die Daten ein); Resttreibstoff des letzten Flugs als Vorgabe für den nächsten.
- **Dashboard je Rolle** (Aufgabenliste des Kassiers, Sprungtag, Startseite des Mitglieds).
- **Shop und Mails** als Reise des Kunden mit Mails an jeder Station; Mailliste nach Phase mit Schaltern.
- **Flugzeug-Details** mit einer einzigen Fälligkeitsliste (Wartung, Bauteile, Dokumente) und Masse-und-Schwerpunkt-Diagramm.
- **Bordbuch:** Kraftstoff und Öl als getrennte optionale Abschnitte, Beleg oder Pflichtgrund; Spalten und Marken.
- **Sprungtag-Abschluss:** Aufbau des Dialogs und der Zahlungsarten.
- **Beiträge:** Reiter „Beiträge“ mit Beitragslauf, Rechnung und Zahlungsaufforderung nach Freigabe.
- **Beförderungsvertrag** und Gesundheitspunkte in deutschem Wortlaut (aus dem englischen Papier übersetzt); die Zuordnung der Gäste zu einer Mitgliedschaft erfolgt im Dummy ohne Check-in.
- Texte, Beschriftungen und Aufbau der Dialoge, soweit oben nicht als `[N]` markiert.

## 5. Was der Dummy nicht zeigt

- Den **Tandem-Check-in** vor Ort mit Unterschrift des Beförderungsvertrags `[N 08.11.]`.
- **Drag and Drop** und Größenändern bei Reservierungen `[N 06.11.]`.
- Echte Datenhaltung, Rechteprüfung in einer Datenbank, E-Mail-Versand, PDF-Erzeugung (der Dummy zeigt eine Seitenvorschau), Bankanbindung, Zahlungen.
- Mehrsprachigkeit von Mitgliedschaftsnamen und eigenen Auswahllisten; Antworten werden unter dem deutschen Feldnamen gehalten.
- Mobile Ansicht ist nicht systematisch geprüft.
- Offline-Betrieb, Boarding-Anzeige, Preisprofile, Sprungkarten, Rechnungsprüfer-Rolle `[akzeptiert]`, aber nicht gebaut.
