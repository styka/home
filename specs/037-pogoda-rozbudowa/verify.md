# Weryfikacja: Pogoda — mapa, obserwatory, propozycje „Co robić?" i widoczne koszty AI

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (34/34 odhaczone)
- **Data:** 2026-07-31

## 1. Bramki techniczne

Wszystkie uruchomione na **lokalnym Postgresie** (`omnia_dev` na `127.0.0.1:5432`), nigdy przeciw
produkcyjnej bazie (C-13). `scripts/migrate.js` — ostatni krok `npm run build` — **świadomie
pominięty**, bo rusza prawdziwą bazę Neon; weryfikacja idzie do kroku `next build` włącznie.

| Komenda | Wynik |
|---|---|
| `npx prisma migrate deploy` | ✅ 229 migracji zaaplikowanych, `0215_pogoda_pomysly_i_licznik_kosztow` bez błędu |
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0216)" |
| `npm run check:actions` | ✅ 160 akcji w katalogu, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 519 akcji: kontrola dostępu + klasyfikacja AI (159 ai / 1 pending / 201 excluded mutacji) |
| `npm run check:cost-badge` (**nowa**) | ✅ 32 pliki wołające model, każdy przekazuje zużycie lub ma świadomy wyjątek |
| `npx next lint --dir src` | ✅ 16 ostrzeżeń — **wszystkie zastane**, żadne w plikach tej zmiany (grep po `weather`, `costVisibility`, `llm-client`, `jobs/handlers`, `api/llm` — zero trafień) |
| `npx next build` | ✅ „Compiled successfully"; `/pogoda` 13,8 kB, `/pogoda/pomysly` 5,01 kB |
| `npx tsc --noEmit` | ✅ czysto |

**Dowód wykonania na bazie** (skrypt na lokalnym Postgresie, konto testowe utworzone i usunięte):

```
Config ai_cost_badge_enabled: 1
utworzono WeatherIdea: cms92kn… state: considered detailRuns: 0
unique [ownerId,fingerprint] działa: P2002
upsert → state: blocked
zablokowanych: 1
kaskada po usunięciu użytkownika, pozostało: 0
```

To potwierdza jednocześnie: seed konfiguracji, klucz unikalny, ścieżkę `upsert` (blokada) i kaskadowe
usuwanie po `User`.

## 2. Kryteria akceptacji

Legenda: ✅ spełnione · ⚠️ spełnione częściowo / z zastrzeżeniem · ❌ niespełnione ·
🔍 zweryfikowane przez prześledzenie ścieżki w kodzie (bez uruchomienia UI — patrz §5).

### Mapa i lokalizacje

| AC | Werdykt | Dowód |
|---|---|---|
| AC-1 mapa w wyborze lokalizacji | ✅ 🔍 | `WeatherPage.tsx` — przycisk „Wskaż na mapie" w `LocationsModal` obok „Użyj mojej lokalizacji (GPS)" i pola nazwy; renderuje `LocationMapPicker` |
| AC-2 zapis punktu bez nazwy | ✅ 🔍 | `actions/weather.ts:113` `addLocationByPoint` → `reverseGeocode` → `label = name ?? "51.2345, 19.4567"`; walidacja zakresów przed zapisem |
| AC-3 start na bieżącej lokalizacji | ✅ 🔍 | `LocationMapPicker.tsx` — `center: [start.lat, start.lon]`, `zoom: initial ? 11 : 6`, znacznik ustawiony na `start`; `WeatherPage` przekazuje `current={coords}` |
| AC-4 gesty i mobile | ✅ 🔍 | `LocationMapPicker.tsx:65` `scrollWheelZoom: false` + `touchZoom: true` (mapa nie porywa scrolla strony), wysokość `min(60vh, 420px)`, przycisk zapisu `className="py-3"` (C-31) |
| AC-5 awaria kafelków | ✅ 🔍 | `tiles.on("tileerror", …)` → `setTilesFailed(true)` → komunikat „Nie udało się wczytać mapy — wskaż lokalizację po nazwie lub przez GPS"; pozostałe drogi wyboru są poza komponentem mapy, więc działają niezależnie |

### Obserwatory

