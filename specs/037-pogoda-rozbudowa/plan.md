# Plan techniczny: Pogoda — mapa, obserwatory, propozycje „Co robić?" i widoczne koszty AI

- **Spec:** ./spec.md (037-pogoda-rozbudowa)
- **Status:** draft
- **Data:** 2026-07-31

> **Zasada planu:** to jest **JAK**. Piszemy pod istniejący kod: wzorcem jest sam moduł Pogoda
> (`src/actions/weather.ts`, `src/components/weather/*`) oraz — dla kosztów AI — asystent
> (`src/lib/ai/usage.ts`, `src/components/ui/AiCostBadge.tsx`) i przełącznik follow-upów
> (`src/lib/ai/followups.ts` + `actions/llmConfig.ts`, migracja 0214).

## 1. Podejście

Feature dzieli się na **pięć niezależnych warstw**, które da się wdrażać i weryfikować osobno:
(A) **układ + mapa** — czysto klienckie zmiany w `WeatherPage` plus jedna nowa akcja lokalizacji;
(B) **obserwatory** — zmiana skali statusu i promptu w `evaluateWatchers` + modal edycji (akcja
`updateWatcher` **już istnieje**, brakuje wyłącznie UI); (C) **propozycje „Co robić?"** — jeden nowy
model `WeatherIdea` i dwie nowe akcje generujące; (D) **koszty AI** — rozszerzenie istniejącego
`lib/ai/usage.ts` o budowanie „widocznego zużycia", jeden gate widoczności, przełącznik admina i
mechaniczne przewleczenie `usage` przez trasy `/api/llm/*` i handlery zadań; (E) **bramka jakości**
pilnująca, że nowe wywołania modelu nie ominą licznika.

Kluczowa decyzja minimalizmu (C-53): **nie budujemy nowych abstrakcji kosztowych**. `UsageMeter`,
`accrueUsage`, `estimateCost` i komponent `AiCostBadge` już istnieją i są używane przez asystenta —
dokładamy tylko cienką warstwę „zbuduj z `ChatResult` → zgaś, gdy niewidoczne".

Druga decyzja minimalizmu: **nie cache'ujemy listy propozycji własną tabelą**. `chatComplete` ma już
opcję `cache: true` (Z-330), a prompt jest deterministyczny per lokalizacja/dzień/pora/prognoza —
ponowne wejście na `/pogoda` tego samego dnia nie generuje nowego kosztu. W bazie lądują wyłącznie
propozycje, z którymi użytkownik **coś zrobił** (obejrzał szczegóły, zapisał, zablokował).

## 2. Model danych (Prisma)

### Nowy model `WeatherIdea`

Jedna propozycja „co robić", z którą użytkownik wszedł w interakcję. Wiersz powstaje **leniwie** — przy
pierwszym otwarciu szczegółów, zapisaniu lub zablokowaniu propozycji.

```prisma
model WeatherIdea {
  id            String   @id @default(cuid())
  ownerId       String
  // Odcisk tytułu (małe litery, bez diakrytyków i interpunkcji) — po nim rozpoznajemy, że model
  // zaproponował coś, co użytkownik już rozważał albo zablokował. Klucz naturalny propozycji.
  fingerprint   String
  title         String
  // Krótkie uzasadnienie z listy („dlaczego akurat to, przy tej pogodzie").
  summary       String
  // "outdoor" | "trip" | "home" | "other" — String + union TS (C-12), NIGDY enum Prisma.
  category      String   @default("other")
  // "considered" | "saved" | "blocked" — stan w bibliotece pomysłów (C-12).
  state         String   @default("considered")
  // Kontekst powstania — po to, by w bibliotece dało się filtrować po lokalizacji.
  locationLabel String
  lat           Float
  lon           Float
  // Wygenerowany szczegółowy plan (markdown). null = propozycja tylko zablokowana/zapisana.
  detail        String?
  detailAt      DateTime?
  // Ile razy generowano szczegóły — „Generuj ponownie" podbija licznik (widoczne w UI).
  detailRuns    Int      @default(0)
  // Zużycie ostatniej generacji szczegółów (JSON `AiUsageInfo`) — źródło dla licznika kosztu
  // pokazywanego przy ZAPISANEJ treści, także po ponownym wejściu do aplikacji.
  detailUsage   String?
  viewCount     Int      @default(0)
  lastSeenAt    DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @default(now()) @updatedAt

  owner User @relation("OwnedWeatherIdeas", fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, fingerprint])
  @@index([ownerId, state])
}
```

