# 02 · FlightHub V2: was sicher kommt (Beschlüsse)

Stand: 09.11.2026. Lies zuerst die Statuslegende in [README.md](README.md).

Hier steht **nur**, was Andreas gesagt, entschieden oder ausdrücklich akzeptiert hat. Jede Zeile trägt ihre Quelle:

- `[N dd.mm.]` Andreas hat es so gesagt oder entschieden (Datum der Nachricht in der Sitzung 06.–09.11.2026).
- `[akzeptiert]` Vorschlag von Claude, den Andreas pauschal angenommen hat („Der Rest ist alles super und gute Vorschläge“, 06.11.). Die Richtung steht fest, die Einzelheiten sind noch nicht ausgearbeitet.
- `[N, im Dummy umgesetzt]` Wunsch von Andreas, Umsetzung im Klickdummy durch Claude; die genaue Form ist Claude-Entwurf (siehe [03-klickdummy.md](03-klickdummy.md)).

Ideen, offene Fragen und Vorschläge ohne Zustimmung stehen **nur** in [04-offen-und-ideen.md](04-offen-und-ideen.md).

## 1. Ziel und Rahmen

- V2 ist ein **komplett neues Projekt** mit neuen Technik-Entscheidungen. Die vollständige Spezifikation kommt vor dem Bau, V1 dient nur als Prototyp. `[N 06.11.]`
- Hauptanliegen: weniger technische Schulden, eine **leichter verständliche und intuitivere Bedienung**, bessere Performance. `[N 06.11.]` Dazu nennt Andreas UI und einfache Bedienung als Hauptanliegen neben Performance. `[N 06.11.]`
- FlightHub wird die **eine Plattform für alles**: Bankdaten importieren, Barausgaben verfolgen, Rechnungen an jede Buchung hängen, Rechnungen für Flüge an Dritte erstellen. Das zweite bezahlte Programm (Vereinsplaner) soll entfallen. `[N 06.11.]`
- Aus dem echten Geldfluss muss sichtbar sein, ob die Sparten (Sportspringen, Tandem, Charter von Mitgliedern, Charter an andere Fallschirmclubs) tragfähig sind, auch als gemeinnütziger Verein. Später sollen die **echten Kosten** bekannt sein, damit ein angemessener Charter-Satz für Mitglieder berechnet werden kann, **inklusive Fixkosten**. `[N 06.11.]`
- Die Spezifikation soll wie ein **Benutzerhandbuch** funktionieren (spezifikations- und testgetrieben); dafür Prototypen wie der Klickdummy. `[N 06.11.]`
- **Dynamisch:** mehrere Flugzeuge, ein Flugzeug kann nur für Springen oder nur für Charter genutzt werden, ein Verein macht evtl. nur das eine oder das andere. `[N 06.11.]`
- **Betrieb:** weniger als 10 Vereine, **eine Installation pro Verein**, jeder hostet selbst, **kein Mandantensystem**. `[N 06.11.]`
- **Ausweise und Lizenzen** werden künftig nicht mehr gescannt, sondern nur noch **verfolgt** (Ablaufdatum, welche Lizenzen). `[N 06.11.]`
- **Geräte:** Am Sprungtag meist Tablet, gelegentlich Handy. Außerhalb des Manifests ist der **PC das Hauptgerät** (Verrechnung, Mitgliederverwaltung, Flugzeugdaten, Tickets und Voucher, Shop). Manifest, Check-in, Bordbuch und Mein Konto sind für Tablet und Handy gebaut. `[N 06.11.]`
- **Nicht jetzt:** Notruf mit Position bei Außenlandung (außerhalb des Umfangs), eine eigene Mobile-App. Denkbar bleibt eine Version für Mobil und eine für Laptop und Tablet. `[N 06.11.]`
- **Technik der echten V2** (Sprachen, Frameworks, Datenbank): entscheidet Andreas selbst („das Technische habe ich im Griff“). `[N 06.11.]` Der Klickdummy nutzt Technik, die Claude gewählt hat (Andreas: „Du entscheidest“). `[N 06.11.]`
- Der Klickdummy ist **nur** zum Zeigen von UI und klaren Abläufen, damit nach Screenshots und Klickfolgen in einem komplett neuen Projekt gebaut werden kann. Keine echte Logik. `[N 07.11.]`

## 2. Grundsätze für die Bedienung

