# Zadania: Wiadomości — porządek w widoku i nawigator tematów; koszty AI poza treścią

- **Plan:** ./plan.md (083-wiadomosci-ux-i-koszty-ai)
- **Status:** todo
- **Data:** 2026-08-19

> Kolejność od najtańszego i najbardziej niezależnego do najtrudniejszego. **Fazy 1–3 są rozłączne**
> (powłoka / koszty / moduł) i każda kończy się osobnym commitem, żeby dało się wycofać jedną
> warstwę bez pozostałych.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Środowisko i punkt odniesienia

- [x] **T-1** — **Środowisko do oglądania.** Lokalny Postgres + baza e2e z zaseedowanymi tematami
  i wiadomościami (skrypt z 082-poprawki), build i `next start`. Zrzuty „przed" dla:
  `/wiadomosci` (góra strony), zakładka Źródła, moduł krótki (`/pogoda`) i długi po przewinięciu
  (narożniki skórki).
  *Gotowe, gdy:* aplikacja odpowiada lokalnie, zrzuty „przed" leżą w `/tmp`, a **zmierzona
  odległość od górnej krawędzi ramy do pierwszej wiadomości** jest zapisana jako liczba odniesienia
  dla miary sukcesu ze speca §2.

- [x] **T-2** `[P]` — **Pomiar chromu.** Policz w przeglądarce ikony gwiazdki na desktopie i mobile,
  na trasie modułowej i poza nią (`/admin`). Zapisz liczby — to jest dowód „przed" dla AC-1/AC-2.
  *Gotowe, gdy:* liczby zapisane; wiadomo, które konkretnie elementy DOM je rysują.

---

## Faza 1 — Powłoka: jedna gwiazdka, czytelny wskaźnik świeżości *(AC-1..AC-5)*

- [x] **T-3** — **Jedno miejsce akcji „zapisz ten widok".** Usuń `FavoriteStarButton`
  z `FavoritesSidebarSection` i z mobilnego górnego paska w `AppShell`; zostaje wyłącznie chrom
  `ViewBar`. Sekcja „ULUBIONE" traci ikonę gwiazdki jako etykietę — zostaje tekst i chevron.
  Przełącznik ulubionych (`⇄`) i lista **zostają** w obu miejscach.
  *Gotowe, gdy:* na desktopie i mobile widać **dokładnie jedną** gwiazdkę; przejście do ulubionych
  nadal działa z każdej strony.

- [x] **T-4** — **Wskaźnik świeżości przestaje udawać przycisk.** `FreshnessIndicator` renderuje się
  jako podpis: ikona `aria-hidden` + tekst wieku danych, bez tła, obramowania i `hover`, z `title`
  wyjaśniającym, co pokazuje. Mechanizm odświeżania bez zmian.
  *Gotowe, gdy:* element nie ma `role="button"` ani `cursor: pointer`; obok niego nie stoi nic, co
  wygląda tak samo (AC-3, AC-4).

- [x] **T-5** `[P]` — **Narożniki skórki poza przewijaną treścią.** Wynieś `ChromeFrame` z wnętrza
  przewijanego kontenera `ModuleView` do warstwy rodzica z `position: relative`.
  *Gotowe, gdy:* przy przewinięciu `/wiadomosci` narożniki **nie zmieniają położenia**, a wygląd
  `/pogoda` (treść krótka) jest identyczny jak przed zmianą — porównanie zrzutów (AC-31).

- [ ] **T-6** — **Commit fazy 1** + przebieg bramek UI (`check:i18n`, `check:ui-contract`,
  `check:tailwind`, `tsc`, `lint`).
  *Gotowe, gdy:* bramki zielone, zrzuty „po" potwierdzają jedną gwiazdkę i nieruchome narożniki.

---

## Faza 2 — Koszty AI *(AC-6..AC-15)*

- [ ] **T-7** — **Autobus kosztu.** `src/platform/ai/kosztBus.ts` — `zglosKoszt({akcja, usage})`
  i `onKoszt(handler)`, wzorowane na `lib/ai/feedbackBus.ts`. Bez Reacta i bez Prismy.
  *Gotowe, gdy:* `tsc` czysto; test jednostkowy: zgłoszenie dociera do subskrybenta, wypisanie się
  odcina.

