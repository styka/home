# Recenzja: Przeliczenie terminu następcy po edycji daty wykonania (kotwica „od daty wykonania")

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md (023-recurring-completion-anchor-reschedule)
- **Data:** 2026-07-22 · **Recenzent:** Claude Code (etap /review)

## Zakres
Diff względem `origin/develop`: **1 plik, +23/−1** — `actions/tasks.ts` (`updateTask`: rozszerzenie
bloku sync 022 o przeliczenie terminu następcy dla kotwicy COMPLETION; import `parseRecurringRule`).
Bez schematu/migracji/UI/AI.

## Ustalenia
**Brak ustaleń** (correctness / convention / simplification / security) wymagających zmiany.

Przegląd:
- **Poprawność bramek:** `rule?.anchor === "COMPLETION"` (DUE/brak → pominięte), `explicitCompletedAt
  !== null` (czyszczenie daty → pominięte, brak bazy), `existing.completedAt` (stara data jako baza
  `oldNextDue`). `existing` to snapshot sprzed `update`, więc `oldNextDue` odtwarza dokładnie termin
  zapisany przy domknięciu — równość `getTime()` jest wiarygodnym testem „nietknięty".
- **Aktywny następca:** `findFirst({ previousTaskId: id, status: { not: "DONE" } })` — zrobiony następca
  (łańcuch ruszył dalej) pomijany; brak kaskady wstecz (AC-5). Typowo istnieje 0/1 aktywny następca.
- **Poszanowanie override:** „Następne w tej dacie" i ręczna zmiana dają `dueDate ≠ computeNextDue(old)`
  → heurystyka fałszywa → termin nietknięty. Jednorazowa kotwica DUE przy regule COMPLETION też
  naturalnie mija się z heurystyką (mismatch) — bezpieczne.
- **Start:** przesunięcie o `newNextDue − oldNextDue` zachowuje wyprzedzenie startu (AC-2).
- **Dostęp / cache:** `assertTaskAccess` na edytowanym zadaniu już wykonany; następca to zadanie tego
  samego właściciela/projektu (kopiowane w `completeRecurringTask`), więc `revalidatePath("/tasks")` +
  per-projekt z `updateTask` pokrywa też następcę (C-20/C-21). Wewnętrzna kaskada spójna z wzorcem 022.
- **Konwencje:** praca w `worldofmag/` (C-01), zero enumów (C-12), reuse `computeNextDue`/
  `parseRecurringRule` zamiast dublowania (C-53), komentarze PL (C-32), brak UI. Wszystko `await`-owane.
- **Bezpieczeństwo:** brak kluczy/markdown/HTML; brak nowej `AIAction`; brak nowej powierzchni ataku.

**Obserwacja (nieblokująca, poza zakresem):** jeśli przeliczony termin wypadnie za `rule.endDate`
(korekta daty mocno w przód przy bliskim końcu reguły), i tak zostaje ustawiony — udokumentowane w
plan §9 jako świadomie poza zakresem (skrajny, rzadki przypadek). Nie wymaga zmiany.

## Werdykt
**APPROVE.** Kod poprawny, minimalny (jedna funkcja, reuse helperów), zgodny z konwencjami; bramki
zielone (`check:migrations`/`check:actions`/`lint`/`build 130/130`); AC-1..AC-6 pokryte z dowodem; brak
migracji → bezpieczne na produkcji. Domknięcie: merge do `develop` + automatyczna promocja
`develop → master` (C-52).
