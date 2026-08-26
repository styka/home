# Zadania: Panel szybkiej nawigacji zamiast łukowego wachlarza

- **Plan:** ./plan.md (104-panel-szybkiej-nawigacji)
- **Status:** done
- **Data:** 2026-08-26

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie jest małe, samodzielne i weryfikowalne. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych

- [x] **T-1** — **Brak migracji — potwierdź, nie zakładaj.** Plan §2: schemat się nie zmienia (nowa
      kotwica jest stała, cele są danymi w kodzie, historia w `sessionStorage`). Odpal
      `npm run check:migrations` i `npm run check:schema-drift` **przed** pierwszą zmianą kodu, żeby
      zielone na końcu nie było zasługą stanu zastanego.
      *Gotowe, gdy:* obie bramki zielone i w `prisma/migrations/` nie przybył żaden katalog.

## Faza 1 — Czysta logika (bez UI, testowalna jednostkowo)

- [x] **T-2** — **Szósta kotwica w typie i w składzie paska.** `src/lib/modules.tsx`: `PozycjaPaska`
      dostaje wariant `nawigacja`; `pozycjePaska` zwraca `bliskie = [ulubione, nawigacja, historia]`
      (kolejność „od środka na zewnątrz", więc po lustrzeniu historia ląduje w rogu pod kciukiem,
      a nawigacja między nią a gwiazdką).
      **Przy okazji poprawka C-54:** komentarz przy `MAKS_MODULOW_W_PASKU` twierdzi, że szósta
      pozycja zeszłaby do ~41 px — to pomyłka o jeden (41,7 px wypada przy **siedmiu**; sześć daje
      48,7 px). Wpisz prawdziwe liczby i zaznacz, że szóste miejsce idzie na **kotwicę**, nie na
      trzeci moduł, więc `MAKS_MODULOW_W_PASKU` zostaje 2.
      *Gotowe, gdy:* `tsc --noEmit` czysto.

- [x] **T-3** — **Testy składu i lustrzenia dla sześciu pozycji.** `src/lib/__tests__/pasekKciuka.test.ts`:
      sześć pozycji łącznie; kolejność strony kciuka `ulubione → nawigacja → historia`; róg pod
      kciukiem = historia, przeciwległy narożnik = dom — **dla obu rąk**, mierzone na wyniku
      `stronyPaska` (kolejność WYRENDEROWANA, nie lista przed lustrzeniem — lekcja z run 103).
      *Gotowe, gdy:* `npm run test:unit` zielony.

- [x] **T-4** `[P]` — **Wyszukiwanie celów jako czysta funkcja.** `src/lib/nawigacja/szukajCelow.ts`:
      filtrowanie modułów i ich celów jedną frazą, **bez uwzględniania wielkości liter i znaków
      diakrytycznych** (`normalize("NFD")` + odcięcie znaków łączących) — „zalegle" ma znajdować
      „Zaległe", inaczej wyszukiwarka działa tylko dla piszących z ogonkami. Wynik niesie
      przynależność celu do modułu, żeby dało się pokazać „Zadania — Zaległe".
      *Gotowe, gdy:* plik nie importuje Reacta ani Prismy.

- [x] **T-5** `[P]` — **Testy wyszukiwania.** `src/lib/nawigacja/__tests__/szukajCelow.test.ts`:
      dopasowanie bez ogonków w obie strony, dopasowanie po nazwie modułu **i** po nazwie celu,
      pusta fraza zwraca pełne drzewo, fraza bez trafień zwraca pustą listę, moduł bez celów.
      *Gotowe, gdy:* `npm run test:unit` zielony.

## Faza 2 — Powłoka: koniec gestu, nowa kotwica, panel

- [x] **T-6** — **Odebranie gestu ikonom modułów i domu.** `src/components/shell/PasekKciuka.tsx`:
      `PozycjaModulu` i kotwica „dom" to zwykłe przyciski z `onClick` → `router.push`. Usuń stamtąd
      `uchwyty(...)`, `touchAction: "none"` i `onContextMenu`.
      **`touch-action` jest częścią zadania, nie kosmetyką:** zostawiony po skasowanym geście nadal
      zjada przewijanie rozpoczęte na ikonie (AC-4) i objawia się jako „pasek się zaciął".
      Podpisy zostają, ale muszą być przycinane (`nowrap` + `ellipsis`), żeby przy 49 px nie
      zawinęły się do drugiego wiersza i nie rozepchnęły paska (AC-8).
      *Gotowe, gdy:* długie przytrzymanie ikony modułu kończy się przejściem do modułu i niczym więcej.

