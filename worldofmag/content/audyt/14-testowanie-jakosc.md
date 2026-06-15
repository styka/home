# Rozdział 14 — Testowanie i jakość

> Ten rozdział pyta nie „czy aplikacja działa” (działa — widać to klikając), lecz **„skąd wiemy, że
> nadal działa po następnej zmianie?”**. Przy ~130 modelach, ~57 plikach akcji i jednym, bardzo
> szybkim twórcy to pytanie o **bezpieczeństwo tempa**, a nie o biurokrację.

## Kontekst / stan z kodu

Warstwa testów w Omnii jest **realna, ale wczesna i niejednorodna**. Składa się z trzech filarów o
bardzo różnej dojrzałości: testów jednostkowych (kilka czystych funkcji), testów E2E (Playwright,
bogaty szkielet) oraz „strażników buildu” pełniących rolę testów statycznych. Czwartym, pośrednim
filarem jest moduł QA jako **repozytorium scenariuszy**.

### Filar 1 — testy jednostkowe (42 testy, 7 plików)

Runner to natywny `node:test` odpalany przez `tsx`:

```jsonc
// package.json
"test:unit": "node --import tsx --test \"src/**/*.test.ts\""
```

Wszystkie testy żyją w jednym katalogu `src/lib/__tests__/`:

| Plik | Testów | Co pokrywa |
|---|:---:|---|
| `srs.test.ts` | 5 | SuperMemo-2 (`reviewCard`): interwały 1/6 dni, ease, lapsy |
| `recurrence.test.ts` | 7 | `computeNextDue` (DAILY/WEEKLY/MONTHLY), `parseRecurringRule` |
| `serviceSlots.test.ts` | 7 | generowanie slotów, kolizje z rezerwacją, „dziś” odcina przeszłość |
| `petEnvironment.test.ts` | 8 | `classifyValue` (ok/warn/danger), progi ±15%/±0.85 |
| `parseQuantity.test.ts` | 6 | parser „2 butelki mleka”, „mleko 500ml”, „mleko x2” |
| `wikilinks.test.ts` | 5 | `extractWikilinks`, `resolveByTitle`, backlinki |
| `serviceGeo.test.ts` | 4 | `haversineKm` (Warszawa↔Kraków ±15), `formatDistance` |
| **Razem** | **42** | **7 czystych funkcji domenowych** |

Testy są **dobre jakościowo**: nazwane po polsku, czytają intencję, sprawdzają przypadki brzegowe
(null, dzień bez slotów, kolizja rezerwacji), nie tylko „ścieżkę szczęśliwą”. To nie są atrapy
dorzucone dla statystyki — to świadomie wybrane **rdzenie algorytmiczne**.

**Klucz do zrozumienia luki**: wszystkie 7 modułów łączy jedna cecha — są **czyste** (deterministyczne,
bez I/O). Importują wyłącznie typy (`import type { RecurringRule } from "@/types"` w `recurrence.ts`,
`import type { ParsedItem } from "@/types"` w `parseQuantity.ts`), a `import type` znika przy
transpilacji `tsx`. Żaden tested moduł nie ma **runtime'owego** importu z aliasem `@/`.

### Bariera `@/` w `tsx --test` (to nie przypadek, że testy są „płytkie”)

Runner `tsx --test` **nie rozwiązuje aliasu `@/`** z `tsconfig.json`. Każdy moduł, który importuje w
runtime cokolwiek przez `@/` (np. `@/lib/prisma`, `@/lib/server-utils`), wysypie się przy próbie
zaimportowania w teście. Przykłady z kodu:

- `src/lib/ownership.ts` → `import { getUserTeamIds, requireAuth } from "@/lib/server-utils"`
- `src/lib/portfel/currency.ts` → `import { prisma } from "@/lib/prisma"`
- każda akcja w `src/actions/*` (np. `teams.ts`) → `import { prisma } from "@/lib/prisma"`

Dlatego dzisiejszy zestaw testów **nie może** objąć ani jednej akcji serwerowej, ani helpera
dotykającego bazy — nie dlatego, że nikt nie chciał, lecz dlatego, że pipeline testów jednostkowych
fizycznie tego nie uniesie bez resolvera aliasu. To **ukryty sufit** całej warstwy unit-testów.

### Filar 2 — testy E2E (Playwright, szkielet bez bramki CI)

