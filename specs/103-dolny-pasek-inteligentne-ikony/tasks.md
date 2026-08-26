# Zadania: Dolny pasek — inteligentne ikony, gwiazdka, historia, drzewiasty wachlarz

- **Plan:** ./plan.md (103-dolny-pasek-inteligentne-ikony)
- **Status:** todo
- **Data:** 2026-08-26

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie jest małe, samodzielne i weryfikowalne. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych

- [x] **T-1** — **Brak migracji — potwierdź, nie zakładaj.** Plan §2 stwierdza, że schemat się nie
      zmienia (`UserMenuPref.tabBar`/`handedness` już są, historia żyje w `sessionStorage`).
      Zweryfikuj to jednym przebiegiem: `npm run check:migrations` i `npm run check:schema-drift`
      **przed** pierwszą zmianą kodu, żeby zielone na końcu nie było zasługą stanu zastanego.
      *Gotowe, gdy:* obie bramki przechodzą i w `prisma/migrations/` nie przybył żaden katalog.

## Faza 1 — Czysta logika (bez UI, testowalna jednostkowo)

- [x] **T-2** — **`SzybkiCelModulu` w deklaracji modułu.** `src/platform/registry.ts`: typ
      (`id`, `etykieta`, `href`, opcjonalna `Icon`) + pole `szybkieCele?: SzybkiCelModulu[]`
      w `ModuleDeclaration`, z komentarzem **dlaczego to pole NIE jest leniwe** (czyste dane + ikona,
      nie ma czego wciągać do grafu — inaczej niż `sideNav`/`ai`/`jobs`).
      *Gotowe, gdy:* `tsc --noEmit` czysto, `npm run check:boundaries` przechodzi.

- [x] **T-3** — **Skład paska jako czysta funkcja.** `src/lib/modules.tsx`: typ `PozycjaPaska`
      (`modul | dom | ulubione | historia`), stała `MAKS_MODULOW_W_PASKU = 2` **z zapisaną
      arytmetyką 360 px** (plan §5.1), funkcja `pozycjePaska(permissions, prefs, domDostepny)`
      zwracająca `{ dalekie, bliskie }`. `DEFAULT_TAB_BAR` → `["tasks","shopping"]`;
      `resolveTabBar` odsiewa `home` (jest kotwicą, nie pozycją modułową).
      *Gotowe, gdy:* funkcja jest czysta (bez Reacta, bez bazy) i eksportowana.

- [x] **T-4** — **Testy składu paska.** `src/lib/__tests__/modules.test.ts`: (a) pełne uprawnienia →
      `dom` + 2 moduły po stronie dalszej, `ulubione` + `historia` po bliższej, historia **ostatnia**
      (róg pod kciukiem); (b) `home` zamknięty uprawnieniem → kotwica domu znika, a miejsce
      przechodzi na trzeci moduł; (c) konto bez żadnego modułu → kotwice zostają, lista modułów
      pusta (AC-5); (d) `home` w zapisanym `tabBar` **nie** produkuje drugiej ikony domu.
      *Gotowe, gdy:* `npm run test:unit` zielony, `npm run check:test-types` czysto.

- [x] **T-5** `[P]` — **Czysta logika historii.** `src/platform/nawigacja/historia.ts`: typ
      `WpisHistorii { sciezka, etykieta, czas }`, `dopisz(lista, wpis, limit)` (scala powtórzenie tej
      samej ścieżki pod rząd, limit **12**, najświeższy pierwszy), `odczytaj()` / `zapisz()` na
      `sessionStorage` w `try/catch` — **brak pamięci to poprawny stan, nie błąd**.
      Platforma nie zna modułów: etykieta przychodzi **gotowa**, parametrem (C-36).
      *Gotowe, gdy:* plik nie importuje niczego z `@/modules/*` ani z Reacta.

- [x] **T-6** `[P]` — **Testy historii.** `src/platform/nawigacja/__tests__/historia.test.ts`:
      dedupe sąsiedniego powtórzenia (AC-15), przycięcie do limitu, kolejność „najświeższy pierwszy"
      (AC-11), zachowanie przy rzucającym `sessionStorage` (prywatne okno).
      *Gotowe, gdy:* `npm run test:unit` zielony.

