# 01 · FlightHub V1: was es kann und was nicht

Stand: 09.11.2026. Lies zuerst die Statuslegende in [README.md](README.md).

V1 ist das bestehende System (separates Repository `flight-hub`). Es dient für V2 **nur als Prototyp und Referenz**, V2 ist ein komplett neues Projekt `[N 06.11.]`.
Alle Angaben hier sind Fakten über V1. Marken: `[V1]` aus der V1-Projektdokumentation oder der Code-Inventur (Zahlen vom 06.11.2026, nicht neu gezählt), `[N dd.mm.]` Aussage von Andreas.

## 1. Was V1 ist

- Vereinsverwaltung für einen österreichischen Flug- und Fallschirmclub: Flugzeuge, Wartung, Reservierungen, Bordbuch, Skydive-Manifest, Gutscheine und Tickets, Mitglieder, Finanzen. Währung EUR, Deutsch und Englisch. `[V1]`
- Technik: Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Supabase (PostgreSQL mit Row Level Security, Auth, Storage, Realtime), next-intl, Jest, Playwright, Vercel. `[V1]`
- `main` geht automatisch auf Staging, ein Tag `vX.Y.Z` auf Produktion. `[V1]`
- Umfang: 186 Migrationen, viele für Nachbesserungen. `[V1]`
- Ein zweites Projekt **tandem-store** (Kunden-Shop, per iframe auf der Vereinsseite) teilt dieselbe Supabase-Instanz und holt Einstellungen über `/api/store/*`. `[V1]`
- Eine mobile App (flighthub-mobile) wurde verworfen und liegt auf Eis; sie liest noch `users.role` und `needs_board_review`. `[V1]` `[N 06.11.]`

## 2. Was V1 kann

### Rechte und Anmeldung
- **Funktionsbasierte Rechte**, in der Datenbank gespeichert. Es gibt keine Rolle „Vorstand“ und keine Spalte `users.role`. Funktionen sind die einzige Quelle für Rechte. `[V1]`
- Systemfunktionen: Pilot, Fluglehrer, Chefpilot, Tandem-Master, Skydive-Instruktor, Sportspringer, Skydive-Pilot, Manifest-Koordinator, Kassier, Obmann, Schriftführer; eigene Funktionen sind möglich. Obmann, Schriftführer und Kassier haben alle Rechte. `[V1]`
- Zuweisungen haben `valid_from` und `valid_until`. Rechte-Katalog mit Codes, Markierung „sensibel“, Rechten für alle (`grantedToAll`) und Voraussetzungen zwischen Rechten. Prüfung in SQL (auch in den Datenbankregeln) und in der App. Gelöschte oder gesperrte Mitglieder haben keine Rechte. `[V1]`
- **Sperrschutz:** Die letzte Person mit dem Recht „Berechtigungen verwalten“ kann nicht entfernt werden. `[V1]`
- **Vertrauenswürdige und öffentliche Geräte:** Anmeldung mit Haken „Diesem Gerät vertrauen“. Nicht vertrauenswürdige Sitzungen enden nach 30 Minuten ohne Aktivität oder 3 Stunden. Sitzungen laufen über Datenbankfunktionen, die Grenzen stehen an einer Stelle. `[V1]`
- **Step-up:** Sensible Rechte brauchen auf öffentlichen Geräten eine frische Bestätigung (15 Minuten gültig) per Passwort oder per **QR-Code** (der Computer zeigt Code und Zahl, das vertrauenswürdige Handy wählt die richtige Zahl unter dreien, eine falsche Wahl verbrennt den Code). 5 falsche Passwörter sperren 5 Minuten. `[V1]`
- QR-Anmeldung erzeugt immer eine nicht vertrauenswürdige Sitzung. Einladung per 8-stelligem Code, der in einen Zugangslink umgewandelt wird. Seite „Meine Geräte“. `[V1]`
- Einstellungen: eigenes Konto (Profil, Sicherheit, Geräte) für alle, Vereinsdaten nur mit dem Recht `settings.edit.system`. `[V1]`

