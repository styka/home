# Zadania: Pogoda — mapa, obserwatory, propozycje „Co robić?" i widoczne koszty AI

- **Plan:** ./plan.md (037-pogoda-rozbudowa)
- **Status:** todo
- **Data:** 2026-07-31

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie ≈ jeden commit, samodzielne i weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Szybkie wygrane (bez zmian schematu)

- [x] **T-1** — **Kolejność sekcji na `/pogoda`.** Rozbij `ForecastView.tsx` na trzy eksporty z tego
      samego pliku (`ForecastNow`, `ForecastHours`, `ForecastDays`) i złóż w `WeatherPage` kolumnę
      główną w kolejności: Teraz → „Co robić?" → Najbliższe godziny → Najbliższe dni.
      *Gotowe, gdy:* na `/pogoda` (desktop i mobile) sekcje idą w tej kolejności, `ForecastView` nie
      ma już nieużywanego eksportu. **(AC-29)**

- [x] **T-2** — **Edycja obserwatora — UI.** Przemianuj `AddWatcherModal` na `WatcherFormModal` z
      opcjonalnym propem `initial?: WatcherDTO`; jeden formularz obsługuje dodawanie i edycję. Dodaj
      ikonę ołówka przy kafelku obserwatora. Zapis przez **istniejącą** akcję `updateWatcher`; po
      zapisie `router.refresh()` + ponowne `evaluate()`.
      *Gotowe, gdy:* istniejącego obserwatora (preset i własny) da się poprawić bez usuwania, a po
      zapisie kafelek pokazuje werdykt policzony dla nowej definicji. **(AC-8, AC-9)**

## Faza 1 — Fundament danych

- [x] **T-3** — **Migracja `0215_pogoda_pomysly_i_licznik_kosztow`.** DDL wg planu §2: tabela
      `WeatherIdea` (FK do `User` `ON DELETE CASCADE`, `UNIQUE (ownerId, fingerprint)`,
      `INDEX (ownerId, state)`) + idempotentny seed `Config('ai_cost_badge_enabled','1')`.
      *Gotowe, gdy:* `npm run check:migrations` przechodzi, `npx prisma migrate deploy` na lokalnym
      Postgresie kończy się czysto.

- [x] **T-4** — **`schema.prisma`** — model `WeatherIdea` + relacja `weatherIdeas` w `User`, zgodnie
      z DDL z T-3. Statusy jako `String` (C-12).
      *Gotowe, gdy:* `npx prisma generate` przechodzi, a `prisma migrate diff` nie wykazuje rozjazdu
      schematu z migracją.

- [x] **T-5** `[P]` — **`src/lib/weather/ideas.ts`** — typy `IdeaState`/`IdeaCategory`/`IdeaDTO`,
      `fingerprintOf(title)` (małe litery, bez diakrytyków i interpunkcji) i polskie etykiety stanów
      oraz kategorii. Plik **poza** `"use server"`, bo eksportuje wartości runtime.
      *Gotowe, gdy:* `fingerprintOf("Wycieczka piesza: Skrzyczne → Malinowska Skała")` daje stabilny,
      ASCII-owy klucz; plik nie importuje niczego z `actions/`.

## Faza 2 — Warstwa wspólna kosztów AI

- [x] **T-6** — **`src/lib/ai/usage.ts`** — dołóż `AI_COST_BADGE_CONFIG_KEY`, typ `AiUsageInfo` i
      `usageFromChat(entries)` budujące zużycie z wyników `chatComplete` przez **istniejące**
      `newUsageMeter`/`accrueUsage` (bez drugiego liczydła).
      *Gotowe, gdy:* `usageFromChat` dla dwóch wyników zwraca sumę zgodną z `AiCall` i listę `calls`.

- [x] **T-7** — **`src/lib/ai/costVisibility.ts`** (nowy) — `readCostBadgeEnabled()` (brak wiersza =
      włączone, wzorzec `readFollowupsEnabled`) i `visibleUsage(usage)` zwracające `undefined`, gdy
      licznik wyłączony **albo** użytkownik nie ma `module.admin`.
      *Gotowe, gdy:* plik nie jest importowany przez `lib/llm/chat.ts` (brak cyklu z `@/lib/auth`), a
      dla konta bez uprawnień admina `visibleUsage` zawsze zwraca `undefined`. **(AC-24)**

