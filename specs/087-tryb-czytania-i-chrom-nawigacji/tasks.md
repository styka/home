# Zadania: Tryb czytania w Wiadomościach, jednolite ustawienia modułu i chrom nawigacji

- **Plan:** ./plan.md (087-tryb-czytania-i-chrom-nawigacji)
- **Status:** todo
- **Data:** 2026-08-24

> Kolejność: najpierw pomiar punktu odniesienia (bez niego AC-2, AC-15 i AC-16 są opinią), potem
> poprawki RAMY — bo dotykają wszystkich modułów i chcemy je mieć zmierzone wcześnie — dalej
> Wiadomości, asystent i na końcu najszersza zmiana: przebudowa chromu konta na obu szerokościach.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Punkt odniesienia

- [x] **T-1** — **Pomiar PRZED zmianą** (bez tego trzy kryteria są opinią). Przy 360 px i przy
  1280 px zmierz w klikaczu: (a) odległość górnej krawędzi pierwszej wiadomości od góry ramy
  w Wiadomościach, (b) prostokąt między dolną krawędzią paska widoku a górną paska modułu przy
  przewinięciu > 0 — czy widać w nim treść, (c) szerokość paska modułu kontra szerokość karty
  wiadomości, (d) w Pogodzie odstęp między dolną krawędzią bloku nagłówka a górną pierwszego
  elementu treści, (e) w pasku akcji przy 360 px pozycję lewej krawędzi pierwszego przycisku,
  (f) odległość chipu licznika od tytułu w nagłówku sekcji.
  *Wynik:* liczby w `verify.md`. Hipoteza o „szczelinie wysokości marginesu" **OBALONA** — w stanie
  ustalonym paski przylegają (przerwa 0). Zmierzona przyczyna jest inna: `--news-pasek-h` nie nadąża
  za zmianą wysokości paska widoku (101→141 px, zasłona zostaje 160 px, przerwa −40). `plan.md` §5.4
  poprawiony (C-54), a `T-12` opisuje teraz naprawę przez `calc()` zamiast dokładania obserwatora.
  Bocznego prześwitu **nie udało się odtworzyć** — pasek, sekcja i karta mają identyczne krawędzie.

**Bez fazy migracji** — feature nie rusza schematu (plan §2). `check:migrations` i
`check:schema-drift` mają przejść bez nowego pliku.

## Faza 1 — Rama widoku *(AC-6, AC-7, AC-8, AC-16)*

- [x] **T-2** — **Odstęp pod nagłówkiem, gdy nie ma paska widoku** (AC-16): blok nagłówka dostaje
  dolne wypełnienie wyłącznie przy `pasekMaTresc === false`, równe górnemu wypełnieniu paska.
  *Gotowe, gdy:* w Pogodzie odstęp > 0, a w widoku Z paskiem (Zadania, Wiadomości) pomiar z T-1
  nie zmienia się ani o piksel.

- [x] **T-3** — **Akcje modułu na telefonie** (AC-6): poniżej `md` wiersz akcji zajmuje pełną
  szerokość, przyciski dzielą ją równo; od `md` układ bez zmian.
  *Gotowe, gdy:* przy 360 px lewa krawędź pierwszego przycisku jest przy lewej krawędzi paska,
  a przy 1280 px pomiar z T-1 się nie zmienia.

- [x] **T-4** — **Slot ustawień w kontrakcie widoku** (AC-7, AC-8): pole `settings` w `ModuleViewProps`,
  rysowane przez `ViewBar` jako ostatnia pozycja strefy akcji (koło zębate, `aria-pressed` przy
  `active`). Moduł bez `settings` renderuje się identycznie jak dziś.
  *Gotowe, gdy:* przegląd ramy na dziesięciu trasach przechodzi bez zmian, a sonda z `settings`
  rysuje ikonę w strefie akcji.

## Faza 2 — Okno modalne *(AC-13, AC-14)*

- [x] **T-5** `[P]` — **Stopka okna nad obszarem gestów** (AC-14): dolne wypełnienie stopki `Modal`
  powiększone o `env(safe-area-inset-bottom)`.
  *Gotowe, gdy:* przy wymuszonym wcięciu przyciski są powyżej obszaru gestów; na komputerze bez zmian.

- [x] **T-6** `[P]` — **Treść potwierdzenia „Oznacz wszystkie"** (AC-13): `description` z liczbą
  wiadomości i informacją, że nic nie ginie.
  *Gotowe, gdy:* okno ma niepusty opis zawierający liczbę.

## Faza 3 — Wiadomości: nagłówek sekcji i akcje tematu *(AC-9..AC-12)*

