# Plan techniczny: Przeliczenie terminu następcy po edycji daty wykonania (kotwica „od daty wykonania")

- **Spec:** ./spec.md (023-recurring-completion-anchor-reschedule)
- **Status:** draft
- **Data:** 2026-07-22

> **Zasada planu:** to jest **JAK**, pod istniejący kod Tasks. Wzorzec = sam moduł Tasks (020/021/022):
> `updateTask`, `completeRecurringTask`, `lib/recurrence.ts`.

## 1. Podejście (2–4 zdania)
Rozszerzamy **wyłącznie** blok synchronizacji z 022 w `updateTask` (`src/actions/tasks.ts`). Gdy jawnie
edytowana jest data wykonania (`explicitCompletedAt !== undefined`), a zadanie ma regułę z efektywną
kotwicą `COMPLETION`, znajdujemy **aktywnego** (nie-DONE) bezpośredniego następcę (powiązanie
`previousTaskId` z 022) i — jeśli jego termin jest wciąż tym policzonym ze **starej** daty wykonania
(heurystyka „nietknięty") — przeliczamy jego `dueDate` od nowej daty wg reguły, przesuwając `startDate`
o tę samą różnicę. Reużywamy `computeNextDue`/`parseRecurringRule` z `lib/recurrence.ts` (C-53). Zero
schematu, UI, AI.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Używamy istniejących pól `Task`: `completedAt`, `dueDate`, `startDate`,
`recurring` (JSON `RecurringRule` z polem `anchor`), oraz powiązania `previousTaskId` (dodanego w 022).
Brak migracji — `npm run check:migrations` zielony bez nowego katalogu.

## 3. Warstwa serwera (Server Actions — C-20)
Plik: `src/actions/tasks.ts`, funkcja **`updateTask`** (istniejąca; guard `assertTaskAccess` +
`revalidatePath("/tasks")` już są — C-21, bez zmian).

Rozszerzenie istniejącego bloku 022 (obecnie `updateMany` na `previousTaskId`):
- Zachowujemy sync „daty ostatniego zrobienia": `updateMany({ where: { previousTaskId: id }, data: {
  lastCompletedAt: explicitCompletedAt } })` (obejmuje 0/1/wielu — bez regresji AC-6).
- **Dodajemy** (tylko gdy `rule?.anchor === "COMPLETION"`, `explicitCompletedAt !== null`,
  `existing.completedAt` istnieje):
  - `successor = findFirst({ where: { previousTaskId: id, status: { not: "DONE" } } })` — aktywny
    bezpośredni następca (AC-5).
  - `oldNextDue = computeNextDue(existing.completedAt, rule)`.
  - **Heurystyka „nietknięty termin" (AC-3):** przelicz tylko, gdy `successor.dueDate` istnieje i
    `successor.dueDate.getTime() === oldNextDue.getTime()`.
  - `newNextDue = computeNextDue(explicitCompletedAt, rule)`; jeśli istnieje →
    `data.dueDate = newNextDue`; jeśli `successor.startDate` → `data.startDate =
    successor.startDate + (newNextDue - oldNextDue)` (AC-2).
  - `prisma.task.update({ where: { id: successor.id }, data })`.
- Import: `computeNextDue` już jest w pliku (używany w `completeRecurringTask`); dodać
  `parseRecurringRule` z `@/lib/recurrence` (albo `JSON.parse` jak w `completeRecurringTask` — wybrać
  `parseRecurringRule` dla bezpieczeństwa na uszkodzonym JSON).
- `revalidatePath("/tasks")` (i per-projekt) — **bez zmian**, poprawiony termin następcy propaguje się do
  listy/kalendarza.

Szkic (poglądowo):
```ts
if (explicitCompletedAt !== undefined) {
  await prisma.task.updateMany({ where: { previousTaskId: id }, data: { lastCompletedAt: explicitCompletedAt } });
  const rule = parseRecurringRule(existing.recurring);
  if (rule?.anchor === "COMPLETION" && explicitCompletedAt !== null && existing.completedAt) {
    const successor = await prisma.task.findFirst({ where: { previousTaskId: id, status: { not: "DONE" } } });
    const oldNextDue = computeNextDue(existing.completedAt, rule);
    if (successor?.dueDate && oldNextDue && successor.dueDate.getTime() === oldNextDue.getTime()) {
      const newNextDue = computeNextDue(explicitCompletedAt, rule);
      if (newNextDue) {
        const data: Record<string, unknown> = { dueDate: newNextDue };
        if (successor.startDate) data.startDate = new Date(successor.startDate.getTime() + (newNextDue.getTime() - oldNextDue.getTime()));
        await prisma.task.update({ where: { id: successor.id }, data });
      }
    }
  }
}
```

## 4. RBAC / rejestr modułu (C-22)
Bez zmian — istniejący `module.tasks`, istniejące guardy. Brak wpięć w `permissions.ts`/`modules.tsx`/
`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
**Bez zmian w UI.** Efekt jest niewidoczny poza tym, że termin/„Start" następcy się aktualizuje — widać
to na liście/w szczegółach po istniejącym `revalidatePath`. Brak nowych komponentów/tekstów.

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`/read-toola; sygnatury akcji bez zmian (`check:actions` zielony).
Kalendarz/powiadomienia korzystają z przeliczonego terminu przez istniejącą agregację — bez nowych
wpięć.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/actions/tasks.ts` | edycja | rozszerzenie bloku sync 022 w `updateTask` o przeliczenie terminu następcy (kotwica COMPLETION) + ew. import `parseRecurringRule` |
| `doświadczenia.md` | edycja | wpis-lekcja (C-51) |

