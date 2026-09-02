# Verify: Poprawki zgłoszeń administratora — słówka bez limitu, zadanie w dialogu, weryfikacja skórek

- **Spec:** ./spec.md (121-zgloszenia-slowka-zadania-skorka)
- **Data:** 2026-09-02
- **Weryfikował:** Claude Code (spec-driven pipeline, etap 5)

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny: 0289)" — feature nie dodaje migracji |
| `npm run check:actions` | ✅ 168 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:i18n` | ✅ zero literałów w komponentach (13 w plikach ze świadomym wyjątkiem) |
| `npm run check:cost-badge` | ✅ 40 plików wołających model — wszystkie przekazują zużycie |
| `npm run check:content-memory` | ✅ 40 plików sklasyfikowanych (wpis trasy extract: on-demand, bez zmian) |
| `npm run check:e2e-waits` | ✅ (ponowione po edycji `tasks.spec.ts`) |
| `npx tsc --noEmit` + `tsc -p tsconfig.test.json` | ✅ czyste |
| `next lint --dir src` | ✅ 0 błędów/ostrzeżeń |
| `npm run test:unit` (lokalny Postgres) | ✅ 0 porażek (1182 pass; 1 wcześniejsza porażka `ownership.test.ts` była brakiem `DATABASE_URL`, z bazą przechodzi) |
| **pełny `npm run build`** (lokalny Postgres, C-13) | ✅ wszystkie bramki + `next build` + budżet wydajności zielone. Jedyna czerwień: końcowy `migrate.js` nie dostał `DIRECT_URL` w tle sandboksa — krok POZA definicją „gotowe" (C-50: „do CI/lokalu weryfikuj do kroku `next build`"), migracje na lokalnej bazie zaaplikowane wcześniej wprost (`prisma migrate deploy` ✅). Po buildzie zmieniły się wyłącznie `e2e/specs`, `doświadczenia.md` i artefakty specs/ — bramka pokrywająca `e2e/` (`check:e2e-waits`) ponowiona ✅ |
| e2e `tasks.spec.ts` (`scripts/e2e-web.sh`, prod build + `next start`) | ✅ **11 passed, 1 skipped** — pominięty wyłącznie `[scenario-tasks-ctrlk-palette]`, zastany i niezwiązany z 121 (pomijał się także przed zmianą) |

## Kryteria akceptacji

- **AC-1 — wszystkie słówka, bez progu: ✅**
  Dowody: (1) trasa `src/app/api/llm/languages/extract/route.ts` nie zawiera żadnego limitu liczby
  słówek — grep po `slice(0`/`Maksymalnie`/`MAX_WORDS` trafia tylko komentarze i świadome cięcie
  ŹRÓDŁA `MAKS_ZRODLO` (24k znaków) z jawnym `sourceTruncated`; prompt żąda „WSZYSTKIE przydatne
  słówka … bez limitu liczby"; (2) testy jednostkowe `ekstrakcjaSlowek.test.ts` 9/9, w tym wprost
  „60 pozycji wchodzi w całości" i dedupe bez ucinania; (3) fragmentacja 4000 znaków +
  `maxTokens: 6000` + odzysk kompletnych pozycji z uciętej tablicy — lista pokrywa cały tekst,
  a nie pierwszy budżet wyjścia. Żywego wywołania LLM w sandboksie nie ma jak wykonać (brak klucza)
  — weryfikacja statyczna + testy, zgodnie z notatką w `tasks.md`.
- **AC-2 — pozostali konsumenci bez ukrytego limitu, bez regresji: ✅**
  Grep: żadne wywołanie `llm.languages.extract` nie przekazuje `max` (typ wejścia w `llm-client.ts`
  już go nie ma — kompilator pilnuje na przyszłość). `FilmSzczegol` (YouTube): przepływ propozycji
  z checkboxami nietknięty, świadome cięcie źródła do 12k znaków zostaje (dokumentowana decyzja
  kosztowa 102, poniżej sufitu trasy). `LanguagesHomePage`: tworzenie talii z tekstem — bez `max`.
  `tsc` czyste = kontrakty zgodne.
- **AC-3 — strona modułu: przycisk zamiast stałego formularza: ✅**
  `SzybkieDodanieZadania.tsx` usunięty (grep po repo: 2 trafienia wyłącznie w komentarzach
  historycznych); `TasksHomePage` renderuje w `headerAction` przycisk „Nowe zadanie"
  (`var(--accent-green)` + `var(--on-accent)`) obok „Nowy projekt". Zrzut drzewa strony z biegu
  e2e potwierdza: brak `<section>` z formularzem, obecny przycisk. E2e `[scenario-tasks-create-project]` ✅.
- **AC-4 — dialog z wyborem projektu, przejście do szczegółów: ✅**
  `ModalDodaniaZadania` z `pokazWyborProjektu`/`projekty`/`domyslnyProjektId` (przekazywane do
  `FormularzZadania`, który wybór projektu ma od 105); domyślny = ostatnio używany projekt
  z walidacją istnienia (fallback Skrzynka — logika 1:1 z usuniętego widgetu); po zapisie
  `router.push('/tasks/<projektId|all>?task=<id>')`. E2e `[scenario-tasks-add-quick]` ✅ —
  tworzy zadanie przez modal (skrót `a`) i widzi je w widoku projektu.
- **AC-5 — zamknięcie bez zapisu, konwencje: ✅**
  Modal to współdzielony `components/ui/Modal` (087: arkusz dolny na telefonie
  z `safe-area-inset-bottom`, motyw ze zmiennych, `Esc`/zamknięcie przez Radix); `onClose` tylko
  gasi stan — zero skutków ubocznych. E2e `[scenario-tasks-add-empty-blocked]` ✅ (Enter na pustym
  nie tworzy zadania, URL zostaje na `/tasks`).
- **AC-6 — skórki pokryte przez 119: ✅**
  `skinGenerate.test.ts` na tej gałęzi: **fail 0** (tolerancyjny odczyt + ponowienie + komunikaty
  przyczynowe). Ślad wdrożenia: przebieg `119-skin-generate-format-fix` z werdyktem APPROVE,
  commit `18558f1` obecny w historii `origin/master` (i `develop`); `master` zawarty w `develop`
  na starcie tego przebiegu. Zero zmian w kodzie skórek w ramach 121 — zgodnie ze specem.

## Zgodność z konstytucją

- **C-01/C-02/C-36** ✅ — zmiany w `worldofmag/`, granice modułów zachowane; linter wymusił nawet
  import względny w teście modułu (poprawione); trasa API importuje helpery modułu wzorcem tras
  Kitchen. `check:boundaries`/`check:module-registry` zielone w pełnym buildzie.
- **C-10..C-14** ✅ n/d — zero zmian schematu; `check:migrations` zielone.
- **C-20..C-25** ✅ — bez nowych Server Actions/RBAC/AI; trasa extract nadal za sesją; guardy nietknięte.
- **C-30/C-31/C-32** ✅ — wyłącznie zmienne CSS (`--accent-green`, `--on-accent`, `--text-muted`);
  modal = istniejący wzorzec mobilny; nowe teksty przez `t()` (`noweZadanie`, `tekstPrzyciety`).
- **C-33/C-34** ✅ — `ModuleView` bez zmian struktury; żadnych natywnych potwierdzeń.
- **C-35** ✅ — `ModalDodaniaZadania` ma teraz dwóch realnych konsumentów.
- **C-51** ✅ — wpis w `doświadczenia.md` (klawisz przed nawodnieniem + `requireVisible` maskujący regresję).
- **C-53** ✅ — bez nowych zależności; jedyny nowy plik to czyste helpery z testami.

## Regresje

- **Widok projektu (`TasksPage`)** — dotychczasowe wywołanie `ModalDodaniaZadania` kompiluje się
  bez zmian (nowe propsy opcjonalne, `onCreated` dostaje dodatkowy argument, którego konsument nie
  czyta). E2e widoków i CRUD zadań zielone.
- **YouTube/Języki** — kontrakt `llm-client` zawężony (usunięte `max`), wszyscy konsumenci
  zaktualizowani; `tsc` czyste.
- **i18n** — usunięty blok `SzybkieDodanieZadania`, dodane 2 klucze; `check:i18n` weryfikuje,
  że każde `t()` się rozwiązuje — zielone.
- **Klikacze** — pełny `tasks.spec.ts` zielony (11/12, 1 zastany skip); pozostałe specy nie
  dotykają zmienionych powierzchni (grep po `SzybkieDodanie`/`languages.extract` w `e2e/` pusty).

## Werdykt końcowy: **GOTOWE**

Uwagi niewiążące: (1) żywe wywołanie LLM niesprawdzalne w sandboksie (brak klucza) — pokryte
testami warstwy odczytu i przeglądem promptu; (2) `[scenario-tasks-ctrlk-palette]` pomija się
z zastanego powodu (ten sam wyścig nawodnienia, poza zakresem 121) — kandydat na osobne, drobne
zgłoszenie.
