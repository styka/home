# Zadania: Semantyka akcji w Wiadomościach, świeże gorące tematy i poprawki układu

- **Plan:** ./plan.md (086-semantyka-wiadomosci-i-poprawki-ukladu)
- **Status:** todo
- **Data:** 2026-08-24

> Kolejność: najpierw pomiar punktu odniesienia (bez niego AC-20 jest opinią), potem drobne poprawki
> układu zamknięte w pojedynczych plikach, dalej dwie korekty trybu administratora, a na końcu dwie
> rzeczy o największym zasięgu: przegląd 54 potwierdzeń i nowy etap w zadaniu w tle.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Punkt odniesienia i fundament danych

- [x] **T-1** — **Pomiar PRZED zmianą** (bez tego AC-18 i AC-20 są opinią): przy przewinięciu ZERO
  odstęp między dolną krawędzią paska modułu Wiadomości a górną krawędzią przyklejonego nagłówka
  tematu; przy 360 px szerokość tytułu „Pogoda" i przycisku lokalizacji; pozycja górnej krawędzi
  powiadomienia o koszcie.
  *Gotowe, gdy:* liczby zapisane do `verify.md` jako punkt odniesienia.

- [x] **T-2** — **Migracja `0258_news_item_bez_dismissed`**: `UPDATE "NewsItem" SET status =
  'ACKNOWLEDGED' WHERE status = 'DISMISSED'`. Bez zmiany kształtu tabeli.
  *Gotowe, gdy:* `npm run check:migrations` i `check:schema-drift` zielone, migracja zaaplikowana na
  LOKALNYM Postgresie (C-13).

## Faza 1 — Poprawki układu *(AC-16..AC-19, AC-21)*

- [x] **T-3** `[P]` — **Odstęp nad chipsami w Pomysłach** (AC-16).
  *Gotowe, gdy:* chipsy są wyraźnie oddzielone od opisu modułu.

- [x] **T-4** `[P]` — **Pasek obserwatorów w dwóch wierszach** (AC-17): `AiContentMeta` u góry, ikony
  układu pod nim. Warunek „ikony tylko przy >1 obserwatorze" zostaje.
  *Gotowe, gdy:* kolejność zgodna ze zgłoszeniem, nic nie zginęło z paska.

- [x] **T-5** `[P]` — **Nazwa lokalizacji nie przycina tytułu** (AC-18): `min-w-0` + `truncate` +
  ograniczenie szerokości na przycisku lokalizacji.
  *Gotowe, gdy:* przy 360 px tytuł modułu jest w całości czytelny niezależnie od długości nazwy.

- [x] **T-6** — **Rząd chromu nad nawigację** (AC-19): ze stopki panelu bocznego pod nazwę aplikacji,
  przed „Stroną główną". Zawartość bez zmian.
  *Gotowe, gdy:* wszystkie cztery ikony działają, a rząd stoi nad pierwszą pozycją menu.

- [x] **T-7** `[P]` — **Etykieta nawigatora tematów** (AC-21): „Tematy" → „Przejdź do tematu",
  razem z `aria-label`.
  *Gotowe, gdy:* kontrolka nie powtarza nazwy zakładki.

## Faza 2 — Tryb administratora, dwie korekty *(AC-12..AC-15)*

- [x] **T-8** — **Powiadomienia o koszcie wychodzą spod przełącznika** (AC-12, AC-13): `KosztToasts`
  bez bramki trybu; widoczność zależy wyłącznie od danych z serwera (`visibleUsage`).
  **`AiCostBadge` zostaje pod przełącznikiem** — to rozróżnienie jest sednem zgłoszenia.
  *Gotowe, gdy:* administrator widzi powiadomienie przy obu stanach przełącznika, a nie-admin nie widzi.

- [x] **T-9** — **Techniczny log rozumowania pod przełącznikiem** (AC-14): `isAdmin` → `isAdmin &&
  trybAdmina`. Log opisany po ludzku (dla wszystkich) bez zmian.
  *Gotowe, gdy:* przy wyłączonym trybie nie ma wejścia do technicznego logu.

- [x] **T-10** `[P]` — **Zapas od wcięcia aparatu** (AC-15): 12 px → 28 px ponad obszar bezpieczny.
  *Gotowe, gdy:* pomiar pokazuje górną krawędź ≥ 28 px.

## Faza 3 — Semantyka akcji w Wiadomościach *(AC-1..AC-4)*

