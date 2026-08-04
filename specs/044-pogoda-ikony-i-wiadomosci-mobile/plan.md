# Plan techniczny: Wierne ikony pogody „teraz" + strumień nowych wiadomości na telefonie

- **Spec:** ./spec.md (044-pogoda-ikony-i-wiadomosci-mobile)
- **Status:** draft
- **Data:** 2026-08-04

> **Zasada planu:** to jest **JAK**. Plan pisany pod istniejący kod — najpierw przeczytany sąsiedni
> moduł, potem projekt (C-53).

## 1. Podejście

**Część A (Pogoda)** to zmiana **czysto obliczeniowa w jednym pliku** `src/lib/weather/openMeteo.ts`
plus konsumenci. Dziś kafel „Teraz" bierze ikonę z samego kodu WMO dostawcy, bo zapytanie do
Open-Meteo **w ogóle nie pobiera bieżących opadów** (blok `current` w `fetchForecast` to
`temperature_2m, apparent_temperature, weather_code, wind_speed_10m, is_day`). Dokładamy pola opadu
do tego **samego** zapytania (bez nowego wywołania sieciowego) i wprowadzamy **jedną** funkcję
korygującą `observedWmo()`, z której korzystają **wszyscy** konsumenci — ekran, czujki i asystent
(AC-A8). Wzorzec do naśladowania to sam ten plik: `wmo()` już dziś jest jedynym miejscem mapowania
kodu na opis/emoji/token koloru, więc rozszerzamy istniejącą warstwę zamiast dokładać nową.

**Część B (Wiadomości)** naśladuje wzorce, które moduł **już ma**: stan widoku w adresie przez
`useViewState` (jak zakładka `widok` dodana w 043), rozwijany `TopicPicker` jako nawigacja wspólna
dla telefonu i desktopu (041), lektor zdanie-po-zdaniu z łańcuchem po `onEnd` (039) oraz gest
dotykowy w stylu `TaskRow` (`onTouchStart/Move/End`, bez bibliotek). Dokładamy **jeden** widok
(`NewsStream`) i **generalizujemy** istniejący `NewsReader` z „jednego tekstu" na „listę bloków",
zamiast pisać drugi lektor. Zero nowych zależności.

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.**

Uzasadnienie wobec C-10/C-11: część A czyta więcej pól z API zewnętrznego (nic nie zapisujemy),
część B agreguje istniejące `NewsItem` o statusie `PENDING` i zmienia ten sam status co dziś
(`ACKNOWLEDGED`). Tryb przeglądania (strumień ⇄ pojedynczy temat) trzymamy **w adresie strony**
(Z-1), tak jak moduł trzyma już zakładkę `widok` — nie w bazie. Dzięki temu wybór przeżywa
odświeżenie i „wstecz" bez ani jednej kolumny.

**C-12:** nowe rodzaje/tryby są typami TS (union), nie enumami Prisma i nie kolumnami:
- `BrowseMode = "stream" | "topic"` (tryb przeglądania, w adresie),
- `ReaderScope = "item" | "topic" | "stream"` (poziom lektora, stan komponentu),
- `PrecipKind = "rain" | "showers" | "snow" | "none"` (wykryty rodzaj opadu, wynik funkcji).

## 3. Warstwa serwera (Server Actions — C-20)

Plik: `src/actions/news.ts` (rozszerzenie; **nie** nowy plik — to ten sam moduł).

| Funkcja | Sygnatura | Opis |
|---|---|---|
| `getStreamView()` | `→ Promise<StreamTopicDTO[]>` | Odczyt. Wszystkie tematy użytkownika wraz z ich pozycjami `PENDING`, w kolejności `sortOrder, createdAt` (Z-3); wewnątrz tematu `publishedAt desc`. Tematy **bez** nowych pozycji też są zwracane, z pustą listą (AC-B6). |
| `acknowledgeTopicItems(topicId)` | `→ Promise<{count:number}>` | Mutacja. Oznacza wszystkie `PENDING` **jednego** tematu jako `ACKNOWLEDGED` (AC-B15). |
| `acknowledgeAllItems()` | `→ Promise<{count:number}>` | Mutacja. Oznacza wszystkie `PENDING` **wszystkich** tematów użytkownika (AC-B16). |

