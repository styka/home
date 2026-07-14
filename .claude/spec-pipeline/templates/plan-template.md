# Plan techniczny: <NAZWA FEATURE'A>

- **Spec:** ./spec.md (<NNN-slug>)
- **Status:** draft
- **Data:** <YYYY-MM-DD>

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście (2–4 zdania)
<Wysokopoziomowa strategia. Który istniejący moduł jest wzorcem do naśladowania?>

## 2. Model danych (Prisma)
> Jeśli feature nie rusza schematu — napisz „bez zmian w schemacie" i pomiń migrację.

- **Nowe/zmienione modele i kolumny:**
  - `<Model>` — pola: `<pole: typ>` … (statusy/rodzaje jako `String` + union TS — C-12)
- **Relacje / indeksy:** …
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: `<NNNN>`
  - Katalog: `prisma/migrations/<NNNN_slug>/migration.sql`
  - Szkic DDL (CREATE/ALTER, idempotentnie gdzie możliwe): <opis>

## 3. Warstwa serwera (Server Actions — C-20)
- Plik: `src/actions/<nazwa>.ts`
- Funkcje: `<nazwa>(args) → wynik` — każda kończy się `revalidatePath(<ścieżka>)`.
- Guard dostępu (C-21): <użyj/rozszerz `assert…Access`>; własność `ownerId`/`ownerTeamId`.

## 4. RBAC / rejestr modułu (C-22)
- Slug: <istniejący `module.*` czy nowy — jeśli nowy: seed w migracji z pkt. 2>
- Wpięcia: `permissions.ts`, `modules.tsx`, `ModuleSidebar` (desktop + tab bar).

## 5. UI (C-30, C-31, C-32)
- Trasy/strony: `src/app/<...>/page.tsx` (server wrapper) + `*Page.tsx` (client).
- Komponenty: `src/components/<moduł>/…`
- Motyw: tylko zmienne CSS; mobile `hidden md:flex` + tab bar; teksty PL.

## 6. AI / integracje (jeśli dotyczy — C-23, C-40)
- Nowe `AIAction` + egzekutor w `/api/llm/home/execute` (inaczej `check:actions` wywali build).
- Read-tool w `agentTools.ts`? Kalendarz/powiadomienia/auto-expense?

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `…` | nowy/edycja | … |

## 8. Bramki i weryfikacja (C-50)
- Lokalna weryfikacja: lokalny Postgres + `npx prisma migrate deploy` (C-13 — nigdy prod DB).
- `npm run check:migrations`, `npm run check:actions`, `next lint`, `next build`.
- Jak sprawdzimy każde AC ze speca (mapowanie AC → sposób weryfikacji).

## 9. Ryzyka techniczne i plan wycofania
- <ryzyko → mitygacja>. Rollback: kod vs migracja (por. runbook devops).

## 10. Zgodność z konstytucją — checklista
- [ ] C-10..C-14 (migracje) zaadresowane
- [ ] C-20..C-25 (server/RBAC/AI/trash/audit) zaadresowane
- [ ] C-30..C-32 (UX) zaadresowane
- [ ] C-53 (minimalizm — brak nadmiarowych abstrakcji) świadomie sprawdzone
