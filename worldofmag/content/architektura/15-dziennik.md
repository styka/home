# Dziennik przebudowy — co zrobiono

> **Po co ten rozdział.** Reszta dokumentu opisuje stan **docelowy**. Ten opisuje stan
> **faktyczny**: co z 46 zadań checklisty zostało zrobione, a co nie. Bez niego kolejna sesja
> musiałaby wnioskować o postępie z historii gita — czyli zgadywać.
>
> **Zasada prowadzenia:** każdy przebieg pipeline'u dopisuje tu swój wpis i aktualizuje tabelę
> statusów. To część definicji „gotowe", nie dobra wola.

---

## Gdzie jesteśmy

**Faza 0 (siatka bezpieczeństwa) jest UKOŃCZONA.** Przebiegi 045/045b dowiozły warstwę, która
w checkliście nie ma numeru (rozdz. 10.4–10.5 — system komponentów i kontrakt widoku), oraz komplet
zadań 1–3 Fazy 0. Rozdz. 13 nazywał je „bezwarunkowo pierwszymi": *refaktor bez siatki bezpieczeństwa
to nie refaktor, tylko przepisywanie z nadzieją*.

**ZADANIE 5 JEST DOMKNIĘTE. Wszystkie 21 modułów stoi w `src/modules/`.** Trzy przebiegi: 046
postawił warstwę `src/platform/`, granicę egzekwowaną lintem i bramkami oraz deklarację
`defineModule` (4 moduły), 047 powtórzył wzorzec na siedmiu, 048 domknął pozostałe dziesięć — w tym
najbardziej sprzężone jądro: Zadania, Zakupy, Portfel, Kalendarz i pulpit.

**Lista przejściowa nie istnieje.** Tablica `LEGACY` została usunięta jako martwy kod, a
`PERMISSIONS` zawiera już wyłącznie powierzchnie **spoza** rejestru modułów: `SETTINGS`, `ADMIN`,
`INVITATIONS` i pięć podupranień Kuchni. To jest sprawdzalny dowód, że cel „8 → 1" z rozdz. 9.3
został osiągnięty: **żadnego sluga modułu nie ma już w równoległej liście.**

**Powłoka nie importuje wnętrza żadnego modułu.** Nawigacja boczna sześciu modułów przychodzi
z deklaracji (`sideNav`, ładowane leniwie), a globalny asystent został wyprowadzony z pulpitu do
`components/assistant/`.

**FAZA 1 JEST DOMKNIĘTA W CAŁOŚCI.** 049 dowiozło zadania 4 i 8 oraz kalendarzową połowę
zadania 7; 050 domknęło drugą połowę — **migawkę pulpitu**. Trasa `src/app/page.tsx` importowała
osiem kontraktów modułów i miała dziesięć gałęzi na uprawnienia; było to ostatnie miejsce w całej
aplikacji, w którym dodanie modułu wymagało edycji cudzego pliku.

**Odpowiedź na pytanie kontrolne z rozdz. 14 nie ma już przypisu:** *ile miejsc trzeba dotknąć, żeby
dodać moduł?* → **jeden katalog plus wpięcie w korzeń kompozycji.** Nie jest to deklaracja dobrych
chęci: `check:module-registry` ma dziś **osiem kontroli** i wywala build, gdy moduł opisze się poza
swoim katalogiem — łącznie z trasą pulpitu.

**FAZA 2 JEST OTWARTA.** 051 dowiozło zadanie 9: cztery modele fundamentu współdzielenia
(`Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation`) **wraz z danymi** — każdy
istniejący zespół i każde konto ma już swoją przestrzeń. Aplikacja nadal liczy dostęp przez
`ownerId`/`ownerTeamId`; przestrzenie są na razie **lustrem, nie zamiennikiem**.

**052 dowiozło zadanie 10:** `requireAccess` istnieje w platformie, a Zadania są jego pierwszym
konsumentem. Nadania z 051 mają wreszcie czytelnika.

**Przebiegi 053–068 domknęły Fazę 2 tak daleko, jak da się ją domknąć bez produkcji.** Zamknięte
w całości: **13** (deklaracje zasobów — okazało się, że decyzje per rekord podejmuje sześć modułów,
nie dziewiętnaście), **16** (okno konfliktu), **17** (odwołanie dostępu działa natychmiast),
**18** (asystent AI nie jest drogą obejścia uprawnień). Zaczęte i dowiezione do granicy: **11**
(etapy 1–3 z czterech — kolumna, wyzwalacz utrzymujący ją w przód, przełączone rozstrzyganie
i przełączone zakresy list), **12** (etap 1 z trzech — lustro nadań dla Zadań i Zwierząt),
**14** (część odczytowa: „Udostępnione mi" / „Co udostępniłem"), **15** (mechanizm wersji
+ pilot), **20** (mechanizm paginacji + zapadka na 263 zapytaniach bez `take`).

**Dwie rzeczy są ZABLOKOWANE warunkiem, którego z tej sesji nie da się spełnić** — i to jest
świadoma granica, nie zaniechanie. **Etap 4 zadania 11** (`NOT NULL` i `DROP COLUMN` na 45 tabelach)
wymaga wcześniejszego wygrzania etapów 3A/3B na produkcji i policzenia sierot; **etap 2 zadania 12**
(przełączenie odczytów na nadania) wymaga produkcyjnego pomiaru rozjazdu tabela↔nadanie. Obie
operacje są nieodwracalne, a ich warunek wejścia to dane, których w sandboksie nie ma.

**069 domknęło zadanie 19**, a wraz z nim **Fazę 3 w części, którą da się domknąć**. Zostaje
spłata długu paginacyjnego (263 zapytania bez `take`, zamrożone zapadką z 068) — idzie modułami,
bo każda taka zmiana zmienia to, co użytkownik widzi.

**FAZA 4 OTWARTA.** 070 dowiozło zadanie 21: dziennik zdarzeń domenowych, którego zapis jest
nierozłączny z mutacją. To **outbox bez czytelnika** i tak ma być — publikację dowozi zadanie 22,
a odwrotna kolejność budowałaby czytelnik na źródle, które może kłamać.

**071 dowiozło zadanie 22:** zdarzenia **docierają** do subskrybentów, a idempotencja jest
wymuszona bramką. Outbox ma czytelnika.

**072 dowiozło zadania 23 i 24** — łańcuch z rozdz. 11.1.1 jest kompletny od mutacji do
przeglądarki, a odpytywanie co 45 s zniknęło.

**Następny krok: zadanie 25** — subskrypcje międzymodułowe, w tym **przepięcie księgowania wydatku
z wywołania synchronicznego na subskrypcję zdarzenia**. Dopiero to domknie problem, dla którego cała
Faza 4 powstała: *awaria Portfela nie może zabierać zakupów*. Po nim Faza 4 jest zamknięta.

---

## Status 46 zadań

Legenda: ✅ zrobione · 🟡 częściowo · ⬜ nietknięte

### Faza 0 — Siatka bezpieczeństwa

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 1 | Klikacz ścieżki szczęśliwej dla 21/21 modułów | ✅ | `e2e/specs/modules-happy-path.spec.ts` — 25/25 zielonych. Lista modułów **wywodzona z rejestru** `src/lib/modules.tsx`, więc nowy moduł jest pokryty automatycznie |
| 2 | Generowany test izolacji najemcy | ✅ | `tenantIsolation.integration.test.ts` — lista 46 modeli z `ownerId` **generowana ze `schema.prisma`**; 37 zweryfikowanych, 9 pominiętych (wymagają relacji) i jawnie raportowanych. Zero wycieków |
| 3 | Bramka rozjazdu `schema.prisma` ↔ migracje | ✅ | `check:schema-drift` w buildzie; pomija bez `DATABASE_URL` i na zdalnej bazie (C-13); 2 świadome wyjątki dla granic Prismy |

