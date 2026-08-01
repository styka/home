# Mapowanie kryteriów akceptacji na wynik implementacji (wejście do `/verify`)

- **Feature:** 039-wiadomosci-i-wiedza-o-userze
- **Stan:** 24/24 zadania zamknięte; bramki zielone (patrz sekcja na końcu)

| AC | Gdzie zrealizowane | Jak sprawdzić |
|---|---|---|
| AC-1 każde źródło pobierane raz | `lib/jobs/handlers/newsRefresh.ts` → `fetchPool` — jedna pętla po **źródłach**, jedno `fetchRss` na źródło; tematy nie występują w tej pętli | Przeczytać `fetchPool`: liczba wywołań `fetchRss` = liczba włączonych źródeł |
| AC-2 jeden przebieg klasyfikacji | `classifyPool` — jedno wywołanie `op:"dispatch"` na porcję (40 art.), lista **wszystkich** tematów w prompcie | Liczba wywołań = `ceil(pula/40)`, niezależna od liczby tematów |
| AC-3 gorące tematy z puli | `actions/news.ts` → `getHotTopics` czyta `prisma.newsArticle`; `fetchRss` nie jest już importowane w tym pliku | `grep fetchRss src/actions/news.ts` → brak |
| AC-4 pobieranie od poprzedniego razu | `NewsPref.lastFetchedAt` jako próg; brak wartości → okno 24 h | `fetchPool`, stała `FIRST_RUN_WINDOW_MS` |
| AC-5 widoczny postęp | `ctx.progress(...)` w każdym etapie → `Job.progress` (migracja 0218) → `RefreshStatus` w `NewsPage` | Pasek pod nagłówkiem modułu w trakcie przebiegu |
| AC-6 przebieg przeżywa zamknięcie strony | `getNewsRefreshState()` czyta ostatnie zadanie `news.refresh` z kolejki; komponent odpytuje je co 2 s, gdy trwa | Odświeżenie strony w trakcie przebiegu — pasek wraca |
| AC-7 błąd zamiast pustki | `llmJson` rzuca przy `!ok`, `truncated` i nieparsowalnym JSON; `RefreshStatus` ma osobny, czerwony stan `FAILED`; `HotTopics` ma stan `failed` odrębny od „brak tematów" | Ścieżka błędu w `newsRefresh.ts` i `NewsPage.tsx` |
| AC-8 linia czasu | `NewsTimelineEntry` + `getTopicTimeline` + `components/news/NewsTimeline.tsx` (data, fakt, źródło, od najnowszej) | Widok tematu, sekcja „Linia czasu" |
| AC-9 data ze zdarzenia | Prompt `TIMELINE_SYSTEM` żąda daty ZDARZENIA; `dateConfidence` = `exact\|approx\|published`; sortowanie po `eventDate` | `buildTimeline`; znacznik „data przybliżona"/„data publikacji" w UI |
| AC-10 brak dublowania | Model dostaje istniejące fakty z okresu; zapis przez `createMany({skipDuplicates})` na unikacie `[topicId, fingerprint]` | `buildTimeline` + migracja 0217 |
| AC-11 stara baza wiedzy usunięta | `DROP TABLE IF EXISTS "NewsKnowledge"` (0217), model usunięty ze `schema.prisma`, `KnowledgePanel.tsx` skasowany | `grep -rn "NewsKnowledge" src prisma/schema.prisma` → brak |
| AC-12 tania klasyfikacja, leniwe streszczenia | Klasyfikacja `dispatch`; streszczenie w domyślnej długości ze skrótu z kanału; **pełny artykuł** dociąga dopiero `resummarizeItem` na życzenie | `classifyPool` / `summarizeItems` / `resummarizeItem` |
| AC-13 wskaźnik kosztu | Suma zużycia z etapów (`usageFromChat(sink)`) w wyniku zadania → `visibleUsage` przy odczycie → `AiCostBadge` w `RefreshStatus` i w `HotTopics` | Bramka `check:cost-badge` + widok |
| AC-14 sterowanie odsłuchem | `NewsReader`: wstecz / pauza-wznów / dalej / stop | Karta wiadomości → „Słuchaj" |
| AC-15 podświetlenie zdania | `NewsReader`, `data-sentence` + `bg-elevated` i lewa krawędź `accent-purple`, `scrollIntoView` | j.w. |
| AC-16 klik w zdanie = przeskok | `onClick`/`onKeyDown` na każdym zdaniu → `step(i - current)` | j.w. |
| AC-17 lektor na telefonie | Pasek `sticky bottom-0`, `py-3`, `env(safe-area-inset-bottom)`, akcje na `onPointerDown` | j.w. (widok mobilny) |
| AC-18 odrzucanie gorących tematów | `hideHotTopic(title)` po odcisku tytułu; przycisk „Nie proponuj" | Zakładka „Gorące tematy" |
| AC-19 lista odrzuconych + przywracanie | `getHiddenTopics`/`unhideHotTopic`; panel „Odrzucone tematy" z „Przywróć" i „Monitoruj" | j.w. |
| AC-20 czytelne „Wszystkie" | `Wszystkie (N)` + zdanie wyjaśniające pod paskiem zakładek | Widok tematu |
| AC-21 fakty z zachowań | `lib/jobs/handlers/userFacts.ts` — czyta wyłącznie zapisane/zablokowane pomysły, monitorowane i odrzucone tematy | Przycisk „Poszukaj hipotez" w `/settings` |
| AC-22 potwierdzenie jednym dotknięciem | `UserFactHypothesisCard` (Pogoda) i przyciski „Zgadza się"/„Nie o mnie" w `/settings` | Pogoda, pod listą propozycji |
| AC-23 odrzucony nie wraca | `rejectUserFact` ustawia `status:"rejected"` (bez kasowania); handler przekazuje odrzucone do promptu i dodatkowo filtruje po odcisku | `actions/userFacts.ts` + `userFacts.ts` handler |
| AC-24 przegląd i edycja w ustawieniach | `components/settings/UserFactsSection.tsx` w `/settings` (kategorie, pewność, pochodzenie, edycja, usuwanie) | `/settings` → „Wiedza o Tobie" |
| AC-25 wgląd administratora | `/admin/user-facts` + `components/admin/UserFactsPanel.tsx`; zapis stąd ma `origin:"admin"` | `/admin` → „Wiedza o użytkownikach" |
| AC-26 Pogoda korzysta z faktów | `buildUserContext(userId)` w `actions/weather.ts` (`personalHint`), `userContextStamp` w `hashInputs` | `getIdeas` |
| AC-27 brak faktów niczego nie psuje | `buildUserContext` zwraca pusty string przy braku faktów **i przy błędzie odczytu** (try/catch) | `lib/userContext.ts` |

