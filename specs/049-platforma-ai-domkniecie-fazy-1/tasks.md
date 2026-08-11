# Zadania: Platforma AI i domknięcie Fazy 1

- **Plan:** ./plan.md (049-platforma-ai-domkniecie-fazy-1)
- **Status:** w trakcie
- **Data:** 2026-08-11

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami**. `[P]` = można zrównoleglić.
>
> **Zasada nadrzędna (z 046–048):** commit przenoszący zawiera **wyłącznie** przenosiny i przepisane
> importy. Zmiany zachowania — **osobnym** commitem.
>
> **Rytuał po każdym zadaniu**, bez wyjątku:
> `tsc --noEmit` · `check:actions` (**160**) · `check:ai-coverage` (**551**) · `check:cost-badge`
> (**35**) · `check:content-memory` (**35**) · `next lint --dir src` · `check:module-registry` ·
> `check:boundaries` · commit.
> Lint jest w rytuale od 047: `check:boundaries` sprawdza **swoje sondy**, nie kod repozytorium —
> realne naruszenie granicy pokazuje dopiero lint.
>
> **Przed KAŻDĄ przenosiną:** sprawdź, czy w źródle nie ma pary „plik `X.ts` + katalog `X/`"
> (lekcja z 048 — cztery takie kolizje w jednej fali).
>
> **Nigdy `next build` równolegle z klikaczami** — walczą o `.next` (lekcja z 047).
>
> **Każda faza kończy się na czystej linii.** Przy zagrożeniu kontroli zatrzymujemy się na granicy
> fazy z jawnym raportem (spec §5) — to jest wynik, nie porażka.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza 0 — Punkt odniesienia

- [x] **T-1** — Zapisać stan startowy jako liczby: `check:actions` = 160, `check:ai-coverage` = 551,
      `check:cost-badge` = 35, `check:content-memory` = 35, `check:module-registry` = 21 modułów,
      `grep -rn "@/modules/" src/platform/` = 0, plików `lib/ai`+`lib/jobs` importujących moduły = 18.
      Dodatkowo **zrzucić katalog asystenta** (liczba akcji i read-tooli per moduł) oraz **wynik
      agregatu kalendarza i migawki pulpitu** dla użytkownika z seeda — to jest materiał porównawczy
      do AC-8/AC-9, którego po przenosinach już się nie odtworzy.
      **Gotowe, gdy:** liczby i zrzuty zapisane jako punkt odniesienia całego przebiegu.
      **Wynik:** `baseline.json` (obok tego pliku) + `scripts/snapshot-ai-surface.ts`.
      160 akcji w 16 modułach · 56 read-tooli · 16 egzekutorów · 12 typów zadań · 38 zdarzeń
      kalendarza w sześciu modułach. Bramki: 160 / 551 / 35 / 35; `src/platform/` = **0** realnych
      importów modułu (jedno trafienie grepa to komentarz); `lib/ai`+`lib/jobs` = 18 plików z importem
      modułu.
      **Odkrycie:** zwykły seed **nie tworzy żadnych danych użytkownika** (konta powstają przez
      OAuth), więc agregat kalendarza zwracał zero zdarzeń — a pusty wynik zgadza się z pustym nawet
      wtedy, gdy przebudowa zgubi połowę źródeł. Dlatego powstał `scripts/fixture-calendar-surface.ts`:
      po jednym zdarzeniu w **każdym** z siedmiu źródeł agendy, idempotentnie, wyłącznie lokalnie.
      **Ograniczenie zapisane wprost:** migawka pulpitu **nie ma** zrzutu runtime — trasa pulpitu to
      322 linie składania w miejscu, z dziesięcioma gałęziami na uprawnienia; jej zrzut wymagałby
      odtworzenia sesji. AC-9 dla pulpitu weryfikujemy **strukturalnie** (te same propsy wchodzą do
      `HomePage`), co przy przenoszeniu zapytań bez ich przepisywania jest równoważnym dowodem.

