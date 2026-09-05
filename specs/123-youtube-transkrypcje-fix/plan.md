# Plan techniczny: Transkrypcje YouTube — naprawa pobierania

- **Spec:** ./spec.md (123-youtube-transkrypcje-fix)
- **Status:** draft
- **Data:** 2026-09-03

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

> **Nawrót v2 (2026-09-04, C-54).** Wdrożenie v1 nie przyniosło transkrypcji na produkcji
> (zgłoszenie właściciela). Research (youtube-transcript-api, Invidious/Protodec) wskazał dwie
> przyczyny: (1) **YouTube odcina IP centrów danych na poziomie ASN** — Render dostaje ścianę
> „potwierdź, że nie jesteś botem" już na stronie filmu i endpointcie odtwarzacza; (2) ręczny
> protobuf `params` dla `get_transcript` był **za ubogi** (sam videoId) — pełny przepis Invidiousa
> to videoId + zagnieżdżony `{kind, język}` w base64 + varint 1 + identyfikator panelu
> `engagement-panel-searchable-transcript-search-panel`, całość base64url+procentowanie.
> **v2:** (a) `params` wyciągane z `getTranscriptEndpoint` — najpierw z HTML strony, potem
> z odpowiedzi `youtubei/v1/next` (dokładnie droga przycisku „Wyświetl transkrypcję"), na końcu
> budowane ręcznie wg pełnego przepisu (pl/en × autorskie/asr); (b) przeglądarkowy UA + ciasteczko
> zgody `SOCS=CAI` zamiast jawnie botowego UA; (c) **diagnostyka per droga** w logu
> (`youtube.transkrypcje.diagnoza`, próbka ≤3 filmów/przebieg) — bo tylko log z produkcji odróżni
> „film bez napisów" od „YouTube odcina serwer"; (d) migracja **0292** — ponowna rekwalifikacja
> „niedostepna". Jeśli i v2 padnie na blokadzie IP, dalsze opcje (proxy rezydenckie / płatny
> hostowany API transkrypcji) są decyzją właściciela — poza zakresem tego planu.

## 1. Podejście (diagnoza + strategia)

**Diagnoza.** Dziś `pobierzTranskrypcje` (`src/modules/youtube/lib/transkrypcja.ts`) pobiera stronę
filmu, wycina z HTML tablicę `captionTracks` i GET-uje `baseUrl` ścieżki napisów. Od ~2025 YouTube
wymaga na tych adresach (wyciągniętych z webowego player response) tokenu POT („proof of origin");
bez niego odpowiedź to **HTTP 200 z pustym ciałem** — `tekstZNapisow("")` daje `""`, całość zwraca
`null` i film ląduje w `transkrypcjaStan: "niedostepna"` **na zawsze** (etap 2 joba pobiera tylko
`"oczekuje"`). Dodatkowo strona filmu serwowana do centrum danych bywa okrojona (brak
`captionTracks` w HTML). To tłumaczy zgłoszenie „brak transkrypcji nawet na filmach, które ją mają".
*Uwaga: sieć sandboxa blokuje `youtube.com` (proxy 403), więc diagnoza opiera się na znanym,
udokumentowanym zachowaniu YouTube; ostateczne potwierdzenie da log skuteczności po deployu na
`develop` (patrz §8).*

**Strategia.** Łańcuch **trzech niezależnych dróg** w `pobierzTranskrypcje` — każda kolejna rusza,
gdy poprzednia zawiedzie (w tym: zwróci pusty tekst); wiedza o kształcie odpowiedzi zostaje w
funkcjach czystych z testami na zapisanych próbkach (wzorzec obecny w tym samym pliku):

1. **`strona`** (dzisiejsza): HTML strony filmu → `captionTracks` → GET `baseUrl`. Zostaje jako
   pierwsza próba (darmowa, gdy działa), ale pusty tekst przestaje kończyć całość — spada dalej.
2. **`player`** (główna naprawa): POST na wewnętrzny endpoint odtwarzacza
   `https://www.youtube.com/youtubei/v1/player` z kontekstem klienta **ANDROID**
   (`{context:{client:{clientName:"ANDROID",clientVersion:"20.10.38",androidSdkVersion:30}},videoId}`,
   nagłówek UA klienta Android). Odpowiedź JSON zawiera
   `captions.playerCaptionsTracklistRenderer.captionTracks` — adresy z klienta Android **nie
   wymagają POT**. To ta sama droga, którą przeszły utrzymywane biblioteki open-source po zmianie
   YouTube. Wybór ścieżki i składanie tekstu — **reużycie** istniejących `wybierzSciezke` i
   `tekstZNapisow`.
3. **`panel`** (rezerwa): POST `https://www.youtube.com/youtubei/v1/get_transcript` z kontekstem
   klienta WEB i `params` = base64url minimalnego protobufa z `videoId` — dokładnie ten endpoint,
   który wywołuje przycisk „Wyświetl transkrypcję" wskazany w zgłoszeniu. Parser segmentów
   (`transcriptSegmentListRenderer.initialSegments[].transcriptSegmentRenderer.snippet.runs[].text`)
   jako funkcja czysta; błędny kształt = `null` i tyle (nie gorzej niż dziś).

**Nic nie rzuca** — bez zmian: każda droga kończy się `Transkrypcja | null`, a `null` po wszystkich
trzech = stan „niedostepna" (AC-4). Do wyniku dochodzi pole `zrodlo` („strona"/"player"/"panel"),
które job zliczy w istniejącym logu skuteczności — bez tego nie dałoby się po deployu stwierdzić,
która droga niesie ruch (jedyny sposób weryfikacji, skoro sandbox nie widzi YouTube).

