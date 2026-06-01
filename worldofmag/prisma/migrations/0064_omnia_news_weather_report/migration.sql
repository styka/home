-- Raport implementacji 2026-06-01 (moduły Wiadomości + Pogoda).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-01',
  'omnia-implementacja-2026-06-01',
  $omnia_news_weather$# Omnia — Raport implementacji 2026-06-01

Sesja zrealizowała jedno duże zgłoszenie obejmujące **dwa nowe moduły**: **Wiadomości**
(personalizowane streszczenia z monitorowaniem tematów i bazą wiedzy) oraz **Pogoda**
(szczegółowa prognoza z poradami AI i obserwatorami). Przed implementacją przeprowadzono
rozmowę projektową z administratorem (11 pytań w 3 turach), ustalając kluczowe decyzje.

## Decyzje projektowe (ustalone z administratorem)
- **Zakres:** pełny zakres obu modułów w jednej sesji.
- **Pobieranie wiadomości:** RSS/Atom + dociąganie pełnej treści artykułu (zamiast scrapingu
  podstron) — oficjalne, stabilne, łatwe filtrowanie po dacie (twardy limit 24h).
- **Domyślne źródła:** Onet (centrum), OKO.press (lewica), Niezależna (prawica).
- **Pogoda:** Open-Meteo (darmowe, bez klucza); lokalizacja z geolokalizacji przeglądarki,
  fallback Warszawa, konfigurowalna.
- **Ostrzeżenia pogodowe:** presety + własne obserwatory opisane naturalnym językiem (LLM).
- **Filtrowanie wiadomości:** każdy świeży artykuł przez LLM (trafność semantyczna + nowość
  względem bazy wiedzy + odsiew clickbaitu).
- **Zasięg:** prywatne per użytkownik (`ownerId`).
- **Gorące tematy:** agregacja nagłówków z 24h → klastrowanie LLM → „dodaj jako temat".
- **Skróty:** 3 poziomy długości per wiadomość (przeliczane na żądanie) + domyślna długość.
- **Trasy:** `/wiadomosci` (`module.news`), `/pogoda` (`module.weather`).

## Moduł Wiadomości
**Diagnoza/wymaganie:** użytkownik chce definiować tematy filtrowane semantycznie, dostawać
tylko świeże (≤24h) i *wnoszące coś nowego* informacje, budować per-temat i per-źródło
narastającą bazę wiedzy z historią wersji, łatwo przełączać widok między źródłami,
regenerować ręcznie, regulować długość streszczeń i odkrywać „gorące tematy".

**Rozwiązanie i uzasadnienie:**
- **Pipeline na żądanie** (bez crona — Render free tier i tak usypia): RSS → filtr 24h →
  dociągnięcie treści tylko dla kandydatów → **jeden batchowy call LLM na źródło** ocenia
  trafność + nowość + tworzy streszczenie. Batchowanie per źródło ogranicza koszt tokenów.