## Faza A — `platform/llm` (czysta przenosina)

- [x] **T-2** — **`src/lib/llm/` → `src/platform/llm/`.** 9 plików, 64 miejsca importujące, **zero**
      importów modułów (sprawdzone) — najprostszy krok fazy i dowód, że wzorzec działa na tej
      warstwie. `src/lib/llm-client.ts` **zostaje** w `src/lib` (to konsument tras, nie warstwa LLM).
      **Gotowe, gdy:** rytuał przechodzi, `src/lib/llm` nie istnieje. **(AC-1, AC-2)**
      **Wynik:** 9 plików, 71 importów w 55 plikach. Kolizja `src/lib/llm/` (katalog) +
      `src/lib/llm-client.ts` (plik) rozbrojona przez kotwiczenie wzorca na `"@/lib/llm/` ze slashem
      — dokładnie lekcja z 048. **Dwie bramki padły, zgodnie z przewidywaniem AC-11:**
      `check:cost-badge` i `check:content-memory` trzymały ścieżkę definicji `chatComplete`
      (`SELF = "src/lib/llm/chat.ts"`) i po przenosinach zaczęły zgłaszać własną definicję jako brak.
      Poza aktualizacją ścieżki obie dostały **strażnika istnienia**: martwe wyłączenie wywala bramkę
      zamiast po cichu przestać działać. Sprawdzone testem negatywnym.
- [x] **T-3** — Domknięcie fazy A: `test:unit` + `next build` na lokalnym Postgresie.
      **Gotowe, gdy:** build exit 0. **Wynik:** exit 0 end-to-end, testy 566/566.

## Faza B — Asystent wraca do modułów (zadanie 8)

> Rdzeń przebiegu. Kolejność: najpierw wspólny szkielet, potem egzekutory grupami, potem read-toole,
> **na końcu** przełączenie rejestru — bo to jedyna zmiana zachowania w tej fazie.

- [x] **T-4** — **Typy wkładu modułu do asystenta w platformie.** `AiActionContribution`,
      `AiReadToolContribution` w `src/platform/ai/` — biorą `userId`/zakres **parametrem**, nie znają
      żadnego modułu. Pole `ai?: () => Promise<…>` w `ModuleDeclaration` (leniwe, jak `sideNav`).
      **Gotowe, gdy:** typy istnieją, `tsc` czysty, żaden moduł jeszcze ich nie używa. **(AC-3)**
      **Wynik:** `src/platform/ai/contribution.ts` (`AiContribution`, `AiActionExecutor`,
      `AiReadToolHandler`, `AiExecContext`, `ExecOutcome`, `ActionResult`, `AiCatalog`) + pole
      `ai?: () => Promise<AiContribution>` w deklaracji. `AiExecContext` nazywa pola po tym, czym są
      dla użytkownika (`activeListId`, `currentProjectId`), a nie po module — inaczej platforma
      zaczęłaby znać moduły tylnymi drzwiami. Przy okazji `aiAction.ts` (czyste typy) przeniesione do
      platformy, bo bez tego typ wkładu musiałby importować warstwę aplikacji: 25 importów w 23 plikach.
