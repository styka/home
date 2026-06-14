-- 0178: raport implementacyjny zadań 2–7 (moduł Zadań + asystent AI).
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Raport implementacji: zadania 2–7 (2026-06-13)',
  'omnia-implementacja-zadania-2-7-2026-06-13',
  $zad27$# Omnia — Raport implementacji: zadania 2–7 (2026-06-13)

> Kontynuacja sesji po Task 1 (Dysk Google). Tu domknięte **pozostałe 6 zadań** dotyczących
> modułu Zadań i asystenta AI („magiczna ikona"). Wszystkie 7 zgłoszeń są więc zrealizowane.

## Task 4 — Bug: czarne menu po „Jak używać" w Mapach sklepów
**Diagnoza:** `src/app/shopping/stores/guide/page.tsx` miał `export const dynamic = "force-static"`
(jedyna taka strona). Prerender bez sesji → `ModuleSidebar` renderował się z pustymi uprawnieniami,
stąd widoczne tylko pozycje bez wymogu permission i „czarny" wygląd.
**Rozwiązanie:** usunięto `force-static` — strona jest teraz dynamiczna jak reszta aplikacji
(treść i tak była statyczna, nic nie tracimy). Build potwierdza: trasa zmieniła się ze `○ (Static)`
na `ƒ (Dynamic)`.
**Pliki:** `src/app/shopping/stores/guide/page.tsx`.

## Task 7 — Cykliczność „konkretny dzień miesiąca"
**Diagnoza:** `RecurringRule.dayOfMonth` istniał w typach, ale był ignorowany przez `computeNextDue`
i nie miał kontrolki w UI.
**Rozwiązanie:** `computeNextDue` dla `MONTHLY` z `dayOfMonth` ustawia dzień na zadaną wartość
z klamrowaniem do długości miesiąca (31→luty=28/29); dzień ustawiany jest na 1 PRZED przesunięciem
miesięcy, by wysoki dzień bazowy nie „przeskakiwał" miesiąca. Zweryfikowane: Jan20+1m/dom15→15.02,
Jan31+1m/dom31→28.02, Nov25+2m/dom10→10.01 (rok+1). W edytorze cykliczności doszło pole
„Dzień miesiąca" (1–31, opcjonalne) widoczne dla trybu miesięcznego.
**Pliki:** `src/lib/recurrence.ts`, `src/components/tasks/TaskDetail.tsx`.

## Task 5 — Oznaczanie cyklicznego „zrobione" z odstępstwem
**Diagnoza:** `completeRecurringTask` liczył następne wystąpienie sztywno wg `rule.anchor`; brak
jednorazowego odstępstwa ani wskazania konkretnej daty.
**Rozwiązanie:** `completeRecurringTask(id, opts?)` przyjmuje `anchor` (nadpisanie trybu tylko dla
tego wykonania — reguła w nowym zadaniu bez zmian), `completionDate` (data wykonania → `completedAt`
i baza dla trybu COMPLETION) oraz `nextDueOverride` (konkretny termin następnego, z pominięciem
wyliczenia). Wywołanie bez opcji = identyczne jak dotąd (zero regresji dla one-click w `TaskRow`
i `toggleTaskStatus`). W `TaskDetail` doszło „Zrobione z odstępstwem": *od terminu* / *od dziś* /
*następne w konkretnej dacie* (date picker).
**Pliki:** `src/actions/tasks.ts`, `src/components/tasks/TaskDetail.tsx`.

## Task 6 — Sortowanie po dacie wykonania
**Diagnoza:** `completedAt` było w modelu i DTO, ale nieużywane do sortowania.
**Rozwiązanie:** przełącznik w nagłówku listy (`CalendarCheck`, persist `localStorage` `tasks.sortBy`).
Gdy aktywny, sekcja „Zrobione/Anulowane" sortuje się malejąco po `completedAt` (najnowsze wykonania
na górze) — pod przegląd „co zrobiłem kiedy". Komparator centralnie w `CompletedSection`.
**Pliki:** `src/components/tasks/TasksPage.tsx`, `TaskList.tsx`, `CompletedSection.tsx`.

## Task 2 — Bulkowe dodawanie zadań (tekst / CSV / JSON / zdjęcia)
**Diagnoza:** `/api/llm/tasks/parse` zwracało już tablicę, ale prompt był prosty; magiczna ikona
parsowała załącznik-zdjęcie wyłącznie do magazynu/zakupów; brak wczytywania plików w widoku zadań.
**Rozwiązanie:** prompt parsera rozumie luźny tekst, listy, CSV (z/bez nagłówków), JSON i „rozjechane"
dane, samodzielnie mapując pola (synonimy PL/EN) na `title/description/priority/dueDate/estimatedMins/
tags/recurring`. Dodano wariant **wizyjny** (dwuetapowo: transkrypcja OCR → strukturyzacja), wzorem
`kitchen/ocr-image`. W widoku zadań `AITaskInput` zyskał przycisk **Załącznik** (zdjęcie → vision;
`.csv/.json/.txt/.md` → wczytanie treści) obok wklejania i dyktowania. W magicznej ikonie `sendImage`
routuje zdjęcie do zadań, gdy kontekst/podpis na to wskazują (`create_task` do przeglądu w
`ActionDrawer`); prompt agenta zachęca do rozbijania wklejonych list na wiele `create_task`.
**Pliki:** `src/app/api/llm/tasks/parse/route.ts`, `src/components/tasks/AITaskInput.tsx`,
`src/components/home/AICommandSheet.tsx`, `src/app/api/llm/home/agent/route.ts`.

## Task 3 — Asystent: wyszukiwanie zawsze ignoruje wielkość liter
**Diagnoza/Rozwiązanie:** audyt ścieżek asystenta (`home/execute`, `home/agent`, `lib/ai/agentTools`,
`home/interpret`) wykazał, że **wszystkie** zapytania `contains` już używają `mode:"insensitive"`,
a jedyne porównanie in-memory lowercase'uje obie strony; `interpret` nie robi wyszukiwań po nazwach.
Wymóg był więc już spełniony — nie trzeba było zmian w istniejącym kodzie; nowy kod z Task 2 również
trzyma tę zasadę. (Na SQLite `mode:"insensitive"` to no-op, ale prod = Postgres, więc działa.)

## Podsumowanie
6 zadań (2–7) zrealizowanych w jednej sesji; wraz z Task 1 (Dysk Google) **wszystkie 7 zgłoszeń
gotowych**. Główne obszary: moduł Zadań (cykliczność: dzień miesiąca + odstępstwo przy zamykaniu;
sortowanie po dacie wykonania; bulk import z wielu formatów), asystent AI (parsowanie załączników na
zadania) oraz naprawa buga menu w Mapach sklepów. `next build` przechodzi; logika dnia miesiąca
zweryfikowana testowo.
$zad27$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