- **Nowość względem bazy wiedzy:** do promptu wstrzykiwany jest bieżący stan wiedzy danego
  źródła, dzięki czemu LLM odrzuca powtórki/clickbait („nic nowego").
- **Baza wiedzy = wersjonowanie:** dopiero **„Przyjmij do wiedzy"** wplata pozycję w stan
  (nowa wersja `NewsKnowledge`), więc niezatwierdzone materiały nie zaśmiecają wiedzy.
  Stan trzymany osobno per (temat × źródło); pełna historia wersji dostępna w UI.
- **Twardy limit 24h:** pozycje starsze niż 24h są pomijane przy pobieraniu i czyszczone
  przy odświeżeniu; widok filtruje po `publishedAt`.
- **UX:** lista tematów z licznikami nowości, przełącznik źródeł (z kolorem światopoglądu),
  karty wiadomości z linkiem do źródła, przełącznikiem długości i akcjami przyjmij/odrzuć,
  panel „Aktualny stan wiedzy" z historią, widok „Gorące tematy", ekran źródeł.

**Zmienione/nowe pliki:**
- `prisma/schema.prisma`, `prisma/migrations/0056_news_weather_modules` — modele
  `NewsSource`, `NewsTopic`, `NewsKnowledge` (wersjonowana), `NewsItem`, `NewsPref`.
- `src/lib/news/sources.ts` — domyślne źródła + metadane światopoglądu.
- `src/lib/news/rss.ts` — tolerancyjny parser RSS 2.0/Atom (bez zależności).
- `src/lib/news/article.ts` — dociąganie i czyszczenie treści artykułu + og:image.
- `src/lib/news/format.ts`, `src/lib/llm/json.ts` — helpery prezentacji i parsowania JSON LLM.
- `src/actions/news.ts` — pełna logika (CRUD tematów/źródeł, pipeline `refreshTopic`,
  `acknowledgeItem` z mergem wiedzy, `resummarizeItem`, `getHotTopics`, historia, preferencje).
- `src/components/news/*` — `NewsPage`, `NewsItemCard`, `KnowledgePanel`, `HotTopics`,
  `NewsSettings`.
- `src/app/wiadomosci/{page,layout}.tsx` — trasa modułu.

## Moduł Pogoda
**Diagnoza/wymaganie:** szczegółowa, ale nieprzytłaczająca pogoda; opis AI „co robić" znając
parametry godzinowe i lokalizację; ostrzeżenia o różnych horyzontach (dziś/jutro/weekend) i
mnogości specjalizacji (sport, zawody, rozrywki) rozwiązane mądrze UX-owo.

**Rozwiązanie i uzasadnienie:**
- **Open-Meteo** (bez klucza): prognoza bieżąca + godzinowa + 7-dniowa; mapowanie kodów WMO
  na polskie opisy/emoji. Dane pobierane na żywo (nic nie cache'ujemy w DB poza ustawieniami).
- **Porada AI** generowana z digestu godzinowego + lokalizacji (op `generation`).
- **Obserwatory** rozwiązują problem „mnogości specjalizacji": gotowe presety (bieganie,
  rower, grill, ogród, narty, przymrozki, burze, upały, weekend bez deszczu…) **oraz** własne
  opisane naturalnym językiem; jeden call LLM ocenia wszystkie włączone obserwatory względem
  prognozy i zwraca status (sprzyja/uwaga/odradzane/info) z konkretami. Horyzont czasowy jest
  atrybutem obserwatora, więc „weekend" i „dziś" współistnieją bez osobnych ekranów.

**Zmienione/nowe pliki:**
- `prisma/schema.prisma`, `prisma/migrations/0056_news_weather_modules` — modele
  `WeatherLocation`, `WeatherWatcher`.
- `src/lib/weather/openMeteo.ts` — klient Open-Meteo + geokodowanie + mapowanie WMO.
- `src/lib/weather/presets.ts` — presety obserwatorów, horyzonty, fallback lokalizacji.
- `src/actions/weather.ts` — lokalizacje, prognoza, `describeDay`, obserwatory, `evaluateWatchers`.
- `src/components/weather/*` — `WeatherPage`, `ForecastView`, `WatchersPanel`.
- `src/app/pogoda/{page,layout}.tsx` — trasa modułu.

## Integracja systemowa
- Uprawnienia `module.news`, `module.weather` dodane w `src/lib/permissions.ts`
  (`permissionForPath`) oraz seedowane w `scripts/migrate.js` (rola ADMIN).
- Rejestracja w nawigacji: `src/lib/modules.tsx` (sidebar desktop + overlay mobilny,
  ikony `Newspaper`/`CloudSun`).
- LLM przez istniejący `chatComplete` (routing modelu z `/admin/llm`), JSON parsowany
  tolerancyjnie; brak konfiguracji LLM degraduje łagodnie (pogoda działa bez porady AI).

## Podsumowanie
Jedna sesja, jedno zgłoszenie rozbite na dwa pełne moduły. Główne obszary zmian: schemat DB
(7 nowych modeli + migracja), 5 nowych bibliotek (`news/*`, `weather/*`, `llm/json`),
2 pliki Server Actions, 8 komponentów React, 2 trasy, rejestracja uprawnień i nawigacji.
`npm run build` (bez kroku migracji prod) przechodzi. Uwaga operacyjna: pobieranie RSS i
treści artykułów wymaga dostępu wychodzącego — działa na Render (prod/test), natomiast w
zamkniętym sandboxie sieć bywa ograniczona. Lekcja techniczna (polskie cudzysłowy `„…”` vs
proste `"` łamiące stringi) zapisana w `doświadczenia.md`.
$omnia_news_weather$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
