# 04 · Offen, Vorschläge, Recherche

**Nichts hier ist beschlossen.** Beschlossenes steht in [02](02-v2-beschluesse.md).

## 1. Offene Abläufe und Entscheidungen `[Offen]`

**Workflows, die noch zu überlegen sind**
1. **Tandem-Buchungssystem (Slots):** Der Dummy zeigt `[Entwurf]` Zeitfenster mit Kapazität je Tag; ohne Fenster ist der Tag ein reiner Sportspringer-Tag. Zu klären: feste Slots wie in V1, Zeitfenster oder nur ein Tageskontingent; was der Shop zeigt; ob eine Buchung einem Flug nur vorläufig zugewiesen wird.
2. **Tandem-Check-in, Rest:** Absicherung des Geräts (Kopplung statt offenem Link), Gäste ohne Buchung, Vergabe der Mitgliedschaft je Gästeart (Tandem, Schnupperflug o. Ä.).
3. **Tandem-Gast, der nicht erscheint:** Gilt für ihn dasselbe wie für den Sportspringer mit bezahltem Platz, oder bleibt es bei der V1-Regel (Gutschein „nicht erschienen“)?
4. **Bezahlung und Abschluss am Tag:** Ablauf von Zahlungsarten bis Buchung auf Betriebskonto und Kassa; Aufbau des Abschlussdialogs.
5. **Testpersonen** (ohne Formular angelegt): von Beiträgen ausgenommen? Später sperr- oder löschbar?
6. **Wirtschaftlichkeit je Sparte:** Wie Fixkosten auf Sparten und Flugzeuge umgelegt werden und woraus der „angemessene Charter-Satz“ berechnet wird.
7. **Drag and Drop** bei Reservierungen: Bedienung und Konfliktfälle.
8. **Mobile Ansicht:** zwei Versionen (Mobil, Laptop/Tablet) sind denkbar; ob und wann, offen.