- **Własność:** wyłącznie `ownerId`, tak jak `WeatherLocation` i `WeatherWatcher` w tym samym module
  (C-21; uzasadnienie zapisane w spec §6 — kolumna zespołowa byłaby dziś stale pusta).
- **Relacja odwrotna:** do modelu `User` dopisujemy `weatherIdeas WeatherIdea[] @relation("OwnedWeatherIdeas")`.
- **`@@unique([ownerId, fingerprint])`** to serce mechaniki „już rozważana / nie proponuj": zarówno
  rozpoznanie powtórki (AC-15), jak i idempotentne blokowanie (AC-16) to jeden `upsert`.

### Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0215**
- Katalog: `prisma/migrations/0215_pogoda_pomysly_i_licznik_kosztow/migration.sql`
- DDL:
  1. `CREATE TABLE "WeatherIdea" (...)` + FK do `"User"` z `ON DELETE CASCADE`,
     `CREATE UNIQUE INDEX "WeatherIdea_ownerId_fingerprint_key"`, `CREATE INDEX "WeatherIdea_ownerId_state_idx"`.
  2. Seed przełącznika licznika kosztów (idempotentnie, wzorzec migracji 0214):
     `INSERT INTO "Config" ("key","value","updatedAt") VALUES ('ai_cost_badge_enabled','1',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;`
