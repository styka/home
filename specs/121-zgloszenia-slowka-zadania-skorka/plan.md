# Plan techniczny: Poprawki zgłoszeń administratora — słówka bez limitu, zadanie w dialogu, weryfikacja skórek

- **Spec:** ./spec.md (121-zgloszenia-slowka-zadania-skorka)
- **Status:** draft
- **Data:** 2026-09-02

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście (2–4 zdania)

Dwie niezależne poprawki + jedna weryfikacja, każda najmniejszym możliwym ruchem po istniejących
wzorcach. **Słówka:** trasa `/api/llm/languages/extract` przestaje narzucać limit ilościowy —
zamiast jednego wywołania z „maksymalnie N słówek" dzieli tekst na fragmenty, zbiera słówka ze
WSZYSTKICH fragmentów i scala bez duplikatów (wzorzec tolerancyjnego czytania: `parseJsonLoose`
z `platform/llm/json`, lekcja 119 o uciętych odpowiedziach). **Zadania:** `ModalDodaniaZadania`
(118) zyskuje drugiego konsumenta — stronę modułu — przez dodanie opcjonalnych propsów wyboru
projektu, które `FormularzZadania` już ma (105); stały widget `SzybkieDodanieZadania` znika.
**Skórki:** zero kodu — weryfikacja pokrycia przez 119 (testy + ślad wdrożenia) w `/verify`.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Żadnej migracji (C-10..C-14 nie są uruchamiane; `check:migrations`
przejdzie bez nowych katalogów). C-12 bez zastosowania.

## 3. Warstwa serwera

Żadnych nowych Server Actions (C-20 bez nowych obowiązków — istniejące `bulkAddWords`,
`createTask` itd. pozostają nietknięte). Zmiana serwerowa to przebudowa istniejącej trasy API:

**`src/app/api/llm/languages/extract/route.ts`** (istniejąca, auth + `chatComplete` op
`generation` — C-40 bez zmian, model nadal z rezolwera):

- **Kontrakt wejścia:** znika pole `max` (żaden konsument nie będzie go już wysyłał; nieznane
  pola w body są ignorowane, więc stary klient z cache przeglądarki nie wywali trasy).
- **Fragmentacja źródła zamiast cichego `slice(0, 6000)`:**
  - `FRAGMENT_ZRODLA = 4000` znaków — tekst dzielony na granicach akapitów/zdań/białych znaków
    (nigdy w środku słowa);
  - `MAKS_ZRODLO = 24_000` znaków (6× dzisiejszy sufit) — powyżej tego trasa przetwarza pierwsze
    24 000 znaków i zwraca `sourceTruncated: true`, żeby UI mógł powiedzieć „tekst był dłuższy
    niż obsługiwany zakres" zamiast ucinać po cichu (spec Z-1);
