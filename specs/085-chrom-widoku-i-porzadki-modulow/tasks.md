# Zadania: Chrom widoku przy koncie, przyklejone akcje strony i porządki w Wiadomościach i Pogodzie

- **Plan:** ./plan.md (085-chrom-widoku-i-porzadki-modulow)
- **Status:** todo
- **Data:** 2026-08-24

> Kolejność: od najłatwiejszego i najbardziej niezależnego do zmian dotykających całej powłoki.
> Świadomie **najpierw dwa moduły** (Wiadomości, Pogoda), a **dopiero potem rama i chrom** — moduły
> są zamknięte w swoich plikach i dają się sprawdzić od razu, a przebudowa ramy dotyka 41 widoków
> i chcemy ją robić w repozytorium, w którym nic innego nie jest w połowie zrobione.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Punkt odniesienia i fundament danych

- [x] **T-1** — **Pomiar PRZED zmianą** (bez tego nie da się dowieść AC-4, AC-5, AC-21). Klikaczem,
  przy 360 px i na komputerze, zapisz: czy pasek widoku jest widoczny po przewinięciu o 800 px na
  `/pogoda` i `/wiadomosci`; wysokość paska sterowania obserwatorami; pozycję górnej krawędzi
  powiadomienia o koszcie.
  *Gotowe, gdy:* liczby zapisane w `verify.md` jako punkt odniesienia, nie „widziałem, że nie działa".

- [x] **T-2** — **Migracja `0257_news_show_empty_topics`** (plan §2): `NewsPref.showEmptyTopics`
  dodane idempotentnie, `WeatherPref.watchersFilter` skasowane idempotentnie.
  *Gotowe, gdy:* `npm run check:migrations` zielone, migracja zaaplikowana na LOKALNYM Postgresie (C-13).

- [x] **T-3** — **`schema.prisma`** zsynchronizowany z migracją.
  *Gotowe, gdy:* `npm run check:schema-drift` zielone i `prisma generate` przechodzi.

## Faza 1 — Warstwa serwera

- [x] **T-4** — **Wiadomości: preferencja pustych tematów.** `getNewsPrefs` zwraca `showEmptyTopics`;
  nowa `setShowEmptyTopics(show)` wzorem `setDefaultSummaryLength` (upsert po `filtrMoichRekordow`,
  zapis przez `wlasnoscOsobistaDoZapisu`, `revalidatePath("/wiadomosci")`).
  *Gotowe, gdy:* akcja zapisuje i odczytuje wartość dla właściciela, `tsc` czysto.

- [x] **T-5** — **Wpis w `src/lib/ai/action-coverage.json`** dla `setShowEmptyTopics` (klasyfikacja
  ekspozycji + `access`). Bez tego bramka wywali build.
  *Gotowe, gdy:* `npm run check:actions` i `npm run check:ai-coverage` zielone.

- [x] **T-6** `[P]` — **Pogoda: koniec filtra w preferencji.** `WeatherPrefDTO` bez `watchersFilter`,
  `setWatchersView` przyjmuje tylko `{ layout }`, martwe helpery `czytajFiltr`/`zapiszFiltr` usunięte.
  *Gotowe, gdy:* `tsc` czysto, `npm run check:owner-columns` zielone (kolumna zniknęła też z zapytań).

## Faza 2 — Moduł Wiadomości *(AC-14..AC-17)*

- [x] **T-7** — **Odsiew pustych tematów w widoku.** `widoczneWiadomosci`/`widocznaOs` i lista `grupy`
  dla nawigatora liczone z JEDNEGO odsianego zbioru — lista skoku i treść nie mogą się rozjechać.
  *Gotowe, gdy:* temat bez pozycji znika z obu miejsc naraz, a po włączeniu przełącznika wraca do obu.

- [x] **T-8** — **Pustka, gdy odsialiśmy wszystko** (AC-16): komunikat „nic nowego, odśwież" przez
  `state`/`empty` ramy, nie ręcznie rysowany blok (C-33).
  *Gotowe, gdy:* przy wszystkich tematach pustych widok mówi, co się stało, i daje wyjście.

- [x] **T-9** — **Czwarta zakładka: „Ustawienia".** Klucz stanu widoku rozszerzony o `sources`;
  `NewsSettings` zostaje samą listą źródeł; nowy `NewsModuleSettings` niesie długość streszczeń
  (przeniesiona 1:1) + przełącznik pustych tematów.
  *Gotowe, gdy:* „Źródła" nie zawierają ustawień, „Ustawienia" zawierają oba, oba zapisują się do bazy.