- [x] **T-7** — **Panel szybkiej nawigacji.** `src/components/shell/PanelNawigacji.tsx` na
      `AnchoredLayer` (`side="gora"`, `align="srodek"`, `role="dialog"`): pole wyszukiwania
      (autofocus) → sekcja „Ostatnie" (do 5 pozycji) → sekcja „Ulubione" → lista modułów rozwijana
      **w miejscu** (`aria-expanded`) → stopka z „Ustawienia paska".
      Wysokość ogranicza `AnchoredLayer` (`maxHeight`), lista dostaje własne `overflowY: auto`
      (AC-17). Wybór pozycji: zamknij panel i nawiguj. Rozwinięcie modułu to stan lokalny,
      **kasowany przy zamknięciu** — panel ma się otwierać zawsze tak samo.
      *Gotowe, gdy:* wszystkie trzy źródła (moduły, cele, historia) przechodzą przez filtr uprawnień.

- [x] **T-8** — **Nowa kotwica w pasku + wpięcie panelu.** `PasekKciuka` rysuje pozycję `nawigacja`
      (`aria-haspopup="dialog"`, `aria-expanded`), `PasekKciukaPolaczony` trzyma stan otwarcia
      i podaje panelowi dane (moduły z `resolveMenu`, cele przez `celeGlebiej`, historia).
      „Wstecz" traci gest: tapnięcie = `router.back()`, pusta historia = komunikat (AC-18..AC-20).
      *Gotowe, gdy:* przytrzymanie „wstecz" nie otwiera żadnej warstwy.

- [x] **T-9** — **Usunięcie łukowego wachlarza z całej aplikacji.** Skasuj
      `src/components/shell/WachlarzNawigacji.tsx`; wypnij go z `AppShell` (opakowanie + propsy);
      w `ModuleSidebar` usuń `uchwytyLinku()` — pozycje wracają do bycia zwykłymi `<Link>` (AC-22).
      *Gotowe, gdy:* `grep -r "WachlarzNawigacji" src/ e2e/` nie zwraca nic, a `tsc` jest czysty.

## Faza 3 — Ustawienia i teksty

- [x] **T-10** — **Ekran ustawień.** `MenuPrefsEditor`: zdanie o kotwicach wymienia teraz pięć
      pozycji (dom, asystent, ulubione, nawigacja, wstecz); liczba miejsc modułowych bez zmian (AC-23).
      *Gotowe, gdy:* opis zgadza się z tym, co widać w pasku.

- [x] **T-11** — **Teksty w `messages/pl.json`** (C-32): nazwa i opis nowej kotwicy, wszystkie napisy
      panelu (pole wyszukiwania, „Ostatnie", brak wyników, „Ustawienia paska"), komunikat pustej
      historii.
      *Gotowe, gdy:* `npm run check:i18n` zielony i każde `t("klucz")` ma wpis.

## Faza 4 — Bramki i domknięcie

- [x] **T-12** — **Bramki, kolejno:** `check:module-registry` → `check:boundaries` → `check:i18n` →
      `check:logs` → `check:ui-contract` → `check:client-safe` → `check:test-types` → `test:unit` →
      `next lint`.
      *Gotowe, gdy:* wszystkie zielone, bez tłumienia wyjątkiem w manifeście.

- [x] **T-13** — **`next build` na lokalnym Postgresie** (C-13 — **nigdy** prod `DATABASE_URL`;
      zatrzymujemy się **przed** `scripts/migrate.js`).
      *Gotowe, gdy:* build przechodzi do końca `next build`.