**Rekwalifikacja** filmów błędnie oznaczonych: jednorazowa migracja danych przestawiająca
`"niedostepna"` → `"oczekuje"` (AC-3). Istniejący etap 2 joba sam je dobierze, sącząc po
`LIMIT_TRANSKRYPCJI = 25` na przebieg — zero zmian w jobie poza zliczeniem `zrodlo`.

Wzorzec sąsiedni: ten sam moduł (funkcje czyste + próbki w `__tests__/transkrypcja.test.ts`,
`resilientFetch` z `@/lib/integrations/resilientFetch`).

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Stany pozostają `String` + unia TS (C-12): `"oczekuje" | "jest" |
"niedostepna"` — bez nowych wartości.

- **Migracja danych (C-10, C-11):**
  - Numer z `npm run next:migration`: **0289**
  - Katalog: `prisma/migrations/0289_youtube_transkrypcje_ponowna_proba/migration.sql`
  - DDL (czysta migracja danych, bezpieczna przy ponownym uruchomieniu):
    ```sql
    -- 123: filmy blednie oznaczone "niedostepna" (usterka pobierania) wracaja do kolejki prob.
    UPDATE "YoutubeVideo" SET "transkrypcjaStan" = 'oczekuje'
    WHERE "transkrypcjaStan" = 'niedostepna';
    ```
  - Świadoma decyzja: rekwalifikujemy **wszystkie** „niedostepna" (nie da się odróżnić „naprawdę
    bez napisów" od „ofiar usterki"); filmy bez napisów po jednej próbie wrócą do „niedostepna",
    a próby sączą się przez limit 25/przebieg — koszt pomijalny (spec §8).
  - C-15 nie dotyczy (migracja pisana ręcznie, nie z `prisma migrate diff`).

## 3. Warstwa serwera (Server Actions — C-20)

**Bez zmian w Server Actions.** Zmiana zamyka się w `lib/` i `jobs/` modułu YouTube:

- `src/modules/youtube/lib/transkrypcja.ts` — edycja:
  - `PobierzTresc` rozszerzone **wstecznie zgodnie** o opcjonalny init:
    `(url: string, init?: { method?: "POST"; body?: string; headers?: Record<string,string> }) => Promise<string | null>`
    — domyślna implementacja dalej na `resilientFetch` (timeout 12 s, `cache: "no-store"`).
  - Nowe funkcje **czyste**: `sciezkiNapisowZPlayerResponse(json: string): SciezkaNapisow[]`,
    `tekstZPanelu(json: string): string`, `paramsPanelu(videoId: string): string` (ręczne
    kodowanie: protobuf pole 1 length-delimited z `videoId` → base64; wariant URL-safe okazał się
    zbędny — parametr idzie w ciele JSON, nie w adresie; ślad C-54 z implementacji).
  - `Transkrypcja` zyskuje pole `zrodlo: "strona" | "player" | "panel"`.
  - `pobierzTranskrypcje` realizuje łańcuch 1→2→3; pusty tekst na dowolnym etapie = przejście do
    następnego, nie koniec.
- `src/modules/youtube/jobs/youtubeRefresh.ts` — edycja minimalna: log
  `youtube.transkrypcje.skutecznosc` dostaje rozbicie zliczeń po `zrodlo`.
