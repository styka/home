# Zadania: Wierne ikony pogody „teraz" + strumień nowych wiadomości na telefonie

- **Plan:** ./plan.md (044-pogoda-ikony-i-wiadomosci-mobile)
- **Status:** todo
- **Data:** 2026-08-04

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. Odhaczamy `[ ]` → `[x]`
> w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament danych

**Brak zadań — feature nie rusza schematu.** Plan §2 uzasadnia to wprost: część A czyta więcej pól
z zewnętrznego API (nic nie zapisujemy), część B zmienia ten sam status `NewsItem` co dziś, a tryb
przeglądania żyje w adresie strony. Żadnej migracji, więc `npm run check:migrations` sprawdzamy
dopiero w bramce końcowej (T-14) jako potwierdzenie, że nic się nie wkradło.

---

## Faza 1 — Pogoda: rdzeń obliczeniowy (część A)

- [x] **T-1** — **Pobranie bieżących opadów z Open-Meteo.**
  W `src/lib/weather/openMeteo.ts` dodaj do bloku `current` zapytania pola `precipitation`, `rain`,
  `showers`, `snowfall`. Wyodrębnij typ `CurrentPoint` (dziś typ jest wpisany inline w `Forecast`)
  i rozszerz go o te cztery pola jako `number | null`, czytane defensywnie (`?? null`).
  *Gotowe, gdy:* `Forecast.current` niesie dane o opadzie, a brak pola w odpowiedzi daje `null`
  zamiast wyjątku. `npm run typecheck` czysto. **(AC-A7)**

- [x] **T-2** — **Warianty nocne dla ikon zawierających słońce.**
  W `wmo(code, isNight)` dodaj warianty nocne dla `51–55` (mżawka) i `80–82` (przelotny deszcz) —
  `🌦️` → `🌧️`. Nie ruszaj deszczu, śniegu, mgły i pełnego zachmurzenia; podtrzymaj (i dopisz
  w komentarzu) zasadę z 038: wariant nocny tylko tam, gdzie w dziennym świeci słońce.
  *Gotowe, gdy:* żaden wariant nocny nie zawiera `☀️`, `🌤️`, `⛅` ani `🌦️`. **(AC-A5)**

- [x] **T-3** — **Funkcja `observedWmo()` — jedno źródło prawdy dla opisu warunków.**
  W tym samym pliku: stałe `PRECIP_MM_MIN = 0.1`, `PRECIP_MM_MODERATE = 2.5`, `PRECIP_MM_HEAVY = 7.6`,
  typ `PrecipKind = "rain" | "showers" | "snow" | "none"` (union TS, nie enum — C-12) oraz
  `observedWmo({code, isDay, precip, rain, showers, snowfall})`. Reguła korekty wg planu §5A:
  `code >= 51` nietykany · `code <= 48` + opad ≥ progu → kod opadowy wg rodzaju i natężenia
  (śnieg 71/73/75 · przelotny 80/81/82 · deszcz 61/63/65) · brak danych → zachowanie jak dziś.
  Wynik zwracany przez istniejące `wmo(effectiveCode, isNight)`.
  *Gotowe, gdy:* funkcja jest wyeksportowana, a `wmo()` pozostaje jedynym miejscem mapowania kodu na
  opis/emoji/token. **(AC-A1, AC-A2)**

- [x] **T-4** — **Testy jednostkowe korekty i wariantów nocnych.**
  Nowy `src/lib/weather/openMeteo.test.ts` (wzorzec: `moon.test.ts`, `sourceColor.test.ts`).
  Przypadki: opad przy `code=3` → deszcz · `code=3` bez opadu → pochmurno · śnieg vs przelotny vs
  deszcz · ślad `0.05 mm` → bez korekty · `code=61` nietykany · `precip: null` → bez korekty ·
  progi natężenia · warianty nocne 0/1/2/51/80 bez słońca, dzienne ze słońcem.
  *Gotowe, gdy:* `npm run test:unit` zielone. **(AC-A1, AC-A2, AC-A4, AC-A5, AC-A7)**

---

## Faza 2 — Pogoda: konsumenci (część A)