## Faza 3 — Moduł Pogoda *(AC-18..AC-23)*

- [x] **T-10** — **Chipsy filtra statusów usunięte** (AC-22): stan filtra, przełączanie, komunikat
  „filtr nic nie zostawił" i osierocone klucze tekstów. Liczby stanów zostają w układzie „sekcje".
  *Gotowe, gdy:* w sekcji obserwatorów nie ma ani jednego chipa, a liczniki nadal da się zobaczyć.

- [x] **T-11** — **Jeden pasek NAD listą obserwatorów** (AC-18, AC-19): układ listy po lewej,
  `AiContentMeta` po prawej, z **kompletem** dotychczasowych propsów; blok na dole znika.
  *Gotowe, gdy:* porównanie propsów `AiContentMeta` przed/po pokazuje zero ubytków.

- [x] **T-12** — **Nazwa ponownej analizy** (AC-20): `refreshLabel` przestaje brzmieć „Oceń ponownie".
  *Gotowe, gdy:* etykieta mówi, co się stanie, i mieści się w pasku.

- [x] **T-13** — **Wybór „nowe propozycje / zapisane pomysły" u góry sekcji „Co robić?"** (AC-23),
  wzorem `ContentSwitch`; odnośnik ze stopki znika.
  *Gotowe, gdy:* oba wejścia widoczne bez przewijania.

- [ ] **T-14** — **Pomiar: pasek obserwatorów w jednym wierszu przy 360 px** (AC-21).
  *Gotowe, gdy:* zmierzona wysokość odpowiada jednemu wierszowi kontrolki, nie dwóm.

## Faza 4 — Tryb administratora *(AC-8..AC-13)*

- [x] **T-15** — **`kosztWidocznosc` → `platform/admin/trybAdmina`**: `TrybAdminaProvider` /
  `useTrybAdmina` (`dostepne`/`wlaczony`/`przelacz`), klucz `omnia.trybAdmina`, odczyt i zapis dalej
  w `try/catch`. `AiCostBadge` przepięty.
  *Gotowe, gdy:* koszty zachowują się jak dotąd, `npm run check:boundaries` zielone.

- [x] **T-16** — **`PrzelacznikKosztow` → `PrzelacznikTrybuAdmina`**: nazwa, etykiety, ikona.
  Dostępność = `isAdmin` (`src/app/layout.tsx`), niezależnie od systemowego wyłącznika kosztów —
  uzasadnienie w planie §4.
  *Gotowe, gdy:* administrator z wyłączonym `ai_cost_badge_enabled` nadal może przełączać tryb.

- [x] **T-17** — **Pod przełącznik wchodzą trzy pozostałe elementy** (AC-8): `KosztToasts`,
  `FeedbackInspector` (**przycisk i skrót `Ctrl+Shift+B`** — ukryte narzędzie, które daje się odpalić,
  wygląda na usterkę) oraz `TaskListClipboardButton`.
  *Gotowe, gdy:* z wyłączonym trybem żaden z nich nie istnieje w drzewie, a przełącznik i „Admin" są.

- [x] **T-18** `[P]` — **Powiadomienia o koszcie** (AC-12, AC-13): `env(safe-area-inset-top)`,
  wjazd/wygaszanie tokenami skórki, kliknięcie zamyka wpis (`pointer-events` zdjęte z kafelków,
  zostają na kontenerze).
  *Gotowe, gdy:* pomiar pokazuje górną krawędź poniżej wcięcia, a kafelek daje się zamknąć.

## Faza 5 — Chrom konta i rama widoku *(AC-1..AC-7)*

- [x] **T-19** — **`NotificationBell`: wariant `chrome`.** Rozdzielenie dwóch dziś sklejonych decyzji
  (kształt wiersz/ikona · kierunek panelu góra/dół).
  *Gotowe, gdy:* `sidebar` i `topbar` wyglądają i działają dokładnie jak przed zmianą, a `chrome` to
  ikona z panelem otwieranym w górę.

- [x] **T-20** — **Rząd chromu w stopce panelu bocznego** (AC-1, desktop): dzwonek, gwiazdka,
  ściągawka skrótów, tryb administratora. `PrzelacznikTrybuAdmina` wyprowadzony z nagłówka sekcji
  „Ulubione".
  *Gotowe, gdy:* na komputerze wszystkie cztery stoją w jednym rzędzie i działają.

