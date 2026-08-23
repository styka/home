# 083 — Recenzja

> Etap 6. Recenzję świeżym okiem wykonał subagent `omnia-reviewer` na pełnym `git diff
> origin/develop...HEAD` (53 pliki, +3094/−1380). Poniżej jego ustalenia, mój werdykt co do każdego
> i co z nim zrobiono. Wszystkie siedem naprawiono w tym samym przebiegu.

## Ustalenia

### 1. Zamrożony obserwator sekcji — `sekcjeTematow.tsx` · correctness · **POTWIERDZONE, naprawione**

Efekt tworzący `IntersectionObserver` zależał od `kolejnosc.join(",")` — listy **identyfikatorów** —
a obserwował **węzły DOM** rejestrowane osobną drogą przez `ref`. Przy przełączeniu
`Wiadomości ⇄ Linia czasu` oba widoki rysują sekcje tych samych tematów w tej samej kolejności
(`getStreamView` i `getStreamTimeline` sortują identycznie), więc lista nie zmieniała się ani o znak,
a React wymieniał węzły.

*Scenariusz awarii:* Wiadomości → Linia czasu → Wiadomości. Obserwator trzyma odpięte sekcje osi.
`czytanyTemat` zamarza: (a) niebieskie wyróżnienie przyklejonego nagłówka zostaje na złej sekcji przez
całe przewijanie, (b) strzałka ▶ przy „Wszystkich" liczy sąsiada od zamrożonej wartości, więc skacze
nie tam, gdzie użytkownik czyta. Każde kolejne przełączenie utrwala stan.

*Poprawka:* obserwacja wynika teraz z **rejestracji węzła** — `zarejestruj` sam woła
`observe`/`unobserve` na instancji trzymanej w `ref`, a efekt tworzący obserwatora zależy wyłącznie od
`rootMargin` (czyli od zasłony górnej). `kolejnosc` znika z wejścia hooka.

