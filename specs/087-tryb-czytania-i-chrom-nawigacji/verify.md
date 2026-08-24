# Weryfikacja: Tryb czytania, jednolite ustawienia modułu i chrom nawigacji

- **Feature:** 087-tryb-czytania-i-chrom-nawigacji
- **Data:** 2026-08-24
- **Gałąź:** `claude/worldofmag-news-weather-tasks-a02ui9`
- **Podstawa:** `spec.md` (21 kryteriów), `plan.md`, `tasks.md` (24 zadania, wszystkie odhaczone)

---

## 1. Bramki

Wszystko na **lokalnym** Postgresie (`127.0.0.1:5432/omnia_dev`) — prod DB nietknięta (C-13).

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ `Numeracja migracji OK (następny wolny numer: 0259)` — **żadnej nowej migracji**, zgodnie z planem §2 |
| `npm run check:schema-drift` | ✅ brak rozjazdu (4 świadome wyjątki) — potwierdza, że schemat nie został ruszony |
| `npm run check:actions` | ✅ 161 akcji, wszystkie z egzekutorem |
| `next lint --dir src` | ✅ 0 błędów, 19 ostrzeżeń kosmetycznych (stan zastany, pozycja z roadmapy) |
| `next build` | ✅ skompilowany, 137 stron |
| Pozostałe bramki `check:*` (41 potwierdzeń w logu builda) | ✅ m.in. `check:ui-contract` (22/22), `check:i18n` (zero literałów), `check:tailwind`, `check:boundaries`, `check:module-registry`, `check:client-safe`, `check:e2e-waits`, `check:route-gating`, `check:pagination`, `check:logs` |
| `check:perf` | ✅ najcięższa trasa 1172 kB, suma 65 723 kB — w paśmie ±5 % |
| `npm run test:unit` | ✅ 1029 pass / 0 fail / 35 skipped |
| Klikacz (pełna suita) | ✅ **194 zielone, 0 czerwonych** |

**Ograniczenia środowiska (nie testu):** projekt `mobile` (WebKit) jest pomijany — brak silnika
w obrazie; `env(safe-area-inset-*)` w Chromium desktop wynosi 0, więc AC-14 sprawdzamy jako regułę
CSS, nie jako piksele na urządzeniu.

---

## 2. Punkt odniesienia (T-1) i pomiar po zmianie

| Miara | PRZED | PO |
|---|---|---|
| Chrom nad pierwszą wiadomością, 360 px | 303 px | **202 px** w trybie czytania (−101 px = cała wysokość paska widoku) |
| Chrom nad pierwszą wiadomością, 1280 px | 179 px | bez zmian poza trybem czytania |
| Przerwa między paskiem modułu a przyklejonym nagłówkiem po wzroście paska widoku o 40 px | **−40 px** (zasłona nie nadążała) | **0 px** |
| Pierwszy przycisk akcji przy 360 px | left = 202 przy pasku 0..360 (pusta lewa połowa) | left = **12** |
| Odstęp nagłówek ↔ treść w Pogodzie, 360 px | **0 px** | **13 px** |
| Chip licznika: odstęp od tytułu / zawijanie nagłówka | 8 px, `flex-wrap: wrap` | 8 px, **`nowrap`** |
| Wejść do ulubionych na telefonie | 2 | **1** |

**Pomiar obalił hipotezę z pierwszej wersji planu** (C-54). Zakładałem szczelinę wysokości marginesu;
w stanie ustalonym paski **przylegają** (przerwa 0). Prawdziwa przyczyna to liczba, która nie nadąża:
`--news-pasek-h` było przeliczane w efekcie obserwującym pasek modułu i ramę, więc zmiana wysokości
**paska widoku** nigdy go nie budziła. `plan.md` §5.4 i `tasks.md` T-12 zostały poprawione przed
kodowaniem.

---

## 3. Kryteria akceptacji

