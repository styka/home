# Plan techniczny: YouTube — moduł „co warto obejrzeć", transkrypcje i streszczenia

- **Spec:** ./spec.md (102-youtube-transkrypcje)
- **Status:** draft
- **Data:** 2026-08-25

## 1. Podejście

Wzorcem jest **moduł Wiadomości** i naśladujemy go możliwie dosłownie (C-53): kanał = źródło,
film = pozycja w puli, jedno **odświeżenie obejmujące cały moduł** jako zadanie w tle z etapami
i `ctx.progress`, treść AI **pamiętana** przez `rememberedContent`. Trzy rzeczy są inne i to są
jedyne miejsca, gdzie wychodzimy poza utarty wzorzec:

1. **Skąd biorą się pozycje.** Wiadomości pobierają kanały RSS zdefiniowane przez użytkownika;
   YouTube udostępnia gotowy kanał RSS na identyfikator kanału, więc pobieranie listy filmów jest
   *prostsze* niż w Wiadomościach — i wprost reużywa istniejący parser.
2. **Transkrypcja.** Nie ma jej w kanale RSS; trzeba ją dociągnąć ze strony filmu — tym samym
   wzorcem, którym `src/lib/news/article.ts` dociąga treść artykułu (zwykły `fetch`, własny
   User-Agent, ekstrakcja wyrażeniami regularnymi, zero zależności).
3. **Zgoda Google.** Import subskrypcji wymaga osobnego przepływu zgody — kopiujemy wzorzec
   połączenia z Dyskiem (`src/lib/drive/oauth.ts` + `DriveConnection` + trasy `/api/drive/*`),
   bo jest w tym repozytorium sprawdzony i rozwiązuje dokładnie ten sam problem.

## 2. Model danych (Prisma)

Cztery modele. Statusy jako `String` + zawężający typ TS (**C-12 — nigdy enum Prisma**).
Własność przez **`workspaceId`** (C-21 w brzmieniu po 079 — `ownerId` **nie istnieje** na nowych
tabelach, pilnuje tego `check:owner-columns`).

