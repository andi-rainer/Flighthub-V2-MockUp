# 01 · FlightHub V1: was es kann und was nicht

V1 ist das bestehende System (Repository `flight-hub`) und für V2 nur Prototyp und Referenz. V2 ist ein komplett neues Projekt. Alle Angaben sind Fakten über V1 (`[V1]`); Zahlen stammen aus einer Code-Inventur und wurden nicht neu gezählt.

## 1. Überblick

- Vereinsverwaltung für einen österreichischen Flug- und Fallschirmclub: Flugzeuge, Wartung, Reservierungen, Bordbuch, Skydive-Manifest, Gutscheine und Tickets, Mitglieder, Finanzen. EUR, Deutsch und Englisch.
- Technik: Next.js, TypeScript, Tailwind, shadcn/ui, Supabase (PostgreSQL mit Row Level Security, Auth, Storage, Realtime), next-intl, Jest, Playwright, Vercel. `main` geht auf Staging, ein Tag `vX.Y.Z` auf Produktion.
- 186 Migrationen, viele davon Nachbesserungen.
- **tandem-store:** zweites Projekt (Kunden-Shop per iframe), gleiche Supabase-Instanz, Einstellungen über `/api/store/*`.
- Die mobile App (flighthub-mobile) liegt auf Eis.

## 2. Was V1 kann

**Rechte und Anmeldung**
- Funktionsbasierte Rechte in der Datenbank; keine Rolle „Vorstand“ mehr. Funktionen sind die einzige Quelle. Systemfunktionen: Pilot, Fluglehrer, Chefpilot, Tandem-Master, Skydive-Instruktor, Sportspringer, Skydive-Pilot, Manifest-Koordinator, Kassier, Obmann, Schriftführer; eigene sind möglich. Obmann, Schriftführer und Kassier haben alle Rechte.
- Zuweisungen mit Gültigkeit (`valid_from`, `valid_until`); Katalog mit Codes, Markierung „sensibel“ und Voraussetzungen zwischen Rechten; Prüfung in SQL und App. Gelöschte oder gesperrte Mitglieder haben keine Rechte. Altlast und wurde noch nie benötigt.
Die Rechte und Funktionen sind gewachsen und wurden zig mal umgebaut. Soll in V2 von Anfang an ein komplettes Permission-based system sein.
- Sperrschutz: Die letzte Person mit „Berechtigungen verwalten“ kann nicht entfernt werden.
- Vertrauenswürdige und öffentliche Geräte: Nicht vertrauenswürdige Sitzungen enden nach 30 Minuten Inaktivität oder 3 Stunden.
- Step-up: Sensible Rechte brauchen auf öffentlichen Geräten eine frische Bestätigung (15 Minuten) per Passwort oder QR-Code (Computer zeigt Code und Zahl, das vertrauenswürdige Handy wählt die richtige unter dreien, eine falsche Wahl verbrennt den Code). 5 falsche Passwörter sperren 5 Minuten.
- QR-Anmeldung erzeugt immer eine nicht vertrauenswürdige Sitzung. Einladung per 8-stelligem Code. Seite „Meine Geräte“.

**Fliegen**
- Flugzeuge mit Dokumenten und Ablaufwarnungen; blockierende Dokumente verhindern Reservierungen.
- Reservierungen: eigene Zeitleiste, Konflikterkennung, Standby, Echtzeit. Design funktioniert sehr gut.
- Bordbuch mit Import-Assistent; die Liste funktioniert gut.
- Lizenzen, Dokumente, Endorsements; Flughafengebühren je Flugzeug.

**Skydive**
- Manifest: Operation Days, Lifte (geplant → bereit → Boarding → in der Luft → abgeschlossen). Sportspringer = 1 Platz, Tandempaar = 2, Konflikte verhindert ein Trigger.
- Zweistufige Tandem-Buchung: vorläufige Zuweisung mit Platzhalter, Check-in des echten Passagiers am Platz. Flug mit Platzhalter abgeschlossen → Gutschein „nicht erschienen“. Entfernen eines vorläufig zugewiesenen Springers setzt die Buchung zurück auf „offen“.
- Kiosk-Registrierung für Tandem und Sportspringer mit Beförderungsvertrag; Check-in vor Ort mit Unterschrift.
- Sportspringer-Selbstbuchung `/book-jump`: **nie benutzt, nicht fertig.**
- Gutscheine und Tickets: Ansehen, Ändern, Anlegen und Arten haben getrennte Rechte; Tickets sind Buchungen; Umbuchen und Erstatten per Token.