## 8. Bramki i weryfikacja (C-50)
- Lokalny Postgres (C-13): migracje już zaaplikowane (brak nowej); **nie** `scripts/migrate.js`.
- `npm run check:migrations`, `npm run check:actions`, `next lint --dir src`, `next build`.
- Mapowanie AC → weryfikacja (prześledzenie logiki + build):
  - **AC-1** — anchor COMPLETION + aktywny nietknięty następca → `dueDate` przeliczony od nowej daty
    (`computeNextDue(explicitCompletedAt, rule)`).
  - **AC-2** — `successor.startDate` przesunięty o `newNextDue - oldNextDue`.
  - **AC-3** — gdy `successor.dueDate !== oldNextDue` (ręczna zmiana / „Następne w tej dacie") →
    warunek fałszywy → termin nietknięty; `lastCompletedAt` i tak zsync.
  - **AC-4** — `rule.anchor !== "COMPLETION"` (DUE/brak) → gałąź pominięta; tylko `lastCompletedAt`.
  - **AC-5** — `status: { not: "DONE" }` w `findFirst` → zrobiony następca pominięty; brak kaskady.
  - **AC-6** — pozostałe ścieżki (`updateMany` bez zmian; brak zmian w domykaniu/bulku/single-click);
    `next build` zielony.

## 9. Ryzyka techniczne i plan wycofania
- **Nadpisanie świadomej zmiany:** wykluczone heurystyką równości terminów (AC-3).
- **`endDate` po przesunięciu w przód:** jeśli przeliczony termin wypadnie za `rule.endDate`, i tak go
  ustawiamy (nie usuwamy następcy) — świadomie poza zakresem (skrajny, rzadki przypadek; korekta daty w
  przód przy bliskim końcu reguły). Odnotowane.
- **Porównanie dat (ms):** termin zapisany przy domknięciu = dokładnie `computeNextDue(oldCompletedAt)`,
  więc równość `getTime()` jest wiarygodna dla „nietknięty". Jeśli w przyszłości domknięcie zmieni
  normalizację, heurystyka pozostaje spójna (liczona tą samą funkcją).
- **Rollback:** czysto kodowy — revert commita; brak migracji/danych do cofania.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 — brak schematu/migracji (jawnie).
- [x] C-20..C-25 — zmiana w istniejącej Server Action z `revalidatePath`; guard dostępu bez zmian; brak
  nowej `AIAction`; brak wpływu na trash/audyt.
- [x] C-30..C-32 — brak UI (nic do zmiennych CSS/mobile/tekstów).
- [x] C-53 (minimalizm) — reużycie `computeNextDue`/`parseRecurringRule` i powiązania z 022; jedna
  funkcja dotknięta; zero nowych zależności/abstrakcji.