`e2e/` to dojrzały, przemyślany szkielet:

- **Page Object Model** (`e2e/pages/`: `AppShell`, `ShoppingPage`, `TasksPage`, `NotesPage`,
  `KitchenPage`, …) + **fixtures** Playwrighta wstrzykujące POM (`e2e/fixtures/test.ts`).
- **Storage state** dla auth: provider `credentials` aktywny tylko przy `E2E_TEST_MODE=1` (na
  produkcji nigdy nieustawiony), dwóch użytkowników — `admin` (wszystkie uprawnienia) i `limited`
  (tylko `module.home`, do testów gatingu w `specs/gating.spec.ts`).
- **Projekty desktop + mobile** (iPhone 13), tryb DEMO (`--headed` + `slowMo: 600`) do oglądania
  klikania.
- **Locatory user-facing** (`getByRole`/`getByText`/`getByPlaceholder`) — *brak* `data-testid`,
  opieramy się na widocznych polskich etykietach.
- **Traceability** (`specs/coverage.spec.ts`): importuje definicje scenariuszy z `prisma/seeds/qa-*.ts`
  i generuje wpis dla **każdego** z ~201 scenariuszy QA — zaimplementowane (zbiór `IMPLEMENTED`, ~73
  slugi) jako `skip`, reszta jako `fixme` z udokumentowanymi krokami. Raport pokazuje więc pełny
  backlog automatyzacji.

To bardzo solidna konstrukcja. **Ale** — i to jest sedno — E2E **nie jest bramką**. Brakuje workflow
CI (nie ma `.github/workflows`), a `webServer` w `playwright.config.ts` stawia lokalny `npm run dev`
na Postgresie z `.env.local`. Build na Render (`npm run build`) **nie** uruchamia Playwrighta.
Praktycznie: testy E2E to narzędzie, które trzeba **ręcznie odpalić**, a nie automat pilnujący
regresji przy każdym merge'u do `develop`.

### Filar 3 — strażniki buildu (testy statyczne wpięte w pipeline)

To najlepiej działająca część systemu jakości — bo **failuje build**:

```jsonc
"build": "node scripts/copy-docs.js && node scripts/copy-audyt.js
         && node scripts/check-action-coverage.js && node scripts/check-migrations.js
         && prisma generate && next build && node scripts/migrate.js"
```

- **`check-action-coverage.js`** — wyłuskuje nazwy akcji AI z katalogu agenta (`agent/route.ts` +
  `petActions.ts`) i z executora (`execute/route.ts`), po czym wymaga, by **każda** akcja z katalogu
  miała `type === "..."` w executorze. Rozjazd → `process.exit(1)`. Chroni przed „Nieznany typ akcji”
  w runtime.
- **`check-migrations.js`** — pilnuje **unikalnego, sekwencyjnego** prefiksu migracji; nowa kolizja →
  błąd (12 legacy duplikatów grandfathered). Plus `--next` podaje wolny numer.
- **`tsc` w trybie strict** (przez `next build`) — de facto największa „sieć” jakości: unie typów
  zamiast enumów wyłapują literówki statusów przy kompilacji.

### Filar 4 — moduł QA (`/qa`, `/admin/qa`)

To **nie** automat testowy, lecz **repozytorium wiedzy testowej**: hierarchia Epic → User Story →
Scenario (model `QaEpic`/`QaUserStory`/`QaTestScenario`), seedowana z `prisma/seeds/qa-*.ts` (~201
scenariuszy), z priorytetem i krokami. Łączy się z E2E przez `coverage.spec.ts`. Wartość: jedyne
miejsce z **opisanymi oczekiwaniami** całych ścieżek — ale wykonanie nadal jest ręczne (człowiek lub
dopisany test Playwrighta).

### Czego nie ma (mapa białych plam)

| Warstwa | Stan | Krytyczne luki |
|---|---|---|
| Unit (czyste funkcje) | ✅ 42 testy | tylko 7 z dziesiątek helperów w `lib/` |
| Unit (akcje/Prisma) | ❌ 0 | **bariera `@/`**; zero testów logiki własności, RBAC, płatności |
| Integracja (akcja↔DB) | ❌ 0 | brak testowej bazy w teście jednostkowym |
| E2E (happy-path) | ⚠️ szkielet | działa, ale poza CI; ~73/201 scenariuszy zaimplementowane |
| E2E (ścieżki krytyczne) | ❌ | brak testów auth-redirect (poza gatingiem), własności cross-user, płatności Usług |
| Bramka CI | ❌ | brak `.github/workflows`; merge do `develop` niczego nie weryfikuje |
| Pokrycie (coverage %) | ❌ | nigdzie nie mierzone |