- [x] **T-5** — **`executors/shared.ts` → `src/lib/ai/executorShared.ts` + wstrzyknięcie Zakupów.**
      Plik jest wspólny dla wszystkich egzekutorów i importuje kontrakt Zakupów (`createList`) —
      po regule konsumentów nie należy do żadnego modułu, więc zostaje w warstwie kompozycji,
      a zależność od Zakupów dostaje **parametrem**.
      **Gotowe, gdy:** żaden egzekutor nie importuje kontraktu przez `shared`. **(AC-3)**
      **Wynik — rozwiązane inaczej, niż zakładał plan (C-54).** Plan mówił „wstrzyknąć zależność
      od Zakupów parametrem". Przy pisaniu okazało się, że jedyną funkcją sięgającą po kontrakt jest
      `resolveOrCreateList`, a to **nie jest logika asystenta, tylko Zakupów**: rozstrzyganie, która
      lista jest „tą właściwą" i co zrobić, gdy użytkownik nie ma żadnej. Wstrzyknięcie
      przeciągałoby `createList` przez sześć wywołań w trzech egzekutorach tylko po to, żeby udawać,
      że plik nie należy do Zakupów. Funkcja pojechała więc **do modułu Zakupy**
      (`lib/resolveList.ts`, eksport w kontrakcie), a Kuchnia i Magazynowanie wołają ją przez
      kontrakt — co ujawnia zależność, która i tak istniała (`assertListAccess`), zamiast ją ukrywać.
      Reszta pliku (`resolveListId`, `resolveTaskId`, `resolveNoteId`, …) sięga do Prismy bez importu
      modułu, więc zostaje w warstwie kompozycji jako `src/lib/ai/executorShared.ts`.
- [x] **T-6** — **Egzekutory, grupa 1 — moduły bez sprzężeń:** Kontakty, Raporty, Nawyki, Flota.
      `src/lib/ai/executors/<x>Executor.ts` → `src/modules/<x>/ai/executor.ts`; blok tekstu
      z `ACTION_CATALOG_BY_MODULE[<x>]` → `src/modules/<x>/ai/catalog.ts`; `ai/index.ts` + pole `ai`
      w `module.ts`. Rejestr w trasie **jeszcze nie zmieniany** — importuje z nowego miejsca.
      **Gotowe, gdy:** rytuał przechodzi, cztery moduły deklarują swój wkład. **(AC-6)**
      **Korekta planu (C-54) — tekst katalogu NIE jedzie razem z egzekutorem.** Plan zakładał, że
      w tym samym kroku przenosimy blok `ACTION_CATALOG_BY_MODULE[<x>]`. To dałoby **dwa źródła
      prawdy naraz** przez cztery zadania (T-6…T-9). Katalog przenosimy więc jednym ruchem w T-13,
      razem z usunięciem mapy — a tu jedzie sam egzekutor.
      **Bramka `check:actions` padła natychmiast** (skanowała `src/lib/ai/executors/`) i została
      naprawiona **już tutaj**, nie w T-18: katalogi `ai/` modułów są **wyprowadzane z systemu
      plików**, nie z listy nazw, więc bramka znajdzie moduł, o którym nikt jej nie powiedział.
- [x] **T-7** — **Egzekutory, grupa 2:** Notatki, Zdrowie, Nauka języków, Warsztaty, Magazynowanie.
      **(AC-6)**
- [x] **T-8** — **Egzekutory, grupa 3:** Wiadomości, Pogoda, Zwierzęta (+ `petActions.ts`, który mimo
      lokalizacji w `lib/ai` jest kodem modułu Zwierzęta), Portfel.
      **(AC-6)**
- [x] **T-9** — **Egzekutory, grupa 4 — najbardziej sprzężone:** Zakupy, Zadania, Kuchnia.
      **(AC-6)**
      **Wynik: 16 egzekutorów w 16 modułach, `src/lib/ai/executors/` już nie istnieje.**
      Dwie rzeczy wyszły dopiero tutaj:
      • **Zakupy i Zadania biorą z kontekstu jedną wartość** (`activeListId`, `currentProjectId`),
        a nie worek. Zamiast przerabiać ich sygnatury na `AiExecContext`, `ai/index.ts` ma
        jednolinijkowy adapter — mówi wprost, którego pola kontekstu ten moduł używa, więc jest
        lepszą dokumentacją niż generyczny kontekst przepuszczony przez egzekutor.
      • **Lint złapał realne naruszenie**: egzekutor Zakupów importował własne wnętrze aliasem
        (`@/modules/shopping/actions/items`), co po przeniesieniu pliku DO modułu łamie C-02.
        Skrypt przepisywał tylko `contract`, więc tego nie objął. Kolejny raz potwierdza się, że
        `check:boundaries` sprawdza swoje sondy, a realne naruszenie pokazuje dopiero lint.