### `YoutubeChannel` — kanał obserwowany
`id`, `workspaceId`, `channelId` (identyfikator `UC…`), `title`, `handle?`, `thumbnailUrl?`,
`zrodlo: String` (`"reczne" | "subskrypcje"`), `createdAt`, `lastFetchedAt?`.
`@@unique([workspaceId, channelId])` — ten sam kanał nie może wejść dwa razy (to jest mechanizm
realizujący „duplikaty nie powstają" z AC-3), `@@index([workspaceId])`.

### `YoutubeVideo` — film
`id`, `workspaceId`, `channelId` (FK → `YoutubeChannel.id`, `onDelete: Cascade`), `videoId`,
`title`, `description`, `publishedAt`, `thumbnailUrl?`, `durationSec?`,
`stan: String` (`"nowy" | "obejrzany" | "odrzucony"`),
`transkrypcjaStan: String` (`"oczekuje" | "jest" | "niedostepna"`),
`transkrypcja: String?` (`@db.Text`), `transkrypcjaJezyk: String?`,
`ocena: Int?`, `ocenaPowod: String?`, `ocenaAt: DateTime?`,
`createdAt`, `updatedAt`.
`@@unique([workspaceId, videoId])`, `@@index([workspaceId, stan, publishedAt])`,
`@@index([workspaceId, ocena])`.

> **Dlaczego ocena „czy warto" siedzi w kolumnie, a nie w pamięci treści AI.** AC-11 wymaga, żeby
> listę dało się **ułożyć według tej oceny** — a sortowanie musi się zdarzyć w bazie, razem
> z ograniczeniem liczby wierszy. Ocena trzymana w `AiContent` (JSON, klucz po zakresie) nie da się
> posortować zapytaniem. Streszczenia — przeciwnie: nikt ich nie sortuje, są czytane po jednym,
> więc idą do pamięci treści i **nie dokładają kolumn**.

### `YoutubeConnection` — zgoda na odczyt subskrypcji
Odbicie `DriveConnection` co do pola: `userId @unique`, `email?`, `refreshToken?`, `accessToken?`,
`accessTokenExpiresAt?`, `connectedAt`, `updatedAt`, relacja do `User` z `onDelete: Cascade`.

> **Klucz to `userId`, nie `workspaceId`, i to nie jest niekonsekwencja.** Zgoda OAuth jest wydana
> **kontu Google konkretnego człowieka** — nie przestrzeni, w której leżą dane. Dokładnie tak samo
> rozwiązano `DriveConnection`. Same kanały i filmy mają już `workspaceId`.

### `YoutubePref` — ustawienia modułu
`id`, `workspaceId @unique`, `domyslnaDlugosc: String` (`"krotkie" | "srednie" | "dlugie"`,
domyślnie `"srednie"`), `lastRefreshAt?`, `updatedAt`.
Wzorzec `WeatherPref` (082): `workspaceId @unique` **bez** `@default(dbgenerated())` — na nowej
tabeli nie ma czego wypełniać wstecz, a domyślnik czyniłby pole opcjonalnym w kliencie Prismy.

### Migracja (C-10, C-11, C-14)

- Numer: **`0262`**, katalog `prisma/migrations/0262_modul_youtube/migration.sql`.
- Zawiera: `CREATE TABLE` ×4 + indeksy + klucze obce, **seed uprawnienia** `module.youtube`
  (`INSERT INTO "Permission" … ON CONFLICT ("slug") DO NOTHING` + nadanie roli `ADMIN` przez
  `INSERT INTO "RolePermission" … ON CONFLICT DO NOTHING`) — wzorzec z `0026_pets_module`,
  oraz **indeks trigramowy** do szukania po transkrypcjach:
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  `CREATE INDEX IF NOT EXISTS "YoutubeVideo_transkrypcja_trgm_idx" ON "YoutubeVideo" USING gin ("transkrypcja" gin_trgm_ops);`
- **Wpis w `src/lib/db/schema-drift-allowed.json`** dla tego indeksu — `schema.prisma` nie umie
  wyrazić indeksu GIN z operatorem trigramowym, więc `migrate diff` **zawsze** zaproponuje jego
  usunięcie. Bez wpisu bramka rozjazdu wywali build (wzorzec: `note_title_trgm`).
- **Nie ma triggera `omnia_fill_workspace`** — obowiązuje on tylko tabele z *nullowalnym*
  `workspaceId` (pięć wyjątkowych); tutaj kolumna jest wymagana, a przestrzeń podaje
  `wlasnoscOsobistaDoZapisu` (`check:workspace-fill` sprawdza to w obie strony).

## 3. Warstwa serwera (Server Actions — C-20)

Pliki w `src/modules/youtube/actions/`. Każda mutacja kończy się `revalidatePath`.
Własność zapisu: **`wlasnoscOsobistaDoZapisu(user.id)`**; odczyt: **`filtrMoichRekordow(user.id)`**
(moduł jest osobisty — nie ma wariantu zespołowego, więc wariant wąski jest właściwy, a użycie
szerszego `ownedWhereAsync` byłoby cichym poszerzeniem dostępu).

### `actions/kanaly.ts`
- `dodajKanal(adres)` — rozwiązuje adres/`@handle`/`UC…` na identyfikator kanału, zapisuje. AC-1.
- `usunKanal(id)` — **przez kosz** (`lib/trash.ts`, C-24). AC-18.
- `getKanaly()` — lista (z `take: SUFIT_LISTY`, C-pagination).
- `polaczYoutube()` / `rozlaczYoutube()` — start przepływu zgody i jego cofnięcie. AC-3, AC-4.
  **`rozlaczYoutube` kasuje wyłącznie `YoutubeConnection`** — kanały zostają (AC-4 wprost tego wymaga).
- `importujSubskrypcje()` — pobiera subskrypcje przez API YouTube i dopisuje brakujące kanały.
  Idempotentne dzięki `@@unique([workspaceId, channelId])`. AC-3.

### `actions/filmy.ts`
- `getFilmy({ stan, sort, szukaj, kursor })` — lista z filtrowaniem i sortowaniem **po stronie bazy**.
- `getFilm(videoId)` — szczegół z transkrypcją. AC-6, AC-7, AC-8.
- `ustawStan(videoId, stan)` — nowy/obejrzany/odrzucony. AC-9 listy.
- `odswiezYoutube()` — kolejkuje zadanie `youtube.refresh`, zwraca id zadania. AC-5.
- `getYoutubeStan()` — postęp bieżącego odświeżania (wzorzec `getNewsRefreshState`).

### `actions/ai.ts`
- `streszczenie(videoId, dlugosc)` — przez `rememberedContent` (`kind: "youtube.streszczenie"`,
  `scopeKey: videoId + ":" + dlugosc`, `inputHash` z identyfikatora transkrypcji + `userContextStamp`).
  AC-9, AC-10.
- `zapytajOFilm(videoId, pytanie)` — odpowiedź **wyłącznie z transkrypcji**; prompt wymaga wprost
  przyznania „nie ma tego w transkrypcji". Tryb `on-demand` (pytanie za każdym razem inne, więc
  pamięć zwracałaby cudzą odpowiedź). AC-13.