## Odstępstwa od planu (C-54)

1. **Migracja 0218 `Job.progress`** — plan mówił „raportują postęp przez `ctx`", ale nie
   rozstrzygał, gdzie postęp mieszka; AC-6 wymaga odtworzenia stanu z kolejki. Dopisane do
   `plan.md` §2.7.
2. **Akcja asystenta `refresh_news_topic` → `refresh_news`** — odświeżanie dotyczy całego modułu,
   więc stara nazwa mówiłaby nieprawdę o tym, co robi.
3. **`acknowledgeItem` przestał wołać model** — jego dotychczasowa treść (dopisanie sekcji do
   narracyjnej bazy wiedzy) zniknęła razem z `NewsKnowledge`. Zostaje zmiana statusu.
4. **Przycisk „Poszukaj hipotez"** w `/settings` — plan nie wskazywał wyzwalacza zadania
   `user.facts`; wnioskowanie odpalane automatycznie w tle byłoby sprzeczne z zasadą, że lista
   faktów nie rośnie bez wiedzy użytkownika.

## Bramki (lokalny Postgres, C-13 — bez `scripts/migrate.js`)

| Krok | Wynik |
|---|---|
| `copy-docs` | ✅ |
| `check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem |
| `check:ai-coverage` | ✅ 533 akcje sklasyfikowane, każda z guardem |
| `check:cost-badge` | ✅ 34 pliki wołające model |
| `check:content-memory` | ✅ 34 pliki sklasyfikowane (5 z pamięcią treści) |
| `check:migrations` | ✅ następny wolny numer 0219 |
| `next lint --dir src` | ✅ (tylko istniejące wcześniej ostrzeżenia kosmetyczne) |
| `prisma generate` | ✅ |
| `next build` | ✅ „Compiled successfully", `/admin/user-facts` w wykazie tras |
| `npm run test:unit` | ✅ **560/560** (z testami DB-gated na lokalnym Postgresie) |