- [x] **T-8** — **Przełącznik admina.** `actions/llmConfig.ts`: `getCostBadgeEnabled` /
      `setCostBadgeEnabled` (`requireAdmin`, `logAudit("config", "ai_cost_badge.set", …)`,
      `revalidatePath("/admin/llm")`) + przełącznik w `LlmConfigPanel.tsx` obok follow-upów.
      *Gotowe, gdy:* przełączenie zapisuje `Config`, zostawia wpis w `/admin/audit` i wraca po
      odświeżeniu strony. **(AC-25)**

- [x] **T-9** `[P]` — **`AiCostBadge` — prop `align`.** Domyślnie `"right"` (dzisiejsze
      `marginLeft:"auto"`), `"left"` dla nagłówków kafli.
      *Gotowe, gdy:* okno asystenta wygląda identycznie jak przed zmianą.

## Faza 3 — Mapa i lokalizacje

- [x] **T-10** — **`reverseGeocode(lat, lon)`** w `src/lib/weather/openMeteo.ts` — Nominatim
      (`format=jsonv2`, `zoom=10`, `accept-language=pl`), nagłówek `User-Agent`, timeout, `null`
      przy błędzie.
      *Gotowe, gdy:* dla współrzędnych Ślemienia zwraca nazwę miejscowości, a przy braku sieci `null`
      bez rzucania wyjątku.

- [x] **T-11** — **Akcja `addLocationByPoint(lat, lon)`** w `actions/weather.ts` — walidacja zakresów,
      nazwa z `reverseGeocode` z degradacją do sformatowanych współrzędnych, delegacja do `addLocation`,
      `revalidatePath("/pogoda")`.
      *Gotowe, gdy:* zapis punktu bez nazwy w wyszukiwarce tworzy lokalizację z sensowną etykietą. **(AC-2)**

- [x] **T-12** — **Zależność `leaflet`.** `npm i leaflet` + `npm i -D @types/leaflet`.
      *Gotowe, gdy:* `package.json`/`package-lock.json` zaktualizowane, `next build` nie zgłasza
      brakujących typów. **Bez `react-leaflet`** (C-53).

- [x] **T-13** — **`LocationMapPicker.tsx`** — `"use client"`, ładowany `dynamic(..., { ssr:false })`;
      kafelki OSM + wymagana atrybucja; znacznik jako `L.divIcon` w kolorach `var(--accent-blue)`
      (żadnych PNG z paczki); start na bieżącej lokalizacji; klik/tap przestawia znacznik; podgląd
      współrzędnych; przycisk „Zapisz tę lokalizację". `scrollWheelZoom` **wyłączony**, `touchZoom`
      włączony, wysokość `min(60vh, 420px)`, przyciski `py-3`. Obsługa `tileerror` → komunikat PL.
      *Gotowe, gdy:* punkt da się wskazać myszą i palcem, mapa nie porywa scrolla strony, a przy
      zablokowanych kafelkach widać komunikat i pozostałe drogi wyboru działają.
      **(AC-1, AC-3, AC-4, AC-5)**

- [x] **T-14** — **Wpięcie mapy w `LocationsModal`** (`WeatherPage.tsx`) obok wyszukiwania po nazwie i
      GPS; po zapisie odświeżenie listy i wybór nowej lokalizacji.
      *Gotowe, gdy:* pełna ścieżka „otwórz wybór → wskaż punkt → zapisz" mieści się w ≤3 interakcjach.
      **(AC-1, AC-2)**

## Faza 4 — Obserwatory: semantyka statusu

