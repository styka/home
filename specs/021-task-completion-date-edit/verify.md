# Weryfikacja: Edytowalna data wykonania + wybór daty przy oznaczaniu (single + bulk)

- **Spec:** ./spec.md (021-task-completion-date-edit)
- **Data:** 2026-07-22
- **Weryfikujący:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ `OK (następny wolny numer: 0208)` — brak nowych migracji |
| `npm run check:actions` | ✅ `159 akcji, wszystkie obsługiwane przez executor` |
| `next lint --dir src` | ✅ zero błędów; nowy warning naprawiony (curly quote); TaskDetail exhaustive-deps to **istniejący** wzorzec sync-effectu |
| `next build` (lokalny Postgres, C-13) | ✅ `Compiled successfully` + `130/130` |

## Kryteria akceptacji
| AC | Werdykt | Dowód / jak sprawdzono |
|----|---------|------------------------|
| **AC-1 (edycja w szczegółach)** | ✅ | `TaskDetail.tsx:850-851` pole `type="date"` → `handleCompletedAtChange` (`:160`) → `updateTask({ completedAt: parseDateInput(v,{dayOnly:true}) })`; `updateTask` (`tasks.ts:239-246`) zapisuje jawną datę. Znacznik „✓" (020) czyta `completedAt`. |
| **AC-2 (spójność ze statusem)** | ✅ | `tasks.ts:229-236` — `derivedCompletedAt`: →DONE=teraz, →inny=null, brak zmiany=undefined. Gdy brak jawnej daty → `final = derived` (`:240`). Zachowanie jak dotąd. |
| **AC-3 (data przy oznaczaniu pojedynczego)** | ✅ | Jawna data ma pierwszeństwo: `explicitCompletedAt !== undefined ? explicit : derived` (`:240`); `completedAt` wyłuskane z `{...patch}` (`:239,242`), ustawiane jawnie (`:246`) → nie jest nadpisywane ani przez spread, ani przez derivację. |
| **AC-4 (bulk domyślnie dziś)** | ✅ | `tasks.ts:366` `data.completedAt = scalar.completedAt ?? new Date()` — bez podanej daty (`undefined`) → `new Date()` (dotychczasowe). |
| **AC-5 (bulk wspólna data)** | ✅ | `BulkActionBar.tsx:101` pole daty + `:107` `apply({ status, completedAt: s.isTerminal && doneDateValue ? new Date(doneDateValue+"T12:00:00") : undefined })`; `bulkUpdateTasks` stosuje ją wszystkim zaznaczonym (`:366`). |
| **AC-6 (spójność z 020 / cykliczne)** | ✅ | `completeRecurringTask` (ścieżka `completionDate`→`lastCompletedAt`) **nietknięta** (grep: brak zmian w tej funkcji poza istniejącym z 020). |
| **AC-7 (bez regresji szybkiego odhaczania)** | ✅ | `toggleTaskStatus` i klik ikony statusu w `TaskRow` **nietknięte** → nadal „teraz", natychmiastowe. |

## Zgodność z konstytucją
- **C-20:** ✅ zmiany w Server Actions (`updateTask`/`bulkUpdateTasks`) z istniejącym `revalidatePath` +
  guard `assertTaskAccess` (C-21) — bez zmian.
- **C-30/C-32:** ✅ pola daty na zmiennych CSS (`--text-secondary`, `--bg-base`, `--border`); teksty PL.
- **C-53 (minimalizm):** ✅ rozszerzenie istniejących akcji/UI; użyto `s.isTerminal` z `resolveStatuses`
  zamiast dublować logikę; zero migracji/zależności.
- **C-10..C-14:** nie dotyczą (brak schematu). **C-23/C-40:** nie dotyczą (pola opcjonalne, brak AIAction).
- **C-50:** ✅ build zielony. **C-51:** ✅ lekcja dopisana.

## Regresje
- **`updateTask` — pułapka `{...patch}`:** rozwiązana (destrukturyzacja + jawne ustawienie); AI-execute
  wywołuje `updateTask` bez `completedAt` (pole opcjonalne) → zachowanie AI bez zmian.
- **Bulk loop:** `data` budowane pole-po-polu; `completedAt` ustawiane wyłącznie w gałęzi DONE — brak
  wycieku dla statusów nieterminalnych (te dostają `null` jak dotąd).
- **Wspólny `TaskDetail`/`BulkActionBar`:** dodane pola opcjonalne; brak wpływu na inne widoki.
- Brak zmian migracji/RBAC/cyklicznych → brak wpływu na sąsiednie moduły.

## Werdykt końcowy
**GOTOWE.** Bramki zielone; AC-1..AC-7 spełnione z dowodem w kodzie; brak regresji. Przejście do
`/review`.