```ts
export interface StreamTopicDTO {
  id: string;            // topicId
  title: string;
  pendingCount: number;
  items: NewsItemDTO[];  // ten sam DTO co dziś — bez nowego kształtu danych
}
```

**Guard dostępu i własność (C-21).** Wiadomości są **user-only** (`NewsTopic.ownerId`), bez
`ownerTeamId` — nie zmieniamy tego. Wzorzec bierzemy z istniejącego `acknowledgeItem`, który sprawdza
`item.topic.ownerId !== user.id`. Akcje zbiorcze **nie mogą** być szerszym wektorem niż pojedyncza:
- `acknowledgeTopicItems` — najpierw `await assertTopic(topicId, user.id)` (istniejący guard w tym
  pliku), dopiero potem `updateMany`.
- `acknowledgeAllItems` — `updateMany` z `where: { status: "PENDING", topic: { ownerId: user.id } }`.
  Filtr po właścicielu jest **w zapytaniu**, więc nie da się trafić w cudzą pozycję.
- `getStreamView` — `where: { ownerId: user.id }` na tematach; pozycje przez relację.

**`revalidatePath("/wiadomosci")`** na końcu obu mutacji (C-20). Odczyt (`getStreamView`) nie
rewaliduje niczego.

**Wydajność (R-3).** Jedno zapytanie o tematy z `include: { items: { where: { status: "PENDING" },
orderBy: { publishedAt: "desc" }, include: { source: true } } }` — jeden round-trip zamiast N.
To te same dane, które użytkownik i tak wczytałby, przechodząc temat po temacie.

**Manifest pokrycia AI (bramka `check:ai-coverage`).** Trzy nowe wpisy w
`src/lib/ai/action-coverage.json`, wzorowane na sąsiadach z tego samego modułu:
```json
"news:getStreamView":        { "kind": "read", "status": "excluded", "reason": "interactive", "access": "owner" },
"news:acknowledgeTopicItems": { "status": "excluded", "reason": "interactive", "access": "owner" },
"news:acknowledgeAllItems":   { "status": "excluded", "reason": "interactive", "access": "owner" }
```
`excluded/interactive` — dokładnie jak istniejące `news:acknowledgeItem` i `news:dismissItem`:
to gesty przeglądania, a asystent ma już dostęp do treści przez `get_news_topic_view`. Świadomie
**nie** dokładamy nowej `AIAction` (C-53), więc **C-23 nie ma tu zastosowania** i `check:actions`
pozostaje zielone bez zmian.

**Bez zmian w AI/LLM.** Feature nie woła modelu, więc `check:cost-badge` i `check:content-memory`
nie dotyczą nowych plików (żaden nie importuje `chatComplete`/`chatStream`).

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Oba moduły istnieją i są zarejestrowane: `module.weather` (`/pogoda`) oraz
`module.news` (`/wiadomosci`) — w `src/lib/permissions.ts`, `src/lib/modules.tsx` i `ModuleSidebar`.
Nie powstaje nowy slug, nie ma czego seedować migracją. Strony pozostają za sesją (brak trybu
anonimowego).

## 5. UI (C-30, C-31, C-32)

### 5A. Pogoda

**`src/lib/weather/openMeteo.ts`**

1. Rozszerzenie zapytania — do bloku `current` dochodzą `precipitation`, `rain`, `showers`,
   `snowfall`. **To samo zapytanie**, więc zero dodatkowego ruchu sieciowego (Z-5).
2. Rozszerzenie typu:
   ```ts
   export interface CurrentPoint {
     temp: number; apparent: number; code: number; windKph: number; isDay: boolean;
     /** mm w ostatniej godzinie; `null`, gdy dostawca nie zwrócił pola (AC-A7). */
     precip: number | null; rain: number | null; showers: number | null; snowfall: number | null;
   }
   ```
   Każde pole czytane defensywnie (`?? null`) — brak pola nie może wywrócić strony (AC-A7).