- [x] **T-11** — **Koniec `dismissItem`**: akcja serwerowa usunięta, `ItemStatus` bez `DISMISSED`,
  wpis w `src/lib/ai/action-coverage.json` skasowany.
  *Gotowe, gdy:* `check:actions` i `check:ai-coverage` zielone, `tsc` czysto.

- [x] **T-12** — **Karta wiadomości: jedna akcja zamykająca** (AC-1..AC-3): „Odrzuć" znika,
  „Przeczytane" dostaje podpowiedź mówiącą, że dotyczy MOJEJ listy i nie kasuje treści.
  *Gotowe, gdy:* na karcie jest dokładnie jedna akcja zamykająca, a linia czasu tematu zostaje nietknięta.

## Faza 4 — Domyślna etykieta potwierdzeń *(AC-5..AC-7)*

- [x] **T-13** — **Odwrócenie domyślności** w `ConfirmProvider`: `destructive` domyślnie `false`,
  etykieta „Potwierdź".
  *Gotowe, gdy:* wywołanie z samym napisem daje neutralny przycisk.

- [x] **T-14** — **Przegląd 54 wywołań w 43 plikach**: każde klasyfikowane osobno; operacje usuwające
  dostają jawne `{ title, destructive: true }`. Reguła: destrukcyjne = po potwierdzeniu ginie rekord
  albo treść.
  *Gotowe, gdy:* lista klasyfikacji spisana w `verify.md` (jeden wpis na wywołanie), a `grep` nie
  pokazuje ani jednego usuwającego wywołania bez jawnej deklaracji.

## Faza 5 — Świeże gorące tematy *(AC-8..AC-11)*

- [x] **T-15** — **Rdzeń generowania do `lib/goraceTematy.ts`**: `przeliczGoraceTematy(ownerId,
  { force })`; Server Action staje się cienką nakładką (`requireAuth` → rdzeń → `visibleUsage`).
  *Gotowe, gdy:* zachowanie zakładki bez zmian, a rdzeń nie woła `requireAuth`.

- [x] **T-16** — **Etap 5 w zadaniu odświeżania** (AC-8, AC-9): po linii czasu, tylko gdy
  `pool.fetched > 0`, z `ctx.progress` i doliczeniem zużycia do wspólnego `sink`.
  *Gotowe, gdy:* po pobraniu materiałów zakładka pokazuje świeżą listę bez klikania.

- [x] **T-17** — **Odporność etapu 5** (AC-11): własny `try/catch` + `logEvent("warn", …)`; wyjątek
  **nie przerywa** przebiegu. Test jednostkowy dokładnie tego scenariusza.
  *Gotowe, gdy:* test dowodzi, że przy wyjątku z przeliczania przebieg kończy się sukcesem i zwraca
  policzone wiadomości.

## Faza 6 — Przyklejanie nagłówków tematów *(AC-20)*

- [x] **T-18** — **Zasłona liczona z WYSOKOŚCI, nie z pozycji**: `--view-bar-h` + `offsetHeight`
  paska modułu, zamiast odległości dolnej krawędzi paska od góry ramy (diagnoza w planie §5).
  *Gotowe, gdy:* pomiar PRZY PRZEWINIĘCIU ZERO pokazuje odstęp ≤ 4 px (punkt odniesienia z T-1).

## Faza 7 — Testy, teksty, domknięcie

- [x] **T-19** — **`messages/pl.json`**: nowe klucze, usunięcie osieroconych po „Odrzuć".
  *Gotowe, gdy:* `check:i18n` zielone.

- [x] **T-20** — **Klikacz: `wiadomosci-akcje.spec.ts`** (AC-1..AC-4, AC-21).
  *Gotowe, gdy:* zielone i sprawdzone w obie strony dla AC-1.

- [x] **T-21** `[P]` — **Klikacz: `potwierdzenia.spec.ts`** (AC-5, AC-6): oznaczenie → neutralny,
  usunięcie tematu → „Usuń".
  *Gotowe, gdy:* zielone i sprawdzone w obie strony dla AC-5.

- [x] **T-22** `[P]` — **Klikacz: aktualizacja `chrom-konta.spec.ts`** (AC-12, AC-19) — rząd chromu
  nad nawigacją, powiadomienie o koszcie niezależne od przełącznika.
  *Gotowe, gdy:* zielone.

