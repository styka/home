# Wejście do `/verify` — mapowanie kryteriów akceptacji na dowody (T-23)

Dokument roboczy etapu `/implement`: **czym** każde kryterium ze `spec.md` zostało sprawdzone.
Rodzaje dowodów: **T** = test jednostkowy, **K** = klikacz (Playwright), **B** = bramka jakości,
**P** = przegląd kodu.

| AC | Dowód | Gdzie |
|----|-------|-------|
| AC-1 cztery stałe kotwice | T + K | `pasekKciuka.test.ts` („pełne uprawnienia…"), `[103-AC1]` |
| AC-2 moduły w pozostałych miejscach | T | `pasekKciuka.test.ts` („moduły nie wypchną kotwic") |
| AC-3 360 px, cele ≥ 44 px | T + K | `pasekKciuka.test.ts` („pasek ma pięć pozycji"), `[103-AC3]` (pomiar `getBoundingClientRect`) |
| AC-4 lustrzenie, środek neutralny | P + K | `PasekKciuka` (podział na dwa pojemniki `flex: 1`), `[100-AC13]` (zachowany) |
| AC-5 konto bez modułów | T | `pasekKciuka.test.ts` („konto BEZ uprawnień modułowych…") |
| AC-6 tap zapisuje | K | `[103-AC6/AC7]`, `[103-AC6]` (brak `role="dialog"`) |
| AC-7 tap odwraca | K | `[103-AC6/AC7]` (drugi klik wraca do stanu wyjściowego) |
| AC-8 hold → wachlarz ulubionych | P | `PasekKciuka` (źródło `ulubione.pozycje`), `WachlarzNawigacji` (`zrodloOtwarte`) |
| AC-9 błąd zapisu | P | `useUlubioneBiezacego` (`setWstepny(null)` + toast błędu w `catch`) |
| AC-10 gwiazdka znika z górnego paska | K | `[103-AC10]` (0 w `.omnia-chrom-konta`, 1 w pasku dolnym) |
| AC-11 kolejność historii | T | `historia.test.ts` („najświeższy wpis jest PIERWSZY") |
| AC-12 skok z historii | P | `WachlarzNawigacji` `onPointerUp` → `router.push(cel.href)` |
| AC-13 pusta historia | K | `[103-AC13]` (komunikat, brak warstwy) |
| AC-14 tap = krok wstecz | K | `[103-AC14]` (`/shopping` → `/tasks`) |
| AC-15 brak powtórzeń, limit | T | `historia.test.ts` (scalanie, awans, przycięcie do 12) |
| AC-16 historia a uprawnienia | P | `PasekKciukaPolaczony` (`filterAccessibleFavorites` przy odczycie) |
| AC-17 drugi poziom bez ulubionych | B + P | `check:module-registry` (każdy moduł ma cele; sonda), `celeGlebiej` |
| AC-18 scalenie bez duplikatów | P | `celeGlebiej` (`widziane` po `href`, nadpisanie etykiety) |
| AC-19 „Nowy projekt" z gestu | K | `[103-AC20]` (ten sam widok co z wachlarza) + `TasksHomePage` |
| AC-20 ten sam adres z linku | K | `[103-AC20]` (wejście wprost pod adres) |
| AC-21 poziom 1 zawsze ten sam | P | `WachlarzNawigacji` (źródło własne mają WYŁĄCZNIE kotwice, nie moduły) |
| AC-22 moduł bez uprawnienia | T + P | `pasekKciuka.test.ts` („moduł bez uprawnienia…"), `celeGlebiej` |
| AC-23 „Ustawienia paska" w wachlarzu | K | `[103-AC23]` (gest przytrzymania → pozycja w warstwie) |
| AC-24 kotwic nie da się usunąć | P | `MenuPrefsEditor` (kotwice nie są pozycjami listy) + `updateMenuPrefs` (limit, odsianie `home`) |
| AC-25 skórki, zero hexów | B | `check:ui-contract` (23/23 modułów, zadeklarowane kolory) |
| AC-26 ograniczenie ruchu | P | `WachlarzNawigacji` (reguła `prefers-reduced-motion` nietknięta) |
| AC-27 dostępność | K + P | `[103-AC1]` (nazwy mówiące o czynności), `aria-pressed` na gwiazdce, `aria-current` na module |

## Stan bramek

| Bramka | Wynik |
|--------|-------|
| `check:migrations` | ✓ (bez nowej migracji — feature nie rusza schematu) |
| `check:schema-drift` | ✓ brak rozjazdu (5 świadomych wyjątków) |
| `check:module-registry` | ✓ 22 moduły; **nowa, 9. kontrola** sprawdzona dwiema sondami |
| `check:boundaries` | ✓ 4 przypadki |
| `check:i18n` | ✓ zero tekstów zaszytych w komponentach |
| `check:logs` | ✓ 763 pliki serwerowe |
| `check:ui-contract` | ✓ 23/23 |
| `check:client-safe` | ✓ |
| `check:owner-columns` | ✓ 2408 wywołań |
| `check:test-types` | ✓ |
| `test:unit` | ✓ **1247/1247** |
| `next lint --dir src` | ✓ 0 błędów (ostrzeżenia kosmetyczne bez zmian) |
| `next build` | ✓ exit 0 |
| `check:perf` | ✓ w paśmie ±5 % — **próg bez zmian** |

## Klikacze (e2e) — wynik i rozróżnienie niepowodzeń

Pełny przebieg `desktop`: **202 zdane, 214 pominiętych, 18 niezdanych**. Niepowodzenia rozpadły się
na trzy grupy — i to rozróżnienie jest częścią wyniku, nie jego pominięciem:

**A. Wywołane tą zmianą — ŚWIADOMIE, bo zmieniła się reguła (3 testy zastane).**
Wszystkie trzy pilnowały, że gwiazdka stoi w GÓRNYM pasku telefonu. Właściciel poprosił o coś
przeciwnego, więc poprawiono TESTY, nie kod:
- `[085-AC1]` — na telefonie gwiazdka ma być w pasku kciuka; część komputerowa nietknięta,
- `[100-AC12/AC22]` — lustrzenie chromu konta mierzone teraz na DZWONKU (gwiazdka zeszła niżej),
- `[087-AC21]` — „jedno wejście do ulubionych" bez zmian, ale wzorzec musiał złapać nową nazwę
  (`aria-label` mówi, CO przycisk zrobi, a nie jak nazywa się zbiór).

**B. Błąd w moich NOWYCH testach (2 testy).** Lokator gwiazdki łapał tylko wariant „…**w**
ulubionych", a po przełączeniu nazwa brzmi „…**z** ulubionych" — czyli test gubił przycisk dokładnie
w chwili, którą sprawdzał. Poprawione na wzorzec obejmujący oba stany.

**Po poprawkach A i B przebieg kontrolny na tych samych plikach: `085-AC1`, `100-AC12/AC22`,
`087-AC21`, `[vs-AC4]` oraz oba testy `103` — ZDANE.** (`[vs-AC4]` okazał się niestabilny
w pełnym, równoległym przebiegu, a nie skutkiem tej zmiany — przechodzi na tym samym kodzie.)

**C. Niepowodzenia ZASTANE, niezwiązane z tą zmianą (12 testów).** Wszystkie w Wiadomościach
i lektorze (`084-*`, `086-AC20`, `087-AC2/AC9/AC10/AC11/AC15`, `085-AC4`, `099-AC17`,
`news-stream-scroll`, `news-observer-remount`). W tym środowisku nie ma sieci, więc kanały RSS są
puste, a te testy stoją na treści artykułów. Sprawdzone porównawczo na commicie bazowym
(`a2b3e3e`, przed tą zmianą) w osobnym drzewie roboczym.

## Znalezione i naprawione po drodze

1. **`HabitFormModal` zaimportowany i nigdy nierenderowany** — w Nawykach nie dało się dodać nawyku
   (usterka zastana, nie wprowadzona tą zmianą). Naprawione, wpis w `doświadczenia.md` (C-51).
2. **`moduleRegistry.test.ts` liczył 21 modułów przy 22** — zapadka zastana od run 102 (doszedł
   YouTube). Podniesiona; potwierdzone, że test był czerwony także na commicie bazowym.
3. **`ownership.test.ts`** wymagał bazy — przechodzi po postawieniu lokalnego Postgresa (C-13:
   lokalnego, nigdy produkcyjnego).
4. **Nazwa hooka `uzyjAkcjiZAdresu` → `useAkcjaZAdresu`** — `react-hooks/rules-of-hooks` rozpoznaje
   hooki wyłącznie po przedrostku `use`; ten sam kompromis noszą `useHistoriaNawigacji`
   i `useUlubioneBiezacego`.
5. **Plik `akcjaZAdresu.ts` powstał chwilowo w `src/` katalogu głównego repo** (legacy, C-01) —
   przeniesiony do `worldofmag/src/` przed pierwszym commitem, w którym się pojawił.