3. **Jedna** funkcja korygująca — źródło prawdy dla ekranu, czujek i AI (AC-A8):
   ```ts
   const PRECIP_MM_MIN = 0.1;   // poniżej to ślad, nie opad (R-5)
   const PRECIP_MM_MODERATE = 2.5;
   const PRECIP_MM_HEAVY = 7.6; // progi meteorologiczne mm/h

   export function observedWmo(o: {
     code: number; isDay?: boolean;
     precip?: number | null; rain?: number | null; showers?: number | null; snowfall?: number | null;
   }): WmoMeta
   ```
   Reguła korekty — **wąska celowo**, żeby nie było regresji (AC-A2):
   - jeżeli raportowany `code` **już opisuje opad lub burzę** (`code >= 51`) → **nie ruszamy go**;
     dostawca wie lepiej, jaki to rodzaj opadu;
   - jeżeli `code <= 48` (bezchmurnie / zachmurzenie / mgła), a zmierzony opad ≥ `PRECIP_MM_MIN` →
     podmieniamy kod na opadowy wg rodzaju i natężenia:
     `snowfall > 0` → 71/73/75 · `showers > 0` → 80/81/82 · w przeciwnym razie → 61/63/65;
   - brak danych o opadzie (`null`) → zachowanie identyczne jak dziś (AC-A7).

   Zwracamy przez istniejące `wmo(effectiveCode, isNight)`, więc opis, emoji i token koloru
   powstają dalej **w jednym miejscu**.
4. **Warianty nocne** (AC-A5) — dokładamy je dokładnie tam, gdzie wariant dzienny **zawiera słońce**,
   zgodnie z zasadą zapisaną już w komentarzu tego pliku w 038:
   - `51–55` (mżawka, dziś `🌦️`) → nocą `🌧️`,
   - `80–82` (przelotny deszcz, dziś `🌦️`) → nocą `🌧️`.
   Kody `0`, `1`, `2` mają warianty nocne od 038. Deszcz, śnieg, mgła i pełne zachmurzenie **nie**
   dostają sztucznych wariantów — w nocy wyglądają tak samo, a mnożenie ikon bez informacji łamie
   C-53 (ta decyzja jest już udokumentowana w kodzie i ją podtrzymujemy).

**`src/components/weather/ForecastView.tsx`**
- `ForecastNow` — ikona i opis z `observedWmo({...cur, isDay: cur.isDay})` zamiast `wmo(cur.code, …)`.
- Wiersz liczb rozdzielony i **jawnie podpisany** (AC-A3, AC-A4):
  - „**Teraz**: opady *X* mm · szansa *Y*%" — `Y` to `precipProb` z **bieżącej godziny** (element
    `hourly` o godzinie zgodnej z `current`, dopasowanie po prefiksie `YYYY-MM-DDTHH`); fragment
    „opady *X* mm" pokazujemy **tylko** gdy faktycznie pada;
  - „**Dziś**: *tMin*–*tMax*°C · opady maks. *82*%" — dotychczasowa liczba zostaje, ale z podpisem
    „maks.", więc nie da się jej pomylić z „teraz".
- `ForecastHours` — `observedWmo({...h, isDay: h.isDay})` (godzinowe `precip` już jest w `HourPoint`).
- `ForecastDays` — **bez zmian**: `wmo(d.code)` bez wariantu nocnego, bo podsumowanie doby ma być
  dzienne (AC-A6).
- Kolory wyłącznie przez tokeny (`var(--accent-blue)`, `var(--text-muted)`) — `wmo()` już zwraca
  token, nie hex (C-30). Teksty PL (C-32).

**`src/actions/weather.ts`** — `dailyDigest` / `hourlyDigest` / `digestHours` przechodzą na
`observedWmo` (godzinowe: z `isDay` i `precip`; dzienne zostają na `wmo(d.code)`), żeby czujki
i asystent opisywali pogodę **tym samym** zdaniem co ekran (AC-A8).