- [x] **T-23** — **Pomiar AC-20 jako test** przy przewinięciu zero.
  *Gotowe, gdy:* test pada po przywróceniu miary pozycyjnej.

- [x] **T-24** — **`CLAUDE.md` i konstytucja (C-33)**: opis zasłony i miejsca rzędu chromu po zmianie;
  Wiadomości bez akcji „Odrzuć"; potwierdzenia z neutralną domyślnością (C-34).
  *Gotowe, gdy:* żaden dokument nie opisuje stanu sprzed zmiany.

- [ ] **T-25** — **Pełny przebieg bramek** na lokalnym Postgresie (C-13): wszystkie `check:*`,
  `tsc` ×2, `next lint`, `next build`, budżet wydajnościowy, testy jednostkowe.

- [ ] **T-26** — **Pełna suita klikacza** + powtórzenie pomiarów z T-1.

- [x] **T-27** — **`doświadczenia.md`** (C-51): co najmniej wpis o różnicy między miarą POZYCYJNĄ
  a WYSOKOŚCIOWĄ przy przyklejaniu (własny błąd z 085) oraz o domyślnej etykiecie potwierdzeń, która
  przez 54 wywołania kazała aplikacji pytać „Usuń?" o rzeczy nieusuwające.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 jedna akcja zamykająca | T-12 (dowód: T-20) | AC-12 koszty zawsze dla admina | T-8 (dowód: T-22) |
| AC-2 nie kasuje treści | T-12 | AC-13 nie-admin bez kosztów | T-8 |
| AC-3 podpowiedź akcji | T-12 | AC-14 techniczny log pod trybem | T-9 |
| AC-4 brak „Odrzuć" | T-11, T-12 | AC-15 zapas od wcięcia | T-10 |
| AC-5 neutralne potwierdzenie | T-13 (dowód: T-21) | AC-16 odstęp nad chipsami | T-3 |
| AC-6 usuwanie nadal czerwone | T-14 (dowód: T-21) | AC-17 kolejność w pasku | T-4 |
| AC-7 świadoma klasyfikacja | T-14 | AC-18 czytelny tytuł Pogody | T-5 (dowód: T-1) |
| AC-8 świeże gorące tematy | T-15, T-16 | AC-19 rząd chromu nad nawigacją | T-6 |
| AC-9 brak nowych = brak kosztu | T-16 | AC-20 przyklejanie nagłówków | T-18 (dowód: T-23) |
| AC-10 „wygenerowano" + ręczne | T-15 | AC-21 etykieta nawigatora | T-7 |
| AC-11 awaria nie cofa pobrania | T-17 | | |

## Ścieżka krytyczna

- `T-2` → `T-11` (najpierw dane, potem kod, który przestaje pisać stary status).
- `T-11` → `T-12` (akcja znika z serwera, zanim zniknie przycisk).
- `T-13` → `T-14` (odwrócenie domyślności przed przeglądem wywołań — inaczej przegląd nie ma czego
  klasyfikować).
- `T-15` → `T-16` → `T-17` (rdzeń → wpięcie → odporność).
- `T-1` → `T-18` → `T-23` (bez punktu odniesienia nie ma czego porównać).
- Wszystko → `T-19` → `T-20..T-23` → `T-24` → `T-25` → `T-26` → `T-27`.
- Równolegle: `T-3 ∥ T-4 ∥ T-5 ∥ T-7`, `T-10 ∥ T-8/T-9`, `T-21 ∥ T-22`.

## Notatki / blokady

- **T-14 jest najbardziej pracochłonny i najgroźniejszy.** 54 wywołania w 43 plikach, a błąd
  w klasyfikacji objawia się dopiero wtedy, gdy ktoś potwierdzi usunięcie, sądząc, że tylko coś
  oznacza. Klasyfikacja idzie wpis po wpisie i ląduje w `verify.md` — nie „przejrzałem i wygląda ok".
- **T-16/T-17 dokładają koszt do każdego przebiegu odświeżania.** Warunek `fetched > 0` jest jedyną
  rzeczą, która trzyma ten koszt w ryzach — test dla AC-9 nie jest formalnością.
- **T-18 to trzecia zmiana tej samej mechaniki w trzech przebiegach** (083, 085, teraz). Pomiar
  robimy przy przewinięciu ZERO, bo tam objawia się usterka; pomiar po przewinięciu pokazywał
  wartość poprawną i dlatego 085 przeszło weryfikację z tym błędem.