- [x] **T-5** — **Kafel „Teraz" mówi prawdę.**
  W `src/components/weather/ForecastView.tsx`: `ForecastNow` liczy ikonę i opis przez `observedWmo`.
  Wiersz liczb rozdzielony i jawnie podpisany: „**Teraz**: opady *X* mm · szansa *Y*%" (gdzie `Y` to
  `precipProb` **bieżącej godziny** — dopasowanie elementu `hourly` po prefiksie `YYYY-MM-DDTHH`
  z `current`; człon „opady *X* mm" tylko gdy faktycznie pada) oraz „**Dziś**: *tMin*–*tMax*°C ·
  opady maks. *Z*%". `ForecastHours` też przez `observedWmo`. `ForecastDays` **bez zmian**.
  Kolory wyłącznie z tokenów (C-30), teksty PL (C-32).
  *Gotowe, gdy:* żaden odsetek na kafelku nie da się odczytać jako „teraz", jeśli nim nie jest,
  a prognoza dzienna nadal używa ikon dziennych. **(AC-A1, AC-A3, AC-A4, AC-A6)**

- [x] **T-6** `[P]` — **Czujki i asystent mówią to samo co ekran.**
  W `src/actions/weather.ts` przestaw `hourlyDigest` i `digestHours` na `observedWmo`
  (z `isDay` i `precip` punktu godzinowego). `dailyDigest` zostaje na `wmo(d.code)` — podsumowanie
  doby ma być dzienne.
  *Gotowe, gdy:* grep nie znajduje konsumenta opisu **bieżących lub godzinowych** warunków, który
  woła `wmo()` z pominięciem `observedWmo`. **(AC-A8)**

---

## Faza 3 — Wiadomości: warstwa serwera (część B)

- [ ] **T-7** — **Odczyt całego strumienia.**
  W `src/actions/news.ts`: `StreamTopicDTO` + `getStreamView()`. Jedno zapytanie o tematy
  użytkownika (`where: { ownerId: user.id }`, `orderBy: [sortOrder, createdAt]`) z `include` pozycji
  `PENDING` (`orderBy: publishedAt desc`, `include: { source: true }`). Tematy **bez** pozycji
  zwracane z pustą listą, nie pomijane. Mapowanie na istniejący `NewsItemDTO` — bez nowego kształtu
  danych.
  *Gotowe, gdy:* jeden round-trip do bazy, kolejność zgodna z Z-3, tematy puste obecne w wyniku.
  **(AC-B1, AC-B6)**

- [ ] **T-8** — **Akcje zbiorcze „oznacz jako przeczytane".**
  W tym samym pliku: `acknowledgeTopicItems(topicId)` (najpierw `assertTopic(topicId, user.id)`,
  potem `updateMany` po `topicId` + `status: "PENDING"`) oraz `acknowledgeAllItems()` (`updateMany`
  z `where: { status: "PENDING", topic: { ownerId: user.id } }` — filtr właściciela **w zapytaniu**).
  Obie zwracają `{count}` i kończą się `revalidatePath("/wiadomosci")`.
  *Gotowe, gdy:* akcja zbiorcza nie jest szerszym wektorem niż pojedyncza — nie da się trafić
  w cudzą pozycję. **(AC-B15, AC-B16; C-20, C-21)**

- [ ] **T-9** — **Manifest pokrycia AI dla trzech nowych akcji.**
  W `src/lib/ai/action-coverage.json` dopisz `news:getStreamView` (`kind: "read"`),
  `news:acknowledgeTopicItems`, `news:acknowledgeAllItems` — wszystkie `status: "excluded"`,
  `reason: "interactive"`, `access: "owner"` (jak istniejące `news:acknowledgeItem`).
  *Gotowe, gdy:* `npm run check:ai-coverage` przechodzi. **(bramka C-50)**

---

## Faza 4 — Wiadomości: lektor wielopoziomowy (część B)

- [ ] **T-10** — **Generalizacja `NewsReader` na listę bloków.**
  `src/components/news/NewsReader.tsx`: props `{ blocks: ReaderBlock[]; onBlockChange?: (i:number)=>void }`,
  gdzie `ReaderBlock = { lead?: string; title: string; text: string }`. Zdania budowane płasko przez
  wszystkie bloki z zapamiętanym `blockIndex`. Przy `blocks.length > 1` dochodzą przyciski
  **poprzednia/następna wiadomość** i licznik „wiadomość *i*/*n* · zdanie *j*/*m*". Przy jednym bloku
  UI **identyczne jak dziś**. Zachowaj łańcuch po `onEnd`, `stopSpeaking` przy odmontowaniu,
  `onPointerDown + preventDefault` na przyciskach i `env(safe-area-inset-bottom)`.
  *Gotowe, gdy:* odsłuch jednej wiadomości wygląda i działa jak przed zmianą, a wielu — pozwala
  skakać po wiadomościach i zdaniach. **(AC-B8, AC-B11, AC-B12, AC-B13)**

