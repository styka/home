# Weryfikacja: Wiadomości — tytuły/streszczenia po polsku + „do doczytania"

- **Spec:** ./spec.md (124-wiadomosci-polski-i-doczytania)
- **Data:** 2026-09-03

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run build` (pełny łańcuch, lokalny Postgres `worldofmag_e2e`) | ✅ zielony do `check:perf-budget` włącznie |
| `check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0291)" |
| `check:actions` (spójność akcji asystenta) | ✅ 168 akcji, wszystkie z egzekutorem i kontraktem |
| `check:ai-coverage` | ✅ 688 akcji z zakresem i guardem (w tym nowy `news:setItemReadLater`) |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:pagination` | ✅ każde `findMany` z granicą (nowe selekcje 3b/3c mają `take`) |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" |
| `tsc --noEmit` + `tsc -p tsconfig.test.json` | ✅ czysto |
| `next build` | ✅ 148 stron; budżet wydajnościowy w paśmie ±5 % |
| `npm run test:unit` (heurystyka) | ✅ `jezykTytulu.test.ts` 8/8 |
| e2e `scripts/e2e-web.sh e2e/specs/124-wiadomosci-doczytania.spec.ts` | ✅ 6/6 (desktop) |
| `check:schema-drift` | ⚠️ pominięty (sandbox nie przygotował bazy cienia — udokumentowane zachowanie bramki); ręcznie: migracja 0290 = dokładnie jedno `ADD COLUMN "readLater"`, identyczne z jedynym nowym polem w `schema.prisma` |
| `scripts/migrate.js` (ostatni krok builda) | ⚠️ padł na pustym `DIRECT_URL` w podprocesie npm (osobliwość env sandboxa); **sama migracja 0290 zaaplikowana czysto** przez `prisma migrate deploy` w kroku 4/6 `e2e-web.sh`. C-50 każe lokalnie weryfikować do `next build` — spełnione z zapasem |

## Kryteria akceptacji

- **AC-1 (tytuły po polsku, wyjątek nazw własnych)** — ✅ *spełnione (kod + testy; dowód „na żywo" po deployu).*
  Trzy domknięte ścieżki: (1) nowe pozycje — tłumaczenie tytułu w partii streszczeń (istniejące 084,
  prompt wzmocniony o wyjątek nazw własnych: `jobs/newsRefresh.ts`, instrukcja „Nazwy własne, tytuły
  dzieł i utrwalone terminy branżowe zostaw w oryginale"); (2) pozycje po awarii partii — etap 3b
  ponawia streszczenie+tytuł; (3) pozycje z dobrym streszczeniem i obcym tytułem — etap 3c
  (`dotlumaczTytuly`) dotłumacza sam tytuł. Kandydatów wskazuje `tytulWygladaNaObcy`
  (`lib/jezykTytulu.ts`), testy 8/8 — w tym dokładny tytuł ze zgłoszenia („The economics of agent
  scale…" → obcy) i kontrprzykłady (polski z angielskim terminem → nie ruszamy). Ostateczne
  potwierdzenie językowe wymaga realnego przebiegu z modelem — do obejrzenia na `develop` po deployu
  (log `news.repair.titles`).
- **AC-2 (streszczenia po polsku + wyjątek)** — ✅ *spełnione (kod).* Prompt streszczeń od zawsze
  „po polsku"; wyjątek nietłumaczalnych słów dopisany tym samym zdaniem co dla tytułów.
- **AC-3 (naprawa zastanych bez ręcznej interwencji)** — ✅ *spełnione (kod).* Etapy 3b/3c działają
  na pozycjach `PENDING` **spoza** `newItemIds`, wchodzą w każdy zwykły przebieg odświeżania; zapis
  3c zmienia wyłącznie `title` (url/źródło/status nietknięte), zapis 3b idzie istniejącą ścieżką
  `summarizeItems`.
- **AC-4 (ponowienie po błędzie, bez utrwalenia)** — ✅ *spełnione (kod).* `summaryFailed:true`
  wchodzi do selekcji 3b w KAŻDYM przebiegu; nieudane dotłumaczenie tytułu zostawia stan bez zmian,
  więc heurystyka wskaże pozycję ponownie. Limit `NAPRAWA_LIMIT=40`/przebieg zapobiega lawinie
  kosztów; pusty wynik modelu nigdy nie nadpisuje tytułu.
- **AC-5 (jeden odwracalny gest, widoczny znacznik)** — ✅ *e2e [124-AC5..AC8]*: klik „Doczytam" →
  ten sam przycisk staje się „Odłożone" (`aria-pressed`, wypełniona ikona, akcent amber).
- **AC-6 (zawężenie jednym gestem, licznik, wszystkie tematy)** — ✅ *e2e [124-AC5..AC8]*: licznik
  „1" na przycisku paska, po włączeniu widać wyłącznie odłożoną kartę, wyjście tym samym
  przyciskiem. Filtr działa na TYM SAMYM zbiorze co filtr źródeł (`widoczneWiadomosci`), więc
  nawigator/liczniki/lektor/pusty stan są spójne (lekcja 085).
- **AC-7 (odłożone przeżywają „oznacz wszystkie" i odświeżenie)** — ✅ *e2e [124-AC5..AC8]*:
  „Oznacz wszystkie" (z potwierdzeniem) nie zdjęło odłożonej; w kodzie `readLater: false` w `where`
  obu akcji zbiorczych (`acknowledgeTopicItems`, `acknowledgeAllItems`). Odświeżanie nie dotyka
  `readLater` (żaden zapis przebiegu nie rusza tej kolumny).
- **AC-8 (przeczytanie zdejmuje odłożenie)** — ✅ *e2e [124-AC5..AC8]*: „Przeczytane" na odłożonej →
  karta znika z zawężenia, licznik 0; w kodzie `acknowledgeItem` pisze `readLater: false`.
- **AC-9 (telefon 360 px, stała wysokość paska)** — ✅ *e2e [124-AC9]*: przycisk widoczny (ikona +
  licznik, etykieta schowana poniżej `lg`), strona bez poziomego przewijania. Przycisk ma tę samą
  wysokość co sąsiedni przełącznik trybu czytania (`py-3`), a przy 0 odłożonych jest widoczny,
  lecz wyłączony (wzorzec 100) — szerokość paska nie zależy od liczby odłożonych.
- **AC-10 (stan w URL, ulubialny, odtwarzalny)** — ✅ *e2e [124-AC10]*: wejście z `?doczytania=1`
  odtwarza zawężenie (`aria-pressed=true`); klucz siedzi w tym samym `viewState` co
  `tresc`/`zrodla`/`czytanie`, więc gwiazdka „zapisz widok" niesie go automatycznie.

## Zgodność z konstytucją

- **C-01/C-02/C-36** ✅ — całość w `worldofmag/`, wewnątrz `src/modules/news/` importy względne,
  zero nowych zależności międzymodułowych.
- **C-10/C-11/C-12** ✅ — ręczna migracja `0290_news_read_later`, numer wolny, Boolean (nie enum).
- **C-13** ✅ — build i migracje wyłącznie na lokalnym Postgresie.
- **C-20/C-21** ✅ — `setItemReadLater` z guardem wg wzorca `acknowledgeItem`
  (`czyMojRekord(item.topic)`) i `revalidatePath("/wiadomosci")`; akcje zbiorcze NIE poszerzyły
  zakresu (zawęziły o `readLater: false`).
- **C-30/C-31/C-32/C-33** ✅ — wyłącznie zmienne CSS (`--accent-amber`, `--on-accent` nietknięte),
  cele dotyku jak sąsiednie kontrolki, teksty przez `t()` (bramka i18n zielona), stany brzegowe
  przez istniejący mechanizm strumienia.
- **C-40** ✅ — dotłumaczenie tytułów przez `llmJson("dispatch", …)` — routing DB-driven, zero
  hardcodowanego modelu.
- **C-51** ✅ — lekcja w `doświadczenia.md` (2026-09-03, „Tłumaczenie «tylko dla nowych» utrwala
  obcy tytuł na zawsze").
- **C-53** ✅ — jedna kolumna, jedna akcja, naprawa wpięta w istniejący przebieg; heurystyka zamiast
  nowej zależności do detekcji języka.

## Regresje

- **Akcje zbiorcze**: licznik „Oznaczono: N" liczy wynik `updateMany`, więc dalej mówi prawdę
  (odłożone po prostu nie wchodzą do N).
- **`getTopicView`/lektor/NewsReader**: konsumują `toItemDTO` — nowe pole jest addytywne; lektor
  czyta `widoczneWiadomosci`, więc w zawężeniu czyta same odłożone (spójne z 085).
- **Przebieg odświeżania**: etapy 3b/3c są za `try` przebiegu; awaria dotłumaczenia tytułów jest
  łapana lokalnie (`news.repair.titles_failed`) i nie przewraca przebiegu. Liczniki kroniki:
  do `summarized` doliczają się tylko realne streszczenia (3b).
- **Migracja**: `ADD COLUMN … DEFAULT false` — addytywna, starszy kod jej nie czyta; rollback kodu
  nie wymaga migracji w dół.
- **Suita e2e**: nowy spec w trybie `serial` z sejdem odpornym na wyścig workerów; pozostałe specs
  nie tworzą `NewsItem`, więc „Oznacz wszystkie" z testu nie zjada im danych.

## Werdykt końcowy

**GOTOWE Z UWAGAMI** — wszystkie AC spełnione; dwie uwagi środowiskowe, żadna nie blokuje:
1. Językowy efekt końcowy AC-1/AC-3 (realne tłumaczenie przez model) do potwierdzenia logiem
   `news.repair.titles` po deployu na `develop` — sandbox nie ma skonfigurowanego dostawcy modelu.
2. `check:schema-drift` pominięty (baza cienia niedostępna w sandboxie) — zgodność migracji ze
   schematem potwierdzona ręcznie; `migrate.js` padł tylko na osobliwości env (pusty `DIRECT_URL`
   w podprocesie), sama migracja zaaplikowana czysto.
