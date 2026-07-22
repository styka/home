# Weryfikacja: Model daty zrobienia zadań cyklicznych (link wystąpień + bulk rolowanie) + usunięcie ikony sortu

- **Spec:** ./spec.md (022-recurring-completion-date-model)
- **Data:** 2026-07-22
- **Weryfikujący:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ `Numeracja migracji OK (następny wolny numer: 0209)` — 0208 unikalne, zaaplikowane lokalnie (`migrate deploy` OK) |
| `npm run check:actions` | ✅ `159 akcji, wszystkie obsługiwane przez executor` — brak nowej `AIAction` |
| `next lint --dir src` | ✅ zero błędów; tylko istniejące ostrzeżenia (no-img-element, exhaustive-deps TaskDetail/TasksPage — wzorzec sprzed feature'a) |
| `next build` (lokalny Postgres, C-13) | ✅ `Compiled successfully` + `Generating static pages (130/130)` |

## Kryteria akceptacji
| AC | Werdykt | Dowód / jak sprawdzono |
|----|---------|------------------------|
| **AC-1 (bulk roluje cykliczne)** | ✅ | `tasks.ts:372-388` — `isDoneTransition && existing.recurring` → `completeRecurringTask(id, { completionDate })` (`:378`), `delete data.status` + nałożenie reszty pól; gałąź niecykliczna bez zmian (`:386`). Masowe „Zrobione" tworzy kolejne wystąpienie jak pojedyncze odhaczenie; wspólna data (021) przekazana przez `completionDate`. |
| **AC-2 (powiązanie wystąpień)** | ✅ | `tasks.ts:553,556` — `prisma.task.create` nowego wystąpienia niesie `lastCompletedAt: completedAt` **oraz** `previousTaskId: existing.id`. Migracja 0208 + `schema.prisma` (relacja `TaskRecurrence`, `@@index`) zaaplikowane (build/generate OK). |
| **AC-3 (rozróżnienie dat)** | ✅ | Wiersz: `TaskRow.tsx:232-235` — znacznik czyta `completedAt ?? lastCompletedAt` (aktywne cykliczne pokazuje „ostatnie zrobienie" poprzednika). Szczegóły: `TaskDetail.tsx:533` pole „Zrobione" (własna data, gdy zrobione) + `:546-551` read-only „Ostatnio" gdy `lastCompletedAt && !completedAt`. Typ `Task.previousTaskId` w `types/index.ts`. |
| **AC-4 (sync po edycji)** | ✅ | `tasks.ts:255` — po `update` przy `explicitCompletedAt !== undefined`: `updateMany({ where: { previousTaskId: id }, data: { lastCompletedAt: explicitCompletedAt } })`. Edycja daty poprzednika (detal → `handleCompletedAtChange` → `updateTask({completedAt})`) aktualizuje `lastCompletedAt` następcy; brak następcy/niecykliczne → no-op. |
| **AC-5 (pole pod „Start")** | ✅ | `TaskDetail.tsx:533-542` — pole „Zrobione" `type="date"` z tym samym markupem/stylem co „Start" (`Calendar size 13`, `label w-20`, `flex-1 … border rounded px-2 py-1`, kolory ze zmiennych), umieszczone bezpośrednio pod blokiem „Start"; blok „Ukończone" usunięty ze stopki Meta. |
| **AC-6 (wariant A — klik/`x` = dziś)** | ✅ | `tasks.ts:478` — `toggleTaskStatus` przy `→DONE` cyklicznego nadal woła `completeRecurringTask(id)` bez `completionDate` → data = „teraz" (dziś), natychmiast, bez pytania. Ścieżka nietknięta. |
| **AC-7 (usunięcie ikony sortu)** | ✅ | `grep sortBy` w `src/components/tasks` = brak trafień. Usunięto stan/persist/przycisk w `TasksPage.tsx`, prop w `TaskList.tsx`, logikę w `CompletedSection.tsx` (domyślna kolejność, stały label „✓ Zrobione / Anulowane", `defaultOpen={false}`). Znacznik „✓" w `TaskRow.tsx:232` pozostał. |
| **AC-8 (bez regresji)** | ✅ | `next build` 130/130 zielony; niecykliczne domykanie bez zmian (gałąź `else`, `:386-388`); zwykłe pola/inne widoki nietknięte; migracja addytywna (kolumna+indeks+FK). |

## Zgodność z konstytucją
- **C-10/C-11/C-12:** ✅ ręczna migracja 0208 (numer z `next:migration`), zwykłe pole `String?` + relacja, zero enumów. Nie renumerowano istniejących migracji.
- **C-20/C-21:** ✅ zmiany w Server Actions (`updateTask`/`bulkUpdateTasks`/`completeRecurringTask`) z istniejącym `revalidatePath` i guardem `assertTaskAccess`.
- **C-24 (soft-delete):** ✅ `onDelete: SetNull` na `previousTaskId` — usunięcie/Kosz poprzednika nie kaskaduje na następcę (jak `parentTaskId`).
- **C-23/C-40:** ✅ nie dotyczą — brak nowej `AIAction`/read-toola (`check:actions` zielony).
- **C-30/C-32:** ✅ pola/etykiety na zmiennych CSS, teksty PL, wzorzec pola „Start".
- **C-50/C-51:** ✅ build zielony; lekcja dopisana do `doświadczenia.md` (bulk cyklicznych przez akcję domenową; link wystąpień + sync).

## Regresje
- **`updateTask` sync:** `updateMany` odpala się **tylko** przy jawnej edycji `completedAt` (`explicitCompletedAt !== undefined`); wywołania AI/statusowe (bez `completedAt`) → brak dodatkowego zapisu. Wewnętrzne `updateTask(id,{status:"DONE"})` z `completeRecurringTask` nie triggeruje sync (brak jawnej daty), a następca i tak jeszcze nie istnieje.
- **Bulk:** `completeRecurringTask` w pętli tylko dla `recurring` + realnej tranzycji `→DONE`; niecykliczne i statusy nieterminalne bez zmian. Dodatkowe `requireAuth`/`assertTaskAccess` per zadanie — akceptowalny narzut.
- **Wspólny `TaskDetail`:** pole przeniesione, nie zdublowane; stan `completedAt`/handler bez zmian. `TaskList`/`CompletedSection` — usunięto martwy prop, brak wpływu na kanban/timeline.
- **Migracja:** addytywna (ADD COLUMN/INDEX/FK) — brak wpływu na istniejące dane/zapytania; brak backfillu świadomie (spec §5).

## Werdykt końcowy
**GOTOWE.** Wszystkie bramki zielone (do `next build`); AC-1..AC-8 spełnione z dowodem w kodzie
(plik:linia); brak regresji; migracja bezpieczna (addytywna, SetNull). Przejście do `/review`.