- [x] **T-10** — **Rozbicie `agentTools.ts` (1199 linii): część platformowa.** Pętla narzędzi,
      protokół i formatowanie wyników → `src/platform/ai/tools.ts`. Wkłady modułowe zostają na razie
      w pliku — rozdzielamy szkielet od treści, zanim ruszymy treść.
      **Gotowe, gdy:** szkielet nie importuje żadnego modułu. **(AC-2)**
- [x] **T-11** — **Read-toole, grupa 1:** moduły z grup T-6 i T-7 → `src/modules/<x>/ai/readTools.ts`.
      **(AC-6)**
- [x] **T-12** — **Read-toole, grupa 2:** moduły z grup T-8 i T-9 + agregat kalendarza.
      **Gotowe, gdy:** `agentTools.ts` nie zawiera już wkładów modułowych. **(AC-6)**
- [x] **T-13** — **`agentPrompt.ts`: szkielet ↔ katalog.** Nagłówki, protokół, `buildSystemPromptParts`
      → platforma; `ACTION_CATALOG_BY_MODULE` znika, bo jego treść jest już w modułach.
      **Gotowe, gdy:** w `agentPrompt` nie ma nazwy żadnego modułu. **(AC-2, AC-6)**
- [x] **T-14** — **`buildAiCatalog(modules)` w platformie + korzeń kompozycji.**
      `src/platform/ai/catalog.ts` — czysta funkcja, moduły **parametrem** (wzorzec
      `filterAccessibleFavorites(…, isPathLocked)`). `src/lib/ai/catalog.ts` — składa katalog
      z `MODULES`. Nikt jeszcze z niego nie korzysta.
      **Gotowe, gdy:** katalog złożony z deklaracji ma **dokładnie te same** akcje i read-toole co
      zrzut z T-1 — porównane pozycja po pozycji. **(AC-3, AC-6, AC-8)**
- [x] **T-15** — **ZMIANA ZACHOWANIA (osobny commit): trasy asystenta czytają z katalogu.**
      `execute/route.ts` — łańcuch 18 `if (module === …)` zastąpiony odpytaniem katalogu;
      `agent/route.ts` — read-toole i prompt z katalogu. Choke point walidacji (`hasContract` +
      `validateActionParams`) **zostaje w trasie** i nie zmienia się co do treści.
      **Gotowe, gdy:** rytuał przechodzi, a ręczne wywołanie kilku akcji asystenta daje ten sam wynik
      co przed zmianą. **(AC-6, AC-8, AC-13)**
- [x] **T-16** — Domknięcie fazy B: `test:unit` + `next build` + klikacz ścieżki szczęśliwej.
      **Gotowe, gdy:** build exit 0, klikacz 21/21. **(AC-12)**
      **Wynik fazy B — dowód, że nic nie zginęło.** Katalog złożony z deklaracji porównany
      z `baseline.json` **pozycja po pozycji**: read-toole **56 = 56** (nic nie brakuje, nic
      nadmiarowego), egzekutory **16 = 16**, katalogi akcji per moduł zgodne **co do jednego**
      (shopping 13 · tasks 15 · notes 9 · habits 6 · portfel 14 · kitchen 26 · flota 5 ·
      magazynowanie 10 · warsztaty 10 · health 9 · languages 7 · news 7 · weather 7 · contacts 3 ·
      reports 1 · pets 18 = **160**). Build exit 0, testy **657/657** (0 pominiętych — z bazą
      lokalną uruchomiły się też testy prywatności read-tooli, i przeszły przez NOWĄ drogę).
      **T-19 zrobione przy okazji T-15**, bo bramka i tak wymagała przepisania: `check:actions`
      pilnuje teraz własności mocniejszej — moduł wnoszący katalog akcji **musi** deklarować pole
      `ai`, inaczej jego akcje istnieją w kodzie i nie istnieją dla asystenta. Sprawdzone testem
      negatywnym.
      **Jedna rzecz zginęła po drodze i złapał ją test:** rozbicie promptu na wkłady modułowe
      zgubiło wiersz katalogu `web_search` (narzędzie bez implementacji w module — trasa obsługuje
      je osobno). Test `buildReadToolsPrompt` zapalił się natychmiast. To pierwszy raz, gdy ten test
      zarobił na siebie.

