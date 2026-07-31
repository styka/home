# Zadania: Pogoda — dopracowanie + przekrojowa pamięć treści AI

- **Plan:** ./plan.md (038-pogoda-pamiec-tresci-llm)
- **Status:** done
- **Data:** 2026-07-31

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie ≈ jeden commit, samodzielne i weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Naprawa u źródła (bez zmian schematu)

- [x] **T-1** — **Nie zapisuj do pamięci podręcznej odpowiedzi uciętej.** W `lib/llm/chat.ts` zmień
      zapis na warunkowy (`if (cacheKey && !res.truncated)`). To jedna linijka, ale naprawia klasę
      błędów u wszystkich konsumentów `cache: true` — bez niej każda ucięta odpowiedź utrwala się i
      wraca w nieskończoność.
      *Gotowe, gdy:* ucięta odpowiedź nie trafia do cache, a kolejne wywołanie idzie ponownie do modelu.

- [x] **T-2** — **Awaria generowania propozycji przestaje udawać pustą listę.** W `getIdeas`:
      podnieś `maxTokens` do 2000, potraktuj `res.truncated` **i** `parsed === null` jako błąd
      (`throw` z czytelnym komunikatem po polsku), zamiast `parsed?.ideas ?? []`.
      *Gotowe, gdy:* nieparsowalna albo ucięta odpowiedź kończy się komunikatem o niepowodzeniu.
      **(AC-2)**

- [x] **T-3** — **UI rozróżnia awarię od autentycznie pustej listy.** W `IdeasPanel` osobny stan
      błędu (z przyciskiem ponowienia) i osobny stan „model nie zaproponował nic" — dziś oba
      pokazują „Brak propozycji na tę porę".
      *Gotowe, gdy:* przy błędzie widać, że coś się nie powiodło, a nie że nie ma pomysłów.
      **(AC-1, AC-2, AC-3)**

## Faza 1 — Fundament danych

- [x] **T-4** — **Migracja `0216_pamiec_tresci_ai_i_nasiona_pomyslow`.** DDL wg planu §2.3: tabela
      `AiContent` (FK do `User` `ON DELETE CASCADE`, `UNIQUE (ownerId, kind, scopeKey)`,
      `INDEX (ownerId, kind)`) + trzy kolumny `NULL` w `WeatherIdea` (`seedDate`, `seedPart`,
      `seedWeather`).
      *Gotowe, gdy:* `npm run check:migrations` przechodzi, `npx prisma migrate deploy` na lokalnym
      Postgresie kończy się czysto.

- [x] **T-5** — **`schema.prisma`** zgodnie z migracją: model `AiContent` + relacja `aiContents`
      w `User` + kolumny nasion w `WeatherIdea`. Rodzaje jako `String` (C-12).
      *Gotowe, gdy:* `prisma generate` przechodzi, a `migrate diff` nie pokazuje rozjazdu dla nowych
      obiektów.

## Faza 2 — Mechanizm pamięci treści

- [x] **T-6** — **`src/lib/ai/contentMemory.ts`** — typ `AiContentKind` (String+union),
      `hashInputs(...)` (stabilny skrót), `rememberedContent({ownerId, kind, scopeKey, inputHash,
      force, generate})` zwracające `{value, generatedAt, stale, fromMemory, refreshes, usage}`.
      Uszkodzony wpis JSON traktowany jak brak wpisu.
      *Gotowe, gdy:* zapamiętana treść wraca **bez** wywołania modelu, a `force` wymusza nową i
      podbija `refreshes`. **(AC-4, AC-5, AC-6)**

- [x] **T-7** `[P]` — **Manifest + bramka.** `src/lib/ai/content-memory-coverage.json`
      (klasyfikacja każdego pliku wołającego model: `remembered` / `on-demand` + powód) oraz
      `scripts/check-content-memory.js` (wzorzec `check-cost-badge.js`), wpięte w `build` i jako
      `npm run check:content-memory`.
      *Gotowe, gdy:* nowa, niesklasyfikowana treść prezentowana wywala bramkę; czyste repo ją
      przechodzi. **(AC-9)**

## Faza 3 — Pogoda: pamięć, nasiona, jeden przycisk

