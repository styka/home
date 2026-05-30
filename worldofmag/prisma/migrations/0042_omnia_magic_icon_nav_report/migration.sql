-- Raport implementacji 2026-05-30 (nawigacja „magicznej ikony" asystenta AI)
-- → /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Uwaga: slug 'omnia-implementacja-2026-05-30' jest już zajęty przez migrację 0041,
-- dlatego ten raport ma własny, unikalny slug.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-30 (nawigacja magicznej ikony)',
  'omnia-magic-icon-nawigacja-2026-05-30',
  $omnia_nav_2026_05_30$# Omnia — Raport implementacji 2026-05-30

## Magiczna ikona — przekierowania na widoki Omni
**Diagnoza:** Asystent AI (magiczna ikona, `AICommandSheet`) umiał jedynie wykonać akcje zapisu
(krok `plan`) albo odpowiedzieć tekstem (krok `answer`). Brakowało trzeciej, naturalnej drogi: gdy
polecenie sprowadza się do „pokaż / otwórz / przejdź do …", a w aplikacji istnieje gotowy widok z
parametrami (np. zadania w trakcie), użytkownik powinien móc potwierdzić przekierowanie i zostać tam
przeniesiony. Podobnie po dodaniu np. zadania z dopiskiem „przejdź do niego" — powinno paść pytanie
o przejście do utworzonego elementu. Dopiero gdy prośba jest zbyt złożona dla gotowego widoku, dane
mają być odfiltrowane przez LLM i pokazane jako markdown.

**Rozwiązanie:** Dodano do protokołu agenta nowy krok `navigate` obok `query/clarify/answer/plan`.
Wybór drogi spoczywa na LLM wg jasnych reguł w prompcie: prośby o pokazanie listy odwzorowalnej
gotowym widokiem → `navigate`; pytania analityczne / filtrowanie spoza możliwości widoku → `answer`.
Obsłużono dwa scenariusze przejścia:

- *Czyste przekierowanie* (np. „pokaż zadania w trakcie" → `/tasks/all?status=IN_PROGRESS`): agent w
  razie potrzeby najpierw pobiera `id` przez `query`, a potem zwraca `navigate` z adresem i etykietą.
  Klient pokazuje potwierdzenie „Przejść do: …?" (przyciski **Przejdź / Zostań**) i robi `router.push`.
- *Utworzenie + przejście* („dodaj zadanie X i przejdź do niego"): akcja tworząca dostaje
  `params.openAfter`, a `execute` po zapisie zwraca cel przekierowania zbudowany z ID świeżo
  utworzonego rekordu (tylko serwer zna nowe ID). Po wykonaniu klient oferuje przycisk „Przejdź".

Powód takiego podziału: ID nowego rekordu istnieje dopiero po zapisie, więc deep-link do utworzonego
elementu musi powstać po stronie serwera w `execute`, a nie być zgadywany przez LLM. Wybór
navigate/answer/plan zostawiono modelowi, bo to on rozumie intencję („pokaż" vs „policz/odfiltruj"
vs „zmień").

Bezpieczeństwo: adres przekierowania pochodzi od LLM, więc jest traktowany jak nieufne wejście.
`sanitizeNavUrl()` dopuszcza wyłącznie ścieżki wewnętrzne (jeden wiodący `/`, bez `//` i URL-i
absolutnych) pasujące do whitelisty prefiksów (`/tasks`, `/shopping`, `/notes`, `/pets`) — to zamyka
furtkę open-redirect. Gdy URL jest niedozwolony, prosimy LLM o poprawkę, zamiast go zwracać. Aby
deep-linki faktycznie lądowały na właściwym widoku, `TasksPage` czyta teraz `?status=` (ustawia
filtr) i `?task=` (otwiera szczegóły), analogicznie do istniejących `?focus=`/`?pinned=` w Notatkach.

**Zmienione pliki:**
- `src/app/api/llm/home/agent/route.ts` — krok `navigate` w protokole + katalog dozwolonych adresów
  w prompcie; walidator `sanitizeNavUrl` (whitelista prefiksów); obsługa kroku z ponowną prośbą do
  LLM przy niedozwolonym URL; podpowiedź o `params.openAfter`.
- `src/app/api/llm/home/execute/route.ts` — `executeAction` zwraca `string | ExecOutcome`; akcje
  tworzące (`create_task`/`create_note`/`create_list`/`create_project`, `add_item`) z `openAfter`
  zwracają `navigateTo` + `navigateLabel`; pola dołączone do `ActionResult`.
- `src/components/home/AICommandSheet.tsx` — nowa faza `navigate` (ekran potwierdzenia „Przejdź /
  Zostań") oraz przyciski „Przejdź do…" w widoku wyników dla akcji z `navigateTo`.
- `src/components/tasks/TasksPage.tsx` — `initialFilter` / `initialOpenTaskId` ustawiane z URL.
- `src/app/tasks/[projectId]/page.tsx` — odczyt `searchParams` (`status`, `task`) i przekazanie do
  `TasksPage` (z walidacją statusu po `TASK_STATUS_FILTERS`).

## Podsumowanie
Sesja objęła jedno zgłoszenie z obszaru UX asystenta AI — domknięcie „magicznej ikony" o zdolność
nawigacji. Główne obszary zmian: warstwa agenta LLM (nowy krok protokołu + walidacja adresów),
warstwa wykonawcza (zwracanie celu przekierowania po utworzeniu rekordu) oraz UI (potwierdzenie
przejścia i deep-linki w module Zadań). Świadomie ograniczono się do minimum: brak nowych abstrakcji,
ponowne użycie istniejącego wzorca parametrów z Notatek, a wybór drogi (navigate / answer / plan)
pozostawiono LLM wg reguł w prompcie. Kluczowa uwaga utrzymaniowa: każdy URL od modelu walidujemy
whitelistą prefiksów (ochrona przed open-redirect), a deep-link działa tylko, gdy strona docelowa
czyta swoje parametry z query. Build (`next build`) przechodzi; lekcja dopisana do `doświadczenia.md`.
$omnia_nav_2026_05_30$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