## Głos Zespołu A — Strażnicy

**Michał (Tech Lead):** „»Działające ≠ skończone«. 42 testy to nie jest siatka bezpieczeństwa, to
*próbka*. Pokrywają najpiękniejszą część kodu — czyste algorytmy — a omijają całą część, w której
realnie psują się dane: akcje serwerowe. Nie mamy **ani jednego** testu sprawdzającego, że
`assertOwnership` faktycznie odrzuca cudzy zasób, że `removeMember` nie pozwoli adminowi wyrzucić
ownera, że płatność w Usługach nie zaksięguje się dwa razy. To są dokładnie miejsca, gdzie błąd =
wyciek danych albo pieniądze.”

**Ewa (QA):** „Mam 201 scenariuszy w `/qa` i mechanizm traceability, który uczciwie pokazuje, że
~128 z nich to `fixme`. To dobra wiadomość — wiemy, czego nie testujemy. Zła: backlog rośnie szybciej
niż automatyzacja, bo dochodzą moduły, a klikam wszystko ręcznie. Potrzebuję, żeby E2E było **bramką**,
inaczej każdy merge to ruletka.”

**Anna (Security):** „Najbardziej brakuje mi testów **negatywnych na granicy autoryzacji**.
`gating.spec.ts` sprawdza, że user z `module.home` nie wejdzie na `/shopping` — świetnie. Ale nikt nie
sprawdza, że user A nie odczyta listy zakupów user B przez bezpośredni `listId`. To klasyk OWASP
(IDOR/BOLA), a my mamy **28 plików akcji** ręcznie sklejających filtr `ownerTeamId` — wystarczy jeden,
gdzie ktoś zapomni `OR`, i mamy wyciek. Bez testu nikt tego nie złapie do pierwszego incydentu.”

**Marek (DBA):** „196 migracji bez **ani jednego** testu, że migracja w górę i seed przechodzą na
czystej bazie poza Renderem. `migrate.js` odpala się dopiero przy buildzie prod — czyli pierwsze
realne uruchomienie migracji to **produkcja**. To hazard. Chcę job CI: czysty Postgres → `migrate
deploy` → `db:seed` → 0 błędów.”

**dr Natalia (AI/ML):** „Strażnik `check-action-coverage.js` jest genialny w swojej prostocie — to
forma testu kontraktowego między agentem a executorem, wpięta w build. To wzorzec do **powielenia**, a
nie wyjątek. Brakuje mi analogicznej weryfikacji, że każdy read-tool agenta faktycznie zwraca dane w
oczekiwanym kształcie.”

## Głos Zespołu B — Pionierzy

**Bartosz (QA-automatyzacja):** „Nie demonizujmy. Mamy *więcej* infrastruktury testowej niż 90%
projektów na tym etapie: POM, fixtures, storage-state auth, desktop+mobile, traceability na 201
scenariuszy. To nie jest »brak testów« — to **gotowa wyrzutnia**, do której trzeba dorzucić paliwo. Ja
bym nie pisał 200 testów na zapas — wpiąłbym E2E w CI jako **smoke** (10 najważniejszych ścieżek) i
dokładał scenariusze tam, gdzie realnie coś pęka.”

**Damian (Tech Lead):** „Bariera `@/` w `tsx` to nie filozoficzny problem, to **jedna linijka
konfiguracji**. `tsx` umie czytać `paths` z tsconfig albo dorzucamy `tsconfig-paths`/loader. Odblokuj
alias → nagle możemy testować `ownership.ts`, `currency.ts`, parsery walut, `serviceSlots` z realnymi
danymi. To największy ROI w całym rozdziale: mała zmiana, ogromne otwarcie powierzchni testowalnej.”