**Test jednostkowy** — `src/lib/weather/openMeteo.test.ts` (wzorzec: istniejące `moon.test.ts`,
`sourceColor.test.ts`; runner `npm run test:unit` = `node --import tsx --test`). Przypadki:
opad przy `code=3` → deszcz; `code=3` bez opadu → pochmurno (brak regresji); śnieg vs przelotny vs
deszcz; opad śladowy `0.05 mm` → **bez** korekty; `code=61` nietykany; `precip: null` → bez korekty;
warianty nocne dla 0/1/2/51/80 nie zawierają słońca; wariant dzienny dla tych kodów je zawiera.

### 5B. Wiadomości

**Trasa bez zmian** (`/wiadomosci`). `src/app/wiadomosci/page.tsx` — do `searchParams` dochodzi
klucz `tryb`, przekazywany dalej jako `viewParams` (dziś przekazuje już `widok`). Wartość startowa
**musi** iść propsem z serwera — czytanie `window` w pierwszym renderze to rozjazd hydratacji
(lekcja z 2026-08-02 w `doświadczenia.md`, opisana wprost w `useViewState`).

**`src/components/news/NewsPage.tsx`**
- `viewSpec` rozszerzony o `tryb: oneOf(["stream","topic"], "stream")` — strumień domyślny (Z-1).
- W zakładce `feed`: przełącznik „Strumień ⇄ Jeden temat" (istniejący, sprawdzony `ContentTab`),
  a pod nim `NewsStream` albo dotychczasowy widok tematu. Widok pojedynczego tematu **zostaje
  nietknięty** — to gwarancja braku regresji (AC-B19) i realizacja Z-1.
- Filtr źródeł i przełącznik „Nowe wiadomości ⇄ Linia czasu" zostają. W strumieniu filtr źródeł
  działa na całość (Z-4); linia czasu pozostaje per temat (Z-2), więc w trybie strumienia
  przełącznik treści nie jest pokazywany — strumień z definicji dotyczy nowych wiadomości.

**`src/components/news/NewsStream.tsx`** (nowy, jedyny nowy komponent widoku)

| Zagadnienie | Rozwiązanie |
|---|---|
| Dane | `getStreamView()` przy wejściu i po każdym domknięciu przebiegu odświeżania (`NewsPage` już wykrywa ten moment). |
| Sekcje | Jedna sekcja na temat, `ref` w `Map<string, HTMLElement>`; sekcja tematu bez pozycji renderuje krótką notkę „Brak nowych wiadomości" (AC-B6). |
| Przyklejony nagłówek | `sticky top-0 z-20` z tłem `var(--bg-base)` na nagłówku sekcji — natywny CSS, zero JS (AC-B2). |
| Aktywny temat ⇄ przewijanie | `IntersectionObserver` z `rootMargin` przycinającym górę do pasa tuż pod nagłówkiem; wybór ustawiany na **pierwszą** widoczną sekcję (AC-B3). |
| Skok do tematu | `scrollIntoView({ behavior: "smooth", block: "start" })` na `ref` sekcji; **bez** przeładowania widoku (AC-B4). |
| Pętla sprzężenia (R-2) | `isProgrammaticScroll` w `ref` — obserwator ignoruje zmiany przez ~500 ms po skoku sterowanym kodem. Jeden kierunek naraz, więc nie ma zapętlenia. |
| Gest w bok | `onTouchStart/Move/End` na kontenerze (wzorzec `TaskRow`, bez bibliotek). Warunki: `|dx| > 60 px` **i** `|dx| > 1.5 × |dy|` **i** gest nie zaczął się na elemencie interaktywnym. Nie wołamy `preventDefault` na `touchmove`, więc pionowe przewijanie zostaje w 100% natywne (AC-B5, R-1). |
| Akcje zbiorcze | W nagłówku sekcji „Oznacz temat jako przeczytany"; nad strumieniem „Oznacz wszystkie" z `confirm()` (AC-B15, AC-B16). Po sukcesie odczyt `getStreamView()` + `router.refresh()` (liczniki przy tematach). |
| Zachowanie pozycji (AC-B17) | Po pojedynczym „Przeczytane"/„Odrzuć" aktualizujemy stan lokalny (usunięcie pozycji z listy) **bez** przewijania; kotwicą pozostaje przyklejony nagłówek sekcji. |
| Pusto (AC-B7) | Gdy żaden temat nie ma pozycji — komunikat z podpowiedzią „Kliknij «Odśwież» w nagłówku". |