- [x] **T-21** — **Gwiazdka w górnym pasku telefonu** (AC-1, mobile) obok dzwonka i przełącznika.
  *Gotowe, gdy:* zapis i odznaczenie widoku działa z telefonu, także na `/admin` (AC-3).

- [x] **T-22** — **Koniec wstrzykiwania chromu do paska widoku** (AC-2, AC-6, AC-7):
  `ViewChromeProvider`/`useViewChrome` i `ViewChromeMenu` usunięte (`ViewResource` **zostaje**),
  `ViewBar` bez `hideChrome`, `FreshnessIndicator` + `dataFreshnessBus` + wywołanie
  `notifyDataRefreshed` skasowane (samo odświeżanie w tle **zostaje**), `FavoriteStarButton` bez
  martwych wariantów `viewbar`/`viewbar-inline`, re-eksporty i playground posprzątane.
  *Gotowe, gdy:* w obszarze treści nie ma ani jednego wejścia do zapisu widoku, `tsc` i
  `check:ui-contract` zielone.

- [x] **T-23** — **Przyklejony pasek widoku** (AC-4, AC-5) — najtrudniejsze zadanie przebiegu.
  Przebudowa `ModuleView`: blok nagłówka i `ViewBar` stają się osobnymi, **bezpośrednimi** dziećmi
  kontenera przewijania; pasek dostaje `sticky`, tło ramy i dolną krawędź; wysokość publikowana jako
  `--view-bar-h`. Układ `fill` bez zmian.
  *Gotowe, gdy:* po przewinięciu o 800 px pasek widoczny na `/pogoda` (comfortable) i `/wiadomosci`
  (compact), odstępy niezmienione, `scrollRef` nadal wskazuje element, który się przewija.

- [x] **T-24** — **Wiadomości: własny przyklejony pasek pod paskiem widoku.** `top` paska nawigacji
  i nagłówków sekcji liczone z `--view-bar-h`; zasłona do przewijania mierzona **jedną** miarą
  (dolna krawędź paska względem góry ramy) zamiast sumy dwóch.
  *Gotowe, gdy:* pasek nawigacji nie nachodzi na pasek widoku, a skok do tematu ląduje pod oboma.

- [ ] **T-25** — **Przegląd widoków nietypowych** (AC-5): `compact` (Zadania, Zakupy, Notatki,
  Wiadomości), `width="narrow"`, `breadcrumb`, listy wirtualizowane (Kontakty, Magazynowanie).
  *Gotowe, gdy:* w żadnym z nich nie ma podwójnego nagłówka, ucieczki w poziomie ani treści schowanej
  pod paskiem.

## Faza 6 — Teksty, testy, dokumentacja

- [ ] **T-26** — **`messages/pl.json`**: nowe klucze, usunięcie osieroconych (menu chromu, świeżość,
  stary przełącznik, komunikat filtra obserwatorów).
  *Gotowe, gdy:* `npm run check:i18n` zielone — zero literałów i każdy `t()` się rozwiązuje.

- [ ] **T-27** — **Klikacz: `e2e/specs/chrom-konta.spec.ts`** (AC-1..AC-5, AC-8..AC-11).
  *Gotowe, gdy:* testy zielone i sprawdzone **w obie strony** dla AC-4 i AC-8.

- [ ] **T-28** `[P]` — **Klikacz: `e2e/specs/pogoda-obserwatory-pasek.spec.ts`** (AC-18, AC-21, AC-22).
  *Gotowe, gdy:* zielone i sprawdzone w obie strony dla AC-22.

- [ ] **T-29** `[P]` — **Poprawki istniejących specyfikacji klikacza** po przeprowadzce gwiazdki
  (`favorites`, `shortcuts`, `view-state`, helper `e2e/pages/chromWidoku.ts`).
  *Gotowe, gdy:* pełna suita bez czerwonych z powodu selektorów.

- [ ] **T-30** — **`CLAUDE.md` i `.claude/spec-pipeline/constitution.md` (C-33)**: opis kontraktu
  widoku mówi dziś, że powłoka wstrzykuje chrom przez `ViewChromeProvider` — po tej zmianie to
  nieprawda. Zaktualizować oba, opisać chrom konta, przyklejony pasek, tryb administratora i nowe
  zakładki Wiadomości.
  *Gotowe, gdy:* żaden z tych dokumentów nie opisuje mechanizmu, którego nie ma.