## Faza C — `platform/ai` (czysta przenosina)

- [x] **T-17** — **Reszta `src/lib/ai/` → `src/platform/ai/`.** ~23 pliki zdolności platformowych.
      **Nie jadą:** trzy manifesty JSON bramek (to dane kontroli, nie kod platformy) oraz
      `src/lib/ai/catalog.ts` i `executorShared.ts` (warstwa kompozycji — znają moduły).
      **Gotowe, gdy:** `grep -rn "@/modules/" src/platform/` zwraca **zero**. **(AC-1, AC-2)**
      **Wynik: 18 plików do platformy, `grep` zwraca zero.** W warstwie kompozycji zostało
      jedenaście pozycji i **każda z powodem**: `agentPrompt` (katalog nawigacji wymienia trasy
      modułów), `fastPath` (słowa-klucze rozpoznające moduł), `assistantStarters` (podpowiedzi per
      moduł), `catalog` (składa z `MODULES`), `coreReadTools` (woła kontrakt Kalendarza),
      `executorShared` i `readToolShared` (sięgają do tabel kilkunastu modułów), `coverage` + trzy
      manifesty JSON (dane bramek, nie kod platformy).
      Testy pojechały **razem ze swoim kodem** (12 plików) — lekcja z 047, tym razem zastosowana
      od razu, a nie po tym, jak `check:test-types` się zapalił.
- [x] **T-18** — **Bramki zaszyte na ścieżki — naprawa (przewidziana, nie awaria).**
      `check-action-coverage.js` czytało `src/lib/ai/agentPrompt.ts` i `src/lib/ai/executors/*` —
      oba miejsca zniknęły. `check-ai-coverage`, `check-cost-badge`, `check-content-memory` —
      korzenie skanowania i ścieżki w manifestach.
      **Gotowe, gdy:** cztery liczniki wracają na 160 / 551 / 35 / 35 **bez spadku**. **(AC-10, AC-11)**
- [x] **T-19** — **`check-action-coverage` pilnuje mocniejszej własności** (rozdz. 9.6): nie „czy ręczna
      lista jest kompletna", lecz „czy **każdy moduł zadeklarował** swoje akcje i czy każda ma
      egzekutor oraz kontrakt". Moduł bez deklaracji przestaje istnieć dla asystenta.
      **Gotowe, gdy:** bramka wywala się na module z akcjami, ale bez pola `ai` — sprawdzone **testem
      negatywnym**. **(AC-6, AC-10)**
- [x] **T-20** — Domknięcie fazy C: `test:unit` + `next build`.
      **Gotowe, gdy:** build exit 0.

## Faza D — Kolejka zadań

- [x] **T-21** — **Pole `jobs` w deklaracji + rdzeń kolejki do platformy.**
      `queue`, `worker`, `client`, `types` → `src/platform/jobs/`. Typ `JobHandler` bez wiedzy
      o module.
      **Gotowe, gdy:** rdzeń kolejki nie importuje modułu. **(AC-1, AC-2)**
- [x] **T-22** — **Handlery modułowe → moduły:** `kitchen.*` (4), `magazyn.*` (4), `pets.insights`,
      `news.refresh`, `stores.generate` (Zakupy) → `src/modules/<x>/jobs/`.
      **Zostają w platformie z powodem:** `user.facts` (przekrojowy — wnioskuje wiedzę o użytkowniku
      z działań we wszystkich modułach) i `imageInput` (wspólny helper wejścia obrazowego).
      **Gotowe, gdy:** rytuał przechodzi. **(AC-7)**
