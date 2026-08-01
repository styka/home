# Recenzja: 039 — Wiadomości (przebudowa) + wiedza o użytkowniku

- **Data:** 2026-08-01
- **Diff:** `origin/develop...HEAD` — 50 plików, +4776 / −1195, 13 commitów
- **Podstawa:** `spec.md` (27 AC), `plan.md`, `verify.md` (GOTOWE, 27/27)

Recenzja celowała w to, czego `/verify` z natury nie łapie: ścieżki awaryjne, warunki brzegowe
i styki z resztą systemu. Dwa poważne defekty **naprawiłem w trakcie recenzji** (opis niżej, z
dowodem zachowania); resztę zgłaszam jako uwagi.

## Ustalenia

### 1. ❗ Zadanie zostawało w `QUEUED`, a pasek pokazywał „Odświeżam…" bez końca — NAPRAWIONE
- **Plik:** `src/actions/news.ts:437` (`startNewsRefresh`), `:455` (`getNewsRefreshState`)
- **Kategoria:** correctness
- **Opis:** worker kolejki startuje **leniwie i wyłącznie z tras `/api/jobs`** — `instrumentation.ts`
  wprost tego nie robi, bo bundluje się także dla runtime edge (`node:crypto` wywalało build).
  Nowa ścieżka („Server Action kolejkuje zadanie, komponent odpytuje przez Server Action") omija
  te trasy **w całości**, więc nikt nie wołał `startJobWorker()`.
- **Scenariusz awarii:** proces startuje (albo budzi się po uśpieniu na wolnym tierze `develop`),
  użytkownik wchodzi prosto na `/wiadomosci` i klika „Odśwież". Zadanie ląduje w kolejce ze statusem
  `QUEUED` i **nikt go nie podnosi**. Pasek stanu pokazuje „Odświeżam…" w nieskończoność, a
  `dedupeKey` sprawia, że kolejne kliknięcia wracają do tego samego martwego zadania. To najbardziej
  prawdopodobna ścieżka pierwszego użycia funkcji.
- **Poprawka:** `startJobWorker()` (idempotentne) w `startNewsRefresh` — po zakolejkowaniu — oraz w
  `getNewsRefreshState`, żeby powrót na stronę podnosił także zadanie zaległe po restarcie procesu.
  Ten sam wzorzec, którego używają trasy `/api/jobs`.

### 2. ❗ Awaria pobrania jednego kanału cicho gubiła materiał na zawsze — NAPRAWIONE
- **Plik:** `src/lib/jobs/handlers/newsRefresh.ts:105` (`fetchPool`)
- **Kategoria:** correctness
- **Opis:** próg czasu był wspólny dla modułu (`NewsPref.lastFetchedAt`) i przesuwał się na końcu
  przebiegu **bezwarunkowo**. Tymczasem `fetchRss` połyka błędy sieci i zwraca pustą listę — awaria
  jest nieodróżnialna od „nic nowego".
- **Scenariusz awarii:** o 12:00 użytkownik klika „Odśwież"; jeden z portali nie odpowiada (timeout
  12 s → `[]`). Znacznik i tak przeskakuje na 12:00. O 13:00 kolejne odświeżenie bierze materiał
  „od 12:00" — wszystko, co ten portal opublikował **przed** awarią, nie wróci już **nigdy**. Bez
  śladu w interfejsie: użytkownik widzi po prostu mniej wiadomości.
- **Poprawka:** próg liczony **per źródło**, z `max(publishedAt)` tego źródła w puli
  (`prisma.newsArticle.groupBy`), fallback 24 h. Znacznik przesuwa się wyłącznie dla źródeł, które
  faktycznie coś dostarczyły; nie wymaga nowej kolumny ani migracji. `lastFetchedAt` zostaje jako
  informacja „kiedy ostatnio pobieraliśmy". Powtórnie rozważony artykuł odsiewa `skipDuplicates`,
  więc koszt poprawki to zero dodatkowych zapisów.
- **Dowód (żywa baza):** dwa źródła, jedno z materiałem sprzed 2 h, drugie bez żadnego. Progi wyszły
  odpowiednio 2 h i 24 h; materiał z okna awarii (6 h temu) przechodzi przez próg padniętego źródła,
  a sprawne źródło nie przetwarza ponownie tego, co już ma.
- **Artefakty:** `plan.md` §3.1 poprawiony (C-54) — plan zakładał wspólny znacznik.

### 3. ⚠️ Nowy temat nie „dobiera" materiału, który jest już w puli
- **Plik:** `src/lib/jobs/handlers/newsRefresh.ts:264` (`unassignedPool`)
- **Kategoria:** correctness (UX), **nie naprawione — świadomie**
- **Opis:** do klasyfikacji trafiają wyłącznie artykuły bez **żadnego** `NewsItem`. Artykuł
  przypisany wcześniej do tematu A nigdy nie zostanie rozważony dla tematu B utworzonego później.
