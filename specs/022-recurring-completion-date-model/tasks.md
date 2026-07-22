# Zadania: Model daty zrobienia zadań cyklicznych (link wystąpień + bulk rolowanie) + usunięcie ikony sortu

- **Plan:** ./plan.md (022-recurring-completion-date-model)
- **Status:** done
- **Data:** 2026-07-22

> **Zasada listy:** kolejność migracja → serwer → UI → bramki. Każde zadanie ≈ jeden commit,
> małe i weryfikowalne. `[P]` = niezależne, można równolegle.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane · `[P]` równoległe

## Faza 0 — Fundament danych (migracja + schemat + typ)
- [x] **T-1** — **Migracja 0208 `Task.previousTaskId`.** Utwórz
  `prisma/migrations/0208_task_previous_occurrence/migration.sql` z DDL (plan §2): `ADD COLUMN
  "previousTaskId" TEXT`, `CREATE INDEX "Task_previousTaskId_idx"`, `ADD CONSTRAINT
  "Task_previousTaskId_fkey" … ON DELETE SET NULL ON UPDATE CASCADE`. *Gotowe, gdy:* plik istnieje,
  `npm run check:migrations` zielony (numer 0208 unikalny).
- [x] **T-2** — **Schemat Prisma.** W `prisma/schema.prisma` (model `Task`) dodać `previousTaskId
  String?`, relację `previous Task? @relation("TaskRecurrence", fields:[previousTaskId],
  references:[id], onDelete: SetNull)` + `nextOccurrences Task[] @relation("TaskRecurrence")` +
  `@@index([previousTaskId])`. *Gotowe, gdy:* `prisma generate` przechodzi (weryfikacja w T-8 build).
- [x] **T-3** `[P]` — **Typ TS.** W `src/types/index.ts` dodać `previousTaskId: string | null` do typu
  `Task` (po `lastCompletedAt`). *Gotowe, gdy:* typ się kompiluje; pole dostępne w UI.

## Faza 1 — Warstwa serwera (Server Actions — `src/actions/tasks.ts`)
- [x] **T-4** — **Link wystąpień w `completeRecurringTask`.** W `prisma.task.create({ data })`
  (tworzenie następnego wystąpienia) dodać `previousTaskId: existing.id` obok istniejącego
  `lastCompletedAt: completedAt`. *Gotowe, gdy:* nowe wystąpienie ma `previousTaskId` = id domkniętego
  i `lastCompletedAt` = jego data zrobienia (AC-2).
- [x] **T-5** — **Bulk roluje cykliczne.** W `bulkUpdateTasks`, w gałęzi domykania
  (`newStatus==="DONE" && existing.status!=="DONE"`): jeśli `existing.recurring` →
  `await completeRecurringTask(id, scalar.completedAt ? { completionDate: scalar.completedAt.toISOString() } : {})`,
  usunąć `status` z `data` i zastosować pozostałe pola/tagowanie jak dotąd; w przeciwnym razie
  zachowanie bez zmian (`data.completedAt = scalar.completedAt ?? new Date()`). *Gotowe, gdy:* masowe
  „Zrobione" na cyklicznym tworzy kolejne wystąpienie, z opcjonalną wspólną datą (AC-1).
- [x] **T-6** — **Sync następcy w `updateTask`.** Po `prisma.task.update(...)`: gdy `explicitCompletedAt
  !== undefined`, wykonać `await prisma.task.updateMany({ where: { previousTaskId: id }, data: {
  lastCompletedAt: explicitCompletedAt } })`. *Gotowe, gdy:* edycja daty zrobienia poprzednika
  aktualizuje „datę ostatniego zrobienia" następcy; brak następcy → no-op (AC-4).

