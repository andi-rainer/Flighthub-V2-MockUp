# 04 · Offene Fragen, Ideen und Vorschläge

Stand: 09.11.2026. Lies zuerst die Statuslegende in [README.md](README.md).

**Nichts in diesem Dokument ist beschlossen.** Wer baut oder plant, darf es nicht als Vorgabe behandeln. Beschlossenes steht in [02](02-v2-beschluesse.md).

- `[Offen]` Frage, die Andreas (oder ein Fachmann) beantworten muss.
- `[Vorschlag]` Idee oder Entwurf von Claude, von Andreas nicht entschieden.
- `[Recherche]` Fund aus dem Internet, nicht geprüft; vor einer Entscheidung gegenprüfen.

## 1. Offene Fragen `[Offen]`

1. **Technik der echten V2** (Sprache, Framework, Datenbank, Hosting je Verein). Andreas entscheidet selbst; bisher steht nichts fest.
2. **SEPA-Lastschrift für Beiträge.** Andreas hält sie für denkbar, kennt aber die Folgen außer der Programmierung nicht. Eckpunkte siehe Abschnitt 4. Bis zur Entscheidung gilt nur: Rechnung mit Überweisung und Zahlungsaufforderung.
3. **Aufbewahrungsfristen und Rechnungslegung.** Quellen widersprechen sich (sieben oder zehn Jahre). Mit dem Steuerberater klären, auch was der Verein nach dem Vereinsgesetz (§ 21) liefern muss.
4. **Wirtschaftlichkeit je Sparte:** Wie Fixkosten auf Sparten und Flugzeuge umgelegt werden und woraus der „angemessene Charter-Satz“ berechnet wird, ist nicht festgelegt. Andreas will das Ergebnis, die Methode fehlt.
5. **Testpersonen** (ohne Formular angelegt): Sollen sie von Beiträgen ausgenommen sein, und lassen sie sich später sperren oder löschen?
6. **Tandem-Check-in-Einstellung:** Wo sie später steht und ob die Mitgliedschaft je Art von Gast (Tandem, Schnupperflug o. Ä.) verschieden sein kann. Andreas wünscht eine Auswahl, mehr ist nicht festgelegt.
7. **Rechte statt Namen:** Verhalten (z. B. Sprungtag-Liste = Funktion Sportspringer) hängt im Dummy am Code der Funktion. Ob in V2 alles ausschließlich an Rechten hängen soll, damit das Löschen einer Funktion nichts bricht, ist nicht entschieden.
8. **Zweisprachigkeit der restlichen Texte:** Mitgliedschaftsnamen und eigene Auswahllisten sind einsprachig; ob sie zweisprachig werden müssen, ist offen. Andreas hat nur Formulare genannt.
9. **Zu bestätigen:** Alle Punkte aus [03, Abschnitt 4](03-klickdummy.md) (Claude-Entwürfe, Marke `[C]`) sind nicht bestätigt, vor allem AFP-Erinnerungen und -Prüfaufgaben, das Dashboard je Rolle, die Reise des Kunden im Shop und der Aufbau der Fälligkeitsliste am Flugzeug.
10. **Mobile Ansicht:** Zwei Versionen (Mobil, Laptop/Tablet) sind für später denkbar `[N 06.11.]`; ob und wann, ist offen.
11. **Details der pauschal akzeptierten Vorschläge** (siehe [02, Abschnitt 10](02-v2-beschluesse.md)): Preisprofile, Sprungkarten, Offline-Betrieb, Boarding-Anzeige, Rechnungsprüfer-Rolle, Jahresabschluss-Export, Belegnummer, Bankanbindung, lernende Regeln. Sie sind angenommen, aber nicht ausgearbeitet.

## 2. Vorschläge und Entwürfe von Claude `[Vorschlag]`

- **Datenmodell Geld:** ein einziges doppeltes Hauptbuch mit Kostenstellen (Sparten: Sportspringen, Tandem, Charter von Mitgliedern, Charter an andere Clubs); Mitgliederkonten als Unterkonten; Kostenstellen und Kostenarten vom Verein pflegbar, nie fest einprogrammiert; **Belege** als eigenes Objekt (Eingang, Verknüpfung mit Bankzeilen, KI-Vorschlag, Barausgaben über Kassa-Zeilen). Das war ein Entwurf aus dem Brainstorm vom 06.11.; Andreas hat die Ziele genannt (siehe 02), nicht dieses Modell bestätigt.
- **Mitglieder-Zahlungen:** Bar-Einzahlung bucht Kassa und Betriebskonto sofort; Überweisung ist eine Einzahlung, die erst bei Eingang auf der Bank gebucht wird; Kontoauszüge am Monatsende gehen erst nach Freigabe des Kassiers an die Mitglieder. (Teilweise von Andreas verlangt: „keine automatischen Buchungen“; die Freigabe der Kontoauszüge ist Claude-Entwurf.)
- **Nächste Schritte** für das Projekt: (1) Dummy durchsehen und `[C]`-Punkte bestätigen oder verwerfen; (2) daraus Spezifikation und Benutzerhandbuch schreiben, jede Klickfolge als Szenario, jedes Szenario später als Test; (3) Screenshots der Schlüsselabläufe erzeugen; (4) erst dann die Technik der echten V2 wählen und bauen.
- **Quelle der Wahrheit für Rechte** in V2 wie in V1 als Katalog im Code plus Datenbank, mit Prüftests gegen Abweichungen. (V1 macht das so; für V2 nicht entschieden.)
- **Öffentliches Repository:** Weil der Klickdummy öffentlich ist, sollten keine echten Mitglieder-, Konto- oder Zugangsdaten hineinkommen. Der Dummy nutzt erfundene Daten.
- **Ideen aus der Recherche** (Abschnitt 3), noch nicht beschlossen: zeitlich begrenzte Freigabe für das Manifest, die zugleich zeigt, wer am Platz ist (Skyproc); Einzahlen vom Handy und elektronisches Logbuch (Burble); Offline-Erfassung im Flugbuch (Vereinsflieger).

