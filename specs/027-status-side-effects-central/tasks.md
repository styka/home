# Zadania: Wymuszanie automatycznych efektów zmiany statusu — centralnie

- **Plan:** ./plan.md (027-status-side-effects-central)
- **Status:** done
- **Data:** 2026-07-23

> Kolejność od najłatwiejszego do najtrudniejszego i wg zależności. Feature **nie rusza schematu**
> (brak Fazy 0 migracji) — cała praca jest w warstwie serwera + executorze AI + testach.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- [x] **T-0** — Potwierdź „bez zmian w schemacie": brak edycji `schema.prisma`, brak nowej migracji.
  Gotowe, gdy: `npm run check:migrations` przechodzi bez nowego katalogu migracji.

## Faza 1 — Warstwa serwera (Tasks) — rdzeń centralizacji
- [x] **T-1** — W `src/actions/tasks.ts` wydziel prywatny helper `spawnRecurringSuccessor(existing, {
  completedAt, anchor?, nextDueOverride? })` przez przeniesienie bloku „create następnika" z
  `completeRecurringTask` (baza wg kotwicy DUE/COMPLETION, cutoff `endDate`, przesunięcie `startDate`,
  kopiowanie tagów, `previousTaskId`, `lastCompletedAt`). Zwraca utworzone zadanie lub `null`.
  Gotowe, gdy: helper istnieje, kompiluje się; logika identyczna z dotychczasową (żaden zewn. wywołujący
  jeszcze go nie używa).
- [x] **T-2** — Dodaj **jedyny** punkt spawn'u w `updateTask`: po `prisma.task.update`, gdy
  `patch.status === "DONE" && existing.status !== "DONE" && existing.recurring` → wywołaj
  `spawnRecurringSuccessor(existing, { completedAt: finalCompletedAt ?? new Date(), ...recurringOpts })`.
  Dodaj wewnętrzny 3. param `opts?: { recurring?: CompleteRecurringOptions }` (publiczny patch bez zmian).
  Gotowe, gdy: przejście→DONE zadania cyklicznego przez `updateTask` tworzy następcę; blok 022/023
  (edycja daty domkniętego) nietknięty; brak spawn'u przy powtórnym zapisie już-DONE.
- [x] **T-3** — Przerób `completeRecurringTask(id, opts)` na cienki wrapper: ustal `completedAt` z
  `opts.completionDate`, wywołaj **raz** `updateTask(id, { status:"DONE", completedAt }, { recurring: opts })`,
  usuń z niego osobny `updateTask(status:DONE)` + osobny zapis `completedAt` + własny `prisma.task.create`.
  Zwróć następcę (`findFirst({ previousTaskId:id }, order desc)`) dla zgodności kontraktu.
  Gotowe, gdy: pojedynczy spawn (brak dubletu); funkcja zwraca nowe wystąpienie jak dotąd.
- [x] **T-4** — Uprość `toggleTaskStatus`: usuń specjalny `if (next==="DONE" && recurring) return
  completeRecurringTask(id)` — zostaw `updateTask(id, { status: next })` (spawn wymuszany centralnie).
  Gotowe, gdy: toggle na cyklicznym →DONE nadal tworzy następcę (przez `updateTask`), kotwica z reguły
  zachowana. `bulkUpdateTasks` — bez zmian logiki (gałąź recurring nadal woła wrapper = pojedynczy spawn).

## Faza 2 — UI
- [x] **T-5** — Weryfikacja bez zmian: `TaskRow`/`TaskDetail`/`BulkActionBar` wołają istniejące akcje;
  zachowanie UI identyczne. Gotowe, gdy: brak koniecznych zmian w komponentach (potwierdzone przeglądem).

## Faza 3 — AI / integracje
- [x] **T-6** — Tasks: **bez zmian** w `tasksExecutor.ts` — `update_task`/`update_task_status` już wołają
  `updateTask`, które teraz robi spawn. Gotowe, gdy: potwierdzone czytaniem, że obie akcje przechodzą
  status do `updateTask` (realizuje AC-1).
- [x] **T-7** — Pets: w `src/lib/ai/executors/petExecutor.ts` `log_treatment_done` zastąp własne liczenie
  (`parseRecurringRule`+`computeNextDue`+`petCareLog.create`+`petTreatment.update`) wywołaniem domenowego
  `completeTreatment(t.id)` (import z `@/actions/petCare`); lookup po nazwie zostaw. Usuń nieużywane importy.
  Gotowe, gdy: brak drugiego `petCareLog.create`; ścieżka AI == ścieżka UI (AC-4).
- [x] **T-8** `[P]` — Audyt Health/Habits: potwierdź, że `healthExecutor` (`log_dose`/`unlog_dose`) woła
  `logDose`/`unlogDose`, a `habitsExecutor` (`toggle_habit`) woła `toggleHabitDay`. Bez zmian kodu.
  Gotowe, gdy: parytet odnotowany (wejście dla AC-5).

## Faza 4 — Bramki i domknięcie
- [x] **T-9** — Test jednostkowy `src/lib/__tests__/recurrenceSuccessor.test.ts` na czystą logikę
  wyliczania pól następnika (kotwica DUE vs COMPLETION, `endDate` cutoff, przesunięcie `startDate`).
  Jeśli logika helpera jest nierozdzielna od prisma — wyodrębnij czystą sub-funkcję liczenia dat/pól i ją
  testuj. Gotowe, gdy: `npm run test:unit` zielony (nowe + `recurrence*.test.ts`).
- [x] **T-10** — `npm run check:actions` (brak nowej `AIAction` → OK), `npm run check:migrations`,
  `next lint`, `next build` na lokalnym Postgresie (C-13, nigdy prod DB). Gotowe, gdy: wszystko zielone
  do `next build` (AC-7).
- [x] **T-11** — Mapowanie AC → wynik jako input do `/verify` (patrz plan §8). Gotowe, gdy: każdy AC-1..AC-7
  ma wskazany dowód (kod/test/audyt).
- [x] **T-12** — Wpis do `doświadczenia.md` (C-51): pułapka „logika biznesowa w wywołującym vs warstwie
  domenowej — asystent AI omijał spawn cyklicznego następnika". Gotowe, gdy: wpis dopisany i objęty commitem.

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadania |
|----|---------|
| AC-1 (AI →DONE cyklicznego tworzy następcę) | T-2, T-6 |
| AC-2 (parytet UI toggle == bulk == AI) | T-2, T-3, T-4 |
| AC-3 (completedAt →DONE/→inny spójnie) | T-2 (logika `updateTask` nietknięta, wspólna dla wejść) |
| AC-4 (pety: AI == UI przez completeTreatment) | T-7 |
| AC-5 (audyt wszystkich akcji, jedno miejsce egzekucji) | T-6, T-7, T-8, T-11 |
| AC-6 (brak regresji 020/022/023, statusy własne) | T-2 (warunek przejścia), T-4, T-9 |
| AC-7 (`build` zielony) | T-10 |

## Ścieżka krytyczna
T-1 → T-2 → T-3 → T-4 (rdzeń, sekwencyjnie w tym samym pliku) → T-7 (pets, niezależny plik, po T-2 dla
spójności wzorca) → T-9 (testy) → T-10 (build). T-5/T-6/T-8 to weryfikacje/przeglądy (mogą iść równolegle,
`[P]` gdzie oznaczono). T-11/T-12 domykają.

## Notatki / blokady
- Brak. Feature czysto aplikacyjny, bez migracji i bez nowych zależności (C-53).