- Guardy/własność (C-21): bez zmian — job działa per `workspaceId` przestrzeni właściciela jak dotąd.

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: istniejący slug modułu YouTube, żadnych nowych tras, zero wpięć w `permissions.ts` /
`modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

Bez zmian w UI. Stany na liście i szczególe filmu („brak transkrypcji") naprawią się same, bo
czytają `transkrypcjaStan`/`transkrypcja` z bazy. Żadnych nowych tekstów → `messages/pl.json`
nietknięte.

## 6. AI / integracje (C-23, C-40)

Bez nowych `AIAction`/read-tooli. Konsumenci transkrypcji (streszczenie/ocena w jobie, zapis do
Notatek, „Fiszki z filmu" w Językach) już dziś czytają kolumnę `transkrypcja` — dostaną dane bez
zmian po swojej stronie (AC-7 weryfikowane przeglądem kodu konsumentów). Bramki `check:cost-badge`
/ `check:content-memory` nietknięte (nie dodajemy wywołań LLM).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/modules/youtube/lib/transkrypcja.ts` | edycja | łańcuch 3 dróg, nowe funkcje czyste, `zrodlo`, pusty tekst ≠ koniec |
| `worldofmag/src/modules/youtube/lib/__tests__/transkrypcja.test.ts` | edycja | próbki: player response (ANDROID), odpowiedź `get_transcript`, pusty timedtext → fallback; łańcuch z wstrzykniętym fetcherem; nic nie rzuca |
| `worldofmag/prisma/migrations/0289_youtube_transkrypcje_ponowna_proba/migration.sql` | nowy | rekwalifikacja „niedostepna" → „oczekuje" (AC-3) |
| `worldofmag/src/modules/youtube/jobs/youtubeRefresh.ts` | edycja | zliczenie skuteczności per `zrodlo` w istniejącym logu (AC-6) |
| `doświadczenia.md` | edycja | wpis C-51 (przyczyna: POT na timedtext; lekcja: pusty 200 ≠ sukces) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: lokalny Postgres (`pg_ctlcluster 16 main start`, `.env.local` + eksport do powłoki),
  `npx prisma migrate deploy` — **nigdy prod DB** (C-13).
- Testy jednostkowe modułu: `npm run test:unit` (albo celowany `node --test` na pliku transkrypcji).
- Build do `next build` włącznie (bez `migrate.js`): bramki `check:migrations` (nowy numer 0289),
  `check:boundaries`, `check:module-registry`, lint, `tsc` testów przechodzą bez zmian konfiguracji.
- Mapowanie AC → weryfikacja:
  - **AC-1** — pełna weryfikacja możliwa dopiero na env. testowym po deployu `develop` (sandbox nie
    widzi YouTube); przed merge zastępczo: test łańcucha na próbkach (droga `player` zwraca pełny
    tekst + język) i przegląd logu skuteczności po deployu.
  - **AC-2** — testy jednostkowe na zapisanych próbkach (HTML, player JSON, panel JSON, timedtext
    XML/JSON, **pusty timedtext**).
  - **AC-3** — migracja 0289 + niezmieniona kwerenda etapu 2 (`transkrypcjaStan: "oczekuje"`);
    test SQL na lokalnym Postgresie (stan przed/po).
  - **AC-4** — testy „nic nie rzuca": wszystkie trzy drogi padają → `null`; fetcher rzucający →
    `null`.
  - **AC-5** — istniejące testy `wybierzSciezke` (bez zmian) + użycie tej samej funkcji dla drogi
    `player`.
  - **AC-6** — log skuteczności zostaje (rozszerzony o `zrodla`), przegląd kodu joba.
  - **AC-7** — przegląd kodu konsumentów (`actions/ai.ts`, `actions/filmy.ts`, kontrakt) — czytają
    kolumnę, zero zmian potrzebnych.

## 9. Ryzyka techniczne i plan wycofania

- **Droga `player` (ANDROID) też zostanie objęta POT** → zostaje droga `panel` (endpoint przycisku
  „Wyświetl transkrypcję"); log per `zrodlo` pokaże spadek natychmiast.
- **Kształt `get_transcript` niezgodny z próbką** → parser czysty zwraca `""`/`null`; funkcjonalnie
  nie gorzej niż dziś, próbkę poprawimy po odczycie z env. testowego.
- **Zalanie YouTube po rekwalifikacji** → limit 25/przebieg bez zmian; przebiegi rusza użytkownik
  („Odśwież"), nie cron.
- **Rollback:** kod — revert commita (łańcuch wraca do jednej drogi); migracja danych nie wymaga
  cofania (`oczekuje` jest legalnym stanem wejściowym; filmy bez napisów same wrócą do
  `niedostepna`).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — migracja danych 0289 ręczna, sekwencyjna, bez enumów; bez dotykania prod DB
- [x] C-20..C-25 — bez nowych akcji/uprawnień/AI; własność bez zmian; guardy joba bez zmian
- [x] C-30..C-32 — UI nietknięte; zero nowych literałów
- [x] C-36 — całość we wnętrzu modułu YouTube (importy względne), kontrakt bez zmian
- [x] C-50/C-51 — build do `next build` + wpis do `doświadczenia.md`
- [x] C-53 — minimalizm: brak nowych zależności (protobuf kodowany ręcznie ~10 linii), brak
  refaktorów „przy okazji"; jedyny naddatek — pole `zrodlo` — jest uzasadniony brakiem innej drogi
  weryfikacji po deployu
