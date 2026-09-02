# Zadania: Poprawki zgłoszeń administratora — słówka bez limitu, zadanie w dialogu, weryfikacja skórek

- **Plan:** ./plan.md (121-zgloszenia-slowka-zadania-skorka)
- **Status:** todo
- **Data:** 2026-09-02

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. Odhaczamy `[ ]` → `[x]`
> w trakcie `/implement`. `[P]` = można zrównoleglić. Bez migracji i bez zmian RBAC/AI — fazy 0
> szablonu nie ma (plan §2: bez zmian w schemacie).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 1 — Zadania: modal zamiast inline widgetu (zgłoszenie 2)
- [x] **T-1** — `ModalDodaniaZadania.tsx`: opcjonalne propsy `pokazWyborProjektu` / `projekty` /
  `domyslnyProjektId` przekazywane do `FormularzZadania`; `onCreated` z drugim argumentem
  `projektId: string | null`. Gotowe, gdy: dotychczasowy konsument (`TasksPage.tsx:940`) kompiluje
  się bez zmian, a modal z `pokazWyborProjektu` renderuje select projektu.
- [x] **T-2** — `TasksHomePage.tsx`: przycisk **„Nowe zadanie"** w `headerAction` (akcent
  `var(--accent-green)` + `var(--on-accent)`, ikona `Plus`, etykieta przez `t()`), stan otwarcia
  modalu, `ModalDodaniaZadania` z wyborem projektu i domyślnym `ostatniProjektId` (walidacja jak
  w widgecie: nieistniejący → Skrzynka), po zapisie `router.push('/tasks/<projektId|all>?task=<id>')`;
  skróty `useKeyboardShortcuts({ onQuickAdd })` otwierają modal (`a`/`n`); **usunięcie** importu
  i mountu `SzybkieDodanieZadania`. Gotowe, gdy: na `/tasks` nie ma stałego formularza, przycisk
  i skrót otwierają modal, zapis prowadzi do szczegółów zadania.
- [x] **T-3** — Sprzątanie: kasacja pliku `SzybkieDodanieZadania.tsx`; `messages/pl.json` —
  −blok `modules.tasks.SzybkieDodanieZadania`, +klucz `modules.tasks.TasksHomePage.noweZadanie`;
  aktualizacja komentarza o konsumentach w `FormularzZadania.tsx` (i w nagłówku
  `ModalDodaniaZadania.tsx`, który nazywa widget „drugim konsumentem"). Gotowe, gdy:
  `grep -r SzybkieDodanieZadania src messages` = 0 trafień.

## Faza 2 — Języki: słówka bez limitu (zgłoszenie 1)
- [x] **T-4** `[P]` — Nowy `src/modules/languages/lib/ekstrakcjaSlowek.ts`: `podzielNaFragmenty`
  (granice akapit/zdanie/białe znaki, nigdy w środku słowa), `odzyskajSlowka` (parseJsonLoose +
  odzysk kompletnych, płaskich obiektów z uciętej tablicy), `scalSlowka` (dedupe po `term`
  case-insensitive, kolejność pierwszego wystąpienia). Gotowe, gdy: funkcje czyste (bez importów
  serwerowych), typy jawne.
- [x] **T-5** — Testy `src/modules/languages/lib/__tests__/ekstrakcjaSlowek.test.ts`:
  fragmentacja (krótki tekst = 1 fragment; długi dzieli na granicy słowa; sufit),
  odzysk z uciętej tablicy (ostatni niedomknięty obiekt odpada, kompletne zostają),
  dedupe >25 pozycji bez ucinania (dowód AC-1), markdown-płotki wokół JSON.
  Gotowe, gdy: `npm run test:unit -- ekstrakcjaSlowek` zielone i `tsc -p tsconfig.test.json` czyste.
- [x] **T-6** — Przebudowa `src/app/api/llm/languages/extract/route.ts` wg planu §3: bez `max` /
  `MAX_WORDS` / `slice(0, limit)` / „Maksymalnie N słówek"; `FRAGMENT_ZRODLA = 4000`,
  `MAKS_ZRODLO = 24_000` + `sourceTruncated`; pętla sekwencyjna po fragmentach,
  `maxTokens: 6000`; odczyt przez `odzyskajSlowka`; częściowa porażka fragmentu nie zbija
  operacji, całkowita → czytelny błąd (brak treści vs zły format); usage z wielu wywołań:
  `usageFromChat([...])` + `visibleUsage`. Gotowe, gdy: `tsc` czyste, w pliku nie ma żadnego
  limitu liczby słówek, importy usage obecne (bramka `check:cost-badge`).
- [x] **T-7** — Konsumenci: `llm-client.ts` (typ bez `max`, odpowiedź z `sourceTruncated?`),
  `DeckPage.tsx` (bez `max: 25`; nota `tekstPrzyciety` przez `t()` przy `sourceTruncated`),
  `LanguagesHomePage.tsx` (bez `max: 25`), `FilmSzczegol.tsx` (bez `max: 20`; slice źródła 12k
  zostaje). Gotowe, gdy: `grep -rn "max:" src | grep languages.extract` = 0 trafień; klucz
  `modules.languages.DeckPage.tekstPrzyciety` w `messages/pl.json`.

## Faza 3 — Bramki i domknięcie
- [x] **T-8** — Weryfikacja zgłoszenia 3 (AC-6, bez kodu): `npm run test:unit` obejmujące
  `skinGenerate.test.ts` zielone na tej gałęzi + potwierdzony ślad 119 w historii
  `develop`/`master` (zanotować hash w verify.md). Gdyby test wykazał lukę — wraca do
  implementacji (C-54), po aktualizacji planu.
- [x] **T-9** — Bramki lokalne: `npm run check:i18n`, `npm run check:cost-badge`,
  `npm run check:content-memory`, `npm run test:unit` (całość), `next lint` — zielone.
- [ ] **T-10** — `npm run build` do kroku `next build` włącznie (lokalny Postgres, C-13 — bez
  `migrate.js` na prod). Gotowe, gdy: build zielony.
- [ ] **T-11** — Mapowanie AC-1…AC-6 na wyniki (input do `/verify`); e2e zadań
  (`[scenario-tasks-add-quick]`, `[scenario-tasks-create-project]`) jeśli środowisko e2e
  osiągalne — inaczej odnotować w verify.md weryfikację statyczną.
- [ ] **T-12** — Wpis do `doświadczenia.md`, jeśli po drodze był nieoczywisty problem (C-51);
  commit + merge `claude/*` → `develop` wg STANDING AUTHORIZATION (robi to `/review`).

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadania |
|----|---------|
| AC-1 (wszystkie słówka, bez progu) | T-4, T-5, T-6, T-7 |
| AC-2 (pozostali konsumenci bez ukrytego limitu, bez regresji) | T-7 |
| AC-3 (strona modułu: przycisk zamiast formularza) | T-2, T-3 |
| AC-4 (dialog z wyborem projektu, przejście do szczegółów) | T-1, T-2 |
| AC-5 (zamknięcie bez zapisu, konwencje modalu) | T-1, T-2 (istniejący `Modal` 087) |
| AC-6 (skórki pokryte przez 119) | T-8 |

## Notatki / blokady
- Kolejność faz 1↔2 jest wymienna (niezależne moduły); fazę 1 robimy pierwszą, bo jest mniejsza.
- W sandboksie web brak klucza LLM — AC-1/AC-2 weryfikujemy testami jednostkowymi i przeglądem
  kodu; e2e wg runbooka `docs/e2e/uruchamianie-e2e-claude.md`, jeśli czas/środowisko pozwoli.