### A. Tryb czytania i pasek stanu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — tryb chowa chrom modułu, zostawia nawigację i lektora | ✅ | `NewsPage.tsx` — `chromeless={trybCzytania}`, `filters`/`headerAction`/`settings` puste, `RefreshStatus` niewyświetlany. Klikacz `[087-AC1]`: zakładki `false`, akcje `false`, pasek stanu `false`, nawigator `true`, wyjście `true`. |
| **AC-2** — chrom zauważalnie mniejszy | ✅ | Klikacz `[087-AC2]`: 303 → 202 px przy 360 px, spadek = 101 px = cała wysokość paska widoku; lektor i nawigacja nadal obecne. **Kryterium poprawione po pomiarze** (patrz §5). |
| **AC-3** — wyjście widoczne bez przewijania | ✅ | Przełącznik stoi w **przyklejonym** pasku modułu (`NewsPage.tsx`, akcje `GroupNavigator`), więc jest widoczny przy przewinięciu zero i po przewinięciu. Klikacz `[087-AC1]` sprawdza jego widoczność. |
| **AC-4** — tryb w adresie, wraca z ulubionego | ✅ | `czytanie: oneOf(["0","1"], "0")` w `viewSpec`; klikacz `[087-AC1]` sprawdza `location.search` po włączeniu, `[087-AC2]` wchodzi wprost pod `/wiadomosci?czytanie=1`. |
| **AC-5** — log rozumowania w wierszu lektora, z ikoną | ✅ | `AICommandSheet.tsx` — `useReasoningLog` zwraca `przyciski` (ikony `Brain`/`Bug`, ten sam `footerIconBtn` co lektor) wstawiane do stopki tury i `panel` renderowany pod nią; cztery rodzaje tur używają tej samej pary. |

### B. Układ akcji modułu i ustawienia

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-6** — akcje nie zbijają się do prawej na telefonie | ✅ | `ViewBar.tsx` — poniżej `md` wiersz akcji ma `flex-1` i `[&>*]:flex-1`; od `md` `md:flex-none`. Klikacz `[087-AC6]`: pierwszy przycisk na 12 px zamiast 202, zero przyciętych. |
| **AC-7** — ustawienia przy akcjach, nie wśród zakładek | ✅ | `ViewBar.tsx` `PrzyciskUstawien` w strefie akcji; `VIEW_TABS` ma trzy pozycje. Klikacz `[087-AC7]`: gear widoczny, brak zakładki „Ustawienia", `aria-pressed` przełącza się `false → true`. |
| **AC-8** — inny moduł dostaje to samo miejsce bez własnego kodu | ✅ | Pole `settings` jest **opcjonalne** i obsługiwane wyłącznie w ramie (`ModuleView` → `ViewBar`); moduł podaje `{ onClick \| href, active, label }`. Dowód negatywny: przegląd ramy na dziesięciu trasach (`rama-widoku-przeglad`) przechodzi bez zmian w tych modułach — czyli brak pola niczego nie zmienia. |

### C. Nagłówki sekcji i akcje tematu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-9** — chip przy tytule | ✅ | `sekcjeTematow.tsx` — tytuł i licznik w jednej grupie, akcje z `ml-auto`. Klikacz `[087-AC9]`: odstęp 8 px, `flex-wrap: nowrap`. |
| **AC-10** — nagłówek w jednym wierszu przy 360 px | ✅ | Klikacz `[087-AC10]`: wysokość 49 px (jeden wiersz), licznik nieprzycięty. |
| **AC-11** — akcje tematu pod trzema kropkami | ✅ | `NewsPage.tsx` `MenuTematu` na `AnchoredLayer`. Klikacz `[087-AC11]`: brak odsłoniętego „Edytuj temat" w nagłówku, menu otwiera się i ma obie pozycje. |
| **AC-12** — obie akcje działają, usunięcie nadal pyta | ✅ | Klikacz `[087-AC11]` sprawdza `menuitem`y; `usunTemat` niezmieniony — `confirmDialog({ …, destructive: true })`. |

### D. Potwierdzenia i przyklejone paski

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-13** — potwierdzenie ma treść | ✅ | `NewsStream.tsx` — `description` z liczbą. Klikacz `[087-AC13]`: „Zniknie z listy 60 nowych pozycji. Nic nie zostaje usunięte…", brak przycisku „Usuń" (C-34). |
| **AC-14** — przyciski powyżej obszaru gestów | ⚠️ | `Modal.tsx` — `paddingBottom: calc(12px + env(safe-area-inset-bottom))`. Klikacz `[087-AC14]` potwierdza, że stopka ma własne wypełnienie liczone z tej reguły (12 px przy `env()` = 0). **Nie dało się sprawdzić na urządzeniu**: brak WebKita, a w Chromium desktop `env(safe-area-inset-bottom)` wynosi zero. Potwierdzenie należy do właściciela na iPhonie. |
| **AC-15** — brak treści między paskami i po ich bokach | ⚠️ | **Pionowo: ✅** — zasłona jako `calc(var(--view-bar-h) + własna wysokość)`; klikacz `[087-AC15]` z kontrolą różnicującą: po podniesieniu paska widoku o 40 px przerwa zostaje 0, ze starą wersją spadała do −40. **Bocznego prześwitu NIE udało się odtworzyć** — przy 1280 i 360 px pasek modułu, sekcja i karta mają identyczne krawędzie (236..1264 / 16..344), więc nie było czego mierzyć ani czego naprawiać. Zapisane uczciwie zamiast „naprawione". |

