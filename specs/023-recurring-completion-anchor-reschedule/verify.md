# Weryfikacja: Przeliczenie terminu następcy po edycji daty wykonania (kotwica „od daty wykonania")

- **Spec:** ./spec.md (023-recurring-completion-anchor-reschedule)
- **Data:** 2026-07-22
- **Weryfikujący:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ `Numeracja migracji OK (następny wolny numer: 0209)` — brak nowych migracji (feature bezschematowy) |
| `npm run check:actions` | ✅ `159 akcji, wszystkie obsługiwane przez executor` — brak nowej `AIAction` |
| `next lint --dir src` | ✅ zero błędów; brak nowych ostrzeżeń w `tasks.ts` |
| `next build` (lokalny Postgres, C-13) | ✅ `Compiled successfully` + `Generating static pages (130/130)` |

## Kryteria akceptacji
Prześledzenie logiki bloku `tasks.ts:255-277` (rozszerzenie sync 022 w `updateTask`).

| AC | Werdykt | Dowód / jak sprawdzono |
|----|---------|------------------------|
| **AC-1 (przeliczenie dla COMPLETION)** | ✅ | `tasks.ts:263-274` — gdy `rule.anchor==="COMPLETION"`, aktywny nietknięty następca → `data.dueDate = computeNextDue(explicitCompletedAt, rule)` (`:267,269`) i `prisma.task.update` (`:274`). Termin przeliczany od poprawionej daty wg reguły cyklu. |
| **AC-2 (przesunięcie startu)** | ✅ | `tasks.ts:271-273` — gdy `successor.startDate`, `startDate = successor.startDate + (newNextDue - oldNextDue)`; przesunięcie = różnica terminów, zachowuje wyprzedzenie startu. |
| **AC-3 (poszanowanie ręcznych zmian / override)** | ✅ | `tasks.ts:266` — warunek `successor.dueDate.getTime() === oldNextDue.getTime()` (`oldNextDue = computeNextDue(existing.completedAt, rule)`). Ręczna zmiana i „Następne w tej dacie" dają `dueDate` różny od policzonego ze starej daty → warunek fałszywy → termin nietknięty; `lastCompletedAt` i tak zsync (`:255`). Odtwarza dokładnie wartość zapisaną przy domknięciu (baza COMPLETION = `completedAt`), więc równość jest wiarygodna. |
| **AC-4 (kotwica DUE bez zmian)** | ✅ | `tasks.ts:263` — bramka `rule?.anchor === "COMPLETION"`; dla DUE/braku kotwicy gałąź pominięta, wykonuje się tylko `updateMany(lastCompletedAt)`. |
| **AC-5 (tylko aktywny bezpośredni następca)** | ✅ | `tasks.ts:264` — `findFirst({ where: { previousTaskId: id, status: { not: "DONE" } } })`; zrobiony następca (łańcuch ruszył dalej) nie jest znajdowany → brak zmian, brak kaskady wstecz. |
| **AC-6 (bez regresji)** | ✅ | `updateMany(lastCompletedAt)` (`:255`) zachowane — sync 022 działa w każdym przypadku edycji daty. Domykanie/bulk/single-click/`completeRecurringTask` nietknięte. `next build` 130/130. |

## Zgodność z konstytucją
- **C-10..C-14:** ✅ nie dotyczą — brak schematu/migracji.
- **C-20/C-21:** ✅ zmiana w istniejącej Server Action `updateTask` z zachowanym `revalidatePath` i
  guardem `assertTaskAccess`; następca współdzieli właściciela poprzednika (link `previousTaskId`).
- **C-23/C-40:** ✅ nie dotyczą — brak `AIAction`/routingu LLM.
- **C-30..C-32:** ✅ nie dotyczą — brak UI.
- **C-53 (minimalizm):** ✅ reużycie `computeNextDue`/`parseRecurringRule` i powiązania z 022; jedna
  funkcja dotknięta; zero migracji/zależności/UI.
- **C-50/C-51:** ✅ build zielony; lekcja dopisana do `doświadczenia.md`.

## Regresje
- **`updateTask`:** dodatkowe zapytania (`findFirst` + ewentualny `update`) wykonują się **tylko** przy
  jawnej edycji daty i `anchor === "COMPLETION"` — pozostałe wywołania `updateTask` (status, tytuł, AI,
  DUE) bez dodatkowego kosztu. `explicitCompletedAt === null` (czyszczenie daty) → recompute pominięty
  (brak bazy), tylko sync `lastCompletedAt`.
- **Snapshot `existing`:** `existing.completedAt` to wartość **sprzed** edycji (pobrane na początku
  `updateTask`), więc `oldNextDue` odtwarza termin zapisany przy domknięciu — heurystyka spójna.
- **Kotwica jednorazowa (`opts.anchor`) niezapisana w regule:** świadomie poza zakresem (spec §5); gdy
  domknięcie użyło jednorazowego DUE przy regule COMPLETION, heurystyka równości i tak nie ruszy DUE-owo
  policzonego terminu (mismatch) — bezpieczne.
- **Brak wpływu** na migracje/RBAC/AI/inne moduły; kalendarz/przypomnienia korzystają z przeliczonego
  terminu przez istniejący `revalidatePath`.

## Werdykt końcowy
**GOTOWE.** Bramki zielone (do `next build 130/130`); AC-1..AC-6 spełnione z dowodem w kodzie
(plik:linia); brak regresji; brak migracji → bezpieczne na produkcji. Przejście do `/review`.