**Entscheidungen**
9. **Technik der echten V2** (Sprache, Framework, Datenbank, Hosting je Verein): nicht entschieden.
10. **SEPA-Lastschrift für Beiträge:** denkbar, Folgen jenseits der Programmierung unklar (Abschnitt 4). Bis dahin: Rechnung mit Überweisung und Zahlungsaufforderung.
11. **Aufbewahrungsfristen und Rechnungslegung:** Quellen widersprechen sich (sieben oder zehn Jahre); mit dem Steuerberater klären, auch was der Verein nach § 21 Vereinsgesetz liefern muss.
12. **Zweisprachigkeit** der übrigen Texte: Mitgliedschaftsnamen und eigene Auswahllisten sind einsprachig.
13. **Entwürfe bestätigen oder verwerfen:** alle `[Entwurf]`-Punkte in [03, Abschnitt 4](03-klickdummy.md).
14. **Details der `[Richtung]`-Punkte** ([02, Abschnitt 10](02-v2-beschluesse.md)): Preisprofile, Sprungkarten, Offline-Betrieb, Boarding-Anzeige, Rechnungsprüfer, Jahresabschluss-Export, Belegnummer, Bankanbindung, lernende Regeln.
15. **Finanzen, Rest:** (a) Eine Bankzeile, die eine Umbuchung zwischen Konten ist (Bankomat-Behebung, Einzahlung aufs Sparbuch), soll beim Zuordnen die Gegenbuchung erzeugen oder mit der Zeile des anderen Kontos verknüpft werden, statt doppelt gebucht zu werden; der Dummy kennt die Umbuchung nur über Geldkonten. (b) Mitgliedsbeitrags-Rechnungen sind noch kein Ziel einer Bankzeile. (c) Freigabe ist je Monat; ob zusätzlich eine Jahresfreigabe nötig ist, und ob ein Monat nur in Reihenfolge freigegeben werden darf, ist offen. (d) Ob das Aufheben einer Freigabe eine zweite Person braucht (Vier-Augen-Prinzip). (e) Eine falsch erfasste Auslage lässt sich noch nicht rückgängig machen (Gegenbuchung auf Kostenstelle und Betriebskonto zusammen). (f) Tankbelege bei einem Flug, den ein anderes Mitglied als der Pilot bezahlt hat: der Zahler ist wählbar, die Prüfung des Kassiers fängt Fehler ab. (j) Auslagen: eine Rückfrage an das Mitglied vor Ablehnung, Benachrichtigung bei Gutschrift oder Ablehnung, Sammelprüfung mehrerer Auslagen. (i) Ein Uplift nach der Freigabe eines AFP ändert die Zahlen des unterschriebenen AFP nicht; zu klären, ob ein neuer AFP nötig ist. (g) Der Scanner im Browser des Handys braucht eine kurzlebige, einmalige Adresse je QR-Code; Aufbewahrung der Scans und Datenschutz klären.
16. **Finanzen umstrukturieren (Plan, noch nicht gebaut):** Ziel-Reiter: *Zu bearbeiten* · *Buchungen* · *Rechnungen* · *Betriebskonten* · *Ergebnis* · *Zeiträume*; Kostenstellen und -arten wandern in die Vereinseinstellungen. Schon umgesetzt: Geldkonten in den Buchungen, neues Ergebnis, neue Kostenstellen-Seite. Offen: (a) **Flüge verrechnen ins Bordbuch:** Status am Flug „Zur Verrechnung“ und „Verrechnet“, Filter, Einzel- und Sammelfreigabe (`billing.flights.charge`), Piloten sehen den Stand ihrer Flüge, die Freigabe prüft Zeiten, Piloten und Aufteilung und sperrt den Flug; Finanzen behält nur die Aufgabe in der Übersicht des Kassiers. (b) **Zu bearbeiten als Eingang des Kassiers:** nicht zugeordnete Bankzeilen, Auslagen zur Prüfung, Rechnungen ohne Zahlung, Mitglieder im Minus, mit Ansicht „Erledigt“ (die Reiter Auslagen und die Schnellansicht in den Buchungen gehen darin auf; erledigte Auslagen stehen bis dahin unter Auslagen > Erledigt, in den Buchungen unter „Auslagen“ und im Betriebskonto mit Beleg). (c) **Betriebskonten bleiben getrennt** von den Vereinskonten. (d) **Ergänzungen:** Offene Posten (Mitglieder im Minus, Mahnliste), Kassazählung (Soll und Ist als Protokoll), Export für den Steuerberater (CSV je Zeitraum mit Belegen).
17. **Ergebnis, Rest:** (a) Erlöse aus Flügen haben keine Kostenstelle (Charter und Schulung gehen auf das Betriebskonto des Piloten): eine Betriebsart braucht zusätzlich „Ertrag auf Kostenstelle“, sonst fehlen sie im Ergebnis. (b) Die Auswertung rechnet aus den Buchungen (Geldfluss): Rechnungen ohne Abbuchung und Gutschein-Verbindlichkeiten fehlen. (c) Flugzeug-Kostenstellen zeigen nur Kosten, keinen Ertrag je Flugzeug. (d) Gemeinsame Kosten (Hangar für alle) werden nur auf Flugzeuge verteilt, wenn die Buchung geteilt wird. (e) Flugstunden kommen aus dem Bordbuch; Jahre vor dem Bordbuch brauchen einen Import. (f) Der Dummy hat keine Erträge je Sparte aus Flügen, nur aus Bankbuchungen.

## 2. Vorschläge `[Vorschlag]`

- **Weitere Schalter in den Modulen** (nichts davon ist gebaut):
  - *Skydive, darunter:* **Tandem** (Shop, Tickets und Voucher, Check-in-Kiosk) und **Sportspringer** getrennt schaltbar, für Vereine mit nur einem von beiden.
  - *Charterbetrieb, darunter:* **Schulung** (Flugschüler, Instruktor, Ausbildungsnachweis), **Standby-Liste** der Reservierungen, längste Reservierungsdauer und Vorlaufzeit.
  - *Finanzen:* Beitragslauf, Bankanbindung mit KI-Zuordnung, Belege; Kostenstellen je Betrieb vorbelegen.
  - *Mitglieder:* Online-Anträge (öffentliche Antragsseite) ein/aus.
  - *Mails:* Hauptschalter und Erinnerungen, Mails ohne Skydive-Bezug (Kontoauszug, AFP, Reservierung) gehören dann nicht mehr unter „Shop“.
  - *Sicherheit:* Fristen für nicht vertrauenswürdige Geräte (V1 fest 30 Minuten und 3 Stunden), QR-Anmeldung ein/aus.
  - *Sprache:* Englisch ein/aus.
