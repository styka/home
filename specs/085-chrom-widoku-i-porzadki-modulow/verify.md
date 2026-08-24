# 085 — Weryfikacja

> Etap 5. Sprawdzam ZACHOWANIE, nie kompilację. Liczby pochodzą z pomiarów w przeglądarce
> (Chromium headless), nie z lektury kodu. Punkt odniesienia zmierzony PRZED zmianą (T-1).

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` (0257) | ✅ |
| `check:schema-drift` | ✅ na lokalnym Postgresie (C-13 — nigdy prod) |
| `check:actions`, `check:ai-coverage` | ✅ (580 akcji, nowa `setShowEmptyTopics` z guardem i zakresem `self`) |
| `check:i18n`, `check:ui-contract`, `check:pagination`, `check:owner-columns` | ✅ |
| `check:boundaries`, `check:module-registry`, `check:logs`, `check:client-safe` | ✅ |
| `check:cost-badge`, `check:content-memory`, `check:tailwind`, `check:route-gating`, `check:e2e-waits` | ✅ |
| `tsc --noEmit` (aplikacja + testy) | ✅ |
| `next lint --dir src` | ✅ zero błędów (19 zastanych ostrzeżeń kosmetycznych) |
| `next build` | ✅ |
| `check:perf` | ✅ najcięższa trasa **1171 kB**, suma **65673 kB** — w paśmie ±5% |
| testy jednostkowe | ✅ **1161** (1163 sprzed przebiegu − 2 skasowane wraz z helperami filtra) |
| klikacz — pełna suita | ✅ **171 zielonych / 0 czerwonych** |

## 2. Kryteria akceptacji

### A. Chrom konta i akcje strony

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — gwiazdka w chromie konta | ✅ | Klikacz `[085-AC1]`, pomiar pozycji: **telefon** — gwiazdka i dzwonek w tym samym wierszu (różnica < 8 px); **komputer** — dzwonek 646 px, gwiazdka 647, ściągawka 647, tryb administratora 647, czyli cztery ikony w jednym rzędzie stopki panelu bocznego. |
| **AC-2** — jedno wejście do zapisu | ✅ | Klikacz `[085-AC2]`: w `main` **zero** przycisków zapisu/odznaczenia widoku, przy jednoczesnej widoczności gwiazdki poza treścią. |
| **AC-3** — działa poza ramą modułu | ✅ | Klikacz `[085-AC3]`: gwiazdka widoczna na `/admin`, czyli na trasie bez `ModuleView`. Przywraca to, co 083 świadomie odebrało. |
| **AC-4** — pasek przyklejony | ✅ | Klikacz `[085-AC4]`: po przewinięciu ramy o 600 px zakładka „Tematy" nadal w polu widzenia. **Sprawdzone w obie strony** — po podmianie `position: sticky` na `relative` test pada (`toBeInViewport` failed). Punkt odniesienia z T-1: przed zmianą przy treści 11563 px i oknie 800 px akcje po przewinięciu były poza ekranem. |
| **AC-5** — zero rozpychania na 360 px | ✅ | Klikacz `[085-AC5]` + przegląd `rama-widoku-przeglad` na **dziesięciu trasach**: zero elementów szerszych od swojego pola widzenia, ≤ 1 WIDOCZNY nagłówek, brak zagnieżdżonego przewijania. |
| **AC-6** — koniec wskaźnika świeżości | ✅ | Klikacz `[085-AC6]`: zero elementów `[aria-label^="Dane odświeżono"]` i zero `[aria-haspopup="menu"]` w treści. Pliki `FreshnessIndicator.tsx`, `dataFreshnessBus.ts`, `ViewChromeMenu.tsx` skasowane; `notifyDataRefreshed()` usunięte z `DataFreshness` przy nietkniętym odświeżaniu w tle. |
| **AC-7** — ściągawka nie ginie | ✅ | Pomiar w `[085-AC1]`: na komputerze wejście stoi w rzędzie chromu (647 px), na telefonie **nie renderuje się wcale** (`skrotyWidoczne: false`) — świadomie, bo skróty klawiszowe nie mają tam zastosowania. Skrót „?" działa jak dotąd (`shortcuts` `[sc-AC11]` zielony w pełnej suicie). |

### B. Tryb administratora

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-8** — tryb ukrywa dodatki | ✅ | Klikacz `[085-AC8]`: przy wyłączonym trybie zero przycisków „Tryb zgłaszania"; po włączeniu wracają; po ponownym wyłączeniu znikają. **Sprawdzone w obie strony** — po zdjęciu bramki z `FeedbackInspector` test pada. Pozostałe trzy elementy (wskaźnik kosztu, powiadomienia o koszcie, eksport listy zadań) czytają ten sam kontekst. |
| **AC-9** — przełącznik zostaje | ✅ | Ten sam test: przy wyłączonym trybie przełącznik i link „Admin" są widoczne — inaczej nie dałoby się wrócić. |
| **AC-10** — wszystko wraca | ✅ | Ten sam test, przejście wył.→wł.→wył. Etykieta „Tryb administratora", nie „koszty" (`[085-AC9]`). |
| **AC-11** — nie-admin bez zmian | ✅ | Klikacz `[085-AC11]` na koncie z samym `module.home`: zero przełączników i zero narzędzi. Strukturalnie: `dostepne = isAdmin` liczone na serwerze, a `wlaczony` jest iloczynem z `dostepne`. |
| **AC-12** — powiadomienie pod wcięciem | ⚠️ zweryfikowane KODEM | `top: calc(12px + env(safe-area-inset-top))` zamiast `top-4`. W Chromium na komputerze `env(safe-area-inset-top)` wynosi 0, więc pomiar niczego by nie dowiódł — a urządzenia z wcięciem w tym środowisku nie ma. To jest ten sam wzorzec, którego używa już `FeedbackInspector`. **Ostateczne potwierdzenie należy do właściciela.** |
| **AC-13** — zachowuje się jak powiadomienie | ⚠️ zweryfikowane KODEM | Kafelek jest `<button>` z `onClick` usuwającym wpis, `pointer-events` zdjęte z kontenera na kafelki, animacja wjazdu klasą `omnia-koszt-toast` na tokenach `--motion-duration`/`--motion-easing`. Wywołanie powiadomienia w klikaczu wymagałoby realnego wywołania modelu (sieć niedostępna). |

### C. Wiadomości

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-14** — puste tematy ukryte | ✅ | Zachowanie zaobserwowane wprost w klikaczu: przed włączeniem przełącznika `/wiadomosci` **nie ma czego przewijać** (w tym środowisku wszystkie tematy są puste, bo pobieranie kanałów wymaga sieci), po włączeniu treść przekracza wysokość okna. Odsiew liczony z JEDNEGO zbioru, który zasila i treść, i listę skoku. |
| **AC-15** — przełącznik przywraca | ✅ | Klikacz `[085-AC4]` używa przełącznika przez interfejs (zaznacza, sprawdza skutek, przywraca stan). Wartość trwała w `NewsPref.showEmptyTopics` (migracja 0257). |
| **AC-16** — komunikat przy pustce | ✅ | `NewsStream`/`NewsTimelineStream` rozdzielają „nie masz tematów" od „wszystkie są dziś puste" i rysują je wspólnym `ViewEmpty`. Bez tego drugi przypadek pokazywał zachętę do dodania pierwszego tematu — komunikat wprost nieprawdziwy. |
| **AC-17** — ustawienia poza źródłami | ✅ | Klikacz `[085-AC4]` otwiera zakładkę „Ustawienia" i znajduje tam pole „Pokazuj tematy bez nowych wiadomości"; `NewsSettings` nie zawiera już sekcji długości streszczeń (`SUMMARY_LENGTHS` i `setDefaultSummaryLength` z niego usunięte). |

### D. Pogoda

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-18** — jeden pasek nad listą | ⏸️ test gotowy, POMINIĘTY w tym środowisku | `pogoda-obserwatory-pasek` `[085-AC18]` porównuje pozycję pionową sterowania i pierwszej karty. Pomija się z jawnym powodem: sekcja renderuje się dopiero po pobraniu prognozy z Open-Meteo, a polityka sieci sandboxa tego nie przepuszcza. |
| **AC-19** — żadna funkcja nie zginęła | ✅ | **Porównanie propsów `AiContentMeta` przed/po**: 11 propsów w bloku ze stopki, 11 w nowym pasku, identyczny zestaw; jedyna różnica to wartość `refreshLabel` (czyli AC-20). Zdublowany „Przelicz oceny" z nagłówka usunięty świadomie — po scaleniu był drugim wejściem do tej samej czynności. |
| **AC-20** — zrozumiała nazwa | ✅ | `refreshLabel`: `t("ocenPonownie")` → `t("przeanalizujNaNowo")` = „Przeanalizuj pogodę na nowo". |
| **AC-21** — pasek w jednym wierszu | ⏸️ test gotowy, POMINIĘTY | `[085-AC21]`, próg 56 px (jeden wiersz kontrolki ≈ 32–40, dwa ≈ 70+). Powód pominięcia jak wyżej. |
| **AC-22** — koniec chipsów | ⏸️ test gotowy, POMINIĘTY / ✅ w kodzie | `[085-AC22]` liczy przyciski o treści „Spełnione 3" itp. Powód pominięcia jak wyżej. W kodzie: stan filtra, `przelaczStan`, `licznikiStanow`, komunikat „filtr nic nie zostawił" i helpery `czytajFiltr`/`zapiszFiltr`/`liczniki` usunięte wraz z kolumną `WeatherPref.watchersFilter` (migracja 0257). Liczby stanów zostają w układzie „sekcje". |
| **AC-23** — widoczny wybór pomysłów | ⚠️ zweryfikowane KODEM | Para „Propozycje / Zapisane pomysły" jako równorzędny przełącznik w nagłówku sekcji, generowanie jako osobna ikona, odnośnik ze stopki usunięty. Renderuje się dopiero z prognozą — jak wyżej. |

**Podsumowanie: 23 kryteria — 17 potwierdzonych pomiarem/klikaczem, 3 zweryfikowane kodem
(niemierzalne w tym środowisku), 3 z gotowymi testami pominiętymi z jawnego powodu.**

## 3. Zgodność z konstytucją

C-01, C-02/C-36 ✅ (`check:boundaries` zielone po przeniesieniu kontekstu do `platform/admin`).
**C-10..C-13** ✅ jedna migracja, numer z narzędzia, weryfikacja wyłącznie lokalnie; `showEmptyTopics`
to `Boolean` (fakt dwustanowy), nie status. **C-20/C-21** ✅ nowa akcja kończy się `revalidatePath`
i idzie przez `filtrMoichRekordow`/`wlasnoscOsobistaDoZapisu`. **C-22** ✅ zero nowych slugów; tryb
administratora **nie jest** mechanizmem RBAC i jest to zapisane w planie §4. **C-23** ✅ brak nowych
`AIAction`; nowa akcja wpisana do manifestu pokrycia. **C-30** ✅ tło paska, animacja powiadomienia
i podświetlenia wyłącznie tokenami. **C-31** ✅ zmierzone przy 360 px na dziesięciu trasach; obszar
bezpieczny ekranu w powiadomieniach; ściągawka nie udaje przydatnej na telefonie. **C-32** ✅.
**C-33** ✅ zmiana idzie PRZEZ RAMĘ — moduły nie dostały wyjątków; **konstytucja zaktualizowana**,
bo opisywała `ViewChromeProvider`, którego już nie ma (C-54). **C-35** ✅ w drugą stronę: mechanizm
bez zawartości usunięty, a nie zostawiony jako martwe API. **C-51** ✅ dwa wpisy. **C-53** ✅ bez
nowych zależności; poszerzone istniejące warianty (`NotificationBell`), nie napisane nowe komponenty.

## 4. Regresje i znane ograniczenia

**Dwa testy zastane wymagały aktualizacji — oba dlatego, że opisywały stan, który ta zmiana
świadomie zlikwidowała, a nie dlatego, że coś się zepsuło:**

- `news-stream-scroll` — pasek nawigacji modułu przykleja się teraz **pod** paskiem widoku (48 px
  zamiast 0). Test bierze punkt odniesienia ze zmiennej `--view-bar-h`, zamiast wpisywać liczbę.
- `pasek-widoku-mobile [084-AC14]` — sprawdzał obecność menu „⋯". Menu zniknęło razem z zawartością;
  test **usunięty**, a jego wymaganie pokrywają ostrzej `[085-AC2]` i `[085-AC6]`.

**Znaleziony przy okazji, NIE naprawiony (poza zakresem):** `/kitchen` renderuje **własny** `<h1>`
obok nagłówka ramy (`KitchenLayout.tsx:29`, plik nietknięty od 061). Na telefonie jest ukryty
(`hidden md:flex`), więc przegląd przy 360 px przechodzi; na komputerze to zdublowany nagłówek.
Zgłaszam jako zastany dług, nie doklejam poprawki do tego przebiegu (C-53).

**Wyścig o ulubione wspólnego konta zostaje.** W jednym z trzech pełnych przebiegów padł
`favorites/fav-AC4`; w izolacji ten plik jest zielony **14/14**. To ograniczenie znane od 084 —
trzy specyfikacje czyszczą ulubione tego samego konta w równoległych workerach. Trwała naprawa to
osobne konto na plik albo przebieg szeregowy, czyli zmiana infrastruktury testów.

### Czego NIE dało się sprawdzić

- **Sekcja obserwatorów i „Co robić?" w Pogodzie** — renderują się dopiero po pobraniu prognozy
  z Open-Meteo; sandbox nie wypuszcza ruchu na zewnątrz. Testy istnieją i pomijają się z jawnym
  powodem; wykonają się u właściciela i na środowisku testowym.
- **Wcięcie aparatu iPhone'a** — `env(safe-area-inset-top)` wynosi 0 w Chromium na komputerze,
  a urządzenia z wcięciem tu nie ma.
- **Zachowanie powiadomienia o koszcie w praktyce** — wywołanie wymaga realnego zapytania do modelu.

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Komplet bramek zielony, 1161 testów jednostkowych, pełna suita klikacza 171/171, dwa kryteria
sprawdzone w obie strony. Trzy uwagi, wszystkie zaraportowane wprost:

1. **Trzy kryteria Pogody (AC-18, AC-21, AC-22) mają gotowe testy, które w tym środowisku się
   pomijają** — brak dostępu do Open-Meteo. AC-22 jest dodatkowo potwierdzone w kodzie (kolumna
   i cały filtr usunięte), AC-19 pomiarem propsów.
2. **Trzy kryteria (AC-12, AC-13, AC-23) zweryfikowane kodem**, bo są niemierzalne bez urządzenia
   z wcięciem albo bez realnego wywołania modelu.
3. **Zastany dług znaleziony przy przeglądzie** — podwójny `<h1>` na `/kitchen` — zgłoszony, nie
   naprawiony w tym przebiegu.