- [x] **T-23** — **ZMIANA ZACHOWANIA (osobny commit): `JOB_HANDLERS` i `ENQUEUABLE_TYPES` z deklaracji.**
      Allowlista tego, co klient może zakolejkować, przestaje być ręczną mapą.
      **Gotowe, gdy:** zbiór dozwolonych typów jest **identyczny** z dzisiejszym (12 pozycji),
      porównany z zrzutem z T-1. **(AC-7, AC-13)**
      **Wynik: 12 = 12, nic nie brakuje i nic nadmiarowego.** Trzy rzeczy warte odnotowania:
      • **O mało nie poszerzyłem allowlisty.** Pisząc rejestr platformowy odruchowo dopisałem do
        niego `skins.generate` — a to zadanie **nigdy nie było w `JOB_HANDLERS`**, bo trasa woła je
        synchronicznie. Wpis dołożyłby klientowi prawo do kolejkowania czegoś, czego wcześniej
        kolejkować nie mógł. Allowlista jest granicą bezpieczeństwa, więc porównanie z punktem
        odniesienia nie jest formalnością.
      • **Worker dostaje rezolwer wstrzyknięty** (`setJobHandlerResolver`), bo rejestr składa się
        z deklaracji, a platforma nie ma prawa ich znać. Parametr jest wymagany — wartość domyślna
        „na razie" byłaby dokładnie tym cichym obejściem, którego C-36 zabrania.
      • **Test kolejki zawiesił zestaw** po naiwnej poprawce: wołał `ensureJobWorker()`, co odpala
        `setInterval` trzymający proces testowy przy życiu. Rezolwer wstrzykujemy w teście wprost.
      Manifesty `content-memory` i `cost-badge` znów trzymały ścieżki — **czwarty raz w tej
      przebudowie**. I znów lint (nie bramka granic) złapał realne naruszenie: moduł Wiadomości
      importował własne wnętrze aliasem.
- [x] **T-24** — Domknięcie fazy D: `test:unit` + `next build`.
      **Gotowe, gdy:** build exit 0.

## Faza E — Pulpit i kalendarz z deklaracji (reszta zadania 7)

- [!] **T-25** — **Pole `dashboard` + wkłady ośmiu modułów.** Kuchnia, Zwierzęta, Flota, Portfel,
      Nauka języków, Zdrowie, Magazynowanie (×2 wkłady) — każdy dostaje `dashboard.ts` zwracający
      swój fragment migawki. Kształt danych **bez zmian**.
      **Gotowe, gdy:** wkłady istnieją, trasa jeszcze ich nie używa. **(AC-4)**
- [!] **T-26** — **ZMIANA ZACHOWANIA (osobny commit): `src/app/page.tsx` składa migawkę z katalogu.**
      Osiem importów kontraktów modułów znika z trasy pulpitu.
      **Gotowe, gdy:** migawka **identyczna** z zrzutem z T-1; `HomePage` dostaje dokładnie to samo.
      **(AC-4, AC-9, AC-13)**
- [x] **T-27** — **Pole `calendar` + wkłady sześciu modułów.** Zadania, Kuchnia, Zdrowie (+ leki),
      Zwierzęta, Flota, Nauka języków, Usługi — każdy wnosi swoje zdarzenia. **Te same `where`, ten
      sam `select`** co dziś w `collectCalendarEvents` — przenosimy zapytanie, nie przepisujemy go.
      **Gotowe, gdy:** wkłady istnieją, agregat jeszcze ich nie używa. **(AC-5)**
