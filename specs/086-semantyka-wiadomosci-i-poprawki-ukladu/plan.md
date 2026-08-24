# Plan techniczny: Semantyka akcji w Wiadomościach, świeże gorące tematy i poprawki układu

- **Spec:** ./spec.md (086-semantyka-wiadomosci-i-poprawki-ukladu)
- **Status:** draft
- **Data:** 2026-08-24

## 1. Podejście

Trzy warstwy o bardzo różnym ciężarze, robione w tej kolejności. **(a) Semantyka** — usunięcie
martwej akcji „Odrzuć" wraz z jej statusem i odwrócenie domyślnej etykiety potwierdzeń w całej
aplikacji (54 wywołania w 43 plikach — **wszystkie** przekazują dziś sam napis, więc dziś **każde**
potwierdzenie proponuje czerwony „Usuń"). **(b) Świeże gorące tematy** — wyciągnięcie rdzenia
generowania z Server Action do funkcji przyjmującej `ownerId`, żeby ten sam kod wołało zadanie w tle;
wzorcem jest `summarizeItems`/`buildTimeline` w tym samym zadaniu. **(c) Sześć poprawek układu**,
w tym jedna z realną diagnozą (patrz §5.5) i dwie korekty trybu administratora z 085.

## 2. Model danych (Prisma)

Jedna zmiana, czysto porządkowa — **bez nowych kolumn**.

- **`NewsItem.status`** — wartość `DISMISSED` przestaje być zapisywana. Istniejące wiersze
  normalizujemy do `ACKNOWLEDGED`, bo obie znaczyły dokładnie to samo („nie jest już nowa"), a
  zostawienie martwej wartości w danych oznacza, że unia w TypeScripcie musi ją wiecznie znać.
  Po migracji union to `"PENDING" | "ACKNOWLEDGED"` (C-12 — nadal `String`, nie enum).

- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0258`**
  - Katalog: `prisma/migrations/0258_news_item_bez_dismissed/migration.sql`
  - DDL (idempotentne, bez zmiany kształtu tabeli):
    ```sql
    UPDATE "NewsItem" SET "status" = 'ACKNOWLEDGED' WHERE "status" = 'DISMISSED';
    ```
  - `schema.prisma` **nie wymaga zmiany** (kolumna to `String`), więc `check:schema-drift` zostaje
    zielone bez dotykania schematu. Komentarz przy kolumnie aktualizujemy.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 Wiadomości — jedna akcja zamykająca *(AC-1..AC-4)*
- `src/modules/news/actions/news.ts`: **usuwamy `dismissItem`**. `acknowledgeItem`,
  `acknowledgeTopicItems`, `acknowledgeAllItems` zostają bez zmian (guardy i `revalidatePath` już są).
- `ItemStatus` traci `"DISMISSED"`.
- **`src/lib/ai/action-coverage.json`**: wpis `news:dismissItem` do usunięcia (martwy wpis wywala
  bramkę tak samo jak brakujący).

### 3.2 Gorące tematy w przebiegu pobierania *(AC-8..AC-11)*
- Rdzeń generowania wychodzi z `getHotTopics` do **`src/modules/news/lib/goraceTematy.ts`**:
  `przeliczGoraceTematy(ownerId, { force })` — cała dzisiejsza treść od pobrania artykułów po
  `rememberedContent`, ale z `ownerId` **parametrem**, nie z `requireAuth()`. Server Action zostaje
  cienką nakładką: `requireAuth()` → wywołanie rdzenia → `visibleUsage`.
  Powód rozdzielenia: `requireAuth()` czyta sesję, a zadanie w tle sesji nie ma — to jest ten sam
  układ, co `summarizeItems` (rdzeń bez sesji) obok akcji użytkownika.
- **Etap 5 w `runNewsRefresh`** (po linii czasu): gdy `pool.fetched > 0`, wołamy rdzeń z `force: true`
  i `ctx.progress?.("Przeliczam gorące tematy…")`. Gdy `fetched === 0` — **pomijamy** (AC-9).
- **Odporność (AC-11):** etap 5 w **własnym `try/catch`**; niepowodzenie loguje ostrzeżenie
  (`logEvent("warn", "news.hotTopics.failed", …)`) i **nie przerywa** przebiegu — pobrane wiadomości
  są już zapisane. To jest wprost lekcja z partii streszczeń (084): dodatkowy etap nie może cofnąć
  tego, co się udało. Wynik przebiegu dostaje pole `hotTopics: boolean` do komunikatu.
- Zużycie modelu z tego etapu dolicza się do wspólnego `sink`, więc koszt przebiegu pozostaje jedną
  liczbą (bramka `check:cost-badge` bez zmian).

### 3.3 Bez zmian
Reszta zgłoszeń nie rusza serwera. RBAC (C-22) bez zmian — zero nowych slugów, zero wpięć.

## 4. UI

### 4.1 Domyślna etykieta potwierdzeń *(AC-5..AC-7)* — największa mechanicznie
- `src/components/ui/ConfirmProvider.tsx`: `destructive` domyślnie **`false`**; etykieta domyślna
  „Potwierdź". Komentarz przy polu opisuje odwrócenie i jego powód.
- **Przegląd wszystkich 54 wywołań** w 43 plikach. Reguła klasyfikacji jest prosta i sprawdzalna:
  wywołanie zostaje **destrukcyjne** (`{ title, destructive: true }`), jeżeli po potwierdzeniu ginie
  rekord albo treść — usunięcie tematu, listy, obserwatora, notatki, pozycji, konta, nadania.
  Wszystko, co tylko **zmienia stan** (oznaczenie przeczytanych, archiwizacja, zakończenie zakupów,
  przypisanie), dostaje domyślną, neutralną wersję.
- Rezultat zapisujemy jako listę w `verify.md`, żeby recenzja mogła sprawdzić klasyfikację po
  jednym wpisie na wywołanie, a nie „na oko".

### 4.2 Karta wiadomości *(AC-1..AC-3)*
- `NewsItemCard`: przycisk „Odrzuć" **znika**. „Przeczytane" zostaje jedyną akcją zamykającą,
  z podpowiedzią mówiącą, że dotyczy MOJEJ listy i nie kasuje treści.
- `NewsStream`: „Oznacz wszystkie" korzysta z potwierdzenia **nieusuwającego** (po §4.1 to już
  domyślne) — to jest wprost zgłoszenie 9.

### 4.3 Tryb administratora — dwie korekty *(AC-12..AC-15)*
- `KosztToasts`: **usuwamy** bramkę `useTrybAdmina`. Powiadomienie o koszcie zależy odtąd wyłącznie
  od tego, czy serwer przysłał dane o zużyciu (`visibleUsage`: administrator ∧ systemowy wyłącznik) —
  czyli dokładnie tak, jak przed 085. **`AiCostBadge` zostaje pod przełącznikiem**: to on zajmuje
  miejsce w treści na stałe, a powiadomienie jest ulotne (rozróżnienie zapisane w specu §8).
- `AICommandSheet` → `ReasoningLog`: warunek `isAdmin` staje się `isAdmin && trybAdmina`. Log opisany
  po ludzku (dla wszystkich) bez zmian.
- Odstęp powiadomienia od krawędzi: `calc(12px + env(safe-area-inset-top))` → **`calc(28px +
  env(safe-area-inset-top))`**. Powód, dla którego sama zmienna nie wystarczyła: na iPhonie w trybie
  przeglądarki pasek adresu bywa poza obszarem bezpiecznym, więc `env()` bywa zerowe mimo wcięcia —
  stała musi sama z siebie dawać zapas.

### 4.4 Sześć poprawek układu *(AC-16..AC-21)*
- **AC-16** `IdeaLibraryPage`: odstęp między opisem modułu a chipsami (dziś stykają się, bo opis jest
  `subtitle` ramy, a chipsy pierwszym elementem treści).
- **AC-17** `WatchersPanel`: pasek sterowania z jednego wiersza na **dwa** — `AiContentMeta` u góry,
  ikony układu pod nim. To odwraca kolejność wprowadzoną w 085 zgodnie z prośbą właściciela; warunek
  „ikony tylko przy >1 obserwatorze" zostaje.
- **AC-18** `WeatherPage`: przycisk lokalizacji dostaje `max-w` + `truncate`, żeby długa nazwa nie
  wypychała tytułu. Wzorzec z `GroupNavigator` (`min-w-0` + `truncate`) — element `flex` ma domyślnie
  `min-width: auto` i **nie potrafi** zwęzić się poniżej treści; to była przyczyna także w 084.
- **AC-19** `ModuleSidebar`: rząd chromu przenosi się ze stopki **nad nawigację**, pod nazwę
  aplikacji. Zawartość bez zmian (C-53 — właściciel wybrał „nic nie dokładać").
- **AC-20** — patrz §5.5, to jedyna poprawka z realną diagnozą.
- **AC-21** `NewsPage`: `etykietaStala` z „Tematy" na **„Przejdź do tematu"**; `aria-label`
  wyzwalacza mówi to samo. Zakładka zostaje „Tematy" — to ona nazywa widok.

### 4.5 Teksty (C-32)
Nowe napisy do `messages/pl.json`; klucze po usuniętych („Odrzuć", techniczny log jeśli straci
konsumenta — nie straci) sprzątamy razem ze zmianą.

## 5. Diagnoza AC-20 — dlaczego nagłówki tematów przyklejają się za nisko

To **nie** jest kwestia dobrania liczby. W 085 zmieniłem pomiar zasłony na „odległość dolnej krawędzi
paska modułu od górnej krawędzi ramy" i nazwałem to jedną miarą odporną na to, co stanie wyżej.
Miara jest jednak **pozycyjna**, a nie wysokościowa.

**KOREKTA WOBEC PIERWSZEJ WERSJI TEGO PLANU (C-54).** Napisałem tu wcześniej, że zasłona jest za duża
„dopóki użytkownik nie przewinie", i powołałem się na pomiar z T-1 (`top` = 107 px). Pomiar tego nie
dowodził: 107 px to **poprawna** wartość, gdy pasek modułu przylega do paska widoku (48 + 59). Miara
pozycyjna daje wtedy dokładnie ten sam wynik co wysokościowa — i dlatego pierwsza wersja testu
przechodziła także ze wstrzykniętą regresją.

Różnica ujawnia się dopiero wtedy, gdy **między paskiem widoku a paskiem modułu coś stanie** —
u właściciela robi to pasek stanu odświeżania, który pojawia się i znika wokół pobierania materiałów.
Wtedy odległość od góry ramy rośnie o jego wysokość, a nagłówki sekcji zatrzymują się o tyle za
nisko. Zmierzone w teście: po wstawieniu 40 px nad paskiem modułu zasłona rośnie **107 → 147 px**
z miarą pozycyjną, a zostaje na 107 px z wysokościową.

**Poprawka:** zasłona = `--view-bar-h` (wysokość przyklejonego paska widoku, publikowana przez ramę)
**+ własna wysokość paska modułu** (`offsetHeight`). Obie składowe są wysokościami, więc nie zależą
od tego, co i ile stoi wyżej. Wartość jest liczona w jednym miejscu i podawana dalej jako
`--news-pasek-h`, tak jak dotąd.

**Sposób weryfikacji wynika wprost z powyższego:** test wstawia element nad paskiem modułu, wymusza
przeliczenie (szturchnięcie szerokości okna — bo `ResizeObserver` pilnuje paska i ramy, a nie tego,
co stoi nad nimi) i sprawdza, że zasłona się nie zmieniła. Samo porównanie liczb w stanie spoczynku
niczego nie dowodzi.

## 6. AI / integracje

Zero nowych `AIAction` i narzędzi odczytu. Zmienia się **moment**, w którym powstają gorące tematy
(nowy etap istniejącego zadania w tle), oraz widoczność technicznego logu asystenta. `check:actions`,
`check:ai-coverage` i `check:content-memory` muszą zostać zielone: usunięcie `dismissItem` wymaga
skasowania jego wpisu w manifeście pokrycia, a przeniesienie rdzenia gorących tematów **nie zmienia**
klasyfikacji pamięci treści (nadal `remembered`, nadal `rememberedContent`).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0258_news_item_bez_dismissed/migration.sql` | nowy | normalizacja martwego statusu |
| `src/modules/news/actions/news.ts` | edycja | koniec `dismissItem`, unia bez `DISMISSED`, cienka nakładka na rdzeń gorących tematów |
| `src/modules/news/lib/goraceTematy.ts` | nowy | rdzeń generowania z `ownerId` parametrem |
| `src/modules/news/jobs/newsRefresh.ts` | edycja | etap 5 z własnym `try/catch` |
| `src/modules/news/ui/NewsItemCard.tsx` | edycja | jedna akcja zamykająca + podpowiedź |
| `src/modules/news/ui/NewsStream.tsx` | edycja | potwierdzenie nieusuwające |
| `src/modules/news/ui/NewsPage.tsx` | edycja | etykieta nawigatora, zasłona liczona z wysokości |
| `src/lib/ai/action-coverage.json` | edycja | usunięcie wpisu martwej akcji |
| `src/components/ui/ConfirmProvider.tsx` | edycja | odwrócenie domyślnej etykiety |
| 43 pliki z `confirmDialog(` | edycja | jawne oznaczenie operacji usuwających |
| `src/components/ui/KosztToasts.tsx` | edycja | koniec bramki trybu, większy zapas od krawędzi |
| `src/components/assistant/AICommandSheet.tsx` | edycja | techniczny log pod trybem administratora |
| `src/components/shell/ModuleSidebar.tsx` | edycja | rząd chromu nad nawigację |
| `src/modules/weather/ui/WatchersPanel.tsx` | edycja | pasek w dwóch wierszach |
| `src/modules/weather/ui/WeatherPage.tsx` | edycja | przycinanie nazwy lokalizacji |
| `src/modules/weather/ui/IdeaLibraryPage.tsx` | edycja | odstęp nad chipsami |
| `messages/pl.json` | edycja | nowe i usunięte klucze |
| `e2e/specs/wiadomosci-akcje.spec.ts` | nowy | AC-1..AC-4, AC-21 |
| `e2e/specs/potwierdzenia.spec.ts` | nowy | AC-5, AC-6 |
| `e2e/specs/chrom-konta.spec.ts` | edycja | rząd chromu nad nawigacją (AC-19), koszty bez bramki (AC-12) |

## 8. Bramki i weryfikacja (C-50)

Lokalnie, przeciw **lokalnemu** Postgresowi (C-13): `migrate deploy`, komplet `check:*`, `tsc` ×2,
`next lint`, `next build`, `check:perf`, testy jednostkowe, pełna suita klikacza.

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-4 | klikacz: na karcie zero przycisków „Odrzuć"; dokładnie jedna akcja zamykająca |
| AC-2 | klikacz: po zamknięciu pozycja znika z listy, a wpis tematu na linii czasu zostaje |
| AC-3, AC-21 | klikacz: treść podpowiedzi/etykiety |
| AC-5, AC-6 | klikacz: „Oznacz wszystkie" → przycisk neutralny; usunięcie tematu → „Usuń" |
| AC-7 | lista klasyfikacji 54 wywołań w `verify.md` + `grep`, że żadne nie polega na domyślnym przypadkiem |
| AC-8, AC-9, AC-11 | test jednostkowy etapu 5: `fetched > 0` → wołane, `fetched === 0` → nie, wyjątek → przebieg kończy się sukcesem |
| AC-10 | klikacz: zakładka pokazuje „wygenerowano" i przycisk przeliczenia |
| AC-12, AC-13, AC-14 | klikacz: powiadomienie o koszcie przy obu stanach przełącznika; brak dla nie-admina; techniczny log tylko przy włączonym trybie |
| AC-15 | pomiar: górna krawędź powiadomienia ≥ 28 px |
| AC-16..AC-19 | pomiar w przeglądarce: odstęp, kolejność w pasku, szerokość tytułu przy 360 px, pozycja rzędu chromu |
| AC-20 | **pomiar przy przewinięciu 0**: odstęp między dolną krawędzią paska modułu a górną krawędzią przyklejonego nagłówka ≤ 4 px |

Testy dla AC-1, AC-5 i AC-20 sprawdzamy **w obie strony**.

## 9. Ryzyka techniczne i plan wycofania

- **54 wywołania potwierdzeń naraz.** Najgroźniejszy błąd: operacja usuwająca dostaje neutralny
  przycisk. Mitygacja: klasyfikacja jednego wywołania po drugim, spisana w `verify.md`, plus test
  na obu skrajnościach (usunięcie tematu = „Usuń", oznaczenie = „Potwierdź").
- **Etap 5 w zadaniu w tle.** Ryzyko: wyjątek wywraca przebieg i użytkownik traci pobrane
  wiadomości. Mitygacja: własny `try/catch` + test jednostkowy dokładnie tego scenariusza (AC-11).
- **Rdzeń gorących tematów wychodzi z Server Action.** Ryzyko: rozjazd zachowania akcji i zadania.
  Mitygacja: akcja staje się **cienką nakładką** — jedno źródło logiki, nie dwie kopie.
- **Migracja normalizująca status jest nieodwracalna co do danych** (nie odróżnimy potem, które
  wiersze były `DISMISSED`). Świadome: obie wartości znaczyły to samo, a żaden odczyt ich nie
  rozróżniał. Wycofanie kodu nie wymaga wycofania migracji.
- **Trzecia zmiana mechaniki przyklejania w trzech przebiegach.** Mitygacja: pomiar przy przewinięciu
  ZERO (tam objawia się usterka), a nie po przewinięciu.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — jedna ręczna migracja, numer z narzędzia, weryfikacja lokalna, zero enumów.
- [x] **C-20/C-21** — usuwamy akcję, nie dodajemy; pozostałe zachowują guardy i `revalidatePath`.
- [x] **C-22** — bez zmian w RBAC.
- [x] **C-23** — brak nowych `AIAction`; martwy wpis w manifeście usuwany razem z akcją.
- [x] **C-30/C-31/C-32** — tokeny, pomiary przy 360 px, obszar bezpieczny, teksty przez `t()`.
- [x] **C-33** — zmiany idą przez ramę i przez moduł, bez wyjątków w kontrakcie widoku.
- [x] **C-34** — sedno §4.1: wspólne okno potwierdzeń ma mówić, co się stanie.
- [x] **C-51** — wnioski do dziennika (diagnoza AC-20 to gotowa lekcja).
- [x] **C-53** — usuwamy zamiast dopisywać; nie dokładamy ikon; nie wprowadzamy progu.
- [x] **C-54** — plan odwraca dwie decyzje z 085 i mówi o tym wprost (§4.3, §4.4 AC-17).