- **Ein klarer Weg zum Ziel, über das gesamte Projekt.** Viele Wege zum gleichen Ergebnis sind ein Fehler. `[N 07.11.]`
- **Aktionen in Tabellen** übersichtlich und einheitlich; Schaltflächen nicht verstreut. `[N 06.11.]` (Umsetzungsmuster: [03](03-klickdummy.md))
- **Pagination überall** bei langen Listen, von Anfang an. `[N 07.11.]`
- **Schlanke Listen** nach dem Vorbild von V1 (viele Zeilen pro Seite). `[N 07.11.]`
- **Rückweg:** Wer eine Detailseite aus einer Liste öffnet, muss zurückkommen, per Zurücktaste des Browsers und per Link in der Oberfläche. `[N 09.11.]`
- **Keine Info-Texte**, die nur wiederholen, was Andreas Claude erklärt hat. Regeln gehören in die Dokumentation, nicht in die Oberfläche. `[N 08.11.]`
- **Dashboard** ist wichtig und neu zu gestalten; das V1-Dashboard ist kein Vorbild. `[N 06.11.]`
- Rechte, Anmeldung und Geräte: siehe Abschnitt 8.

## 3. Sprungtag und Manifest

- **Check-in für Sportspringer** statt Buchung mit Zeitfenster; die Buchung `book-jump` aus V1 entfällt. `[N 06.11.]`
- **Gewicht je Springer ist Pflicht** (für den Schwerpunkt). `[N 06.11.]`
- Der Schwerpunkt braucht auch den **Treibstoff, den nur der Pilot kennt**. `[N 06.11.]`
- **Tandem** behält Slots und Zeitfenster; für Sportspringer gibt es keine. `[akzeptiert]` (Anwesenheit statt Buchung)
- **Abschluss eines Operation Day:** gebucht wird **immer vom Betriebskonto** (Transparenz). Bei Barzahlung kann die Einzahlung direkt gebucht werden, eine Überweisung erst, wenn sie eingegangen ist. **Keine automatischen Buchungen.** Es muss leicht und nachvollziehbar sein, wie Geld hereinkommt. `[N 06.11.]`
- **Tandem-Check-in vor Ort** (wie in V1) mit unterschriebenem Beförderungsvertrag. `[N 08.11.]` (im Dummy noch nicht gebaut)

## 4. AFP und Flugablauf

- **AFP (Abbreviated Flight Plan)** ersetzt das Papierformular: Passagiere mit Gewicht, Treibstoff, Leermasse, Vergleich mit MTOW, Prüfung des Schwerpunkts, Endurance aus der Spritmenge, nach der Landung Remaining Endurance und Restkraftstoff. Es muss auf **iPad mini und Smartphone** funktionieren, weil es erst am Flugzeug passiert, örtlich getrennt von der Dropzone. `[N 06.11.]`
- **Eigene Seite**, kein Dialog und kein Überblendfenster. Schritte hintereinander, vor und zurück möglich. `[N 06.11.]`
- **Vier Zeiten chronologisch:** Off-block, Take-off, Landing, On-block; daraus ergibt sich eine Zeit, die nicht direkt änderbar ist; nur diese vier Zeiten sind änderbar. `[N 06.11.]`
- **Masse und Schwerpunkt müssen vor Off-block im Limit sein.** `[N 06.11.]`
- **Nur Skydive hat vorausgefüllte Gewichte** (nicht jeder Passagier ist Mitglied). Bei Charter trägt immer der Pilot ein. `[N 06.11.]`
- Das **AFP gibt es nur für Skydive**. Charterflüge heißen **„Flug beginnen“**, mit derselben Logik. Bordbuch-Einträge dürfen ohne AFP erfolgen. `[N 06.11.]`
- Nach Abschluss eines AFP steht **der nächste Flug**, wenn verfügbar, bereit und lässt sich mit minimalem Aufwand öffnen. `[N 06.11.]`

## 5. Reservierungen und Bordbuch

- Reservierungen wie in V1, plus **mehrere Tage** und **mehrere Reservierungen pro Person**. `[N 06.11.]`
- Layout wie V1: **Tage untereinander**, der senkrechte Platz wird genutzt. `[N 07.11.]`
- Eine Pilotenreservierung, die sich mit einem Sprungtag überschneidet, kommt **auf Standby** (wird nicht gesperrt). `[N 07.11.]`
- Für die spätere Umsetzung: Reservierungen müssen per **Drag and Drop verschiebbar** und **editierbar** sein. `[N 06.11.]` (nicht im Dummy)
- **Bordbuch:** Icons und Labels aus dem Dummy sind gewünscht, die Liste bleibt schlank wie in V1 (viele Einträge pro Seite), mit Pagination von Anfang an. `[N 07.11.]`

## 6. Mitglieder, Anträge, Beiträge