*Dowód:* nowy klikacz `e2e/specs/news-observer-remount.spec.ts`, sprawdzony **w obie strony** — zielony
na poprawionym kodzie, czerwony po cofnięciu poprawki („wskazanie czytanego tematu zamarło po
przemontowaniu sekcji; widziane: ∅"). Na starym kodzie wyróżnienie nie pojawiało się w tym scenariuszu
ani razu, co jest jeszcze mocniejszym potwierdzeniem niż zakładałem pisząc test.

### 2. Fałszywe powiadomienia o koszcie AI — `AiCostBadge.tsx` · correctness · **POTWIERDZONE, naprawione**

`useEffect` meldował koszt przy każdym zamontowaniu, bez rozróżnienia „koszt właśnie powstał" od
„koszt odczytany z zapisu". Tymczasem `rememberedContent` przy trafieniu w pamięć zwraca **zapisane**
`usage`, a `AiContentMeta` przekazywało je do plakietki bez filtra.

*Scenariusz awarii:* administrator wchodzi na Wiadomości → Gorące tematy. `getHotTopics()` bez `force`
zwraca treść z `AiContent` — **zero wywołań modelu** — a w rogu wyskakuje „Wiadomości — gorące tematy
~$0,0123". To samo na Pogodzie, w Magazynowaniu, u Zwierząt i w Kuchni. Dodatkowo `RefreshStatus`
dostawał `usage` **poprzedniego** przebiegu z `getNewsRefreshState()`, wołanego przy montowaniu — więc
alarm szedł przy samym wejściu na moduł. Nawet galeria komponentów meldowała koszt swojego statycznego
przykładu.

*Poprawka:* `AiCostBadge` dostał `swiezy` (domyślnie `true` — w większości z 27 miejsc plakietka stoi
przy wyniku wywołania z tego samego gestu). `AiContentMeta` ma `swiezy` **wymagane, bez domyślnika** —
ta sama decyzja co przy `akcja`: sekcja AI jest z definicji miejscem treści odczytanej, więc domyślnik
byłby fałszywy w połowie renderów. `fromMemory` dopisane do czterech DTO, które go nie niosły
(`HotTopicsResult`, `pets.insights`, `storage.insights`, `kitchen.planWeek`). Koszt przebiegu
odświeżania melduje się teraz z efektu **domykającego przebieg**, a nie z renderu stanu.
**Rysowanie od `swiezy` nie zależy** — zapamiętany koszt przy treści jest jej opisem, a nie
doniesieniem o zdarzeniu.

### 3. Oś czasu bez granicy — `news.ts` `getStreamTimeline` · correctness/wydajność · **POTWIERDZONE, naprawione**

Dwa problemy w jednej funkcji. **(a)** `take: SUFIT_LISTY` stało na `newsTopic.findMany`, ale
zagnieżdżone `timeline` nie miało żadnego ograniczenia — a `check:pagination` bada `findMany`, nie
`include`. `NewsTimelineEntry` **nie podlega retencji** (`retention.ts` czyści pulę materiałów, nie
fakty na osi), więc po pół roku monitorowania kilkunastu tematów jedno kliknięcie „Linia czasu"
ściągałoby całą historię naraz. `getStreamView` tego problemu nie ma, bo pozycje są tam zawężone do
`status: "PENDING"`. **(b)** `articleIds` zbierane ze wszystkich tematów szło do zapytania z
`take: SUFIT_LISTY`: powyżej tysiąca identyfikatorów część faktów **po cichu** traciłaby odnośnik
„sprawdź u źródła" — bez błędu, zależnie od kolejności zwróconej przez bazę.

*Poprawka:* sufit **na temat** (`SUFIT_OSI_NA_TEMAT = 100`) plus pobieranie adresów **partiami**
(`adresyMaterialow`) — skoro pytamy o konkretne klucze główne, granicą jest rozmiar partii, a nie sufit
wyniku; niepełny wynik znaczyłby tam „fakt bez odnośnika", nie „krótsza lista", stąd `paginacja:
kompletny` przy samym zapytaniu.

### 4. Zegar powiadomienia restartował się przy scalaniu — `KosztToasts.tsx` · correctness · **POTWIERDZONE, naprawione**

Efekt zależał od całej tablicy `wpisy`, a scalenie powtórzenia tworzy nową tablicę (niemutowalność),
więc każdy doliczony koszt zakładał zegar od nowa. Komentarz nad efektem obiecywał dokładnie to, czego
kod nie robił.

*Scenariusz awarii:* rozmowa z asystentem raportująca koszt pod tą samą etykietą częściej niż raz na
6 s → powiadomienie nie znika nigdy (licznik ×N rośnie), wbrew AC-11.

*Poprawka:* `wygasaO` jest polem wpisu, ustawianym **przy utworzeniu** i nietykanym przy scalaniu;
zegar liczy do tej wartości, a zależnością są `id` i `wygasaO` najstarszego wpisu.

### 5. Martwy zestaw kluczy `modules.news.TopicPicker` — `messages/pl.json` · simplification · **POTWIERDZONE, naprawione**

`check:i18n` sprawdza kierunek `t("klucz")` → wpis, nie odwrotny, więc pięć kluczy usuniętego
komponentu przetrwałoby jako praca do wyrzucenia dla tłumacza. Namespace skasowany.

### 6. Strzałki nawigatora — `GroupNavigator.tsx` + `NewsPage.tsx` · convention · **POTWIERDZONE, naprawione**

Dwie rzeczy: klasa `strzalka` miała `disabled:opacity-30`, ale atrybut `disabled` nigdy nie był
przekazywany; a `sasiad` przy wybranym temacie liczył sąsiada po samych tematach, więc pozycja zbiorcza
„Wszystkie" była **nieosiągalna strzałką**, choć w liście stoi pierwsza.

*Poprawka:* krok idzie teraz po `pozycjeNawigatora(...)`, czyli dokładnie po tym, co widać w liście —
◀ z pierwszego tematu wraca do „Wszystkich". `GroupNavigator` przyjmuje `moznaWstecz`/`moznaDalej`
(liczy je konsument, bo tylko on wie, czym jest „sąsiad" w jego widoku) i faktycznie wyłącza przycisk
na krańcu. Milczące nic na dotknięcie było dokładnie tym, przed czym ostrzega komentarz w
`sasiadujacaGrupa`.

### 7. Galeria komponentów strzelała powiadomieniem — `playground/registry.tsx` · correctness · **POTWIERDZONE, naprawione**

Pochodna #2; wpis galerii podaje teraz `swiezy={false}` — demonstracja nie jest wywołaniem modelu.

## Czego recenzent nie zakwestionował (sprawdzone i czyste)

Kontrola dostępu w `getStreamTimeline` (`filtrMoichRekordow` jak w `getStreamView`; wpisy i źródła
dochodzą wyłącznie relacją z zawężonych tematów); brak wiszących odwołań po `setActiveSource`,
`activeSourceKey`, `getNewsRefreshHistory` i `TopicPicker`; `localStorage` w `kosztWidocznosc` w
`try/catch` z odczytem w `useEffect` (bez rozjazdu hydratacji); serwerowa decyzja o widoczności kosztów
(AC-6); brak pętli efektów i wycieków nasłuchów; warunki brzegowe pustych list; `przewinDoSekcji` bez
`scrollIntoView` (lekcja z 082); C-12, C-20, C-30, C-31, C-32; rozdzielenie nieruchomej ramy od
przewijanej treści w `ModuleView`.

Recenzent odnotował też polskie literały poza `t()` w `NewsPage` (`"Odśwież"`, etykiety modala) —
sprawdził `origin/develop` i potwierdził, że **wszystkie są przeniesione ze starej wersji**; ten
przebieg ich nie wprowadza, więc nie są regresją. Zgadzam się: wchodzą w te ~820 fragmentów zdaniowych
z listy „do `t.rich(...)`" w `CLAUDE.md`.

## Bramki po poprawkach

32 bramki statyczne, `tsc` (aplikacja + testy), `next lint`, `next build`, budżet wydajnościowy
(najcięższa trasa 1171 kB, suma 65667 kB — w paśmie ±5%), **1153 testy jednostkowe** — wszystko
zielone. Klikacz, pełny przebieg: **150 zielonych, 0 czerwonych** (208 pominiętych to projekt
mobilny — WebKit niedostępny w sandboxie). `shopping/add-item-enter`, jedyny czerwony z poprzedniego
przebiegu poza tym świadomie zmienionym, przeszedł.

## Werdykt

**APPROVE.**

Recenzent wystawił APPROVE Z UWAGAMI i rekomendował domknąć #1, #2 i #3 przed merge'em. Wszystkie
siedem ustaleń zostało naprawionych, a dwa najpoważniejsze mają dowód w przeglądarce — #1 sprawdzony
w obie strony nowym klikaczem, który został w repozytorium jako stała ochrona przed tą klasą błędu.
Nic tu nie grozi utratą danych ani przeciekiem uprawnień; przebieg **usuwa** więcej nośników stanu,
niż dodaje.