**Sandra (Architekt):** „»Wystarczająco dobre dziś«: nie potrzebujemy 80% coverage, żeby ruszyć.
Potrzebujemy **piramidy z fundamentem we właściwym miejscu**. Dziś mamy klepsydrę: trochę unitów na
górze (czyste funkcje), bogate E2E na dole, a **środek — testy akcji — pusty**. Wystarczy wypełnić
środek dla 5–6 ścieżek krytycznych (auth, własność, płatność, zaproszenie do zespołu) i mamy
realne bezpieczeństwo bez paraliżu.”

**Kamil (DevOps):** „CI to dziś literalnie **brakujący plik YAML**. GitHub Actions: `lint`/`tsc` +
`test:unit` na każdym PR (sekundy), a E2E nightly albo na merge do `develop` z efemerycznym Postgresem
(mamy już `E2E_TEST_MODE` i seed). Render i tak buduje z `develop` — niech CI weryfikuje **przed**
deployem, nie po.”

**Hubert (AI/ML):** „Skoro AI pisze większość kodu, niech **AI pisze testy**. Strażnik
`check-action-coverage.js` pokazuje filozofię: maszyna pilnuje maszyny. Generujmy testy akcji z
sygnatur i scenariuszy QA — mamy już opisane kroki i oczekiwane wyniki w `qa-*.ts`, to półprodukt
testów.”

## Punkty sporne

1. **Ile testów PRZED skalą?**
   - *Strażnicy:* zanim ruszy marketing, ścieżki krytyczne (auth, własność, płatności) **muszą** mieć
     testy + bramkę CI — inaczej pierwszy incydent IDOR/podwójnej płatności kompromituje produkt.
   - *Pionierzy:* smoke E2E w CI + testy 5 ścieżek krytycznych wystarczą na start; resztę dokładać
     reaktywnie wg realnych awarii i metryk.
   - **Rozstrzygnięcie:** zgoda na minimalny, ale **twardy** rdzeń (auth + własność + płatność) jako
     warunek wejścia na publiczny ruch; reszta przyrostowo. Strażnicy mają weto na P0 (płatności,
     izolacja danych).

2. **Bariera `@/`: workaround czy refaktor?**
   - *Pionierzy:* odblokować alias w `tsx` (loader/`tsconfig-paths`) — najtańsze otwarcie powierzchni.
   - *Strażnicy:* zgoda, ale testy akcji muszą iść na **realnej testowej bazie** (Postgres), nie na
     mockach Prismy — mock nie złapie błędu w samym zapytaniu `OR`.
   - **Rozstrzygnięcie:** najpierw odblokować alias (S), potem dołożyć efemeryczny Postgres do
     `test:unit:db` (M). Mock Prismy odrzucony jako fałszywe poczucie bezpieczeństwa dla logiki
     własności.

3. **`data-testid` czy locatory user-facing?**
   - *Pionierzy:* zostawić user-facing — testują też i18n/etykiety, są bliżej użytkownika.
   - *Strażnicy:* przy planowanym i18n polskie etykiety w locatorach staną się kruche; warto dodać
     `data-testid` na elementy krytyczne (przyciski płatności, akcje destrukcyjne).
   - **Rozstrzygnięcie:** hybryda — user-facing domyślnie, `data-testid` punktowo dla elementów, które
     i18n będzie tłumaczyć.

## Głos użytkowników

- **Krzysztof, 52 (warsztat):** „Mnie nie obchodzi, ile macie testów. Obchodzi mnie, żeby po
  aktualizacji moja lista narzędzi nie zniknęła. Jeśli »testy« to gwarantują — róbcie. Jeśli nie —
  szkoda gadania.”
- **Marek, 29 (early adopter):** „Lubię, że są E2E na desktop i iPhone. Ale jak coś się psuje na
  telefonie po waszej zmianie, a wy macie testy »do ręcznego odpalenia«, to znaczy, że psujecie u mnie,
  nie u siebie. Wpięcie tego w automat to dla mnie cisza w nocy.”
- **Agnieszka, 38 (rodzina):** „Najbardziej boję się, że ktoś obcy zobaczy nasz domowy budżet albo
  kalendarz dzieci. Skoro mówicie, że nie macie testu na to, że dane jednej rodziny nie wyciekną do
  drugiej — to jest dla mnie *pierwsza* rzecz do zrobienia, nie ostatnia.”

## Konsensus i zalecenia