- [x] **T-7** `[P]` — **Chip licznika przy tytule** (AC-9, AC-10): tytuł i licznik jako jedna grupa,
  akcje przejmują rozpychanie do prawej, `flex-wrap` znika.
  *Gotowe, gdy:* odstęp chipu od tytułu ≤ 8 px, a przy 360 px nagłówek mieści się w jednym wierszu
  bez przycięcia licznika.

- [x] **T-8** — **Menu trzech kropek dla akcji tematu** (AC-11, AC-12): edycja i usunięcie do
  `AnchoredLayer` otwieranego ikoną `MoreVertical`; usunięcie zostaje jawnie destrukcyjne.
  *Gotowe, gdy:* w nagłówku sekcji nie ma odsłoniętych ikon edycji/usuwania, a obie akcje działają
  z menu.

## Faza 4 — Wiadomości: tryb czytania i szczelność pasków *(AC-1..AC-5, AC-15)*

- [x] **T-9** — **Ustawienia modułu z zakładek do slotu** (AC-7, pierwszy konsument T-4): czwarta
  zakładka znika z `VIEW_TABS`, gear przełącza widok ustawień i z powrotem.
  *Gotowe, gdy:* wejście i wyjście z ustawień działa jednym przyciskiem, a zakładek są trzy.

- [x] **T-10** — **Tryb czytania: stan w adresie** (AC-4): klucz `czytanie` w stanie widoku, czytany
  i zapisywany tak jak `tresc`/`zrodla`.
  *Gotowe, gdy:* adres z `czytanie` otwiera widok w trybie czytania, a przełączenie zmienia adres.

- [x] **T-11** — **Tryb czytania: co znika, co zostaje** (AC-1, AC-2, AC-3): przy włączonym trybie
  moduł nie renderuje paska stanu i nie przekazuje `filters`/`headerAction`; przełącznik trybu stoi
  w pasku modułu (jedyne wyjście), lektor i nawigacja działają.
  *Gotowe, gdy:* wysokość chromu nad pierwszą wiadomością spada co najmniej o połowę wobec T-1,
  a wszystkie wymienione elementy nadal działają.

- [x] **T-12** — **Szczelność przyklejonych pasków** (AC-15): zasłona jako `calc(var(--view-bar-h) +
  <własna wysokość>)` zamiast liczby przeliczanej w efekcie (dowód w T-1: liczba nie nadąża za paskiem
  widoku); tło pasków rozciągnięte na szerokość kontenera przewijania.
  *Gotowe, gdy:* przy przewinięciu w prostokącie między paskami i w pasach po ich bokach nie ma
  piksela treści, przy 360 px i przy 1280 px.

## Faza 5 — Asystent *(AC-5)*

- [x] **T-13** — **Log rozumowania do stopki tury**: `ReasoningLog` rozdzielony na przyciski ikonowe
  (log opisowy, log techniczny) i panel; przyciski wchodzą do stopki obok lektora, panel renderuje
  się pod nią. Warunek `isAdmin && trybAdmina` dla logu technicznego bez zmian.
  *Gotowe, gdy:* przycisk logu jest w tym samym wierszu co lektor, ma ikonę i `aria-label`, a wszystkie
  cztery rodzaje tur renderują się bez błędu.

## Faza 6 — Chrom konta i nawigacja *(AC-17..AC-21)*

- [ ] **T-14** — **Scalony dialog ulubionych** (AC-18): gwiazdka otwiera jeden panel z listą
  wszystkich ulubionych (istniejący `FavoritesSwitcher` jako część) i operacją na widoku bieżącym
  (dodaj/usuń, zależnie od stanu). `Alt+0` otwiera ten sam panel.
  *Gotowe, gdy:* z jednego panelu da się przejść do zapisanego widoku ORAZ dodać/usunąć bieżący.

- [ ] **T-15** — **Panel boczny: nowy układ ikon** (AC-19, AC-20): przy nazwie aplikacji przełącznik
  admina, za nim dzwonek (wyrównane do prawej); w rzędzie niżej dom, gwiazdka, skróty.
  *Gotowe, gdy:* kolejność zgodna ze zgłoszeniem, wszystkie ikony działają, panele otwierają się w dół.

- [ ] **T-16** — **Nawigacja bez „Ulubionych" i „Strony głównej"** (AC-17): sekcja ulubionych znika
  z nawigacji i **plik zostaje usunięty** (traci konsumenta, C-53); moduł `home` filtrowany z listy
  `enabled` **i** z „Więcej…", ale zostaje w rejestrze i ma trasę.
  *Gotowe, gdy:* obu pozycji nie ma w nawigacji ani w „Więcej…", `check:module-registry` zielone,
  a `/` nadal działa.