### Faza 1 — Granice modułów

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 4 | `src/platform/` — przeniesienie wspólnych zdolności | ✅ | **049: domknięte.** Poza tym, co przeniosły 046–048, w platformie są `ai`, `llm` i `jobs`. `grep "@/modules/"` po `src/platform/` zwraca **zero**. Kod modułowy z tych warstw (egzekutory, read-toole, handlery zadań) wrócił do modułów |
| 5 | `src/modules/<x>/` — moduł po module | ✅ | **21 z 21.** 046: Trasy TIR, Kontakty, Raporty, QA · 047: Nawyki, Nauka języków, Warsztaty, Magazynowanie, Notatki, Flota, Zdrowie · 048: Wiadomości, Pogoda, Usługi, Kuchnia, Zwierzęta, Portfel, Zakupy, Zadania, Kalendarz, Strona główna. Każdy osobnym commitem. **Lista przejściowa usunięta** |
| 6 | `contract.ts` + reguła ESLint blokująca import przez granicę | ✅ | Dwie reguły `no-restricted-imports` (moduł↔moduł, platforma↛moduł) + bramka `check:boundaries`, która sama je łamie i wymaga błędu. Sprawdzone: wyłączenie reguły **i** zepsucie konfiguracji czerwienią bramkę |
| 7 | `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji | ✅ | Wszystkie 21 modułów deklaruje się jednym plikiem. `PERMISSIONS` zawiera już tylko powierzchnie spoza rejestru. Nawigacja boczna sześciu modułów pochodzi z pola `sideNav` (leniwie). Bramka `check:module-registry` wykrywa też moduł pisany „po staremu". **049: kalendarz wynika z deklaracji** (pole `calendar`, 7 wkładów, agregat schudł z 227 do 32 linii). **050: migawka pulpitu też** — 11 wkładów, trasa bez importów modułów, równoważność udowodniona zrzutem runtime pole po polu |
| 8 | Migracja asystenta AI na katalog składany z deklaracji | ✅ | **049.** Katalog akcji, egzekutory i 56 narzędzi odczytu pochodzą z pola `ai` w deklaracji; `buildAiCatalog` w platformie bierze wkłady parametrem. `check:actions` pilnuje mocniejszej własności: moduł z akcjami **musi** deklarować `ai` |

### Faza 2 — Współdzielenie i współbieżność

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 9 | Modele `Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` | ✅ | **051.** Cztery modele + migracja 0226 **z backfillem** (rozdz. 8.10 kroki 1–2): przestrzeń osobista na konto, zespołowa na zespół wraz ze składem. Lustro utrzymywane w przód (`platform/workspaces`), pilnowane bramką `check:workspace-mirror` i testem z testem negatywnym. Zero przełączonych odczytów |
| 10 | `platform/sharing` — `requireAccess`, dziedziczenie, cache | ✅ | **052.** Platforma bez importu modułu (katalog parametrem wymaganym); Zadania jako pilot; **tabela prawdy 25 komórek identyczna** przed i po; read-tool asystenta przez wspólne sprawdzanie z testem obejścia. Cache per żądanie — bez unieważniania, bo nie ma czego unieważniać |
| 11 | Migracja `ownerId`/`ownerTeamId` → `workspaceId` na 46 modelach | ✅ | **ZAMKNIĘTE w 079 (etap 4 część 3).** Własność zasobu wyraża wyłącznie `workspaceId`; migracja **0244** usunęła kolumny własnościowe z **40 tabel**. **Pięć tabel zachowuje `ownerId`** — kryterium „wiersz może nie mieć właściciela”, zapadka `check:workspace-nullable`. Cztery etapy: 054 kolumna + backfill (0227), 055 wyzwalacz (0228), 056 dostęp po przestrzeni, 057+058 zakresy list, 075 `NOT NULL` (0235), 076–078 faza podwójnego zapisu, 079 `DROP COLUMN`. **Trzy rzeczy, których nie widział kompilator, a które etap 4 mógł zgubić po cichu:** kaskada usuwania danych (`workspaceId` NIE miało klucza obcego — dołożyła go migracja **0243**, odtwarzając obie dawne ścieżki i naprawiając `Contact`, który kaskady nie miał wcale), surowy SQL diagnostyki `/admin/health` (EXPLAIN na nieistniejącej kolumnie wpadał w cichy `catch`) i migawki kosza sprzed 078 (JSON o zamrożonym schemacie — `przestrzenZMigawki` czyta z nich `ownerId` do dziś). **Siatka „właściciel = manager” z 077 przeniesiona**, nie usunięta: `getAccessContext` czyta przestrzeń osobistą po `Workspace.personalUserId`, a nie po członkostwie. U-3 i U-5 domknięte razem z migracją

| 12 | Migracja `TaskProjectMember`/`TaskShare`/`PetShare` → `ResourceGrant` | 🟡 | Etap 1 z trzech: 059 lustro nadań dla Zadań, 061 dla Zwierząt; bramka `check:grant-mirror` z manifestem wyjątków. **Etap 2 zablokowany** — przełączenie odczytów wymaga produkcyjnego pomiaru rozjazdu tabela↔nadanie |
| 13 | Deklaracje `resources` w `module.ts` | ✅ | **064.** Pomiar przed decyzją zmienił zadanie: decyzje dostępu **per rekord** podejmuje sześć modułów, nie dziewiętnaście. Pozostałe piętnaście albo dziedziczy po zasobie nadrzędnym, albo filtruje zakresem. Zamknięte manifestem `sharing-classification.json` (21/21 z powodem) egzekwowanym przez `check:module-registry` — zamiast pozycji wiecznie otwartej |
| 14 | `ShareDialog`, „Udostępnione mi", „Co udostępniłem" | 🟡 | **067: część odczytowa.** `/udostepnione`, dwie zakładki, jedno zapytanie do jednej tabeli — wypłata za cały jednolity model. Zostaje strona zapisu: `ShareDialog`, zaproszenia e-mail, `subjectType: "link"`, powiadomienia, kategoria `sharing` w `AuditLog`. Przycisk odbierania dostępu jedzie razem z etapem 2 zadania 12 |
| 15 | Kolumna `version` + `updateMany` z warunkiem na wersji | 🟡 | **062: mechanizm + pilot.** `updateWithVersion` w `platform/concurrency`; `updateMany` (nie `update`), bo tylko liczba wierszy odróżnia „ktoś mnie ubiegł" od „rekord nie istnieje". Bramka `check:versioning` z manifestem. Rozszerzanie na kolejne modele — sukcesywnie |
| 16 | `ConflictDialog` | ✅ | **066.** Trzy wyjścia (nadpisz / odrzuć / wróć do edycji), a odrzucona wersja **nie znika** — ląduje w koszu jako „Wersja robocza (konflikt)". Degradacja poza powłoką wyodrębniona do `konfliktPozaPowloka`, żeby dała się przetestować bez Reacta |
| 17 | Test odwołania dostępu | ✅ | **063.** Test dowodzi natychmiastowości **i** że mierzy właściwą rzecz: bez unieważnienia cache'u per żądanie schodzi na czerwono |
| 18 | Test kontraktowy read-tooli AI | ✅ | **065.** Bramka `check:ai-access` — pierwsza wersja wzorca dawała fałszywe alarmy, bo znała tylko jeden idiom (`requireAccess`/`ownedWhere`), a sześć modułów zakresuje inaczej. Bramka, która zna jeden idiom, mierzy styl, nie bezpieczeństwo |

### Faza 3 — Domena i paginacja

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 19 | `domain/` w każdym module + testy bez bazy | ✅ | **069.** Klasyfikacja 55 pomocników z plików akcji: **21 reguł** wyprowadzonych, **34 adaptery** zostają świadomie. Dowód „bez bazy" dosłowny: Postgres zatrzymany, **124 testy, 1,9 s**. Manifest rozstrzyga **21/21** modułów (domena 9 / reguły w `lib/` 7 / bez reguł 5), bramka `check:domain` pilnuje czterech niezmienników — każdy zobaczony na czerwono osobno. Znana granica zapisana, nie przemilczana: zapadka liczy pomocniki **nazwane**, więc reguła pisana wprost w ciele akcji przez nią nie przejdzie wykryta (tak znalazła się analityka Magazynowania) |
| 20 | Paginacja kursorowa we wszystkich widokach listowych | 🟡 | **068: mechanizm + zapadka.** `platform/pagination.ts` (kursor, nie `OFFSET`; wiersz-zwiadowca zamiast `count`), a dług — **263** `findMany` bez `take` — zamrożony bramką `check:pagination`, która pada także przy **spadku** licznika, wymuszając obniżenie progu. Spłata modułami, nie jednym przebiegiem: każda z tych zmian zmienia to, co użytkownik widzi |

### Faza 4 — Zdarzenia i koniec odpytywania

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 21 | `DomainEvent` + zapis w tej samej transakcji | ✅ | **070.** Model + migracja 0232 + emisja, której **nie da się użyć poza transakcją**: `Prisma.TransactionClient & { $transaction?: never }` odrzuca pełnego klienta (samo `TransactionClient` go **przepuszczało** — sprawdzone sondą w obie strony). Trzej producenci, każdy z nazwanym przyszłym odbiorcą. Bramka `check:events`, pięć kontroli, osiem sond; piąta powstała dlatego, że test mutacyjny wykazał, iż testu odwzorowującego kształt pętli nie czerwieni przeniesienie emisji do pętli w prawdziwym kodzie |
| 22 | Publikacja przez worker | ✅ | **071.** Worker czyta niedostarczone (`FOR UPDATE SKIP LOCKED`), woła subskrybentów z deklaracji, oznacza `deliveredAt` **po sukcesie** — bo lepiej dwa razy niż zero razy. Idempotencja **wymuszona bramką** (`check:subscribers`), nie akapitem: `klucz-unikalny` musi mieć `upsert` i klucz z `event.id`. Pierwszy subskrybent: zakupy zakończone → powiadomienie dla pozostałych członków przestrzeni. **Bez `LISTEN/NOTIFY`** — decyzja przy zadaniu 23, gdzie jest realny wymóg opóźnienia |
| 23 | SSE `/api/events` | ✅ | **072.** Jedno połączenie na kartę, kanały `user:` i `ws:` liczone **na serwerze z sesji** (przyjęcie ich z żądania byłoby podsłuchem — pilnuje bramka). Ładunek celowo ubogi: klient się odświeża, nie renderuje z sygnału. **Bez `LISTEN/NOTIFY`** — szyna w procesie, bo oba warianty z rozdz. 11.1.1 istnieją wyłącznie dla wielu instancji; ograniczenie nazwane w kodzie i w `docs/devops/` |
| 24 | Usunięcie `setInterval` z `DataFreshness` | ✅ | **072.** 45 s → strumień; odpytywanie **awaryjne co 5 min zostaje na stałe**, bo pokrywa brak `EventSource`, zerwany strumień i wiele instancji. Awaria kanału **nie jest awarią aplikacji** — zmiany dochodzą wolniej. Bramka nie pozwala wrócić do krótkiego interwału |
| 25 | Subskrypcje międzymodułowe | 🟡 | **073.** Zakupy→Portfel przepięte z wywołania na zdarzenie: `completeShopping` nie importuje już nic z Portfela, a reguła „tylko listy prywatne" przeniosła się do subskrybenta i czyta **przestrzeń**, nie `ownerId`. Idempotencja `naturalna` po `(sourceModule, sourceId)`, data z `event.createdAt`. Test na realnym Postgresie + mutacja. **Magazyn→Zakupy zostaje** — wymaga nowego rodzaju zdarzenia i producenta |

### Faza 5 — Skala i koszt

| # | Zadanie | Status |
|---|---------|--------|
| 26 | Współdzielony rate-limit | ⬜ |
| 27 | Budżety AI | ⬜ |
| 28 | Pula połączeń, audyt N+1, indeksy | ⬜ |
| 29 | Cache agregatów i rozstrzygnięć dostępu | ⬜ |
| 30 | Retencja danych | ⬜ |

### Faza 6 — Obserwowalność i procesy

| # | Zadanie | Status |
|---|---------|--------|
| 31 | Logi strukturalne | ⬜ |
| 32 | Metryki na `/admin/health` | ⬜ |
| 33 | Rozdzielenie `web` / `worker` / `cron` | ⬜ |

### Faza 7 — Wielojęzyczność

| # | Zadanie | Status |
|---|---------|--------|
| 34 | `next-intl` | ⬜ |
| 35 | Wyciągnięcie tekstów do `messages/pl.json` | ⬜ |
| 36 | Zmiana `C-32` w konstytucji | ⬜ |
| 37 | Formatowanie `Intl` + język przestrzeni | ⬜ |
| 38 | Język przestrzeni w promptach AI | ⬜ |

### Faza 8 — Gotowość produkcyjna

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 39 | Eksport danych użytkownika | ✅ | `actions/privacy.ts` `exportMyData()` — pełny zrzut danych konta. **Wiersz poprawiony przy przeglądzie 077**: praca była zrobiona, tracker jej nie odnotował |
| 40 | Usunięcie konta | ✅ | `actions/privacy.ts` `deleteMyAccount(confirmation)` + `lib/privacy/purge.ts` (przekazuje własność zespołu następcy, zamiast osierocić zasoby); testy `purge.test.ts`, `ondelete-cascade.test.ts`. **Wiersz poprawiony przy przeglądzie 077** |
| 41 | Próba odtworzenia z kopii + runbook | 🟡 | Runbooki są: `docs/devops/runbook-deploy-rollback.md` (PITR w Neonie) i `przywrocenie-wlasnosci.md` (074, procedura **przećwiczona** realnym `DROP COLUMN` w transakcji z `ROLLBACK` + próba mutacyjna). Brakuje **próby odtworzenia CAŁEJ bazy** z kopii — czyli tego, co runbook PITR opisuje, a czego nikt nie wykonał |
| 42 | **Stany błędów i puste w każdym module** | ✅ | 21/21 modułów na kontrakcie widoku, bramka `check:ui-contract` wpięta w build |
| 43 | Budżet wydajnościowy w CI | ⬜ | |

### Faza 9 — Domknięcie

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 44 | Aktualizacja `CLAUDE.md` i konstytucji | 🟡 | Opisany kontrakt widoku, silnik skórek, obie nowe bramki; konstytucja ma C-33/C-34/C-35. Reszta czeka na Fazy 1–8 |
| 45 | Aktualizacja `/admin/architecture` i tego dokumentu | 🟡 | |
| 46 | Wersja **Omnia 🧐** — wpis w historii wersji | ⬜ | |

---

## Luka w dokumencie źródłowym

**Rozdz. 10.4 i 10.5 — system komponentów i kontrakt widoku — nie mają numeru w checkliście**,
choć rozdz. 10 opisuje je jako konkretny, udokumentowany dług (przycisk zapisu widoku z wersji 043).
Checklista wspomina o nich tylko pośrednio, przez zadanie 42 („stany błędów i puste w każdym module").

To jest przeoczenie w dokumencie, nie w planie. Odnotowane, żeby kolejna sesja nie uznała tej pracy
za samowolkę spoza zakresu.

---

## Wpisy przebiegów

### 045 — System komponentów, kontrakt widoku i silnik skórek · 2026-08-04

**Specyfikacja:** `specs/045-system-komponentow-i-skorki/`

**Co zrobiono**

- **Migracja 21/21 modułów na kontrakt widoku.** Bez wyjątków „inny układ" w manifeście.
- **Sweep zaszytych kolorów: 73 podmiany.** Zero pozycji „do poprawy" — każdy pozostały literał
  (29 plików) ma świadome uzasadnienie: paleta danych z rekordów użytkownika, semantyka niezależna
  od motywu (przeterminowana żywność, progi magazynowe) albo ilustracja (logo, etykiety QR do druku,
  poradnik ze zrzutami).
- **Cztery skórki flagowe:** „Mostek", „Papier", „Terminal", „Zen" — dwa bieguny ciemny/jasny razy
  dwa charaktery (efektowny/oszczędny). Każda z kontrastem liczonym w testach.

- **Kontrakt widoku** (`components/ui/view/`): `ModuleView`, `ViewBar`, `ViewChrome`, `ViewState`,
  `ChromeFrame`. Moduł deklaruje tytuł, filtry, akcje i stan; ramę rysuje powłoka.
  Rozwiązanie odwraca zależność opisaną w 043: `AppShell` nie rysuje paska (nie zna tytułu modułu,
  więc dostałby podwójne nagłówki w ~20 modułach), tylko **udostępnia jego zawartość** przez
  `ViewChromeProvider`. Gwiazdka „zapisz widok", wskaźnik świeżości i wejście do ściągawki skrótów
  pojawiają się w pasku bez wiedzy modułu — **dług z 043 spłacony**.
- **Prop `resource`** przyjmowany od początku, choć dziś nieaktywny — żeby `ShareDialog`,
  `ConflictDialog` i awatary obecności (zadania 14, 16) dało się dołożyć bez wracania do 21 modułów.
- **Komponenty wspólne:** `ConfirmDialog`, `Field`, `DataList` (j/k, zaznaczanie; `onEndReached`
  gotowe pod zadanie 20), `BulkActionBar`.
- **Silnik skórek** rozszerzony daleko poza kolory: typografia, gęstość, zaokrąglenia, obramowania,
  cienie, tło (gradienty CSS), ruch, chrom powłoki. **Bez zmiany schematu** — `Skin.tokens` to JSON.
  Sanityzacja przepisana na whitelisty per rodzaj: `linear-gradient(` przechodzi, `url(`, `paint(`,
  `attr(` nie.
- **Skórki flagowe „Mostek" i „Papier"** (migracja 0224) z kontrastem **liczonym w testach**, nie
  ocenianym wzrokiem.
- **Generowanie skórki opisem słownym przez AI** — zakres dodany przez właściciela w trakcie
  przebiegu. Model **proponuje, nigdy nie zapisuje**; wynik przechodzi tę samą sanityzację co import
  pliku, bo model jest źródłem równie obcym.
- **Playground napisany od zera** — wywodzi listę z rejestru, więc nowy komponent pojawia się w nim
  sam; sterowanie właściwościami na żywo, warianty brzegowe, lokalny przełącznik skórki.
- **Bramka `check:ui-contract`** wpięta w `build`.

**Czego świadomie NIE zrobiono**

- Faza 0 i pozostałe fazy przebudowy — zgodnie z zasadą „jedna faza = jeden przebieg".

**Punkt kontrolny kontraktu (C-54)**

Plan zakładał sprawdzian: jeśli `ModuleView` nie uniesie najbardziej nietypowych widoków, wracamy do
planu zamiast obchodzić problem w module. **Nie uniósł** — i kontrakt został poszerzony **trzy razy**,
za każdym razem z tego samego powodu:

1. **`breadcrumb`** — link powrotny powtarzał się w ośmiu widokach podrzędnych, za każdym razem
   z innym odstępem i rozmiarem ikony.
2. **`layout="fill"`** — moduły wielopanelowe mają osobne przewijanie panelu bocznego i listy;
   kolumnowa rama narzuciłaby im jeden scroll na całość, czyli przebudowę układu.
3. **`density="compact"`** — Zadania, Zakupy i Notatki mają celowo gęsty pasek 48 px; standardowy
   nagłówek 22 px dołożyłby drugi wiersz chromu tam, gdzie liczy się każdy piksel listy.

Wszystkie trzy zmiany są **w kontrakcie**, nie w modułach. Efekt: ani jeden moduł nie figuruje
w manifeście jako wyjątek z powodu „inny układ". To jest test, który kontrakt zdał — bo poszerzenie
ramy jest tanie i jednorazowe, a wyjątek w module byłby długiem w dwudziestu miejscach.

**Decyzje warte zapamiętania**

- `--font-family-*` to **słowo kluczowe z zamkniętej listy**, nie dowolny stos czcionek. Dowolny
  `font-family` jest najtrudniejszym do sanityzacji tokenem (cudzysłowy i przecinki są w nim
  legalne), a stosy systemowe nie powodują żądań do sieci.
- Zaokrąglenia i gęstość zostały **wąskie** (px, max 3 cyfry). Promień w `em` skaluje się z tekstem,
  a `1000px` to nie zaokrąglenie, tylko awaria układu.
- Widoczność ramek narożnych rozstrzyga atrybut `data-chrome-frame` renderowany **serwerowo**, a nie
  odczyt tokenu w `useEffect` — inaczej dekoracja mignęłaby po hydratacji.
- `.omnia-skeleton` przeniesione z tekstowego dziecka `<style>` do `globals.css`. React escapuje tam
  cudzysłowy tylko na serwerze, a rozjazd hydratacji kładzie **całą** aplikację.

**Nawrót z weryfikacji**

`/verify` odrzucił pierwszą wersję z werdyktem DO POPRAWY — i słusznie. Powstały wspólne komponenty,
których **żaden moduł nie używał**: `ConfirmDialog` istniał, a w kodzie było 52 wywołania natywnego
`window.confirm()`. To jest dokładnie ten rodzaj długu, który cały ten przebieg spłaca: rozwiązanie
zadeklarowane, ale niewpięte, wygląda w raporcie jak zrobione i nie zmienia niczego dla użytkownika.

Domknięcie:
- **52 wywołania `window.confirm()` → wspólne okno aplikacji.** Natywne okno nie zna skórki, ma
  przyciski w języku systemu i blokuje wątek, więc nie da się przy nim pokazać, co zostanie usunięte.
  Podmiana jest jednolinijkowa w miejscu wywołania (`ConfirmProvider` z API obietnicowym), bo inaczej
  nikt by jej nie zrobił w 52 plikach.
- **Dwie implementacje stanu pustego scalone w jedną.** `ui/home/EmptyState` (21 widoków) stał się
  cienką nakładką na `ViewEmpty` z kontraktu. Przepisywanie 21 wywołań byłoby błędem — stan pusty
  bywa SEKCYJNY (pusta lista wewnątrz jednej z sekcji), a `ModuleView.empty` opisuje stan CAŁEGO
  widoku. Jedna implementacja, dwa wejścia.
- **Dwie implementacje pola formularza scalone.** `Field` w module Zwierząt robił mniej niż wspólny
  (etykieta wiązana tylko zagnieżdżeniem, bez `id`, więc błąd nie miał się do czego podpiąć przez
  `aria-describedby`).
- **`DataList` i wspólny `BulkActionBar` USUNIĘTE.** Nie miały konsumenta. Komponent bez użycia jest
  gorszy niż jego brak: w playgroundzie ogłasza wspólne rozwiązanie, którego nikt nie stosuje.
  Pasek akcji zbiorczych z rozdz. 10.6 zostaje **otwarty** — Zadania mają własny, z popoverami
  kotwiczonymi we własnym kontenerze, a wyprowadzenie go stanie się sensowne dopiero, gdy drugi moduł
  będzie potrzebował akcji zbiorczych. Lista z nawigacją `j`/`k` wraca przy zadaniu 20 (paginacja
  kursorowa), bo i tak wymaga zmian w zapytaniach.

### 045b — Domknięcie: dokumentacja, bramka rozjazdu, weryfikacja klikaczami · 2026-08-04

Uzupełnienie tego, bez czego praca z 045 by się nie utrzymała.

- **`CLAUDE.md` opisuje kontrakt widoku, zakaz `window.confirm()`, rozszerzony silnik skórek,
  generowanie skórki przez AI oraz obie nowe bramki.** To była najpoważniejsza luka: bramka trzymała
  nowe moduły, ale żaden dokument nie mówił, czego użyć — więc następna sesja i tak napisałaby własny
  nagłówek.
- **Konstytucja pipeline'u dostała `C-33`, `C-34` i `C-35`** — widok przez `ModuleView`, potwierdzenia
  przez `confirmDialog`, a nowy wspólny komponent dowozimy **razem z pierwszym konsumentem**. Ostatnia
  reguła wprost koduje lekcję z nawrotu weryfikacji.
- **Playground uzupełniony o 5 brakujących komponentów** (`Toast`, `ErrorState`, `LineChart`,
  `ImageUrlInput`, `AiCostBadge`). Galeria pokazująca część zestawu uczy, że reszty nie ma.
- **Klikacze: 12/12 zielonych.** To była największa nieznana z recenzji — 21 widoków zmieniło
  opakowanie i nic tego nie potwierdzało poza kontrolą typów. Nawigacja po wszystkich modułach
  i konsola admina działają.
- **Zadanie 3 z Fazy 0 zrobione:** `check:schema-drift`. Sprawdzone testem negatywnym — kolumna
  dodana do `schema.prisma` bez migracji czerwieni build ze wskazaniem brakującej instrukcji.

**Następny przebieg:** Faza 0, zadania **1 i 2** — klikacz ścieżki szczęśliwej dla 21/21 modułów
(dziś smoke pokrywa 8) oraz generowany test izolacji najemcy z manifestu 545 akcji. Ten drugi
dokument nazywa „najważniejszym testem w systemie", bo wyciek między najemcami kończy produkt.

### 046 — Faza 1: granice modułów (pionowy wycinek) · 2026-08-04

Pierwszy przebieg Fazy 1. Świadomie **wycinek pionowy, nie poziomy**: zamiast przenieść wszystkie
21 modułów na pół gwizdka, cztery przechodzą całą drogę — przenosiny, kontrakt, deklaracja,
egzekwowana granica — żeby wzorzec był **sprawdzony**, zanim powtórzy się go siedemnaście razy.

**Co powstało**

- **`src/platform/`** — jedenaście zdolności niezależnych od modułu. Kolejność przenoszenia szła od
  zera importujących do 155 (`prisma`, `auth`), żeby skrypt przepisujący importy był sprawdzony na
  małym zbiorze, zanim dotknie połowy repo. Łącznie ~490 podmian importu, poprawność potwierdzona
  kontrolą typów: zerwany import to błąd kompilacji, nie cicha awaria.
- **Cztery moduły w `src/modules/`** — Trasy TIR, Kontakty, Raporty, QA. Kolejność nieprzypadkowa:
  Truck nie ma zewnętrznego konsumenta (kontrakt jako sama granica), Kontakty mają jednego
  (egzekutor asystenta), Raporty czterech (panel admina, `AICommandSheet`, `agentTools`, egzekutor),
  QA sprawdzają granicę **moduł ↔ powierzchnia administracyjna** — ich formularze redakcyjne
  **zostały** w `components/admin/` właśnie po to, żeby granica miała co testować.
- **Egzekwowanie** — dwie reguły lintu plus bramka `check:boundaries`.
- **Jedna deklaracja** — `defineModule` w `module.ts`; stąd menu, uprawnienie i mapowanie ścieżek.
  Wpisy czterech modułów **zniknęły** z `lib/modules.tsx` i z `platform/auth/permissions.ts`.
  To jest sedno: deklaracja miała **zastąpić** listy, a nie dołożyć dziewiątą.

**Decyzje warte zapamiętania**

- **Wewnątrz modułu importujemy ścieżką względną.** Dla lintera plik w `modules/qa` importujący
  `@/modules/qa/actions/qa` wygląda **identycznie** jak import cudzego wnętrza — przy aliasach jedna
  reguła nie odróżni swojego od cudzego i trzeba by utrzymywać blok konfiguracji na każdy z 21
  modułów. Przy ścieżkach względnych granicę widać w samym imporcie: `./` = moje, `@/modules/…` = cudze.
- **Scalanie deklaracji nie mieszka w platformie.** Plan przewidywał `platform/registry.ts` jako
  miejsce składania modułów, ale platformie nie wolno importować modułów — to ta sama reguła, którą
  sami tu wprowadzamy. Platforma daje **typ i funkcje czyste**, składa **korzeń kompozycji**
  (`src/lib/modules.tsx`). Asymetria z rozdz. 7.1 obowiązuje też autora przebudowy.
- **Platforma, która potrzebuje wiedzy modułowej, przyjmuje ją parametrem.**
  `filterAccessibleFavorites` dostaje predykat `isPathLocked` **parametrem wymaganym**. Gdyby był
  opcjonalny z wariantem „historycznym" jako domyślnym, zapomniane przekazanie dawałoby **cichy
  przeciek RBAC** zamiast błędu kompilacji.
- **`platform/ui` jest re-eksportem, nie przenosinami.** Bramka kontraktu widoku skanuje
  `src/components`; przeniesienie plików wywróciłoby ją w tym samym commicie, w którym przenosimy
  granice. Dla modułu różnicy nie ma.

**Trzy dziury, które ten przebieg zamknął — wszystkie znalezione, nie przewidziane**

1. **Bramki miały zaszyte korzenie skanowania.** `check-ai-coverage` czytał tylko `src/actions/`,
   a kontrola zaszytych kolorów tylko `src/components/`. Przeniesienie modułu **wypisywało jego akcje
   z pokrycia AI i z kontroli dostępu**, a widok z zakazu zaszytych kolorów — bez jednego czerwonego
   komunikatu. Refaktor czysto organizacyjny osłabiłby bezpieczeństwo, nie zmieniając linijki logiki.
2. **`next lint` przy niepoprawnej konfiguracji kończy się kodem 0.** Wypisuje „ESLint configuration
   … is invalid" i przechodzi dalej. Reguła granic przestaje wtedy działać przy zielonym buildzie —
   czyli dokładnie to, przed czym ostrzega rozdz. 14. Stąd `check:boundaries`: bramka nie czyta
   konfiguracji, tylko ją **wywołuje**, próbując złamać obie reguły.
3. **`tsc` nie widzi plików testowych** (`tsconfig.json` wyklucza `src/**/*.test.ts`). Dwa testy
   importowały pliki przeniesione do `platform/`; typecheck był czysty, a wykrywał to dopiero
   40-sekundowy `test:unit`. Stąd `tsconfig.test.json` + `check:test-types` w buildzie.

**Weryfikacja**

Klikacz ścieżki szczęśliwej: **22/22** (21 modułów + odczyt rejestru) — w tym wszystkie cztery
przeniesione. Testy jednostkowe 566/566. Komplet bramek zielony, `next build` przechodzi.
Pełny zestaw klikaczy pokazał 19 czerwonych, wszystkie z powodów **niezwiązanych z przebudową**:
brak danych z seeda w tym środowisku (`QaEpic`, `ShoppingList`, `Note` mają po 0 wierszy) oraz trzy
przypadki niestabilne pod obciążeniem równoległym — `smoke.spec.ts` uruchomiony osobno daje 12/12.

**Poza zakresem — jawnie, żeby nic nie zginęło**

- **17 modułów czekających na przeniesienie:** Strona główna, Kalendarz, Zakupy, Zadania, Notatki,
  Zwierzęta, Kuchnia, Nauka języków, Zdrowie, Wiadomości, Pogoda, Nawyki, Usługi, Flota, Portfel,
  Magazynowanie, Warsztaty. Żyją na **jawnie nazwanej liście przejściowej** w `src/lib/modules.tsx`,
  która ma się kurczyć do zera.
- **Zdolności platformy odłożone:** `lib/ai` (25 plików / 97 importujących), `lib/llm` (8/55),
  `lib/jobs` (5/45). Nie były potrzebne modułom pilotażowym, a ich przeniesienie podwoiłoby diff.
- **Zadanie 8** (asystent AI składany z deklaracji) — dokument stawia je ostatnim w fazie.
- **Pulpit i kalendarz** nie wynikają jeszcze z deklaracji: zasilają je moduły, których w
  `src/modules/` jeszcze nie ma. Pola dojdą do `defineModule` razem z nimi.

### 047 — Faza 1, fala 2: siedem kolejnych modułów · 2026-08-05

Powtórzenie wzorca z 046 — bez wymyślania niczego nowego. Siedem modułów, **jeden commit na moduł**,
plus dwa długi nazwane w recenzji poprzedniego przebiegu.

**Przeniesione:** Nawyki, Nauka języków, Warsztaty, Magazynowanie, Notatki, Flota, Zdrowie.
Kolejność jak poprzednio — od jednego konsumenta zewnętrznego (Nawyki) do trzech, w tym pulpitu
i agregatu kalendarza (Zdrowie).

**Co ten przebieg pokazał o kontraktach**

Magazynowanie ma **47 eksportów akcji**; jego kontrakt ma **14**. To nie jest oszczędność dla
oszczędności — 47 pozycji w kontrakcie znaczyłoby dokładnie tyle samo, co brak kontraktu. Rozdz. 9
mówi, że rosnący kontrakt to **sygnał**, iż moduł robi za dużo; sygnał ma być widoczny, a nie
zagłuszony eksportem całości. Podobnie Warsztaty: 23 eksporty, 11 w kontrakcie.

**Trzy rzeczy, które NIE należą do modułów, mimo że tak brzmią**

Najciekawsza część tej fali okazała się nie „co przenieść", tylko **czego nie przenosić**:

- `lib/habitStats.ts` — nazwa mówi „Nawyki", a używają go `actions/medications`,
  `actions/notifications`, `kitchenExecutor` i `lib/medicationSchedule`. To wspólny helper dat.
- `lib/medicationSchedule.ts` — brzmi jak Zdrowie, ale korzysta z niego **agregat kalendarza**
  i narzędzia asystenta. Wciągnięcie go do modułu zmusiłoby kalendarz (jeszcze nie moduł) do importu
  kontraktu Zdrowia dla funkcji, która nawet nie dotyka bazy.
- `actions/tags.ts` — wygląda na część Notatek, ale tagi to **słownik współdzielony** z Kuchnią.
  Wciągnięcie ich do Notatek zabetonowałoby przypadkowe sprzężenie zamiast je rozwiązać. Docelowe
  miejsce: warstwa słowników platformy, razem z kategoriami i jednostkami — **osobne zadanie**.

Wniosek na kolejne fale: **przynależność pliku ustala się po jego konsumentach, nie po nazwie.**

**Świadome wyłączenie — nawigacja boczna powłoki**

`ModuleSidebar` importuje komponenty `*SideNav` wprost z `ui/` czterech modułów tej fali. Zostawiamy
to i **nazywamy**, zamiast udawać zgodność: kontrakt opisuje **dane, nie ekrany** (zasada przyjęta
w 046 przy Raportach), a przepuszczanie komponentu klienckiego przez plik importowany przez kod
serwerowy rozmywałoby granicę zamiast ją rysować. Właściwe rozwiązanie to **pole `sideNav`
w deklaracji, ładowane leniwie** — dokładnie ten wzorzec, który rozdz. 9.3 opisuje dla kafelka
pulpitu. To zmiana zachowania (import dynamiczny), więc nie mogła wejść do fali przenoszącej.
**Następny krok, nie przeoczenie.**

**Spłacone długi z 046**

- **Panel admina QA przez kontrakt.** `app/admin/qa/page.tsx` odpytywał Prismę z pominięciem
  kontraktu własnego modułu. `getAllEpics` się nie nadawał — zwraca **liczniki**, a drzewo
  redakcyjne potrzebuje treści; kontrakt dostał więc drugą funkcję (`getEpicTreeForAdmin`) zamiast
  rozdmuchanego wariantu jednej. Strona schudła o 30 linii mapowania.
- **Dane z seeda w środowisku klikaczy.** `scripts/e2e-web.sh` kończył na `migrate deploy`, więc
  ~16 testów było czerwonych z powodu pustych tabel. To gorsze niż czerwony test: **psuje wartość
  sygnału** — „czerwony" przestaje znaczyć „regresja". Skrypt odpala teraz istniejące seedy
  (idempotentne), a nie drugi zestaw danych obok.

**Lekcja o bramkach z 046, która zwróciła się dwa razy**

`check:test-types` (dodane w 046, bo `tsconfig.json` wyklucza pliki testowe) złapało w tej fali
**dwa** testy, które zostały w `src/lib` po przeniesieniu swojego kodu — SRS i wikilinków. Bez tej
bramki oba wyszłyby dopiero po 40 sekundach `test:unit`, albo wcale.

**Poza zakresem — jawnie**

- **10 modułów czekających:** Strona główna, Kalendarz, Zakupy, Zadania, Zwierzęta, Kuchnia,
  Wiadomości, Pogoda, Usługi, Portfel. To najbardziej sprzężone — zasilają pulpit i kalendarz.
- **Zdolności platformy:** `lib/ai` (25 plików / 97 importujących), `lib/llm` (8/55), `lib/jobs` (5/45).
- **Zadanie 8** (asystent AI składany z deklaracji) — dokument stawia je ostatnim w fazie.
- **Pole `sideNav` w deklaracji** — patrz wyżej.
- **Tagi do warstwy słowników platformy** — razem z kategoriami i jednostkami.
- **Zaostrzenie bramki rejestru** o wykrywanie modułów pisanych „po staremu" (AC-6 z 046) — możliwe
  dopiero przy **pustej** liście przejściowej, czyli po trzeciej fali.

### 048 — Faza 1, fala 3: DOMKNIĘCIE zadania 5 · 2026-08-05

Dziesięć ostatnich modułów — i nie były to resztki, tylko najbardziej sprzężone jądro aplikacji.
Po tym przebiegu **wszystkie 21 modułów stoi za granicą**, a lista przejściowa nie istnieje.

**Przeniesione:** Wiadomości, Pogoda, Usługi, Kuchnia, Zwierzęta, Portfel, Zakupy, Zadania,
Kalendarz, Strona główna.

**Sprzężenia międzymodułowe okazały się maleńkie — i to jest wynik pomiaru, nie szczęścia**

Rekonesans przed kodem pokazał, że cała „sieć zależności" między modułami to **pięć wywołań, każde
jednofunkcyjne**:

| Konsument | Dostawca | Co dokładnie |
|---|---|---|
| Kuchnia, Magazynowanie | Zakupy | `assertListAccess` |
| Pogoda, Nawyki | Zadania | `createTask` |
| Usługi | Portfel | `addEntry` |

Do tego Portfel wystawia `bookAutoExpense` dla Floty i Zakupów. Rozdz. 9 mówił, że kontrakt ma
**pokazać koszt sprzężenia**; okazało się, że koszt jest niski, tylko dotąd niewidoczny.

**Trzy rzeczy, które nie należały tam, gdzie leżały**

- **Słowniki zakupowe** (kategorie, jednostki, produkty, ikony) — spec zakładał, że są dzielone
  z Kuchnią. Sprawdzenie konsumentów tego **nie potwierdziło**: poza Zakupami nikt ich nie woła.
  Pojechały z Zakupami. Jedynym realnie współdzielonym słownikiem są **tagi** (Notatki + Kuchnia)
  i tylko one zostały poza modułami.
- **Globalny asystent** siedział w `components/home/`, choć powłoka montuje go na **każdej** stronie.
  To nie jest pulpit. Wyszedł do `components/assistant/` osobnym commitem — bez tego moduł Strona
  główna nie dałby się zamknąć bez importu z powłoki.
- **Feed aktywności** — jedynym konsumentem jest strona ustawień. Poszedł do `components/settings/`.

**Nawigacja boczna z deklaracji**

Powłoka importowała sześć komponentów `*SideNav` wprost z wnętrz modułów. Recenzja 047 nazwała to
warunkiem, nie życzeniem — i słusznie: po tej fali wszystkie sześć byłoby wnętrzami. `defineModule`
dostał pole `sideNav`, **ładowane leniwie**. Leniwość nie jest optymalizacją, tylko warunkiem
poprawności: `module.ts` czyta kod serwerowy, więc statyczny import komponentu klienckiego wciągnąłby
go do każdego takiego grafu. Drugi szczegół, który wygląda na kosmetykę, a nią nie jest: **cache
komponentów** — `dynamic()` wywołane w renderze tworzyłoby przy każdym przerysowaniu nowy typ, więc
React odmontowywałby nawigację i montował ją od nowa.

Efekt sprawdzalny: `grep` po `src/components/shell/` nie zwraca **ani jednego** importu wnętrza modułu.

**Cztery kolizje nazw plik/katalog**

Skrypt przepisujący importy dopuszcza `/` po aliasie — inaczej nie objąłby katalogów. Gdy jednak
**plik i katalog mają tę samą nazwę** (`actions/services.ts` + `actions/services/`, `lib/services.ts`
+ `lib/services/`, `lib/portfel.ts` + `lib/portfel/`, `lib/calendar.ts` + `lib/calendar/`), przepisuje
oba tak samo i importy pliku lecą w katalog. Wszystkie cztery złapał `tsc` natychmiast. Rozwiązanie:
katalogi dostały inne nazwy (`parts/`, `core/`), pliki weszły do modułu jako `lib/<nazwa>.ts` lub
`lib/index.ts`.

**Osiem zastanych porażek klikaczy — wszystkie okazały się błędami TESTÓW**

Dług nazwany w recenzji 047. Każdą odtworzono i zdiagnozowano; **żadna nie wymagała zmiany zachowania
aplikacji**:

- cztery scenariusze Zakupów — na `/shopping` są **trzy** przyciski „Nowa lista" (nawigacja boczna,
  nagłówek widoku, stan pusty); `.first()` trafiał w ten z paska bocznego, który nie otwiera
  formularza;
- lista raportów — `getByText` trafiał najpierw w **ukryty** element powłoki;
- formularz raportu — naruszenie trybu strict: wzorzec pasował też do pola treści;
- foldery notatek — asercja **nieaktualna**: widok mówi „Foldery notatek", nazwa „grupy" zniknęła
  z interfejsu dawno temu;
- dostęp do QA — „moduł dostępny w nawigacji" ma **dwie** poprawne postacie: włączony to link,
  domyślnie wyłączony (QA) siedzi w „Więcej…" jako **przycisk** do dołożenia go do menu.

**Domknięcie fazy**

Przy pustej liście przejściowej dało się wreszcie zrobić to, co 046 musiał odłożyć:
`check:module-registry` sprawdza teraz także **odwrotność** — identyfikator z rejestru nie może mieć
kodu poza swoim katalogiem (`src/actions/<id>.ts`, `src/components/<id>/`). Wcześniej reguła
zapaliłaby się na całym istniejącym kodzie. Sprawdzone testem negatywnym.

Usunięty martwy kod przejściowy: tablica `LEGACY`, parametr `legacy` w `mergeModules`, ostatnia gałąź
`legacyPermissionForPath`. Pusta tablica zostawiona „na wszelki wypadek" byłaby zaproszeniem, żeby
dopisać do niej moduł zamiast utworzyć katalog.

**Poza zakresem — co zostaje**

- **Zdolności platformy `ai` (25 plików / 97 importujących), `llm` (8/55), `jobs` (5/45)** — własny
  przebieg, następny w kolejce.
- **Zadanie 8** (asystent AI składany z deklaracji) — wymaga najpierw platformy `ai`. **To jedyne, co
  zostało z Fazy 1.**
- **Pola `dashboard`, `calendar`, `resources` w deklaracji** (rozdz. 9.3) — pulpit i kalendarz dopiero
  w tej fali stały się modułami; wyprowadzanie ich z deklaracji to następny krok.
- **Tagi do warstwy słowników platformy** — razem z ewentualnymi innymi słownikami wspólnymi.
- **Faza 2** (współdzielenie, `Workspace`, `ResourceGrant`) w całości.


### 049 — Faza 1: platforma AI i asystent z deklaracji (zadania 4 i 8) · 2026-08-11

Najbardziej sprzężony element systemu przeszedł za granicę. Po tym przebiegu **`src/platform/` nie
importuje ani jednego modułu** — ani wnętrza, ani kontraktu.

**Zadania 4 i 8 okazały się jednym ruchem, nie dwoma**

Rekonesans przed kodem pokazał, dlaczego zadanie 4 stało: osiemnaście plików w `lib/ai` i `lib/jobs`
importowało moduły. Przeniesienie ich do platformy „jak leci" złamałoby regułę, dla której cała Faza 1
powstała. Rozdz. 9.6 wskazywał wyjście — katalog asystenta ma się **składać z deklaracji** — więc
kolejność musiała być odwrotna do intuicyjnej: **najpierw kod modułowy wraca do modułów, dopiero
potem reszta jedzie do platformy jako czysta przenosina.**

**Co zniknęło**

| Równoległa lista | Było | Jest |
|---|---|---|
| Katalog akcji asystenta | mapa 16 bloków tekstu w `agentPrompt.ts` | `modules/<x>/ai/catalog.ts` |
| Rejestr egzekutorów | łańcuch 16 `if (module === …)` w trasie | pole `ai` w deklaracji |
| Narzędzia odczytu | `switch (name)` po 56 przypadkach, 1199 linii | `modules/<x>/ai/readTools.ts` |
| Handlery zadań w tle | ręczna mapa `JOB_HANDLERS` | pole `jobs` w deklaracji |
| Agregat kalendarza | 9 zapytań do tabel 6 modułów, 227 linii | pole `calendar` w deklaracji, 32 linie |

**Odstępstwo od rozdz. 9.3, świadome:** dokument pokazuje `ai: { actions, readTools }` jako pole
statyczne. W Omnii to by nie zadziałało — `MODULES` importuje `ModuleSidebar`, komponent **kliencki**,
a egzekutory to kod serwerowy. Wszystkie cztery nowe pola są więc **leniwe**, jak `sideNav` w 048.

**Dowód braku regresji, bo tu obietnica brzmiała „zero zmian"**

Przed pierwszą linijką kodu powstał zrzut powierzchni (`specs/049…/baseline.json`). Po przebudowie
porównany pozycja po pozycji: **read-toole 56 = 56 · egzekutory 16 = 16 · typy zadań 12 = 12 ·
akcje per moduł zgodne co do jednej (razem 160) · zdarzenia kalendarza 38 = 38, listy identyczne
co do znaku.**

Przy okazji wyszło, że **zwykły seed nie tworzy żadnych danych użytkownika** (konta powstają przez
OAuth), więc agregat kalendarza zwracał zero zdarzeń — a pusty wynik zgadza się z pustym nawet wtedy,
gdy przebudowa zgubi połowę źródeł. Stąd `scripts/fixture-calendar-surface.ts`: po jednym zdarzeniu
w każdym z siedmiu źródeł agendy.

**Trzy rzeczy, które złapały narzędzia, a nie oko**

- **Zgubiony `web_search`.** Rozbicie promptu na wkłady modułowe wycięło wiersz katalogu narzędzia,
  które nie ma implementacji w żadnym module (trasa obsługuje je osobno). Zapalił się test
  `buildReadToolsPrompt` — pierwszy raz, gdy zarobił na siebie.
- **O mało nie poszerzona allowlista zadań.** Pisząc rejestr platformowy odruchowo dopisałem
  `skins.generate`, którego **nigdy nie było** w `JOB_HANDLERS` (trasa woła je synchronicznie). To
  jest granica bezpieczeństwa — porównanie 12 = 12 nie jest formalnością.
- **Bramka rejestru na własnym kodzie.** Korzeń kompozycji agendy trafił najpierw do
  `src/lib/calendar/`, co po piątym teście z 048 czyta się jako „kod modułu Kalendarz poza jego
  katalogiem". Nazwa myliła, treść nie.

**Odpowiedź KODEM na pytanie kontrolne z rozdz. 14**

„Ile miejsc trzeba dotknąć, żeby dodać moduł?" → **jeden katalog + jeden import w korzeniu
kompozycji.** I nie jest to deklaracja, tylko rzecz wymuszona: `check:module-registry` ma teraz sześć
testów i wywala build, gdy kod modułu — albo jego wkład do asystenta czy kolejki — wyląduje poza
katalogiem modułu. Sprawdzone testem negatywnym.

**Poza zakresem — co zostaje z Fazy 1**

- **Migawka pulpitu z deklaracji** (druga połowa zadania 7) — **odłożona świadomie, z powodem**:
  w przeciwieństwie do kalendarza nie ma dla niej dowodu runtime. Agregat kalendarza jest funkcją,
  którą da się zawołać i porównać; migawka pulpitu powstaje **w miejscu**, w 322-liniowej trasie
  z dziesięcioma gałęziami na uprawnienia. Żeby zrzucić stan „przed", trzeba by ją najpierw
  wyodrębnić — czyli wykonać dokładnie tę zmianę, którą chcemy zweryfikować. Przenoszenie dziesięciu
  bloków obliczeń, którego jedynym sprawdzeniem byłby `tsc`, to ryzyko cichej regresji na produkcji.
  **Następny przebieg zaczyna od zbudowania tego dowodu**, dopiero potem przenosi.
- **Pole `resources`** (rozdz. 8.4) — należy do Fazy 2, ma sens dopiero z `Workspace`/`ResourceGrant`.
- **Read-toole przez `requireAccess`** (wymóg z rozdz. 9.6) — **realne zagrożenie bezpieczeństwa**
  i musi zostać zrobione, ale `requireAccess` powstaje dopiero w zadaniu 10. Zapisane, żeby nie
  zginęło przy przejściu do Fazy 2.

**Pierwszy krok Fazy 2:** zadanie 9 — modele `Workspace`, `WorkspaceMember`, `ResourceGrant`,
`ResourceInvitation`.

---

### 050 — Faza 1 DOMKNIĘTA: migawka pulpitu z deklaracji · 2026-08-11

**Zakres:** druga połowa zadania 7 — ostatnia równoległa lista opisująca moduł.
**Artefakty:** `specs/050-pulpit-z-deklaracji/`. **Wynik: Faza 1 zamknięta w całości.**

**Dlaczego 049 tego nie ruszyło i co się zmieniło**

Agregat kalendarza dało się porównać zdarzenie po zdarzeniu, bo jest **funkcją, którą można
zawołać**. Migawka pulpitu powstawała **w miejscu** — w 322-liniowej trasie z dziesięcioma gałęziami
na uprawnienia — więc żeby zrzucić stan „przed", trzeba było ją najpierw wyodrębnić, czyli wykonać
dokładnie tę zmianę, którą chcemy zweryfikować. Ten przebieg rozciął ten węzeł kolejnością:
**(1) czysta przenosina obliczeń do funkcji biorącej `userId` parametrem → (2) zrzut punktu
odniesienia → (3) dopiero potem rozbicie na wkłady.** Krok (2) był twardym warunkiem wstępnym: bez
niego przenosiny jedenastu bloków obliczeń miałyby za jedyne sprawdzenie kompilator.

**Trzy odkrycia, każde zmieniło plan (C-54)**

- **Skrypt nie wystarczył.** Pierwszy zrzut dał **6 niezerowych pól z 20**: siedem z jedenastu bloków
  woła kontrakty modułów, a te są Server Actions wywodzącymi użytkownika **z sesji** — poza żądaniem
  rzucają „headers was called outside a request scope", a `try/catch` zamienia to na zera. Zgodnie
  z własną zasadą listy zadań — *zrzut z zerami to brak dowodu, nie sukces* — punkt odniesienia
  powstał przez **tymczasową trasę diagnostyczną** odpytaną na działającym serwerze z ciasteczkiem
  sesji. Wynik: **19 z 20 pól niezerowych** (dwudzieste, `adminStats`, jest z założenia `null`).
- **Siedem bloków ignoruje parametr `userId`.** Wywodzą użytkownika z sesji, więc zasianie danych na
  osobnym koncie dawało zera — fixture musiał umieć siać **na istniejącym koncie** (`--email=`).
  Gdyby to wyszło po przenosinach, wyglądałoby jak regresja przenosin.
- **Raporty nie są bramkowane uprawnieniem modułu.** W zrzucie „bez uprawnień" `recentReports`
  zostało niezerowe. Korzeń kompozycji musi to uszanować: **moduł z `permission: null` wołamy
  zawsze.** Bramkowanie go „dla porządku" byłoby cichą zmianą zachowania — dokładnie tym, czego ten
  przebieg miał nie zrobić.

**Pomiar, który zmienił projekt — wspólny rejestr też jest plikiem zbiorczym**

Pierwsza wersja wpinała wkłady polem `dashboard` w `module.server.ts`, czyli tak jak `ai`, `jobs`
i `calendar`. Graf kompilacji strony głównej urósł z **1889 do 2117** modułów.

| wariant | `/auth/signin` | `/` |
|---|---|---|
| przed 050 (trasa importowała osiem kontraktów) | 1771 | **1889** |
| wkłady przez wspólny `MODULE_SERVER` | 1771 | **2117** |
| wkłady przez własny korzeń kompozycji | 1771 | **1903** |

Powód jest tą samą lekcją co kontrakt-barrel z 049, tylko **piętro wyżej**: `MODULE_SERVER` to obiekt
**czterech leniwych loaderów na moduł**, a webpack w trybie dev kompiluje cele `import()` osiągalne
ze statycznie zaimportowanego pliku. Kto importuje go dla **jednego** pola, płaci grafem za
**wszystkie cztery** — pulpit ciągnął egzekutory asystenta i handlery zadań w tle siedemnastu
modułów, których nie wywołuje ani razu. Wkłady pulpitu dostały więc **własny korzeń**
(`src/lib/dashboardContributors.ts`). Pozostałe **+14 to dokładnie liczba nowych plików** (jedenaście
wkładów, korzeń, składanie migawki, typ w platformie) — koszt kodu, nie napompowanego grafu.

**Cena tej decyzji i jak jest spłacona.** Wpięcie znikło z deklaracji modułu, więc nie widać go
w `module.server.ts`. Pilnuje go bramka, **w obie strony**: `dashboard.ts` bez wpięcia → build
czerwony; wpięcie wskazujące nieistniejący plik → build czerwony. Oba sprawdzone testem negatywnym.

> **Wskazanie na osobny krok:** `calendarContributors.ts`, `lib/ai/catalog.ts` i `lib/jobs/registry.ts`
> płacą dziś ten sam podatek — agenda kalendarza wciąga egzekutory asystenta. Rozdzielenie ich to ta
> sama operacja co tutaj. Nie zrobiliśmy tego w tym przebiegu, żeby nie mieszać dowodu równoważności
> migawki z przebudową trzech innych korzeni (C-53).

**Dowód braku regresji**

Zrzut porównany z punktem odniesienia **po każdej grupie wkładów**, nie raz na końcu: cztery razy
(T-6, T-7, T-8, T-10) plus po zmianie korzenia — za każdym razem **20 pól, IDENTYCZNE, w obu
wariantach** (z uprawnieniami i bez). Wariant „bez uprawnień" równa się `EMPTY_SNAPSHOT` w 19 polach
na 20; dwudzieste to `recentReports`, z powodu opisanego wyżej.

**Co zostało w trasie i dlaczego**

Celem było usunięcie gałęzi **modułowych**, nie opróżnienie pliku za wszelką cenę. Zostały:
aktywność, zaproszenia, preferencje pulpitu i ulubione widoki (**dane konta** — sięgają po sesję,
nie po dziedzinę modułu) oraz statystyki admina (**przekrój całej instalacji** — nie ma modułu,
którego byłyby własnością). Wciśnięcie ich w jakiś moduł na siłę byłoby gorsze niż zostawienie
w kompozycji z zapisanym powodem.

**Bramki:** build **exit 0**, `test:unit` **657/657**, liczniki **160 / 551 / 35 / 35** bez spadku,
`check:module-registry` **8 kontroli**, `check:boundaries` i `check:ui-contract` zielone.

**Pierwszy krok Fazy 2:** zadanie 9 — modele `Workspace`, `WorkspaceMember`, `ResourceGrant`,
`ResourceInvitation`. Do zabrania z Fazy 1: **read-toole asystenta wciąż nie przechodzą przez
`requireAccess`** (rozdz. 9.6) — wykonalne dopiero po zadaniu 10, i przy zasobach współdzielonych
przestaje to być teoretyczne.

---

### 051 — Faza 2 OTWARTA: przestrzenie i nadania (zadanie 9) · 2026-08-12

**Zakres:** fundament danych pod współdzielenie — cztery modele z rozdz. 8.3 **wypełnione danymi**,
przy zerowej zmianie zachowania aplikacji. **Artefakty:** `specs/051-przestrzenie-i-nadania/`.

**Dlaczego samo dodanie tabel by nie wystarczyło**

Puste tabele niczego nie dowodzą i niczego nie zabezpieczają. Dlatego migracja 0226 robi dwie rzeczy
naraz: tworzy tabele **i** wypełnia je z istniejących zespołów oraz kont. Backfill jest **w migracji,
nie w seedzie** — seed nie odpala się automatycznie po wdrożeniu, więc niezmiennik „każde konto ma
przestrzeń osobistą" wszedłby w życie dopiero wtedy, gdyby ktoś pamiętał go uruchomić.

**Dwa pola, których nie ma w szkicu rozdz. 8.3 — i bez których nic by nie działało**

`Workspace.personalUserId` i `Workspace.teamId`, oba nullowalne i **unikalne**. Dokument nie mówi,
czym przestrzeń jest połączona ze swoim źródłem, a bez tego połączenia trzy kryteria akceptacji są
niewykonalne: powtórzenie backfillu nie ma na czym oprzeć `ON CONFLICT`, zmiana składu zespołu nie ma
jak odnaleźć jego przestrzeni, a „dokładnie jedna przestrzeń osobista" zostaje obietnicą zamiast
więzem bazy. W PostgreSQL wartości `NULL` są w indeksie unikalnym traktowane jako różne, więc **jeden
indeks daje dwa niezmienniki naraz** i nie przeszkadza drugiemu rodzajowi przestrzeni. Kasowanie
lustra robi kaskada klucza obcego — ani jednej linijki kodu aplikacji.

**Najbardziej prawdopodobny cichy błąd, wypatrzony przed napisaniem kodu**

`Team.ownerId` jest **niezależny** od tabeli `TeamMember` — nic nie wymusza, żeby właściciel miał tam
wiersz. Odwzorowanie „po członkach" wygląda przy tym na kompletne i po cichu gubi właściciela.
Dlatego właściciel dochodzi **osobnym krokiem, po członkach**, przez `DO UPDATE` (żeby wygrał
z ewentualnym wierszem `member`) — i ma własny przypadek testowy oraz własny fixture.

**Uzgadnianie JEST detektorem rozjazdu**

Przez okres przejściowy ta sama informacja mieszka w dwóch miejscach, a rozjazd **nie objawia się
niczym**, bo nic przestrzeni jeszcze nie czyta — wyszedłby dopiero przy zadaniu 11. Zamiast pisać
osobne API „sprawdź, czy jest rozjazd", `reconcileWorkspaces` **zwraca liczbę zmian**: zero przy
drugim uruchomieniu to jednocześnie dowód idempotencji i dowód spójności. Dwa API byłyby dwiema
interpretacjami jednej reguły — czyli tym samym problemem, który tu naprawiamy, piętro wyżej.

Weryfikacja krzyżowa, która się opłaciła: `reconcileWorkspaces()` uruchomione na bazie **po backfillu
SQL** zwróciło `{0,0,0}`. TypeScript i SQL interpretują mapowanie ról identycznie — a to są dwa
niezależne zapisy tej samej reguły (prod nie wykona kodu TS przy `migrate deploy`).

**Defekt złapany przez testy, nie przez oko — i moja własna pomyłka w diagnozie**

DDL wygenerowałem przez `prisma migrate diff --to-schema-datamodel` i **dopisałem wyjście bez
przeczytania**. Diff dorzucił `DROP INDEX` na obu indeksach trigramowych wyszukiwania notatek oraz
trzy `ALTER COLUMN "updatedAt" DROP DEFAULT` na niezwiązanych tabelach — bo te obiekty żyją wyłącznie
w surowym SQL-u i z punktu widzenia schematu „nie powinny istnieć". Na produkcji objawiłoby się to
cicho: wyszukiwanie notatek spada na skan sekwencyjny.

Zmyliło mnie to dwa razy. Najpierw wziąłem padające testy `notesFts` za stan lokalnej bazy
i **odtworzyłem indeksy ręcznie** zamiast szukać przyczyny — po czym zniknęły znowu. Sprawcę pokazał
dopiero `grep "DROP INDEX" prisma/`: moja własna migracja. Naprawa: pięć instrukcji usunięte,
w migracji został komentarz wymieniający je **z nazwy** wraz z powodem, a cykl przeliczony od zera
z jawnym sprawdzeniem, że indeksy migrację **przeżywają**.

**Bramka, która milczała dokładnie tam, gdzie była potrzebna**

`check:schema-drift` tworzy bazę cienia i toleruje wyłącznie błąd „already exists". Rola bez
`CREATEDB` dostaje jednak „permission denied" **także wtedy, gdy baza cienia istnieje** — więc bramka
**pomijała całą kontrolę** i kończyła się sukcesem. Poprawka: zamiast ufać treści błędu, sprawdzamy
stan faktyczny (czy da się połączyć z bazą cienia). Po niej bramka po raz pierwszy realnie ruszyła
i **to ona wyłapała** `DROP INDEX` opisany wyżej. „Pominięty" nie jest zielony — to brak pomiaru.

**Co zostało świadomie niezrobione**

- **`ResourceGrant` i `ResourceInvitation` nie mają konsumenta** — pierwszy przyjdzie z zadaniami 10
  i 12. Odstępstwo od zasady „dowozimy razem z konsumentem", przyjęte, bo kształt jest rozstrzygnięty
  w rozdz. 8.3, a checklista trzyma wszystkie cztery byty w jednym zadaniu: jedna migracja zamiast
  dwóch na tych samych tabelach. **Nie kasować „w ramach porządków".**
- **Unikalność nadań linkowych nie działa** (`subjectType: "link"`, `subjectId: NULL`) — ta sama
  własność PostgreSQL, która wyżej pomaga, tu przeszkadza: `NULL != NULL`, więc dwa nadania linkowe
  do jednego zasobu przejdą. Poprawka to częściowy indeks w surowym SQL-u; robimy ją w zadaniu 12,
  gdy będzie wiadomo, czy nadania linkowe w ogóle wchodzą w pierwszej odsłonie.
- **Zadanie 11** (`workspaceId` na 46 modelach) — rozdz. 8.10 nazywa je najbardziej ryzykownym krokiem
  całej przebudowy i wymaga czterech osobnych etapów. Ten przebieg nie dotknął ani jednego z nich.

**Bramki:** build **exit 0**, `test:unit` **666/666**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:workspace-mirror` (nowa) zielona, `git diff` **bez ani jednego pliku** w `src/app/`
i `src/components/` — maszynowy dowód, że przebieg jest dla użytkownika niewidzialny.

**Co znalazła recenzja — dwa punkty, oba przechodziłyby build na zielono**

- **Trzeci punkt mutacji zespołów, o którym twierdziłem, że nie istnieje.** Wzorzec bramki szukał
  `prisma.team…`, a w transakcji interaktywnej mutacja nazywa się `tx.team…`. Po poszerzeniu wzorca
  wyszedł `lib/privacy/purge.ts`: przy usuwaniu konta przekazuje własność zespołu następcy, więc
  bez uzgodnienia przestrzeń zostawałaby **bez właściciela** — a po zadaniu 10 następca straciłby
  prawo zarządzania własnym zespołem. Bramka raportuje dziś **3 pliki**, nie 2.
- **Lustro mogło wywalić logowanie i tworzenie zespołu.** Wpięcia były zwykłym `await`, więc awaria
  zapisu, którego nikt nie czyta, przerywała operację użytkownika. Ryzyko jest asymetryczne, więc
  ścieżki użytkownika wołają teraz jawnie nazwane warianty ciche (`mirrorTeamWorkspace`,
  `mirrorPersonalWorkspace`), a wersje ścisłe zostają dla testów i uzgadniania. **W kodzie stoi,
  kiedy to przestaje być bezpieczne:** gdy przestrzenie dostaną pierwszego czytelnika.

**Uwaga procesowa:** pierwsze podejście do tego przebiegu przepadło razem z kontenerem — siedem
ukończonych zadań istniało wyłącznie w lokalnych commitach. Odtworzone z artefaktów i tej lekcji:
**push po każdym zadaniu**, nie po całym przebiegu.

---

### 052 — Zadanie 10: `requireAccess` jako zdolność platformy · 2026-08-12

**Zakres:** jedna odpowiedź na pytanie „czy wolno" — w platformie, z dziedziczeniem i cache'em per
żądanie — plus pierwszy konsument. **Artefakty:** `specs/052-requireaccess-platforma/`.

**Kolejność, która jest tu ważniejsza niż gdziekolwiek indziej**

To jest kod decydujący o dostępie do danych: błąd nie objawia się wolniejszą stroną, tylko cudzymi
danymi albo zablokowaną pracą. `tsc` nie ma tu nic do powiedzenia — stary i nowy guard mają tę samą
sygnaturę i mogą różnić się każdą pojedynczą odpowiedzią. Dlatego **tabela prawdy powstała przed
napisaniem mechanizmu**: macierz pięciu relacji × pięciu operacji, 25 komórek, zapisana jako punkt
odniesienia. Po przełączeniu — **identyczna**.

**Co pokazał sam punkt odniesienia, zanim cokolwiek zmieniliśmy**

Projekt zadań należący do **zespołu** jest dziś niedostępny **dla nikogo** — łącznie z właścicielem
zespołu. `TaskProject` ma kolumnę `ownerTeamId`, ale ani guard zapisu, ani ścieżka odczytu asystenta
jej nie czytają. Nowy mechanizm mógłby to „przy okazji" naprawić i **właśnie dlatego tego nie robi**:
poprawka uprawnień ukryta w przebudowie uprawnień jest nie do odróżnienia od błędu. Zachowanie
zostało co do znaku, a rozbieżność jest zgłoszona jako osobna rzecz do decyzji właściciela.

**Trzy decyzje projektowe, każda z ceną wypisaną w kodzie**

- **Katalog zasobów jest parametrem wymaganym**, bez wartości domyślnej — zapomniany argument
  zamieniłby się w ciche przyzwolenie. Podaje go korzeń kompozycji.
- **Moduł woła platformę z własnym katalogiem**, nie przez korzeń: sięgnięcie po `@/lib/sharing`
  z wnętrza modułu odwróciłoby zależność (moduł → korzeń → wszystkie moduły) i powtórzyło regresję
  z 049. Granica tego rozwiązania jest nazwana zawczasu: zasób, którego rodzic mieszka w innym
  module, będzie znakiem, że wołający należy do warstwy kompozycji.
- **Zadanie w projekcie nie ma własnego właściciela.** Kuszące `ownerId: createdById` dałoby twórcy
  dostęp **po wypisaniu go z projektu** — czyli więcej niż dziś. Osoba przypisana do zadania bez
  projektu dostała za to jawne pole `extraGrants`, zamiast zakłamywania pola `ownerId`.

**Co złapały testy, a nie oko**

- **`React.cache` nie degraduje się poza kontekstem żądania** — nie jest tam nawet funkcją i rzuca
  `cache is not a function`. Bez jawnej degradacji `requireAccess` wywalałby każde zadanie w tle
  i każdy skrypt. Wyszło przy pierwszym uruchomieniu tabeli prawdy.
- **`id` w `assertTaskAccess` musiało stać się wymagane.** Przy opcjonalnym wołający, którego
  `select` go nie pobiera, po cichu wracałby do starej reguły i nowy mechanizm nigdy by się tam nie
  uruchomił. Kompilator wskazał jedno takie miejsce.
- **Test izolacji budował syntetyczne zadanie bez wiersza w bazie.** Nowy guard czyta fakty
  o zasobie, więc test tworzy teraz prawdziwe zadanie — sprawdza tę samą regułę bliżej tego, jak
  działa aplikacja.

**Asystent (rozdz. 9.6)**

`get_task` pyta o dostęp tym samym mechanizmem co zapis, a zakres list przeniósł się z warstwy AI do
modułu — obok guardu, żeby lista i sprawdzenie nie mogły się rozjechać. Test obejścia sprawdza
**obie** drogi wejścia (identyfikator i tytuł, bo `get_task` rozwiązuje też nazwy) i został
**zobaczony na czerwono**: po podłożeniu dziury w zawężeniu zapytania oba przypadki padają.

**Pomiary (rozdz. 8.9)**

Właściciel rozstrzyga się **bez** pytania o nadania. Obcy: nadania czytane **dokładnie raz**, mimo
dwóch ogniw łańcucha. Sprawdzenie dostępu do projektu = **jedno** zapytanie, jak dawniej. Test mówi
też wprost, czego **nie** udaje: „zero zapytań dla właściciela" z rozdz. 8.9 opiera się na
`workspaceId`, którego zasoby jeszcze nie mają.

**Co dokładnie zamienia zadanie 11**

`ResourceFacts` to dziś `{ ownerId, ownerTeamId, parent }`. Zadanie 11 dokłada `workspaceId`
i zmienia **krok 1–2 rozstrzygania** w `platform/sharing/access.ts` — reszta (łańcuch, nadania
jednym zapytaniem, cache, deklaracje modułów) zostaje bez zmian. To ma być zamiana jednego kroku,
nie przepisanie.

**Co świadomie zostało**

- **Osiemnaście modułów bez deklaracji zasobów** (rozdz. 8.10 krok 8) — każdy wymaga własnej tabeli
  prawdy, więc dziewiętnaście naraz to dziewiętnaście niesprawdzonych zmian w kontroli dostępu.
- **Migracja `TaskProjectMember`/`TaskShare`/`PetShare` na nadania** — zadanie 12. Pilot **czyta**
  dzisiejsze mechanizmy, nie rusza danych.
- **Unieważnianie cache zdarzeniem** (rozdz. 8.9 pkt 3) — wymaga warstwy zdarzeń z Fazy 4.
- **Warianty ciche lustra przestrzeni z 051** — mają zniknąć razem z pierwszym czytelnikiem
  przestrzeni; `requireAccess` czyta dziś nadania, ale nie przestrzenie zasobów, więc termin
  przesuwa się na zadanie 11.

**Bramki:** build **exit 0**, `test:unit` **680/680**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:module-registry` **dziewięć kontroli**, `git diff` **bez ani jednego pliku** w `src/app/`
i `src/components/`.


---

### 053 — Projekty zespołowe przestają być martwe · 2026-08-12

**Skąd się wziął ten przebieg.** Nie z listy zadań, tylko z **tabeli prawdy zbudowanej w 052**.
Punkt odniesienia pokazał, że projekt zadań należący do zespołu jest niedostępny **dla nikogo** —
`ownerTeamId` nie dawało niczego ani przy zapisie, ani przy odczycie. Funkcja istniała w modelu
danych i nie istniała w praktyce: projekt widoczny, każda operacja odmówiona.

**Dlaczego osobno, a nie „przy okazji" w 052.** Bo to jest **rozszerzenie dostępu**, a 052 miało
dowieść równoważności. Poprawka wpleciona tam byłaby nie do odróżnienia od błędu przenosin,
a tabela prawdy przestałaby cokolwiek dowodzić. Tu widać dokładnie, co się zmienia.

**Zmieniła się DOKŁADNIE JEDNA komórka macierzy** — członek zespołu w projekcie zespołowym,
z „odmowa" na „dozwolone". Pozostałe 24 bez ruchu, co potwierdza porównanie. Punkt odniesienia
zaktualizowany **świadomie**, a asercja pilnująca dawnego zachowania zamieniona na dwie: nowy
zamiar i sprawdzenie, że osoby spoza zespołu nadal nic nie zyskują.

**Jak to jest wyrażone.** Deklaracja zasobu dostała opcjonalne pole `teamOwnership`
(`{ member, admin }`) — **domyślnie puste**, bo nie każdy moduł honoruje własność zespołową
i milczące przyznanie dostępu na podstawie samej obecności kolumny byłoby dokładnie tym, czego
052 zabroniło. Zadania deklarują `member: "editor"`, `admin: "manager"`: członek pracuje
w projekcie, właściciel/admin zespołu nim zarządza. Kontekst dostępu niesie teraz `adminTeamIds`,
czytane **razem** z resztą, więc sprawdzenie nie kosztuje dodatkowego zapytania.

**Rzecz, którą trzeba było domknąć razem ze zmianą:** zakres list. Bez tego członek zespołu miałby
prawo działać w projekcie, **którego nie widzi**, a asystent twierdziłby, że taki projekt nie
istnieje. `accessibleProjectIds` obejmuje więc teraz projekty zespołu — z tego samego miejsca, co
sprawdzanie dostępu.

**Znane ograniczenie, świadomie zostawione:** właściciel zespołu **bez wiersza `TeamMember`** nadal
nic nie zyskuje, bo `getUserTeamIds` (całoaplikacyjne pojęcie „moje zespoły") czyta członkostwa.
W praktyce `createTeam` zakłada właścicielowi taki wiersz; rozbieżność dotyczy zespołów tworzonych
z pominięciem tej ścieżki i jest tą samą, którą 051 rozwiązało po stronie lustra przestrzeni.

**Bramki:** build **exit 0**, `test:unit` **681/681**, liczniki **160 / 551 / 35 / 35** bez ruchu.


---

### 054 — `workspaceId` w bazie, etap 1 z czterech · 2026-08-12

**Co ten przebieg zrobił aplikacji: nic.** I to jest jego treść. Rozdz. 8.10 nazywa zadanie 11
najgroźniejszym krokiem całej przebudowy i podaje kolejność, której nie wolno skracać:
*(a) dodać kolumnę nullable, (b) wypełnić migracją, (c) przełączyć zapytania, (d) uczynić
wymaganą. **Nigdy w jednym kroku.*** Wykonane zostały **(a) i (b)**. Kolumna `workspaceId`
istnieje na **45 modelach**, jest wypełniona i **nie ma ani jednego czytelnika** — dostęp
i własność liczą się dalej przez `ownerId`/`ownerTeamId`.

**Dlaczego 45, a nie 46 z checklisty.** Zbiór wyznacza własność, nie licznik: kolumnę dostaje
model mający `ownerId` lub `ownerTeamId`. Dwa wykluczenia są świadome i zapisane w kodzie.
`Task` nie ma żadnej z tych kolumn — jego własność idzie przez `createdById`/`assigneeId`
i przez projekt, więc nie ma z czego wyliczyć przestrzeni. `Team` jest **źródłem** przestrzeni
(`Workspace.teamId`), a nie zasobem, który w jakiejś przestrzeni żyje; nadanie mu `workspaceId`
zamknęłoby pętlę „zespół należy do przestrzeni, która należy do zespołu".

**Pułapka, która wywaliła pierwszy przebieg backfillu:** `@@map`. `ADD COLUMN` generuje Prisma,
więc pisze nazwy **tabel**; backfill pisałem ręcznie i użyłem nazw **modeli**. Wyszło na
`ProjectGroup`, zmapowanym na `TaskView` — jedynym takim modelu w całym schemacie. Ręcznie pisany
SQL musi `@@map` uwzględnić sam, a jeden wyjątek na kilkadziesiąt tabel jest dokładnie tym
rodzajem różnicy, której się nie zauważa przy przeglądaniu.

**C-15 zadziałała za drugim razem z rzędu.** `prisma migrate diff` dopisał — niezamówione —
`DROP INDEX` na dwóch indeksach trigramowych notatek i trzy `ALTER COLUMN … DROP DEFAULT`.
Te same instrukcje, które w 051 skasowały wyszukiwanie notatek. Zostały usunięte, a nagłówek
migracji **wymienia je z nazwy**, żeby ich brak nie wyglądał na przeoczenie.

**Dowód kompletności wyprowadza listę tabel ze schematu**, zamiast ją powtarzać. Ręczna lista
sprawdziłaby to, o czym pamiętałem w dniu pisania testu, a pytanie brzmi odwrotnie: czy backfill
objął **wszystkie**. Test porównuje przy okazji dwa źródła prawdy — zbiór modeli z `workspaceId`
w schemacie i zbiór `ADD COLUMN` w migracji — bo rozjazdu w tę stronę `check:schema-drift` nie
złapie. Rozróżnia też **lukę** (właściciel ma przestrzeń, kolumna pusta → awaria) od **sieroty**
(właściciel przestrzeni nie ma, np. konto usunięte → liczba do raportu). Kontrola negatywna:
wyzerowanie kolumny na jednym rekordzie świeci test na czerwono, więc wiadomo, że mierzy.

**Zgodność SQL-a z TypeScriptem sprawdzona wprost:** `reconcileWorkspaces()` uruchomiony po
backfillu zwrócił `{0, 0, 0}` — obie implementacje tej samej reguły rozumieją ją identycznie.

#### Pozostałe trzy etapy zadania 11 — co obejmuje każdy

| Etap | Zakres | Dlaczego osobno |
|------|--------|-----------------|
| **2** | Utrzymywanie `workspaceId` dla **nowych** rekordów: każda ścieżka zapisu ustawia kolumnę razem z `ownerId`/`ownerTeamId` | Dotyka **każdej** akcji tworzącej zasób. Etap 1 był jednorazowy i odwracalny przez `DROP COLUMN`; ten wchodzi w kod aplikacji |
| **3** | Przełączenie **odczytów**: `ResourceFacts` dostaje `workspaceId`, kroki 1–2 rozstrzygania w `platform/sharing/access.ts` czytają przestrzeń zamiast pary właścicieli; zakresy list idą po `workspaceId` | To jest moment zmiany zachowania. Wymaga **tabeli prawdy przed i po**, tak jak 052 — porównania komórka po komórce |
| **4** | `NOT NULL` + rozstrzygnięcie losu sierot; usunięcie `ownerId`/`ownerTeamId` z odczytów; usunięcie **cichych wariantów lustra** z 051 | Nieodwracalne. Wolno dopiero, gdy etap 3 działa na produkcji i liczba sierot jest znana i wyzerowana |

Etap 3 jest tym, który wprowadza pierwszego czytelnika przestrzeni — a więc dopiero on zdejmuje
dług zapisany w 051 i przypomniany w 049: ciche warianty `mirrorTeamWorkspace`/
`mirrorPersonalWorkspace` mają wtedy zniknąć, bo rozjazd lustra przestanie być niewidoczny.

**Jedyna rzecz, która wyszła poza bazę — i to nie z wyboru.** Przebieg miał nie tknąć kodu
aplikacji i prawie się to udało: `next build` padł na `TagsManager`, gdzie podgląd etykiety
**jeszcze nieistniejącej w bazie** buduje się z literału obiektowego, a `TagChip` deklarował
`tag: Tag`. Kolumna dołożona do modelu weszła do wygenerowanego typu i literał przestał go
spełniać. „Zmiana tylko w schemacie" nie istnieje, dopóki typy Prismy są propsami komponentów.
Poprawka zwęża propsa do `Pick<Tag, "name" | "color">` zamiast dopisywać `workspaceId: null` —
komponent rysujący dwa pola nie ma powodu wymagać kompletu kolumn tabeli, a dopisanie pola
wróciłoby przy każdej następnej kolumnie, w tym w etapie 4. Kryterium AC-4 zostało z tego powodu
skorygowane w specu (C-54): mierzy **zachowanie aplikacji**, nie nietykalność sygnatur.

**Bramki:** build **exit 0**, `test:unit` **683/683**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:schema-drift` zielony (schemat = katalog migracji), `git diff` **bez ani jednego pliku**
w `src/app/`, `src/components/` i `src/actions/`; w `src/` poza testem wyłącznie dwa pliki
powyższej poprawki typu.


---

### 055 — `workspaceId` utrzymywany dla nowych rekordów, etap 2 z czterech · 2026-08-12

**Dług, który rósł sam.** Po 054 kolumna była kompletna wobec danych z chwili migracji i
**niekompletna wobec przyszłych**: rekord utworzony później dostawał `NULL`, bo nic go nie
ustawiało. Etap 3 (przełączenie odczytów) takiego rekordu **po prostu by nie zobaczył** — zasób
zniknąłby właścicielowi z listy. Dlatego etap 2 idzie zaraz po etapie 1, a nie „kiedyś".

**Najważniejsza decyzja tego przebiegu: wyzwalacz w bazie, nie kod w ścieżkach zapisu.**
Własność ustawiają dziś **224** wywołania `create`/`createMany`/`upsert` w **75** plikach.
Dopisanie kolumny w każdym z nich miałoby jedno sprawdzenie — kompilator — a **kompilator nie widzi
BRAKU pola opcjonalnego**. To ten sam kształt, co lekcja „opcjonalny identyfikator w guardzie =
ciche wracanie do starej reguły".

Naturalnym drugim odruchem było **rozszerzenie klienta Prismy**. Odrzucone świadomie: widzi tylko
zapisy przechodzące przez ten konkretny egzemplarz klienta i tylko na najwyższym poziomie wywołania.
Omijają je zapisy zagnieżdżone, surowy SQL (repo go używa — seedy w migracjach, `lib/privacy/purge.ts`),
skrypty i wszystko, co ktoś napisze importując `PrismaClient` wprost. Byłoby to rozwiązanie, które
**wygląda** na jedno miejsce, a i tak wymagałoby bramki ścigającej obejścia.

Wyzwalacza nie omija nic. To jest ta sama zamiana, którą Omnia robi wszędzie: zamiast **wykrywać**
pominięcie — uczynić je **niemożliwym**. Bramka `check:workspace-fill` pilnuje wobec tego
**mechanizmu**, nie wywołań: jedyne, co można pominąć, to założenie wyzwalacza na nowej tabeli.

**Jedna funkcja na 45 tabel.** `to_jsonb(NEW)` pozwala tej samej implementacji obsłużyć tabele
z obiema kolumnami własności i te z samym `ownerId` — brakujący klucz w JSON-ie to po prostu `NULL`,
bez dynamicznego SQL-a i bez dwóch wariantów. Reguła jest więc zapisana **raz**, i jest tą samą,
którą stosuje backfill 0227 i `resolveRole`: `ownerId` przed `ownerTeamId`.

**Czego wyzwalacz nie robi — trzy świadome ograniczenia.** Nie działa na `UPDATE` (przeniesienie
zasobu między przestrzeniami przy zmianie właściciela to operacja etapu 3; dziś zmieniałaby dane,
których nikt nie czyta, i zabrałaby etapowi 3 możliwość porównania stanu). Nie nadpisuje wartości
podanej wprost (etap 3, testy i migracje danych muszą móc ustawić przestrzeń same). Nie wywraca
zapisu, gdy właściciel nie ma przestrzeni — zostawia `NULL`, bo **zapis użytkownika jest ważniejszy
niż kompletność kolumny, której nikt jeszcze nie czyta**. Ten ostatni przypadek jest w teście
najważniejszy: mechanizm siedzi na ścieżce zapisu każdego modułu, więc błąd w nim objawiłby się nie
brakującym polem, tylko **odrzuconym zapisem**.

**Kiedy to znika:** w etapie 4, razem z kolumnami `ownerId`/`ownerTeamId`, z których wywodzi wartość.
Wyzwalacz jest urządzeniem **przejściowym**, nie elementem architektury docelowej — nagłówek migracji
mówi to wprost, żeby za trzy miesiące nikt nie uznał go za stan pożądany.

#### Co zostaje na etapy 3 i 4

| Etap | Zakres | Warunek wejścia |
|------|--------|-----------------|
| **3** | `ResourceFacts` dostaje `workspaceId`; kroki 1–2 rozstrzygania w `platform/sharing/access.ts` czytają przestrzeń zamiast pary właścicieli; zakresy list idą po `workspaceId`; przeniesienie zasobu przy zmianie właściciela | **Tabela prawdy przed i po**, porównana komórka po komórce (C-17). To pierwszy moment, w którym kolumna cokolwiek znaczy |
| **4** | `NOT NULL`; rozstrzygnięcie losu sierot; usunięcie `ownerId`/`ownerTeamId`; **usunięcie wyzwalacza i cichych wariantów lustra z 051** | Etap 3 działa na produkcji, a liczba sierot jest znana i wyzerowana |

**Bramki:** build **exit 0**, `test:unit` **689/689**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:workspace-fill` **45/45 tabel**, `check:schema-drift` zielony **bez nowych wyjątków**
(wyzwalacze są niewidoczne dla `prisma migrate diff`), `git diff` **bez ani jednego pliku**
w `src/app/`, `src/components/`, `src/actions/` i `src/modules/`.


---

### 056 — Rozstrzyganie dostępu czyta przestrzeń, etap 3A · 2026-08-12

**Moment, w którym kolumna zaczyna cokolwiek znaczyć.** Po 054 i 055 `workspaceId` był kompletny
i nieczytany — czyli cała Faza 2 była do tej pory **kosztem bez korzyści**: dwa modele własności,
wyzwalacz utrzymujący ten drugi i lustro przestrzeni, którego nic nie weryfikowało w działaniu.
Etap 3 to jedyny z czterech, który zmienia zachowanie.

**Szew z 052 zadziałał dokładnie tak, jak zapowiadał tamtejszy komentarz.** W `ResourceFacts`
doszło **jedno pole**, w `access.ts` zmienił się **jeden krok** (`rolaZWlasnosci`, 12 linii → 24).
Łańcuch rodziców, nadania czytane jednym zapytaniem i cache per żądanie — bez zmian. To jest
najlepszy dowód, że decyzja z 052, żeby platforma pytała o **fakty**, a nie moduł o **werdykt**,
była trafna: przy tej drugiej każdy z modułów odpowiadałby po swojemu i nie byłoby czego podmienić.

**Koszt nie wzrósł, bo zapytanie zostało to samo.** Kontekst potrzebował dwóch nowych rzeczy —
mojej roli w każdej przestrzeni i wskazania, która przestrzeń jest moja osobista. Oba doszły jako
pola i złączenie w **istniejącym** `workspaceMember.findMany`, nie jako czwarte zapytanie.
Przestrzeń osobistą rozpoznajemy po `personalUserId === userId`, a **nie** po `kind === "personal"`:
`kind` mówi, jakiego rodzaju jest przestrzeń, a `personalUserId` — czyja. Gdyby ktoś kiedyś był
członkiem cudzej przestrzeni osobistej, sprawdzanie `kind` dałoby mu w niej rolę właściciela.

#### Rzecz najważniejsza: fixture mierzył co innego, niż deklarował

Pierwszy przebieg tabeli prawdy po przełączeniu był **zielony na wszystkich 25 komórkach**
i był to wynik **bezwartościowy**. Fixture tworzy użytkowników wprost przez Prismę, z pominięciem
zdarzenia logowania — więc nie mieli przestrzeni osobistych, wyzwalacz z 0228 nie miał czego
wpisać, `workspaceId` zostawał pusty, a rozstrzyganie schodziło **gałęzią awaryjną** na `ownerId`.
Tabela dowodziła, że działa **stara reguła**. Zieleń oznaczała „nowy kod się nie uruchomił".

Po założeniu przestrzeni w fixture wynik zrobił się taki, jaki miał być: **dokładnie jedna
zmieniona komórka** — „właściciel projektu" × „projekt zespołowy", z odmowy na dozwolone. To jest
przypadek nazwany **z góry** w specu (§5): właściciel zespołu **bez wiersza `TeamMember`**. Lustro
przestrzeni z 051 celowo wpisuje go do przestrzeni jako `owner`, a `getUserTeamIds` czyta wyłącznie
członkostwa — więc do dziś nie widział zasobów własnego zespołu. Ta różnica po prostu przestała
istnieć. Pozostałe **24 komórki bez ruchu**.

Zmiana wyszła **tam, gdzie tabela już patrzyła** — nie trzeba było dopisywać wiersza, żeby ją
zobaczyć. Plan zakładał inaczej i został poprawiony (C-54).

#### Gałąź „bez przestrzeni" nie jest wyłącznie przejściowa

Planowanie odkryło rzecz, której spec nie przewidział: **nie każdy zasób ma i będzie miał**
`workspaceId`. `Task` nie jest wśród 45 modeli objętych migracją 0227, bo **nie ma `ownerId`** —
własność zadania idzie przez `createdById` albo przez projekt. Rozstrzyganie obsługuje więc oba
kształty faktów na stałe: **jest przestrzeń → decyduje przestrzeń; nie ma → para kolumn jak dotąd.**
Ta sama gałąź obsługuje sieroty po backfillu i ma na to własną kolumnę w tabeli prawdy: właściciel
zachowuje dostęp, obcy nic nie zyskuje.

**Własność zespołowa nadal wymaga deklaracji.** Przejście z `ownerTeamId` na `workspaceId` nie jest
powodem, żeby porzucić zasadę z 052/AC-5: sama obecność przestrzeni niczego nie przyznaje, moduł
musi podać `teamOwnership`. Rola `guest` dostaje jawnie **nic** — nic jej dziś nie produkuje, więc
przypisanie jej czegokolwiek byłoby poszerzeniem dostępu na zapas.

#### Co zostaje

| Etap | Zakres |
|------|--------|
| **3B** | **Zakresy list** — `OR: [{ownerId}, {ownerTeamId}]` w zapytaniach kilkunastu modułów → `workspaceId: { in: … }`. Osobno, bo przy jednej zmianie nie da się odróżnić błędu przenosin od błędu zakresu. Tam też: przeniesienie zasobu między przestrzeniami przy zmianie właściciela |
| **4** | `NOT NULL`, los sierot, usunięcie `ownerId`/`ownerTeamId`, zdjęcie wyzwalacza z 055 i cichych wariantów lustra z 051 |

**Bramki:** build **exit 0**, `test:unit` **690/690**, liczniki **160 / 551 / 35 / 35** bez ruchu,
licznik zapytań na sprawdzenie dostępu **bez wzrostu**, `git diff` bez ani jednego pliku
w `src/app/` i `src/components/`.


---

### 057 — Zakres własności w jednym miejscu, etap 3B krok 1 z dwóch · 2026-08-13

**Po co ten krok.** 056 przełączyło **rozstrzyganie dostępu** na przestrzenie. Zakresy list zostały
na parze kolumn — i było ich **79 w 52 plikach**. Rozdz. 8.2 obiecuje, że po zmianie zapytanie
brzmi `where: { workspaceId: { in: mySpaces } }`; żeby tę obietnicę spełnić **jedną** zmianą,
warunek musiał najpierw istnieć w jednym miejscu. Ten przebieg go tam przeniósł i **nie zmienił
w nim niczego**.

**Cztery zapisy tego samego znaczenia** — tyle znalazło się w repo:

| Zapis | Uwaga |
|-------|-------|
| `OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]` | bezwarunkowy; przy pustej liście wysyłał `in: []` |
| `OR: [{ownerId}, ...(teamIds.length > 0 ? […] : [])]` | ostrożniejszy, ten sam wynik |
| `teamIds.length ? … : …` | to samo bez `> 0` — i to on wywrócił pierwszy przebieg regexpa |
| `[{ownerId}, teamIds.length > 0 ? {…} : { id: "" }]` | **wartownik**: prawdziwy predykat, który nie pasuje do żadnego wiersza |

Ostatni jest najciekawszy. `{ id: "" }` działał, ale wyrażał „brak gałęzi" **sztuczką** — czytelnik
musi się domyślić, że pusty identyfikator nigdy nie wystąpi. Cztery zapisy jednej reguły to nie
kwestia stylu: każdy z nich trzeba by osobno znaleźć i osobno przełączyć w etapie 3B.

**Równoważność sprawdzona, nie założona.** Zdanie „`in: []` nie pasuje do niczego, więc warianty są
równoważne" jest prawdziwe, ale to zdanie **o Prismie**, a nie fakt z tego repo. Test
`ownershipScope.test.ts` porównuje kształty wprost — łącznie z tym, że helper **nie** wpuszcza
rekordów systemowych (`ownerId = null`), bo to odrębna reguła słownikowa i pomylenie ich dołożyłoby
po cichu dostęp do cudzych rekordów wspólnych.

**Bramka złapała dwa miejsca, których nie widział mój `grep`.** Sweep leciał po `--include=*.ts`,
a `src/app/kitchen/page.tsx` i `src/app/shopping/page.tsx` to **`.tsx`**. Gdyby bramka przeszukiwała
ten sam zbiór plików co sweep, oba zostałyby przy starej regule i wypadły z etapu 3B — a build
byłby zielony. To jest argument za tym, żeby bramka **nie** dziedziczyła założeń narzędzia, które
sprawdza.

**Trzy świadome wyjątki**, każdy z powodem w manifeście: gałąź awaryjna sierot z 056 (nie jest
zakresem własności, tylko jego dopełnieniem), skórki (reguła **szersza** — systemowe, swoje,
zespołowe i publiczne) oraz briefing (własność **projektu** zagnieżdżona w relacji zadania).

**Co robi 058:** przełącza `ownedWhere`/`ownedOr` na `workspaceId: { in: … }` — jeden plik, z tabelą
prawdy porównaną komórka po komórce, tak jak w 056. To jest właściwy etap 3B.

**Bramki:** build **exit 0**, `test:unit` **696/696**, liczniki **160 / 551 / 35 / 35** bez ruchu,
nowa `check:ownership-scope` z trzema wyjątkami, 76 z 79 miejsc przeniesionych.


---

### 058 — Zakresy list idą po przestrzeniach; etap 3B domknięty · 2026-08-13

**Zdanie z rozdz. 8.2 jest odtąd prawdą.** *„Dziś każde zapytanie musi obsłużyć oba przypadki
(`OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]`). Po zmianie: `where: { workspaceId: { in:
mySpaces } }`."* Po 057 warunek mieszkał w jednym miejscu, więc **zmiana reguły objęła jeden plik**,
a nie 79. To jest cały zysk z rozdzielenia kroku 1 i 2.

**Trzy gałęzie zamiast jednej** — i dwie z nich są przejściowe:

| Gałąź | Po co |
|-------|-------|
| `workspaceId in mojePrzestrzenie` | reguła docelowa; osobista i zespołowe to po prostu przestrzenie, których jestem członkiem |
| `workspaceId: null` + `ownerId` | **sierota** musi zostać widoczna dla właściciela, dopóki kolumna jest nullowalna |
| `workspaceId: null` + `ownerTeamId` | to samo dla sierot zespołowych |

**Warunek `workspaceId: null` przy gałęziach awaryjnych jest sednem, nie ozdobą.** Bez niego stara
reguła działałaby **obok** nowej i zbiory wyszłyby równe niezależnie od tego, czy gałąź po
przestrzeniach w ogóle działa — czyli dokładnie ta pułapka, w którą 056 wpadło i z której wyszło
dopiero po naprawie fixture'u. Tym razem zastosowana z wyprzedzeniem, z osobną asercją: test
sprawdza, że **bez** gałęzi po przestrzeniach zasób z wypełnioną przestrzenią **wypada** ze zbioru.

**Dowód jest równością zbiorów, nie kształtów.** 057 porównywało kształt zapytania, bo przenosiło
zapis. Tu zmienia się znaczenie, więc porównujemy **zbiory identyfikatorów** zwrócone przez bazę,
starym i nowym warunkiem, na tym samym fixture — z przestrzeniami, sierotą i cudzym zasobem.

**Trzecia kopia tej samej reguły.** Przy przełączaniu wyszło, że `platform/auth/ownership.ts` ma
`ownedByWhere` — funkcję robiącą dokładnie to samo, co helper z 057, tylko w innym pliku i z innym
zestawem konsumentów. 057 jej nie zauważyło, bo szukało wzorca `ownerTeamId: { in: … }`, a ta go
zawierała i została **zamieciona jak każde inne miejsce** — czyli bramka zadziałała, ale duplikat
funkcji przetrwał. Jej test sprawdzał **kształt starej reguły**; zastąpiony, bo utrzymanie go
znaczyłoby pilnowanie stanu, który świadomie zmieniamy (ten sam ruch, co w 053).

**Etap 3 zadania 11 jest domknięty w całości.** Rozstrzyganie dostępu (056) i zakresy list (058)
mówią tym samym językiem.

#### Co zostaje na etap 4 — ostatni

`NOT NULL` na `workspaceId`; policzenie i rozstrzygnięcie losu **sierot**; usunięcie
`ownerId`/`ownerTeamId` z odczytów i ze schematu; zdjęcie **wyzwalacza** z 055 i **cichych
wariantów lustra** z 051; usunięcie **gałęzi awaryjnych** z tego przebiegu i wyjątku
`sharingGuard.ts` z manifestu 057. Warunek wejścia: 3A i 3B działają na produkcji, a liczba sierot
jest znana i wyzerowana.

**Bramki:** build **exit 0** (22 bramki), `test:unit` **701/701**, liczniki **160 / 551 / 35 / 35**
bez ruchu, `check:ownership-scope` z trzema wyjątkami.


---

### 059 — Udostępnienia Zadań jako nadania, etap 1 z trzech · 2026-08-13

**`ResourceGrant` istniał, był czytany i był pusty.** Od 052 `resolveRole` sprawdza nadania jednym
zapytaniem dla całego łańcucha — tylko że nic ich nie zapisywało, więc dostęp członka projektu
przechodził **obok**, przez `extraGrants` w deklaracji modułu. Pole opisane tam jako „dostępy,
których nie da się wyrazić własnością ani nadaniem" przestaje być prawdą w chwili, gdy nadania
zaczynają istnieć.

**Dlaczego tylko Zadania, choć zadanie 12 wymienia trzy tabele.** `PetShare` wymaga, żeby Zwierzęta
miały **deklarację zasobu** — bez niej `resolveRole` nie zna typu `pets.pet` i nadanie nie daje nic.
Migracja bez deklaracji nie przeniosłaby udostępniania zwierząt, tylko **je zabrała**. To zależność
od zadania 13, której checklista nie pokazuje.

**Trzy etapy, ta sama kolejność co w zadaniu 11:** zapisywać obok → przełączyć odczyty z tabelą
prawdy → usunąć stare tabele.

**Cztery rzeczy, które trzeba było rozstrzygnąć, a nie było ich w tabeli z rozdz. 8.10:**

1. **Przestrzeń nadania to przestrzeń ZASOBU**, nie obdarowanego. `Task` nie ma kolumny
   `workspaceId` (nie było w nim `ownerId`, więc 0227 go nie objęło), więc bierzemy ją z projektu,
   a dla zadania luzem — z przestrzeni osobistej twórcy.
2. **Udostępnienie zespołowi → nadanie dla PRZESTRZENI** (`subjectType: "workspace"`), nie dla
   każdego członka z osobna. Rozstrzyganie czyta je z `ctx.workspaceIds`, więc obejmuje skład
   zespołu automatycznie — także po jego zmianie.
3. **Degradacja roli musi obniżać nadanie.** Lustro, które tylko dokłada, zostawiłoby przy zmianie
   `ADMIN → MEMBER` stare, wyższe nadanie — cichą odmowę odebrania uprawnień. Stąd `upsert`
   z `update: { role }`, a nie `createMany … skipDuplicates`.
4. **Rola spoza słownika nie tworzy nadania.** `resourceRoleFromLegacy` zwraca `null`, a nie
   „bezpieczny domyślny" — cicha degradacja do `viewer` przyznawałaby dostęp na podstawie danych,
   których nie rozumiemy.

**Bramka złapała `purge.ts` za pierwszym razem** — plik usuwający konto kasuje udostępnienia
hurtem w transakcji. `ResourceGrant` **nie ma klucza obcego do `User`** (nadanie ma przeżyć
usunięcie swojego autora), więc bez poprawki nadania usuniętego konta zostałyby w bazie jako cichy
dostęp. W 051 ta sama pułapka wyszła dopiero w recenzji, po poszerzeniu wzorca o `tx.`; tu wzorzec
miał `tx.` od początku i zadziałał od razu. **To jest wartość zapisanej lekcji.**

**Odwzorowanie ról żyje w jednym miejscu** (`resourceRoleFromLegacy`), wspólnym dla migracji SQL
i dla kodu. Rozjazd między nimi nie objawiłby się błędem — dałby inne role rekordom starym
i nowym, co wychodzi dopiero przy skardze użytkownika.

#### Co zostaje

| Etap | Zakres |
|------|--------|
| **2** | Przełączenie odczytów: `extraGrants` znika z deklaracji Zadań, dostęp członka projektu idzie przez nadania. Wymaga **tabeli prawdy** (C-17) |
| **3** | Usunięcie `TaskProjectMember` i `TaskShare` ze schematu; zdjęcie lustra i jego bramki |
| **PetShare** | Po zadaniu 13 dla Zwierząt — osobny przebieg, tą samą trójetapową drogą |

**Bramki:** build **exit 0**, `test:unit` **711/711**, liczniki **160 / 551 / 35 / 35** bez ruchu,
nowa `check:grant-mirror` (3 pliki mutujące, 1 świadomy wyjątek).


---

### 060 — Deklaracja zasobów Zwierząt; zadanie 13, moduł 2 z 19 · 2026-08-13

**Pierwszy moduł po pilocie.** 052 świadomie odłożyło osiemnaście modułów: *„każdy wymaga własnej
tabeli prawdy, więc dziewiętnaście naraz to dziewiętnaście niesprawdzonych zmian w kontroli
dostępu"*. Ten przebieg bierze jeden — Zwierzęta, bo jako jedyne poza Zadaniami **mają już
udostępnianie** (`PetShare`), więc deklaracja od razu ma co wyrażać zamiast być zapisem na zapas.

**Rzecz, dla której ta tabela prawdy powstała: `teamOwnership: { member: "manager" }`.**
Odwzorowanie „na logikę" dałoby członkowi zespołu `editor` — brzmi rozsądnie i **byłoby błędem**.
Dzisiejszy `assertPetAccess` przy własności zespołowej wraca **bez sprawdzania `needEdit`**, czyli
członek zespołu może wszystko to, co właściciel. `editor` **zabrałby uprawnienia**, których nikt
nie kazał zabierać — a przy dwóch dzisiejszych operacjach różnicy nie byłoby widać, więc wyszłaby
dopiero przy trzeciej, dołożonej kiedyś przez kogoś innego.

**Punkt odniesienia pokazał dwie różnice — i obie były tą samą, znaną zmianą.** Wiersz „właściciel
zespołu bez wiersza `TeamMember`", odczyt i edycja zwierzęcia zespołowego, z odmowy na dozwolone.
To dokładnie ta komórka, którą 056 nazwało dla Zadań; tu ujawniła się w drugim module, bo przyczyna
jest wspólna: rozstrzyganie czyta przestrzeń, a lustro z 051 wpisuje właściciela zespołu jako
`owner` mimo braku członkostwa. **Spec zakładał „identycznie" i został poprawiony przed przyjęciem
nowego wzorca** (C-54), a nie po. Pozostałe **22 komórki bez ruchu**.

**Guard został cienką nakładką.** `assertPetAccess` tłumaczy dwa poziomy dawnego API (`needEdit`)
na dwie operacje z deklaracji i **zachowuje dawne komunikaty** — łącznie z rozróżnieniem „zwierzę
nie istnieje" od „brak dostępu", którego platforma nie robi (na oba odpowiada odmową). Rozróżnienie
niosło informację i nie było powodu go tracić przy przenosinach.

**`extraGrants` czyta `PetShare` i rozwija udostępnienie zespołowe na członków** — bo to pole mówi
językiem „userId → rola". Po migracji na nadania zrobi to `subjectType: "workspace"` i rozwijanie
zniknie razem z funkcją. Bez tego pola przełączenie guardu **odebrałoby** działające udostępnianie.

**Co odblokowuje:** migrację `PetShare` na `ResourceGrant` — brakującą trzecią część zadania 12,
której 059 nie mogło zrobić właśnie z braku tej deklaracji.

**Bramki:** build **exit 0**, `test:unit` **719/719**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:module-registry` widzi wpięcie w obie strony.


---

### 061 — Udostępnienia Zwierząt jako nadania; etap 1 zadania 12 domknięty · 2026-08-13

**Zależność, której checklista nie pokazywała, właśnie się rozwiązała.** 059 przeniosło dwie z
trzech tabel udostępnień; `PetShare` czekał, bo nadanie dla typu `pets.pet` nie daje nic, dopóki
`resolveRole` tego typu nie zna. Migracja bez deklaracji zasobu nie przeniosłaby udostępniania
zwierząt — **odebrałaby je**. Deklarację dołożyło 060 i blokada zniknęła.

**Wszystkie trzy tabele z zadania 12 mają teraz etap 1.** `TaskProjectMember`, `TaskShare`
i `PetShare` zapisują nadania obok siebie; odczyty nadal chodzą starą drogą.

**Różnica, którą widać dopiero przy drugim module.** `extraGrants` Zwierząt musi **rozwijać**
udostępnienie zespołowe na członków, bo mówi językiem „userId → rola" — N zapytań przy N
udostępnieniach. Nadanie z `subjectType: "workspace"` załatwia to **jednym dopasowaniem** i obejmuje
zmiany składu zespołu automatycznie. To jest konkretny, mierzalny zysk z etapu 2, a nie sama
elegancja: dziś dodanie kogoś do zespołu nie zmienia nic w `extraGrants`, bo lista członków czytana
jest przy każdym sprawdzeniu.

**Bramka rozszerzona o `petShare` wskazała miejsce od razu** — czwarty plik mutujący udostępnienia.
Trzeci raz z rzędu wzorzec „mutujesz źródło, uzgadniasz lustro" zadziałał bez szukania.

#### Co zostaje w zadaniu 12

| Etap | Zakres |
|------|--------|
| **2** | Przełączenie odczytów: `extraGrants` znika z deklaracji Zadań **i** Zwierząt, dostęp idzie przez nadania. Wspólny dla wszystkich trzech tabel, z tabelą prawdy (C-17). **Warunek wejścia:** policzony na produkcji rozjazd tabela ↔ nadanie |
| **3** | Usunięcie `TaskProjectMember`, `TaskShare`, `PetShare` ze schematu; zdjęcie lustra i jego bramki |

**Bramki:** build **exit 0**, `check:grant-mirror` 4 pliki / 1 wyjątek, liczniki bez ruchu.


---

### 062 — Koniec cichej utraty pracy: wersjonowanie, zadanie 15 (mechanizm + pilot) · 2026-08-13

**Diagnoza 5.1 mówi to jednym zdaniem:** *„żaden model nie ma wersji, więc ostatni zapis wygrywa
po cichu"*. Dwie osoby edytujące ten sam rekord nie dostawały żadnego sygnału — praca jednej z nich
znikała **bez śladu w logach i bez powodu, żeby ktokolwiek jej szukał**. To nie jest ryzyko
teoretyczne: rozdz. 4 prostuje wcześniejsze analizy właśnie w tym punkcie — współpraca jest częścią
produktu, nie wyjątkiem.

**`updateMany` zamiast `update` jest sednem mechanizmu, nie szczegółem zapisu.** `update`
z warunkiem, który nie pasuje, **rzuca** — i nie da się odróżnić „ktoś mnie ubiegł" od „rekord nie
istnieje". `updateMany` zwraca **liczbę** zmienionych wierszy, więc `count === 0` plus osobne
sprawdzenie istnienia daje dwa różne, **prawdziwe** komunikaty. Użytkownik, który skasował zadanie
w drugiej karcie, nie może dostać „ktoś zmienił to zadanie" — dostałby zdanie nieprawdziwe
i myląco sugerujące, że jego praca gdzieś jest.

**Wersja jest opcjonalna po stronie wołającego — i to jest decyzja, nie niedoróbka.** Ścieżka
zapisu, która jej nie podaje, działa jak dotąd. Wymuszenie wersji wszędzie naraz zmieniłoby
zachowanie **każdej** akcji w aplikacji w jednym kroku, a jedynym dowodem byłby kompilator. Wersja
mimo to **rośnie przy każdym zapisie**, więc zadanie 16 dostanie na czym oprzeć `ConflictDialog`
bez kolejnej migracji.

**Pilot, nie czterdzieści kolumn.** `Task` i `Note` — dwa różne kształty współpracy: rekord
strukturalny (status, termin) i długi tekst. Kolumna na czterdziestu modelach, z których korzysta
jeden, to czterdzieści nieużywanych kolumn i zero dowodu.

**Dowód jest z równoległego zapisu, nie z lektury kodu.** Obie ścieżki wyglądają poprawnie;
różnicę widać dopiero, gdy dwa zapisy spotkają się na jednym rekordzie. Test odtwarza to
spotkanie: dwie osoby odczytują wersję N, obie zapisują — **pierwsza wygrywa, druga dostaje
konflikt**, a w bazie zostaje treść pierwszej. Przed 062 obie kończyły się sukcesem.

**Bramka wyprowadza zbiór modeli ze SCHEMATU**, nie z listy w skrypcie: rozszerzenie wersjonowania
na kolejny model automatycznie obejmuje go kontrolą, zamiast wymagać pamiętania o dwóch miejscach.
Wskazała dokładnie dwa pliki — po jednym na moduł pilota.

**Świadomie pominięte** (rozdz. 8.5.3): liczniki aktualizowane atomowo (`increment` jest
z definicji bezkonfliktowy), wpisy dziennikowe (tylko dopisywane) i zasoby jednego użytkownika
(`AssistantPref`, `DashboardPref`, `UserMenuPref` — nie ma z kim się ścigać).

**Co robi zadanie 16:** `ConflictDialog` — użytkownik dostaje wybór („zobacz różnice", „nadpisz",
„odrzuć moje", „scal ręcznie") zamiast surowego błędu, a wersja odrzucona trafia do kosza jako
robocza. Do tego czasu konflikt kończy się komunikatem po polsku, zrozumiałym bez kontekstu
technicznego.

**Bramki:** build **exit 0**, `test:unit` **727/727**, liczniki **160 / 551 / 35 / 35** bez ruchu,
nowa `check:versioning` (2 modele, 2 pliki zapisujące, manifest pusty).


---

### 063 — Odwołanie dostępu działa natychmiast; zadanie 17 · 2026-08-13

**Test napisany PRZED optymalizacją, którą ma pilnować.** Rozdz. 12.2 nazywa go „nowym
i nieoczywistym" i podaje powód: cache rozstrzygnięć dostępu (11.5, zadanie 29) grozi tym, że
odebranie uprawnień zadziała dopiero po wygaśnięciu wpisu — *„dziura bezpieczeństwa wprowadzona
przez optymalizację"*.

Dziś cache jest **per żądanie** (052), więc odwołanie jest natychmiastowe **z definicji**, bez
żadnego wysiłku. Łatwo z tego wyciągnąć wniosek, że testu nie warto pisać. Wniosek jest odwrotny:
**test pisany po wprowadzeniu cache opisuje to, co cache robi**; ten pisany teraz zostaje
**warunkiem, który cache będzie musiał spełnić**. Różnica między jednym a drugim to różnica między
dokumentacją a wymaganiem.

**Kontrola mocy zamiast pojedynczej asercji.** Sprawdzenie „nadanie z minioną datą nie daje nic"
jest zielone także wtedy, gdy odmowa bierze się z czegokolwiek innego — z literówki w typie zasobu,
z braku wpięcia deklaracji, z pomylonego identyfikatora. Dlatego zaraz po nim idzie ten sam
scenariusz z datą **przyszłą**, który musi być zielony na „dozwolone". Dopiero para tych asercji
mówi coś o dacie.

**Czego świadomie nie ma:** części „także przy aktywnym SSE". Strumienia zdarzeń w aplikacji nie ma
(Faza 4, zadania 21–23), a test na nieistniejący mechanizm sprawdzałby wyłącznie własną atrapę.
Dopisanie należy do zadania 23 i jest tam odnotowane.

**Bramki:** build **exit 0**, `test:unit` **733/733**.


---

### 064 — Zadanie 13 domknięte: trzy guardy, nie siedemnaście modułów · 2026-08-13

**Pomiar zmienił rozmiar zadania.** „Deklaracje `resources` we wszystkich modułach" wyglądało na
siedemnaście przebiegów po pilocie i Zwierzętach. Policzenie guardów pokazało co innego: decyzję
o dostępie **do pojedynczego rekordu** podejmuje **sześć** modułów. Pozostałe piętnaście rozstrzyga
albo samym **zakresem list** (ujednoliconym w 057/058), albo sprawdzeniem `ownerId === user.id`
**bez zespołów i bez udostępnień**.

Deklaracja dla modułu ściśle osobistego wyrażałaby dokładnie to, co platforma robi domyślnie —
piętnaście plików bez konsumenta, czyli dokładnie to, czego zakazuje C-35. **Zadanie 13 domyka więc
trzy guardy** (lista zakupów, przepis, książka kucharska) **plus jawną klasyfikację wszystkich
21 modułów** — bo bez niej pozycja checklisty zostałaby otwarta na zawsze, z niewiadomą „ile
jeszcze".

Klasyfikacja jest **bramką**, nie notatką: katalog w `src/modules` bez wpisu wywala build, wpis
`deklaracja` bez pliku `sharing.ts` też, i odwrotnie — plik bez wpisu. Powód jest wymagany.
Rozkład: **4 z deklaracją, 11 przez zakres, 6 tylko właściciel**.

**Platforma dostała jedno nowe pojęcie: zasób OTWARTY.** Przepis z `isPublic` to jedyny w aplikacji
dostęp **bez żadnej relacji** do zasobu — obcy czyta, ale nie edytuje. Nie wyraża tego ani własność,
ani nadanie per-osoba, więc bez tego pola Kuchnia musiałaby zostać przy własnym guardzie i zadanie
13 nie dałoby się zamknąć. Pole nazywa się `publicRole`, **nie `isPublic`**: platforma dostaje
rolę, a nie flagę, i nie wie, skąd moduł ją bierze. Kuchnia wyprowadza ją z kolumny; inny moduł
może z czegokolwiek.

**Trzeci raz ta sama zmieniona komórka.** Właściciel zespołu bez wiersza `TeamMember` zyskał dostęp
do listy zakupów i książki kucharskiej swojego zespołu — po 056 (Zadania) i 060 (Zwierzęta) to już
nie odkrycie, tylko **przewidywalna konsekwencja** czytania przestrzeni zamiast członkostw.
Pozostałe 19 komórek bez ruchu, w tym **cały przepis publiczny**.

Warto to nazwać: **gdy ta sama różnica pojawia się trzeci raz, przestaje być niespodzianką i staje
się regułą** — a regułę trzeba zapisać raz, zamiast odkrywać ją w każdym module z osobna. Zapisana
jest w specach 056, 060 i 064; etap 4 zadania 11 usunie jej źródło, bo `getUserTeamIds` przestanie
być drugą definicją przynależności.

**Bramki:** build **exit 0**, `test:unit` **738/738**, `check:module-registry` **dziesięć kontroli**
(doszła klasyfikacja), liczniki **160 / 551 / 35 / 35** bez ruchu.


---

### 065 — Asystent nie jest drogą obejścia uprawnień; zadanie 18 · 2026-08-13

**Zdanie z rozdz. 12.2.1 przesądza kształt rozwiązania:** *„Przy 160 akcjach AI nie da się tego
zweryfikować ręcznie."* Więc nie test per moduł, tylko **bramka na wszystkich szesnastu** plikach
narzędzi odczytu — plus test **zachowania** tam, gdzie role naprawdę się różnią.

**Dlaczego akurat asystent.** Czyta wszystkie moduły, nie przechodzi przez UI i dostaje
identyfikatory **wprost z rozmowy**. Podanie cudzego identyfikatora nic nie kosztuje — nie trzeba
niczego omijać, wystarczy poprosić.

**Pierwsza wersja bramki dała fałszywy alarm na sześciu modułach** i to jest najciekawsza część
tego przebiegu. Szukałem `requireAccess` i `ownedWhere`, a Nawyki zawężają przez lokalne
`ownerScope(userId)`, Zakupy przez `accessibleListWhere(userId)`, Pogoda przez jawne
`ownerId: userId`. Wszystkie **poprawne** — tylko innym mechanizmem. Bramka, która zna jeden
sposób robienia rzeczy, nie mierzy bezpieczeństwa, tylko **zgodność ze stylem**.

**Jeden przypadek został po rozszerzeniu wzorca — i jest prawdziwie inny.** `reports` woła
`searchReports(q)` z kontraktu i **nie używa** przekazanego `userId`. Wygląda na lukę, nie jest nią:
zawężenie siedzi poziom niżej i bierze użytkownika z **sesji** (`requireAuth`), filtrując po
„mój / systemowy / mojego zespołu". Parametr narzędzia jest zbędny, bo asystent działa w imieniu
zalogowanego — sesja i `userId` to ta sama osoba.

To jest dokładnie ten rodzaj rozstrzygnięcia, którego **wzorzec tekstowy nie zrobi**, więc wpis
w manifeście opisuje mechanizm i mówi, **gdzie sprawdzić**, gdyby sesja i `userId` kiedyś przestały
oznaczać tę samą osobę.

**Test zachowania dla Zwierząt**, bo bramka odpowiada na „czy widać mechanizm", a dokument pyta
o skutek. Zwierzęta to drugi (po Zadaniach) moduł, w którym **„mam dostęp" i „wolno mi zmieniać"
to dwie różne rzeczy** — jedyne miejsce, gdzie scenariusz z dokumentu („`viewer` prosi asystenta
o zmianę") w ogóle da się odtworzyć. Tam, gdzie są dwa stany (moje / nie moje), pomyłka jest
znacznie trudniejsza i bramka wystarcza.

**Bramki:** build **exit 0**, `test:unit` **742/742**, nowa `check:ai-access` (16 modułów,
1 świadomy wyjątek), liczniki **160 / 551 / 35 / 35** bez ruchu.


---

### 066 — Okno konfliktu; zadanie 16 · 2026-08-13

**062 rozwiązał poprawność i nie rozwiązał użytkownika.** Zapis oparty na nieaktualnym odczycie
przestał przechodzić — ale człowiek po drugiej stronie dostawał surowy błąd i tracił to, co
napisał. Rozdz. 8.5.2 stawia zasadę, którą to okno dopiero realizuje: *„konflikt nigdy nie kończy
się utratą pracy użytkownika bez jego świadomej decyzji"*.

**Dlaczego to nie jest `confirm` z inną treścią.** Potwierdzenie ma dwa wyjścia i jedno z nich jest
bezpieczne — „anuluj" nie kosztuje nic. Tu **każde** wyjście coś kosztuje: nadpisanie kasuje cudzą
pracę, odrzucenie własną. Stąd **trzy** przyciski, każdy nazwany tym, co zrobi, i **żaden
domyślny**. Trzecim jest „wróć do edycji" — jedyne wyjście, którego nie trzeba cofać.

**Odrzucenie zapisuje wersję roboczą do kosza.** Bez tego przycisk „odrzuć moje zmiany" byłby
utratą pracy jednym kliknięciem — czyli dokładnie tym, co zadanie 15 miało skończyć, tylko
w ładniejszym oknie. Wersja robocza idzie do **istniejącego** kosza, nie do nowej tabeli: kosz już
umie retencję, przywracanie i sprzątanie, a odrzucona wersja nie różni się od usuniętego rekordu
niczym, co wymagałoby osobnego bytu. Tytuł dostaje prefiks „Wersja robocza (konflikt)", bo w koszu
stoi obok skasowanych zasobów i bez tego wyglądałaby na jeden z nich.

**Degradacja poza powłoką jest testowana i celowo bezczynna.** Kuszące byłoby zwracać „nadpisz"
(„przecież to najczęstszy wybór") — i wtedy komponent użyty w teście, w playgroundzie albo
w miejscu, gdzie ktoś zapomniał providera, **kasowałby cudzą pracę bez pytania**. Zwraca „wróć do
edycji". Żeby dało się to sprawdzić bez runtime'u Reacta, wartość jest wyprowadzona z hooka do
osobnej stałej — hook poza renderem i tak by się wywalił, więc test hooka sprawdzałby Reacta,
nie regułę.

**Czego świadomie NIE ma: widoku różnic i scalania ręcznego.** Oba wymagają porównywania **pól
konkretnego modułu**, a okno platformy nie wie, czym jest „termin" ani „status". Udawanie, że wie,
skończyłoby się mapą pól na typ zasobu **wewnątrz platformy** — dokładnie tym, czego zakazuje C-36.
Zamiast tego okno przyjmuje gotowy opis zmian (`podsumowanieZmian`) od modułu, który zechce go
podać; dopóki nikt nie poda, okno mówi prawdę: „ktoś zmienił ten element". Pełne różnice wracają
jako osobne zadanie, gdy pierwszy moduł będzie ich naprawdę potrzebował (C-35).

**Bramki:** build **exit 0**, `test:unit` **744/744**.


---

### 067 — „Udostępnione mi" i „Co udostępniłem"; zadanie 14, część odczytowa · 2026-08-13

**To jest wypłata za całą Fazę 2.** Rozdz. 8.7 mówi o tym widoku: *„możliwy tylko dzięki
jednolitemu modelowi — przy pięciu mechanizmach wymagałby pięciu zapytań i pięciu formatów"*.
Przed tą fazą pytanie „co mi udostępniono?" oznaczałoby zapytanie do `TaskProjectMember`,
`TaskShare`, `PetShare`, sprawdzenie `ownerTeamId` w kilkunastu tabelach i sklejenie pięciu różnych
słowników ról. Dziś to **jedno zapytanie do jednej tabeli**.

Warto to nazwać, bo do 066 cała Faza 2 była **niewidoczna dla użytkownika**: poprawna, przetestowana
i bez ani jednego ekranu pokazującego, po co była.

**Etykiety typów zasobów pochodzą z deklaracji modułów.** Mapa `"tasks.project" → "Projekt zadań"`
w warstwie widoku byłaby **szóstym** miejscem, w którym trzeba pamiętać o nowym typie zasobu — po
deklaracji, korzeniu kompozycji, klasyfikacji, migracji nadań i lustrze. Widok pyta katalog o
`label`; nieznany typ zostaje sobą, a nie „(nieznany)".

**Dwie decyzje, które wyglądają na drobiazgi, a nie są:**

- **Nadanie z minioną datą ważności nie pojawia się na liście.** Pokazanie go byłoby obietnicą,
  której `requireAccess` nie dotrzyma — użytkownik widziałby dostęp, którego nie ma. Ten sam
  warunek co w rozstrzyganiu, celowo powtórzony.
- **„Co udostępniłem" filtruje po PRZESTRZENI zasobu, nie po `createdById`.** Pytanie brzmi „co
  z moich rzeczy jest udostępnione", a nie „co ja osobiście kliknąłem". Nadania z migracji 0229
  i 0230 mają w `createdById` właściciela zasobu, ale nadanie wystawione kiedyś przez
  współpracownika dotyczy **mojego** zasobu i musi tu być widoczne.

**Czego świadomie nie ma: przycisku „odwołaj".** Rozdz. 8.7 wymienia „odwołanie dostępu jednym
kliknięciem" — i będzie, ale nie teraz. Dopóki dostęp rozstrzygają **dawne tabele** udostępnień
(etap 2 zadania 12 jest przed nami), usunięcie samego nadania **nic by nie zmieniło**. Przycisk
obiecywałby skutek, którego nie ma — a to gorsze niż jego brak. Ekran mówi to wprost, zamiast
milczeć.

**Bramki:** build **exit 0**, `test:unit` **744/744**, `check:ui-contract` **22/22**,
`check:ai-coverage` **553** akcji (dwie nowe jako `pending` — asystent powinien umieć odpowiedzieć
„co mi udostępniono?", więc to luka, nie wykluczenie).


---

### 068 — Paginacja kursorowa: mechanizm i zapadka; zadanie 20 · 2026-08-13

**Pomiar przed decyzją, jak zawsze w tej fazie.** Rozdz. 11.4 wymaga paginacji „we wszystkich
widokach listowych". W akcjach modułów i w `src/actions` jest **263** wywołań `findMany` **bez
`take`**. Przepisanie ich jednym przebiegiem to 263 niesprawdzone zmiany w zapytaniach — i każda
z nich **zmienia to, co użytkownik widzi** (część listy zamiast całości).

Więc ten przebieg nie udaje, że spłacił dług. Robi dwie rzeczy, które da się zrobić dziś i tanio:
**dowozi mechanizm** i **zatrzymuje wzrost**.

**Kursor, nie `skip`/`offset`** — i to nie jest kwestia gustu. `OFFSET 5000` każe bazie policzyć
i odrzucić 5000 wierszy, więc koszt rośnie z numerem strony. Gorzej: przy dopisaniu rekordu między
jedną stroną a drugą element **przesuwa się**, więc użytkownik widzi go dwa razy albo wcale.
Kursor wskazuje konkretny wiersz i jest odporny na zmiany powyżej.

**Trzy rzeczy, które psują się cicho** — i dlatego mają osobne testy:
- **granica strony**: „pełna strona" i „koniec danych" wyglądają identycznie, jeśli nie pobierze
  się o jeden wiersz więcej. Bez tego użytkownik dostaje przycisk „doładuj", który nic nie dokłada
  — a alternatywą jest drugie zapytanie z `count`, czyli dokładnie to, czego paginacja miała
  uniknąć;
- **`skip: 1`**: bez niego pierwszy wiersz kolejnej strony to duplikat ostatniego z poprzedniej;
- **sufit rozmiaru**: bez niego `?limit=100000` omija całą paginację jednym parametrem w URL-u.

**Zapadka zamiast bramki wszystko-albo-nic.** `check:pagination` liczy nieograniczone zapytania
i porównuje z zapisanym progiem. Zastane 263 przechodzą; **263 + 1 wywala build**. Nowy kod nie ma
powodu powiększać tego długu, a stary spłacimy modułami.

Jedna rzecz w tej bramce jest nieoczywista i celowa: **pada także wtedy, gdy licznik SPADNIE**,
żądając obniżenia progu. Bez tego zapadka trzymałaby na starym poziomie i po spłaceniu dziesięciu
zapytań pozwoliłaby dołożyć dziesięć nowych — czyli przestałaby być zapadką.

**Bramki:** build **exit 0**, `test:unit` **749/749**, nowa `check:pagination` (próg 263),
liczniki **160 / 553 / 35 / 35** bez ruchu.

### 069 — Reguły biznesowe wychodzą z plików akcji; zadanie 19 · 2026-08-15

**To nie była kwestia dyscypliny, tylko struktury — i pomiar to pokazał w jednej liczbie.**
Rozdz. 10.1 opisuje warstwę `domain/` jako reguły, które „nie znają Prismy, Reacta ani sesji"
i są „testowane jednostkowo, bez bazy, w milisekundach". Przed tym przebiegiem taki katalog nie
istniał w żadnym z 21 modułów.

Ale diagnoza „nikt nie pisze testów do reguł" była fałszywa. W `modules/*/lib/` stoją **33 czyste
pliki reguł, z czego 21 ma test** — rozbiór pozycji zakupowej, powtórki SuperMemo-2, genetyka
zwierząt, trasa po sklepie, faza księżyca. Omnia **umie** to robić i robi.

Różnicę robi jedna rzecz: **czy regułę dało się wyeksportować**. Plik oznaczony `"use server"`
**nie może wyeksportować niczego poza funkcją asynchroniczną** — a reguła biznesowa z definicji
asynchroniczna nie jest, bo tylko liczy. Reguła, która trafiła do takiego pliku, jest więc
**przymusowo prywatna**: nie ma jak wejść do testu. I rzeczywiście — reguł w `lib/` przetestowano
dwie na trzy, a reguł uwięzionych w plikach akcji: **zero na 55**.

**Klasyfikacja przed przenoszeniem, wzorcem z 064.** Kryterium: regułą jest funkcja odpowiadająca
na pytanie z dziedziny użytkownika (ile / kiedy / czy wolno / jak to nazwać), której wynik dałoby
się zakwestionować w rozmowie z właścicielem; adapterem — ta, która tłumaczy kształty, woła
infrastrukturę albo broni się przed złym typem. Wyszło **21 reguł i 34 adaptery**, i te 34 zostają
świadomie. Znak salda w Portfelu jest regułą; `toDTO` nie jest.

Osobno odnotowane jako adaptery: **skróty pogody i teksty promptów**. Kuszące, bo wyglądają na
logikę — ale test sprawdzałby, że napis brzmi tak, jak brzmi, i czerwieniłby się przy każdej
korekcie stylu prompta, nie wykrywając żadnego błędu. Testy, które trzeba poprawiać przy każdej
zmianie tekstu, uczą je wyłączać.

**Pierwszy test pierwszej reguły od razu coś znalazł.** `normalizeDays("")` zwraca `"0"`, czyli
niedzielę — bo `Number("")` to zero. Pusty wybór dni zapisuje nawyk jako „tylko w niedziele".
Test **utrwala** to zachowanie z komentarzem, zamiast po cichu poprawiać: co ma znaczyć pusty
wybór — „codziennie" czy „bez wskazania" — to decyzja właściciela, a nie skutek uboczny refaktoru.

**Najważniejsze znalezisko przyszło jednak spoza pomiaru.** Sprawdzając kandydatów na „bez reguł"
(spec wprost wymieniał „fałszywe poczucie domknięcia" jako ryzyko), w Magazynowaniu znalazła się
klasyfikacja **ABC** z progami 80/95 liczonymi od udziału narastającego, martwy zapas z granicą
N dni i trend ruchów — wszystko pisane **bez nazwy, wprost w ciele akcji**. Licznik 55 ich nie
widział, bo liczy funkcje **nazwane**. Są przez to tak samo niesprawdzalne, a ich pomyłki **nie
widać w żadnym wyniku**: wykres zawsze coś narysuje.

To jest **znana granica zapadki** i została zapisana w manifeście oraz w specyfikacji, zamiast
przemilczana. Zapadka pilnuje, żeby nie przybywało reguł nazwanych w plikach akcji; przed regułą
pisaną bez nazwy nie chroni.

**Czego świadomie NIE zrobiono** (C-53), każde z powodem zapisanym w manifeście:
- **Nie przeniesiono 33 plików z `modules/*/lib/` do `domain/`.** To kilkaset zmienionych importów
  bez zmiany jakiejkolwiek własności, którą ten przebieg obiecywał — te pliki już są eksportowalne
  i już mają testy. Zapłacilibyśmy dużym, ryzykownym diffem za zmianę nazwy katalogu.
- **Nie ujednolicono dwóch reguł sluga** (Kuchnia i QA różnią się podkreśleniem, wartością awaryjną
  i przycięciem do 80 znaków). Obie wyprodukowały już adresy istniejących rekordów.
- **Nie naprawiono `startOfToday`** w Zdrowiu, które liczy dobę z zegara **serwera**, choć Omnia ma
  `userTime.ts` do stref użytkownika. To potencjalny błąd, nie brak testu — własny przebieg.

**Dowód „bez bazy" jest dosłowny.** Postgres **zatrzymany**, 124 testy warstwy reguł, wszystkie
zielone, **1,9 s**. Sam brak importu Prismy nie byłby dowodem — zależność potrafi wejść tranzytywnie.

**Bramka `check:domain` pilnuje czterech niezmienników** (czystość warstwy, test obowiązkowy,
manifest w obie strony, zapadka) i **każdy z nich zobaczono na czerwono osobno** — siedem sond,
siedem właściwych komunikatów. Lekcja z 046 (`next lint` kończył się kodem 0 przy zepsutej
konfiguracji) i z 065 (wzorzec znający jeden idiom dawał fałszywe alarmy) obowiązuje wprost:
bramka pilnująca czterech rzeczy, sprawdzona na jednej, pilnuje jednej.

Manifest rozstrzyga dla **21 z 21** modułów: **domena 9 · reguły w `lib/` 7 · bez reguł 5**.
Przy „bez reguł" uzasadnienie musi mówić, **gdzie te reguły są**, jeśli nie w module — inaczej ta
decyzja byłaby tylko brakiem sprawdzenia.

**Bramki:** build **exit 0**, `test:unit` **873/873** (było 749; +124 testy warstwy reguł),
nowa `check:domain`, liczniki **160 / 553 / 35 / 35** bez ruchu, zapadka paginacji z 068 nadal 263.
Zero zmian w `src/app/**`, `src/components/**`, `modules/*/ui/**` i w migracjach — przebieg jest
niewidoczny dla użytkownika, co było wymogiem, nie skutkiem ubocznym.

### 070 — Zdarzenia domenowe: zapis nierozłączny z mutacją; zadanie 21 · 2026-08-15

**Faza 4 otwarta.** Rozdz. 9.1 stawia diagnozę, której dziś nic nie sygnalizuje: Omnia realizuje
**trzy różne rodzaje integracji** — odczyt, reakcję i zdolność — **jednym mechanizmem**,
bezpośrednim wywołaniem. Reguła rozstrzygająca brzmi: *brak odpowiedzi **zatrzymuje** operację →
kontrakt; brak odpowiedzi ją tylko **opóźnia** → zdarzenie*.

Konkret: zakończenie listy zakupów księguje wydatek w Portfelu **w tej samej ścieżce**, więc awaria
Portfela zabiera zakupy. Operacja, która miała się tylko opóźnić, zatrzymuje operację nadrzędną.

**Sednem był jeden warunek poprawności z rozdz. 9.4.2** — zapis zdarzenia poza transakcją to
*„najczęstszy błąd przy wdrażaniu outboxu"*. Groźny nie dlatego, że częsty, tylko dlatego, że
**nie daje żadnego objawu**: przy awarii pomiędzy zapisem stanu a zapisem zdarzenia jedno i drugie
się rozjeżdża, a jedynym śladem jest reakcja, która nigdy nie nastąpiła. Nie ma wyjątku, nie ma logu,
nie ma czerwonego testu.

**Dlatego zakaz musiał być techniczny — i tu przebieg dostał najlepszą lekcję.** Pierwsze podejście
brało `Prisma.TransactionClient` i zakładało, że to wystarczy. Sonda pokazała, że **nie**: ten typ to
`PrismaClient` **pomniejszony** o kilka metod, a w typowaniu strukturalnym obiekt z **nadmiarem**
pól jest przypisywalny do typu, który ma ich mniej. `emitDomainEvent(prisma, …)` kompilowało się bez
mrugnięcia. Zakaz „przyjmuj tylko węższe" nie działa, bo **szersze spełnia węższe**.

Kuszące było obniżyć kryterium akceptacji do „typ narzuca intencję, a pilnuje bramka". Zamiast tego
okazało się, że wystarczy **jedna zmiana typu**:

```ts
export type TransactionClient = Prisma.TransactionClient & { $transaction?: never };
```

Pełny klient **ma** `$transaction`, więc przestaje pasować; prawdziwy `tx` jej **nie ma**, więc pasuje
dalej. Sprawdzone sondą w obie strony: globalny klient → `TS2345`, `tx` → czysto. **Kryterium
akceptacji jest po to, żeby zmusić do znalezienia rozwiązania, a nie żeby dopasować je do pierwszej
próby.**

**Test wycofania jest ważniejszy niż test powodzenia.** Obecność wiersza po udanym zapisie nie mówi
nic — mówi dopiero jego **brak** po zapisie nieudanym.

**Pomiar znów zmienił zakres.** 23 transakcje w repo rozkładają się na dwie **niekompatybilne
formy**: 10 interaktywnych (`async (tx) => …`, mają klienta) i **9 tablicowych**
(`$transaction([...])`, klienta nie mają w ogóle). Z tych drugich emisja jest niemożliwa bez
przepisania działającej ścieżki zapisu — w tym `addEntry` w Portfelu, który liczy saldo. Świadomie
nietknięte.

Producentów jest **trzech**, każdy z **nazwanym przyszłym odbiorcą**, bo zdarzenie bez odbiorcy to
zapis do tabeli, którego nikt nie przeczyta: `shopping.list.completed` (→ księgowanie w Portfelu),
`magazynowanie.stan.zmieniony` (→ uzupełnianie zapasów do Zakupów), `kuchnia.spizarnia.spisana`
(→ brakujące składniki).

**Druga lekcja wyszła z testu mutacyjnego i dotyczy granic testu.** Testy mechanizmu **nie wołają
prawdziwych akcji**, bo te wymagają sesji, a repo nie ma wzorca jej podstawiania. Kusiło, żeby
„zasymulować" akcję w teście — i pierwsza wersja tak właśnie robiła, odwzorowując kształt pętli
spisu spiżarni. Mutacja polegająca na przeniesieniu emisji **do wnętrza pętli w prawdziwym kodzie**
takiego testu **nie czerwieni**: test sprawdza własną kopię, która jest poprawna.

Rozwiązaniem nie był lepszy test, tylko **piąta kontrola bramki**: producent deklaruje w manifeście
`ladunek` (`pojedynczy` | `zbiorczy`), a przy zbiorczym bramka zabrania emisji z wnętrza pętli — i
patrzy przy tym na **prawdziwy plik producenta**. Zakres testu został uczciwie nazwany w nagłówku:
sprawdza mechanizm, nie akcję.

**To jest outbox bez czytelnika i tak ma być.** Publikację dowozi zadanie 22; odwrotna kolejność
budowałaby czytelnik na źródle, które może kłamać. Kształt zdarzenia jest już pod nią przygotowany:
`id` powstaje przy **zapisie**, nie przy publikacji, więc jest stabilny między ponowieniami i posłuży
subskrybentowi za klucz idempotencji (rozdz. 9.4.4 — gwarancja „co najmniej raz").

**Co zostaje na 22–25:** worker czytający niedostarczone i oznaczający `deliveredAt`, z publikacją
przez `LISTEN/NOTIFY` (22), kanał SSE `/api/events` z kanałami przestrzeń/zasób/użytkownik (23),
usunięcie 45-sekundowego `setInterval` z sygnalizatora świeżości (24) oraz **przepięcie księgowania
wydatku z wywołania na subskrypcję** (25) — dopiero to zamknie problem, dla którego ten dziennik
powstał. Do rewizji przy 22: dziś brak przestrzeni **cicho pomija** zdarzenie; gdy zdarzenia zaczną
napędzać funkcje, ciche pominięcie stanie się cichą utratą funkcji.

**Bramki:** build **exit 0**, `test:unit` **883/883** (było 879), nowa `check:events` (pięć kontroli,
osiem sond negatywnych), migracja **0232**, liczniki **160 / 553 / 35 / 35** bez ruchu, zapadki 263
i 34 bez ruchu. Zero zmian w `src/app/**`, `src/components/**` i `modules/*/ui/**`.

### 071 — Outbox dostaje czytelnika; zadanie 22 · 2026-08-15

**070 zostawiło dziennik zdarzeń, którego nikt nie czyta — i tak miało być.** Ten przebieg dokłada
brakujący element z rozdz. 9.4.3: worker czyta niedostarczone, woła subskrybentów zadeklarowanych
w module, oznacza `deliveredAt`.

**Sednem nie była mechanika, tylko gwarancja.** Rozdz. 9.4.4 rozstrzyga świadomie: dostarczenie jest
**„co najmniej raz"**, nigdy „dokładnie raz" („koszt nieproporcjonalny do zysku"). Konsekwencja jest
twarda i łatwa do przeoczenia: **ponowienie nie jest sytuacją wyjątkową**. Następuje zawsze, gdy
worker padnie po wykonaniu subskrybenta, a przed oznaczeniem zdarzenia. Tego okna **nie da się
zamknąć** — subskrybent pisze do bazy własną transakcją — więc można je tylko uczynić nieszkodliwym.

Dlatego właściwą decyzją `queue.ts` było **kiedy** oznaczać dostarczenie:

| Kiedy | Awaria w oknie daje | |
|---|---|---|
| przy pobraniu | zdarzenie **pominięte** — reakcja nigdy nie nastąpi | ✗ gubi po cichu |
| **po sukcesie** | zdarzenie **ponowione** — reakcja wykona się dwa razy | ✓ „co najmniej raz" |

Wybór jest oczywisty dopiero wtedy, gdy się go wypisze: **lepiej dwa razy niż zero razy**, bo drugie
da się unieszkodliwić, a zera nie da się wykryć. Rezerwacja nie potrzebowała przy tym osobnej kolumny
„w trakcie" — `FOR UPDATE SKIP LOCKED` wewnątrz transakcji obiegu trzyma wiersze do końca, więc drugi
worker ich nie zobaczy.

**Wymóg idempotencji dostał bramkę, nie akapit.** To wniosek wprost z 070: zakaz emisji poza
transakcją wyrażony komentarzem nie zabraniał niczego, dopóki nie wszedł w typ i w bramkę. Tutaj
subskrybent **deklaruje**, jak zapewnia idempotencję (`klucz-unikalny` albo `naturalna`), a bramka
sprawdza, czy `klucz-unikalny` ma pokrycie: `upsert` **i** klucz wyprowadzony z `event.id` —
jedynej wartości **stabilnej między ponowieniami**, bo powstającej przy zapisie zdarzenia, nie przy
publikacji.

**Bramka najpierw potwierdzała dokumentację zamiast kodu.** Sonda „klucz nie z `event.id`" nie
zaczerwieniła jej, bo `event.id` występowało w **komentarzu** wyjaśniającym, że tak właśnie ma być.
Poprawka to jedna linijka (usuwanie komentarzy przed dopasowaniem wzorca), ale lekcja jest ogólna:
bramka czytająca tekst pliku czyta **także to, co napisaliśmy o kodzie**, nie tylko kod.

**Pierwszy subskrybent** (C-35) to `shopping.list.completed` → powiadomienie dla **pozostałych**
członków przestrzeni. To pierwsze użycie pola `actorId`, o które chodzi w rozdz. 9.4.1 („Marek
ukończył zadanie"). Dobrany tak, żeby **nie zabierać zakresu zadania 25**: odbiorcą jest zdolność
platformy, nie inny moduł. Dla użytkownika pracującego sam zmiana jest zerowa — w przestrzeni
osobistej nie ma nikogo innego.

**Test mutacyjny znalazł to, czego nie widziała żadna asercja:** usunięcie warunku „nie powiadamiaj
sprawcy" **nie czerwieniło** testu, bo test sprawdzał tylko skrzynkę drugiej osoby i nigdy nie
zapytał, czy sprawca dostał powiadomienie o własnym kliknięciu. Dopisana jedna asercja. Po niej
5 mutacji, 5 złapanych.

**Zapadka paginacji z 068 złapała mój własny kod.** Zapytanie o członków przestrzeni weszło bez
`take` i licznik podskoczył z 263 na 264 — build czerwony. Ograniczenie dopisane; przy okazji widać,
że zapadka pilnuje nie tylko cudzego długu.

**Czego świadomie nie zrobiono:** `LISTEN/NOTIFY` ani Redis Pub/Sub. Rozdz. 9.4.3 dopuszcza oba, ale
oba wymagają surowego połączenia poza Prismą (nowa zależność), a kupują wyłącznie **niższe
opóźnienie**. Opóźnienie zaczyna mieć znaczenie dopiero przy kanale czasu rzeczywistego —
i **tam** ta decyzja ma realny wymóg. Dokładanie zależności wcześniej byłoby kupowaniem na zapas (C-53).

**Co zostaje na 23–25:** kanał SSE `/api/events` z kanałami przestrzeń/zasób/użytkownik (23),
usunięcie 45-sekundowego `setInterval` z sygnalizatora świeżości (24) oraz **przepięcie księgowania
wydatku z wywołania na subskrypcję** (25) — dopiero to domknie problem, dla którego cała Faza 4
powstała: *awaria Portfela nie może zabierać zakupów*.

**Bramki:** build **exit 0**, `test:unit` **889/889** (było 884), nowa `check:subscribers`
(cztery kontrole, pięć sond), zapadki 263 i 34 bez ruchu, liczniki **160 / 553 / 35 / 35** bez ruchu.

### 072 — Koniec odpytywania: kanał czasu rzeczywistego; zadania 23 i 24 · 2026-08-15

**Dwa zadania w jednym przebiegu, bo osobno nie mają sensu.** Kanał bez konsumenta byłby tym, czego
zabrania C-35 — ogłoszeniem rozwiązania, którego nikt nie używa. A `DataFreshness` bez kanału nie ma
na co zamienić odpytywania. 23 dostarcza strumień, 24 go zużywa.

**Koszt, który znika.** Diagnoza 5.2: każda otwarta karta wołała `router.refresh()` co 45 sekund —
czyli **pełne przeliczenie komponentów serwerowych**, zapytania do bazy, render, transfer.
Trzy karty to ~240 przeliczeń na godzinę, z których prawie wszystkie zwracały to samo. Wartość była
przy tym odwrotna do częstotliwości: przy interwale 45 s użytkownik i tak czekał **średnio 22
sekundy** na cudzą zmianę.

Teraz: jedno trwałe połączenie na kartę, sygnał wtedy, gdy naprawdę coś się wydarzyło.

**Najciekawsza decyzja dotyczy tego, czego NIE zbudowano.** Łańcuch z rozdz. 11.1.1 przewiduje
w środku `LISTEN/NOTIFY` albo Redis Pub/Sub. Warto zapytać, **po co one tam są** — i odpowiedź jest
jedna: żeby worker z instancji A dosięgnął karty podłączonej do instancji B. Omnia chodzi na
**jednej** instancji, a oba warianty wymagają surowego połączenia poza Prismą, czyli nowej
zależności.

Wybrano więc **szynę w procesie** i **nazwano ograniczenie wprost** — w kodzie, w manifeście
i w `docs/devops/kanal-czasu-rzeczywistego.md`. Zamiana na `LISTEN/NOTIFY` to później podmiana
dwóch funkcji w jednym pliku; reszta łańcucha (worker, trasa, klient) zostaje nietknięta.

**Odpytywanie nie zniknęło — zwolniło z 45 sekund do 5 minut i zostaje NA STAŁE.** To nie jest
niedokończona robota, tylko siatka pokrywająca trzy rzeczy naraz: brak `EventSource`, zerwany
strumień i **wiele instancji**. Konsekwencja jest warta zapamiętania: **awaria kanału nie jest
awarią aplikacji** — zmiany po prostu dochodzą wolniej.

**Dwa niezmienniki bezpieczeństwa dostały bramkę, bo oba są ciche.** Kanały liczy się **na serwerze
z sesji**; gdyby trasa przyjmowała identyfikator przestrzeni od klienta, wpisanie cudzego byłoby
podsłuchem — i nic by tego nie zdradziło. Drugi: `subskrybuj` **musi zwracać odsubskrybowanie**,
inaczej każda zamknięta karta zostawia słuchacza i po dobie serwer rozgłasza do martwych połączeń.
Trzecia kontrola pilnuje, żeby nikt „na chwilę" nie wrócił do 45 sekund.

**Ładunek sygnału jest celowo ubogi** (`type` + `workspaceId`). Klient ma się **odświeżyć**, a nie
renderować z tego, co przyszło — dane zawsze pobiera z serwera. To zamyka drogę do wycieku treści
cudzego zasobu kanałem, zanim taka droga w ogóle powstanie.

**Bramka:** cztery kontrole, cztery sondy. **Testy szyny:** siedem, w tym „sygnał nie trafia do
cudzego kanału" i „odsubskrybowanie realnie usuwa słuchacza". Przebieg mutacyjny: **4 mutacje,
4 złapane** (rozgłaszanie do wszystkich kanałów, martwe odsubskrybowanie, wielokrotny sygnał do
jednej karty, błąd słuchacza przerywający rozgłaszanie).

**Czego tu nie ma, świadomie:** kanał **per zasób** (`res:<type>:<id>` z rozdz. 11.1.2). Wymaga,
żeby klient zgłaszał, co ma otwarte, a pierwszy konsument tego nie potrzebuje — wystarcza mu „coś
w mojej przestrzeni się zmieniło". Dokładamy przy pierwszym konsumencie, który rozróżnia zasoby
(obecność, wskaźniki edycji — rozdz. 8.8).

**Zostaje zadanie 25** — subskrypcje międzymodułowe, w tym **przepięcie księgowania wydatku
z wywołania na zdarzenie**. To ono domknie problem, dla którego cała Faza 4 powstała: *awaria
Portfela nie może zabierać zakupów*.

**Bramki:** build **exit 0**, `test:unit` **896/896** (było 889), nowa `check:realtime`,
zapadki 263 i 34 bez ruchu, liczniki **160 / 553 / 35 / 35** bez ruchu.

---

## 073 — Zadanie 25: Portfel przestał być wołany, zaczął słuchać

**Co się zmieniło w jednym zdaniu:** `completeShopping` nie importuje już niczego z Portfela.

To jest cała Faza 4 w miniaturze. Do dziś zakupy kończyły się tak: zarchiwizuj listę, a potem
**zawołaj księgowość**. Moduł kupujący musiał wiedzieć, że w systemie istnieje Portfel, znać nazwę
jego funkcji i jej parametry. Teraz zakupy ogłaszają fakt — *lista zamknięta, użytkownik prosił
o zaksięgowanie* — a Portfel sam decyduje, czy go to obchodzi. **Usunięcie Portfela z systemu nie
wymaga już dotknięcia Zakupów.**

**Reguła przeniosła się tam, gdzie jej miejsce.** Warunek „księgujemy tylko listy prywatne" siedział
w `completeShopping` jako `list.ownerId === user.id` — czyli moduł zakupów pilnował zasady
**księgowej** („nie obciążaj prywatnego konta cudzymi zakupami"). Teraz pilnuje jej Portfel, i to na
podstawie **przestrzeni, którą zdarzenie i tak niesie**, a nie właściciela listy, o którego musiałby
dopytać. Efekt uboczny, który liczy się osobno: zniknął kolejny odczyt `ownerId` — jeden mniej do
przepisania w etapie 4 zadania 11.

**Idempotencja bez klucza z `event.id` — i to nie jest wyjątek od reguły, tylko drugi jej wariant.**
`bookAutoExpense` szuka wpisu po parze `(sourceModule, sourceId)` i przy trafieniu **aktualizuje**
go, korygując saldo o różnicę. `sourceId` to id listy, więc klucz jest stabilny między ponowieniami
dokładnie tak samo jak id zdarzenia; drugie dostarczenie ustawia tę samą kwotę i różnica wynosi
zero. Manifest nazywa to `naturalna`. Jeden szczegół okazał się przy tym istotny: **data brana
z `event.createdAt`, nie z `new Date()`** — inaczej ponowienie przesunęłoby wydatek na inny dzień
i „idempotentna" aktualizacja zmieniłaby dane.

**Komunikat asystenta poprawiony przy okazji, bo był nieprawdziwy już wcześniej.** Mówił
„zaksięgowano wydatek X zł" na podstawie flagi `booked`, którą kod ustawiał na `true` **zaraz po
wywołaniu** `bookAutoExpense` — funkcji, która po cichu nic nie robi, gdy użytkownik nie ma
skonfigurowanego konta auto-wydatków. Flaga nigdy nie znaczyła „pieniądze zaksięgowane", tylko
„zlecenie poszło", i tak się teraz nazywa (`zlecono`). Przejście na zdarzenie nie popsuło tu
niczego — obnażyło obietnicę, która i tak była na wyrost.

**Dowód, nie deklaracja.** Bramka `check:subscribers` sprawdza wyłącznie obecność wzorca. Skutek
mierzy test na realnym Postgresie: pierwsze dostarczenie księguje (saldo 1000 → 880), drugie **nie
zmienia nic** (jeden wpis, saldo 880), brak życzenia użytkownika nie księguje nic, a zakupy
zespołowe nie ruszają prywatnego konta. Przebieg mutacyjny: usunięcie warunku o przestrzeni
osobistej **czerwieni test** (2 porażki) — bez tego sprawdzenia asercja byłaby dekoracją.

**Czego tu nie ma, świadomie:** drugiej pary z rozdz. 9.5 — **Magazyn → Zakupy**
(`storage.item.belowMinimum`). Wymaga nowego rodzaju zdarzenia **i producenta**, czyli zmiany
w module magazynowym, a nie samego subskrybenta. Wzorzec jest już utrwalony na dwóch reakcjach
w dwóch modułach i to była cena wejścia; dołożenie trzeciej jest odtąd pracą liniową. Zadanie 25
zostaje więc **🟡**, nie ✅ — kierunek Zakupy→Portfel domknięty, Magazyn→Zakupy przed nami.

**Bramki:** build **exit 0**, `check:subscribers` **2 subskrybentów w 2 modułach**, zapadka
paginacji **263 bez ruchu**, liczniki **160 / 553 / 35 / 35** bez ruchu.

---

## 075 — Zadanie 11, etap 4 (część 1): `workspaceId NOT NULL` i cztery rzeczy, które to odsłoniło

**Co zrobione:** 40 z 45 tabel lustrzanych ma `workspaceId NOT NULL`. Pięć zostaje nullowalnych —
z manifestem, uzasadnieniem i zapadką. Kolumny własnościowe **jeszcze stoją**; ich usunięcie to
osobny przebieg, poprzedzony kopią z 0233.

**Decyzja właściciela, od której to się zaczęło.** Pomiar znalazł 79 wierszy bez przestrzeni i
**wszystkie** okazały się rekordami systemowymi. Odrzucona alternatywa: „przestrzeń systemowa",
której członkiem byłby każdy — bo tworzy nowy tryb awarii (brak jednego wiersza `WorkspaceMember`
i konto po cichu traci wszystkie słowniki) i rozmywa pojęcie przestrzeni. Wybrano listę wyjątków
z zapadką, czyli wzorzec, który w tym repo działa już pięć razy.

**Trzy z tych 79 wierszy nie były tym, na co wyglądały.** `ShoppingList/default` — bezpańska lista
z `seed.ts`, sprzed modelu własności. `ownedWhereAsync` filtruje po własności, więc **nie widział
jej nikt**: martwe dane udające rekord systemowy. Usunięta z seeda i z bazy (migracja przypisuje ją
administratorowi, gdyby na produkcji miała pozycje — żadna migracja nie kasuje cudzej treści).

### Cztery rzeczy, które zaostrzenie odsłoniło — i to jest właściwy dorobek tego przebiegu

**1. Wyzwalacz umiał czytać lustro, ale nie umiał go domknąć.** Przy kolumnie nullowalnej konto bez
przestrzeni osobistej tworzyło niewidzialną sierotę. Po zaostrzeniu **nie mogłoby utworzyć niczego**
— ani nawyku, ani notatki. Wyzwalacz (0236) tworzy więc brakującą przestrzeń zamiast odmawiać
zapisu. Nie „dopilnujemy, żeby aplikacja wołała `ensurePersonalWorkspace`": dokładnie tym
rozumowaniem 055 odrzuciło rozszerzenie klienta Prismy, bo zapis przychodzi też z surowego SQL-a,
seeda i zapisu zagnieżdżonego.

**2. …a potem umiał domknąć za dużo.** Wersja z 0236 tworzyła przestrzeń bezwarunkowo, a `ownerId`
nie wszędzie jest kluczem obcym (`Job` trzyma zwykły tekst). Wyzwalacz próbował wstawić przestrzeń
dla nieistniejącego konta i wywracał cały zapis. Korekta 0238: **lecz brak przestrzeni realnego
właściciela, nie wymyślaj właścicieli**. Domknięcie luki zamieniło łagodną nieobecność w twardy
błąd — ta sama klasa regresji, tylko z drugiej strony.

**3. `NOT NULL` po cichu usunął siatkę bezpieczeństwa, o której nikt nie pamiętał.** W
`rolaZWlasnosci` reguła „właściciel = `manager`" stała **pod** gałęzią przestrzeni, więc docierał do
niej wyłącznie zasób bez przestrzeni. Sieroty zniknęły — i razem z nimi ochrona: gdy przestrzeni
zasobu nie ma w kontekście dostępu (klasyczny przypadek to brak wiersza `WorkspaceMember`, pułapka
z 056), **właściciel przestawał być właścicielem**. Ujawnił to test kosztu dostępu. Warunek
przeniesiony na górę; tabela prawdy bez zmian, więc niczego nie poszerzył.

**4. Kryterium wyjątku było za wąskie.** Listę zbudowano z tabel SŁOWNIKOWYCH. `Job` słownikiem nie
jest, a należy tam: zadanie systemowe nie ma właściciela. Kosztowało to dziewięć wywróconych testów
kolejki i korektę 0237. Kryterium brzmi odtąd: **wiersz może nie mieć właściciela** — a nie „tabela
trzyma słownik".

**Dwie bramki przestały widzieć własny przedmiot**, bo obie filtrowały modele po `workspaceId
String?`, a 40 kolumn straciło znak zapytania. `check-workspace-fill` zaczęła zgłaszać „wyzwalacz na
tabeli, której nie ma wśród modeli", a test kompletności backfillu — odwrotność tego samego.
Rozróżnienie, o które naprawdę chodziło, nigdy nie dotyczyło nullowalności: kolumna LUSTRZANA
istnieje tam, gdzie jest co lustrzać, czyli obok `ownerId`/`ownerTeamId`. Trzy tabele platformowe
(`DomainEvent`, `ResourceGrant`, `WorkspaceMember`) mają przestrzeń jako część tożsamości.

**Testy sierot przepisane, nie skasowane.** Trzy testy budowały sierotę przez
`update({ workspaceId: null })`. Stan stał się nieosiągalny, więc zamiast dowodzić, że obejście
działa, dowodzą teraz **niezmiennika, który je unieważnił** — że baza odrzuca wyzerowanie
przestrzeni, i to sprawdzane **surowym SQL-em**, bo typ Prismy chroni tylko kod idący przez klienta.
Z tabeli prawdy zniknęła jedna kolumna (5×5 → 5×4): opisywała stan, którego nie da się już zbudować,
a punkt odniesienia poprawiono **punktowo**, nie regeneracją — regeneracja ukryłaby każdą inną zmianę.

**Bramki:** build **exit 0**, `test:unit` **901/901**, nowa `check:workspace-nullable` (2 sondy),
zapadka paginacji **263** bez ruchu, zakres własności **2 wyjątki** (był 3 — jeden zniknął razem
z martwą gałęzią).

**Zostaje do etapu 4 część 2:** samo `DROP COLUMN`, zmierzone na **612 błędów kompilacji w 124
plikach**. Kopia własności (0233) i procedura odtworzenia są gotowe i przećwiczone.

---

## 076 — Etap 4 część 2: fundament zapisu i ustalenie, które zmienia zakres `DROP COLUMN`

**Dowieziony fundament.** `platform/workspaces/zapis.ts` — `przestrzenOsobista`, `przestrzenZespolu`,
`przestrzenDoZapisu`. Usunięcie kolumn własnościowych sprowadza się w kodzie do jednej zamiany
powtórzonej ~250 razy (`data: { ownerId: user.id }` → `data: { workspaceId: … }`); ta funkcja czyni
ją mechaniczną. **Wyzwalacz jej nie zastąpi**: wyprowadza przestrzeń Z KOLUMNY WŁAŚCICIELA, więc gdy
kolumna zniknie, nie ma z czego wyprowadzać — baza nie zna autora zapisu. Od etapu 4 przestrzeń
podaje kod. Test na realnym Postgresie sprawdza, że rekord trafia do przestrzeni **pytającego**, że
konto bez przestrzeni dostaje ją razem z rolą, i że zapis zespołowy nie ląduje w prywatnej
przestrzeni zapisującego — pomyłka tutaj nie zepsułaby ekranu, tylko cicho wypisała dane do cudzej
przestrzeni.

### Ustalenie: `DROP COLUMN` obejmie 40 tabel, nie 45 — i to nie jest cięcie zakresu

Inwentaryzacja (121 plików, 256 miejsc zapisu, 173 filtry) zatrzymała się na `Tag` i `ItemHistory`:

```
Tag_ownerId_name_key          UNIQUE ("ownerId", name)
ItemHistory_ownerId_name_key  UNIQUE ("ownerId", name)
```

Te unikalności trzymają regułę „jedna etykieta o tej nazwie na właściciela" **razem z rekordami
systemowymi**, dla których `ownerId IS NULL`. Przeniesienie ich na `workspaceId` wygląda na zamianę
jeden do jednego, ale nią nie jest: rekord systemowy ma `workspaceId IS NULL`, a w PostgreSQL
**`NULL` nie równa się `NULL`** — indeks unikalny przestałby chronić dokładnie te wiersze, dla
których powstał. Dwa systemowe tagi „praca" mogłyby współistnieć i nikt by tego nie zauważył.
To ta sama pułapka, którą 041 opisało przy `AiSectionPref` (dlatego domyślne tryby sekcji trzymamy
w `Config`, a nie w wierszu z `NULL`-owym właścicielem).

Wniosek jest spójny z listą wyjątków z 075 i obejmuje **te same pięć tabel**: `ItemHistory`,
`NoteGroup`, `Skin`, `Tag`, `Job`. Kryterium też jest to samo — **wiersz może nie mieć
właściciela** — tylko konsekwencja szersza, niż wyglądała: skoro wiersz może nie należeć do nikogo,
`workspaceId` nie wyraża jego własności ANI jego unikalności, więc `ownerId` zostaje tam jako
nośnik obu. W `Job` dochodzi trzecie zastosowanie: limit aktywnych zadań i czyszczenie RODO.

**Stan docelowy jest więc taki:** `workspaceId` jest mechanizmem własności **wszędzie tam, gdzie
rekord musi do kogoś należeć** (40 tabel — kolumny własnościowe znikają), a pięć tabel wyjątkowych
zachowuje `ownerId`, bo ich rekordy mogą nie należeć do nikogo i przestrzeń tego nie wyrazi.

**Pozostaje do wykonania:** konwersja 121 plików (256 zapisów przez `przestrzenDoZapisu`, 173 filtry
na zakres po przestrzeniach) i dopiero po niej `DROP COLUMN` na 40 tabelach. Osobno i ostrożnie:
`lib/privacy/purge.ts` — czyszczenie RODO jest dziś kluczowane po `ownerId`, więc jego przepięcie
zmienia ścieżkę usuwania danych osobowych i zasługuje na własny test przed i po.

**Bramki:** build **exit 0**, `test:unit` **905/905** (było 901; +4 z testu przestrzeni zapisu).

---

## 078 — Etap 4 część 2: konwersja zapisów, guard rekordu i siatka na cichą pomyłkę

### Ustalenie, które przewróciło plan: 14 tabel ma `ownerId NOT NULL`

Plan brzmiał: zamień `data: { ownerId }` na `data: { workspaceId }` w ~250 miejscach, potem
`DROP COLUMN`. Pomiar przed pierwszą zamianą pokazał, że na **14 z 40 tabel objętych etapem 4
kolumna `ownerId` jest NOT NULL** (`ProjectGroup`, `FavoriteView`, pięć tabel Wiadomości, trzy
Pogody, `UserFact`, `AiContent`, `AiSectionPref`, `NewsRefreshRun`). Na nich te dwa kroki **nie są
rozdzielne**: zapis bez `ownerId` odrzuca baza. Konwersja i migracja musiałyby więc wejść **jednym
commitem na 92 plikach** — a każdy merge do `develop` jest wdrożeniem, czyli byłby to commit, po
którym albo działa wszystko, albo nic.

Stąd **faza podwójnego zapisu**: `wlasnoscDoZapisu(userId, teamId?)` (i wariant
`wlasnoscOsobistaDoZapisu` dla tabel bez współwłasności zespołowej) zwraca `workspaceId` policzony
przez KOD razem z kolumnami własnościowymi, których baza jeszcze wymaga. Miejsca zapisu rozpakowują
wynik przez `...`, więc migracja zmieni **jedno ciało funkcji**, a nie 250 miejsc. Każdy commit tej
fazy jest samodzielnie wdrażalny — i to był cel.

### Redundancja fazy przejściowej okazała się darmowym inwariantem (0240)

Konwersja 250 miejsc ma jeden tryb awarii i jest cichy: pomyłka w argumencie daje rekord w **cudzej
przestrzeni**. `tsc` widzi dwa poprawne stringi, testy przechodzą, ekran się renderuje; objaw
pojawia się, gdy ktoś zobaczy nie swoje dane. Przy 92 plikach „będę uważał” nie jest planem.

Ale w fazie podwójnego zapisu ta sama informacja jest w bazie **dwa razy**. Wyzwalacz
`omnia_fill_workspace` dotąd wychodził natychmiast, gdy zapis podał `workspaceId` — od 0240
**porównuje** podaną przestrzeń z tą, którą wyprowadza z kolumn własnościowych, i odrzuca rozjazd
komunikatem mówiącym, co się nie zgadza. Cicha usterka stała się głośnym błędem w miejscu powstania.
W bazie, nie w kliencie Prismy: rozszerzenie klienta omijają zapisy zagnieżdżone, surowy SQL, seedy
i skrypty — wyzwalacza nie omija nic.

Skutek uboczny, który sam jest ustaleniem: sprawdzenie czyni pewne stany **nieosiągalnymi**, więc
dwa fixture'y, które ten stan celowo budowały, przestały się dać zbudować. Poprawione **punktowo**
(zapis zgodny zamiast sprzecznego, przeniesienie przez `UPDATE` — wyzwalacz jest `BEFORE INSERT`),
z zachowaniem tezy, której dowodziły. To ta sama figura, co w 077: kod, który był jedyną drogą do
danego stanu, znika razem z nim.

### Guard rekordu: reguła przeniesiona, nie przepisana

`assertOwnership` czytało `ownerId`/`ownerTeamId` z wybranego rekordu. Czyta przestrzeń — a reguła
jest przeniesiona **jeden do jednego**, bo lustro z zadania 9 utrzymuje równoważności `ownerId = ja`
⟺ „moja przestrzeń osobista" i `ownerTeamId = t` ⟺ „przestrzeń zespołu t, którego jestem
członkiem". Te same **siedem komórek** tabeli prawdy, każda przetłumaczona, żadna ze zmienionym
wynikiem. Reguła wydzielona jako czysta `maDostepDoPrzestrzeni`, bo guard musiał stać się
asynchroniczny — a tabelę prawdy da się sprawdzić bez bazy tylko na funkcji czystej; inaczej dowód
wymagałby atrapy kontekstu, czyli sprawdzałby atrapę.

### Filtry osobiste: węższe z rozmysłem

`filtrMoichRekordow(userId)` zastąpiło `where: { ownerId: userId }` w **52 miejscach** na tabelach
bez kolumny `ownerTeamId`. Celowo zwraca **jedną** przestrzeń (osobistą), a nie `IN (wszystkie
moje)` jak `ownedOrAsync`: to drugie byłoby na takiej tabeli **poszerzeniem** zakresu. Dziś oba
warianty dałyby ten sam wynik — i właśnie dlatego pomyłka przeszłaby niezauważona, a zaszkodziła
dopiero wtedy, gdy któraś z tych tabel dostanie kolumnę zespołową. Dowód to porównanie **zbiorów**
na prawdziwych danych, z przypadkiem różnicującym (rekord przeniesiony do przestrzeni zespołu:
wąski filtr go nie widzi, szeroki widzi) — sonda podmieniająca filtr na szerszy czerwieni test.

### Kosz: jedyne miejsce, gdzie problemem są DANE, nie kod

`TrashItem.payload` to JSON utrwalony w chwili usunięcia. Migawki sprzed 078 mają tylko kolumny
własnościowe i nikt ich wstecz nie przepisze. Gdyby przywracanie czytało wyłącznie `workspaceId`,
w dniu `DROP COLUMN` **każdy rekord leżący w koszu** (retencja 30 dni) wróciłby z cudzą przestrzenią
albo bez niej — a operacja zgłaszałaby sukces. Stąd `przestrzenZMigawki`: najpierw przestrzeń
z migawki, a gdy jej nie ma — wyprowadzenie z kolumn własnościowych, dokładnie jak wyzwalacz.

### Pozostałe ustalenia

* **U-4 naprawione:** `przestrzenZespolu` → `przestrzenZespoluBezKontroliDostepu`. Funkcja nie
  sprawdza uprawnień i teraz mówi o tym nazwą; kontrola została w guardzie modułu, bo tam jest
  kontekst operacji.
* **Unikalność `NewsPref` przeniesiona na przestrzeń (0241).** `ownerId @unique` było ostatnią
  rzeczą, przez którą ta tabela zależy od kolumny własnościowej: `findUnique`/`upsert` przyjmują
  wyłącznie klucz unikalny, więc samo przepisanie filtra nawet się nie kompilowało. Migracja
  sprawdza duplikaty **przed** zdjęciem starej ochrony i przerywa z czytelnym komunikatem.
* **Bramka nie zna nazw, których jej nie podano.** `check-ai-access` zgłosiła „brak zawężenia
  dostępu" w dwóch narzędziach odczytu — zawężenie było, i to ściślejsze, ale nowej nazwy nie było
  na liście wzorców. Przy okazji bramka dopasowuje teraz wzorce do KODU, nie do komentarzy (własna
  lekcja repo, tu jeszcze niezastosowana); sprawdzone sondą.

**Bramki:** build **exit 0**, `test:unit` **922/922** (było 907; +15 z czterech nowych dowodów),
`check:ai-access` z nową sondą, zapadki `workspace-*` / `boundaries` / `module-registry` /
`schema-drift` bez zmian.

### Co pozostało do `DROP COLUMN` — zmierzone, nie oszacowane

**479 błędów kompilacji w 92 plikach** (przed 078: 544). Miara jest twarda: schemat z usuniętymi
kolumnami + `tsc`. W kolejności, którą narzuca ryzyko:

1. **`platform/sharing` i guardy modułów** (`sharing.ts` × 4, `assert*Access` × 6) — najdelikatniejsze,
   bo tam żyje siatka „właściciel = manager” z 077. Wymaga tabeli prawdy porównanej komórka w komórkę
   **przed** przełączeniem.
2. ~~Unikalności złożone~~ — **zrobione w tym samym przebiegu (0242).** Przy pisaniu punktu wyżej
   policzyłem cztery; było ich **osiem** (`FavoriteView.path`, `NewsSource.key`,
   `NewsArticle.(sourceId,url)`, `NewsHiddenTopic.fingerprint`, `UserFact.fingerprint`,
   `WeatherIdea.fingerprint`, `AiContent.(kind,scopeKey)`, `AiSectionPref.sectionKind`) —
   pomyłka z liczenia „z pamięci” zamiast z zapytania do schematu. Wszystkie osiem to tabele BEZ
   współwłasności zespołowej, więc przeniesienie jest ścisłe. `Tag` i `ItemHistory` **zostają**:
   ich unikalność obejmuje rekordy systemowe (`ownerId IS NULL`), a tam `workspaceId` jest
   nullowalne i `NULL <> NULL` — indeks przestałby chronić dokładnie te wiersze, dla których
   powstał. Sonda potwierdziła, że nowy indeks odrzuca duplikaty.
3. **`lib/privacy/purge.ts`** — osobno i bardzo ostrożnie; RODO jest kluczowane po `ownerId`,
   wymaga testu „przed i po" na porównywalnym zbiorze.
4. **Odświeżenie kopii własności (U-5)** + kontrola liczności per tabela przerywająca migrację
   przy rozjeździe.
5. **`DROP COLUMN` razem z U-3** (`ownedOrAsync` ma jeszcze gałąź `{ ownerId: userId }`, która
   w chwili usunięcia kolumny wywróciłaby każde zapytanie listowe) i zmianą ciała
   `wlasnoscDoZapisu` / `przestrzenZMigawki` na `{ workspaceId }`.

---

## 079 — Etap 4 część 3: koniec zadania 11. Własność to przestrzeń

**Zadanie 11 jest zamknięte.** Migracja **0244** usunęła `ownerId`/`ownerTeamId` z **40 tabel**;
własność zasobu wyraża odtąd wyłącznie `workspaceId`. Pięć tabel zachowuje `ownerId` — kryterium
z 075/076 („wiersz może nie mieć właściciela”) i zapadka `check:workspace-nullable`.

Miara pracy między przebiegami, liczona zawsze tak samo (schemat z usuniętymi kolumnami + `tsc`):
**406 błędów w 86 plikach → 0**. Pięć kroków, każdy osobno wdrażalny i osobno wdrożony.

### Krok 1 — siatka, która stała w zupełnie innym pliku niż jej przedmiot

Deklaracje zasobów czterech modułów przestały czytać kolumny własnościowe. To wygląda na zamianę
`select`, a nie jest: od 075 fakt `ownerId` pełnił w `rolaZWlasnosci` rolę **siatki** — gdy
przestrzeni zasobu nie było w kontekście dostępu (brak wiersza `WorkspaceMember`, pułapka z 056),
właściciel i tak dostawał `manager`. Usunięcie faktu usuwało siatkę.

Trzy istniejące tabele prawdy nie zauważyły tego wcale. Każdy ich fixture zaczyna od
`ensurePersonalWorkspace`, który przy okazji **naprawia brakujące członkostwo** — mierzyły więc
stan, w którym broniony kod jest zbędny. Stąd czwarta tabela, `wlasnoscBezLustra`, która stan awarii
**buduje celowo**: kasuje wiersze członkostwa po utworzeniu zasobów. Sonda: bez poprawki sześć
komórek czerwienieje.

Siatka **przeniosła się do miejsca, w którym problem powstaje**: `getAccessContext` czyta przestrzeń
osobistą po `Workspace.personalUserId`, a nie po członkostwie. To nie poszerza niczyjego dostępu —
przestrzeń osobista z definicji należy do jednej osoby — i pilnuje tego wiersz „obcy" w tej samej
tabeli prawdy, który musi zostać samą odmową. Razem z nim zamrożony jest drugi wiersz: **właściciel
zespołu bez członkostwa NADAL nie ma dostępu zespołowego**, bo tamtej siatki nigdy nie było.

Przy okazji zniknęła gałąź „zasób bez przestrzeni, własność zespołowa" — nie jako uproszczenie,
tylko jako kod, do którego nie da się dojść.

### Krok 2 — RODO ma dwa mechanizmy, a kompilator widzi jeden

Usuwanie konta stoi na dwóch niezależnych rzeczach: jedenastu jawnych `deleteMany` w
`lib/privacy/purge.ts` **oraz** kaskadzie klucza obcego `owner → User` na 39 z 40 tabel. Etap 4
zabierał obie naraz. Pierwszą widzi `tsc`. **Drugiej nie widzi nikt** — i to jest właściwe
ustalenie tego przebiegu: `workspaceId` **nie miało klucza obcego w ogóle**. Po `DROP COLUMN`
rekord przestawał mieć jakikolwiek związek z kontem, więc usunięcie użytkownika zostawiłoby
w bazie jego portfel, flotę, magazyn i pogodę, zgłaszając sukces.

Stąd migracja **0243**: `workspaceId REFERENCES Workspace(id) ON DELETE CASCADE` na 40 tabelach.
Kaskada przez przestrzeń odtwarza obie dawne ścieżki jeden do jednego, bo lustro z zadania 9 wiąże
przestrzeń z jej źródłem tym samym mechanizmem (konto → przestrzeń osobista, zespół → przestrzeń
zespołu). **`Contact` zyskuje kaskadę, której nie miał nigdy** (Z-370 — kolumna właściciela bez
klucza obcego): przy usunięciu zespołu jego kontakty zostawały osierocone. To poszerzenie
sprzątania, nie dostępu.

Dowodem jest tabela prawdy `purgeZakres`: 23 tabele × 2–3 rekordy = **65 komórek**, punkt
odniesienia zamrożony **przed** przepięciem, po przepięciu **bez jednej różnicy**. Test ma
asymetrię wartą zapamiętania: dopóki stara kaskada stała, wyłączenie jawnego `deleteMany` niczego
nie zmieniało (rekord i tak znikał), a wyłączenie kasowania **kontaktów** — jedynej tabeli bez
klucza obcego — czerwieniło natychmiast. Ta asymetria była miarą tego, ile pracy wykonuje baza,
a nie kod.

### Krok 3 — dwa różne „moje zespoły", które dają dziś ten sam wynik

Guardy rekordu w dziewiętnastu modułach miały dwa kształty, na oko identyczne:
`getUserTeamIds` (wszystkie zespoły) i `getAccessibleTeamIds` (przefiltrowane po dostępie domownika
do modułu, Z-194). Przełożenie obu na `ctx.workspaceIds` byłoby **poszerzeniem dostępu niewidocznym
w testach**: u konta bez ograniczeń oba zbiory są identyczne, więc pomyłka zaszkodziłaby dopiero
pierwszemu ograniczonemu domownikowi. Powstał więc drugi helper, `getAccessibleWorkspaceIds`,
a test równoważności ma **przypadek różnicujący** (moduł odebrany domownikowi) — sonda z szerszym
wariantem go czerwieni.

Drugie rozstrzygnięcie: `filtrMoichRekordow` wolno stosować także na tabelach ZE współwłasnością
zespołową. Ograniczenie z 078 dotyczyło **kształtu warunku** (`ownerId = ja`), nie kształtu tabeli;
zakazane zostaje podmienianie go na szerszy `ownedOrAsync`.

DTO przestały nosić kolumny własnościowe. Znacznik „zespołowy" w UI sześciu modułów czyta teraz
`workspace.team` — relację, którą **dał klucz obcy z 0243**. Migracja zrobiona dla kaskady okazała
się potrzebna również tutaj i w `feedback.ts`, gdzie warunek po relacji zastąpił osobne zapytanie
(zapadka paginacji nie drgnęła).

Fixture'y testów przeszły na `wlasnoscDoZapisu` **w osobnym kroku, przed migracją** — dzięki temu
`DROP COLUMN` nie musiał ich dotykać. Kosztowało to jedno ustalenie: asercja „po usunięciu konta"
nie może liczyć zbioru, którego definicja żyje w tym koncie (`filtrMoichRekordow` tworzy brakującą
przestrzeń i przewraca się na kluczu obcym). Asercje liczą teraz konkretne id.

### Kroki 4 i 5 — kopia, która cicho kłamała, i jedno ciało funkcji

**U-5.** `_KopiaWlasnosci` (0233) to jedyny odwrót od `DROP COLUMN`, ale jej wstawka miała
`ON CONFLICT DO NOTHING`: rekord, który od tamtej pory zmienił właściciela, miał w kopii wartość
**nieaktualną**, a rekord utworzony później nie miał wpisu wcale. Przywrócenie rozdałoby część
danych nie tym kontom — awaria gorsza niż ta, przed którą kopia broni. Migracja 0244 zaczyna się
więc od odświeżenia (`DO UPDATE` + skasowanie wpisów po wierszach, których w źródle nie ma)
i **kontroli liczności per tabela**, przerywającej migrację przy rozjeździe.

Problem z dowodzeniem: migracja wykonuje się **raz**, na bazie, która w środowisku pracy jest pusta
— czyli w warunkach, w których każdy błąd przechodzi. Test `kopiaWlasnosci` **czyta oba bloki `DO`
wprost z pliku migracji** i uruchamia je na fixture zawierającym dokładnie te trzy sytuacje, dla
których odświeżenie powstało: wartość zmienioną, wiersz nowy i wiersz usunięty. Plus sonda, że
kontrola liczności naprawdę przerywa. To nie kopia logiki — to ten sam tekst SQL.

**Sam `DROP COLUMN` zmienił w kodzie trzy ciała funkcji.** `wlasnoscDoZapisu`,
`wlasnoscOsobistaDoZapisu` i `przestrzenZMigawki` zwracają odtąd samo `{ workspaceId }`; ~250 miejsc
zapisu nie zostało dotkniętych ani razu, bo rozpakowują wynik przez `...`. **Po to powstała faza
podwójnego zapisu w 078** i to jest jej wypłata. U-3: `ownedOrAsync` stracił gałąź `{ ownerId }`,
a martwe `ownedWhere`/`ownedOr` **usunięto** — funkcja budująca filtr po nieistniejącej kolumnie
kompiluje się (`Record<string, unknown>`) i wywala dopiero w czasie działania.

### Testy fazy przejściowej: przeniesione, nie skasowane

`rozjazdPrzestrzeni` (wyzwalacz odrzuca niezgodność obu nośników) i `workspaceFill` (wyzwalacz
wypełnia przestrzeń) straciły przedmiot na 40 tabelach, ale **nie na pięciu wyjątkowych** — tam
`ownerId` żyje dalej, więc wyzwalacz nadal ma co wyprowadzać i co porównywać. Oba przeniesione na
`NoteGroup`. Skasowany został tylko `ownershipScope.test.ts`, którego przedmiot (`ownedWhere`)
zniknął w całości.

Dwa testy straciły **drugą stronę porównania** i mówią o tym wprost, zamiast udawać dowód:
`ownershipScopeSwitch` (nie ma już starego warunku do zestawienia) i `filtrMoichRekordow`
(pierwszy z czterech przypadków). W obu zostały te części, które nadal mogą się zepsuć.

Test izolacji najemcy — „najważniejszy test w systemie" — przeszedł na `workspaceId` i **objął 37
modeli zamiast 15**. Zgłosił się sam: jego asercja „znalazłem za mało modeli" zaświeciła w chwili,
gdy parser zaczął widzieć sześć zamiast czterdziestu sześciu.

**Bramki:** build **exit 0**, `test:unit` **948/948** (było 922), zapadka paginacji **263** bez
ruchu, `check:workspace-fill` **5 tabel** — dokładnie lista wyjątków, bo wyzwalacz zdjęto z 40
razem z kolumnami.