- `szukajWTranskrypcjach(fraza)` — `ILIKE` wsparte indeksem trigramowym. AC-14.

**Guardy i bramki AI:** każda akcja dostaje wpis w `src/lib/ai/action-coverage.json`
(klasyfikacja ekspozycji) **oraz** deklarację `access` z realnym wywołaniem guardu
(`check:ai-coverage`). Wszystkie akcje są `access: "owner"` — dane są osobiste.

## 4. RBAC / rejestr modułu (C-22, C-36)

**Nowy slug `module.youtube`**, zaseedowany migracją `0262`. Rejestracja **jedną deklaracją**:

- `src/modules/youtube/module.ts` — `defineModule({ id: "youtube", label: "YouTube",
  href: "/youtube", permission: "module.youtube", color: "var(--accent-red)", Icon: Youtube,
  defaultEnabled: true })`.
- `src/modules/youtube/module.server.ts` — `{ ai: () => import("./ai"), jobs: () => import("./jobs") }`.
  **Osobny plik, nie pola w `module.ts`** — `module.ts` trafia do `MODULES`, a to importuje
  `ModuleSidebar` (komponent kliencki); leniwy import egzekutora wciągnąłby Prismę do grafu klienta
  i wydłużył tryb deweloperski (pomiar z 049: klikacze 12,7 → 26,0 min).
- `src/modules/youtube/contract.ts` — **tylko to, czego potrzebują konsumenci**: `getFilmy`
  i `odswiezYoutube` (dla asystenta). Reszta zostaje prywatna.
- Wpięcia w korzenie kompozycji: `src/lib/modules.tsx` (import + `DECLARED` + kolejność menu)
  i `src/lib/modules.server.ts` (`MODULE_SERVER`). Bramka `check:module-registry` sprawdza to
  **w obie strony** — moduł niewpięty buduje się na zielono, a w aplikacji go nie ma.
- `src/modules/youtube/retention.ts` — polityka retencji dla filmów odrzuconych i transkrypcji
  (transkrypcja bywa duża; sam film zostaje). Wpięcie w `src/lib/retention/polityki.ts`.
- **Bez `dashboard.ts`** w tej wersji — wkład na pulpit nie jest w żadnym AC, a każdy wkład to
  kolejne wpięcie do utrzymania (C-53).

## 5. UI (C-30, C-31, C-32, C-33)

Trasy — trzy, świadomie nie więcej:

| Trasa | Zawartość |
|---|---|
| `/youtube` | lista filmów: filtr stanu (nowe / obejrzane / odrzucone), sortowanie (data ⇄ **czy warto**), szukanie po transkrypcjach (`?szukaj=`), akcja „Odśwież", slot `settings` |
| `/youtube/[videoId]` | szczegół: metadane + odnośnik do YouTube, transkrypcja albo etykieta „brak transkrypcji", streszczenie w trzech długościach, pytania do filmu |
| `/youtube/kanaly` | kanały: dodawanie ręczne, połączenie/rozłączenie konta, import subskrypcji |

- **Bramka trasy:** `layout.tsx` woła `wymagajDostepuDoModulu(youtubeModule.permission)`
  (`src/lib/gatingTrasy.ts`). **W layoucie, nie w stronie** — layout obejmuje podtrasy, więc
  `/youtube/[videoId]` też jest chronione. AC-16, `check:route-gating`.
- **`ModuleView`** z propem `state` w każdym widoku (`check:ui-contract`), wpis `"youtube"`
  w `src/lib/ui/view-contract.json`. Stany brzegowe **wyłącznie** przez `state`, nigdy rysowane ręcznie.
- Ustawienia modułu (domyślna długość streszczenia) idą w **slot `settings`** ramy, nie w zakładkę
  (C-33 — jedno miejsce w całej aplikacji).