## 3. Recherche `[Recherche]`

Stand der Recherche: 06.11.2026. Die Herstellerseiten von Burble und Vereinsflieger ließen sich nicht abrufen; die Angaben stammen aus Artikeln, App-Beschreibungen und einer Händler-PDF.

- **Burble** (kommerziell, rund 130 Dropzones): Buchung, Empfang, Manifest und Berichte aus einer Datenbank. BurbleMe: Check-in, Selbst-Manifest, Load-Organizing, Transaktionsverlauf, Einzahlen vom Handy, elektronisches Logbuch, Notruf mit GPS bei Außenlandung. Quellen: [Skydivemag](https://www.skydivemag.com/new/2017-01-06-burble-burble-no-toil-nor-trouble/), [App Store](https://apps.apple.com/app/id835467501), [Parachutist](https://parachutist.com/Article/burble-and-sigma-to-integrate)
- **Skyproc** (offen, [GitHub-Wiki](https://github-wiki-see.page/m/skygeek/skyproc/wiki/Introduction)): Zugang zum Manifest nur mit zeitlich begrenzter Freigabe („Clearance“), die zeigt, wer am Platz ist; Preisprofile mit Ausnahmen pro Mitglied; Boarding-Anzeige auf zweitem Bildschirm oder Ausdruck; läuft auch offline lokal; Berichte aus archivierten Loads.
- **Vereinsflieger** (DACH): rollenbasierte Rechte, Flugbuch mit Offline-Erfassung und späterem Abgleich. Quelle: [Händler-PDF 2023](https://lam.akaflieg.tu-darmstadt.de/hyperkitty/list/anwaerter@akaflieg.tu-darmstadt.de/message/SMFWSFR66TFSWLXHWR7LDXTHD2GW6ACM/attachment/4/01_vereinsflieger2023-04D.pdf). Zu Abrechnung und Buchhaltung nichts Belastbares gefunden.
- **Vereinssoftware allgemein:** Beiträge errechnen, Rechnung, SEPA-Lastschrift (braucht Mandat), Mahnwesen, Kontoauszug per SEPA-Schnittstelle abrufen und mit offenen Rechnungen abgleichen. Quellen: [LSB Sachsen-Anhalt](https://lsb-sachsen-anhalt.vibss.de/vereinsmanagement/vereinsfuehrung/verwaltung-organisation-planung/verwaltung/mitgliederverwaltung-im-verein?type=123), [VereinOnline-Leitfaden](https://www.VereinOnline.org/VereinOnline_Leitfaden_Buchhaltung.pdf)
- **Österreichisches Vereinsrecht, § 21 VerG:** Einnahmen-Ausgaben-Rechnung samt Vermögensübersicht innerhalb von fünf Monaten nach Rechnungsjahr, laufende Aufzeichnung aller Einnahmen und Ausgaben, zwei Rechnungsprüfer. Empfohlen wird ein Kassabuch mit Belegnummer ohne nachträgliche Änderung. Aufbewahrung meist sieben Jahre, Quellen widersprechen sich (sieben oder zehn). Quellen: [Jusline § 21](https://www.jusline.at/gesetz/verg/paragraf/21.pdf), [Forum Media](https://www.forum-media.at/gesellschaftsrecht/Vorschriften/Vereinsgesetz-2002/4.-Abschnitt/21.-Rechnungslegung). **Mit dem Steuerberater klären.**
- **Open-Source-Buchhaltung** (Firefly III, ERPNext, Odoo): keine belastbaren Angaben zu Regeln oder Belegabgleich gefunden; das eigene Modell ist keine Kopie eines Vorbilds.

## 4. SEPA-Lastschrift: was außer Programmierung nötig wäre `[Recherche]`

Allgemeine Eckpunkte; die Bedingungen legt die eigene Bank fest. Dort nachfragen.

- Vereinbarung mit der Bank für Basis-Lastschriften, mit Prüfung des Vereins, Entgelten pro Einzug und Rücklastschrift und Einreichfristen.
- Gläubiger-Identifikationsnummer des Vereins.
- Mandat jedes Mitglieds (unterschrieben, aufbewahren, IBAN erfassen); ließe sich als Zusatzfeld im Aufnahmeantrag mit PDF-Ablage lösen.
- Vorab-Information an das Mitglied vor jedem Einzug (die Rechnung kann das erfüllen, Frist meist 14 Tage, sofern nichts anderes vereinbart ist).
- Rücklastschriften: Mitglieder können Einzüge zurückbuchen lassen (bei autorisierten Einzügen innerhalb von 8 Wochen); das kostet Gebühren und braucht einen Ablauf in der Software.
- Die Software erzeugt eine Datei, die der Kassier im Online-Banking freigibt (Vier-Augen-Prinzip möglich).
- `[Vorschlag]` Zuerst Rechnung mit Überweisung und Mahnung einführen, Lastschrift später als zweite Zahlart, ohne dass sich das Hauptbuch ändert.