### Fliegen
- **Flugzeuge** mit Dokumenten und Ablaufwarnungen; blockierende Dokumente verhindern Reservierungen. `[V1]`
- **Reservierungen:** eigene Zeitleiste, Konflikterkennung, Standby-Liste, Echtzeit-Aktualisierung. `[V1]` Andreas bewertet das Design als sehr gut `[N 06.11.]` `[N 07.11.]`.
- **Bordbuch** mit Import-Assistent; Andreas bewertet die Listenansicht als gut `[N 07.11.]`.
- **Lizenzen, Dokumente, Berechtigungen (Endorsements).** `[V1]`
- Flughafengebühren je Flugzeug (`airport-fees.ts`). `[V1]`

### Skydive
- **Manifest:** Operation Days, Lifte (Loads) mit den Zuständen geplant → bereit → Boarding → in der Luft → abgeschlossen. Ein Sportspringer belegt 1 Platz, ein Tandempaar 2 Plätze, Konflikte verhindert ein Datenbank-Trigger (`check_slot_conflict()`). `[V1]`
- **Zweistufige Tandem-Buchung:** Koordinatoren weisen eine offene Buchung einem Lift vorläufig zu (Platzhalter-Passagier), am Platz wird der echte Passagier eingecheckt. Ein Flug, der mit Platzhalter abgeschlossen wird, markiert den Gutschein als „nicht erschienen“. Wird ein vorläufig zugewiesener Springer entfernt, geht die Buchung zurück auf „offen“. `[V1]`
- **Kiosk-Registrierung** für Tandem und Sportspringer inklusive Beförderungsvertrag (API `registration/*`). `[V1]` Ein Check-in vor Ort mit unterschriebenem Beförderungsvertrag existiert in V1 `[N 08.11.]`.
- **Sportspringer-Selbstbuchung** `/book-jump` (höchstens 2 Plätze je Zeitfenster, Stornofrist aus den Einstellungen). **Wurde nie benutzt und ist nicht fertig** `[N 06.11.]`.
- **Gutscheine und Tickets:** `vouchers.view` zeigt nur Listen, jede Änderung braucht `vouchers.manage`, Anlegen `vouchers.create`, Arten `vouchers.catalog.manage`. Tickets sind Buchungen. Umbuchen und Erstatten per Token. `[V1]`

### Geld
- **Abrechnung (`billing.*`)**, durchgesetzt in der App, in den Datenbankregeln und in `charge_flight()`. Beträge werden in ganzen Cent auf 2 bis 5 Zahler aufgeteilt, die Prozente ergeben 100. Die Buchung eines Flugs ist atomar. Sammelabrechnung über einen Plan. `[V1]`
- **Betriebskonto je Mitglied.** Das Mitglied zahlt den Ticketpreis vom Betriebskonto; Einzahlung (bar oder Überweisung) bucht Andreas positiv dagegen `[N 06.11.]`.
- Mein Konto für Mitglieder (rund 250 Zeilen), Konten-Import aus CSV, Exporte, Audit-Protokoll, Benachrichtigungen. `[V1]`

### Kommunikation
- Mails und Shop-Verwaltung; die Kommunikation passt grundsätzlich gut `[N 06.11.]`.
- 17 Mailtypen, davon lassen sich nur 5 ein- und ausschalten, der Rest wird immer gesendet; die Schalter sind einzelne Spalten. `[V1]`

### Bedienung, die gut funktioniert (laut Andreas)
- Flugzeugreservierung `[N 06.11.]` `[N 07.11.]`
- Mitgliedertabelle mit Suche und Pagination `[N 06.11.]`
- Bordbuch-Liste `[N 07.11.]`

## 3. Was V1 nicht kann oder nicht gut kann

### Fehlt laut Andreas
- **Anträge** (Mitgliedschaft neu, ändern, beenden) als konfigurierbare, versionierte Formulare mit unterschriebener PDF-Kopie beim Mitglied. Das gibt es bisher im Vereinsplaner oder nicht richtig. `[N 06.11.]`
- **Mitgliedsbeiträge mit Fälligkeitslogik** (Stichtag mit anteiligem ersten Beitrag oder individuell ein Jahr nach Eintritt) sowie Rechnung und Zahlungsaufforderung dazu. `[N 06.11.]`
- **Bankdaten importieren, Barausgaben verfolgen, Belege je Buchung** und Rechnungen an Dritte für Flüge: Dafür zahlt der Verein derzeit ein zweites Programm (der „Vereinsplaner“). Mit den Konten pro Mitglied entsteht doppelte bis dreifache Arbeit. `[N 06.11.]`
- **Wirtschaftlichkeit je Sparte** (Sportspringen, Tandem, Charter von Mitgliedern, Charter an andere Fallschirmclubs) aus dem echten Geldfluss. `[N 06.11.]`
- **Echte Flugkosten.** Heute gelten minutenbasierte Flugkosten. `[N 06.11.]`
- Mitgliederdaten stehen doppelt in Vereinsplaner und FlightHub. `[N 06.11.]`

