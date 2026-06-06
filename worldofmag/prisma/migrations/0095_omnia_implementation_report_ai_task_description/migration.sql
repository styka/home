-- Raport implementacyjny: opis zadania tworzonego przez AI = wierne przepisanie.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-06',
  'omnia-implementacja-2026-06-06-ai-opis-zadania',
  $omnia_ai_task_desc$# Omnia — Raport implementacji 2026-06-06

Sesja realizuje jedno zgłoszenie dotyczące asystenta AI: gdy zadanie jest tworzone
przez asystenta (krok „plan" → panel `ActionDrawer` → akcja `create_task`), w polu
**opisu** zadania ma się znaleźć **dokładnie to, co użytkownik podał jako treść
zadania** — jedynie lekko zredagowane (forma bezosobowa, poprawniejsza gramatyka),
bez streszczania, zmiany znaczenia ani pomijania jakichkolwiek faktów.

---

## Błąd: AI tworzące zadanie ma w opisie wiernie zapisać podaną treść (bez streszczania)

**Diagnoza:** Przy tworzeniu zadania przez asystenta pole `description` nowego zadania
bywało puste albo **streszczone** — model gubił fakty, liczby i szczegóły z oryginalnej
wypowiedzi użytkownika. Oczekiwane zachowanie: opis ma zawierać wiernie przepisaną treść
polecenia, dozwolona jest wyłącznie **lekka redakcja** (zamiana na formę bezosobową/
rzeczową i poprawa gramatyki/interpunkcji), bez skracania i bez zmiany znaczenia.

Analiza ścieżki wykonania pokazała, że to **nie jest problem kodu, tylko promptu**:
wartość `params.description` z akcji AI trafia **1:1** do `Task.description` w executorze
(`src/app/api/llm/home/execute/route.ts`, gałąź `create_task` — `description:
asStr(params.description) ?? null`), bez żadnej dodatkowej transformacji. To znaczy, że o
tym, *co* znajdzie się w opisie, decyduje wyłącznie model wypełniający akcję `create_task`
w kroku „plan". W katalogu akcji modułu `tasks` (system prompt agenta) `create_task` było
opisane jako `{ title, description?, ... }` bez żadnej wskazówki, jak zredagować opis —
model domyślnie streszczał.

**Rozwiązanie:** Naprawa wyłącznie w prompcie agenta, bez zmian w kodzie wykonawczym
(executor już przepuszcza opis wiernie). W definicji `create_task` w katalogu akcji
modułu `tasks` (`buildActionCatalog` w `agent/route.ts`) dodano jednoznaczną regułę
redakcji opisu: `description` = **wierne przepisanie** treści polecenia; wolno jedynie
zamienić na formę bezosobową/rzeczową i poprawić gramatykę/interpunkcję; **zakaz**
streszczania, skracania, zmiany znaczenia oraz pomijania jakichkolwiek faktów, liczb,
nazw i szczegółów. Doprecyzowano też rozdział ról pól: `title` = krótka etykieta (kilka
słów), `description` = pełna treść po lekkiej redakcji. Pominięcie `description` jest
dopuszczone tylko wtedy, gdy użytkownik podał sam krótki tytuł bez dodatkowej treści.

Rozwiązanie po stronie promptu jest właściwe i minimalne, bo: (1) executor i Server
Action `createTask` nie ruszają treści opisu, więc kod nie wymaga zmian; (2) reguła
działa dla każdego modelu DB-routowanego przez `/admin/llm` (operacja `reasoning`),
niezależnie od dostawcy; (3) nie wprowadza nowych pól ani migracji schematu.

**Zmienione pliki:**
- `src/app/api/llm/home/agent/route.ts` — w sekcji katalogu akcji `tasks` dodano przy
  `create_task` regułę wiernego przepisania treści do `description` (lekka redakcja:
  forma bezosobowa + gramatyka; zakaz streszczania/pomijania faktów; rozdział
  `title` vs `description`).
- `src/generated/admin-docs.ts` — przebudowany artefakt dokumentacji (`copy-docs`) po
  dopisaniu lekcji do `doświadczenia.md`.
- `doświadczenia.md` — wpis „Opis zadania tworzonego przez AI: wierne przepisanie
  zamiast streszczenia".
- `prisma/migrations/0095_omnia_implementation_report_ai_task_description/migration.sql`
  — ten raport (idempotentny seed do działu Raporty).

---

## Podsumowanie

Sesja obejmuje **1 zadanie** — poprawkę zachowania asystenta AI przy tworzeniu zadań.
Główny obszar zmian to **prompt agenta** (`agent/route.ts`): doprecyzowano semantykę pola
`description` akcji `create_task`, tak by opis zawierał wiernie przepisaną treść
polecenia (forma bezosobowa + poprawiona gramatyka) zamiast streszczenia, bez pomijania
faktów. Kluczowa obserwacja diagnostyczna: skoro executor (`execute/route.ts`) przekazuje
`params.description` bez modyfikacji prosto do `Task.description`, naprawa należała w
całości do warstwy promptu — nie do kodu wykonawczego. `npm run build` (`next build`)
przechodzi. Lekcja dopisana do `doświadczenia.md`.
$omnia_ai_task_desc$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