Konsensus: **fundament jest dobry, ale niekompletny w najgroźniejszym miejscu**. Strażniki buildu i
E2E to atut; brak testów akcji i brak bramki CI to ryzyko klasy P0 *dopiero* przy publicznym ruchu, ale
„dług testowy” warto spłacać już teraz, bo rośnie z każdym modułem. Kolejność: odblokuj testowalność
(alias) → wypełnij środek piramidy dla ścieżek krytycznych → wepnij wszystko w bramkę CI.

- **Z-170** *(P0 · S)* — **Wpiąć testy w bramkę CI (GitHub Actions).** Workflow na każdym PR/merge do
  `develop`: `tsc` + `test:unit` (sekundy). Bez bramki żaden inny postęp testowy nie chroni przed
  regresją, bo nic go nie wymusza.
- **Z-171** *(P0 · S)* — **Odblokować alias `@/` w runnerze testów.** Dodać loader/`tsconfig-paths` do
  `test:unit`, by testować moduły z runtime'owym `@/` (`ownership.ts`, `currency.ts`, parsery). To
  warunek wstępny dla większości kolejnych zaleceń.
- **Z-172** *(P0 · M)* — **Testy izolacji danych między użytkownikami (BOLA/IDOR).** Dla reprezentacji
  modułów: user A **nie** może odczytać/edytować zasobu user B po bezpośrednim id. Pokryć helper
  `assertOwnership` i ścieżkę `ownedByWhere`. Najwyższe ryzyko bezpieczeństwa przy skali.
- **Z-173** *(P0 · M)* — **Testy ścieżki płatności i sporów w Usługach.** Brak podwójnego księgowania,
  poprawne przejścia statusów `ServicePayment`/`ServiceDispute`, integracja z Portfelem. Błąd tu = realna
  strata pieniędzy.
- **Z-174** *(P1 · M)* — **Efemeryczny Postgres dla testów akcji (`test:unit:db`).** Job CI: czysta baza
  → `migrate deploy` → `db:seed` → testy akcji na realnym Prisma (bez mocków). Weryfikuje też, że 196
  migracji wstaje na czysto **przed** produkcją.
- **Z-175** *(P1 · S)* — **Smoke E2E w CI (10 ścieżek krytycznych).** Logowanie, gating, dodanie zasobu w
  3–4 modułach, akcja destrukcyjna + kosz, zaproszenie do zespołu. Headless, efemeryczny Postgres
  (`E2E_TEST_MODE`), na merge do `develop`.
- **Z-176** *(P1 · M)* — **Testy guardów RBAC i samo-wykluczenia admina.** `countAdminAccessHolders`,
  blokady `toggleRolePermission`/`removeUserRole`/`deletePermission`. To granica bezpieczeństwa panelu
  admina — dziś bez żadnego testu.
- **Z-177** *(P1 · S)* — **Pomiar pokrycia (coverage) jako informacja, nie próg.** `c8`/`--experimental-test-coverage`,
  raport widoczny w CI. Cel: widzieć trend, nie wymuszać sztucznego progu na siłę.
- **Z-178** *(P1 · M)* — **Rozszerzyć testy jednostkowe na pozostałe czyste helpery.** `recurrence`
  (MONTHLY/edge), `srs` (lapsy), `storeLayout`/`storeRoute`, `habitStats`, `userTime` (granice dnia w
  strefie IANA), `markdown` (regresja XSS z `doświadczenia.md`).
- **Z-179** *(P1 · M)* — **Testy regresji bezpieczeństwa renderera markdown.** Renderer jest własny i
  współdzielony (raporty, AI, zadania); historia ma już lukę XSS (escaping `&`/`<`). Zestaw testów na
  injekcję chroni przed nawrotem.
- **Z-180** *(P2 · M)* — **Zwiększać pokrycie E2E backlogu QA przyrostowo.** Z ~73/201 do priorytetowych
  P0/P1 scenariuszy; mechanizm `coverage.spec.ts` już pokazuje, co dopisać (zbiór `IMPLEMENTED`).
- **Z-181** *(P2 · S)* — **Testy kontraktowe read-toolów agenta AI.** Analogicznie do
  `check-action-coverage.js`: weryfikacja kształtu odpowiedzi narzędzi odczytu, by agent nie dostawał
  danych w nieoczekiwanym formacie.