Mobile-first (C-31): cele dotyku `py-3`, jeden układ dla telefonu i desktopu (żadnego `hidden md:*`
— tak samo jak `TopicPicker` z 041, gdzie ten wybór jest udokumentowany). Kolory wyłącznie
z tokenów (C-30), teksty PL (C-32).

**`src/components/news/NewsReader.tsx`** — generalizacja „jeden tekst" → „lista bloków":
```ts
export interface ReaderBlock {
  /** Zapowiadana zmiana kontekstu, np. „Temat: Wybory". Czytana jako osobne zdanie. */
  lead?: string;
  title: string;
  text: string;
}
export function NewsReader({ blocks, onBlockChange }: {
  blocks: ReaderBlock[];
  onBlockChange?: (index: number) => void;
})
```
- Zdania budujemy jak dziś (`splitSentences`), ale **płasko przez wszystkie bloki**, pamiętając
  `blockIndex` każdego zdania. Łańcuch po `onEnd` — mechanizm bez zmian (AC-B13 działa jak dziś,
  bo `stopSpeaking` przy odmontowaniu już jest).
- Gdy `blocks.length > 1`: dochodzą przyciski **poprzednia / następna wiadomość** (skok do
  pierwszego zdania sąsiedniego bloku) oraz licznik „wiadomość *i*/*n* · zdanie *j*/*m*" (AC-B12).
  Przy jednym bloku UI wygląda **dokładnie** jak dziś (AC-B8 = brak regresji).
- `onBlockChange` pozwala `NewsStream` przewinąć widok do czytanej wiadomości (AC-B11); wewnętrzne
  przewijanie do zdania zostaje bez zmian.
- Zachowujemy `onPointerDown + preventDefault` na przyciskach (klawiatura mobilna) i
  `env(safe-area-inset-bottom)` na pasku sterowania — oba już są.

**Trzy poziomy lektora (AC-B8…B10)** — jeden komponent, trzy zestawy bloków:
- **wiadomość** — `NewsItemCard`, 1 blok (dziś), przycisk „Słuchaj" bez zmian;
- **temat** — przycisk w nagłówku sekcji, bloki = pozycje tematu;
- **strumień** — przycisk nad strumieniem, bloki = wszystkie pozycje, a każdy pierwszy blok tematu
  dostaje `lead: "Temat: <tytuł>"` (AC-B10 — zapowiedź zmiany tematu).
W danej chwili gra **jeden** lektor: `NewsStream` trzyma `ReaderScope` + identyfikator zakresu,
więc uruchomienie odsłuchu tematu zamyka odsłuch strumienia i odwrotnie (dwa głosy naraz to błąd,
nie funkcja).

## 6. AI / integracje (C-23, C-40)

- **Nowa `AIAction`: brak.** `check:actions` bez zmian.
- **Nowy read-tool: brak.** Asystent ma już `get_news_topic_view` i narzędzia pogodowe.
- **Wpięcie w AI dotyczy tylko części A:** digesty w `src/actions/weather.ts` przechodzą na
  `observedWmo`, więc asystent i czujki dostają skorygowany opis (AC-A8). Routing modeli (C-40)
  nietknięty — nie wołamy modelu.
