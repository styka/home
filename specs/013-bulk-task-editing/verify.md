# Weryfikacja: Bulkowa (zbiorcza) edycja zadań

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Data:** 2026-07-20

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `node scripts/check-migrations.js` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)" — brak nowej migracji, brak kolizji |
| `node scripts/check-action-coverage.js` | ✅ 159 akcji w katalogu, wszystkie z egzekutorem |
| `node scripts/check-ai-coverage.js` | ✅ 490 akcji sklasyfikowanych (nowe `bulk*` = `excluded`) |
| `next lint --dir src` | ✅ zero błędów; tylko istniejące ostrzeżenia (exhaustive-deps/img) niezwiązane z tą zmianą |
| `next build` (lokalny Postgres) | ✅ „Compiled successfully" + „Checking validity of types" bez błędów (EXIT 0); `/tasks/[projectId]` zbudowane |

> Build uruchomiony przeciw lokalnemu Postgres 16 (`omnia_dev`), C-13 zachowane — prod DB nietknięte.
> Po zielonym buildzie zmieniał się już tylko `tasks.md` (docs), więc wynik pozostaje aktualny.

## Kryteria akceptacji
| AC | Werdykt | Jak sprawdzono / dowód |
|----|---------|------------------------|
| **AC-1** pasek + licznik | ✅ | `TasksPage.tsx:776` renderuje `BulkActionBar` gdy `selectedIds.size>0`; `BulkActionBar` pokazuje `count`. |
| **AC-2** zbiorczy status | ✅ | `bulkUpdateTasks` zapisuje `data.status` per zaznaczone; niezaznaczone nie są w pętli (`actions/tasks.ts:329-372`). |
| **AC-3** tylko wybrane pola | ✅ | `data` dostaje wyłącznie klucze obecne w `patch` (`tasks.ts:344-348`); `completedAt` tylko przy zmianie statusu; tagi tylko gdy podane — nietknięte pola bez zmian. |
| **AC-4** termin ustaw/wyczyść | ✅ | Pasek: „Ustaw termin" → `dueDate:new Date(...)`, „Wyczyść termin" → `dueDate:null` (`BulkActionBar.tsx`); akcja zapisuje `dueDate` gdy `!== undefined`. |
| **AC-5** kategoria | ✅ | Pasek panel „Kategoria" → `apply({category})`; akcja zapisuje `data.category`. |
| **AC-6** przenieś projekt | ✅ | `apply({projectId})`; akcja robi `assertProjectAccess(cel)` raz + zapis `projectId`, `revalidatePath` starego i nowego projektu. |
| **AC-7** tagi dodaj/usuń | ✅ | `removeTagIds` → `deleteMany where taskId+tagId in`; `addTagIds` → `createMany skipDuplicates` (`tasks.ts:366-371`) — pozostałe tagi nietknięte. UI: chip cyklicznie brak→dodaj→usuń. |
| **AC-8** usuń → Kosz | ✅ | `bulkDeleteTasks` robi `recordTrash(...)` przed `prisma.task.delete` (`tasks.ts:406-420`) — odzysk w `/trash`. Pasek „Usuń" z `confirm`. |
| **AC-9** zaznacz wszystkie | ✅ | `toggleSelectAllVisible` po `visibleTasks` (`TasksPage.tsx:288`); przycisk w pasku „Wszystkie (N)"/„Odznacz". |
| **AC-10** pomijanie bez dostępu | ✅ | Pętla `try { assertTaskAccess } catch { skipped++; continue }` (`tasks.ts:332-335, 401-403`); zwrot `{updated/deleted, skipped}` → komunikat „Zmieniono X z N (pominięto …)". |
| **AC-11** Esc/Anuluj | ✅ | `onEscape` na starcie: `if (selectionMode||selectedIds.size) finishSelection(null)` (`TasksPage.tsx:384`); „Anuluj" (X) w pasku → `finishSelection(null)`; żadnej mutacji. |
| **AC-12** custom statusy listy | ✅ | Panel statusów z `resolveStatuses(statusConfig)` (`BulkActionBar.tsx:48`) — `statusConfig` to konfiguracja bieżącej listy; akcja normalizuje osierocony custom status przy przeniesieniu (`tasks.ts:349-354`). |
| **AC-13** mobile/checkbox/Shift | ✅ | Checkbox 20×20 (`TaskRow.tsx` `width:20,height:20`), long-press 450 ms (`handleTouchStart`), Shift+klik zakres liczony w kolejności renderu (`TaskList.tsx handleRowSelect` + `orderedIds`); pasek `env(safe-area-inset-bottom)`. |

## Zgodność z konstytucją
- **C-01/C-02** ✅ zmiany w `worldofmag/src`, importy przez `@/*`.
- **C-12** ✅ brak enumów — statusy/priorytety jako `String`/union.
- **C-20** ✅ obie akcje kończą się `revalidatePath("/tasks")` + projekty.
- **C-21** ✅ `assertTaskAccess`/`assertProjectAccess` egzekwowane per zadanie; brak dostępu = skip.
- **C-23** ✅ brak nowej `AIAction`; nowe akcje sklasyfikowane `excluded` w manifeście (bramka zielona).
- **C-24** ✅ zbiorcze usunięcie przez `recordTrash` (soft-delete/Kosz).
- **C-30** ✅ wyłącznie zmienne CSS (`--bg-*`,`--accent-*`,`--on-accent`), brak hardcodowanych hexów w nowym UI.
- **C-31** ✅ checkbox 20×20, `safe-area-inset-bottom`, Esc; brak drugiego sidebara.
- **C-32** ✅ teksty PL.
- **C-51** ✅ lekcja (downlevelIteration po `Set`) dopisana do `doświadczenia.md`.
- **C-53** ✅ bez migracji/nowej trasy/zależności; reużycie `updateTask`/`deleteTask`/pickerów.

## Regresje
- **`TaskRow`** — nowe propsy selekcji opcjonalne z defaultami; jedyny konsument (`TaskList`) zaktualizowany. Zachowanie poza trybem zaznaczania bez zmian (klik → focus+open). ✅
- **`TaskList`** — dodane opcjonalne propsy; brak wpływu na Kanban/Timeline (tam `TaskList` nie jest używany). ✅
- **`bulkUpdateTasks`/`bulkDeleteTasks`** — nowe eksporty, nie zmieniają istniejących `updateTask`/`deleteTask`. `next build` przechodzi → brak regresji typów w innych modułach. ✅
- **RBAC/revalidate** — bez zmian w schemacie i uprawnieniach; `revalidatePath` spójne z istniejącymi akcjami. ✅

## Werdykt końcowy
**GOTOWE.** Wszystkie 13 kryteriów akceptacji spełnione (prześledzone w kodzie), wszystkie bramki
techniczne zielone (`next build` EXIT 0 przeciw lokalnej bazie), brak naruszeń konstytucji i regresji.

> Ograniczenie: weryfikacja behawioralna przez prześledzenie ścieżek w kodzie + build/typecheck; nie
> uruchamiano klikacza e2e w przeglądarce (poza zakresem tej sesji). Logika mutacji pokryta jednak
> jednoznacznie i zgodna z wzorcem `updateTask`/`deleteTask`.