- **Z-182** *(P2 · M)* — **Punktowe `data-testid` dla elementów krytycznych przed i18n.** Przyciski
  płatności i akcje destrukcyjne — by testy E2E nie pękły, gdy etykiety przestaną być wyłącznie polskie.
- **Z-183** *(P2 · L)* — **Generowanie szkieletów testów akcji z definicji scenariuszy QA.** `qa-*.ts`
  ma już kroki i oczekiwane wyniki — wykorzystać jako półprodukt (asystowane AI), by nadgonić backlog
  bez ręcznego pisania od zera.
- **Z-184** *(P2 · S)* — **Testy `parseRecurringRule`/`computeNextDue` dla zmian czasu (DST) i końca
  miesiąca.** Cykliczność spina zadania, nawyki, leki, zwierzęta — błąd daty propaguje się wieloma
  modułami i kalendarzem naraz.
- **Z-185** *(P2 · M)* — **Testy migracji „w obie strony” dla nowych zmian schematu.** Nie cofamy 196
  historycznych, ale każda **nowa** migracja powinna mieć smoke (czysta baza + dane przykładowe).
- **Z-186** *(P2 · S)* — **Dokumentacja „jak dopisać test” w `e2e/README.md` rozszerzona o testy akcji.**
  README świetnie opisuje E2E; brakuje równoważnego przepisu na test akcji po odblokowaniu aliasu.
- **Z-187** *(P2 · M)* — **Wizualne testy regresji UI (opcjonalnie, screenshot diff Playwrighta).** Przy
  skinach i dwóch layoutach (desktop/mobile) regresja wizualna jest realna; Playwright ma to wbudowane.
- **Z-188** *(P2 · S)* — **Wymusić `forbidOnly` i lint testów w CI.** `test.only`/`fixme` nie powinny
  przechodzić cicho do `develop`; config już ma `forbidOnly: !!process.env.CI`, brakuje samego CI.
- **Z-189** *(P2 · M)* — **Mini-pakiet testów wydajności zapytań list (po Rozdz. 7/9).** Gdy dojdzie
  paginacja, testy pilnujące, że listy nie ładują całości — jako bramka regresji wydajności.

## Dobre vs złe praktyki

**Dobre (utrzymać i powielać):**
- **Strażniki w buildzie jako testy statyczne** — `check-action-coverage.js` (kontrakt agent↔executor)
  i `check-migrations.js` (numeracja) realnie failują build. Wzorzec „maszyna pilnuje maszyny”.
- **Tryb strict TypeScript + unie zamiast enumów** — największa, darmowa sieć jakości (literówki
  statusów łapane przy kompilacji).
- **Jakość istniejących testów jednostkowych** — przypadki brzegowe i negatywne, nie tylko happy-path;
  czytelne nazwy po polsku.
- **Szkielet E2E** — POM + fixtures + storage-state auth + desktop/mobile + traceability na 201
  scenariuszy. Dojrzałość rzadka na tym etapie.
- **Provider E2E offline-only** (`E2E_TEST_MODE=1`, nigdy na prod) — bezpieczne testowanie auth bez
  Google.
- **Traceability QA↔E2E** (`coverage.spec.ts`) — uczciwy, automatycznie generowany backlog zamiast
  udawania pełnego pokrycia.

**Złe (do naprawy):**
- **Brak bramki CI** — merge do `develop` nie weryfikuje niczego; testy istnieją, ale nic ich nie
  wymusza (Z-170).
- **Bariera `@/` w `tsx`** — fizycznie odcina od testów całą warstwę akcji i helperów z I/O; „płytkość”
  testów to jej skutek, nie wybór (Z-171).
- **Zero testów na granicy własności i RBAC** — najgroźniejsza luka: 28 plików ręcznie sklejających
  filtr `ownerTeamId`, żaden nie chroniony testem (Z-172, Z-176).
- **Zero testów płatności/sporów** — moduł z realnymi pieniędzmi bez asercji (Z-173).
- **Pierwsze realne uruchomienie migracji = produkcja** (`migrate.js` w buildzie prod) — brak smoke na
  czystej bazie poza Renderem (Z-174, Z-185).
- **Pokrycie nigdzie nie mierzone** — brak nawet informacyjnego trendu (Z-177).
- **Backlog scenariuszy rośnie szybciej niż automatyzacja** — ~128/201 wciąż `fixme` (Z-180).
