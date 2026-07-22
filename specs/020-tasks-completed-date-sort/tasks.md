# Zadania: Widoczna „data wykonania" na zadaniach + działające sortowanie sekcji „Zrobione"

- **Plan:** ./plan.md (020-tasks-completed-date-sort)
- **Status:** done
- **Data:** 2026-07-22

> **Zasada listy zadań:** kolejność wg zależności (migracja/schemat → typ → akcja → UI → bramki).
> Każde zadanie małe i weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych (schemat + migracja)
- [x] **T-1** — **Migracja `0207_task_last_completed_at`.** Utwórz
  `worldofmag/prisma/migrations/0207_task_last_completed_at/migration.sql` z:
  `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastCompletedAt" TIMESTAMP(3);`. Uruchom
  `npm run check:migrations`. *Gotowe, gdy:* check zielony (0207 unikalny).
- [x] **T-2** — **Schemat Prisma.** W `prisma/schema.prisma` dodać do modelu `Task`:
  `lastCompletedAt DateTime?`. `prisma generate` czysto (po zaaplikowaniu migracji do lokalnego
  Postgresa). *Gotowe, gdy:* schema zgodna z migracją; generate bez błędu.

## Faza 1 — Typ + warstwa serwera
- [x] **T-3** `[P]` — **Typ TS.** W `src/types/index.ts` dodać `lastCompletedAt: Date | null;` do typu
  `Task` (obok `completedAt`). *Gotowe, gdy:* typ się kompiluje, pole dostępne w kliencie.
- [x] **T-4** — **Server Action.** W `src/actions/tasks.ts` → `completeRecurringTask`, przy tworzeniu
  `nextTask` (`prisma.task.create`) dodać `lastCompletedAt: completedAt`. Bez zmian guardu/`revalidatePath`
  (już są). *Gotowe, gdy:* nowe wystąpienie cykliczne dostaje datę wykonania poprzedniego.

## Faza 2 — UI
- [x] **T-5** — **Znacznik „✓ data wykonania" w `TaskRow`.** W `src/components/tasks/TaskRow.tsx` dodać
  mały, dyskretny (`text-xs`, `var(--text-muted)`) znacznik obok meta: gdy
  `doneDate = task.completedAt ?? task.lastCompletedAt` istnieje → `<Check size={10}/> {formatDoneDate(doneDate)}`.
  Dodać helper `formatDoneDate` (krótka data pl-PL, rok gdy inny niż bieżący). Kolory ze zmiennych,
  tekst PL. *Gotowe, gdy:* zrobione zadania i aktywne cykliczne (z `lastCompletedAt`) pokazują datę;
  zwykłe aktywne (oba pola null) — nie.
- [x] **T-6** — **Sort + nagłówek w `CompletedSection`.** W `src/components/tasks/CompletedSection.tsx`:
  sortuj po efektywnej dacie `completedAt ?? lastCompletedAt` malejąco (brak daty → na koniec); nagłówek
  zależny od sortu: `sortBy === "completedAt"` → „✓ Zrobione / Anulowane — wg daty wykonania", inaczej
  „✓ Zrobione / Anulowane". Zachować `key={sortBy}` + `defaultOpen={sortBy === "completedAt"}` (018).
  *Gotowe, gdy:* klik sortu widocznie zmienia kolejność + nagłówek + rozwija sekcję; ponowny klik wraca.

## Faza 3 — AI / integracje
- (brak) — plan §6: nie dotyczy.

## Faza 4 — Bramki i domknięcie
- [x] **T-7** — **Bramki jakości (C-50).** Lokalny Postgres (C-13): `npx prisma migrate deploy` +
  `prisma generate`; potem `npm run check:migrations`, `npm run check:actions`, `next lint --dir src`,
  `next build`. **Nie** `scripts/migrate.js` na prod. *Gotowe, gdy:* wszystko zielone do `next build`.
- [x] **T-8** — **Manualny scenariusz testowy (AC-7).** Utwórz
  `specs/020-tasks-completed-date-sort/manual-test.md` z krokami i oczekiwanym rezultatem dla
  AC-1..AC-5 (sort widoczny, daty na wierszach, cykliczne z datą ostatniego wykonania, powrót do
  domyślnego). *Gotowe, gdy:* plik istnieje i pokrywa AC-1..AC-5.
- [x] **T-9** — **Wpis do `doświadczenia.md`** (C-51): dlaczego sort „nie dawał różnicy" (brak
  widocznych dat) i jak „data ostatniego wykonania" (`lastCompletedAt` + znacznik) to domyka.

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (sort widoczny: kolejność + daty) | T-5, T-6 |
| AC-2 (toggle wraca do domyślnego) | T-6 (+ istniejący stan przycisku) |
| AC-3 (nagłówek sygnalizuje sort) | T-6 |
| AC-4 (cykliczne aktywne pokazują datę poprzedniego wykonania) | T-1..T-4, T-5 |
| AC-5 (trwałość daty ostatniego wykonania) | T-1, T-2, T-4 |
| AC-6 (bez regresji zwykłych/innych widoków) | T-5 (gating na null), T-7 |
| AC-7 (manualny scenariusz testowy) | T-8 |

## Notatki / blokady
- Weryfikacja AC-4/AC-5 wprost wymaga danych (wykonanie zadania cyklicznego) — w kodzie prześledzalne,
  a manualny scenariusz (T-8) opisuje jak sprawdzić na żywo po wdrożeniu na `develop`.