- **Bez enumów Prisma** (C-12): `category` i `state` to `TEXT` + union TypeScript w `src/lib/weather/ideas.ts`.
- Brak zmian w `WeatherWatcher` — nowa skala statusu obserwatora jest **wyliczana**, nie przechowywana
  (dziś werdykty też nie są zapisywane), więc AC-9 („stara ocena nie może udawać aktualnej") wychodzi
  z samej natury rozwiązania: po zapisaniu edycji panel przelicza werdykty od nowa.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/actions/weather.ts` (rozszerzenie)

| Funkcja | Co robi | `revalidatePath` |
|---|---|---|
| `addLocationByPoint(lat, lon)` | Zapisuje lokalizację wskazaną na mapie; nazwę ustala `reverseGeocode`, przy niepowodzeniu → `"51.234, 19.456"`. Waliduje zakresy (`lat∈⟨-90,90⟩`, `lon∈⟨-180,180⟩`). Deleguje do istniejącego `addLocation`. | `/pogoda` |
| `describeDay(...)` | **Zmiana sygnatury** → zwraca `{ text, usage? }` zamiast gołego `string`. | — |
| `evaluateWatchers(...)` | **Zmiana skali statusu** + zwraca `{ verdicts, usage? }`. | — |
| `getIdeas(lat, lon, label, opts)` | Generuje **listę** propozycji (LLM, `op: "reasoning"`, `cache: !opts.variation`); dokleja stan z `WeatherIdea` (już rozważana / zapisana) i **odfiltrowuje zablokowane**. Zwraca `{ ideas, usage? }`. | — |
| `getIdeaDetail(fingerprint, …ctx)` | Zwraca zapisane szczegóły **bez wołania modelu**, jeśli istnieją (AC-13); podbija `viewCount`/`lastSeenAt`. | `/pogoda/pomysly` |
| `generateIdeaDetail(idea, ctx, opts)` | Generuje szczegółowy plan (`op: "generation"`), `upsert` po `[ownerId, fingerprint]`, zapisuje `detail`, `detailAt`, `detailRuns+1`, `detailUsage`. `opts.force` = „Generuj ponownie" (AC-14). | `/pogoda`, `/pogoda/pomysly` |
| `getIdeaLibrary(filter)` | Lista biblioteki: filtr po `state` i po lokalizacji. | — |
| `setIdeaState(id, state)` | `"saved" \| "considered" \| "blocked"` — jedno wejście dla „zapisz/przywróć/nie proponuj" (AC-16, AC-18). | `/pogoda`, `/pogoda/pomysly` |
| `blockIdea(idea, ctx)` | Blokada **prosto z listy**, gdy wiersza jeszcze nie ma — `upsert` ze `state:"blocked"` i `detail: null` (AC-16). | `/pogoda`, `/pogoda/pomysly` |
| `deleteIdea(id)` | **Soft-delete** (C-24): `recordTrash` + `delete`. | `/pogoda/pomysly`, `/trash` |
| `addIdeaToTasks(id)` | Tworzy zadanie w domyślnym projekcie użytkownika z tytułem propozycji i odsyłaczem do `/pogoda/pomysly?idea=<id>` w opisie; wymaga `module.tasks` (AC-20). | `/tasks`, `/pogoda/pomysly` |

- **Guard:** wszystkie akcje przez `requireAuth()` + jawne `if (row.ownerId !== user.id) throw` —
  identycznie jak istniejące `setDefaultLocation` / `deleteWatcher` w tym pliku.
- **Nie eksportujemy z `"use server"` niczego poza funkcjami async** (pułapka z `CLAUDE.md`): typy
  `IdeaDTO`, `IdeaState`, `IdeaCategory` oraz `fingerprintOf()` idą do **`src/lib/weather/ideas.ts`**.
  Istniejące `export interface LocationDTO` w akcjach zostawiamy bez zmian (interfejsy są usuwane
  przez kompilator, nie łamią reguły; nowe helpery *runtime* — nie).

### 3.2 Zmiana semantyki statusu obserwatora (istota zgłoszenia nr 2)

Dziś prompt każe modelowi ocenić `good (warunki sprzyjające) / warn / bad / info`, a UI tłumaczy to na
„Sprzyja / Uwaga / Odradzane / Info". Dla obserwatora opisującego **zjawisko negatywne** („Bardzo mokry
weekend", preset `frost`, `storm`, `heat`) model odpowiada na pytanie „czy pogoda jest ładna", więc przy
suchej prognozie zwraca `good` → „Sprzyja / weekend suchy". To nie jest halucynacja, tylko **źle
postawione pytanie**.

Zmiana:
- Nowa skala w `WatcherVerdict["status"]`: `"met" | "partial" | "unmet" | "unknown"` (String + union, C-12).
- Prompt: *„Nie oceniasz, czy pogoda jest ładna. Oceniasz WYŁĄCZNIE, czy warunek opisany przez
  obserwatora ZACHODZI w jego horyzoncie czasowym: met = zachodzi, partial = częściowo/niepewnie,
  unmet = nie zachodzi, unknown = brak danych. `verdict` musi nawiązywać do treści obserwatora."*
- `STATUS_STYLE` w `WatchersPanel`: `met → var(--accent-green) "Spełnione"`,
  `partial → var(--accent-amber) "Częściowo"`, `unmet → var(--text-secondary) "Niespełnione"`,
  `unknown → var(--text-muted) "Brak danych"`.
  **Uwaga na kolor:** „spełnione" dla obserwatora ostrzegawczego (burze) nie jest dobrą wiadomością —
  dlatego zieleń oznacza *zgodność z pytaniem*, a nie *dobrą pogodę*; kafelek dostaje `title`
  wyjaśniający („warunek obserwatora zachodzi"). To jest cała treść naprawy AC-6/AC-7.
- Nieznana wartość z modelu degraduje do `"unknown"` (dziś: do `"info"`).

### 3.3 Koszty AI — warstwa wspólna

**`src/lib/ai/usage.ts`** (rozszerzenie istniejącego pliku — tam już mieszkają `UsageMeter`,
`accrueUsage`, `COST_ALERT_CONFIG_KEY`):
```ts
export const AI_COST_BADGE_CONFIG_KEY = "ai_cost_badge_enabled";
export type AiUsageInfo = { model?: string; tokens: number; costUsd: number; costKnown: boolean; calls: UsageCall[] };
/** Buduje zużycie z jednego lub wielu wyników `chatComplete` — przez istniejący `accrueUsage`. */
export function usageFromChat(entries: Array<{ res: ChatResult; label?: string; op?: string }>): AiUsageInfo;
```

**`src/lib/ai/costVisibility.ts`** (nowy, mały — świadomie OSOBNY plik, żeby nie wciągać `@/lib/auth`
do grafu importów `chat.ts`, który przechodzi przez `usage.ts`):
```ts
/** Brak wiersza = włączone (zgodność wsteczna, wzorzec 1:1 z `readFollowupsEnabled`). */
export async function readCostBadgeEnabled(): Promise<boolean>;
/** JEDYNY choke point widoczności: zwraca `undefined`, gdy licznik wyłączony albo user nie jest adminem. */
export async function visibleUsage(usage: AiUsageInfo | undefined): Promise<AiUsageInfo | undefined>;
```
`visibleUsage` realizuje AC-24 **strukturalnie**: nie-admin nie dostaje danych na drut, więc nie ma
czego ukrywać w kliencie. Domyślna widoczność = admin (decyzja właściciela).

**`src/actions/llmConfig.ts`** — `getCostBadgeEnabled()` / `setCostBadgeEnabled(bool)` z `requireAdmin`,
`logAudit("config", "ai_cost_badge.set", …)` (C-25) i `revalidatePath("/admin/llm")` — kalka
`get/setFollowupsEnabled`.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowego sluga.** `permissionForPath` ma już `path.startsWith("/pogoda")` → `module.weather`,
  więc podstrona `/pogoda/pomysly` jest chroniona bez żadnej zmiany.
- `src/lib/modules.tsx` — wpis `weather` istnieje, `ModuleSidebar` bez zmian (biblioteka pomysłów to
  pod-nawigacja **wewnątrz** modułu, nie osobna pozycja w menu; wzorzec: `/portfel/budzety`).
- Szczegóły kosztu i przełącznik: `module.admin` (przez `visibleUsage` i `requireAdmin`).
- `addIdeaToTasks` sprawdza `module.tasks` sesji; przycisk w UI renderujemy warunkowo.
- **`src/lib/ai/action-coverage.json`** — każda nowa akcja z §3.1 wymaga wpisu (`status` + `access` +
  faktyczny guard), inaczej `check:ai-coverage` wywali build. Klasyfikacja: odczyty (`getIdeas`,
  `getIdeaLibrary`, `getIdeaDetail`) → `pending`/`ai` z `access:"owner"`; mutacje (`setIdeaState`,
  `blockIdea`, `deleteIdea`, `addIdeaToTasks`, `generateIdeaDetail`, `addLocationByPoint`) →
  `access:"owner"`. `getCostBadgeEnabled`/`setCostBadgeEnabled` → `excluded` z powodem „admin".

## 5. UI (C-30, C-31, C-32)

### 5.1 Kolejność sekcji (zgłoszenie 6)

`ForecastView.tsx` rozbijamy na trzy eksporty z **tego samego pliku** (bez nowych plików, C-53):
`ForecastNow`, `ForecastHours`, `ForecastDays`. `WeatherPage` składa kolumnę główną w kolejności:
**`ForecastNow` → „Co robić?" → `ForecastHours` → `ForecastDays`**. Identycznie na desktopie i mobile
(jedna kolumna DOM, `lg:grid-cols-[minmax(0,1fr)_360px]` bez zmian) → AC-29.

### 5.2 Mapa (zgłoszenie 1)

- Nowa zależność: **`leaflet`** (+ `@types/leaflet` w `devDependencies`). Bez `react-leaflet` —
  potrzebujemy jednego, prostego widoku, a warstwa reactowa dołożyłaby drugą zależność i własny cykl
  życia (C-53).
- `src/components/weather/LocationMapPicker.tsx` — `"use client"`, ładowany przez
  `dynamic(() => import(...), { ssr: false })`, żeby Leaflet (który dotyka `window`) nie trafił do SSR
  ani do pierwszego wejścia na `/pogoda`.
- **Ikona znacznika: `L.divIcon` z własnym HTML-em**, nie domyślny `L.Icon`. Powód dwojaki: domyślne
  ikony Leafletu wskazują na pliki PNG spod `leaflet/dist/images` i po zbundlowaniu przez Next
  rozjeżdżają się na 404 (klasyczna pułapka), a własny `divIcon` da się pokolorować `var(--accent-blue)`
  (C-30).
- Kafelki: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` + wymagana atrybucja „© OpenStreetMap".
  Wyłącznie warstwa kliencka — serwer nie proxuje kafelków.
- Zachowanie: start na bieżącej lokalizacji (AC-3), klik/tap = przestawienie znacznika + podgląd
  współrzędnych, przycisk „Zapisz tę lokalizację" → `addLocationByPoint`. Obok mapy zostają
  dotychczasowe drogi (nazwa, GPS) → AC-5 przy padniętych kafelkach.
- **Mobile (C-31):** mapa w modalu `Modal wide`, wysokość `min(60vh, 420px)`, `touchZoom` włączony,
  `scrollWheelZoom` **wyłączony** (żeby scroll strony pod mapą nie był porywany — AC-4), przyciski `py-3`.
- Stan błędu: `tileerror` z Leafletu → komunikat „Nie udało się wczytać mapy — wskaż lokalizację po
  nazwie lub przez GPS." (AC-5).

**`src/lib/weather/openMeteo.ts`** — nowa funkcja `reverseGeocode(lat, lon)`: Nominatim
(`/reverse?format=jsonv2&zoom=10&accept-language=pl`) z nagłówkiem `User-Agent: Omnia/1.0` (wymóg
regulaminu OSM), `AbortSignal.timeout`, `null` przy błędzie. Wołana **serwerowo** z `addLocationByPoint`.

### 5.3 Obserwatory (zgłoszenie 3)

`WatchersPanel.tsx`: `AddWatcherModal` przemianowany na `WatcherFormModal` z propem `initial?: WatcherDTO`
— ten sam formularz obsługuje dodawanie i edycję (C-53). Przy kafelku dochodzi ikona ołówka
(`Pencil`, obok istniejącego kosza). Dla obserwatora `kind:"preset"` edycja też jest dozwolona (zmienia
tytuł/opis/horyzont; `presetKey` zostaje — wpływa tylko na to, czy preset da się dodać drugi raz).
Po zapisie: `router.refresh()` + `evaluate()` — nowe werdykty, żaden stary status nie zostaje (AC-8, AC-9).

### 5.4 „Co robić?" — lista propozycji (zgłoszenie 4)

- `src/components/weather/IdeasPanel.tsx` — zastępuje dzisiejszy blok „Co robić?" w `WeatherPage`.
  Zostawiamy chipy dnia/pory i „Wylosuj inną" (= `variation: true`, wymusza świeżą listę).
  Kafelek propozycji: tytuł, ikona kategorii, jednozdaniowe uzasadnienie, znacznik **„Już rozważana"**
  (AC-15) i menu akcji: *Szczegóły* / *Zapisz* / *Nie proponuj*.
- `src/components/weather/IdeaDetailSheet.tsx` — szczegóły. **Desktop:** panel wsunięty w kolumnę
  główną obok listy. **Mobile:** pełnoekranowy arkusz (`fixed inset-0`, `env(safe-area-inset-bottom)`,
  nagłówek z „Wróć") — C-31. Treść renderowana przez `markdownToHtml` + `MARKDOWN_STYLES` (tak jak
  dzisiejsza porada). Stopka: „Generuj ponownie", „Dodaj do zadań", „Zapisz", `AiCostBadge`.
- `src/app/pogoda/pomysly/page.tsx` (server wrapper) + `src/components/weather/IdeaLibraryPage.tsx`
  (client) — biblioteka: filtry `Wszystkie / Zapisane / Rozważane / Zablokowane`, filtr lokalizacji,
  akcje: otwórz szczegóły, zapisz/przywróć, zablokuj, usuń (→ `/trash`). Wejście: link „Pomysły"
  w nagłówku kafla „Co robić?" (wzorzec pod-nawigacji jak `/portfel/budzety`).
- **Prompt listy** (`op: "reasoning"`, JSON, `cache: !variation`): dostaje lokalizację z nazwą i
  współrzędnymi, cyfrowy skrót prognozy dla wybranego dnia/pory, listę **zablokowanych tytułów**
  („nie proponuj tych"), i wymaga 5–7 pozycji, w tym **co najmniej 2 związanych z konkretnymi
  miejscami w promieniu ~30 km** z nazwą własną (AC-11). Zwracany JSON:
  `{"ideas":[{"title","summary","category":"outdoor|trip|home|other","nearby":true|false}]}`.
  Zablokowane odfiltrowujemy **dodatkowo po stronie serwera** po `fingerprint` — prompt to podpowiedź,
  filtr to gwarancja (AC-16).
- **Prompt szczegółów** (`op: "generation"`, markdown): plan wykonania — co zabrać, ile trwa, wariant
  przy pogorszeniu pogody, na co uważać. `temperature` 0.7; przy „Generuj ponownie" `cache:false`.
- Stany puste/błędu po polsku z przyciskiem „Spróbuj ponownie" (AC-21).

### 5.5 Licznik kosztów w modułach (zgłoszenie 5)

- `AiCostBadge` **bez zmian w wyglądzie** — dokładamy tylko `align?: "left" | "right"`, bo dziś ma na
  sztywno `marginLeft:"auto"` (sensowne w bąblu czatu, nie w nagłówku kafla). Domyślka zostaje `right`,
  więc asystent nie zmienia się o piksel.
- Wpięcia w Pogodzie: pod poradą/listą propozycji, w stopce szczegółów, w nagłówku panelu obserwatorów.
- **Rozwleczenie na resztę aplikacji — mechanicznie, przez jeden punkt:** `src/lib/llm-client.ts` ma
  jedną funkcję `post<T>()`; zmieniamy jej sygnaturę na `Promise<T & { usage?: AiUsageInfo }>`, więc
  **wszystkie** namespace'y typowanego klienta dostają `usage` bez ruszania ich definicji. Trasy
  `/api/llm/*` dokładają do odpowiedzi `usage: await visibleUsage(usageFromChat([{res:result}]))`.
- Handlery zadań (`src/lib/jobs/handlers/*`) zapisują `usage` w `Job.result` — licznik pokazuje się
  przy wyniku zadania w UI modułu.
- **Miejsca do wpięcia** (z analizy `grep chatComplete|chatStream`, 30 wywołań w 26 plikach):

  | Obszar | Pliki | UI licznika |
  |---|---|---|
  | Pogoda | `actions/weather.ts` (×2 + 2 nowe) | kafle „Co robić?", szczegóły, obserwatory |
  | Notatki | `api/llm/notes/{tags,title,rewrite,qa}` | panel tagów, tytuł, przepisywanie, odpowiedź Q&A |
  | Zadania | `api/llm/tasks/{parse,suggest,title,search}` | podgląd sparsowanych zadań, lista sugestii |
  | Kuchnia | `api/llm/kitchen/{parse-ingredients,import-url,categorize}`, `jobs/handlers/kitchen*` (4) | podgląd importu/OCR, plan tygodnia, wygenerowany przepis |
  | Magazyn | `api/llm/magazynowanie/{search,enrich}`, `jobs/handlers/magazyn*` (4) | wynik wyszukiwania „gdzie to jest", OCR dokumentu, wnioski analityki, projekt zamówienia |
  | Zakupy / słowniki | `api/llm/normalize`, `api/llm/category-{icons,hints}` | podgląd normalizacji, propozycje ikon/podpowiedzi |
  | Języki | `api/llm/languages/extract` | podgląd wyekstrahowanego słownictwa |
  | Sklepy | `jobs/handlers/storesGenerate.ts` | wygenerowany układ sklepu |
  | Pety | `jobs/handlers/petsInsights.ts` | wnioski AI |
  | Wiadomości | `actions/news.ts` | wygenerowana wiedza/podsumowanie |
  | Asystent | `api/llm/home/{agent,briefing}`, `lib/ai/fastPath.ts` | **już ma** — dochodzi tylko posłuszeństwo przełącznikowi |
  | Poza zakresem | `src/generated/audyt-book.ts` | plik generowany (przykład w treści książki), nie kod wykonawczy |

## 6. AI / integracje (C-23, C-40)

- **Nowe `AIAction`: brak.** Propozycje nie wymagają, by asystent je tworzył — nie ruszamy
  `/api/llm/home/execute` ani `check:actions`.
- **Read-tool:** nie dokładamy (asystent ma już `weather`); świadome ograniczenie zakresu.
- **Routing modeli (C-40):** wszystkie nowe wywołania idą przez `chatComplete({ op })` — `reasoning`
  dla listy propozycji i obserwatorów, `generation` dla szczegółów. **Zero** nazw modeli w kodzie.
- Kalendarz / powiadomienia: bez zmian (poza zakresem wg spec).
- Trash (C-24): `TrashModule` rozszerzamy o `"weather"`, a `actions/trash.ts` `restoreItem` dostaje
  gałąź `else if (item.module === "weather") await restoreWeatherIdea(data)`.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | model `WeatherIdea` + relacja w `User` |
| `prisma/migrations/0215_pogoda_pomysly_i_licznik_kosztow/migration.sql` | nowy | tabela + seed `ai_cost_badge_enabled` |
| `src/lib/weather/ideas.ts` | nowy | typy `IdeaDTO`/`IdeaState`/`IdeaCategory`, `fingerprintOf()`, etykiety PL |
| `src/lib/weather/openMeteo.ts` | edycja | `reverseGeocode()` |
| `src/actions/weather.ts` | edycja | akcje z §3.1, nowa skala statusu, zwracanie `usage` |
| `src/lib/ai/usage.ts` | edycja | `AI_COST_BADGE_CONFIG_KEY`, `AiUsageInfo`, `usageFromChat()` |
| `src/lib/ai/costVisibility.ts` | nowy | `readCostBadgeEnabled()`, `visibleUsage()` |
| `src/actions/llmConfig.ts` | edycja | `get/setCostBadgeEnabled` + audyt |
| `src/components/admin/LlmConfigPanel.tsx` | edycja | przełącznik licznika obok follow-upów |
| `src/components/ui/AiCostBadge.tsx` | edycja | prop `align` (bez zmiany wyglądu w asystencie) |
| `src/lib/llm-client.ts` | edycja | `post<T>` zwraca `T & { usage?: AiUsageInfo }` |
| `src/app/api/llm/**/route.ts` (17 tras) | edycja | `usage` w odpowiedzi |
| `src/lib/jobs/handlers/*.ts` (9) | edycja | `usage` w `Job.result` |
| `src/actions/news.ts` | edycja | `usage` w wyniku |
| `src/components/weather/ForecastView.tsx` | edycja | rozbicie na `ForecastNow`/`ForecastHours`/`ForecastDays` |
| `src/components/weather/WeatherPage.tsx` | edycja | nowa kolejność sekcji, mapa, `IdeasPanel` |
| `src/components/weather/LocationMapPicker.tsx` | nowy | mapa wyboru lokalizacji |
| `src/components/weather/IdeasPanel.tsx` | nowy | lista propozycji „Co robić?" |
| `src/components/weather/IdeaDetailSheet.tsx` | nowy | szczegóły (panel/arkusz) |
| `src/components/weather/IdeaLibraryPage.tsx` | nowy | biblioteka pomysłów |
| `src/components/weather/WatchersPanel.tsx` | edycja | edycja obserwatora, nowa skala statusu |
| `src/app/pogoda/pomysly/page.tsx` | nowy | server wrapper biblioteki |
| `src/lib/trash.ts`, `src/actions/trash.ts` | edycja | moduł `weather` w koszu |
| `src/lib/ai/action-coverage.json` | edycja | klasyfikacja nowych akcji (bramka) |
| `src/lib/ai/cost-badge-coverage.json` | nowy | manifest wyjątków bramki licznika |
| `scripts/check-cost-badge.js` | nowy | bramka: wywołanie modelu bez licznika = build pada |
| `package.json` | edycja | `leaflet`, `@types/leaflet`, skrypt `check:cost-badge` w `build` |
| `docs/…`, `CLAUDE.md`, `doświadczenia.md` | edycja | dokumentacja + lekcje (C-51) |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod DB):** `pg_ctlcluster 16 main start`, rola/baza `omnia/omnia_dev`,
`.env.local` + eksport `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy`.
Weryfikujemy **do kroku `next build`** — `scripts/migrate.js` (ostatni krok `npm run build`) rusza
prawdziwą bazę, więc uruchamiamy sekwencję ręcznie:
`node scripts/copy-docs.js && npm run check:actions && npm run check:ai-coverage && npm run check:cost-badge && npm run check:migrations && npx next lint && npx prisma generate && npx next build`.

**Nowa bramka `scripts/check-cost-badge.js`:** skanuje `src/**` w poszukiwaniu wywołań
`chatComplete(`/`chatStream(`; każdy taki plik musi albo importować `visibleUsage`/`usageFromChat`
(czyli produkować zużycie), albo mieć wpis w `src/lib/ai/cost-badge-coverage.json` z powodem. Wpięta
w `build` i jako `npm run check:cost-badge` → realizuje AC-28.

**Mapowanie AC → weryfikacja:**

| AC | Jak sprawdzamy |
|---|---|
| AC-1..AC-4 | ręcznie na `/pogoda` (desktop + emulacja mobile): mapa, klik, zapis, gesty |
| AC-5 | zablokowanie `tile.openstreetmap.org` w DevTools → komunikat, reszta dróg działa |
| AC-6, AC-7 | obserwator „Bardzo mokry weekend" przy suchej prognozie → „Niespełnione"; przegląd `STATUS_STYLE` |
| AC-8, AC-9 | edycja obserwatora → zapis → panel przelicza werdykty |
| AC-10, AC-11 | lista ≥4 pozycji, w tym ≥1 z nazwą własną miejsca w okolicy |
| AC-12 | otwarcie szczegółów: panel (desktop) / arkusz (mobile) |
| AC-13 | po `generateIdeaDetail` restart aplikacji → `getIdeaDetail` zwraca treść **bez** wpisu w `AiCall` |
| AC-14 | „Generuj ponownie" → `detailRuns` rośnie, treść się zmienia |
| AC-15 | ponowna generacja listy → pozycja z `WeatherIdea` ma znacznik „Już rozważana" |
| AC-16 | „Nie proponuj" → brak w kolejnej liście (test także przy `variation:true`) |
| AC-17, AC-18 | `/pogoda/pomysly`: filtry + wszystkie akcje |
| AC-19 | usunięcie → wpis w `/trash` → przywrócenie |
| AC-20 | „Dodaj do zadań" → zadanie w `/tasks` z odsyłaczem |
| AC-21 | brak lokalizacji / wymuszony błąd akcji → stan pusty z „Spróbuj ponownie" |
| AC-22, AC-23 | licznik przy treści; rozwinięcie pokazuje model/tokeny/koszt per wywołanie |
| AC-24 | konto bez `module.admin` → odpowiedź serwera **nie zawiera** pola `usage` |
| AC-25 | przełącznik w `/admin/llm` → licznik znika wszędzie; wpis w `/admin/audit` |
| AC-26 | przegląd tabeli z §5.5 — każde wpięcie odhaczone |
| AC-27 | model spoza cennika → „koszt nieznany" (istniejąca ścieżka `costKnown:false`) |
| AC-28 | `npm run check:cost-badge` na celowo „gołym" wywołaniu → build pada |
| AC-29 | wizualnie: Teraz → Co robić? → Najbliższe godziny → Najbliższe dni |

## 9. Ryzyka techniczne i plan wycofania

- **Leaflet a SSR** — `window` przy imporcie. Mitygacja: `next/dynamic` z `ssr:false`; komponent nigdy
  nie renderuje się na serwerze.
- **Domyślne ikony Leafletu (404 po zbundlowaniu)** — mitygacja: własny `divIcon`, zero plików
  graficznych z paczki. → do `doświadczenia.md` (C-51).
- **Rozlanie zmiany po 26 plikach** przy wpinaniu licznika — mitygacja: jeden punkt (`post<T>` w
  `llm-client.ts`) + jedna funkcja (`visibleUsage`) + bramka, która nie pozwoli o czymś zapomnieć.
  Zadania rozbite per moduł, każde niezależnie budowalne.
- **`describeDay`/`evaluateWatchers` zmieniają typ zwracany** — złamią kompilację u wszystkich
  konsumentów. To jest zaleta (kompilator wskaże miejsca), ale wymaga jednego commita obejmującego
  akcję i jej UI.
- **Nominatim: limit i regulamin** — jedno zapytanie na zapis lokalizacji (nie na render), obowiązkowy
  `User-Agent`, timeout, degradacja do współrzędnych.
- **Model zmyśla atrakcje** — mitygacja produktowa (blokowanie pozycji), nie techniczna; w prompcie
  wymagamy nazwy własnej i uzasadnienia bliskości.
- **Rollback:** kod — cofnięcie merge'a na `develop` (Render przebuduje). Migracja 0215 jest
  **wyłącznie addytywna** (nowa tabela + `INSERT ... ON CONFLICT DO NOTHING`), więc stara wersja kodu
  działa na nowym schemacie bez żadnego kroku wstecz. Zgodnie z runbookiem
  `docs/devops/runbook-deploy-rollback.md` nie ma potrzeby wycofywania migracji.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja `0215` (numer z `next:migration`), tylko `String`+union (żadnych
      enumów), seed `Config` idempotentny, weryfikacja na lokalnym Postgresie, nigdy prod DB.
- [x] **C-20..C-25** — mutacje jako Server Actions z `revalidatePath`; guard `requireAuth` + kontrola
      `ownerId`; bez nowego sluga RBAC; brak nowych `AIAction` (więc `check:actions` nietknięte, ale
      `check:ai-coverage` wymaga wpisów); soft-delete pomysłów do `/trash`; przełącznik admina audytowany.
- [x] **C-30..C-32** — wyłącznie zmienne CSS (znacznik mapy przez `divIcon`, nie hardcode), mobile-first
      (arkusz pełnoekranowy, `safe-area`, `py-3`, wyłączony `scrollWheelZoom`), całe UI po polsku.
- [x] **C-40..C-41** — `chatComplete({op})` bez nazw modeli; licznik pokazuje koszt, nie klucze.
- [x] **C-53 (minimalizm)** — świadomie sprawdzone: **jeden** nowy model zamiast trzech (cache listy
      opieramy o istniejący `cache:true` w `chatComplete`); **rozszerzamy** `usage.ts` i `AiCostBadge`
      zamiast pisać drugi system kosztowy; **jedna** nowa zależność (`leaflet`, bez `react-leaflet`);
      formularz obserwatora obsługuje dodawanie i edycję zamiast dwóch modali; `ForecastView` dzielimy
      w miejscu, bez nowych plików.
- [x] **C-50/C-51** — sekwencja bramek do `next build`, nowa bramka licznika, wpisy w `doświadczenia.md`.
- [x] **C-54** — `spec.md` §6 poprawiony w trakcie planowania (własność `ownerId`-only zamiast ogólnego
      „wzorzec `ownerId`/`ownerTeamId`"), żeby plan i spec się nie rozjeżdżały.