- Kalendarz / powiadomienia / auto-expense / trash: nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/weather/openMeteo.ts` | edycja | Pobranie bieżących opadów; `CurrentPoint`; `observedWmo()`; nocne warianty 51–55 i 80–82 |
| `src/lib/weather/openMeteo.test.ts` | nowy | Testy korekty ikony i wariantów nocnych (AC-A1…A7) |
| `src/components/weather/ForecastView.tsx` | edycja | `ForecastNow`/`ForecastHours` na `observedWmo`; rozdzielenie „teraz" od „dziś (maks.)" |
| `src/actions/weather.ts` | edycja | Digesty dla czujek i AI na `observedWmo` (AC-A8) |
| `src/actions/news.ts` | edycja | `getStreamView`, `acknowledgeTopicItems`, `acknowledgeAllItems` + `StreamTopicDTO` |
| `src/lib/ai/action-coverage.json` | edycja | Trzy wpisy dla nowych akcji (bramka `check:ai-coverage`) |
| `src/components/news/NewsStream.tsx` | nowy | Ciągły strumień: sekcje, przyklejony nagłówek, obserwator, skok, gest, akcje zbiorcze |
| `src/components/news/NewsReader.tsx` | edycja | Generalizacja na listę bloków + nawigacja po wiadomościach |
| `src/components/news/NewsItemCard.tsx` | edycja | Wywołanie lektora jednoblokowo; usunięcie pozycji bez skoku widoku |
| `src/components/news/NewsPage.tsx` | edycja | Tryb `stream`/`topic` w adresie + osadzenie `NewsStream` |
| `src/app/wiadomosci/page.tsx` | edycja | Przekazanie `tryb` z `searchParams` (bez rozjazdu hydratacji) |
| `doświadczenia.md` | edycja | Dwa wpisy: ikona pogody bez danych o opadzie; gest poziomy a przewijanie (C-51) |

**Bez zmian:** `prisma/schema.prisma`, `prisma/migrations/*`, `permissions.ts`, `modules.tsx`,
`ModuleSidebar`, `aiAction.ts`, `agentTools.ts`, `/api/llm/home/execute`.

## 8. Bramki i weryfikacja (C-50)

**Lokalnie** (nigdy przeciw prod DB — C-13): lokalny Postgres 16 (`pg_ctlcluster 16 main start`),
`.env.local` + eksport `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy`.
Weryfikujemy **do kroku `next build`** — `npm run build` w całości kończy się `scripts/migrate.js`,
który rusza prawdziwą bazę.

Kolejność bramek: `npm run test:unit` → `npm run check:migrations` → `npm run check:actions` →
`npm run check:ai-coverage` → `npm run check:cost-badge` → `npm run check:content-memory` →
`npm run lint` → `npm run typecheck` → `npx prisma generate` → `npx next build`.

**Mapowanie AC → sposób weryfikacji**

| AC | Jak sprawdzamy |
|---|---|
| A1, A2, A4 | Test jednostkowy `observedWmo` (opad przy `code=3`; brak opadu; ślad 0.05 mm) + przegląd `ForecastNow` |
| A3 | Przegląd kodu: każdy odsetek ma podpis „teraz"/„dziś (maks.)" |
| A5, A6 | Test jednostkowy: brak `☀️`/`🌤️`/`⛅`/`🌦️` w wariancie nocnym 0/1/2/51/80; `ForecastDays` woła `wmo()` bez wariantu nocnego |
| A7 | Test jednostkowy z `precip: null` + defensywne `?? null` w `fetchForecast` |
| A8 | Grep: żaden konsument opisu bieżących/godzinowych warunków nie woła `wmo()` z pominięciem `observedWmo` |
| B1, B2, B6, B7 | Przegląd `NewsStream` + `getStreamView` (tematy puste zwracane, nie pomijane) |
| B3, B4 | Dwa kierunki osobno: obserwator → wybór; wybór → `scrollIntoView`; strażnik `isProgrammaticScroll` |
| B5 | Przegląd obsługi dotyku: brak `preventDefault` w `touchmove`, progi `60 px` / `1.5×` |
| B8 | `NewsItemCard` przekazuje 1 blok; UI jednoblokowe identyczne jak dziś |
| B9, B10 | Przyciski w nagłówku sekcji i nad strumieniem; `lead` na pierwszym bloku tematu |
| B11, B12, B13 | `onBlockChange` → przewinięcie; licznik wiadomość/zdanie; `stopSpeaking` przy odmontowaniu i zmianie zakresu |
| B14 | Grep: `acknowledgeItem` wołane **wyłącznie** z obsługi kliknięcia — nigdy z obserwatora ani z `onEnd` lektora |
| B15, B16 | Guard `assertTopic` / filtr właściciela w `updateMany`; `confirm()` przed akcją globalną |
| B17 | Usunięcie pozycji ze stanu lokalnego bez `scrollIntoView` |
| B18, B19 | Brak `hidden md:*` w `NewsStream`; widok tematu, filtr źródeł, linia czasu, „Gorące tematy" i „Źródła" nietknięte |
| B20 | `useViewState` z kluczem `tryb` + props z `searchParams` |

E2E (klikacze) **nie są** częścią tej bramki — na tym środowisku wymagają osobnego skryptu
(`scripts/e2e-web.sh`), a zakres zmian jest weryfikowalny testem jednostkowym i przeglądem.

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|---|---|
| **Gest poziomy psuje przewijanie (R-1)** | Brak `preventDefault` w `touchmove`; próg dominacji poziomej `1.5×`; gest ignorowany, gdy start w elemencie interaktywnym. Wycofanie: usunięcie trzech handlerów — skok tematem dalej działa dotknięciem (AC-B4). |
| **Pętla obserwator ⇄ skok (R-2)** | Strażnik `isProgrammaticScroll` (~500 ms). Wycofanie: wyłączenie obserwatora zostawia działający skok i przyklejony nagłówek. |
| **Zbyt agresywna korekta ikony (R-5)** | Próg `0.1 mm`; kody `>= 51` nietykane; testy jednostkowe na ślad opadu i brak regresji. |
| **Lektor przerwany przez system na iOS (R-4)** | Istniejąca ścieżka zdanie-po-zdaniu bez zmian; widoczny stan „wiadomość *i*/*n*", więc wznowienie jest jednym dotknięciem. |
| **Rozjazd hydratacji przy nowym parametrze adresu** | `tryb` wyłącznie przez `useViewState` z propsem z serwera — nigdy `window` w pierwszym renderze (lekcja 2026-08-02). |
| **Więcej danych naraz (R-3)** | Jedno zapytanie z `include`; przy realnym problemie doczytujemy kolejne tematy przy przewijaniu — nie rezygnujemy ze strumienia. |