- **Ausgeschaltete Module, offene Punkte `[Offen]`:** Funktionen und Rechte des Bereichs (z. B. Tandem-Master, Manifest-Rechte) sollten in der Funktionsverwaltung und in den Auswahllisten verschwinden; Mails ohne Skydive-Bezug brauchen einen anderen Ort als „Shop und Mails“; ob offene Sprungtage oder Reservierungen das Ausschalten verhindern oder nur warnen.
- **Tickets und Voucher, weiter:** Erinnerungsmail vor Ablauf eines Gutscheins (mit Vorwarnzeit, als Mail-Regel); Preisversion mit Startdatum in der Zukunft auch im Katalog; abweichende Gültigkeit für Aktionen; Überweisungen mit abweichendem Betrag (Teilzahlung, Sammelüberweisung für mehrere Gutscheine; im Dummy passen nur gleiche Beträge), Erstattung auch für Gutscheine, Online-Zahlungen aus dem Shop der Stripe-Auszahlung zuordnen; Sprungkarten als eigene Art; eine Erinnerung an Gutscheine mit Wunschtermin, wenn der Tag näher rückt.
- **Flugzeuge, weiter:** Warnschwellen je Verein (V1 fest: Dokumente 45 und 5 Tage, Komponenten 80, 90 und 95 Prozent); Erinnerungsmails für Fälligkeiten (Dokumente, Wartung, Komponenten); Stundenzähler (Hobbs, Tach) neben den Bordbuchstunden; Einheiten: Dichte des Treibstoffs je Flugzeug, Gewichte der Personen in lb für Vereine, die so wiegen; ein abgelaufenes Dokument sperrt je Dokument (Schalter), eine Ausnahme mit Begründung (z. B. Überführungsflug mit Genehmigung) ist offen; Dokumentarten als Katalog (siehe Pflichten je Funktion).
- **Oberfläche am PC:** Einstellungen als schlanke Zeilen (Name links, Wert rechts, Zahlen speichern beim Verlassen). Im Dummy bei Manifest-Einstellungen, Modulen, Vereinsdaten und Betriebsarten umgesetzt; weitere Seiten könnten folgen.

- **Betriebsarten, weiter:** Preisversion mit Startdatum in der Zukunft (neuer Preis ab 1.1. vorab eintragen; der Dummy gilt ab dem Tag der Änderung); Betriebsart archivieren statt löschen, sobald Flüge sie nutzen; Preis je Mitglied oder Mitgliedschaft.
- **Sprungbetrieb nach Tandem und Sport auswerten:** Gebucht wird auf eine Kostenstelle. Wer wissen will, was Tandem und Sport kosten, bekommt eine **Auswertung ohne Buchung**: je Flug werden die belegten Plätze (Tandem-Paar 2, Sportspringer 1, bezahlter Platz mitgezählt) auf die beiden Arten verteilt und die Flugkosten anteilig angezeigt. Vorteil: keine feste Prozentzahl, nichts wird doppelt gebucht, Mischflüge sind kein Problem. Alternative, falls die Trennung buchhalterisch nötig ist: automatische Aufteilung je Flug nach Platzanteil auf zwei Kostenstellen (Rundung in ganzen Cent wie bei der Aufteilung auf mehrere Zahler); Nachteil: Tandem-Master-Platz und bezahlte leere Plätze müssen zugeordnet werden. Die Vorbelegung (Preise, Aufteilung) ist erfunden und vom Verein festzulegen.