- [ ] **T-11** — **`NewsItemCard` na nowym interfejsie lektora.**
  Przekaż jeden blok (`[{ title, text: summary }]`). Przy „Przeczytane"/„Odrzuć" nie wymuszaj
  przewijania — pozycja ma zniknąć bez skoku widoku.
  *Gotowe, gdy:* `npm run typecheck` czysto, a karta zachowuje się jak dziś. **(AC-B8, AC-B17)**

---

## Faza 5 — Wiadomości: strumień (część B, najtrudniejsze)

- [ ] **T-12** — **Komponent `NewsStream` — sekcje, przyklejony nagłówek, nawigacja, gest.**
  Nowy `src/components/news/NewsStream.tsx` wg planu §5B:
  - sekcje per temat z `ref` w `Map<string, HTMLElement>`; sekcja pusta z notką „Brak nowych
    wiadomości";
  - nagłówek sekcji `sticky top-0 z-20`, tło `var(--bg-base)`, z nazwą tematu i licznikiem;
  - `IntersectionObserver` (`rootMargin` przycinający górę) → aktywny temat podąża za przewijaniem;
  - skok do tematu przez `scrollIntoView({behavior:"smooth", block:"start"})`, bez przeładowania;
  - strażnik `isProgrammaticScroll` (~500 ms) przeciw pętli obserwator ⇄ skok;
  - gest `onTouchStart/Move/End`: `|dx| > 60` **i** `|dx| > 1.5×|dy|`, start poza elementem
    interaktywnym, **bez** `preventDefault` w `touchmove`;
  - akcje zbiorcze: „Oznacz temat jako przeczytany" w nagłówku sekcji, „Oznacz wszystkie"
    nad strumieniem z `confirm()`;
  - lektor tematu (nagłówek sekcji) i lektor strumienia (nad strumieniem) — bloki z `lead:
    "Temat: <tytuł>"` na pierwszej pozycji każdego tematu; w danej chwili gra **jeden** lektor
    (`ReaderScope` + identyfikator zakresu);
  - `onBlockChange` przewija widok do czytanej wiadomości;
  - stan pusty całego strumienia z podpowiedzią „Kliknij «Odśwież» w nagłówku";
  - cele dotyku `py-3`, brak `hidden md:*`, kolory z tokenów, teksty PL.
  *Gotowe, gdy:* strumień działa jednym przewijaniem, temat jest zawsze widoczny, skok i gest
  działają w obie strony, a nic nie znika samo.
  **(AC-B1…B7, AC-B9, AC-B10, AC-B11, AC-B14, AC-B15, AC-B16, AC-B18)**

- [ ] **T-13** — **Wpięcie strumienia w stronę modułu.**
  - `src/app/wiadomosci/page.tsx`: `searchParams` rozszerzone o `tryb`, przekazane w `viewParams`
    (wartość startowa **propsem z serwera** — nigdy `window` w pierwszym renderze).
  - `src/components/news/NewsPage.tsx`: `viewSpec` + `tryb: oneOf(["stream","topic"], "stream")`;
    przełącznik „Strumień ⇄ Jeden temat" (istniejący `ContentTab`); w trybie `stream` render
    `NewsStream`, w `topic` — dotychczasowy widok **bez zmian**. Filtr źródeł działa na cały
    strumień; przełącznik „Nowe wiadomości ⇄ Linia czasu" tylko w trybie tematu. Po domknięciu
    przebiegu odświeżania strumień przeładowuje dane.
  *Gotowe, gdy:* wybór trybu przeżywa odświeżenie strony i „wstecz", a widok tematu, „Gorące tematy"
  i „Źródła" działają bez regresji. **(AC-B4, AC-B18, AC-B19, AC-B20)**

---

## Faza 6 — Bramki i domknięcie

- [ ] **T-14** — **Bramki jakości.** W kolejności: `npm run test:unit` → `npm run check:migrations`
  → `npm run check:actions` → `npm run check:ai-coverage` → `npm run check:cost-badge` →
  `npm run check:content-memory` → `npm run lint` → `npm run typecheck` → `npx prisma generate` →
  `npx next build`. **Do kroku `next build`** — pełne `npm run build` kończy się `scripts/migrate.js`,
  który rusza prawdziwą bazę (C-13). Lokalny Postgres wg planu §8.
  *Gotowe, gdy:* wszystkie bramki zielone. **(C-50)**

- [ ] **T-15** — **Mapowanie AC → dowód.** Przejdź listę 28 kryteriów (8× część A, 20× część B)
  i przy każdym zapisz sposób weryfikacji oraz wynik. To wejście dla `/verify`.
  *Gotowe, gdy:* żadne AC nie zostaje bez pokrycia.