### Anträge und Formulare
- **Anträge:** Mitgliedschaft neu, ändern (z. B. Kurzzeit auf normal), beenden. Die Formulare sind **konfigurierbar, aber zu einem Zeitpunkt klar festgelegt und nicht nachträglich änderbar**. Eine **Kopie des unterschriebenen Formulars wird als PDF beim Mitglied gespeichert.** `[N 06.11.]`
- Anträge werden **verschickt und ohne Login ausgefüllt**, sie erzeugen ein **unterschriebenes PDF**. Bei Änderung per Mail oder als **temporärer Link (72 Stunden)** zum Kopieren. `[N 07.11.]`
- Bei **Änderung** und **Austritt** ist die bisherige Mitgliedschaft **bekannt** und nicht wählbar. Austritt oder Ausschluss kann der **Schriftführer ohne Unterschrift** des Mitglieds durchführen. `[N 07.11.]`
- Aus jedem Antrag entsteht ein **klares PDF**, das auch **blanko zum Ausfüllen von Hand** geladen werden kann. Wird das händisch ausgefüllte Formular hochgeladen, müssen Änderungen **manuell** durchgeführt werden können. `[N 07.11.]`
- **Aufnahmeantrag:** braucht vorab keine Daten außer einer E-Mail-Adresse, wenn er per Mail geht; der Rest kommt vom Antragsteller. Das **Blanko-PDF** lässt sich mit nicht verpflichtenden Daten **vorausfüllen**. `[N 07.11.]`
- Neuaufnahmen gehen **nur per Link oder Papier**. Zuerst wird der **Link erzeugt**, dann wird angeboten, ihn **per Mail zu schicken oder zu kopieren** (zwei getrennte Schritte). `[N 07.11.]`
- Ein neues Formular **desselben Typs für dasselbe Mitglied bzw. dieselbe Mail ersetzt das vorherige, solange es nicht fertig ist.** Es sollen nur **sinnvolle** Formulare erzeugbar sein (aus der Mitgliederansicht: nur „ändern“ bzw. nur „Austritt“, das Mitglied steht nicht zur Auswahl). `[N 07.11.]`
- Ein **Änderungsantrag** kann schon beim Erstellen festlegen, **worauf** geändert wird und **ab wann**. `[N 07.11.]`
- Der **Tab „Anträge“** erzeugt nicht von selbst einen neuen Antrag, erst der Klick auf den Button. `[N 07.11.]`
- **„Jetzt hier ausfüllen und unterschreiben“** muss abgesichert werden, z. B. mit dem Passwort des betreffenden Mitglieds oder per QR-Code wie im Step-up-Verfahren von V1. `[N 07.11.]` Es gibt **keine Ausweisprüfung** (das war ein Missverständnis). `[N 07.11.]`
- Die **Definition der Formulare** muss auffindbar sein: direkter, offensichtlicher Zugang (nicht „Mitglieder → Anträge → Formulare → …“). `[N 08.11.]`
- **Gestaltung und Inhalt gehören zusammen und werden gemeinsam versioniert.** Ein bereits benutztes Formular darf sein Aussehen nicht mehr ändern. `[N 08.11.]`
- Der Schalter **„Vorbelegt“** muss verständlich sein; ein Feld vom Typ **„Auswahl“** muss zeigen, **was gewählt werden kann** und was geschieht. `[N 08.11.]`
- **Vereine** sollen **Form und Gestaltung leicht beeinflussen** können: eigenes Logo, Name, Adresse, was wird wo angezeigt; einfach und effektiv. `[N 08.11.]`
- **Rechnungen** bekommen ebenfalls das Vereinsdesign (möglichst direkt verknüpft). `[N 08.11.]`
- **Vereinsdaten sind zentral** in der App geregelt. Eine Änderung fragt, ob neue **Formularversionen** erstellt werden sollen. Pro Formular ist wählbar, **welche Vereinsinformationen angezeigt werden**; **Überschreiben** ist möglich. `[N 09.11.]`
- **Felder und Texte werden kombiniert**; Texte lassen sich frei einfügen. `[N 09.11.]`
- **Akzentfarbe** frei wählbar, nicht nur Standardfarben (eine anklickbare Farbpalette genügt). `[N 09.11.]`
- **Alle Formulare** brauchen eine **deutsche und englische Version.** Eine neue Version muss **immer in beiden Sprachen vervollständigt** werden. Für jetzt zeigt der Dummy nur den UI/UX-Weg. `[N 09.11.]`
- **Formulare werden technisch einheitlich behandelt**, auch der Beförderungsvertrag. `[N 08.11.]`

