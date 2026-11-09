# 05 · Arbeitsregeln für Menschen und Agenten

Stand: 09.11.2026. Lies zuerst die Statuslegende in [README.md](README.md). Diese Regeln gelten für jeden, der am Klickdummy oder an der Spezifikation von V2 weiterarbeitet (Claude, andere Agenten, Menschen).

## 1. Nicht annehmen

- **Keine Annahmen als Tatsachen.** Was nicht in [01](01-v1-bestand.md) oder [02](02-v2-beschluesse.md) steht, ist nicht entschieden. Ideen und Vorschläge sind erlaubt, müssen aber als solche **klar markiert** sein und gehören nach [04](04-offen-und-ideen.md). `[N 09.11.]`
- **Quellen angeben.** Jede Entscheidung trägt ihre Quelle (`[N dd.mm.]`, `[V1]`, `[akzeptiert]`, `[C]`). Wer eine neue Entscheidung von Andreas erfährt, trägt sie mit Datum in [02](02-v2-beschluesse.md) ein und entfernt den Eintrag aus [04](04-offen-und-ideen.md).
- **Im Zweifel fragen**, statt zu raten. Ein `[C]` im Dummy ist keine Vorgabe.
- Wenn ein Dokument einem Zitat von Andreas widerspricht, gilt Andreas. Ändert sich eine Entscheidung, wird das Dokument geändert, nicht die Aussage.

## 2. Was der Klickdummy ist und nicht ist

- Er zeigt **nur UI/UX und klare Abläufe**, damit man nach Screenshots und Klickfolgen in einem komplett neuen Projekt baut. **Keine echte Logik**, keine Datenhaltung. `[N 07.11.]`
- Er ist ein **neues Projekt**, unabhängig von V1. V1 (Repository `flight-hub`) wird nie verändert, wenn es um V2 geht. `[N 06.11.]`
- Die Oberfläche ist **deutsch**; Formulare gibt es zusätzlich auf Englisch.
- Fragen nach der **Technik der echten V2** beantwortet Andreas, nicht der Agent. `[N 06.11.]`

## 3. Bedienungsgrundsätze (aus den Wünschen von Andreas)

- **Ein klarer Weg zum Ziel** im gesamten Projekt. Gibt es einen Standardweg und eine Ausnahme, ist die Ausnahme diskret, verlangt einen Grund und eine Bestätigung und wird dokumentiert (Beispiele: Antrag statt Direktanlage, Änderung ohne Formular). `[N 07.11.]` `[N 08.11.]` `[N 09.11.]`
- **Keine erklärenden Info-Texte**, die Regeln wiederholen, die Andreas im Gespräch erklärt hat. Regeln stehen in diesen Dokumenten. `[N 08.11.]`
- **Pagination bei allen langen Listen**, Listen schlank wie in V1. `[N 07.11.]`
- **Rückweg:** Jede Detailseite, die aus einer Liste geöffnet wird, zeigt „Zurück zu …“, und die Zurücktaste des Browsers führt in dieselbe Ansicht (Reiter in der Adresse). `[N 09.11.]`
- **Formulare sind ein System:** Inhalt und Gestaltung werden gemeinsam versioniert; eine benutzte Version ändert ihr Aussehen nie. Neue Version = in Deutsch und Englisch vollständig. `[N 08.11.]` `[N 09.11.]`
- **Sensible Aktionen** (Rechte `sensitive`) brauchen auf öffentlichen Geräten eine Bestätigung; das Modell kommt aus V1 `[N 07.11.]`.
- Neue Bedienmuster zuerst als Vorschlag zeigen, wenn sie nicht von Andreas kommen.

## 4. Git und Veröffentlichung

- **Repository des Dummys:** `andi-rainer/Flighthub-V2-MockUp`, **öffentlich**. Jeder Push auf `main` veröffentlicht die Seite sofort (<https://andi-rainer.github.io/Flighthub-V2-MockUp/>). `[N 09.11.]`
- **Commits und Pushes nur auf Wunsch von Andreas.** Er hat Commits ausdrücklich verlangt (09.11.); der erste Stand liegt auf `main`. Ohne Auftrag nicht pushen.
- **Keine echten Daten, Zugangsdaten, Schlüssel oder personenbezogenen Angaben** committen, das Repository ist öffentlich. Beispieldaten sind erfunden. `[Vorschlag]`
- Commit-Nachrichten kurz, auf Englisch, mit der vorgegebenen Co-Author-Zeile, wenn ein Agent committet.
- **Für V1** (nur falls nötig): nie automatisch auf `main` committen, immer auf einem Feature-Branch; nie `supabase db reset` oder `supabase db push` (immer gegen die lokale Datenbank arbeiten). Diese Regeln stammen aus der V1-Projektdokumentation und den Vorgaben von Andreas.

## 5. Arbeiten am Dummy

- Start: `npm install`, `npm run dev` (Port 5173). Prüfen: `npm run build` (Typen und Build) muss durchlaufen. Details und Seiten: [03](03-klickdummy.md).
- Änderungen im Browser prüfen (Desktop, 1440×900) und das Ergebnis zeigen, statt Prüfung zu behaupten.
- Neue Texte der Oberfläche auf Deutsch; Formulartexte zusätzlich Englisch (Formulartexte in `src/pages/members/data.ts`, feste Texte in `src/pages/members/i18n.ts`).
- Rechte: neues Recht im Katalog `src/permissions.ts` anlegen, Menü und Seiten hängen an den Codes. Verhalten nicht am **Namen** einer Funktion festmachen (Funktionen sind umbenennbar und löschbar), sondern am Code oder am Recht.
- Der Dummy wird über GitHub Pages unter einem Unterpfad ausgeliefert: Bilder und Links relativ zu `import.meta.env.BASE_URL`, Routing per Hash (`#/…`).
- Nach jeder fachlichen Änderung: das passende Dokument aktualisieren (Entscheidung → 02, Dummy-Verhalten → 03, offene Frage oder Idee → 04).

## 6. Sprache und Stil der Dokumente

- Deutsch, kurz, ohne Füllwörter. Aussagen mit Quelle. Keine Vermutungen in Tatsachen-Dokumenten (01, 02, 03).
- Neue Begriffe einmal erklären; Begriffe aus dem Dummy so schreiben, wie sie in der Oberfläche stehen.