| AC | Werdykt | Dowód |
|---|---|---|
| AC-6 „Niespełnione" przy suchej prognozie | ✅ 🔍 | Prompt w `evaluateWatchers` zawiera wprost przykład graniczny: *„obserwator «Bardzo mokry weekend» przy suchej prognozie ma status unmet — mimo że sucha pogoda jest przyjemna"*; `STATUS_STYLE.unmet.label = "Niespełnione"` |
| AC-7 neutralna, zamknięta skala | ✅ | Typ `WatcherStatus = "met" \| "partial" \| "unmet" \| "unknown"`; wartość spoza zbioru degraduje do `"unknown"` (`WATCHER_STATUSES.includes(...)`). Żadna etykieta nie ocenia pogody |
| AC-8 edycja obserwatora | ✅ 🔍 | `WatchersPanel.tsx` — ikona `Pencil` przy każdym kafelku → `WatcherFormModal initial={editing}` → istniejąca akcja `updateWatcher`; działa dla `preset` i `custom` |
| AC-9 brak nieaktualnej oceny po edycji | ✅ | `saveEdit()` robi `setVerdicts(null)` **przed** zapisem i woła `evaluate()` po nim. Automatyczny `useEffect` by nie wystarczył — jego zależnością jest `watchers.length`, której edycja nie zmienia (to było realne ryzyko, opisane w kodzie) |

### „Co robić?" — propozycje

| AC | Werdykt | Dowód |
|---|---|---|
| AC-10 lista zamiast akapitu | ✅ 🔍 | `IdeasPanel.tsx` renderuje `ideas.map(...)` jako kafelki `IdeaCard`; prompt wymaga 5–7 pozycji. Stary kafel jednego akapitu i akcja `describeDay` **usunięte** |
| AC-11 propozycje miejscowe ~30 km | ⚠️ 🔍 | Prompt wymaga „CO NAJMNIEJ 2" pozycji z nazwą własną w promieniu ok. 30 km i oznacza je `nearby: true`; UI pokazuje znacznik „w okolicy". **Zastrzeżenie:** to wymóg promptowy, nie gwarancja — model może zwrócić mniej. Świadomie nie egzekwujemy tego twardo (spec §9: nie budujemy własnej bazy atrakcji), a korektą jakości jest „Nie proponuj" |
| AC-12 szczegóły: panel / arkusz | ✅ 🔍 | `IdeaDetailSheet.tsx` — jedno drzewo DOM: `fixed inset-0 z-40 … md:static md:max-h-[70vh] md:rounded-xl`. Mobile ma „Wróć do listy" (`md:hidden`), desktop przycisk `X` (`hidden md:block`), `Esc` zamyka |
| AC-13 trwałość szczegółów | ✅ | `getIdeaDetail` czyta wiersz i **nie woła modelu** (w funkcji nie ma `chatComplete`); `openIdea` pyta o zapis i dopiero jego brak uruchamia generację. Kolumny `detail`/`detailAt`/`detailUsage` potwierdzone na bazie |
| AC-14 ponowna generacja | ✅ | `generateIdeaDetail(..., { force: true })` omija wczesny zwrot (`weather.ts:608`), ustawia `cache: false` i robi `detailRuns: { increment: 1 }`; UI pokazuje „Wersja N" |
| AC-15 znacznik „już rozważana" | ✅ 🔍 | `getIdeas` dokleja `hasDetail: !!row?.detail` po `fingerprint`; `IdeaCard` renderuje znacznik z ikoną `Eye`. Otwarcie takiej pozycji trafia w zapis, nie w model |
| AC-16 „nie proponuj" z listy | ✅ | Dwie warstwy: podpowiedź w prompcie (lista zablokowanych tytułów) **oraz** twardy filtr serwerowy `weather.ts:538` `if (row?.state === "blocked") continue`. Filtr działa też przy `variation: true`, bo jest poza gałęzią cache. `blockIdea` używa `upsert`, więc działa dla pozycji bez wiersza |
| AC-17 biblioteka z filtrami | ✅ 🔍 | `/pogoda/pomysly` → `IdeaLibraryPage` z filtrami stanu (Wszystkie/Zapisane/Rozważane/Zablokowane) i selektorem lokalizacji |
| AC-18 zarządzanie pozycjami | ✅ 🔍 | `LibraryRow`: zapisz/odepnij (`setIdeaState`), „Nie proponuj" / „Przywróć proponowanie", „Do zadań", usuń, rozwinięcie zapisanego planu |
| AC-19 soft-delete do `/trash` | ✅ | `deleteIdea` → `recordTrash(user.id, { module: "weather", … })` → `delete` (`weather.ts:779`); `TrashModule` rozszerzony, `restoreTrashItem` ma gałąź `weather`, restorator odporny na kolizję unikalnego `fingerprint` |
| AC-20 „dodaj do zadań" | ✅ 🔍 | `addIdeaToTasks` sprawdza `PERMISSIONS.TASKS`, tworzy zadanie z odsyłaczem `/pogoda/pomysly?idea=<id>`; przycisk renderowany warunkowo (`canAddToTasks`), a strona biblioteki czyta `?idea=` i rozwija tę pozycję |
| AC-21 stany pusty/błędu | ✅ 🔍 | `IdeasPanel` ma trzy stany: ładowanie, błąd z przyciskiem „Spróbuj ponownie", pusty z tym samym przyciskiem — wszystkie po polsku |