## Faza 7 — Bramki i domknięcie

- [ ] **T-31** — **Pełny przebieg bramek** na lokalnym Postgresie (C-13): wszystkie `check:*`,
  `tsc` ×2, `next lint`, `next build`, budżet wydajnościowy, testy jednostkowe.
  *Gotowe, gdy:* wszystko zielone; każdy czerwony punkt naprawiony, nie obejściem.

- [ ] **T-32** — **Weryfikacja w przeglądarce**: pełna suita klikacza + pomiary z T-1 powtórzone i
  porównane.
  *Gotowe, gdy:* liczby zapisane, zero regresji.

- [ ] **T-33** — **`doświadczenia.md`** (C-51): co najmniej wpis o pułapce `position: sticky`
  w zagnieżdżonym opakowaniu (przykleja się tylko w granicach rodzica) — to jest nieoczywisty problem
  tego przebiegu.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 gwiazdka w chromie konta | T-20, T-21 | AC-13 powiadomienie jak toast | T-18 |
| AC-2 jedno wejście do zapisu | T-22 | AC-14 puste tematy ukryte | T-7 |
| AC-3 działa poza ramą modułu | T-21 | AC-15 przełącznik przywraca | T-9 |
| AC-4 pasek przyklejony | T-23 (dowód: T-1, T-32) | AC-16 komunikat przy pustce | T-8 |
| AC-5 zero rozpychania na 360 px | T-23, T-25 | AC-17 ustawienia poza źródłami | T-9 |
| AC-6 koniec wskaźnika świeżości | T-22 | AC-18 jeden pasek obserwatorów | T-11 |
| AC-7 ściągawka nie ginie | T-20, T-22 | AC-19 żadna funkcja nie zginęła | T-11 |
| AC-8 tryb ukrywa dodatki | T-15, T-17 | AC-20 zrozumiała nazwa analizy | T-12 |
| AC-9 przełącznik zostaje | T-16, T-17 | AC-21 pasek w jednym wierszu | T-14 |
| AC-10 wszystko wraca | T-15, T-16 | AC-22 koniec chipsów | T-10 |
| AC-11 nie-admin bez zmian | T-16 | AC-23 widoczny wybór pomysłów | T-13 |
| AC-12 powiadomienie pod wcięciem | T-18 | | |

## Ścieżka krytyczna

- `T-2 → T-3 → T-4 → T-9` (kolumna musi istnieć, zanim ją odczytamy i pokażemy w ustawieniach).
- `T-7 → T-8` (najpierw odsiew, potem pustka, którą odsiew tworzy).
- `T-10 → T-11` (chipsy znikają, zanim ich miejsce zajmie scalony pasek).
- `T-15 → T-16 → T-17` (kontekst → przełącznik → konsumenci).
- `T-19 → T-20` (wariant dzwonka przed rzędem, w którym stoi).
- **`T-22 → T-23 → T-24 → T-25`** — najtrudniejszy odcinek: najpierw pasek traci chrom, potem
  zyskuje przyklejenie, potem Wiadomości ustawiają się względem niego, na końcu przegląd reszty.
- Wszystko → `T-26` → `T-27..T-29` → `T-30` → `T-31` → `T-32` → `T-33`.
- Równolegle: `T-6 ∥ T-4/T-5`, `T-18 ∥ T-15..T-17`, `T-28 ∥ T-29`.

## Notatki / blokady

- **T-23 jest miejscem najwyższego ryzyka przebiegu.** Dotyka 41 z 44 widoków, a błąd nie objawia się
  wyjątkiem, tylko wyglądem — dlatego T-25 (przegląd nietypowych) jest osobnym zadaniem, a nie
  „sprawdzeniem przy okazji". Jeśli pomiar w T-32 pokaże poziome przewijanie albo treść pod paskiem,
  wracamy do T-23, a nie zapisujemy tego jako drobiazg.
- **T-29 dotknie testów, które już dziś są wrażliwe na wyścig** o ulubione wspólnego konta (znane
  ograniczenie z 084). Rozróżniaj: czerwony z powodu selektora = do naprawy tutaj; czerwony
  migoczący, zielony w izolacji = zastany wyścig, raportowany, nie ścigany w tym przebiegu.
- **T-30 nie jest kosmetyką.** Konstytucja w C-33 opisuje wprost mechanizm, który to zadanie usuwa —
  zostawienie tego rozjazdu złamałoby C-54.
