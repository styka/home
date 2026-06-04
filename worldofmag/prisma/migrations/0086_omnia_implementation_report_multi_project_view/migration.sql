-- Raport implementacyjny: widok zadań z wielu projektów naraz (/tasks/multi).
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-04 (widok wielu projektów)',
  'omnia-implementacja-2026-06-04-multi-project-view',
  $omnia_multi_project$# Omnia — Raport implementacji 2026-06-04

Sesja realizująca 1 zgłoszenie: dodanie możliwości oglądania zadań z kilku projektów
jednocześnie w module Zadania. Zmiana po stronie kodu (nowa server action + wirtualny
widok + tryb zaznaczania w bocznym panelu) — bez zmian schematu danych.

---

## Dodać możliwość widoku zadań dla kilku Projektów naraz
**Diagnoza:** Moduł Zadania pozwalał oglądać zadania tylko w obrębie jednego projektu
(`/tasks/[projectId]`) albo we wszystkich naraz przez widoki wirtualne „Dziś / Nadchodzące
/ Zaległe / Wszystkie". Brakowało pośredniego trybu: „pokaż mi zadania z TYCH kilku
wybranych projektów" — np. żeby zestawić obok siebie 2–3 powiązane projekty bez szumu
z całej reszty.

**Rozwiązanie:** Poszedłem najmniej inwazyjną ścieżką, dopasowaną do istniejącego wzorca
widoków wirtualnych. Zamiast nowej trasy i nowego komponentu dodałem kolejny widok
wirtualny `multi` obsługiwany przez tę samą trasę `/tasks/[projectId]`, sterowany
parametrem zapytania `?projects=id1,id2,…`. Dzięki temu cała mechanika strony (filtry
statusów, wyszukiwarka AI, panel szczegółów, powiadomienia, przełącznik grupowania)
działa bez zmian. Grupowanie wyników po projekcie wprost wykorzystuje gotową logikę
widoku „Wszystkie" w `TaskList` — `multi` po prostu wchodzi w tę samą gałąź renderowania.

Nowa server action `getTasksForProjects` sprawdza dostęp do **każdego** projektu osobno
(`assertProjectAccess`) i po cichu pomija id niedostępne/nieistniejące — pojedynczy „martwy"
identyfikator w linku nie wywala wtedy całego widoku. Trasa dodatkowo waliduje żądane id
względem projektów użytkownika, zanim trafią do akcji.

UX wyboru projektów osadziłem w bocznym panelu Zadań (`TasksSideNav`): przycisk
„Wiele projektów" włącza tryb zaznaczania, w którym wiersze projektów (i Skrzynka) zamieniają
się w pozycje z checkboxem; przycisk „Pokaż wybrane (N)" nawiguje do
`/tasks/multi?projects=…` i wychodzi z trybu zaznaczania. Tryb dotyczy tylko realnych
projektów, więc konfiguracja statusów i akcje projektu pozostają wyłączone (widok jest
wirtualny), a szybkie dodawanie zadania trafia — jak w innych widokach wirtualnych — do Skrzynki.

**Zmienione pliki:**
- `src/actions/tasks.ts` — nowa akcja `getTasksForProjects(projectIds)`: per-projekt kontrola dostępu, pomija niedostępne id, zwraca zadania wierzchołkowe z wielu projektów.
- `src/app/tasks/[projectId]/page.tsx` — obsługa `projectId === "multi"`: czyta/waliduje `?projects=`, ustawia `viewMode="multi"` i tytuł „🗂 Wiele projektów (N)"; `multi` dodane do listy widoków wirtualnych i etykiet.
- `src/components/tasks/TaskList.tsx` — `multi` grupuje po projekcie (ta sama gałąź co „Wszystkie") + etykieta pustego stanu.
- `src/components/tasks/TasksPage.tsx` — `multi` zaliczone do widoków wirtualnych (dodawanie do Skrzynki) i do przełącznika grupowania; opcja „Wiele projektów" w mobilnym selektorze gdy widok aktywny.
- `src/components/tasks/TasksSideNav.tsx` — tryb zaznaczania wielu projektów: checkboxy przy projektach i Skrzynce, przycisk „Pokaż wybrane (N)", nawigacja do `/tasks/multi`.
- `src/types/index.ts` — `ViewMode` rozszerzony o `"multi"`.

## Podsumowanie
Jedno zgłoszenie, zmiana wyłącznie po stronie kodu (bez migracji schematu danych; ta
migracja niesie sam raport). Główny obszar: moduł Zadania — nowy wirtualny widok i tryb
zaznaczania w nawigacji. Świadomie ponownie użyłem istniejącej mechaniki widoków
wirtualnych i grupowania po projekcie zamiast budować osobną trasę/komponent, żeby nie
duplikować logiki filtrów, wyszukiwania i panelu szczegółów. Weryfikacja:
`node scripts/check-action-coverage.js` (czysto) oraz `next build` — kompilacja i type-check
bez błędów (błędy `UntrustedHost` przy prerenderze są nieszkodliwe). Raport zapisany przez
migrację (jak pozostałe w projekcie) → trafia do `/reports` na deployu.
$omnia_multi_project$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