- `[Offen]` **Springergewicht:** Ob die Schwellen das reine Springergewicht meinen (Dummy) oder mit Ausrüstung und Tandem-Master, ist nicht festgelegt.
- **Dokumente der Mitglieder, weiter:** Mitglied legt eine neue Dokumentart selbst vor (im Dummy nur das Personal, bis der Katalog der Dokumentarten steht); ob ein Springer mit abgelaufenem Dokument eingeplant werden darf (im Dummy nur Warnung, siehe „Pflichten je Funktion“); Erinnerungsmail vor Ablauf; `documents.approve` ist sensibel (auf öffentlichen Geräten mit Bestätigung), das gilt auch für den Koordinator am Platz.
- **Pflichten (Anforderungen) je Funktion:** Funktionen sind frei konfigurierbar; eine Funktion soll auch Pflichten haben, etwa gültige Dokumente.
  - *Dokumentarten* sind ein Katalog des Vereins: Name, Gültigkeit (läuft an einem Datum ab, feste Dauer ab Ausstellung oder unbefristet) und Vorwarnzeit. Beispiele: Medical, Pilotenlizenz, Tandem-Master-Rating, Sprunglizenz.
  - *Anforderungen* hängen an der Funktion: im Dialog der Funktion ein dritter Reiter „Anforderungen“ neben „Name“ und „Berechtigungen“. Eine Zeile je Anforderung: Dokumentart, Pflicht oder empfohlen, und die Folge bei Fehlen oder Ablauf: „Nur Hinweis“ oder „Funktion ruht“ (ihre Berechtigungen gelten dann nicht). Dieselbe 1-aus-x-Logik wie bei den Diensten, z. B. „Medical Klasse 1 oder 2“.
  - *Wirkung* dort, wo die Funktion gebraucht wird: Auswahl von Pilot und Diensten (Hinweis am Namen, bei „ruht“ nicht wählbar), Check-in der Sportspringer (der Hinweis mit dem Dokumentnamen existiert schon), Mitgliederakte (je Funktion der Stand), Aufgabe „Dokumente laufen ab“ für Chefpilot und Vorstand, Erinnerung per Mail.
  - *Zusammenspiel:* Berechtigung = was die Funktion darf; Anforderung = was der Inhaber dafür vorweisen muss. Das passt zur Richtung „Warnen statt blockieren“; Sperren ist je Anforderung wählbar. Das Mitglied meldet das neue Dokument und der Chefpilot prüft das Original und gibt frei (wie der Freigabe-Ablauf der Dokumente in V1, aber ohne Datei).
- **Teilnahme-Berechtigungen nicht automatisch für Verwaltungsfunktionen:** „Sprungflüge fliegen“ und „Als Sportspringer springen“ sind im Dummy nur den fachlichen Funktionen zugeordnet. Die V1-Regel „Obmann, Schriftführer und Kassier haben alle Rechte“ würde sie sonst jedem Vorstandsmitglied geben, auch ohne Lizenz.

- **Datenmodell Geld:** ein doppeltes Hauptbuch mit Kostenstellen (Sparten); Mitgliederkonten als Unterkonten; Kostenstellen und -arten vom Verein pflegbar; Belege als eigenes Objekt (Eingang, Verknüpfung mit Bankzeilen, KI-Vorschlag, Barausgaben über Kassa-Zeilen).
- **Mitglieder-Zahlungen:** Bar-Einzahlung bucht Kassa und Betriebskonto sofort; Überweisung ist eine Einzahlung, die erst bei Bankeingang gebucht wird; Kontoauszüge am Monatsende gehen erst nach Freigabe des Kassiers an die Mitglieder.
- **Nächste Schritte:** (1) Dummy durchsehen, `[Entwurf]`-Punkte bestätigen oder verwerfen; (2) Spezifikation und Benutzerhandbuch schreiben, jede Klickfolge als Szenario, später als Test; (3) Screenshots der Schlüsselabläufe; (4) erst dann Technik wählen und bauen.
- **Rechte** wie in V1 als Katalog im Code plus Datenbank, mit Prüftests gegen Abweichungen.
- **Öffentliches Repository:** keine echten Mitglieder-, Konto- oder Zugangsdaten; der Dummy nutzt erfundene Daten.
- **Ideen aus der Recherche:** zeitlich begrenzte Freigabe für das Manifest, die zugleich zeigt, wer am Platz ist (Skyproc); Einzahlen vom Handy und elektronisches Logbuch (Burble); Offline-Erfassung im Flugbuch (Vereinsflieger).

## 3. Recherche `[Recherche]`

Herstellerseiten von Burble und Vereinsflieger ließen sich nicht abrufen; die Angaben stammen aus Artikeln, App-Beschreibungen und einer Händler-PDF. Ungeprüft.