- [ ] **T-8** — **Przełącznik widoczności.** `src/platform/ai/kosztWidocznosc.tsx` — provider
  + `usePokazKoszty()`, stan w `localStorage` (`omnia.pokazKoszty`), **domyślnie wyłączony**, odczyt
  i zapis w `try/catch` (prywatne okno i zablokowane dane witryny to poprawny stan).
  *Gotowe, gdy:* test jednostkowy reguły odczytu: brak wartości → wyłączone; wyjątek → wyłączone,
  bez rzucania.

- [ ] **T-9** — **Ulotne powiadomienia.** `src/components/ui/KosztToasts.tsx`: prawy górny róg,
  `position: fixed`, warstwa **nad** modalami i pływającym asystentem, znikanie po ~6 s, maks. 3
  naraz, powtórzenia tej samej akcji **łączone z licznikiem** zamiast układane w stos.
  *Gotowe, gdy:* AC-11, AC-12, AC-14 dają się pokazać klikaczem; nic nie trafia do dzwonka ani do
  bazy (AC-13).

- [ ] **T-10** — **`AiCostBadge` melduje zawsze, rysuje warunkowo.** Nowy **wymagany** prop
  `akcja: string`; komponent zgłasza koszt na autobus przy każdej zmianie zużycia (niezależnie od
  przełącznika) i renderuje `null`, gdy przełącznik wyłączony. Rozwinięcie składowych bez zmian.
  `AiContentMeta` podaje `akcja` z `AI_SECTION_LABELS[sectionKind]`.
  *Gotowe, gdy:* `tsc` wskazuje **wszystkie** miejsca bez propu (to jest cel — pominięcie ma być
  błędem kompilacji, nie cichym „Nieznana akcja").

- [ ] **T-11** — **Etykiety akcji w 24 modułach.** Dodaj `akcja` w każdym pliku wołającym
  `AiCostBadge` bezpośrednio, polską nazwą **czynności użytkownika** (np. „Streszczenie
  wiadomości", „Ocena obserwatorów pogody", „Plan tygodnia", „Rozpoznanie zdjęcia magazynu").
  *Gotowe, gdy:* `tsc` czysto; dwa różne komponenty na jednej stronie dają dwie różne nazwy (AC-12).

- [ ] **T-12** — **Wpięcie w powłokę.** `AppShell`: provider przełącznika + `KosztToasts`;
  boolean `kosztyDostepne` liczony **po stronie serwera** (admin ∧ `ai_cost_badge_enabled`) — nie
  przenosimy tej decyzji do klienta. Ikona przełącznika w mobilnym pasku obok dzwonka i w wierszu
  nagłówka `FavoritesSidebarSection` na desktopie; w `AICommandSheet` — w jego własnym nagłówku.
  *Gotowe, gdy:* AC-8, AC-9 klikalne; przy `ai_cost_badge_enabled=0` **nie ma** ani przełącznika,
  ani powiadomień (AC-15); konto bez `module.admin` nie dostaje `usage` na drut (AC-6).

- [ ] **T-13** — **Commit fazy 2** + bramki (`check:cost-badge`, `check:ai-coverage`, `check:i18n`,
  `check:client-safe`, `tsc`, `lint`).
  *Gotowe, gdy:* zielone; klikaczem sprawdzone: brak kosztu → przełącznik → koszt + składowe.

---

## Faza 3 — Moduł Wiadomości *(AC-16..AC-28)*

- [ ] **T-14** — **Odchudzenie widoku.** Usuń sekcję historii odświeżeń (komponent + akcję
  `getNewsRefreshHistory` + wpis w `action-coverage.json`) oraz przełącznik „Strumień / Jeden temat".
  Model `NewsRefreshRun` i zapis przebiegów **zostają** — to dane administracyjne.
  *Gotowe, gdy:* AC-16 spełnione; `check:ai-coverage` zielone (martwy wpis wywala bramkę).

- [ ] **T-15** — **Wspólny nawigator.** `src/components/ui/nav/GroupNavigator.tsx`: `grupy`,
  `aktywnaId`, `onWybor`, `akcje`, `pozycjaWszystkie`. Układ `[◀] [wyzwalacz listy] [▶] [akcje]`,
  lista z wyszukiwarką, `Esc`, cele dotyku `py-3`, jeden mechanizm na telefon i desktop.
  **Nie importuje niczego z `modules/`.**
  *Gotowe, gdy:* `check:boundaries` zielone; test jednostkowy reguł wyboru (następny/poprzedni,
  pozycja zbiorcza na pierwszym miejscu).

- [ ] **T-16** — **Nawigator w module + „Wszystkie".** `NewsPage` używa `GroupNavigator` zamiast
  `TopicPicker` (plik **usuwany**); pierwsza pozycja to „Wszystkie"; pasek **nie pokazuje** nazwy
  tematu bieżącego jako osobnego znacznika. Wybór tematu i źródeł w stanie widoku (adres).
  *Gotowe, gdy:* AC-17, AC-18 spełnione; wybór da się zapisać gwiazdką jako ulubiony widok.

- [ ] **T-17** — **Przejście w bok.** Zmiana tematu przesuwa kontener sekcji `translateX` (~24 px,
  ~180 ms, z poszanowaniem `prefers-reduced-motion`), potem pionowe przewinięcie do sekcji.
  **Przewijamy wyłącznie ramę widoku** — nigdy mechanizmem sięgającym przodków (lekcja z 082).
  *Gotowe, gdy:* AC-19 widoczne w przeglądarce, a AC-20 potwierdzone pomiarem: `scrollTop` nie
  maleje przy przewijaniu przez tematy.

- [ ] **T-18** — **Akcje tematu przy temacie.** Edycja, usunięcie i „dodaj temat" wychodzą z paska:
  edycja i usunięcie do przyklejonego nagłówka sekcji tematu (obok „słuchaj" i „oznacz"),
  „dodaj temat" do `headerAction` obok „Odśwież". Usunięcie za `confirmDialog` (C-34).
  *Gotowe, gdy:* AC-21 spełnione; pasek zawiera wyłącznie nawigację i filtr.

- [ ] **T-19** — **Filtr źródeł o stałej wysokości.** Ikona z licznikiem („Wszystkie" / „3 z 12")
  w `akcje` nawigatora; panel na `AnchoredLayer` z listą, szukaniem i „zaznacz/odznacz wszystkie".
  Pas chipsów **znika**.
  *Gotowe, gdy:* wysokość paska **taka sama** przy 3 i przy 15 źródłach (pomiar) — AC-22, AC-23.

- [ ] **T-20** — **Linia czasu dla wszystkich tematów.** Przełącznik `Wiadomości ⇄ Linia czasu`
  przestaje zależeć od wyboru pojedynczego tematu; akcja odczytu zwraca wpisy ze wszystkich tematów
  z identyfikatorem i tytułem tematu; widok grupuje je w te same sekcje z przyklejonym nagłówkiem,
  co widok wiadomości.
  *Gotowe, gdy:* AC-24, AC-25 spełnione; `check:pagination` zielone (`take: SUFIT_LISTY`).

- [ ] **T-21** — **Zakładka Źródła.** Wiersz o stałej strukturze (nazwa + znacznik opisu / adres
  z `truncate` / akcje w stałej kolumnie); ustawienie domyślnej długości streszczeń **nad** listą;
  ten sam nagłówek sekcji co pozostałe zakładki.
  *Gotowe, gdy:* AC-26..AC-28 potwierdzone zrzutem; ustawienie widoczne bez przewijania.

- [ ] **T-22** — **Test przewijania po zmianie.** Zaktualizuj `e2e/specs/news-stream-scroll.spec.ts`
  do nowych selektorów (nawigator zamiast paska chipów) tak, żeby **dalej pilnował AC-20**.
  *Gotowe, gdy:* test zielony na nowym kodzie i **czerwony** po sztucznym cofnięciu przewijania —
  sprawdzony w obie strony, jak w 082-poprawce.

- [ ] **T-23** — **Commit fazy 3** + bramki modułowe.

---

## Faza 4 — Domknięcie

- [ ] **T-24** — **Pełny przebieg bramek** na lokalnym Postgresie (C-13, zatrzymanie przed
  `migrate.js`): `check:i18n`, `check:ui-contract`, `check:boundaries`, `check:module-registry`,
  `check:ai-coverage`, `check:actions`, `check:pagination`, `check:tailwind`, `check:client-safe`,
  `check:e2e-waits`, `check:logs`, `check:owner-columns`, `check:cost-badge`, `check:content-memory`,
  `tsc` (główny + testowy), `test:unit`, `next lint`, `next build`, `check:perf`.

- [ ] **T-25** — **Weryfikacja w przeglądarce** (obowiązkowa, lekcja z 082): pełna suita klikacza
  + pomiary do miar sukcesu ze speca §2 — wysokość chromu nad pierwszą wiadomością „przed/po",
  liczba gwiazdek, wysokość paska przy 3 i 15 źródłach, położenie narożników po przewinięciu.
  *Gotowe, gdy:* liczby zapisane i **spadek chromu wynosi co najmniej połowę**; gdyby nie wynosił —
  to jest brak do naprawienia, nie do przemilczenia.

- [ ] **T-26** — **`CLAUDE.md`**: tabela modułu Wiadomości (nawigator, „Wszystkie", filtr źródeł,
  brak historii odświeżeń), opis nowego podejścia do kosztów AI, wpis o `GroupNavigator`.

- [ ] **T-27** — **`doświadczenia.md`** (C-51): lekcje z tego przebiegu — co najmniej rozjazd
  „ikona informacyjna wyglądająca jak wyłączona kontrolka" i „dekoracja w środku przewijanego
  kontenera przewija się razem z treścią".

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) | AC | Zadanie(a) |
|----|-----------|----|-----------|
| AC-1, AC-2 jedna gwiazdka | T-3 (dowód: T-2, T-25) | AC-17 „Wszystkie" pierwsze | T-16 |
| AC-3 wskaźnik nie udaje przycisku | T-4 | AC-18 pasek bez nazwy tematu | T-16 |
| AC-4, AC-5 jedno odświeżanie, układ jak w innych | T-4, T-18 | AC-19 przejście w bok | T-17 |
| AC-6 nie-admin bez `usage` | T-12 | AC-20 brak cofania strony | T-17, T-22 |
| AC-7 koszt domyślnie ukryty | T-10 | AC-21 akcje przy temacie | T-18 |
| AC-8 przełącznik w pasku | T-12 | AC-22, AC-23 filtr źródeł | T-19 |
| AC-9 przełącznik w asystencie | T-12 | AC-24, AC-25 linia czasu | T-20 |
| AC-10 koszt + składowe | T-10 | AC-26..AC-28 zakładka Źródła | T-21 |
| AC-11, AC-12 powiadomienie z nazwą akcji | T-9, T-10, T-11 | AC-29 nawigator bez wiedzy o module | T-15 |
| AC-13 brak trwałego zapisu | T-9 | AC-30 nawigator ma konsumenta | T-16 |
| AC-14 najwyższa warstwa | T-9 | AC-31 narożniki nieruchome | T-5 |
| AC-15 wyłącznik systemowy nadrzędny | T-12 | AC-16 brak historii odświeżeń | T-14 |