- **Scenariusz:** użytkownik dodaje temat „Wybory", klika „Odśwież" i widzi pustkę, choć w puli leży
  wczorajszy artykuł na ten temat (przypisany już do innego tematu). Zapełni się dopiero nowymi
  publikacjami — w praktyce w ciągu godzin, bo kanały publikują często.
- **Sugerowana poprawka (osobna zmiana):** przy `createTopic` zakolejkować jednorazowy „dobór z
  puli" dla tego jednego tematu. Nie robię tego tutaj, bo to **nowa funkcja**, a nie naprawa —
  żadne AC tego nie obejmuje, a doklejanie zakresu w recenzji łamie C-53.

### 4. ⚠️ `list_hot_topics` zwraca asystentowi dane o koszcie
- **Plik:** `src/lib/ai/agentTools.ts:1033`
- **Kategoria:** simplification
- **Opis:** read-tool zwraca cały `HotTopicsResult`, więc administratorowi wchodzą do kontekstu
  rozmowy pola `usage`/`generatedAt` — kilka tokenów bez wartości dla modelu. Nie jest to wyciek
  (dla nie-admina `visibleUsage` i tak zwraca `undefined`), tylko drobna nieoszczędność.
- **Sugestia:** przy najbliższym dotknięciu tego narzędzia zwracać samo `topics`.

### 5. ℹ️ `classifyPool` zapisuje pozycje pojedynczymi `create`
- **Plik:** `src/lib/jobs/handlers/newsRefresh.ts:235`
- **Kategoria:** simplification
- **Opis:** przy 120 artykułach × kilka tematów to nawet kilkaset osobnych zapytań. Świadomy wybór:
  `create` w `try/catch` pozwala wyłapać kolizję unikatu **i poznać `id`** nowej pozycji (potrzebne
  dla etapu streszczeń), czego `createMany` nie daje. Przy dzisiejszej skali (jeden użytkownik,
  przebieg w tle) nie ma to znaczenia; gdyby pula urosła, warto przejść na `createMany` +
  domykające `findMany`.

## Czego szukałem i nie znalazłem

- **Guardy dostępu (C-21):** wszystkie akcje `news`/`userFacts` przechodzą przez `requireAuth()`
  i filtrują po `ownerId`; akcje administratora przez `requireAdmin()`, a strona `/admin/user-facts`
  dodatkowo przez `hasPermission(...ADMIN)`. Bramka `check:ai-coverage` wymusza guard w ciele akcji.
- **`revalidatePath` (C-20):** obecny w każdej mutacji z 039.
- **Kolejność w eksporcie RODO:** doszły cztery zapytania w środku `Promise.all` — sprawdziłem
  **linia po linii**, że destrukturyzacja odpowiada kolejności zapytań (przestawienie dałoby ciche
  pomieszanie danych osobowych). Zgadza się; `own` to `{ ownerId }`, pasujące do wszystkich
  trzech nowych modeli.
- **Enumy Prisma (C-12), hardcode kolorów (C-30), teksty nie-PL (C-32), praca poza `worldofmag/`
  (C-01):** brak naruszeń.
- **Bezpieczeństwo:** brak logowania kluczy, brak `dangerouslySetInnerHTML` w nowych komponentach,
  linki zewnętrzne z `rel="noopener noreferrer"`.
- **Wyścig w `NewsPage`:** efekt domykający przebieg jest chroniony `wasRunning` (ref), więc nie
  zapętla się mimo tego, że `refresh` to nowy obiekt przy każdym odpytaniu.

## Bramki po poprawkach

| Krok | Wynik |
|---|---|
| `check:migrations` / `check:actions` / `check:ai-coverage` / `check:cost-badge` / `check:content-memory` | ✅ wszystkie |
| `tsc --noEmit` | ✅ |
| `next lint --dir src` | ✅ 0 błędów |
| `next build` | ✅ „Compiled successfully" |
| `npm run test:unit` | ✅ 560/560, 0 pominiętych |

## Werdykt

**APPROVE Z UWAGAMI.**

Dwa poważne defekty (martwy worker, cicho gubiony materiał) zostały naprawione w recenzji i
potwierdzone zachowaniem, nie samą kompilacją; plan zaktualizowany zgodnie z C-54. Pozostałe trzy
ustalenia są nieblokujące: jedno to brakująca funkcja poza zakresem tej zmiany (dobór z puli dla
nowo utworzonego tematu), dwa to drobne nieoszczędności. Zmiana jest gotowa do `develop` i promocji
na produkcję.