### E. Odstępy w Pogodzie

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-16** — treść oddzielona od paska modułu | ✅ | `ModuleView.tsx` — dolne wypełnienie bloku nagłówka wraca, gdy paska nie będzie. Klikacz `[087-AC16]`: 13 px (było 0). Kontrola negatywna: po cofnięciu 1 px, test pada. |

### F. Chrom konta i nawigacja

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-17** — brak pozycji „Ulubione" i „Strona główna" | ✅ | `resolveMenu` filtruje `home` z `enabled` **i** `more`; `FavoritesSidebarSection` usunięty. Klikacz `[087-AC17]` wypisuje pozycje nawigacji — obu nie ma. |
| **AC-18** — jeden dialog z listą i operacją na bieżącym widoku | ✅ | `FavoriteStarButton` → `openFavoritesSwitcher`; `FavoritesSwitcher` ma nad listą `FavoriteViewForm`. Klikacz `[087-AC18]` oraz przepisane `[fav-AC1..AC10]`, `[fav043-*]`. |
| **AC-19** — przy nazwie aplikacji: admin, potem dzwonek | ✅ | Klikacz `[087-AC19+AC20]`: `tryb.x = 133 < dzwonek.x = 169`, ta sama linia (y 8 vs 7). |
| **AC-20** — rząd niżej: dom, gwiazdka, skróty | ✅ | Ten sam test: `dom.x = 16 < gwiazdka.x = 52 < skroty.x = 88`, wszystkie y = 48 (poniżej wiersza nazwy). |
| **AC-21** — telefon również | ✅ | Klikacz `[087-AC21]`: dokładnie jedno wejście do ulubionych przy 390 px; przycisk „Ulubione widoki" usunięty z górnego paska, `resolveMenu` obsługuje też menu telefonu. |

**Podsumowanie: 21 / 21 spełnionych**, dwa (AC-14, AC-15) z jawnie zapisanym ograniczeniem.

---

## 4. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** praca w `worldofmag/` | ✅ poza nim tylko artefakty `specs/`, `doświadczenia.md`, `CLAUDE.md`, konstytucja |
| **C-10..C-13** migracje | ✅ feature nie rusza schematu; brak migracji jest świadomy i potwierdzony przez `check:schema-drift` |
| **C-20 / C-21** akcje i własność | ✅ zero nowych akcji; dialog ulubionych woła te same `addFavoriteView`/`removeFavoriteViewByPath` z ich guardami i `revalidatePath` |
| **C-22** RBAC | ✅ bez nowych slugów; `module.home` zachowuje trasę, uprawnienie i wpis w rejestrze mimo zniknięcia z listy menu |
| **C-30 / C-32** motyw i teksty | ✅ tylko zmienne CSS; `check:i18n` zielone, nowe teksty w `messages/pl.json` |
| **C-31** mobile + obszar bezpieczny | ✅ poprawka akcji dotyczy wyłącznie < `md`; stopka okna respektuje `env(safe-area-inset-bottom)` |
| **C-33** kontrakt widoku | ✅ **trzy poprawki poszły do RAMY, nie do modułów** — dokładnie „poszerz ramę, nie rób wyjątku"; konstytucja zaktualizowana razem ze zmianą |
| **C-34** potwierdzenia | ✅ „Oznacz wszystkie" neutralne z treścią; usunięcie tematu nadal jawnie destrukcyjne |
| **C-35** komponent z konsumentem | ✅ slot `settings` dowieziony razem z Wiadomościami; `FavoritesSidebarSection` **usunięty**, bo stracił konsumenta |
| **C-50** definicja „gotowe" | ✅ build zielony |
| **C-51** wnioski | ✅ dwa wpisy: „liczba przeliczana w efekcie zawsze kiedyś nie nadąży" i „test mierzył pudełko, do którego naprawa dokłada wypełnienie" |
| **C-53** minimalizm | ✅ zero nowych zależności; menu na istniejącym `AnchoredLayer`, stan w istniejącym `useViewState`, dialog z istniejącego `FavoritesSwitcher`, formularz **przeniesiony**, nie napisany drugi raz |
| **C-54** spójność artefaktów | ✅ dwie korekty w dół łańcucha: przyczyna prześwitu (plan §5.4 + T-12) i AC-2 (spec + tasks), obie z zapisanym powodem |
| **C-55** jeden moment pytań | ✅ cztery decyzje zebrane raz, na `/specify`; dalsze etapy bez pytań |