## Ścieżka krytyczna

Trzy fazy są **rozłączne** i mogą iść w dowolnej kolejności; wewnątrz:

- `T-7 → T-8 → T-9 → T-10 → T-11 → T-12` (autobus → przełącznik → powiadomienia → komponent →
  etykiety → wpięcie). **T-10 blokuje T-11** przez błąd kompilacji — to celowe.
- `T-15 → T-16 → T-17` (wspólny komponent → wpięcie → ruch), `T-16 → T-18/T-19` (pasek musi
  istnieć, zanim się go zapełni), `T-16 → T-22` (test pod nowe selektory).
- `T-3 ∥ T-5` (różne pliki), `T-14 ∥ T-21` (różne zakładki), `T-19 ∥ T-20`.

Wszystko → `T-24` → `T-25` → `T-26`, `T-27`.

## Notatki / blokady

- **T-11 dotyka 24 plików** i jest mechaniczne, ale to jedyne miejsce, gdzie może wejść błąd
  merytoryczny: etykieta ma nazywać **czynność użytkownika**, a nie typ operacji LLM. „Reasoning"
  albo „generation" nie odpowiadają na pytanie właściciela „za co poleciał ten koszt".
- **T-17 to miejsce najwyższego ryzyka** — dokładnie ta klasa błędu, która wyszła w 082
  (szarpanie stroną). Obowiązuje zasada: przewijamy konkretny kontener, weryfikacja w przeglądarce.
- **T-25 może zawrócić pipeline.** Jeśli pomiar pokaże, że chrom nie schudł o połowę, to jest brak
  do naprawienia w `/implement`, a nie liczba do przemilczenia w raporcie.