- **Teksty:** wszystkie w `messages/pl.json` pod `modules.youtube.*`, czytane przez
  `useTranslations`. **Zero literałów z polskimi znakami w komponentach** — `check:i18n` jest regułą
  bezwzględną (097), nie zapadką.
- **Kolory:** wyłącznie zmienne CSS; na kolorowych przyciskach `var(--on-accent)` (C-30).
- **Mobile (C-31, AC-17):** brak drugiego paska bocznego, cele dotyku `py-3`, transkrypcja
  w kontenerze z własnym przewijaniem (`overflow-x: auto`), stopki okien z `env(safe-area-inset-bottom)`.
- **Potwierdzenia** przez `confirmDialog` z `destructive: true` przy usuwaniu kanału (C-34).

## 6. Pobieranie danych — trzy pomocnicze biblioteki modułu

W `src/modules/youtube/lib/` (należą do modułu, bo jedynymi konsumentami są jego akcje i zadanie).

### `kanal.ts` — rozwiązanie adresu na identyfikator kanału
Przyjmuje: pełny adres `/channel/UC…`, `/@uchwyt`, `/c/nazwa`, `/user/nazwa`, sam `UC…` albo
`@uchwyt`. Dla postaci innej niż `UC…` pobiera stronę kanału i wyciąga identyfikator
(`"channelId":"UC…"` albo odnośnik kanoniczny). AC-1.

### `filmy.ts` — lista filmów kanału
`https://www.youtube.com/feeds/videos.xml?channel_id=UC…` → **reużywamy `parseRss`
z `src/lib/news/rss.ts`** (plik żyje w `src/lib/`, nie w module Wiadomości, więc import go nie łamie
granicy modułów). Identyfikator filmu wyciągamy z odnośnika (`watch?v=`). Reużycie zamiast drugiego
parsera to wprost C-53.

### `transkrypcja.ts` — dociągnięcie napisów
Wzorzec `src/lib/news/article.ts`: `resilientFetch`, własny User-Agent, ekstrakcja wyrażeniami.
Kroki: pobierz stronę filmu → znajdź w niej opis dostępnych ścieżek napisów → wybierz język
(polski, potem angielski, potem pierwszy dostępny) → pobierz ścieżkę → złóż w czysty tekst.
**Każde niepowodzenie na dowolnym kroku kończy się `transkrypcjaStan: "niedostepna"`, nigdy
wyjątkiem** — brak transkrypcji jest **normalnym stanem modułu**, nie awarią (AC-8). To jest
najważniejsza decyzja projektowa tego pliku: cała reszta modułu (lista, ocena „czy warto",
streszczenie z opisu) działa dalej.

## 7. Zadanie w tle `youtube.refresh`

`src/modules/youtube/jobs/youtubeRefresh.ts`, zarejestrowane przez `module.server.ts`
(rejestracja w `JOB_HANDLERS` jest **jednocześnie listą dozwolonych zadań** — granica bezpieczeństwa).
Etapy, każdy raportuje przez `ctx.progress` (AC-5):

1. **Kanały** — dla każdego kanał RSS → nowe filmy do `YoutubeVideo` (`stan: "nowy"`,
   `transkrypcjaStan: "oczekuje"`). Pomijamy istniejące (`@@unique`).
2. **Transkrypcje** — dla filmów `"oczekuje"`, z **limitem na przebieg** (żeby jeden przebieg nie
   trwał w nieskończoność przy pierwszym imporcie kilkudziesięciu kanałów).
3. **Ocena „czy warto obejrzeć"** — partiami, jedno wywołanie modelu na partię (wzorzec
   `summarizeItems` z Wiadomości), z `buildUserContext(userId)` w prompcie, żeby uzasadnienie
   odwoływało się do zainteresowań użytkownika, a nie do popularności filmu (AC-12).

Etap 2 i 3 są **dodatkowe**: ich awaria nie może wywrócić przebiegu, w którym filmy są już zapisane
(dokładnie wzorzec `etapGoracychTematow` z 086).

## 8. AI — asystent i bramki (C-23, C-40)

- **Akcje** (`AIAction` + egzekutor w `/api/llm/home/execute` + wpis w `src/lib/ai/actionContract.ts`
  — inaczej `check:actions` wywali build): `add_youtube_channel`, `refresh_youtube`,
  `mark_youtube_watched`.
