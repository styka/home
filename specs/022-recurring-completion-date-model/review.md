# Recenzja: Model daty zrobienia zadań cyklicznych (link wystąpień + bulk rolowanie) + usunięcie ikony sortu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md (022-recurring-completion-date-model)
- **Data:** 2026-07-22 · **Recenzent:** Claude Code (etap /review)

## Zakres
Diff względem `origin/develop`: **8 plików, +78/−66**. Migracja 0208 (`Task.previousTaskId`) +
`schema.prisma`; `actions/tasks.ts` (link wystąpień, bulk roluje cykliczne, sync następcy);
`TaskDetail.tsx` (pole daty pod „Start" + „Ostatnio", usunięcie z Meta); usunięcie logiki sortu
(`TasksPage`/`TaskList`/`CompletedSection`); `types/index.ts` (+`previousTaskId`).

## Ustalenia
**Brak ustaleń** (correctness / convention / simplification / security) wymagających zmiany.

Przegląd:
- **Migracja ↔ schemat spójne:** `previousTaskId TEXT` + indeks + FK `ON DELETE SET NULL` w
  `migration.sql` odpowiadają `schema.prisma` (relacja `TaskRecurrence`, `@@index`). Migracja
  addytywna, zaaplikowana lokalnie (`migrate deploy` OK). `onDelete: SetNull` chroni soft-delete/Kosz
  (C-24) — usunięcie poprzednika zeruje link następcy, nie kaskaduje.
- **`bulkUpdateTasks` — poprawność rolowania:** dla `isDoneTransition && existing.recurring` woła
  `completeRecurringTask(id, { completionDate })` (tworzy kolejne wystąpienie) zamiast surowego
  `update`; `delete data.status` zapobiega powtórnemu ustawieniu statusu, a pozostałe pola skalarne
  nakładane są osobno. Gałąź `else` (niecykliczne/statusy nieterminalne) = zachowanie sprzed feature'a.
  `assertTaskAccess` sprawdzone przed rozgałęzieniem; `completeRecurringTask` ma własny guard —
  bezpieczna redundancja.
- **`updateTask` — sync następcy:** `updateMany({ where: { previousTaskId: id }, data: {
  lastCompletedAt: explicitCompletedAt } })` odpala się **tylko** przy jawnej edycji daty
  (`explicitCompletedAt !== undefined`); brak następcy/niecykliczne → no-op. Wewnętrzne
  `updateTask(id,{status:"DONE"})` z `completeRecurringTask` nie triggeruje sync (brak jawnej daty) i
  następca jeszcze nie istnieje — brak sprzężenia zwrotnego. `revalidatePath` bez zmian (C-20).
- **`completeRecurringTask`:** `previousTaskId: existing.id` dokładane obok istniejącego
  `lastCompletedAt: completedAt` — link + „ostatnie zrobienie" w jednym `create`.
- **UI:** `TaskDetail` — pole „Zrobione" `type="date"` wg wzoru „Start" (kolory ze zmiennych CSS,
  `flex-1 border rounded`), read-only „Ostatnio" tylko dla aktywnego cyklicznego; blok z Meta usunięty
  (przeniesiony, nie zdublowany). Usunięcie sortu kompletne (`grep sortBy` = 0 trafień), znacznik „✓" w
  `TaskRow` nietknięty. Teksty PL (C-32), brak hardcode kolorów (C-30).
- **Konwencje:** praca w `worldofmag/` (C-01), zero enumów (C-12), brak nowej `AIAction`
  (`check:actions` 159 — zielony), brak nowych zależności (C-53).
- **Bezpieczeństwo:** brak markdown/HTML/kluczy w diffie; brak nowej powierzchni ataku; guardy dostępu
  zachowane.

**Obserwacja (nieblokująca, poza zakresem):** snapshot Kosza w `deleteTask` nie zawiera
`previousTaskId` — po usunięciu+odtworzeniu poprzednika link następcy się nie odbuduje. Zgodne z
istniejącym wzorcem snapshotu (nie odtwarza też podzadań/komentarzy) i świadomie poza zakresem
(spec §5 — brak backfillu). Nie wymaga zmiany.

## Werdykt
**APPROVE.** Kod poprawny, minimalny i zgodny z konwencjami; wszystkie bramki zielone
(`check:migrations`/`check:actions`/`lint`/`build 130/130`); AC-1..AC-8 pokryte z dowodem. Migracja
addytywna i bezpieczna na produkcji. Domknięcie: merge do `develop` + automatyczna promocja
`develop → master` (C-52).
