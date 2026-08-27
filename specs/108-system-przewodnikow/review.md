# Recenzja: Profesjonalny system przewodników użytkownika

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-27
- **Zakres diffa:** `origin/develop...HEAD` — 43 pliki, +3185 / −282 (w tym 13 plików treści markdown)

## Ustalenia

Recenzja skupiła się na tym, czego `/verify` z natury nie łapie: `/verify` sprawdza, czy zachowanie
zgadza się z kryteriami, a nie czy kod jest tak prosty, jak być powinien. Oba poważniejsze ustalenia
są właśnie tego rodzaju — nie objawiały się niczym w testach.

### 1. Podwójne wypełnienie poziome w obu widokach działu — `convention` ✅ naprawione

`PrzewodnikiHub.tsx:112`, `PrzewodnikReader.tsx:238`

Oba komponenty nakładały własne `padding: 0 var(--view-padding) …` na kontener treści, a rama
**już** nakłada dokładnie takie samo wypełnienie (`ModuleView.tsx:393`).

*Skutek:* treść działu odsunięta od krawędzi o 32 px zamiast 16 px, czyli dwa razy dalej niż
w każdym innym module. Na telefonie (360 px) to 64 px z 360 zabrane na marginesy — najbardziej
kosztowne dokładnie tam, gdzie najmniej wolno. Nie objawiało się jako błąd: strona wyglądała
poprawnie, tylko *inaczej* niż reszta aplikacji, a różnicę widać wyłącznie w porównaniu.

*Poprawka:* usunięte wypełnienie poziome w obu komponentach; zostaje samo dolne (32/48 px na
komfort czytania długiego tekstu). To jest właśnie sytuacja z C-33: rama ma jedno miejsce na tę
decyzję, a widok nie powinien jej powtarzać.

### 2. Dwie równoległe implementacje wyszukiwania — `simplification` ✅ naprawione

`src/lib/przewodniki.ts` (dawne `szukajWPrzewodnikach`) vs `PrzewodnikiHub.tsx` (pętla inline)

Funkcja `szukajWPrzewodnikach` była **eksportowana, otestowana czterema testami i nieużywana przez
nikogo**; hub — czyli jedyne miejsce, w które klika czytelnik — miał własną, drugą pętlę
wyszukującą po chudym indeksie. Obie normalizowały tak samo, ale różniły się długością fragmentu
(160 vs 170 znaków), ilością kontekstu przed trafieniem (⅓ długości vs 50 znaków) i limitem
(20 vs 24).

*Scenariusz awarii:* zmiana zachowania wyszukiwarki (inne progi, inny fragment, poprawka
w dopasowaniu) trafiałaby do jednej z dwóch kopii. Gdyby trafiła do wersji w `lib`, **testy
przechodziłyby na zielono, a wyszukiwarka użytkownika nie zmieniłaby się wcale** — bo testy
sprawdzały ścieżkę, której produkt nie wykonuje. To ta sama pułapka, którą CLAUDE.md opisuje przy
084: martwe API czytane jako „zalecana droga".

*Poprawka:* jedna funkcja `szukajWIndeksie(indeks, fraza, limit)` w `przewodnikiSzukanie.ts`,
operująca na **indeksie** — tym samym, który hub dostaje z serwera. Woła ją hub, a testy wołają ją
na indeksie zbudowanym przez `indeksWyszukiwania()`. Martwa wersja w `lib` usunięta razem z jej
typem i stałą. Testy jednostkowe: 8/8, e2e: 15/15 — bez zmiany treści asercji, co jest dowodem, że
scalenie nie zmieniło zachowania.

### 3. Fragment liczony na ułamku znaku — `correctness` (drobne) ✅ naprawione przy okazji

Dawne `poz - DLUGOSC_FRAGMENTU / 3` dawało `53.33`, więc `start` bywał niecałkowity, a warunek
`start > 0` porównywał ułamek. `String.slice` obcina to do liczby całkowitej, więc skutku nie było —
ale zniknęło razem ze scaleniem (stała `KONTEKST_PRZED = 50`, liczba całkowita z nazwą mówiącą,
czym jest).

## Sprawdzone i bez zastrzeżeń

- **Bezpieczeństwo renderu (`dangerouslySetInnerHTML` ×2).** Treść pochodzi **z repozytorium**, nie
  od użytkownika, i przechodzi przez `markdownToHtml`, który globalnie ekranuje `&` i `<`, a surowy
  HTML zamienia na tekst. Drugie użycie to `MARKDOWN_STYLES` — stała w kodzie, wzorzec z sześciu
  istniejących widoków.
