# Zadania: Edytowalna data wykonania + wybór daty przy oznaczaniu jako zrobione (single + bulk)

- **Plan:** ./plan.md (021-task-completion-date-edit)
- **Status:** done
- **Data:** 2026-07-22

> **Zasada listy zadań:** bez migracji/schematu. Kolejność: akcje serwera → UI → bramki. Każde zadanie
> małe i weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- (brak) — feature nie rusza schematu ani migracji (plan §2). `check:migrations` zielony.

## Faza 1 — Warstwa serwera (Server Actions)
- [x] **T-1** — **`updateTask` przyjmuje `completedAt` (jawny priorytet).** W `src/actions/tasks.ts`
  dodać do typu patcha `completedAt?: Date | null`. Policzyć `derived` jak dziś, potem
  `final = patch.completedAt !== undefined ? patch.completedAt : derived`; ustawiać `data.completedAt`
  **jawnie** (usunąć `completedAt` z `{ ...patch }`, żeby nie ominąć logiki). Guard/`revalidatePath`
  bez zmian. *Gotowe, gdy:* podanie `completedAt` zapisuje wskazaną datę; brak — zachowanie jak dotąd.
- [x] **T-2** — **`bulkUpdateTasks` przyjmuje wspólny `completedAt`.** W `src/actions/tasks.ts` dodać
  `completedAt?: Date | null` do typu patcha; w destrukturyzacji uwzględnić `scalar.completedAt`; przy
  `status==="DONE"` ustawić `data.completedAt = scalar.completedAt ?? new Date()`. *Gotowe, gdy:* bulk
  bez daty → „teraz"; bulk z datą → ta data dla wszystkich.

## Faza 2 — UI
- [x] **T-3** `[P]` — **Edytowalne „Ukończone" w `TaskDetail`.** W `src/components/tasks/TaskDetail.tsx`
  zamienić read-only `Ukończone: …` (~836) na `<input type="date">` (wzór pola „Start"): stan
  `completedAtValue` = `toDateValue(task.completedAt)` + sync w `useEffect`; handler →
  `updateTask(task.id, { completedAt: parseDateInput(v, { dayOnly: true }) })`. Pokazywane, gdy zadanie
  ma datę wykonania. Kolory ze zmiennych, tekst PL. *Gotowe, gdy:* zmiana daty w szczegółach zapisuje
  się i widać ją w znaczniku „✓" (020).
- [x] **T-4** `[P]` — **Opcjonalna wspólna data w bulku „Status".** W
  `src/components/tasks/BulkActionBar.tsx`: rozszerzyć `BulkPatch` o `completedAt?: Date | null`; w
  panelu `panel === "status"` dodać na górze opcjonalne `<input type="date">` („Data wykonania
  (opcjonalnie — dla »Zrobione«)", stan `doneDateValue`); przy kliknięciu statusu przekazać
  `completedAt: (statusMetaFor(s.key, statusConfig).isTerminal && doneDateValue) ? new Date(doneDateValue
  + "T12:00:00") : undefined`. Styl jak panel „Termin". *Gotowe, gdy:* masowe „Zrobione" z podaną datą
  nadaje ją wszystkim; bez daty → „teraz".

## Faza 3 — AI / integracje
- (brak) — plan §6: pola `completedAt` opcjonalne, brak nowej `AIAction`. `check:actions` zielony.

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — **Bramki jakości (C-50).** Z `worldofmag/` (lokalny Postgres — C-13; migracje już
  zaaplikowane, brak nowych): `npm run check:migrations`, `npm run check:actions`, `next lint --dir src`,
  `next build`. **Nie** `scripts/migrate.js`. *Gotowe, gdy:* wszystko zielone do `next build`.
- [x] **T-6** — **Mapowanie AC → wynik** (input do `/verify`): AC-1→T-1/T-3, AC-2→T-1, AC-3→T-1/T-3,
  AC-4→T-2, AC-5→T-2/T-4, AC-6→(brak zmian w cyklicznych), AC-7→(brak zmian w wierszu). Żaden AC bez
  pokrycia.
- [x] **T-7** — **Wpis do `doświadczenia.md`** (C-51): jawny `completedAt` musi mieć pierwszeństwo nad
  derivacją ze statusu (pułapka `{ ...patch }`), oraz wspólna data w bulku.

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (edytowalna data w szczegółach) | T-1, T-3 |
| AC-2 (spójność ze statusem / czyszczenie) | T-1 |
| AC-3 (data przy oznaczaniu pojedynczego) | T-1, T-3 |
| AC-4 (bulk domyślnie dziś) | T-2 |
| AC-5 (bulk wspólna data opcjonalnie) | T-2, T-4 |
| AC-6 (spójność z 020 / cykliczne) | brak zmian w `completeRecurringTask` (weryfikacja w T-6) |
| AC-7 (bez regresji szybkiego odhaczania) | brak zmian w `toggleTaskStatus`/wierszu (T-6) |

## Notatki / blokady
- Punkt uwagi recenzji: `completedAt` NIE może wejść przez `{ ...patch }` bez logiki priorytetu (T-1).