- [x] **T-8** — **`getIdeas` przez pamięć treści.** `variation` → `force`; `scopeKey` z lokalizacji,
      dnia i pory; `inputHash` z **zaokrąglonej** prognozy + list zablokowanych i zapisanych;
      zwracane `generatedAt`, `stale`, `fromMemory`. Do promptu dołóż `AssistantPref.instructions` i
      tytuły zapisanych pomysłów (namiastka bazy wiedzy).
      *Gotowe, gdy:* powrót na stronę i przełączenie na znane parametry nie tworzą wpisu w `AiCall`.
      **(AC-4, AC-5, AC-6)**

- [x] **T-9** — **Nasiona propozycji + zapis z listy bez kosztu.** `saveIdeaFromList(idea, ctx)` —
      `upsert` ze `state:"saved"` i zapisem `seedDate`/`seedPart`/`seedWeather`, **zero** wywołań
      modelu. `generateIdeaDetail` korzysta z `seedWeather`, gdy istnieje, zamiast bieżącej prognozy,
      i przechodzi przez pamięć treści (`weather.ideaDetail`).
      *Gotowe, gdy:* zapis z listy nie kosztuje, a opis wygenerowany później opisuje pogodę z chwili
      zaproponowania. **(AC-10, AC-11, AC-12)**

- [x] **T-10** — **Jeden przycisk generowania w kaflu „Co robić?".** Jeden przycisk „Nowe
      propozycje" (`RefreshCw`) wołający `force`; biblioteka jako odnośnik tekstowy „Zapisane
      pomysły →" w stopce; linijka stanu „wygenerowano <kiedy>" + znacznik „nieaktualne — prognoza
      się zmieniła"; przycisk zapisu przy każdej pozycji listy.
      *Gotowe, gdy:* w nagłówku jest dokładnie jeden przycisk generujący, a użytkownik widzi, że
      treść pochodzi z pamięci. **(AC-7, AC-8, AC-10)**

## Faza 4 — Pogoda: dane i ikony

- [x] **T-11** `[P]` — **`src/lib/weather/moon.ts` + test.** Czysta `moonPhase(date)` →
      `{fraction, name, emoji}`, osiem polskich nazw faz; `moon.test.ts` na znanych datach nowiu i
      pełni (`npm run test:unit`).
      *Gotowe, gdy:* test przechodzi dla co najmniej dwóch nowiów i dwóch pełni. **(AC-13)**

- [x] **T-12** — **Ikony dnia i nocy.** `is_day` w parametrach godzinowych zapytania,
      `HourPoint.isDay`, `wmo(code, isNight?)` z wariantami nocnymi **tylko** dla kodów słonecznych
      (0–2). `ForecastNow` używa istniejącego, dziś nieużywanego `current.isDay`.
      *Gotowe, gdy:* godzina nocna ma ikonę nocną, a deszcz i śnieg wyglądają tak samo o każdej porze.
      **(AC-15, AC-16)**

- [x] **T-13** — **Pasek astronomiczny** w `ForecastNow`, zawijający się na telefonie. *(Korekta
      z implementacji, C-54: zapowiadana akcja `getWeatherAstro` okazała się zbędna — `sunrise`/
      `sunset` są już w pobranym obiekcie prognozy, a faza księżyca to czysta funkcja z daty.)*
      *Gotowe, gdy:* widać godziny wschodu i zachodu oraz polską nazwę fazy, bez przewijania w
      poziomie na telefonie. **(AC-13, AC-14)**

## Faza 5 — Mobile

- [x] **T-14** `[P]` — **Kafelek obserwatora na telefonie.** Tytuł w osobnym wierszu z zawijaniem,
      pod nim wiersz znaczników (status + horyzont), akcje z celami `p-2`.
      *Gotowe, gdy:* długi tytuł obserwatora jest czytelny w całości na wąskim ekranie. **(AC-17)**

- [x] **T-15** `[P]` — **Górny margines bezpieczny arkusza szczegółów.** Nagłówek
      `IdeaDetailSheet` dostaje `pt-[max(0.75rem,env(safe-area-inset-top))]` (dolny już jest —
      brakowało wyłącznie górnego).
      *Gotowe, gdy:* „Wróć do listy" i tytuł są w całości pod paskiem systemowym. **(AC-18)**

- [x] **T-16** `[P]` — **Spójność biblioteki pomysłów** ze wzorcem podstron modułu (szerokość,
      odstępy, nagłówek z powrotem) — porównanie z `/portfel/budzety` i `/warsztaty/przeglady`.
      *Gotowe, gdy:* strona wygląda jak reszta podstron, także na telefonie. **(AC-19)**