- [ ] **T-17** — **Telefon: jedno wejście do ulubionych i menu bez dwóch pozycji** (AC-21): przycisk
  „Ulubione widoki" znika z górnego paska, menu pełnoekranowe traci obie pozycje, kolejność ikon
  w górnym pasku zgodna z komputerem.
  *Gotowe, gdy:* w widoku telefonu jest dokładnie jedno wejście do ulubionych i nie ma dwóch pozycji
  w menu.

## Faza 7 — Testy, teksty, domknięcie

- [ ] **T-18** — **Teksty do `messages/pl.json`** (C-32) dla wszystkiego, co doszło.
  *Gotowe, gdy:* `npm run check:i18n` zielone, zero literałów w komponentach.

- [ ] **T-19** `[P]` — **Klikacz: Wiadomości** (`wiadomosci-tryb-czytania.spec.ts`) — AC-1..AC-4,
  AC-9..AC-12, AC-15, z **kontrolą negatywną** dla AC-2 i AC-15.
  *Gotowe, gdy:* testy padają po cofnięciu odpowiedniej poprawki.

- [ ] **T-20** `[P]` — **Klikacz: rama i chrom** (`rama-i-chrom.spec.ts`) — AC-6, AC-7, AC-14, AC-16,
  AC-17..AC-21, plus dostosowanie `chrom-konta.spec.ts` do nowego układu ikon.
  *Gotowe, gdy:* testy 085/086 dotyczące chromu opisują stan po zmianie, a nie sprzed niej.

- [ ] **T-21** — **`CLAUDE.md` i konstytucja**: slot ustawień w kontrakcie widoku (C-33), jedno
  wejście do ulubionych i nowy układ chromu, tryb czytania jako element stanu widoku.
  *Gotowe, gdy:* żaden dokument nie opisuje stanu sprzed zmiany.

- [ ] **T-22** — **Pełny przebieg bramek** na lokalnym Postgresie (C-13): wszystkie `check:*`,
  `tsc` ×2, `next lint`, `next build`, budżet wydajnościowy, testy jednostkowe.

- [ ] **T-23** — **Pełna suita klikacza** + powtórzenie pomiarów z T-1.

- [ ] **T-24** — **`doświadczenia.md`** (C-51) za każdy nieoczywisty problem — w szczególności za to,
  co pokaże pomiar z T-1 wobec hipotez z planu.

---

## Mapowanie kryteriów akceptacji

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 tryb chowa chrom modułu | T-11 | AC-12 akcje w menu działają | T-8 |
| AC-2 chrom mniejszy o połowę | T-11 (dowód: T-1, T-19) | AC-13 treść potwierdzenia | T-6 |
| AC-3 wyjście z trybu widoczne | T-11 | AC-14 stopka nad gestami | T-5 |
| AC-4 tryb w adresie i w ulubionych | T-10 | AC-15 szczelność pasków | T-12 (dowód: T-1, T-19) |
| AC-5 log rozumowania w wierszu lektora | T-13 | AC-16 odstęp w Pogodzie | T-2 |
| AC-6 akcje na telefonie | T-3 | AC-17 nawigacja bez dwóch pozycji | T-16 |
| AC-7 ustawienia w strefie akcji | T-4 + T-9 | AC-18 jeden dialog ulubionych | T-14 |
| AC-8 slot działa dla innych modułów | T-4 | AC-19 kolejność przy nazwie aplikacji | T-15 |
| AC-9 chip przy tytule | T-7 | AC-20 kolejność w rzędzie ikon | T-15 |
| AC-10 nagłówek w jednym wierszu | T-7 | AC-21 telefon | T-17 |
| AC-11 akcje tematu schowane | T-8 | | |

## Ścieżka krytyczna

- `T-1` → `T-2`, `T-11`, `T-12` (bez punktu odniesienia nie ma czego porównać).
- `T-4` → `T-9` (slot musi istnieć, zanim Wiadomości go użyją — C-35: konsument razem z komponentem).
- `T-10` → `T-11` (stan przed zachowaniem).
- `T-14` → `T-16`, `T-17` (scalony dialog musi działać, zanim skasujemy stare wejścia).
- Wszystko → `T-18` → `T-19`/`T-20` → `T-21` → `T-22` → `T-23` → `T-24`.
- Równolegle: `T-5 ∥ T-6 ∥ T-7`, `T-13` niezależne od reszty, `T-19 ∥ T-20`.

## Notatki / blokady

- Hipotezy o przyczynie prześwitu (plan §5.4) są **do potwierdzenia w T-1**. Jeśli pomiar je obali,
  najpierw poprawiamy `plan.md`, potem kod (C-54) — dokładnie tak, jak w 086 z miarą zasłony.