### Beförderungsvertrag (Tandem)
- Das alte Papierformular „Contract of Carriage“ (Englisch, 2 Seiten) wird **erneuert und digitalisiert.** `[N 09.11.]`
- **Haftungsausschluss (Waiver) und Gesundheitserklärung müssen ersichtlich sein.** In der Gesundheitserklärung muss **jeder Punkt einzeln bestätigt** werden (zum Beispiel: kein schwerer Unfall, keine ernste Erkrankung, kein mentales Leiden, kein Alkohol in den letzten 12 Stunden). `[N 09.11.]`

### Mitgliedschaften und Beiträge
- **Beitragsfälligkeit** in beiden Formen: ein **fester Stichtag** im Jahr (z. B. 1.1., mit anteiligem ersten Beitrag, Beispiel: Eintritt am 1.6. zahlt 50 %, der nächste Beitrag am 1.1.) **oder** individuell **ein Jahr nach der Einschreibung**. Dazu **Rechnung und Zahlungsaufforderung** je Mitgliedsbeitrag. `[N 06.11.]`
- Es gibt verschiedene **Mitgliedschaften**, verknüpft mit **Verrechnungsmustern** (Stichtag mit Stufen, monatlich oder jährlich, mit Eintrittsdatum), die Mitgliedern zugeordnet werden. `[N 07.11.]` (Wunsch nach einer besseren Bedienung am PC)
- **Mitglieder-Liste:** zeigt sofort, ob Beiträge **offen oder bezahlt** sind. **Einzahlungen** gehören nicht in die Mitgliederliste, sie laufen über Finanzen. `[N 07.11.]`
- **Beiträge** als eigene Ansicht, **zusätzlich in Liste und Detailansicht** des Mitglieds eingebunden. `[N 07.11.]`
- **Stammdaten:** Name in Vor- und Nachname, Adresse in Straße, Hausnummer, PLZ, Stadt, Land; Notfallkontakt in Name und Telefon. **Funktion zuweisen** klarer. `[N 07.11.]`
- **Selbstbedienung:** Mitglieder ändern persönliche Daten und Passwort selbst und sehen wie in V1 ihre **aktiven Geräte** (mit Abmeldung). Das Badge für öffentliche Geräte gehört **nicht** in die Seitenleiste, sondern wie in V1 **oben rechts**. `[N 07.11.]`
- **Verlauf** der Mitgliederakte zeigt nur **Formulare, Stammdatenänderungen und Mitgliedschaftsänderungen.** Check-ins und Buchungen auf dem Betriebskonto stehen dort nicht. `[N 08.11.]`
- **Mitgliedschaft ohne Formular ändern** ist eine **absolute Ausnahme**, erfordert einen **klaren Grund** und eine **erneute Bestätigung.** `[N 08.11.]`
- Im Verlauf ist bei Änderung, Aufnahme oder Beendigung **entweder das Formular verlinkt oder** (Ausnahme durch den Vorstand) die **Ausnahme mit Kommentar/Grund** klar erkennbar. `[N 08.11.]`
- **Betriebskonto-Ausnahme beim Wechsel:** Ein Betriebskonto mit Saldo ungleich 0 bleibt beim Wechsel auf eine Mitgliedschaft ohne Konto bestehen (Beispiel: 500 € Guthaben). Das war Andreas’ Vorschlag („Ist das technisch lösbar?“); im Dummy umgesetzt. `[N, im Dummy umgesetzt 08.11.]`
- **Aufnehmen:** Der **Standardweg ist ein Formular** (Antrag). Eine **Person ohne Formular anzulegen** (z. B. nur für Tests) muss möglich sein, **klar dokumentiert** und als **Sekundärweg für Ausnahmen** gedacht. Der Import heißt nur „Importieren“. `[N 09.11.]`
- **Funktionen und Rechte:** Alle Funktionen sind nur **vorbefüllt**; sie lassen sich **umbenennen, löschen und neu anlegen.** `[N 09.11.]`
- **Mitgliedschaft für den Tandem-Check-in:** Es soll **konfigurierbar** sein, **welche Mitgliedschaft** eine Person beim Tandem-Check-in bekommt (auswählbar), nicht starr an einer Mitgliedschaft hängen. Der Check-in selbst ist noch nicht gebaut. `[N 09.11.]`
- Andreas hat die **Einführung „1. Beitragsmuster → 2. Mitgliedschaft → 3. Mitglieder“ nicht verstanden**; sie muss verständlich sein. `[N 09.11.]`

## 7. Finanzen