## Faza 6 — Pamięć treści w pozostałych modułach

- [x] **T-17** — **Wnioski Magazynu i Petów przez pamięć treści** (`storage.insights`,
      `pets.insights`) + w UI data powstania i przycisk odświeżenia.
      *Gotowe, gdy:* powrót na ekran pokazuje zapamiętane wnioski bez nowego wywołania modelu.
      **(AC-8)**

- [x] **T-18** — **Plan tygodnia Kuchni przez pamięć treści** (`kitchen.planWeek`), analogicznie.
      *Gotowe, gdy:* jw. **(AC-8)**

- [x] **T-19** — **Klasyfikacja w manifestach.** `content-memory-coverage.json` — komplet wywołań
      modelu; `action-coverage.json` — nowe akcje (`saveIdeaFromList`, `getWeatherAstro`) z `access`
      i guardem.
      *Gotowe, gdy:* `npm run check:content-memory` i `npm run check:ai-coverage` przechodzą.

## Faza 7 — Domknięcie

- [x] **T-20** — **Pełna sekwencja bramek na lokalnym Postgresie (C-13):** `copy-docs →
      check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
      check:migrations → next lint → prisma generate → next build` + `npm run test:unit`.
      **Bez** `scripts/migrate.js`.
      *Gotowe, gdy:* wszystkie kroki zielone. **(C-50)**

- [x] **T-21** — **Dokumentacja** — `CLAUDE.md`: tabela modułów (Pogoda), schemat bazy (`AiContent`),
      lista Server Actions, opis nowej bramki w build pipeline.
      *Gotowe, gdy:* dokumentacja opisuje stan po zmianie.

- [x] **T-22** — **`doświadczenia.md` (C-51)** — wpis o utrwalaniu uciętej odpowiedzi w pamięci
      podręcznej (dlaczego „ponad 5 razy, za każdym razem pusto" wyglądało na deterministyczny brak
      pomysłów) oraz o zamienianiu awarii w pusty wynik; plus wszystko, co wyjdzie po drodze.

- [x] **T-23** — **Mapowanie AC → wynik** jako wejście do `/verify`.

---

## Mapowanie kryteriów akceptacji na zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 lista dla każdej pory, także nocnej | T-2, T-3 |
| AC-2 awaria ≠ „brak propozycji" | T-1, T-2, T-3 |
| AC-3 pora, która minęła | T-3 |
| AC-4 powrót bez kosztu | T-6, T-8 |
| AC-5 zmiana na znane parametry bez kosztu | T-6, T-8 |
| AC-6 oznaczenie nieaktualności, bez samoczynnej generacji | T-6, T-8, T-10 |
| AC-7 jeden przycisk generowania | T-10 |
| AC-8 pamięć w innych modułach + data + odświeżenie | T-10, T-17, T-18 |
| AC-9 bramka na nowe treści | T-7 |
| AC-10 zapis z listy bez kosztu | T-9, T-10 |
| AC-11 opis przy pierwszym wejściu | T-9 |
| AC-12 opis z warunków z chwili zaproponowania | T-9 |
| AC-13 wschód/zachód + faza księżyca | T-11, T-13 |
| AC-14 mieści się na telefonie | T-13 |
| AC-15 ikony nocne w pasku godzin | T-12 |
| AC-16 ikona nocna w „Teraz" | T-12 |
| AC-17 kafelek obserwatora na telefonie | T-14 |
| AC-18 górny margines bezpieczny | T-15 |
| AC-19 spójność biblioteki pomysłów | T-16 |

## Ścieżka krytyczna

`T-4/T-5` (dane) → `T-6` (mechanizm) → `T-8/T-9` (Pogoda) → `T-10` (UI) → `T-20`.
`T-7` (bramka) wymaga `T-6` i musi być **po** `T-17`/`T-18`, inaczej od razu świeci na czerwono —
dlatego klasyfikację domyka `T-19`.
`T-1`, `T-2`, `T-3` są niezależne od reszty i naprawiają zgłoszony błąd — dlatego idą pierwsze.
`T-11`, `T-14`, `T-15`, `T-16` nie zależą od niczego i mogą iść równolegle.

## Notatki / blokady
- (brak)