- [x] **T-14** — **Budżet wydajnościowy.** `npm run check:perf`. Kasujemy 425 linii wachlarza
      i dokładamy panel — bilans może wyjść **na minus**, a pasmo ±5 % działa **w obie strony**,
      więc spadek też wywala bramkę. Wtedy **obniż próg** w `src/lib/ui/perf-baseline.json`
      i zapisz powód: zapadka istnieje po to, żeby postęp został zapisany.
      *Gotowe, gdy:* bramka zielona, a każda zmiana progu ma uzasadnienie.

- [x] **T-15** — **Klikacze.** Rozszerz `e2e/specs/dolny-pasek-kotwice.spec.ts` o AC-1..AC-4
      (nawigacja wprost, brak warstwy, brak `touch-action`), AC-5/AC-6 (sześć pozycji przy 360 px),
      AC-9..AC-15 (panel), AC-20/AC-21 (koniec wachlarza). Z `ergonomia-nawigacji.spec.ts` usuń
      testy dotyczące łukowego wachlarza — znikają **razem z mechanizmem**, a nie zostają jako
      martwe asercje.
      *Gotowe, gdy:* zestaw przechodzi poza **zastanymi** niepowodzeniami udowodnionymi w run 103.

- [x] **T-16** — **Mapowanie AC → wynik** (wejście dla `/verify`): dla każdego z 25 kryteriów zapisz,
      czym zostało sprawdzone i z jakim wynikiem. AC bez pokrycia wraca do implementacji (C-54).

- [x] **T-17** — **Przypis w specu run 103** (C-54): jego AC-3 mówił o pięciu pozycjach jako suficie;
      dopisz jedno zdanie, że zastąpiło je AC-6 z run 104 (sześć pozycji, 48,7 px). Artefakty mają
      się nie rozjeżdżać.

- [x] **T-18** — **Wpis do `doświadczenia.md`** (C-51), jeśli po drodze wyszedł nieoczywisty problem.

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1 tap modułu prowadzi wprost | T-6, T-15 |
| AC-2 przytrzymanie nie otwiera warstwy | T-6, T-9, T-15 |
| AC-3 dom prowadzi wprost | T-6, T-15 |
| AC-4 przewijanie od ikony działa | T-6, T-15 |
| AC-5 sześć pozycji w kolejności | T-2, T-3, T-8 |
| AC-6 360 px, ≥ 44 px | T-2, T-15 |
| AC-7 lustrzenie, środek neutralny | T-2, T-3 |
| AC-8 podpisy bez zawijania | T-6, T-15 |
| AC-9 panel zakotwiczony nad paskiem | T-7, T-8 |
| AC-10 pełne nazwy modułów | T-7 |
| AC-11 rozwijanie w miejscu | T-7, T-15 |
| AC-12 wybór celu nawiguje | T-7, T-15 |
| AC-13 wyszukiwarka po modułach i celach | T-4, T-5, T-7, T-15 |
| AC-14 sekcja „Ostatnie" | T-7, T-8, T-15 |
| AC-14a/AC-14b sekcja „Ulubione", puste pomijane | T-7, T-8, T-15 |
| AC-15 Esc i klik poza zamykają | T-7, T-15 |
| AC-16 uprawnienia w panelu | T-7 |
| AC-17 wysokość i przewijanie panelu | T-7, T-15 |
| AC-18 tap = krok wstecz | T-8, T-15 |
| AC-19 pusta historia = komunikat | T-8, T-11 |
| AC-20 brak gestu na „wstecz" | T-8, T-15 |
| AC-21 wachlarz zniknął z aplikacji | T-9, T-15 |
| AC-22 panel boczny bez regresji | T-9, T-15 |
| AC-23 kotwic nie da się usunąć | T-10 |
| AC-24 dostępność | T-7, T-8, T-15 |
| AC-25 skórki, zero hexów | T-6, T-7, T-12 |

## Ścieżka krytyczna

`T-2 → T-6 → T-7 → T-8 → T-9` — typ i skład paska, odebranie gestu, panel, wpięcie kotwicy, dopiero
na końcu **kasowanie wachlarza** (dopiero wtedy nic go nie potrzebuje). `T-4/T-5` (wyszukiwanie) idą
równolegle, ale muszą być **przed** T-7. `T-3` można pisać zaraz po T-2. Faza 4 startuje po T-11 —
bramka i18n czyta gotowe komponenty.

## Notatki / blokady
- Brak.