- **Narzędzia odczytu** (`src/modules/youtube/ai/readTools.ts`): `list_youtube_videos`
  (co nowego / co warto obejrzeć) i `search_youtube_transcripts` (o czym był film).
- **Model po typie operacji, nigdy zaszyty** (C-40): ocena i streszczenia → `generation`,
  pytania do filmu → `reasoning`.
- **Bramki pokrycia AI — obie wymagane:**
  - `src/lib/ai/content-memory-coverage.json`: `actions/ai.ts` → `"remembered"` (streszczenia to
    treść do czytania, wracająca przy każdym wejściu); zadanie `youtubeRefresh.ts` → `"on-demand"`
    (ocena liczona raz na film w przebiegu).
  - `src/lib/ai/cost-badge-coverage.json` — albo przekazanie zużycia przez `usageFromChat`
    / `visibleUsage` i **`AiCostBadge` z wymaganym propem `akcja`** (np. „Streszczenie filmu"),
    albo uzasadniony wpis.

## 9. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0262_modul_youtube/migration.sql` | nowy | 4 tabele + uprawnienie + indeks trigramowy |
| `prisma/schema.prisma` | edycja | 4 modele (bez enumów) |
| `src/lib/db/schema-drift-allowed.json` | edycja | wyjątek dla indeksu GIN |
| `src/modules/youtube/module.ts` | nowy | deklaracja modułu |
| `src/modules/youtube/module.server.ts` | nowy | leniwe `ai` + `jobs` |
| `src/modules/youtube/contract.ts` | nowy | granica modułu (2 funkcje) |
| `src/modules/youtube/retention.ts` | nowy | retencja transkrypcji/odrzuconych |
| `src/modules/youtube/lib/{kanal,filmy,transkrypcja}.ts` | nowe | pobieranie danych |
| `src/modules/youtube/lib/__tests__/*.test.ts` | nowe | testy ekstrakcji (bez sieci) |
| `src/modules/youtube/actions/{kanaly,filmy,ai}.ts` | nowe | Server Actions |
| `src/modules/youtube/jobs/{index,youtubeRefresh}.ts` | nowe | odświeżenie modułu |
| `src/modules/youtube/ai/{index,catalog,executor,readTools}.ts` | nowe | wkład do asystenta |
| `src/modules/youtube/ui/*.tsx` | nowe | lista, szczegół, kanały, ustawienia |
| `src/app/youtube/{layout,page}.tsx`, `[videoId]/page.tsx`, `kanaly/page.tsx` | nowe | trasy (bramka w layoucie) |
| `src/lib/youtube/oauth.ts` | nowy | zgoda Google (wzorzec Dysku) |
| `src/app/api/youtube/{connect,callback}/route.ts` | nowe | przepływ zgody |
| `src/lib/modules.tsx`, `src/lib/modules.server.ts` | edycja | korzenie kompozycji |
| `src/lib/retention/polityki.ts` | edycja | wpięcie retencji |
| `src/lib/ui/view-contract.json` | edycja | wpis `youtube` |
| `src/lib/ai/{aiAction.ts,actionContract.ts,action-coverage.json,content-memory-coverage.json,cost-badge-coverage.json}` | edycja | akcje + bramki AI |
| `src/app/api/llm/home/execute/route.ts` | edycja | egzekutory 3 akcji |
| `messages/pl.json` | edycja | wszystkie teksty modułu |
| `doświadczenia.md` | edycja | lekcje (C-51) |

## 10. Bramki i weryfikacja (C-50)

Lokalny Postgres (C-13), **pełny `npm run build`** — nie pojedyncze bramki.

| AC | Jak sprawdzimy |
|----|----------------|
| AC-1, AC-2 | dodanie kanału po adresie i po `@uchwycie`; wejście do modułu **bez** `YoutubeConnection` nie pokazuje żadnej blokady |
| AC-3, AC-4 | przepływ zgody; ponowny import nie tworzy duplikatów (`@@unique`); rozłączenie kasuje zgodę, kanały zostają |
| AC-5 | uruchomienie odświeżenia → `Job.progress` niesie etapy → podsumowanie z liczbą nowych |
| AC-6, AC-7, AC-8 | szczegół filmu z transkrypcją i bez niej — w drugim przypadku film **jest na liście**, ma streszczenie z opisu i etykietę |
| AC-9, AC-10 | trzy długości; ponowne wejście **nie** generuje ponownie (`fromMemory`), `AiContentMeta` pokazuje moment powstania |
| AC-11, AC-12 | sortowanie po ocenie w zapytaniu; uzasadnienie odwołuje się do `UserFact` |
| AC-13 | pytanie bez pokrycia w transkrypcji → wprost „nie ma tego w transkrypcji" |
| AC-14 | szukanie frazy obecnej w dwóch transkrypcjach |
| AC-15 | dwa konta w bazie lokalnej — zapytania zawężone `filtrMoichRekordow` |
| AC-16 | wejście na `/youtube` i `/youtube/<id>` bez uprawnienia → przekierowanie (`check:route-gating`) |
| AC-17 | klikacze przy 360 px; brak przewijania poziomego |
| AC-18 | usunięcie kanału → wpis w `/trash` → odzysk |

**Testy jednostkowe bez sieci:** ekstrakcja identyfikatora kanału, wybór ścieżki napisów i składanie
tekstu z odpowiedzi — na **zapisanych próbkach**, nie na żywym YouTubie. Test zależny od sieci
w piaskownicy nie przechodzi, a w CI byłby migotliwy.

## 11. Ryzyka techniczne i plan wycofania

- **YouTube utrudni pobieranie napisów serwerowi** (największe ryzyko) → moduł jest zaprojektowany
  tak, że `"niedostepna"` jest normalnym stanem (AC-8). Zadanie **loguje odsetek udanych pobrań**
  (`logEvent`), żeby dało się ocenić, czy wariant lekki wystarcza — bez tej liczby decyzja
  o dołożeniu przeglądarki byłaby zgadywaniem.
- **Zmiana kształtu strony filmu psuje ekstrakcję** → cała wiedza o kształcie siedzi w jednym pliku
  (`lib/transkrypcja.ts`) i jest pokryta testami na próbkach.
- **Pierwszy import kilkudziesięciu subskrypcji to duży przebieg** → limit transkrypcji na przebieg
  (pkt 7), reszta dobierze się w kolejnym.
- **Koszt modelu** → streszczenia na żądanie i pamiętane; ocena raz na film; wszystko pod
  istniejącym budżetem AI (`platform/ai/budzet.ts`, sprawdzanym bezwarunkowo także w zadaniach).
- **Zgoda `youtube.readonly` jest zgodą wrażliwą** → moduł działa bez niej (AC-2), więc brak
  weryfikacji aplikacji u Google ogranicza wygodę, nie użyteczność. Odnotowane też w raporcie audytu.
- **Rollback:** kod — `git revert`. Migracja tworzy **nowe** tabele i nie rusza istniejących, więc
  cofnięcie kodu zostawia je puste i nieszkodliwe; nie ma potrzeby migracji wstecznej.

## 12. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja `0262`, numer z `next:migration`, **zero enumów** (statusy jako
      `String` + union), uprawnienie seedowane idempotentnie.