## Faza 2 — UI
- [x] **T-7a** `[P]` — **`TaskDetail`: pole daty pod „Start" + „Ostatnio zrobione".** W
  `src/components/tasks/TaskDetail.tsx` przenieść edytowalne pole „data zrobienia" ze stopki Meta pod
  blok „Start"; markup/styl jak „Start" (`Calendar size={13}`, `label w-20` „Zrobione", `input
  type="date" flex-1 … border rounded px-2 py-1`, kolory ze zmiennych), warunek `task.completedAt` i
  handler `handleCompletedAtChange` bez zmian. Pod nim read-only wiersz „Ostatnio zrobione: &lt;data&gt;"
  gdy `task.lastCompletedAt && !task.completedAt`. Usunąć blok „Ukończone" ze stopki Meta. *Gotowe, gdy:*
  pole daty jest pod „Start" i wygląda jak „Start"; aktywne cykliczne pokazuje „Ostatnio zrobione"
  (AC-3, AC-5).
- [x] **T-7b** — **Usunięcie ikony/logiki sortu.** `TasksPage.tsx`: usunąć stan `sortBy`,
  load/save `tasks.sortBy` z localStorage, przycisk „Sortuj zrobione po dacie wykonania", przekazanie
  `sortBy={sortBy}` do `TaskList`, nieużywany import `CalendarCheck`, poprawić komentarz listy ikon.
  `TaskList.tsx`: usunąć prop `sortBy` (typ + sygnatura + przeloty do `CompletedSection`).
  `CompletedSection.tsx`: usunąć prop `sortBy`/`doneTime`/`ordered`/`key`/warunkowy `label`/`defaultOpen`
  → domyślna kolejność, stały label „✓ Zrobione / Anulowane", `defaultOpen={false}`. `TaskRow.tsx` bez
  zmian. *Gotowe, gdy:* brak przełącznika sortu; sekcja „Zrobione" w domyślnej kolejności; znacznik „✓"
  na wierszach pozostaje (AC-7).

## Faza 3 — AI / integracje
- (brak) — plan §6: brak nowej `AIAction`/read-toola; sygnatury AI bez zmian. `check:actions` zielony.

## Faza 4 — Bramki i domknięcie
- [x] **T-8** — **Bramki jakości (C-50).** Z `worldofmag/` (lokalny Postgres — C-13; `npx prisma migrate
  deploy` zaaplikuje 0208): `npm run check:migrations`, `npm run check:actions`, `next lint --dir src`,
  `next build`. **Nie** `scripts/migrate.js`. *Gotowe, gdy:* wszystko zielone do `next build`.
- [x] **T-9** — **Mapowanie AC → wynik** (input do `/verify`): patrz tabela niżej; żaden AC bez pokrycia.
- [x] **T-10** — **Wpis do `doświadczenia.md`** (C-51): link wystąpień (`previousTaskId`) domyka sync
  „ostatniego zrobienia"; bulk cyklicznych musi rolować przez `completeRecurringTask`, nie surowy `update`.

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (bulk roluje cykliczne) | T-5 |
| AC-2 (powiązanie wystąpień + lastCompletedAt) | T-1, T-2, T-4 |
| AC-3 (rozróżnienie dat) | T-3, T-7a (+ znacznik w `TaskRow` bez zmian) |
| AC-4 (sync po edycji) | T-1, T-2, T-6 |
| AC-5 (pole pod „Start") | T-7a |
| AC-6 (wariant A — klik/`x` = dziś) | brak zmian w `toggleTaskStatus`/wierszu (weryfikacja T-9) |
| AC-7 (usunięcie ikony sortu, znacznik zostaje) | T-7b |
| AC-8 (bez regresji) | T-8 (build) + T-9 |

## Ścieżka krytyczna / zależności
- **T-1 → T-2 → T-3** (migracja→schemat→typ) blokują serwer i UI korzystające z `previousTaskId`.
- **T-4, T-5, T-6** zależą od T-2 (relacja/pole). T-5 zależy też od T-4 (link tworzony przy rolowaniu).
- **T-7a** zależy od T-3 (`lastCompletedAt`/`previousTaskId` już były/są w typie). **T-7b** niezależne `[P]`.
- **T-8** po wszystkich zmianach. T-9/T-10 domknięcie.

## Notatki / blokady
- Uwaga recenzji: bulk dla cyklicznych **nie** może iść surowym `update` (ominąłby generację kolejnego
  wystąpienia); data wspólna z 021 przekazywana przez `completionDate`.
