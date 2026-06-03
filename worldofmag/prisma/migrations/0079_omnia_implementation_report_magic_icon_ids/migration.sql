-- Raport implementacji: magiczna ikona — surowe id w parametrach akcji — 2026-06-03.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Slug zdezambiguowany (istnieje już 'omnia-implementacja-2026-06-03' z migracji 0076).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03 (magiczna ikona — parametry akcji)',
  'omnia-implementacja-magiczna-ikona-2026-06-03',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-03

## Magiczna ikona pokazywała surowe `id` w parametrach akcji

**Diagnoza:** Zgłoszenie pochodziło sprzed przebudowy „magicznej ikony": dodanie produktu do
listy zakupów pokazywało akcję z parametrem `id`, który nic nie mówi użytkownikowi. Wymaganie:
nie używać `id` w akcjach prezentowanych użytkownikowi, lecz nazw (np. nazwa listy), a `id`
rozwiązywać po nazwie na backendzie — i tak dla **wszystkich** akcji. Opis zgłoszenia prosił o
**weryfikację, czy sytuacja może się jeszcze wydarzyć w obecnej implementacji**.

Weryfikacja wykazała dwa tryby:

- **Tryb prosty** (`/api/llm/home/interpret` → `/api/llm/home/execute`) — **czysty**. Prompt
  emituje wyłącznie nazwy (`listName`, `projectName`, `vehicleName`, `elementName`, …) oraz
  `searchQuery`; backendowe resolvery (`resolveListId`, `resolveItemId`, `resolveTaskId`,
  `resolveNoteId`, `resolveOrCreateList`) zamieniają nazwę/`searchQuery` na `id`. Użytkownik
  nigdy nie widzi `id`.
- **Tryb agenta** (`/api/llm/home/agent`) — **mógł odtworzyć błąd**. `ACTION_CATALOG` jawnie
  instruował model: „CELUJ w konkretne rekordy przez id z wyników (taskId/itemId/noteId/listId)".
  Po kroku `query` agent wstawiał do `params` surowe cuid (np. `taskId`), które trafiały do
  `ActionDrawer` i były pokazywane użytkownikowi (jako pole read-only) — dokładnie ten
  nieczytelny `id`, na który skarżył się użytkownik.

**Rozwiązanie:** Naprawa na najwęższej warstwie (prezentacja + prompt), **bez ruszania
zweryfikowanej logiki dostępu** na backendzie. Backendowe resolvery są celowo „id-first z
fallbackiem po nazwie" i są opatrzone uwagą bezpieczeństwa: `id` z klienta nigdy nie jest ufane,
a Server Action asertuje własność (`assert*Access`). Usuwanie tej ścieżki byłoby ryzykowne i
zmniejszyłoby precyzję namiaru w operacjach zbiorczych (np. „oznacz wszystkie zadania o remoncie
jako zrobione"), gdzie agent celuje w konkretny rekord, nie w dopasowanie po nazwie. Dlatego:

1. `ActionDrawer` **w ogóle nie renderuje** parametrów `*Id` — i tak przechodzą dalej do
   backendu dla precyzyjnego namiaru, więc niczego nie tracimy, a użytkownik nie widzi technicznego
   śmiecia. Zniknęła też martwa po tej zmianie obsługa „read-only `id`".
2. Prompt agenta wymaga teraz, by dla **każdej** akcji celującej w istniejący rekord ZAWSZE
   wypełnić czytelny `searchQuery` (nazwa/tytuł rekordu) obok opcjonalnego `id`. To `searchQuery`
   (pokazywane na bursztynowo w panelu) jest tym, co widzi i recenzuje użytkownik; `description`
   nadal po ludzku nazywa cel akcji.

Efekt: precyzja namiaru zachowana (backend nadal używa `id`, gdy go ma), a użytkownik widzi
wyłącznie czytelne nazwy — spójnie z trybem prostym.

**Zmienione pliki:**
- `src/components/home/ActionDrawer.tsx` — edytor parametrów pomija klucze `*Id`
  (`filter(([key]) => !ID_KEY.test(key))`); usunięto obsługę read-only `id` (zbędną po ukryciu);
  komentarz wyjaśnia, że `id` i tak trafia do backendu.
- `src/app/api/llm/home/agent/route.ts` — `ACTION_CATALOG`: `id` opisane jako opcjonalny,
  niepokazywany namiar; wymóg ZAWSZE ustawiać czytelny `searchQuery` dla akcji celujących w
  istniejący rekord. Przykład planu w prompt systemowym uzupełniony o `searchQuery`.

## Podsumowanie

Sesja obejmowała **1 zadanie** (UX/poprawność „magicznej ikony"). Kluczowa decyzja: zgłoszenie
zweryfikowano na żywym kodzie po przebudowie — okazało się, że tryb prosty jest już czysty, a
problem przewędrował do trybu agenta. Naprawiono go na warstwie prezentacji (`ActionDrawer`) i w
prompcie agenta, **bez zmian w zweryfikowanej pod kątem bezpieczeństwa** warstwie rozwiązywania
rekordów. Główne obszary zmian: komponent przeglądu akcji oraz katalog/przykład akcji agenta.
`npm run build` (prisma generate + next build) przechodzi bez błędów.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