- [x] **T-7** `[P]` — **Konwencja akcji-adresu.** `src/lib/nawigacja/akcjaZAdresu.ts`:
      `uzyjAkcjiZAdresu(nazwa) → { aktywna, zamknij }` — czyta `?akcja=<nazwa>`, `zamknij()` robi
      `router.replace` bez tego parametru (adres favouritowalny i działający z linku — AC-20; widok
      nie zostaje „zawieszony" w stanie otwartego formularza).
      *Gotowe, gdy:* hook nie używa `useSearchParams` w powłoce (tylko w widoku modułu) i typuje się
      czysto.

## Faza 2 — Powłoka: pasek, wachlarz, historia, gwiazdka

- [x] **T-8** — **Wspólny przełącznik ulubionego.** `src/components/favorites/useUlubioneBiezacego.ts`:
      `{ zapisany, przelacz }` na `addFavoriteView` / `removeFavoriteViewByPath` w `useTransition`
      + `router.refresh()` + toast z nazwą widoku; błąd (adres nie do zapisania, limit 30) → toast
      błędu i **stan bez zmian** (AC-9). Bieżący adres czytany z `window.location` w efekcie,
      **nigdy** przez `useSearchParams` (lekcja z 042 — granica Suspense w powłoce).
      *Gotowe, gdy:* hook nie woła `confirmDialog` (czynność jest odwracalna — C-34) i nie ma
      literałów PL (C-32).

- [x] **T-9** — **Rejestrator historii.** `src/components/shell/useHistoriaNawigacji.ts`: reaguje na
      zmianę `pathname`, składa etykietę (nazwa modułu z rejestru → etykieta ulubionego, jeśli adres
      jest zapisany → `suggestFavoriteLabel`), dopisuje przez `dopisz()` z T-5. Bieżąca strona **nie
      jest** pozycją historii.
      *Gotowe, gdy:* powrót na tę samą stronę nie mnoży wpisów, a odświeżenie strony historii nie
      gubi.

- [x] **T-10** — **Źródła wachlarza.** `src/components/shell/WachlarzNawigacji.tsx`: typ
      `ZrodloWachlarza { pozycje?, naTap?, ustawienia? }` i **wstecznie zgodna** sygnatura
      `uchwyty(href, zrodlo?)`. Źródło domyślne = moduły + tap nawigujący + doklejona **stała,
      ostatnia pozycja „Ustawienia paska"** (`/settings#menu`, AC-23).
      **Nie ruszaj trzech reguł z run 100:** przechwycenie wskaźnika dopiero przy otwarciu,
      poziom 1 dla pozycji modułowej zawsze ten sam (AC-21), zjadanie kliknięcia po wyborze.
      *Gotowe, gdy:* `uchwytyLinku()` w nawigacji bocznej działa bez zmiany wywołania.

- [x] **T-11** — **Poziom 2 ze scalenia.** Funkcja scalająca `szybkieCele` modułu z ulubionymi
      widokami tego modułu: **dedupe po `href`**, pierwszeństwo wpisu użytkownika (jego etykieta to
      jego decyzja), całość przez `filterAccessibleFavorites(..., isPathLocked)` (AC-16/AC-18/AC-22).
      Zostaje pułapka z run 100: moduł o adresie `/` jest prefiksem każdej ścieżki — nie wolno mu
      przypisać wszystkich ulubionych.
      *Gotowe, gdy:* test jednostkowy: moduł bez ulubionych → same cele (AC-17); z ulubionymi → suma
      bez duplikatu adresu.

- [x] **T-12** — **`PasekKciuka` na czterech rodzajach pozycji.** Przyjmuje `dalekie`/`bliskie`
      zamiast `ModuleDef[]`. Geometrię run 100 zostawiamy nietkniętą: dwa pojemniki `flex: 1`,
      magiczna ikona w **geometrycznym** środku, minimum 44 × 44 px dla każdej pozycji, większa ikona
      bliżej kciuka, lustrzenie wg ręki (AC-3, AC-4). Komponenty pozycji **na poziomie modułu**, nie
      w ciele `PasekKciuka` (inaczej wraca odmontowywanie i utrata `setPointerCapture`).
      Kotwice: **Dom** (tap → `/`, hold → wachlarz modułów), **Gwiazdka** (tap → `przelacz` z T-8,
      hold → wachlarz ulubionych; `aria-pressed`, pełna/pusta), **Historia** (tap → `router.back()`,
      hold → wachlarz historii; przy pustej liście wyszarzona + toast „nie ma dokąd wracać", AC-13).
      *Gotowe, gdy:* każda kotwica ma `aria-label` mówiący **co robi** (AC-27), zero hexów (C-30).

- [x] **T-13** — **Wpięcie w `AppShell`.** Gwiazdka **znika z górnego paska telefonu** (AC-10);
      montujemy rejestrator historii; `PasekKciuka` dostaje `pozycjePaska(...)`; wachlarz dostaje
      źródła i scaloną funkcję poziomu 2. Jeśli wariant `topbar` w `FavoriteStarButton` zostaje bez
      konsumenta — **usuń go** (martwe API we wspólnym komponencie jest gorsze niż jego brak, C-35
      czytane w drugą stronę); wariant `chrome` (komputer) zostaje nietknięty.
      *Gotowe, gdy:* na telefonie gwiazdki nie ma na górze i jest na dole; na komputerze bez zmian.

## Faza 3 — Moduły: szybkie cele i akcje-adresy

- [x] **T-14** — **`szybkieCele` w 22 deklaracjach** (`src/modules/*/module.ts`), 2–5 pozycji na
      moduł, wyłącznie adresy **istniejące** i mieszczące się w `routes` modułu. Nawigacyjne tam,
      gdzie moduł ma podstrony (Zakupy → Mapy sklepów / Kategorie / Produkty; Kuchnia → Przepisy /
      Plan / Spiżarnia; Zadania → Dziś / Zaległe / Tagi; Magazynowanie → Szukaj / Etykiety /
      Przepływ; Portfel → Budżety / Raporty; …), akcyjne (`?akcja=…`) tam, gdzie moduł ma na stronie
      głównej gotowy formularz dodawania.
      *Gotowe, gdy:* każdy zadeklarowany adres odpowiada istniejącej trasie w `src/app/`.

- [x] **T-15** — **9. kontrola w `scripts/check-module-registry.js`**: (a) każdy moduł deklaruje
      **co najmniej jeden** szybki cel — inaczej AC-17 przestaje być prawdą przy pierwszym nowym
      module; (b) każdy `href` mieści się w `routes` swojego modułu — cel prowadzący poza moduł to
      literówka albo obejście granicy (C-36). Kontrola musi **fałszywie nie przechodzić**: sprawdź ją
      sondą (tymczasowy zły `href` → bramka czerwona), tak jak `check:boundaries` sprawdza sam siebie.
      *Gotowe, gdy:* `npm run check:module-registry` zielony na prawdziwym drzewie i czerwony na sondzie.

- [x] **T-16** — **Konsumenci akcji-adresu (C-35).** `akcja=nowy-projekt` w Zadaniach (AC-19),
      `akcja=nowa-notatka` w Notatkach, `akcja=nowa-lista` w Zakupach, `akcja=nowy-nawyk`
      w Nawykach, `akcja=nowy-kontakt` w Kontaktach — każdy widok ma już stan `isAdding`
      lub odpowiednik, hook z T-7 podaje wartość początkową i sprząta adres przy zamknięciu.
      *Gotowe, gdy:* wejście wprost pod `/tasks?akcja=nowy-projekt` otwiera ten sam widok co wybór
      z wachlarza (AC-20).

## Faza 4 — Ustawienia i teksty

- [x] **T-17** — **Ekran ustawień paska.** `src/components/settings/MenuPrefsEditor.tsx`: sekcja
      dolnego paska dostaje `id="menu"` (cel `/settings#menu`), limit `MAKS_MODULOW_W_PASKU`
      i **zdanie o tym, czego usunąć się nie da** — dom, asystent, ulubione i historia są kotwicami
      (AC-24). `home` znika z listy modułów do dodania.
      `src/actions/menuPrefs.ts`: `tabBar` przycinany do nowego limitu i odsiewający `home`
      (walidacja po stronie akcji, bo kolumna to JSON i przyjmie cokolwiek) + `revalidatePath` (C-20).
      *Gotowe, gdy:* zapis z 5 modułami zostawia 2, a `/settings#menu` przewija do właściwej sekcji.

- [x] **T-18** — **Teksty w `messages/pl.json`** (C-32): wszystkie nowe napisy powłoki
      (`components.shell.PasekKciuka`, `components.shell.WachlarzNawigacji`,
      `components.shell.HistoriaNawigacji`), toasty gwiazdki i historii, opis w edytorze menu.
      *Gotowe, gdy:* `npm run check:i18n` zielony (od 097 to **reguła absolutna** — literał
      z polskimi znakami w komponencie wywala build) i każde `t("klucz")` ma wpis.

## Faza 5 — Bramki i domknięcie

- [x] **T-19** — **Bramki jakości, kolejno:** `check:module-registry` → `check:boundaries` →
      `check:i18n` → `check:logs` → `check:ui-contract` → `check:client-safe` → `check:test-types` →
      `npm run test:unit` → `next lint`.
      *Gotowe, gdy:* wszystkie zielone. Nie łataj bramki wyjątkiem w manifeście bez zapisanego powodu.

- [x] **T-20** — **`next build` na lokalnym Postgresie** (C-13 — **nigdy** prod `DATABASE_URL`;
      zatrzymujemy się **przed** `scripts/migrate.js`).
      *Gotowe, gdy:* build przechodzi do końca `next build`.

- [x] **T-21** — **Budżet wydajnościowy.** `npm run check:perf` po `next build`. Kod ląduje
      w **powłoce**, czyli na KAŻDEJ trasie, więc wzrost jest oczekiwany. Zmierz go, podnieś
      `src/lib/ui/perf-baseline.json` i **zapisz uzasadnienie**. Jeśli wzrost przekroczy ~15 kB —
      wróć do planu (§9): rejestrator historii idzie do pliku ładowanego dynamicznie.
      *Gotowe, gdy:* bramka zielona, a nowy próg ma podany powód.
      **Wynik: próg NIE wymagał zmiany** — najcięższa trasa 1172 kB (`/shopping/[listId]`), suma
      67 465 kB, wszystko w paśmie ±5 %. Kod powłoki dołożył mniej, niż wynosi tolerancja szumu
      aktualizacji zależności, więc podnoszenie progu byłoby zapisaniem nieistniejącego kosztu.

- [x] **T-22** — **Klikacze (e2e).** `nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`.
      Nowe/rozszerzone scenariusze dla gestu i paska; **nigdy `networkidle`** (aplikacja trzyma
      otwarty strumień zdarzeń — `check:e2e-waits`).
      *Gotowe, gdy:* zestaw przechodzi, a nowe scenariusze pokrywają AC z tabeli w T-23.

- [x] **T-23** — **Mapowanie AC → wynik** (wejście dla `/verify`): dla każdego z 27 kryteriów ze
      speca zapisz, **czym** zostało sprawdzone (test jednostkowy / klikacz / bramka / przegląd)
      i z jakim wynikiem. AC bez pokrycia = zadanie wraca do implementacji (C-54).

- [x] **T-24** — **Wpis do `doświadczenia.md`** (C-51), jeśli po drodze wyszedł nieoczywisty problem
      — po polsku, w formacie `## YYYY-MM-DD — tytuł` / `**Problem:**` / `**Rozwiązanie:**` /
      `**Lekcja:**`, zacommitowany razem ze zmianą.

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1 skład paska | T-3, T-12, T-13 |
| AC-2 moduły w pozostałych miejscach | T-3, T-12 |
| AC-3 360 px, cele ≥ 44 px | T-3, T-12, T-22 |
| AC-4 lustrzenie, środek neutralny | T-3, T-12 |
| AC-5 konto bez modułów | T-3, T-4, T-12 |
| AC-6 tap zapisuje | T-8, T-12, T-18 |
| AC-7 tap odwraca | T-8, T-12 |
| AC-8 hold → wachlarz ulubionych | T-10, T-12 |
| AC-9 błąd zapisu | T-8, T-18 |
| AC-10 gwiazdka znika z górnego paska | T-13 |
| AC-11 kolejność historii | T-5, T-6, T-12 |
| AC-12 skok z historii | T-10, T-12 |
| AC-13 pusta historia | T-12, T-18 |
| AC-14 tap = krok wstecz | T-12 |
| AC-15 brak powtórzeń, limit | T-5, T-6 |
| AC-16 historia a uprawnienia | T-11, T-12 |
| AC-17 drugi poziom bez ulubionych | T-11, T-14, T-15 |
| AC-18 scalenie bez duplikatów | T-11 |
| AC-19 „Nowy projekt" z gestu | T-14, T-16 |
| AC-20 ten sam adres z linku | T-7, T-16 |
| AC-21 poziom 1 zawsze ten sam | T-10 |
| AC-22 moduł bez uprawnienia | T-11 |
| AC-23 „Ustawienia paska" w wachlarzu | T-10, T-17 |
| AC-24 kotwic nie da się usunąć | T-17 |
| AC-25 skórki, zero hexów | T-12, T-19 |
| AC-26 ograniczenie ruchu | T-10, T-12 |
| AC-27 dostępność | T-12, T-22 |

## Ścieżka krytyczna

`T-2 → T-3 → T-12 → T-13` — deklaracja pola, skład paska, komponent paska, wpięcie w powłokę.
Wokół niej: `T-5/T-6` (historia) i `T-7` (akcja-adres) idą równolegle, ale muszą być **przed** T-12
i T-16. `T-14` blokuje `T-15` (bramka nie ma czego sprawdzać bez deklaracji) i `T-11` (poziom 2 nie
ma czego scalać). Faza 5 startuje dopiero po T-18 — bramka i18n czyta gotowe komponenty.

## Notatki / blokady
- Brak.