- **Pętla po fragmentach (sekwencyjnie):** dla każdego fragmentu jedno `chatComplete` z
  promptem żądającym **wszystkich** wartych nauki słówek („Wypisz WSZYSTKIE przydatne słówka…
  Pomijaj słowa banalne…"), bez zdania „Maksymalnie N słówek"; `maxTokens: 6000` (fragment
  4000 znaków nie wyprodukuje realnie większej listy; dzisiejsze 2000 przy zniesionym limicie
  byłoby pierwszym miejscem ucięcia).
- **Tolerancyjny odczyt odpowiedzi:** `parseJsonLoose` zamiast gołego `JSON.parse`; dla
  odpowiedzi uciętej budżetem (`truncated` z transportu, 032) — odzysk KOMPLETNYCH obiektów
  słówek z niedomkniętej tablicy (obiekty są płaskie, więc odzysk to skan po zbalansowanych
  `{…}` z polami `term`/`translation`). Fragment, z którego nie da się nic odzyskać, nie
  zbija całej operacji, jeśli inne fragmenty coś dały; gdy wszystkie zawiodą — czytelny błąd
  (jak dziś 502, ale z komunikatem nazywającym przyczynę: brak treści vs zły format).
- **Scalanie:** deduplikacja po `term` (bez rozróżniania wielkości liter), kolejność pierwszego
  wystąpienia.
- **Licznik kosztu:** wiele wywołań → `usageFromChat(wywolania)` + `visibleUsage` zamiast
  `usageField` (który przyjmuje jedno); plik nadal importuje helpery z
  `platform/ai/costVisibility`/`usage`, więc `check:cost-badge` przechodzi bez zmian manifestu.
  Wpis `content-memory-coverage.json` (on-demand, klucz = ścieżka pliku) pozostaje aktualny.

**Czyste helpery poza plikiem trasy** (plik trasy nie może eksportować nic poza handlerami,
a chcemy testów jednostkowych): `src/modules/languages/lib/ekstrakcjaSlowek.ts` —
`podzielNaFragmenty(tekst, maksFragment)`, `odzyskajSlowka(surowaOdpowiedz)` (parseJsonLoose +
odzysk z ucięcia), `scalSlowka(listy)` (dedupe). Trasa importuje je przez `@/modules/languages/...`
— wzorzec istniejący (trasy `api/llm/kitchen/*` importują wnętrza modułu Kitchen; trasy w
`src/app/` nie podlegają regule granic modułów, która dotyczy `modules/**` i `platform/**`).

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: istniejące `module.languages` i `module.tasks`; trasa extract już wymaga sesji.
Żadnych wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

**Języki:**
- `src/lib/llm-client.ts` — `languages.extract`: z typu wejścia znika `max`, do typu odpowiedzi
  dochodzi `sourceTruncated?: boolean`.
- `src/modules/languages/ui/DeckPage.tsx` — usunięcie `max: 25`; gdy odpowiedź ma
  `sourceTruncated`, pokazujemy krótką informację (nowy klucz w `messages/pl.json`,
  `modules.languages.DeckPage.tekstPrzyciety` — „Tekst był dłuższy niż obsługiwany zakres —
  słówka przygotowano z jego początku."), stylowaną zmiennymi CSS (`var(--text-muted)`).
- `src/modules/languages/ui/LanguagesHomePage.tsx` — usunięcie `max: 25` (przepływ tworzy talię
  i od razu nawiguję do niej; informacji o przycięciu nie ma gdzie pokazać — świadome pominięcie,
  odnotowane tu zamiast rozbudowy przepływu, C-53).
- `src/modules/youtube/ui/FilmSzczegol.tsx` — usunięcie `max: 20` (AC-2: żadnych ukrytych
  limitów ilościowych); istniejące przycięcie ŹRÓDŁA do 12 000 znaków zostaje (świadoma,
  skomentowana w kodzie decyzja kosztowa z 102; mieści się poniżej `MAKS_ZRODLO`).

**Zadania (wzorzec 118 — drugi konsument modalu, C-35):**
- `src/modules/tasks/ui/ModalDodaniaZadania.tsx` — nowe OPCJONALNE propsy przekazywane wprost do
  `FormularzZadania` (który już je ma): `pokazWyborProjektu`, `projekty`, `domyslnyProjektId`;
  `onCreated` dostaje drugi argument `projektId: string | null` (dzisiejszy konsument w
  `TasksPage.tsx` go po prostu nie czyta — zgodne wstecz). `projectId` staje się potrzebny tylko
  bez wyboru projektu → prop `projectId` pozostaje wymagany, przy `pokazWyborProjektu` podajemy
  `"all"` (dokładnie jak robił to `SzybkieDodanieZadania`).
- `src/modules/tasks/ui/TasksHomePage.tsx` (już „use client"):
  - znika import i mount `SzybkieDodanieZadania`;
  - w `headerAction` obok „Nowy projekt" staje przycisk **„Nowe zadanie"** (akcent
    `var(--accent-green)` + `var(--on-accent)` — to główna akcja modułu; ikona `Plus`),
    otwierający `ModalDodaniaZadania` z `pokazWyborProjektu`, listą projektów i domyślnym
    projektem (`ostatniProjektId` z walidacją jak w usuwanym widgecie: skasowany/duplikowany id
    → Skrzynka);
  - po utworzeniu: `router.push("/tasks/" + (projektId ?? "all") + "?task=" + task.id)` —
    zachowanie 1:1 z dzisiejszym widgetem (AC-4);
  - skróty: `useKeyboardShortcuts({ onQuickAdd: () => setDodawanieZadania(true) })` — `a`/`n`
    otwierają modal (utrzymuje zielony e2e `[scenario-tasks-add-quick]`, który na `/tasks`
    naciska `a` i czeka na pole „Dodaj zadanie…");
  - etykieta przycisku przez `t()` (nowy klucz `modules.tasks.TasksHomePage.noweZadanie`);
    zastane hardkody tej strony („Nowy projekt" itd.) zostawiamy — bez refaktorów przy okazji
    (C-53; bramka i18n liczy literały z diakrytykami, „Nowe zadanie" i tak idzie przez `t()`
    zgodnie z C-32).
- `src/modules/tasks/ui/SzybkieDodanieZadania.tsx` — **usunięcie pliku**; z `messages/pl.json`
  znika blok `modules.tasks.SzybkieDodanieZadania`; komentarz w `FormularzZadania.tsx`
  wymieniający konsumentów — aktualizacja jednej linii.
- Modal (`components/ui/Modal`) już respektuje arkusz dolny + `safe-area-inset-bottom` (087)
  i motyw przez zmienne (C-30/C-31) — nic do roboty; `Esc` zamyka przez `Modal`/Radix (AC-5).

## 6. AI / integracje (C-23, C-40)

Nie dotyczy: żadnej nowej `AIAction`, read-toola, wpięcia w kalendarz/powiadomienia/trash.
`check:actions` i `check:ai-coverage` bez zmian manifestów (nie dodajemy Server Actions).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/modules/languages/lib/ekstrakcjaSlowek.ts` | nowy | czyste helpery: podział na fragmenty, tolerancyjny odczyt + odzysk z ucięcia, scalanie/dedupe |
| `worldofmag/src/modules/languages/lib/__tests__/ekstrakcjaSlowek.test.ts` | nowy | testy jednostkowe helperów (fragmentacja, ucięta tablica, dedupe) |
| `worldofmag/src/app/api/llm/languages/extract/route.ts` | edycja | zniesienie limitu, fragmentacja, tolerancyjny odczyt, `sourceTruncated`, suma kosztów |
| `worldofmag/src/lib/llm-client.ts` | edycja | typ wejścia bez `max`, odpowiedź z `sourceTruncated` |
| `worldofmag/src/modules/languages/ui/DeckPage.tsx` | edycja | bez `max: 25`; nota o przyciętym źródle |
| `worldofmag/src/modules/languages/ui/LanguagesHomePage.tsx` | edycja | bez `max: 25` |
| `worldofmag/src/modules/youtube/ui/FilmSzczegol.tsx` | edycja | bez `max: 20` |
| `worldofmag/src/modules/tasks/ui/ModalDodaniaZadania.tsx` | edycja | opcjonalny wybór projektu; `onCreated(task, projektId)` |
| `worldofmag/src/modules/tasks/ui/TasksHomePage.tsx` | edycja | przycisk „Nowe zadanie" + modal + skrót `a`/`n`; bez inline widgetu |
| `worldofmag/src/modules/tasks/ui/SzybkieDodanieZadania.tsx` | usunięcie | widget zastąpiony modalem |
| `worldofmag/src/modules/tasks/ui/FormularzZadania.tsx` | edycja | komentarz o konsumentach (1 linia) |
| `worldofmag/messages/pl.json` | edycja | +`modules.tasks.TasksHomePage.noweZadanie`, +`modules.languages.DeckPage.tekstPrzyciety`, −blok `SzybkieDodanieZadania` |
| `doświadczenia.md` | edycja | wpis C-51, jeśli w trakcie wyjdzie nieoczywisty problem |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: `cd worldofmag`; lokalny Postgres 16 (`pg_ctlcluster 16 main start`, `.env.local` +
  eksport zmiennych do powłoki) — **nigdy prod DB** (C-13). Weryfikacja do kroku `next build`
  (bez `migrate.js`).
- Bramki, które ta zmiana realnie dotyka: `check:i18n` (nowe klucze + skasowany blok — bramka
  wymaga, by każde `t("…")` się rozwiązywało), `check:cost-badge` (trasa nadal importuje
  helpery usage), `check:content-memory` (wpis bez zmian), `tsc -p tsconfig.test.json` (nowy
  test), `next lint`, `next build`, `npm run test:unit` (nowe testy helperów + istniejące
  `skinGenerate.test.ts` jako dowód do AC-6).
- Mapowanie AC → weryfikacja:
  - **AC-1** — test jednostkowy: `scalSlowka`/`odzyskajSlowka` na wejściu z >25 pozycjami nic
    nie ucina; przegląd kodu trasy: brak `slice` po liczbie słówek i brak „Maksymalnie N" w
    prompcie; smoke w przeglądarce, jeśli będzie osiągalny (LLM wymaga klucza — w sandboksie
    weryfikacja statyczna + testy).
  - **AC-2** — grep po repo: żadnego `max:` w wywołaniach `languages.extract`; przegląd
    `FilmSzczegol` (propozycje + checkboxy bez zmian).
  - **AC-3/AC-4** — e2e `tasks.spec.ts` (`[scenario-tasks-add-quick]`, `[scenario-tasks-create-project]`)
    + przegląd: `/tasks` bez `<section>` z formularzem; przycisk w `headerAction`; `router.push`
    do szczegółów po zapisie.
  - **AC-5** — `Modal` (istniejący, 087) + przegląd propsów; `Esc` obsługuje Radix.
  - **AC-6** — `npm run test:unit` obejmuje `skinGenerate.test.ts` (zielony = pokrycie 119);
    ślad: commit 119 w historii `develop`/`master` (potwierdzone na etapie speca).

## 9. Ryzyka techniczne i plan wycofania

- **Długi tekst → wiele wywołań LLM (koszt/czas)** → sufit `MAKS_ZRODLO` (24k znaków ≈ 6
  fragmentów) + `sourceTruncated` z notą w UI; wywołania sekwencyjne (bez równoległego młócenia
  TPM); budżety AI (082) i tak pilnują miesięcznego sufitu w `chatComplete`.
- **Ucięta odpowiedź fragmentu** → mniejszy fragment (4000 znaków) + `maxTokens: 6000` +
  odzysk kompletnych obiektów; test jednostkowy na uciętej tablicy.
- **Regresja e2e zadań** → skrót `a`/`n` wpięty na stronie modułu; placeholder pola pozostaje
  ten sam (`FormularzZadania`), więc selektory e2e działają.
- **Rollback:** zero migracji → czysty revert commitów (kod vs migracja z runbooka: tu tylko kod).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 (migracje) — bez zmian schematu, jawnie stwierdzone (pkt 2)
- [x] C-20..C-25 — bez nowych akcji/RBAC/AI; trasa z sesją jak dotąd; guardy nietknięte
- [x] C-30..C-32 — zmienne CSS + `var(--on-accent)`; modal = arkusz dolny z safe-area (087);
      nowe teksty przez `t()` do `messages/pl.json`
- [x] C-33/C-34 — `ModuleView` bez zmian struktury (nadal `state`); żadnych `window.confirm`
- [x] C-35 — modal zadania dostaje realnego drugiego konsumenta zamiast nowego bytu
- [x] C-36 — zmiany w granicach modułów Languages/Tasks/YouTube; trasa API importuje helpery
      modułu wzorcem tras Kitchen; zero importów cudzych wnętrz między modułami
- [x] C-53 — minimalizm: bez nowych zależności, bez refaktorów przy okazji; świadomie sprawdzone
- [x] C-54 — spec skorygowany (AC-1: los listy = zachowanie zastane) przed pisaniem planu