- **Finanzen:** Bankbuchungen und Belege stehen im Vordergrund. **Mitglieder-Betriebskonten** sollen mehr hervortreten: **Einzahlung bar buchen** und **Überweisung einem Betriebskonto zuweisen.** `[N 06.11.]`
- Später erarbeitet ein **KI-Agent** die Zuordnungen vor, Andreas bestätigt nur. `[N 06.11.]`
- **„Flug verrechnen“ bleibt:** Ein Flug wird nie sofort gebucht, es braucht **immer die Bestätigung des Kassiers**. `[N 06.11.]`
- **Lande- und Anfluggebühren** wie in V1: Plätze schicken Monats- oder unregelmäßige **Sammelrechnungen**, die sich nicht immer einem Flug zuordnen lassen. Ein **LLM** soll später diese Rechnungen und **Tank-Lieferscheine** gegen die **Bordbuch-Einträge** prüfen. `[N 06.11.]`
- **Betriebskonto je Mitgliedschaftsart:** Bei jeder Mitgliedschaft wird gewählt, ob ein Konto geführt wird. Mitglieder ohne Konto werden nicht gelistet und nicht verfolgt. `[N 06.11.]` Die V1-Filter dienen als Vorbild.
- **Mein Konto** zeigt Mitgliedern **nur den eigenen Kontostand**; alle sieht nur, wer die Berechtigung hat (z. B. Kassier). `[N 06.11.]`
- **Bar-Einzahlung:** das **Datum ist wählbar**, weil Eingänge wegen Personalkapazität erst Tage später gebucht werden können. `[N 09.11.]`
- In der Mitgliederakte ist **„Bar einzahlen“ dezent**, die **Überweisung** wird dort nur bei einer **Vermutung** (z. B. gleicher Name) zugewiesen, dazu ein **Link zu Finanzen.** `[N 09.11.]`
- **SEPA-Lastschrift:** denkbar, aber unklar (siehe [04](04-offen-und-ideen.md)). `[N 06.11.]`

## 8. Rechte, Anmeldung, Geräte

- **Rechtesystem von V1 übernehmen**, die Logik **genau so**. Pilot soll deutlich mehr sehen. `[N 06.11.]`
- **QR-Code-Anmeldung** und der Mechanismus **vertrauenswürdiger/nicht vertrauenswürdiger Geräte** werden übernommen. `[N 07.11.]`

## 9. Shop, Mails, Tickets

- **Manifest sowie Gutscheine und Tickets** werden überarbeitet. `[N 06.11.]`
- **Kommunikation** passt grundsätzlich, soll aber **enger mit dem Store-Management verwoben** sein; die **Webshop-Konfiguration** muss verständlicher werden. `[N 06.11.]`

## 10. Pauschal akzeptierte Vorschläge `[akzeptiert]`

Andreas hat die Vorschläge in `archiv/inventur-recherche-vorschlaege.md` (Abschnitte 1 und 3) mit „Der Rest ist alles super und gute Vorschläge“ angenommen, ausgenommen die Punkte, die er einzeln kommentiert hat (Flug verrechnen, Landegebühren, die vier Entscheidungen). Die Richtung gilt, **Details sind nicht entschieden**:

- **Manifest:** Anwesenheit statt Buchung; Preisprofile mit Ausnahmen pro Mitglied und Sprungkarten; Masse und Schwerpunkt je Flug aus Gewichten und Tankmenge; **Warnen statt blockieren** bei abgelaufenen Dokumenten oder Überladung; Boarding-Anzeige für einen zweiten Bildschirm und **Offline-Betrieb** der Tablets; ein Ablauf (Plan, Aktiv, Abschluss) statt vieler Dialoge, Mails über Regeln.
- **Tickets und Voucher:** ein Begriff mit Lebenslauf (gekauft, reserviert, eingelöst oder geflogen, danach No-Show, Storno, Umbuchung, Erstattung); Gutschein als Verbindlichkeit bis zum Flug, Ertrag erst beim Sprung; Ablauf-Erinnerungen und Verlängerung als bewusste Aktion mit Grund; Aktionen immer an derselben Stelle der Zeile.
- **Finanzen:** unveränderliches Hauptbuch, nur Storno (ein Umkehr-Mechanismus statt zwei); zwei Sichten (Geldfluss mit Einnahmen-Ausgaben-Rechnung für das Vereinsgesetz, Ergebnis je Sparte nach Flugminuten); Jahresabschluss-Export und Rolle „Rechnungsprüfer“; Belegnummer je Buchung; Bank per Kontoauszugsdatei zuerst; lernende Zuordnungsregeln; einmaliger Import der V1-Kontostände zur Migration.
- **Übernehmen:** Reservierung, Rechte-Konzept, Kiosk-Registrierung, Bordbuch-Import nur einmalig zur Migration, Lizenzen nur als Daten.