- [ ] **T-16** — **Wpisy do `doświadczenia.md`** (C-51, po polsku, format `## YYYY-MM-DD — tytuł` /
  `**Problem:**` / `**Rozwiązanie:**` / `**Lekcja:**`). Planowane dwa:
  1. ikona pogody liczona z kodu, którego zapytanie nie dostarczało danych o opadzie — objaw
     „pada, a widzę chmurkę";
  2. poziomy gest a natywne przewijanie na telefonie (dlaczego bez `preventDefault` i z progiem
     dominacji).
  Dopisz też każdy inny nieoczywisty problem napotkany po drodze.
  *Gotowe, gdy:* wpisy dopisane i zacommitowane razem z fixem.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|---|---|
| **AC-A1** — opad widoczny mimo kodu „pochmurno" | T-3, T-4, T-5 |
| **AC-A2** — brak regresji przy zerowym opadzie | T-3, T-4 |
| **AC-A3** — każdy odsetek jawnie podpisany | T-5 |
| **AC-A4** — ilość opadu w mm, gdy pada | T-4, T-5 |
| **AC-A5** — brak słońca po zmroku | T-2, T-4 |
| **AC-A6** — prognoza dzienna z ikonami dziennymi | T-5 |
| **AC-A7** — brak danych o opadzie nie wywraca strony | T-1, T-4 |
| **AC-A8** — ekran i AI mówią to samo | T-6 |
| **AC-B1** — wszystko jednym przewijaniem | T-7, T-12 |
| **AC-B2** — temat stale widoczny | T-12 |
| **AC-B3** — wybór podąża za przewijaniem | T-12 |
| **AC-B4** — wybór tematu przewija, nie przeładowuje | T-12, T-13 |
| **AC-B5** — gest w bok nie psuje przewijania | T-12 |
| **AC-B6** — temat bez nowych oznaczony jako pusty | T-7, T-12 |
| **AC-B7** — czytelny stan pusty | T-12 |
| **AC-B8** — lektor pojedynczej wiadomości bez regresji | T-10, T-11 |
| **AC-B9** — lektor tematu | T-12 |
| **AC-B10** — lektor strumienia z zapowiedzią tematu | T-12 |
| **AC-B11** — widok podąża za czytanym fragmentem | T-10, T-12 |
| **AC-B12** — sterowanie zdanie ↔ wiadomość + widoczny stan | T-10 |
| **AC-B13** — mowa milknie przy wyjściu | T-10 |
| **AC-B14** — nic nie znika samo | T-12 |
| **AC-B15** — oznacz temat | T-8, T-12 |
| **AC-B16** — oznacz wszystkie, z potwierdzeniem | T-8, T-12 |
| **AC-B17** — pozycja przewijania zachowana | T-11, T-12 |
| **AC-B18** — jedna nawigacja telefon/desktop | T-12, T-13 |
| **AC-B19** — brak regresji w filtrze źródeł, linii czasu, pozostałych zakładkach | T-13 |
| **AC-B20** — wybór przeżywa odświeżenie | T-13 |

---

## Ścieżka krytyczna (co blokuje co)

```
T-1 ──► T-3 ──► T-4        (test potrzebuje funkcji, funkcja potrzebuje danych)
   └──► T-5                (kafel potrzebuje pól opadu)
T-2 ──► T-4                (test wariantów nocnych potrzebuje wariantów)
T-3 ──► T-5, T-6           (obaj konsumenci wołają observedWmo)

T-7 ──► T-12               (strumień potrzebuje danych)
T-8 ──► T-12               (akcje zbiorcze wołane z nagłówka sekcji)
T-10 ─► T-11, T-12         (oba wołają lektor na nowym interfejsie)
T-12 ─► T-13               (strona osadza gotowy komponent)

wszystko ──► T-14 ──► T-15 ──► T-16
```

**Równoległość:** T-6 `[P]` względem T-5 (rozłączne pliki). Cała **część A (T-1…T-6)** jest
niezależna od **części B (T-7…T-13)** — to dwa rozłączne moduły, więc mogą iść równolegle
i rozdzielnie się wycofać.

**Najtrudniejsze:** T-12 (jedyny nowy komponent, skupia obserwator, gest, dwa poziomy lektora
i akcje zbiorcze). Świadomie zostawione na koniec, po tym jak dane (T-7, T-8) i lektor (T-10) są
już gotowe i sprawdzone.

## Notatki / blokady
- Brak zadań migracyjnych — to **decyzja**, nie przeoczenie (plan §2). `check:migrations` w T-14
  potwierdza, że nic się nie wkradło.
- E2E (klikacze) poza zakresem tej bramki — wymagają osobnego skryptu na tym środowisku
  (`scripts/e2e-web.sh`), a zakres zmian jest weryfikowalny testem jednostkowym i przeglądem.