**Geld**
- Abrechnung (`billing.*`) in App, Datenbankregeln und `charge_flight()`: Beträge in ganzen Cent auf 2 bis 5 Zahler, Prozente ergeben 100, Buchung eines Flugs atomar, Sammelabrechnung über einen Plan.
- Betriebskonto je Mitglied: Der Ticketpreis wird vom Konto bezahlt, Einzahlungen (bar oder Überweisung) werden dagegen gebucht.
- Mein Konto für Mitglieder, Konten-Import aus CSV, Exporte, Audit-Protokoll, Benachrichtigungen.

**Kommunikation**
- Mails und Shop-Verwaltung; im Grundsatz gut. 17 Mailtypen, nur 5 lassen sich ein- und ausschalten.

## 3. Was V1 nicht oder schlecht kann

**Fehlt**
- Anträge (Mitgliedschaft neu, ändern, beenden) als konfigurierbare, versionierte Formulare mit unterschriebener PDF-Kopie beim Mitglied.
- Mitgliedsbeiträge mit Fälligkeitslogik, Rechnung und Zahlungsaufforderung.
- Bankdaten importieren, Barausgaben verfolgen, Belege je Buchung, Rechnungen an Dritte für Flüge. Dafür zahlt der Verein ein zweites Programm (Vereinsplaner); mit den Konten pro Mitglied entsteht doppelte bis dreifache Arbeit, Mitgliederdaten stehen doppelt.
- Wirtschaftlichkeit je Sparte (Sportspringen, Tandem, Charter von Mitgliedern, Charter an andere Fallschirmclubs) aus dem echten Geldfluss.
- Echte Flugkosten; heute gelten minutenbasierte Kosten.

**Schwach**
- Sprungtag: Sportspringer brauchen eine Buchung mit Zeitfenster. Das passt für Tandemtage und gemischten Betrieb, nicht für Tage, an denen sich eine Gruppe Sportspringer einfach findet. Danach müssen nicht geflogene Buchungen aufgelöst und Zahlungen im Vereinsplaner erfasst und gutgeschrieben werden.
- Manifest Zuweisung: UX ist sperrig und teile müssen immer wieder neu geladen werden.
- Kostenstelle Skydive: Flugkosten gehen negativ an die Kostenstelle, der Ticketpreis gleicht nur das Konto des Springers aus; die Wirtschaftlichkeit wird geschätzt.
- Dashboard funktioniert nicht richtig, kein Vorbild.
- Tabellen mit Schaltflächen (Bearbeiten, Mitgliedschaft, Aktionen) sind unübersichtlich verteilt.
- Webshop-Konfiguration ist schwer zu verstehen; Kommunikation und Shop-Verwaltung sind nicht eng genug verknüpft.
- Mitglieder ohne Betriebskonto (z. B. Tandem-Monatsmitglieder) werden nur über einen Filter ausgeblendet.
- Umfang: Manifest 40 Dateien, rund 11.000 Zeilen, etwa 30 Dialoge (mehrere fast gleiche Zahlungsdialoge); Tickets und Voucher rund 6.600 Zeilen; Abrechnung rund 7.000; Bordbuch rund 4.700 (ein Dialog mit 1.200 Zeilen); Reservierung 4.000; Lizenzen und Dokumente 2.800.

**Technische Altlasten**
- Zwei getrennte Umkehr-Systeme im Geld: Flug-Storno (alle Buchungen eines Flugs, entsperrt den Flug) und manuelle Umkehr (einzelne manuelle Buchung, lehnt flugbezogene ab).
- Altes Feld `functions` am Nutzer; Flag `needs_board_review` mit altem Namen; im Tandem-Store sind Stripe-Schlüssel mit dem anonymen Schlüssel lesbar (`store_settings`).
- Voucher- und Ticketseiten nur auf Englisch.
- I18n nicht durchgängig.

## 4. Was daraus für V2 folgt

- **Übernommen:** Rechte-Logik komplett, QR-Anmeldung und Modell vertrauenswürdiger/öffentlicher Geräte, Reservierungsdesign, Listenstil des Bordbuchs.
- **Nicht übernommen:** Sportspringer-Selbstbuchung `book-jump`, Dashboard, mobile App (bleibt auf Eis).
- Alles Weitere: [02-v2-beschluesse.md](02-v2-beschluesse.md).