### Koszty AI

| AC | Werdykt | Dowód |
|---|---|---|
| AC-22 licznik przy treści AI w Pogodzie | ✅ 🔍 | `AiCostBadge` w: `IdeasPanel` (pod listą), `IdeaDetailSheet` (stopka), `WatchersPanel` (pod kafelkami), `IdeaLibraryPage` (pod zapisanym planem). Wszystkie cztery wywołania LLM w module zwracają `usage` |
| AC-23 rozbicie kosztu dla admina | ✅ | `usageFromChat` buduje `UsageMeter` przez istniejące `accrueUsage` → `calls[]` z modelem, typem operacji, tokenami (wejście/wyjście/cache) i kosztem; `AiCostBadge` renderuje rozpiskę + sumę |
| AC-24 nie-admin nie dostaje szczegółów | ✅ | `costVisibility.ts:44` — `if (!hasPermission(session, PERMISSIONS.ADMIN)) return undefined`. Kontrola jest **strukturalna**: pole `usage` w ogóle nie trafia do odpowiedzi, więc nie da się go odczytać z narzędzi deweloperskich |
| AC-25 globalny przełącznik + audyt | ✅ | `setCostBadgeEnabled` zapisuje `Config`, woła `logAudit("config", "ai_cost_badge.set", …)` i `revalidatePath("/admin/llm")`; `readCostBadgeEnabled` gasi licznik we wszystkich modułach **i w asystencie**. Wartość `1` potwierdzona na bazie |
| AC-26 licznik w pozostałych modułach | ✅ | Serwerowo komplet — bramka potwierdza, że wszystkie 32 pliki wołające model przekazują zużycie. W UI wpięte: **Kuchnia** (import z URL, składniki, spiżarnia, plan tygodnia), **Zadania** (parsowanie), **Notatki/Zadania** (`SmartTextarea` — przepisywanie), **Magazyn** (szukaj, skan zdjęcia, dokument OCR, analityka, projekt zamówienia), **Zakupy** (normalizacja), **Języki** (ekstrakcja), **Wiadomości** (streszczenie), **Pety** (wnioski). Trzy miejsca świadomie bez renderu — patrz §5 |
| AC-27 „koszt nieznany" | ✅ | Ścieżka istniejąca: `estimateCost` zwraca `known:false` → `meter.costKnown = false` → `AiCostBadge` renderuje „koszt nieznany" zamiast kwoty (nie „0 zł") |
| AC-28 bramka na nowe wywołania | ✅ | `scripts/check-cost-badge.js` wpięty w `build` i jako `npm run check:cost-badge`. **Dowód skuteczności:** przy pierwszym uruchomieniu wykrył realną lukę — `api/llm/home/briefing/route.ts` nie przekazywał zużycia. Bramka wykrywa też nieaktualne wpisy w manifeście wyjątków |

### Układ

| AC | Werdykt | Dowód |
|---|---|---|
| AC-29 kolejność sekcji | ✅ | `WeatherPage.tsx:134–147`: `ForecastNow` → `IdeasPanel` → `ForecastHours` → `ForecastDays`. Jedno drzewo DOM, ta sama kolejność na komputerze i telefonie |

**Podsumowanie:** 28 × ✅, 1 × ⚠️ (AC-11), 0 × ❌.

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01 praca w `worldofmag/` | ✅ żaden plik spoza `worldofmag/` i `specs/` (poza `doświadczenia.md` — wymagane przez C-51) |
| C-02 alias `@/*` | ✅ nowe importy używają aliasu; względne tylko w obrębie `components/weather/` (spójne z otoczeniem) |
| C-10/C-11 migracja ręczna, unikalny numer | ✅ `0215_pogoda_pomysly_i_licznik_kosztow`, bramka potwierdza |
| C-12 zero enumów Prisma | ✅ `category`, `state` to `String` + union w `lib/weather/ideas.ts` |
| C-13 nigdy prod DB | ✅ wszystko na lokalnym Postgresie, `migrate.js` pominięty świadomie |
| C-14 idempotentny seed | ✅ `INSERT … ON CONFLICT ("key") DO NOTHING` z jawnym `gen_random_uuid()::text` (`Config.id` nie ma domyślnej wartości po stronie bazy — wychwycone przy pisaniu migracji) |
| C-20 Server Actions + `revalidatePath` | ✅ każda mutacja pomysłów kończy się `revalidatePath` |
| C-21 własność + guard | ✅ `requireAuth()` + jawne `row.ownerId !== user.id` w każdej akcji; ownership `ownerId`-only, jak `WeatherLocation`/`WeatherWatcher` |
| C-22 RBAC | ✅ bez nowego sluga — `permissionForPath` mapuje `/pogoda*` na `module.weather`; strona biblioteki dodatkowo sprawdza uprawnienie jawnie |
| C-23 `AIAction` ↔ egzekutor | ✅ nie dodano żadnej `AIAction`; `check:actions` bez zmian |
| C-24 soft-delete | ✅ `deleteIdea` przez `TrashItem` + restorator |
| C-25 audyt konfiguracji | ✅ `logAudit("config", "ai_cost_badge.set", …)` |
| C-30 zmienne CSS | ✅ zero hexów w nowym kodzie; znacznik mapy przez `divIcon` z `var(--accent-blue)`/`var(--on-accent)` — właśnie po to, żeby nie wnosić własnych kolorów |
| C-31 mobile/keyboard-first | ✅ arkusz pełnoekranowy na telefonie, `env(safe-area-inset-bottom)` w stopce szczegółów, cele `py-3`, `Esc` zamyka, `scrollWheelZoom` wyłączony |
| C-32 teksty po polsku | ✅ całe nowe UI i wszystkie prompty |
| C-40 routing modeli z bazy | ✅ wyłącznie `chatComplete({ op: "reasoning" \| "generation" })`, zero nazw modeli w kodzie |
| C-41 klucze szyfrowane/maskowane | ✅ nie dotknięte |
| C-50 „gotowe" = build | ✅ patrz §1 |
| C-51 lekcje | ✅ trzy wpisy w `doświadczenia.md` (semantyka statusu, bramka bez sesji, polski cudzysłów w literale TS) |
| C-53 minimalizm | ✅ jeden nowy model zamiast trzech; rozszerzone istniejące `usage.ts` i `AiCostBadge` zamiast drugiego systemu kosztów; jedna zależność (`leaflet`, bez `react-leaflet`); jeden formularz obserwatora; `describeDay` **usunięty** jako martwy kod |
| C-54 spójność artefaktów | ✅ trzy korekty wstecz: `spec.md` §6 (ownership), `plan.md` §5.5 (bramka jobów przy odczycie), `spec.md` AC-25 (asystent słucha samego przełącznika) |

**Naruszenia: brak.**

## 4. Regresje

| Obszar | Sprawdzenie | Wynik |
|---|---|---|
| Migracja a stary kod | Migracja jest **wyłącznie addytywna** (nowa tabela + `INSERT … DO NOTHING`) | ✅ poprzednia wersja aplikacji działa na nowym schemacie — rollback nie wymaga kroku wstecz |
| `AiCostBadge` w asystencie | Dodany prop `align` z domyślną wartością `"right"` = dotychczasowe `marginLeft:"auto"` | ✅ okno asystenta bez zmiany wyglądu |
| Wskaźnik kosztu w asystencie | Bramkowany **samym przełącznikiem**, bez zawężenia do admina | ✅ nie-admin nie traci funkcji, którą miał (świadome odstępstwo, dopisane do AC-25) |
| `post<T>` w `llm-client.ts` | Typ rozszerzony o opcjonalne `usage` | ✅ wszystkie istniejące wywołania kompilują się bez zmian (`tsc` czysto) |
| Trasy `/api/llm/*` | Dodane pole do odpowiedzi, żadne istniejące nieusunięte | ⚠️ dwie trasy (`tasks/search`, `tasks/suggest`) zwracały **surowy** `Response` z treścią modelu i teraz przechodzą przez `JSON.parse` + `NextResponse.json`. Kształt danych bez zmian, ale gałąź błędu parsowania zwraca teraz `{matches: []}` / `{}` zamiast surowego tekstu — zachowanie równoważne |
| Kosz | `TrashModule` rozszerzony o `"weather"`, `restoreTrashItem` ma nową gałąź | ✅ gałęzie `notes`/`tasks` nietknięte; `restoreWeatherIdea` obsługuje kolizję unikalnego klucza zamiast wywalać się na `create` |
| Kaskada usunięcia użytkownika | Test na bazie | ✅ `WeatherIdea` znika razem z `User` |
| `describeDay` usunięty | `grep` po całym `src/` poza wygenerowanymi plikami | ✅ zero odwołań |

## 5. Ograniczenia weryfikacji (uczciwie)

- **Nie uruchamiałem aplikacji w przeglądarce.** Weryfikacja UI to prześledzenie ścieżek w kodzie
  (oznaczone 🔍) plus statyczne bramki. Kryteria wymagające oceny wzrokowej i dotyku — gesty mapy
  (AC-4), układ arkusza na telefonie (AC-12), kolejność sekcji (AC-29) — są **poprawne w kodzie**, ale
  nie zostały obejrzane na żywym ekranie. To naturalny materiał na klikacza E2E albo szybki przegląd
  na środowisku testowym po merge do `develop`.
- **Nie wywoływałem prawdziwego modelu.** Wszystko, co zależy od treści odpowiedzi LLM — liczba i
  jakość propozycji (AC-10/AC-11), sensowność statusu obserwatora (AC-6) — zweryfikowałem na poziomie
  **promptu i obsługi wyniku**, nie na żywym wywołaniu. Prompt obserwatora zawiera oba przykłady
  graniczne wprost, więc ryzyko powrotu błędu jest niskie, ale nie zerowe.
- **AC-26 — trzy miejsca świadomie bez wskaźnika.** Pierwsza wersja weryfikacji wykazała brak renderu
  przy wynikach zadań w tle; został on **domknięty w trakcie tego etapu** (magazyn: skan, dokument,
  analityka, projekt zamówienia; kuchnia: plan tygodnia; pety: wnioski). Bez wskaźnika zostają trzy
  powierzchnie i każda z konkretnego powodu, nie z przeoczenia:
  - `ImportFromAIDialog` i `ImportFromImageDialog` (Kuchnia) — po sukcesie **zamykają się i nawigują**
    do edytora przepisu, więc nie istnieje moment, w którym wskaźnik dałoby się zobaczyć;
  - `RecipeImagesEditor` — OCR działa per zdjęcie, a wynik trafia do trwałego pola tekstowego;
    wskaźnik wymagałby stanu kluczowanego zdjęciem, co przy jednorazowym odczycie jest niewspółmierne
    (C-53).
  We wszystkich trzech zużycie **jest** zapisane w `Job.result` i widoczne w panelu kosztów admina —
  brakuje wyłącznie wskaźnika przy treści, i to świadomie.

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie bramki jakości przechodzą, 28 z 29 kryteriów akceptacji jest spełnionych w pełni, żadne nie
jest niespełnione.

Jedyna uwaga to **AC-11**: wymóg „co najmniej 2 propozycje miejscowe w promieniu ~30 km" jest
egzekwowany **promptem, nie kodem**. To świadoma decyzja ze speca (§9 — nie budujemy własnej bazy
atrakcji, bo oznaczałoby to utrzymywanie danych geograficznych), a mechanizmem korygującym jakość jest
„Nie proponuj": propozycja zmyślona albo nietrafiona znika z listy jednym dotknięciem i nie wraca.
Nie traktuję tego jako braku do naprawy — to zaplanowany kompromis, nie niedoróbka.

Pierwsza wersja tej weryfikacji zgłaszała drugi brak (AC-26 — wskaźnik kosztu przy wynikach zadań w
tle). Zamiast raportować go jako „pracę do domknięcia", **domknąłem go w trakcie etapu**: sześć
komponentów dostało render wskaźnika, a trzy pozostałe mają udokumentowany powód, dla którego go nie
mają (§5). Ponowne bramki po tej zmianie: `check:cost-badge` ✅, `tsc` ✅, `next lint` ✅ (16 ostrzeżeń,
bez zmiany wobec stanu wyjściowego), `next build` ✅.

Przechodzę do `/review`.