**Rollback.** Feature nie ma migracji, więc wycofanie to **wyłącznie rewert kodu** — bez kroku
bazodanowego i bez ryzyka rozjazdu schematu (por. runbook `docs/devops/runbook-deploy-rollback.md`).
Obie części są w rozłącznych plikach, więc da się cofnąć jedną bez drugiej.

## 10. Zgodność z konstytucją — checklista

- [x] **C-01, C-02** — cały kod w `worldofmag/`, importy przez `@/*`.
- [x] **C-10..C-14** — **bez zmian w schemacie i bez migracji**; świadomie i wprost uzasadnione (pkt 2). C-13: weryfikacja do `next build`, nigdy prod DB.
- [x] **C-12** — nowe rodzaje jako `String`/union TS (`BrowseMode`, `ReaderScope`, `PrecipKind`), zero enumów Prisma.
- [x] **C-20** — obie mutacje to Server Actions z `revalidatePath("/wiadomosci")`.
- [x] **C-21** — `assertTopic` dla akcji tematowej, filtr `topic.ownerId` w akcji globalnej; akcja zbiorcza nie jest szersza niż pojedyncza.
- [x] **C-22** — istniejące slugi `module.weather` / `module.news`, brak nowych wpięć.
- [x] **C-23** — brak nowej `AIAction`; nowe akcje zadeklarowane w manifeście pokrycia (`excluded/interactive`, `access: owner`).
- [x] **C-24, C-25** — trash i audit nie dotyczą (zmiana statusu, nie usunięcie; brak zmian RBAC/konfiguracji).
- [x] **C-30** — wyłącznie zmienne CSS; `wmo()` zwraca token, nie hex.
- [x] **C-31** — rdzeń części B: mobile-first, `py-3`, `env(safe-area-inset-bottom)`, jedna nawigacja dla telefonu i desktopu, gest nie psuje przewijania.
- [x] **C-32** — wszystkie teksty i zapowiedzi lektora po polsku.
- [x] **C-50, C-51** — bramki wypisane w pkt 8; dwa wpisy do `doświadczenia.md` w zakresie prac.
- [x] **C-53** — zero nowych zależności; jeden nowy komponent, reszta to rozszerzenia istniejących; odrzucony drugi lektor na rzecz generalizacji istniejącego.
- [x] **C-54** — plan realizuje wszystkie AC ze speca; spec nie wymagał korekty na tym etapie.
