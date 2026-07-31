# Plan techniczny: Pogoda — dopracowanie + przekrojowa pamięć treści AI

- **Spec:** ./spec.md (038-pogoda-pamiec-tresci-llm)
- **Status:** draft
- **Data:** 2026-07-31

> **Zasada planu:** to jest **JAK**. Wzorcem są istniejące mechanizmy przekrojowe z 037: licznik
> kosztu (`lib/ai/usage.ts` + `costVisibility.ts` + bramka `check-cost-badge.js`) oraz manifest
> pokrycia akcji (`action-coverage.json`). Pamięć treści powstaje **dokładnie w tym samym schemacie**:
> jeden model, jeden helper, jeden manifest, jedna bramka w buildzie.

## 1. Podejście

Trzy warstwy, w tej kolejności:

**(A) Naprawa u źródła.** Zgłoszenie 11 („Brak propozycji", ponad 5 prób) ma przyczynę udokumentowaną
niżej w §2.0 — i leży ona częściowo w **`lib/llm/chat.ts`**, nie w module Pogoda. Naprawa tam
naprawia wszystkich konsumentów naraz.

**(B) Przekrojowa pamięć treści AI** — nowy model `AiContent` + helper `lib/ai/contentMemory.ts` +
manifest + bramka. Wzorzec 1:1 z licznikiem kosztu z 037, bo tam ten schemat już się sprawdził.

**(C) Reszta zgłoszeń Pogody** — dane astronomiczne, ikony nocne, mobile, leniwe generowanie opisu.

## 2. Model danych (Prisma)

### 2.0 Diagnoza zgłoszenia 11 (podstawa decyzji projektowych)

Prześledzenie kodu daje **pełny łańcuch przyczynowy**, nie domysł:

1. `getIdeas` woła model z `maxTokens: 1200`, `json: true`, `op: "reasoning"`. Dla 5–7 propozycji z
   tytułem i uzasadnieniem po polsku to budżet **na styk** — a gdy typ operacji `reasoning` ma
   przypisany model rozumujący z niezerowym „wysiłkiem", tokeny rozumowania **wliczają się do tego
   samego limitu**, więc treść zostaje ucięta w połowie JSON-a.
2. `parseJsonLoose` na uciętym JSON-ie zwraca `null`.
3. `getIdeas` robi `parsed?.ideas ?? []` — **cisza**. Awaria zamienia się w pustą listę.
4. UI pokazuje „Brak propozycji na tę porę" — komunikat sugerujący, że model po prostu nic nie
   wymyślił.
5. **I tu klucz do „ponad 5 razy":** `chatComplete` zapisuje odpowiedź do pamięci podręcznej
   (`setCached`, `chat.ts:313`) **bez sprawdzenia flagi `truncated`**, którą sam wystawia
   (`chat.ts:423/540`). `getIdeas` używa `cache: true`. Uszkodzona odpowiedź trafia więc do cache i
   **każda kolejna próba dostaje ją natychmiast z powrotem** — awaria się utrwala i wygląda na
   deterministyczne „nie ma pomysłów".

Stąd naprawa jest **trzywarstwowa**, a nie jednolinijkowa:
- `chat.ts` — **nie zapisuj do cache odpowiedzi oznaczonej `truncated`** (błąd dotyczy każdego
  konsumenta z `cache: true`, nie tylko Pogody);
- `getIdeas` — `truncated` albo `parsed === null` to **błąd do zgłoszenia**, nie pusta lista; podnieść
  budżet tokenów;
- UI — osobny komunikat dla niepowodzenia i dla autentycznie pustej listy.

### 2.1 Nowy model `AiContent` — przekrojowa pamięć treści

```prisma
model AiContent {
  id      String @id @default(cuid())
  ownerId String
  // Rodzaj treści: "weather.ideas" | "weather.ideaDetail" | "storage.insights" | … (C-12: String+union).
  kind String
  // Co identyfikuje TĘ treść w obrębie rodzaju (np. lokalizacja|dzień|pora).
  scopeKey String
  // Odcisk WARUNKÓW powstania. Różnica względem bieżących = treść nieaktualna (nie: nieważna).
  inputHash String
  // Treść: markdown albo JSON, zależnie od rodzaju.
  content String
  // Zużycie modelu (JSON) — licznik kosztu działa też przy treści odtworzonej z pamięci.
  usage String?
  // Ile razy użytkownik JAWNIE odświeżył (0 = treść z pierwszej generacji).
  refreshes Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  owner User @relation("OwnedAiContent", fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, kind, scopeKey])
  @@index([ownerId, kind])
}
```

**Dlaczego jeden generyczny model, a nie kolumny w każdym module:** treść AI ma wszędzie ten sam
kształt problemu (co to jest / dla jakiego zakresu / w jakich warunkach powstało / kiedy). Osobne
rozwiązanie w Pogodzie, Magazynie i Kuchni oznaczałoby trzy razy tę samą logikę nieaktualności —
dokładnie ten błąd, którego uniknęliśmy przy liczniku kosztu (C-53).

**Dlaczego `inputHash`, a nie wygasanie po czasie:** prognoza na ten sam dzień i porę bywa
korygowana, ale upływ godzin sam w sobie nie unieważnia planu spaceru. Porównanie warunków jest
uczciwsze niż zegar (założenie ze `spec.md` §8).

### 2.2 Rozszerzenie `WeatherIdea` — nasiona do leniwego opisu

AC-12 wymaga, by opis wygenerowany **po wielu dniach** opierał się na warunkach **z chwili
zaproponowania**. Dziś `generateIdeaDetail` pobiera prognozę bieżącą — to jest właśnie ten rozjazd.

Nowe kolumny (wszystkie opcjonalne, więc migracja jest addytywna i bezpieczna):
- `seedDate String?` — dzień, dla którego propozycja powstała,
- `seedPart String?` — pora dnia (`morning|noon|afternoon|evening`, String+union — C-12),
- `seedWeather String?` — tekstowy skrót prognozy z chwili zaproponowania (to samo, co idzie do promptu).

### 2.3 Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0216**
- Katalog: `prisma/migrations/0216_pamiec_tresci_ai_i_nasiona_pomyslow/migration.sql`
- DDL:
  1. `CREATE TABLE "AiContent"` + FK do `"User"` `ON DELETE CASCADE`,
     `CREATE UNIQUE INDEX "AiContent_ownerId_kind_scopeKey_key"`, `CREATE INDEX "AiContent_ownerId_kind_idx"`.
  2. `ALTER TABLE "WeatherIdea" ADD COLUMN "seedDate" TEXT, ADD COLUMN "seedPart" TEXT, ADD COLUMN "seedWeather" TEXT;`
- **Wyłącznie addytywna** — stara wersja kodu działa na nowym schemacie, rollback bez kroku wstecz.
- Bez enumów Prisma (C-12); `kind` i `seedPart` to `TEXT` + union w TypeScript.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/lib/ai/contentMemory.ts` (nowy) — serce mechanizmu

```ts
export type AiContentKind = "weather.ideas" | "weather.ideaDetail" | "storage.insights"
  | "pets.insights" | "kitchen.planWeek";          // String + union (C-12)

export interface RememberedContent<T> {
  value: T;
  /** Kiedy treść powstała — UI pokazuje to przy każdej zapamiętanej treści (AC-8). */
  generatedAt: string;
  /** Warunki się zmieniły — pokaż „nieaktualne", ale NIE generuj sam (AC-6). */
  stale: boolean;
  fromMemory: boolean;
  refreshes: number;
  usage?: AiUsageInfo;
}

/**
 * Jedyne wejście do mechanizmu. `generate` woła model TYLKO gdy nie ma zapisu albo `force`.
 * Zapamiętana treść wraca bez żadnego wywołania modelu — to jest cały sens (AC-4, AC-5).
 */
export async function rememberedContent<T>(args: {
  ownerId: string;
  kind: AiContentKind;
  scopeKey: string;
  inputHash: string;
  force?: boolean;
  generate: () => Promise<{ value: T; usage?: AiUsageInfo }>;
}): Promise<RememberedContent<T>>;

/** Stabilny odcisk warunków — te same dane wejściowe dają ten sam skrót. */
export function hashInputs(...parts: (string | number | null | undefined)[]): string;
```

Zapis treści jako JSON (`JSON.stringify(value)`), odczyt przez `JSON.parse` w bezpiecznym `try` —
uszkodzony wpis traktujemy jak brak wpisu (najwyżej treść powstanie ponownie), nigdy nie wywala strony.

### 3.2 `src/actions/weather.ts` (zmiany)

| Funkcja | Zmiana |
|---|---|
| `getIdeas(lat, lon, label, {date, part, force})` | `variation` → **`force`** (jedna nazwa dla jednej intencji). Przechodzi przez `rememberedContent` (`kind: "weather.ideas"`, `scopeKey` = lokalizacja\|dzień\|pora, `inputHash` = skrót prognozy + listy zablokowanych/zapisanych). Zwraca dodatkowo `generatedAt`, `stale`, `fromMemory`. **Truncated albo nieparsowalny JSON → `throw`**, nie pusta lista. `maxTokens` podniesione do 2000. |
| `saveIdeaFromList(idea, ctx)` | **Nowa** — zapis propozycji z listy **bez generowania opisu** (AC-10). `upsert` ze `state: "saved"`, zapisuje `seedDate`/`seedPart`/`seedWeather`. Zero wywołań modelu. |
| `generateIdeaDetail(...)` | Używa **nasion** (`seedWeather`) gdy istnieją, zamiast bieżącej prognozy (AC-12); przechodzi przez `rememberedContent` (`kind: "weather.ideaDetail"`). |
| ~~`getWeatherAstro(lat, lon, date)`~~ | **Skreślona na etapie implementacji (C-54).** Okazała się zbędna: `sunrise`/`sunset` są już w obiekcie `Forecast`, który klient ma w ręku, a faza księżyca to czysta funkcja z daty. Osobna akcja serwerowa oznaczałaby dodatkową rundę do serwera po dane, które już są na miejscu. Pasek astronomiczny liczy się w `ForecastNow`. |

Guardy bez zmian: `requireAuth()` + `ownerId` (C-21). Każda mutacja kończy `revalidatePath`.

### 3.3 Naprawa w `src/lib/llm/chat.ts`

Jedna zmiana, szeroki skutek: `if (cacheKey && !res.truncated) setCached(...)`. Uszkodzona odpowiedź
przestaje się utrwalać w pamięci podręcznej. To naprawia klasę błędów, nie jeden objaw.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowych slugów.** `AiContent` jest zawsze czytany w kontekście modułu, który go zapisał;
  własność przez `ownerId`.
- Nowe akcje (`saveIdeaFromList`, `getWeatherAstro`) → wpis w `src/lib/ai/action-coverage.json` z
  `access: "owner"`, inaczej `check:ai-coverage` wywali build.
- `modules.tsx` / `ModuleSidebar` — bez zmian.

## 5. UI (C-30, C-31, C-32)

### 5.1 Kafel „Co robić?" — jeden przycisk generowania (AC-7)

Dziś obok siebie stoją „Pomysły" (odnośnik do biblioteki) i „Wylosuj inne" (generowanie) — oba
wyglądają jak przycisk. Po zmianie:
- **jeden** przycisk `Nowe propozycje` (ikona `RefreshCw`, nie `Shuffle` — „losowanie" sugerowało
  zabawę, a to jest odświeżenie), wołający `getIdeas({ force: true })`;
- biblioteka jako **odnośnik tekstowy** „Zapisane pomysły →" w stopce kafla, wizualnie odróżniony od
  przycisku;
- pod nagłówkiem linijka stanu: „wygenerowano <kiedy>" + znacznik „nieaktualne — prognoza się
  zmieniła", gdy `stale` (AC-6, AC-8).

### 5.2 Sekcja astronomiczna (AC-13, AC-14)

`ForecastNow` dostaje kompaktowy pasek pod bieżącą temperaturą: `🌅 6:42 · 🌇 20:15 · 🌔 Przybywający garb`.
Na telefonie zawija się do dwóch wierszy (`flex-wrap`), nie wymusza przewijania w poziomie.

`src/lib/weather/moon.ts` (nowy) — czysta funkcja `moonPhase(date)` → `{ fraction, name, emoji }`,
osiem polskich nazw faz. **Z testem** `moon.test.ts` na znanych datach nowiu i pełni (`npm run
test:unit`) — spec §9 wprost wskazuje, że błąd w tym rachunku byłby cichy i wiarygodnie wyglądający.

### 5.3 Ikony dnia i nocy (AC-15, AC-16)

- `wmo(code)` → `wmo(code, isNight?)`. Wariant nocny wyłącznie dla kodów, w których świeci słońce
  (0–2): `☀️→🌙`, `🌤️→🌙`, `⛅→☁️`. Deszcz, śnieg, mgła wyglądają tak samo w dzień i w nocy —
  **nie dorabiamy sztucznych wariantów** (C-53).
- Do zapytania o prognozę dokładamy `is_day` w parametrach **godzinowych** (dziś jest tylko w
  `current`), a `HourPoint` dostaje `isDay: boolean`. Autorytatywne źródło z API bije liczenie
  z godzin wschodu/zachodu po naszej stronie.
- `ForecastNow` używa `forecast.current.isDay`, które **już jest pobierane** i dziś nieużywane.

### 5.4 Mobile (AC-17, AC-18, AC-19)

- **Kafelek obserwatora** (`WatchersPanel`): dziś status, tytuł i horyzont są w jednym
  `flex items-center` bez zawijania. Po zmianie: tytuł w osobnym wierszu z `break-words`, pod nim
  wiersz znaczników (status + horyzont), akcje w prawym górnym rogu z celami `p-2`.
- **Górny margines bezpieczny arkusza** (`IdeaDetailSheet`): nagłówek dostaje
  `pt-[max(0.75rem,env(safe-area-inset-top))]`. Dolny margines już jest — brakowało wyłącznie
  górnego, stąd nagłówek pod zegarem i kamerką.
- **Spójność biblioteki pomysłów** (`IdeaLibraryPage`): wyrównanie do wzorca podstron modułu
  (szerokość kontenera, odstępy, nagłówek z ikoną i odnośnikiem powrotu) — porównanie z
  `/portfel/budzety` i `/warsztaty/przeglady`.

## 6. AI / integracje (C-23, C-40)

- **Bez nowych `AIAction`** — `check:actions` nietknięte.
- Routing modeli nadal wyłącznie przez `chatComplete({ op })` (C-40).
- **Personalizacja (namiastka bazy wiedzy):** do promptu propozycji dokładamy `AssistantPref.instructions`
  oraz tytuły **zapisanych** pomysłów użytkownika. To jedyne, co dziś istnieje; pełna baza wiedzy
  (zgłoszenie 10) wepnie się dokładnie w to miejsce w następnym przebiegu.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `AiContent` + relacja w `User` + trzy kolumny w `WeatherIdea` |
| `prisma/migrations/0216_pamiec_tresci_ai_i_nasiona_pomyslow/migration.sql` | nowy | DDL wg §2.3 |
| `src/lib/ai/contentMemory.ts` | nowy | `rememberedContent`, `hashInputs`, typy |
| `src/lib/ai/content-memory-coverage.json` | nowy | klasyfikacja każdego wywołania modelu: `remembered` / `on-demand` + powód |
| `scripts/check-content-memory.js` | nowy | bramka (wzorzec `check-cost-badge.js`) |
| `src/lib/llm/chat.ts` | edycja | **nie zapisuj do cache odpowiedzi uciętej** |
| `src/lib/weather/moon.ts` + `moon.test.ts` | nowy | faza księżyca + test na znanych datach |
| `src/lib/weather/openMeteo.ts` | edycja | `is_day` w danych godzinowych, `HourPoint.isDay`, `wmo(code, isNight)` |
| `src/actions/weather.ts` | edycja | `getIdeas` przez pamięć + twarda obsługa awarii, `saveIdeaFromList`, nasiona w `generateIdeaDetail`, `getWeatherAstro` |
| `src/components/weather/IdeasPanel.tsx` | edycja | jeden przycisk, stan „wygenerowano/nieaktualne", zapis z listy, rozróżnienie awarii od pustki |
| `src/components/weather/IdeaDetailSheet.tsx` | edycja | górny margines bezpieczny |
| `src/components/weather/ForecastView.tsx` | edycja | pasek astronomiczny + ikony nocne |
| `src/components/weather/WatchersPanel.tsx` | edycja | układ kafelka na telefonie |
| `src/components/weather/IdeaLibraryPage.tsx` | edycja | spójność ze wzorcem podstron |
| `src/lib/jobs/handlers/{magazynInsights,petsInsights,kitchenPlanWeek}.ts` + ich UI | edycja | wpięcie pamięci treści w pozostałych modułach |
| `src/lib/ai/action-coverage.json` | edycja | klasyfikacja nowych akcji |
| `package.json` | edycja | `check:content-memory` w `build` |
| `CLAUDE.md`, `doświadczenia.md` | edycja | dokumentacja + lekcje (C-51) |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13):** lokalny Postgres `omnia_dev`, `npx prisma migrate deploy`, weryfikacja **do
kroku `next build`** — `scripts/migrate.js` pomijamy, bo rusza produkcyjną bazę.

Sekwencja: `copy-docs → check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
check:migrations → next lint → prisma generate → next build`, plus `npm run test:unit` (faza księżyca).

| AC | Jak sprawdzamy |
|---|---|
| AC-1, AC-3 | „Co robić?" dla pory nocnej i dla pory, która minęła → niepusta lista |
| AC-2 | wymuszony ucięty wynik → komunikat o niepowodzeniu, **nie** „Brak propozycji” |
| AC-4, AC-5 | licznik wpisów w `AiCall` **nie rośnie** przy powrocie na stronę i przy zmianie na znane parametry |
| AC-6 | podmiana `inputHash` w bazie → znacznik „nieaktualne”, brak samoczynnej generacji |
| AC-7 | przegląd nagłówka kafla — jeden przycisk generujący |
| AC-8 | inny moduł (wnioski Magazynu) → treść z pamięci + data + przycisk odświeżenia |
| AC-9 | celowo „gołe” wywołanie treści prezentowanej → `check:content-memory` pada |
| AC-10 | zapis z listy → brak nowego wpisu w `AiCall`, pozycja w bibliotece bez opisu |
| AC-11, AC-12 | pierwsze wejście w szczegóły zapisanej pozycji → opis powstaje z `seedWeather`, nie z bieżącej prognozy |
| AC-13, AC-14 | pasek astronomiczny na desktopie i telefonie; `npm run test:unit` dla faz księżyca |
| AC-15, AC-16 | godzina nocna w pasku i „Teraz” po zmroku → ikona nocna |
| AC-17, AC-18, AC-19 | emulacja telefonu z wcięciem: kafelek obserwatora, nagłówek arkusza, układ biblioteki |

## 9. Ryzyka techniczne i plan wycofania

- **Zmiana w `chat.ts` dotyka wszystkich konsumentów pamięci podręcznej** → zmiana jest zawężająca
  (mniej wpisów w cache), więc najgorszy skutek to jedno dodatkowe wywołanie modelu; nigdy błędna treść.
- **Za agresywne uznawanie treści za nieaktualną** zniweczyłoby oszczędność → `inputHash` liczymy z
  **zaokrąglonych** wartości prognozy (temperatura do stopnia, opady do 5 punktów procentowych), żeby
  kosmetyczna korekta nie unieważniała planu.
- **Bramka pamięci treści nie da się wyprowadzić statycznie** (czy dane wywołanie to „treść do
  czytania”, czy „narzędzie na żądanie”) → dlatego manifest z **jawną klasyfikacją każdego wywołania**,
  dokładnie jak `action-coverage.json`; bramka pilnuje kompletności, nie zgaduje intencji.
- **Faza księżyca policzona źle** daje cichy błąd → test jednostkowy na znanych nowiach i pełniach.
- **Rollback:** migracja 0216 jest addytywna (nowa tabela + kolumny `NULL`), więc poprzednia wersja
  kodu działa na nowym schemacie; wycofanie = cofnięcie merge’a.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja `0216` (numer z `next:migration`), tylko `String`+union, brak
      enumów, addytywne DDL, weryfikacja na lokalnym Postgresie.
- [x] **C-20..C-25** — mutacje jako Server Actions z `revalidatePath`; guard `requireAuth` + `ownerId`;
      bez nowych slugów RBAC; bez nowych `AIAction`; kosz nie dotyczy treści odtwarzalnej (decyzja ze
      spec §6); brak zmian konfiguracji do audytu.
- [x] **C-30..C-32** — pasek astronomiczny i ikony nocne wyłącznie na zmiennych CSS i emoji; mobile:
      zawijanie kafelka obserwatora, `env(safe-area-inset-top)` **i** `-bottom`, cele dotykowe; całe UI
      i nazwy faz księżyca po polsku.
- [x] **C-40..C-41** — `chatComplete({op})` bez nazw modeli; brak styku z kluczami.
- [x] **C-50/C-51** — pełna sekwencja bramek + nowa bramka + testy jednostkowe; lekcje do
      `doświadczenia.md` (zwłaszcza utrwalanie uciętej odpowiedzi w pamięci podręcznej).
- [x] **C-53 (minimalizm)** — **jeden** generyczny model pamięci zamiast kolumn w trzech modułach;
      wschód/zachód z danych **już pobieranych**; ikony nocne jako parametr istniejącej funkcji, nie
      druga mapa; warianty nocne tylko tam, gdzie mają sens; zero nowych zależności.
- [x] **C-54** — plan nie zmienia zakresu speca; diagnoza z §2.0 doprecyzowuje ryzyko opisane w
      `spec.md` §9 („przyczyna może być inna niż zakładam") i potwierdza je dowodem z kodu.