- [x] **T-15** — **Nowa skala statusu.** `WatcherVerdict["status"]` → `"met" | "partial" | "unmet" |
      "unknown"`; przepisany prompt systemowy w `evaluateWatchers` („oceniasz WYŁĄCZNIE, czy warunek
      obserwatora zachodzi — nie czy pogoda jest ładna"); nieznana wartość degraduje do `"unknown"`.
      `STATUS_STYLE` w `WatchersPanel`: Spełnione / Częściowo / Niespełnione / Brak danych + `title`
      wyjaśniający, że zieleń oznacza zgodność z pytaniem, a nie dobrą pogodę.
      *Gotowe, gdy:* obserwator „Bardzo mokry weekend" przy suchej prognozie pokazuje „Niespełnione",
      a żaden status nie wyraża oceny urody pogody. **(AC-6, AC-7)**

## Faza 5 — Propozycje „Co robić?"

- [x] **T-16** — **Akcje listy propozycji.** `getIdeas(lat, lon, label, {date, part, variation})`:
      prompt `op:"reasoning"`, JSON, `cache: !variation`, wymaga 5–7 pozycji w tym ≥2 z nazwą własną
      miejsca w promieniu ~30 km; do promptu trafia lista zablokowanych tytułów, a **serwer i tak
      filtruje** po `fingerprint`; dołącza stan z `WeatherIdea` (już rozważana / zapisana). Zwraca
      `{ ideas, usage }`.
      *Gotowe, gdy:* lista ma ≥4 pozycje, ≥1 miejscową, a zablokowane nie wracają nawet przy
      `variation:true`. **(AC-10, AC-11, AC-16 — część serwerowa)**

- [x] **T-17** — **Akcje szczegółów.** `getIdeaDetail` (zwraca zapis **bez** wołania modelu, podbija
      `viewCount`/`lastSeenAt`), `generateIdeaDetail` (`op:"generation"`, `upsert` po
      `[ownerId, fingerprint]`, zapis `detail`/`detailAt`/`detailRuns+1`/`detailUsage`, `force` =
      „Generuj ponownie" z `cache:false`).
      *Gotowe, gdy:* ponowne otwarcie szczegółów nie tworzy nowego wpisu w `AiCall`, a „Generuj
      ponownie" podbija `detailRuns` i zmienia treść. **(AC-13, AC-14)**

- [x] **T-18** — **Akcje biblioteki.** `getIdeaLibrary(filter)`, `setIdeaState(id, state)`,
      `blockIdea(idea, ctx)` (upsert, gdy wiersza jeszcze nie ma), `deleteIdea(id)` przez
      `recordTrash` + `delete`. Rozszerz `TrashModule` o `"weather"` i dołóż gałąź przywracania w
      `actions/trash.ts`. Wszystko z `requireAuth` + kontrolą `ownerId` i `revalidatePath`.
      *Gotowe, gdy:* usunięcie pomysłu widać w `/trash` i da się go przywrócić. **(AC-17, AC-18, AC-19)**

- [x] **T-19** — **`addIdeaToTasks(id)`** — zadanie w domyślnym projekcie użytkownika z tytułem
      propozycji i odsyłaczem `/pogoda/pomysly?idea=<id>` w opisie; wymaga `module.tasks`.
      *Gotowe, gdy:* po kliknięciu zadanie jest w `/tasks`, a przycisk nie renderuje się bez
      uprawnienia. **(AC-20)**

- [ ] **T-20** — **`IdeasPanel.tsx`** — zastępuje dotychczasowy blok „Co robić?": chipy dnia/pory i
      „Wylosuj inną" zostają, kafelek propozycji ma tytuł, ikonę kategorii, uzasadnienie, znacznik
      **„Już rozważana"** i akcje *Szczegóły / Zapisz / Nie proponuj*. Stany pusty i błędu po polsku
      z „Spróbuj ponownie". Link „Pomysły" do biblioteki w nagłówku kafla.
      *Gotowe, gdy:* lista renderuje się na desktopie i mobile, blokowanie działa prosto z kafelka.
      **(AC-10, AC-15, AC-16, AC-21)**

- [ ] **T-21** — **`IdeaDetailSheet.tsx`** — desktop: panel obok listy; mobile: pełnoekranowy arkusz
      (`fixed inset-0`, `env(safe-area-inset-bottom)`, „Wróć", `Esc` zamyka). Treść przez
      `markdownToHtml` + `MARKDOWN_STYLES`. Stopka: „Generuj ponownie", „Dodaj do zadań", „Zapisz",
      `AiCostBadge`.
      *Gotowe, gdy:* szczegóły otwierają się jednym dotknięciem i wracają po restarcie aplikacji.
      **(AC-12, AC-13, AC-14)**

- [ ] **T-22** — **Biblioteka pomysłów** — `src/app/pogoda/pomysly/page.tsx` (server wrapper) +
      `IdeaLibraryPage.tsx` (client): filtry Wszystkie / Zapisane / Rozważane / Zablokowane, filtr
      lokalizacji, akcje otwórz / zapisz / przywróć / zablokuj / usuń. Chroniona przez istniejące
      `permissionForPath("/pogoda")`.
      *Gotowe, gdy:* wszystkie filtry i akcje działają, a strona jest niedostępna bez `module.weather`.
      **(AC-17, AC-18)**

## Faza 6 — Licznik kosztów w całej aplikacji

- [ ] **T-23** — **Pogoda.** `describeDay` i `evaluateWatchers` zwracają `{…, usage}`; `getIdeas`,
      `generateIdeaDetail`, `getIdeaDetail` (z `detailUsage`) też. Wpięcie `AiCostBadge` pod poradą,
      pod listą propozycji, w stopce szczegółów i w nagłówku panelu obserwatorów.
      *Gotowe, gdy:* każda treść AI w Pogodzie ma licznik, a jego rozwinięcie pokazuje model, tokeny i
      koszt. **(AC-22, AC-23)**

- [ ] **T-24** — **Jeden punkt w typowanym kliencie.** `post<T>` w `src/lib/llm-client.ts` zwraca
      `Promise<T & { usage?: AiUsageInfo }>`.
      *Gotowe, gdy:* wszystkie namespace'y klienta widzą `usage` bez zmian w swoich definicjach.

- [ ] **T-25** — **Trasy `/api/llm/*` (17 plików)** — dołóż do odpowiedzi
      `usage: await visibleUsage(usageFromChat([{ res }]))`: notatki (4), zadania (4), kuchnia (3),
      magazynowanie (2), normalize, category-icons, category-hints, languages/extract.
      *Gotowe, gdy:* każda trasa zwraca `usage` dla admina i pomija je dla nie-admina.

- [ ] **T-26** — **Handlery zadań (9 plików)** — `usage` w `Job.result` dla kuchni (3), magazynu (4),
      `storesGenerate`, `petsInsights`; plus `actions/news.ts`.
      *Gotowe, gdy:* wynik zadania niesie zużycie, które UI może pokazać.

- [ ] **T-27** — **UI pozostałych modułów** — `AiCostBadge` przy treściach generowanych: Notatki
      (tagi, tytuł, przepisywanie, Q&A), Zadania (parsowanie, sugestie, tytuł, wyszukiwanie), Kuchnia
      (import/OCR, plan tygodnia, wygenerowany przepis), Magazyn (szukaj, wzbogacanie, dokument,
      analityka, zamówienie), Zakupy (normalizacja, ikony, podpowiedzi), Języki (ekstrakcja), Sklepy
      (układ), Pety (wnioski), Wiadomości.
      *Gotowe, gdy:* tabela z planu §5.5 jest odhaczona co do pozycji. **(AC-26)**

- [ ] **T-28** — **Asystent słucha przełącznika.** `/api/llm/home/{agent,briefing}` i `fastPath`
      przepuszczają zużycie przez `visibleUsage`, żeby wyłączenie licznika gasiło go także w czacie.
      *Gotowe, gdy:* po wyłączeniu przełącznika licznik znika również w oknie asystenta. **(AC-25)**

## Faza 7 — Bramka jakości

- [ ] **T-29** — **`scripts/check-cost-badge.js` + `src/lib/ai/cost-badge-coverage.json`** — skan
      `src/**` po `chatComplete(`/`chatStream(`; plik musi importować `visibleUsage`/`usageFromChat`
      albo mieć wpis z powodem w manifeście. Wpięcie w `build` i `npm run check:cost-badge`.
      *Gotowe, gdy:* celowo „gołe" wywołanie modelu wywala bramkę, a czyste repo ją przechodzi.
      **(AC-28)**

- [ ] **T-30** — **`src/lib/ai/action-coverage.json`** — klasyfikacja wszystkich nowych akcji
      (`access` + faktyczny guard): odczyty pomysłów, mutacje pomysłów, `addLocationByPoint`,
      `addIdeaToTasks`; `get/setCostBadgeEnabled` jako `excluded` z powodem „admin".
      *Gotowe, gdy:* `npm run check:ai-coverage` przechodzi.

## Faza 8 — Domknięcie

- [ ] **T-31** — **Pełna sekwencja bramek na lokalnym Postgresie (C-13):**
      `copy-docs → check:actions → check:ai-coverage → check:cost-badge → check:migrations →
      next lint → prisma generate → next build`. **Bez** `scripts/migrate.js`.
      *Gotowe, gdy:* wszystkie kroki zielone. **(C-50)**

- [ ] **T-32** — **Dokumentacja** — aktualizacja `CLAUDE.md` (tabela modułów: Pogoda; sekcja LLM:
      przełącznik licznika i nowa bramka; lista Server Actions; Route Structure o `/pogoda/pomysly`;
      schemat bazy o `WeatherIdea`).
      *Gotowe, gdy:* tabele i listy w `CLAUDE.md` opisują stan po zmianie.

- [ ] **T-33** — **`doświadczenia.md` (C-51)** — wpisy po polsku: (a) dlaczego obserwator „mokry
      weekend" pokazywał „Sprzyja" (źle postawione pytanie w prompcie, nie halucynacja modelu),
      (b) pułapka domyślnych ikon Leafletu po zbundlowaniu i `divIcon` jako rozwiązanie —
      **o ile problem faktycznie wystąpi**; plus wszystko, co wyjdzie po drodze.

- [ ] **T-34** — **Mapowanie AC → wynik** jako wejście do `/verify` (patrz tabela poniżej).

---

## Mapowanie kryteriów akceptacji na zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 mapa dostępna w wyborze lokalizacji | T-13, T-14 |
| AC-2 zapis punktu bez nazwy | T-10, T-11, T-14 |
| AC-3 start mapy na bieżącej lokalizacji | T-13 |
| AC-4 gesty i mobile | T-13 |
| AC-5 awaria kafelków | T-13 |
| AC-6 „Niespełnione" przy suchej prognozie | T-15 |
| AC-7 neutralna, zamknięta skala statusu | T-15 |
| AC-8 edycja obserwatora | T-2 |
| AC-9 brak nieaktualnej oceny po edycji | T-2, T-15 |
| AC-10 lista zamiast akapitu | T-16, T-20 |
| AC-11 propozycje miejscowe ~30 km | T-16 |
| AC-12 szczegóły: panel / arkusz | T-21 |
| AC-13 trwałość szczegółów | T-17, T-21 |
| AC-14 ponowna generacja | T-17, T-21 |
| AC-15 znacznik „już rozważana" | T-16, T-20 |
| AC-16 „nie proponuj" prosto z listy | T-16, T-18, T-20 |
| AC-17 biblioteka z filtrami | T-18, T-22 |
| AC-18 zarządzanie pozycjami | T-18, T-22 |
| AC-19 soft-delete do `/trash` | T-18 |
| AC-20 „dodaj do zadań" | T-19, T-21 |
| AC-21 stany pusty/błędu | T-20 |
| AC-22 licznik przy treści AI w Pogodzie | T-23 |
| AC-23 rozbicie kosztu dla admina | T-6, T-23 |
| AC-24 nie-admin nie dostaje szczegółów | T-7 |
| AC-25 globalny przełącznik + audyt | T-8, T-28 |
| AC-26 licznik w pozostałych modułach | T-24, T-25, T-26, T-27 |
| AC-27 „koszt nieznany" | T-6 (ścieżka `costKnown:false` już istnieje) |
| AC-28 bramka na nowe wywołania | T-29 |
| AC-29 kolejność sekcji | T-1 |

## Ścieżka krytyczna

`T-3/T-4/T-5` (dane) → `T-16..T-19` (akcje pomysłów) → `T-20..T-22` (UI pomysłów) → `T-31`.
Równolegle: `T-6/T-7` → `T-8`, `T-23..T-28` (koszty) oraz `T-10..T-14` (mapa).
`T-1`, `T-2`, `T-9` są niezależne od wszystkiego — dlatego idą pierwsze.
`T-29` wymaga T-25/T-26 (inaczej bramka od razu świeci na czerwono).

## Notatki / blokady
- (brak)
