# Recenzja: Edytowalna data wykonania + wybór daty przy oznaczaniu (single + bulk)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md (021-task-completion-date-edit)
- **Data:** 2026-07-22 · **Recenzent:** Claude Code (etap /review)

## Zakres
Diff względem `origin/develop`: **3 pliki, +46/−6**. `actions/tasks.ts` (`updateTask`+`bulkUpdateTasks`),
`TaskDetail.tsx` (edytowalne „Ukończone"), `BulkActionBar.tsx` (opcjonalna data w panelu „Status").
Bez zmian schematu/migracji.

## Ustalenia
**Brak ustaleń** (correctness / convention / simplification / security) wymagających zmiany.

Przegląd:
- **Poprawność `updateTask`:** `completedAt` wyłuskane z patcha (`const { completedAt: explicit,
  ...restPatch }`), `data = {...restPatch}` (bez completedAt), jawne ustawienie `finalCompletedAt =
  explicit ?? derived` z priorytetem jawnej wartości. Brak podwójnego zapisu / nadpisania. `recurring`
  i `title` nadal nadpisywane po spreadzie jak dotąd.
- **Poprawność `bulkUpdateTasks`:** `data` budowane pole-po-polu (bez spreadu `scalar`), więc
  `completedAt` ustawiane **wyłącznie** w gałęzi `newStatus === "DONE"` (`scalar.completedAt ?? new
  Date()`); statusy nieterminalne → `null` jak dotąd. Data podana dla statusu terminalnego innego niż
  literalne „DONE" jest **bezpiecznie ignorowana** po stronie serwera (gałąź keyuje na „DONE") — brak
  ryzyka.
- **UI:** `TaskDetail` — pole `type="date"` wg wzoru `startDate` (`toDateValue`/`parseDateInput dayOnly`,
  sync w useEffect); puste = `null` (wyczyść). `BulkActionBar` — pole daty + `s.isTerminal` z
  `resolveStatuses` (bez dublowania logiki „czy zamykający"); „T12:00:00" jak w panelu „Termin"
  (bez przeskoku dnia).
- **Konwencje:** kolory ze zmiennych CSS (C-30), teksty PL (C-32), brak enumów/migracji, guard
  `assertTaskAccess` + `revalidatePath` w obu akcjach bez zmian (C-20/C-21).
- **AI:** dodanie **opcjonalnego** `completedAt` do sygnatur akcji nie zmienia wywołań AI (`check:actions`
  zielony, 159 akcji).
- **Bezpieczeństwo:** brak markdown/HTML/kluczy → brak powierzchni ataku.

## Werdykt
**APPROVE.** Kod poprawny, minimalny i zgodny z konwencjami; wszystkie bramki zielone; AC-1..AC-7
pokryte z dowodem. Zmiana w pełni weryfikowalna w sandboxie (bez zależności od iOS), bez migracji →
bezpieczna na produkcji. Domknięcie: merge do `develop` + automatyczna promocja `develop → master` (C-52).