- **Burble** (kommerziell, rund 130 Dropzones): Buchung, Empfang, Manifest und Berichte aus einer Datenbank. BurbleMe: Check-in, Selbst-Manifest, Load-Organizing, Transaktionsverlauf, Einzahlen vom Handy, elektronisches Logbuch, Notruf mit GPS bei Außenlandung. Quellen: [Skydivemag](https://www.skydivemag.com/new/2017-01-06-burble-burble-no-toil-nor-trouble/), [App Store](https://apps.apple.com/app/id835467501), [Parachutist](https://parachutist.com/Article/burble-and-sigma-to-integrate)
- **Skyproc** (offen, [GitHub-Wiki](https://github-wiki-see.page/m/skygeek/skyproc/wiki/Introduction)): Manifest-Zugang nur mit zeitlich begrenzter Freigabe („Clearance“), die zeigt, wer am Platz ist; Preisprofile mit Ausnahmen pro Mitglied; Boarding-Anzeige auf zweitem Bildschirm oder Ausdruck; läuft auch offline lokal; Berichte aus archivierten Loads.
- **Vereinsflieger** (DACH): rollenbasierte Rechte, Flugbuch mit Offline-Erfassung und späterem Abgleich. Quelle: [Händler-PDF 2023](https://lam.akaflieg.tu-darmstadt.de/hyperkitty/list/anwaerter@akaflieg.tu-darmstadt.de/message/SMFWSFR66TFSWLXHWR7LDXTHD2GW6ACM/attachment/4/01_vereinsflieger2023-04D.pdf). Zu Abrechnung und Buchhaltung nichts Belastbares gefunden.
- **Vereinssoftware allgemein:** Beiträge errechnen, Rechnung, SEPA-Lastschrift (braucht Mandat), Mahnwesen, Kontoauszug per SEPA-Schnittstelle abrufen und mit offenen Rechnungen abgleichen. Quellen: [LSB Sachsen-Anhalt](https://lsb-sachsen-anhalt.vibss.de/vereinsmanagement/vereinsfuehrung/verwaltung-organisation-planung/verwaltung/mitgliederverwaltung-im-verein?type=123), [VereinOnline-Leitfaden](https://www.VereinOnline.org/VereinOnline_Leitfaden_Buchhaltung.pdf)
- **Österreichisches Vereinsrecht, § 21 VerG:** Einnahmen-Ausgaben-Rechnung samt Vermögensübersicht innerhalb von fünf Monaten nach Rechnungsjahr, laufende Aufzeichnung aller Einnahmen und Ausgaben, zwei Rechnungsprüfer. Empfohlen: Kassabuch mit Belegnummer ohne nachträgliche Änderung. Aufbewahrung meist sieben Jahre, Quellen widersprechen sich. Quellen: [Jusline § 21](https://www.jusline.at/gesetz/verg/paragraf/21.pdf), [Forum Media](https://www.forum-media.at/gesellschaftsrecht/Vorschriften/Vereinsgesetz-2002/4.-Abschnitt/21.-Rechnungslegung). Mit dem Steuerberater klären.
- **Open-Source-Buchhaltung** (Firefly III, ERPNext, Odoo): keine belastbaren Angaben zu Regeln oder Belegabgleich gefunden.

## 4. SEPA-Lastschrift: Folgen außerhalb der Programmierung `[Recherche]`

Allgemeine Eckpunkte; die Bedingungen legt die eigene Bank fest.

- Vereinbarung mit der Bank für Basis-Lastschriften (Prüfung des Vereins, Entgelte pro Einzug und Rücklastschrift, Einreichfristen).
- Gläubiger-Identifikationsnummer des Vereins.
- Mandat jedes Mitglieds (unterschrieben, aufbewahren, IBAN erfassen); denkbar als Zusatzfeld im Aufnahmeantrag mit PDF-Ablage.
- Vorab-Information vor jedem Einzug (die Rechnung kann das erfüllen, Frist meist 14 Tage).
- Rücklastschriften: bei autorisierten Einzügen innerhalb von 8 Wochen möglich; kostet Gebühren und braucht einen Ablauf in der Software.
- Die Software erzeugt eine Datei, die der Kassier im Online-Banking freigibt (Vier-Augen-Prinzip möglich).
- `[Vorschlag]` Zuerst Rechnung mit Überweisung und Mahnung, Lastschrift später als zweite Zahlart, ohne dass sich das Hauptbuch ändert.
