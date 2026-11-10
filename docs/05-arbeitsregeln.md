# 05 · Arbeitsregeln

Zuerst die Marken in [README.md](README.md) lesen.

## 1. Nicht annehmen

- Beschlossen ist nur, was in [01](01-v1-bestand.md) oder [02](02-v2-beschluesse.md) steht. Alles andere ist offen.
- Ideen und Vorschläge sind erwünscht, müssen aber klar markiert sein (`[Vorschlag]`, `[Entwurf]`) und gehören nach [04](04-offen-und-ideen.md).
- Im Zweifel fragen statt raten. Ein `[Entwurf]` im Dummy ist keine Vorgabe.
- Wird etwas entschieden, wird das Dokument geändert: in 02 eintragen, aus 04 entfernen.

## 2. Der Dummy

- Zeigt nur UI/UX und klare Abläufe, keine echte Logik, keine Datenhaltung.
- Ist ein eigenes Projekt, unabhängig von V1. V1 (`flight-hub`) wird nicht verändert.
- Oberfläche des Dummys auf Deutsch; Formulare zusätzlich auf Englisch. Das echte Projekt ist Deutsch/Englisch.
- Die Technik der echten V2 ist nicht entschieden; der Dummy gibt sie nicht vor.

## 3. Bedienungsgrundsätze

- Ein klarer Weg zum Ziel. Eine Ausnahme ist diskret, verlangt einen Grund und eine Bestätigung und wird dokumentiert.
- Keine Info-Texte in der Oberfläche, die Regeln wiederholen. Regeln stehen in diesen Dokumenten.
- Pagination bei allen langen Listen, Listen schlank.
- Rückweg: „Zurück zu …“ auf jeder Detailseite, Reiter in der Adresse, Zurücktaste führt in dieselbe Ansicht.
- Formulare sind ein System: Inhalt und Gestaltung gemeinsam versioniert, eine benutzte Version ändert ihr Aussehen nie, neue Version vollständig in Deutsch und Englisch.
- Sensible Aktionen brauchen auf öffentlichen Geräten eine Bestätigung (Modell aus V1).
- Jede Auswahl eines Mitglieds nutzt die eine Personen-Auswahl (`src/MemberPicker.tsx`), keine eigene Liste.
- Neue Bedienmuster zuerst als Vorschlag zeigen.

## 4. Git und Veröffentlichung

- Repository `andi-rainer/Flighthub-V2-MockUp` ist öffentlich. Jeder Push auf `main` veröffentlicht die Seite (<https://andi-rainer.github.io/Flighthub-V2-MockUp/>).
- Commits und Pushes nur auf Anweisung.
- Keine echten Daten, Zugangsdaten, Schlüssel oder personenbezogenen Angaben committen; Beispieldaten sind erfunden.
- Commit-Nachrichten kurz, auf Englisch.
- Für V1 (nur falls nötig): nie automatisch auf `main` committen, immer auf einem Feature-Branch; nie `supabase db reset` oder `supabase db push`, immer gegen die lokale Datenbank arbeiten.

## 5. Arbeiten am Dummy

- Start: `npm install`, `npm run dev` (Port 5173). `npm run build` muss durchlaufen. Seiten und Technik: [03](03-klickdummy.md).
- Änderungen im Browser prüfen (Desktop, 1440×900) und das Ergebnis zeigen.
- Formulartexte in `src/pages/members/data.ts`, feste Texte in `src/pages/members/i18n.ts`.
- Neues Recht im Katalog `src/permissions.ts` anlegen; Menü und Seiten hängen an den Codes. Verhalten nicht am Namen einer Funktion festmachen (umbenennbar, löschbar), sondern am Code oder Recht.
- Auslieferung unter einem Unterpfad: Bilder und Links relativ zu `import.meta.env.BASE_URL`, Routing per Hash (`#/…`).
- Nach jeder fachlichen Änderung das passende Dokument anpassen: Entscheidung → 02, Dummy-Verhalten → 03, Frage oder Idee → 04.

## 6. Stil der Dokumente

- Deutsch, kurz, ohne Füllwörter. Keine Namen von Personen, keine Datumsangaben. Jede Aussage mit Marke.
- Begriffe aus dem Dummy so schreiben, wie sie in der Oberfläche stehen.