- **Kontrola dostępu.** Obie trasy wymagają sesji (`redirect("/auth/signin")`). Uprawnienia liczy
  `isPathLocked` — **ta sama funkcja, której używa menu boczne**, więc obie powierzchnie nie mogą
  powiedzieć czegoś innego o tym samym module. Brak nowego sluga jest świadomy i uzasadniony
  w specu §6.
- **C-20/C-21/C-23:** nie dotyczą — zero mutacji, zero zasobów użytkownika, zero `AIAction`.
  `check:actions` i `check:ai-coverage` zielone.
- **Warunki widoczności paska.** Trzy zmienione warunki to rozszerzenia alternatywy (`|| !!help`) —
  widok bez `help` idzie dokładnie tą samą gałęzią, co przed zmianą.
- **`AnchoredLayer` przy zamkniętym panelu zwraca `null`** (`AnchoredLayer.tsx:140`), więc nie
  zostawia pustego dziecka w wierszu akcji, który na telefonie rozciąga dzieci (`[&>*]:flex-1`).
- **Odnośniki w treści.** `klikWTresc` przepuszcza kotwice (`#…`) do przeglądarki, wewnętrzne adresy
  oddaje `router.push`, zewnętrzne otwiera z `noopener,noreferrer`. Klawiatura działa, bo Enter na
  `<a>` generuje zdarzenie kliknięcia, które bąbelkuje do kontenera.
- **`updatedAt` przez `formatujDate`**, nie `toLocaleDateString("pl-PL")` (C-32).
- **Ikona pomocy 36×36** — zgodna z sąsiadującym `PrzyciskUstawien`; na telefonie wiersz akcji
  rozciąga oba na pełną szerokość. Zmiana samego rozmiaru pomocy rozjechałaby ją z ustawieniami,
  więc świadomie zostaje jak jest (C-53: zgodność z otoczeniem).
- **Treść markdown** nie używa pionowej kreski wewnątrz komórek tabeli — renderer Omnii nie zna
  znaku ucieczki dla niej (`markdown.ts:21,27`), więc taka komórka rozpadłaby się na dwie.

## Bramki po poprawkach

| Sprawdzenie | Wynik |
|---|---|
| `tsc --noEmit` (aplikacja i testy) | ✅ czysto |
| `next lint --dir src` | ✅ zero błędów i ostrzeżeń w plikach zmiany |
| `check:ui-contract`, `check:i18n`, `check:tailwind`, `check:boundaries`, `check:client-safe`, `check:logs`, `check:e2e-waits` | ✅ |
| `next build` (lokalny Postgres) | ✅ `/guide` 10,7 kB / 147 kB, `/guide/[slug]` 6,81 kB / 119 kB |
| `check:perf` | ✅ w paśmie ±5 %, próg nietknięty |
| testy jednostkowe przewodników | ✅ 8/8 |
| E2E `przewodniki.spec.ts` | ✅ **15/15** — po refaktorze, bez zmiany asercji |

## Werdykt

**APPROVE Z UWAGAMI.**

Trzy ustalenia, wszystkie naniesione w tej recenzji; żadne nie wymagało powrotu do `/implement`, bo
nie zmieniały zakresu ani zachowania widocznego dla użytkownika — dwa pierwsze były długiem, który
zapłaciłby się dopiero przy następnej zmianie (podwójne wypełnienie: przy pierwszym porównaniu
z innym modułem; podwójne wyszukiwanie: przy pierwszej poprawce wyszukiwarki, która „nie zadziałała
mimo zielonych testów").

Uwagi niezablokowujące, przeniesione z `/verify`:
1. Test `assertOwnership` (078) pada **sprzed tej zmiany** — udowodnione `git stash`. Zastany dług.
2. Poprawka dwóch komunikatów potwierdzenia w Notatkach wykracza poza pierwotny zakres speca —
   świadomie, bo przewodnik nie może stać w sprzeczności z aplikacją. Odnotowana w `doświadczenia.md`.
3. E2E biegły w projekcie `desktop`; `mobile` używa WebKita, którego w tym środowisku nie ma.
   AC-10 sprawdzone oknem 360×720 w Chromium — układ tak, silnik Safari nie.