### Geht, aber schlecht
- **Sprungtag:** Sportspringer brauchen eine Buchung mit Zeitfenster. Das passt für Tandemtage und gemischten Betrieb, aber nicht für Tage, an denen sich einfach eine Gruppe Sportspringer findet. Nach dem Sprungtag müssen nicht geflogene Buchungen entfernt oder aufgelöst, Zahlungen (bar oder Überweisung) im Vereinsplaner erfasst und den Konten gutgeschrieben werden. `[N 06.11.]`
- **Kostenstelle Skydive:** Die Flugkosten gehen negativ an die Kostenstelle, aber der Ticketpreis gleicht nur das Konto des Springers aus. Die Kostenstelle bekommt nie eine positive Buchung, die Wirtschaftlichkeit wird deshalb geschätzt. `[N 06.11.]`
- **Dashboard** funktioniert nicht richtig und wurde vernachlässigt, **kein Vorbild** für V2. `[N 06.11.]`
- **Tabellen mit Schaltflächen** (Bearbeiten, Mitgliedschaft, Aktionen) sind unübersichtlich verteilt, ab und zu auch bei den Flugzeugen. `[N 06.11.]`
- **Webshop-Konfiguration** ist schwer zu erklären und zu verstehen; die Kommunikation sollte enger mit der Shop-Verwaltung verwoben sein. `[N 06.11.]`
- **Mitglieder ohne Betriebskonto** (z. B. Tandem-Monatsmitglieder) werden in V1 nur über den Filter „Tandem-Passagiere ausblenden“ aus den Konten genommen. `[N 06.11.]` `[V1]`
- Manifest: 40 Dateien, rund 11.000 Zeilen, etwa 30 Dialoge, mehrere fast gleiche Zahlungsdialoge. `[V1]`
- Tickets und Voucher: rund 6.600 Zeilen; Abrechnung: rund 7.000; Bordbuch: rund 4.700 mit einem Dialog von 1.200 Zeilen; Reservierung 4.000; Lizenzen und Dokumente 2.800; Sportspringer-Selbstbuchung 950. `[V1]`

### Technische Altlasten (V1)
- **Zwei getrennte Umkehr-Systeme im Geld:** Flug-Storno (alle Buchungen eines Flugs gemeinsam, entsperrt den Flug) und manuelle Umkehr (eine einzelne manuelle Buchung, lehnt flugbezogene ab). `[V1]`
- Altes Feld `functions` am Nutzer (in `user_functions` überführt), Flag `needs_board_review` mit dem alten Namen, Tandem-Store mit lesbaren Stripe-Schlüsseln (`store_settings` ist mit dem anonymen Schlüssel lesbar). `[V1]`
- Voucher- und Ticketseiten sind nur auf Englisch. `[V1]`
- Riesige Dateien (Bordbuch-Dialog 1.203 Zeilen, Billing-Tab 1.204, Shop-Inhalte 1.642). `[V1]`

## 4. Was daraus für V2 folgt

Siehe [02-v2-beschluesse.md](02-v2-beschluesse.md). Nicht aus V1 übernommen (entschieden): die Sportspringer-Selbstbuchung `book-jump` entfällt `[N 06.11.]`, das Dashboard von V1 ist kein Vorbild `[N 06.11.]`, FlightHub-Mobile bleibt auf Eis `[N 06.11.]`. Aus V1 übernommen (entschieden): die Rechte-Logik komplett `[N 06.11.]`, QR-Anmeldung und das Modell vertrauenswürdiger/öffentlicher Geräte `[N 07.11.]`, Reservierungsdesign `[N 07.11.]`, Listenstil des Bordbuchs `[N 07.11.]`.
