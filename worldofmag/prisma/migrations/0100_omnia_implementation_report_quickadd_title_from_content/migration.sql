-- Raport implementacyjny: szybkie pole „Dodaj zadanie" (QuickAddTask) traktuje
-- wpisany tekst jako treść, a tytuł generuje na jego podstawie.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-07 (Quick-add: tytuł z treści)',
  'omnia-implementacja-2026-06-07-quickadd-tytul-z-tresci',
  $omnia_quickadd_title$# Omnia — Raport implementacji 2026-06-07

Sesja domyka lukę powiązaną z wcześniejszym zgłoszeniem („pojedynczy tekst →
treść zadania/notatki, tytuł generowany"). Tamta poprawka objęła tylko asystenta
AI; tu objęto **szybkie pole dodawania zadania nad listą** (`QuickAddTask`), które
omija asystenta i woła `createTask` bezpośrednio.

---

## Quick-add zadania wrzucał wpisany tekst do tytułu zamiast do opisu
**Diagnoza:** Pole „Dodaj zadanie…" nad listą zadań (`src/components/tasks/
QuickAddTask.tsx`) brało wpisany tekst i przekazywało go jako `title` do akcji
`createTask`, zostawiając `description` puste. Oczekiwane (spójnie z regułą
wdrożoną wcześniej dla asystenta): wpisany tekst ma trafić do **opisu**, a **tytuł**
ma powstać automatycznie na jego podstawie. To ten sam wymóg UX, ale w drugim,
niezależnym punkcie wejścia — asystent AI i tego pola nie obejmował.

**Rozwiązanie:** Zmiana po stronie komponentu i nowy lekki endpoint generujący
tytuł — bez ruszania samej akcji `createTask` (pozostaje uniwersalna, przyjmuje
gotowe `title`/`description`). `QuickAddTask.handleSubmit` traktuje teraz wpisany
tekst jako `description` i generuje zwięzły `title` przez nowy route
`/api/llm/tasks/title` (wzorowany 1:1 na istniejącym `/api/llm/notes/title`,
operacja `dispatch`, prompt po polsku „forma rzeczowa, kilka słów"). Dodano też
metodę `llm.tasks.suggestTitle` w typowanym kliencie LLM, dla spójności z resztą
wywołań. Świadome decyzje:
- **Fallback offline:** gdy LLM jest niedostępny/niez­konfigurowany, tytuł wylicza
  lokalny `deriveLocalTitle` (pierwszy wiersz przycięty do ~60 znaków na granicy
  słowa) — brak LLM nie blokuje dodania zadania.
- **Wyjątek dla krótkiego wpisu:** jednowierszowy tekst ≤50 znaków traktujemy jako
  sam tytuł (np. „kup mleko") — bez wołania LLM i bez dublowania treści w opisie.
  To odpowiednik wyjątku z reguły „TYTUŁ vs TREŚĆ" w prompcie agenta, dzięki czemu
  oba punkty wejścia (asystent i quick-add) zachowują się tak samo, a trywialne
  dodania pozostają natychmiastowe.

**Zmienione pliki:**
- `src/components/tasks/QuickAddTask.tsx` — wpisany tekst → `description`; tytuł generowany przez `/api/llm/tasks/title` z fallbackiem `deriveLocalTitle`; wyjątek dla krótkiego, jednowierszowego wpisu; zaktualizowany placeholder.
- `src/app/api/llm/tasks/title/route.ts` — nowy endpoint generujący zwięzły tytuł zadania z treści (op „dispatch").
- `src/lib/llm-client.ts` — `llm.tasks.suggestTitle(content)` w typowanym kliencie LLM.
- `prisma/migrations/0100_omnia_implementation_report_quickadd_title_from_content/migration.sql` — ten raport.

## Podsumowanie
Jedno zgłoszenie domykające wcześniejszą zmianę: ta sama reguła UX („tekst = treść,
tytuł generowany") została doprowadzona do drugiego punktu wejścia — szybkiego pola
dodawania zadania. Główny obszar zmian: moduł Zadania (komponent quick-add) plus
nowy endpoint LLM do generowania tytułu. Lekcja zapisana w `doświadczenia.md`:
regułę tworzenia rekordu trzeba wdrażać w każdym punkcie wejścia, nie tylko w
asystencie. Weryfikacja: `npm run build` (prisma generate + next build) przechodzi
bez błędów; piszący do produkcyjnej bazy krok `scripts/migrate.js` celowo nie był
uruchamiany lokalnie. Raport zapisany przez migrację → trafia do `/reports` na deployu.
$omnia_quickadd_title$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