- [x] **C-15** — indeks trigramowy w surowym SQL-u **wraz z wpisem** w wyjątkach rozjazdu.
- [x] **C-20** — mutacje jako Server Actions z `revalidatePath`.
- [x] **C-21 (po 079)** — własność przez `workspaceId`; zapis `wlasnoscOsobistaDoZapisu`, odczyt
      `filtrMoichRekordow` (wariant **wąski**, bo moduł jest osobisty).
- [x] **C-22** — nowy slug + wpięcie w oba korzenie kompozycji + bramka trasy w `layout.tsx`.
- [x] **C-23** — trzy `AIAction`, każda z egzekutorem i wpisem w kontrakcie akcji.
- [x] **C-24** — usuwanie kanału przez kosz.
- [x] **C-30..C-34** — zmienne CSS, wariant mobilny, teksty przez `t()`, `ModuleView` ze `state`,
      ustawienia w slocie `settings`, `confirmDialog` zamiast okna systemowego.
- [x] **C-36** — `contract.ts` z dwiema funkcjami, wnętrze importowane **ścieżką względną**,
      wkład serwerowy w osobnym `module.server.ts`.
- [x] **C-40, C-41** — model po typie operacji; dane dostępowe do konta Google nigdy nie wracają w całości.
- [x] **C-53** — reużycie `parseRss` i `resilientFetch` zamiast własnych kopii; brak `dashboard.ts`,
      którego żadne AC nie wymaga; **zero nowych zależności**.