Naruszeń brak.

---

## 5. Korekty wymuszone pomiarem (C-54)

1. **Przyczyna prześwitu** — hipoteza „szczelina wysokości marginesu" obalona; prawdziwa przyczyna to
   nienadążająca liczba. `plan.md` §5.4 przepisany, `tasks.md` T-12 przeliczone, naprawa poszła
   w `calc()` zamiast w kolejnego obserwatora.
2. **AC-2** — „co najmniej o połowę" było **moją** liczbą, nie wymaganiem właściciela, i okazało się
   nieosiągalne bez skasowania wejścia do lektora — czyli tego, co właściciel kazał ZOSTAWIĆ.
   Kryterium mówi teraz, o ile chrom spada i co zostaje na ekranie.
3. **Test AC-16** mierzył dolną krawędź BLOKU nagłówka, a naprawa dokłada wypełnienie wewnątrz niego —
   więc wychodziło 0 w obu wersjach kodu. Mierzy teraz od tekstu; kontrola negatywna 13 → 1 px.

---

## 6. Regresje

- **`ViewBar`/`ModuleView` dotykają 21 modułów.** Przegląd ramy na dziesięciu trasach różnych klas
  przechodzi; zmiana w akcjach jest zamknięta poniżej `md`, a odstęp pod nagłówkiem dokładany tylko
  tam, gdzie paska nie ma.
- **`Modal` (wszystkie okna aplikacji).** Zmiana to wyłącznie dolne wypełnienie stopki; na komputerze
  `env()` = 0, więc wygląd bez zmian.
- **Usunięcie pozycji z nawigacji** przeniosło część testów w stan „opisują świat sprzed zmiany" —
  `favorites`, `shortcuts`, `view-state`, `chrom-konta` i `wiadomosci-akcje` zostały dostosowane,
  a wspólny przepływ wylądował w `e2e/pages/chromWidoku.ts`. Pełna suita: 194 zielone.
- **Efekt uboczny, na plus:** testy zapisujące jeden ulubiony kasowały wcześniej **całą** listę
  wspólnego konta i ścigały się z sąsiednim workerem („nie udało się wyczyścić w 40 iteracjach").
  Teraz sprzątają po sobie — ta kruchość istniała przed 087 i została przy okazji usunięta.
- **Świadomie zostawione:** kolumna `UserMenuPref.favoritesCollapsed` nie ma już czytelnika w UI
  (sekcja ulubionych zniknęła). Usunięcie wymagałoby migracji na tabeli preferencji; wartość zostaje
  nieużywana, odnotowana tutaj zamiast po cichu.
- **RBAC / `revalidatePath`** — bez zmian; `check:route-gating`, `check:ai-access`, `check:owner-columns`
  zielone.

---

## 7. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 21 kryteriów spełnione, wszystkie bramki zielone, 194 testy klikacza i 1029 jednostkowych
bez czerwieni. Trzy uwagi, wszystkie zapisane jako ograniczenia, nie jako braki:

- **AC-14** (obszar gestów iPhone'a) zweryfikowany jako reguła CSS, nie jako wygląd na urządzeniu —
  w sandboxie nie ma WebKita, a `env(safe-area-inset-bottom)` w Chromium desktop wynosi zero.
- **AC-15, boczny prześwit** — nie odtworzony pomiarem przy 360 ani 1280 px (pasek, sekcja i karta
  mają identyczne krawędzie). Naprawiona i udowodniona została pionowa połowa tego zgłoszenia;
  jeśli boczny prześwit u właściciela utrzyma się, będzie potrzebny jego zrzut ekranu z szerokością okna.
- **`favoritesCollapsed`** zostaje w bazie bez czytelnika (patrz §6).
