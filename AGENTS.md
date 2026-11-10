# FlightHub V2 Klickdummy

Klickdummy (nur UI/UX, keine echte Logik) für **FlightHub V2**, das komplett neue Vereinsverwaltungssystem für einen österreichischen Flug- und Fallschirmclub. V1 (Repository `flight-hub`) ist nur Referenz. Sprache der Oberfläche und der Dokumentation für den Prototypen: Deutsch.
Für das wirkliche Projekt: Deutsch/Englisch.

**Zuerst lesen:** [docs/README.md](docs/README.md) (Statuslegende und Lesereihenfolge). Danach [docs/02-v2-beschluesse.md](docs/02-v2-beschluesse.md) und [docs/05-arbeitsregeln.md](docs/05-arbeitsregeln.md).

## Die wichtigsten Regeln

- **Nichts annehmen.** Beschlossen ist nur, was in `docs/02-v2-beschluesse.md` steht. Ideen und Vorschläge sind erlaubt, müssen **klar markiert** sein und gehören nach `docs/04-offen-und-ideen.md`.
- **Nur UI/UX und klare Abläufe**, keine echte Logik, kein Backend.
- **Ein klarer Weg zum Ziel.** Ausnahmen sind diskret, brauchen Grund und Bestätigung und werden dokumentiert.
- **Keine erklärenden Info-Texte** in der Oberfläche, die nur Regeln wiederholen; Regeln gehören in die Dokumentation.
- **Pagination** bei langen Listen, **Rückweg** („Zurück zu …“, Reiter in der Adresse) von jeder Detailseite.

## Technik

Vite 8, React, TypeScript (strikt), Tailwind v4, `react-router-dom` (HashRouter), `lucide-react`. `npm run dev` (Port 5173), `npm run build` muss durchlaufen. Zustand `src/state.tsx`, Rechte `src/permissions.ts`, Sitzung `src/session/`. Einzelheiten: [docs/03-klickdummy.md](docs/03-klickdummy.md).