- [x] **T-28** — **ZMIANA ZACHOWANIA (osobny commit): `collectCalendarEvents` składa wkłady.**
      Moduł Kalendarz przestaje sięgać do tabel sześciu innych modułów.
      **Gotowe, gdy:** agregat zwraca **identyczny** wynik jak zrzut z T-1 — porównany zdarzenie po
      zdarzeniu. **(AC-5, AC-9, AC-13)**
      **Wynik: 38 zdarzeń przed, 38 po, listy identyczne co do znaku.** `collectCalendarEvents`
      schudło z 227 linii do 32: została **wyłącznie** kompozycja i sortowanie. Siedem wkładów
      (Zadania, Kuchnia, Zdrowie z lekami, Flota, Zwierzęta, Języki, Usługi) przeniesiono
      z zapytaniami bez ich przepisywania — te same `where`, `select`, identyfikatory i adresy.
      **Wkład, który rzuci wyjątkiem, nie wywala agendy** — kalendarz czyta siedem źródeł i jedno
      padnięcie nie może zamienić sześciu działających w pustą stronę.
      **Bramka rejestru złapała mnie na gorącym uczynku:** korzeń kompozycji trafił początkowo do
      `src/lib/calendar/`, co po piątym teście z 048 czyta się jako „kod modułu Kalendarz poza jego
      katalogiem". Nazwa myliła, treść nie — plik jest teraz pojedynczym `src/lib/calendarContributors.ts`.
- [x] **T-29** — Domknięcie fazy E: `test:unit` + `next build` + klikacz ścieżki szczęśliwej.
      **Gotowe, gdy:** build exit 0, klikacz 21/21. **(AC-12)**

## Faza F — Domknięcie Fazy 1

- [ ] **T-30** — **Szósty test `check:module-registry`: moduł opisany poza własnym katalogiem.**
      Żaden egzekutor, read-tool, handler zadania, wkład pulpitu ani kalendarza należący do modułu
      z rejestru nie może mieszkać pod ścieżką platformową ani w warstwie kompozycji.
      **Gotowe, gdy:** bramka zielona na repo i **czerwona po podłożeniu** pliku łamiącego regułę —
      test negatywny, jak przy piątym teście w 048. **(AC-14)**
- [ ] **T-31** — **Pełny zestaw klikaczy** + porównanie z punktem odniesienia.
      **Gotowe, gdy:** klikacz ścieżki szczęśliwej 21/21, a liczba czerwonych w pełnym zestawie
      **nie rośnie** (dziś 14); każda nowa czerwona ma diagnozę. **(AC-12)**
- [ ] **T-32** — **Inwentarz końcowy: co zostało poza platformą i dlaczego.**
      Spis rzeczy świadomie niebędących w `src/platform/` (`user.facts` w platformie mimo nazwy,
      `executorShared`, `catalog` kompozycji, manifesty bramek, `llm-client`) — każda z powodem.
      **Gotowe, gdy:** żadna pozostałość nie jest bez zapisanego uzasadnienia. **(AC-1)**
- [ ] **T-33** — **Dokumentacja:** `CLAUDE.md` (warstwa platformy kompletna, cztery nowe pola
      deklaracji), `constitution.md` (C-36 o `ai`/`calendar`/`dashboard`/`jobs`), rozdz. 15 dziennika
      (wpis 049: stan Fazy 1, co z niej zostało, pierwszy krok Fazy 2), `doświadczenia.md` (C-51).
      **Gotowe, gdy:** dziennik odpowiada na pytanie „czy Faza 1 jest domknięta". **(AC-15)**
- [ ] **T-34** — **Odpowiedź KODEM na pytanie kontrolne z rozdz. 14** („ile miejsc trzeba dotknąć,
      żeby dodać moduł?"). Odpowiedzią jest bramka z T-30 plus zliczenie: ile plików poza katalogiem
      modułu trzeba dotknąć, dodając moduł z pełnym wyposażeniem (menu, nawigacja, AI, pulpit,
      kalendarz, zadania w tle).
      **Gotowe, gdy:** liczba zapisana w dzienniku i **wynosi 1** (sama deklaracja w korzeniu
      kompozycji) albo ma wypisany powód, dlaczego nie. **(AC-14, AC-15)**
- [ ] **T-35** — **Bramki końcowe:** komplet + `next build` przeciw lokalnemu Postgresowi (C-13).
      **Gotowe, gdy:** wszystko zielone, cztery liczniki bez spadku. **(AC-10)**

---

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|---|---|
| AC-1 — zdolności platformowe w platformie | T-2, T-17, T-21, T-32 |
| AC-2 — zero importów modułów z platformy | T-2, T-10, T-13, T-17, T-21 |
| AC-3 — wiedza modułowa parametrem **wymaganym** | T-4, T-5, T-14 |
| AC-4 — pulpit z deklaracji | T-25, T-26 |
| AC-5 — kalendarz z deklaracji | T-27, T-28 |
| AC-6 — katalog asystenta z deklaracji | T-6…T-9, T-11…T-15, T-19 |
| AC-7 — zadania w tle z deklaracji | T-21, T-22, T-23 |
| AC-8 — asystent odpowiada tak samo | T-1 (zrzut), T-14, T-15 |
| AC-9 — pulpit i kalendarz bez zmian | T-1 (zrzut), T-26, T-28 |
| AC-10 — cztery liczniki bez spadku | T-18, T-19, T-35 |
| AC-11 — bramkę naprawiamy, nie obchodzimy | T-18 |
| AC-12 — klikacze | T-16, T-29, T-31 |
| AC-13 — przenosiny oddzielone od zachowania | T-15, T-23, T-26, T-28 |
| AC-14 — bramka odpowiada na „ile miejsc" | T-30, T-34 |
| AC-15 — dziennik | T-33, T-34 |

## Ścieżka krytyczna

```
T-1 → T-2 → [Faza B: T-4 → T-5 → T-6…T-9 → T-10 → T-11 → T-12 → T-13 → T-14 → T-15]
     → T-17 (możliwe DOPIERO po T-15) → T-18 → T-19
     → T-21 → T-22 → T-23
     → T-25 → T-26 → T-27 → T-28
     → T-30 → T-34
```

**Co blokuje co:**
- **T-17 jest zablokowane przez całą fazę B** — `lib/ai` nie pojedzie do platformy, dopóki jego pliki
  importują moduły. To jest jedyna twarda zależność w tym przebiegu i powód, dla którego kolejność
  faz jest odwrotna do intuicyjnej.
- **T-18 jest zablokowane przez T-17** — bramki naprawiamy dopiero, gdy ścieżki są docelowe;
  naprawianie ich w połowie przenosin oznaczałoby robienie tego dwa razy.
- **T-15, T-23, T-26, T-28** to cztery zmiany zachowania i **żadna nie może dzielić commitu**
  z przenosinami (AC-13).
- **T-1 blokuje AC-8 i AC-9** — bez zrzutu sprzed zmian nie ma z czym porównać asystenta, pulpitu
  i kalendarza; po przenosinach tego materiału już się nie odtworzy.

**Zadania równoległe:** brak sensownych `[P]` — kolejne grupy egzekutorów dotykają tego samego
`agentPrompt.ts` i rejestru w trasie, więc zrównoleglenie kupiłoby konflikty zamiast czasu.

## Notatki / blokady

- **Read-toole a `requireAccess`:** rozdz. 9.6 wymaga, żeby read-toole asystenta przechodziły przez
  `requireAccess`, a nie przez `where: { ownerId }` — inaczej asystent stanie się drogą obejścia
  uprawnień do zasobów współdzielonych. **To jest realne zagrożenie bezpieczeństwa**, ale
  `requireAccess` powstaje dopiero w zadaniu 10 (Faza 2). Świadomie **poza zakresem** tego przebiegu
  i odnotowane w specu §5, żeby nie zginęło przy przejściu do Fazy 2.
- **Odstępstwo od rozdz. 9.3:** pola deklaracji są **leniwe** (funkcja zwracająca `import()`), a nie
  statyczne jak w dokumencie. Powód jest twardy: `MODULES` importuje `ModuleSidebar`, komponent
  kliencki, a egzekutory i handlery to kod serwerowy.
