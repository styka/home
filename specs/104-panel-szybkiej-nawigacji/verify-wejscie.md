# Wejście do `/verify` — mapowanie kryteriów na dowody (T-16)

Rodzaje dowodów: **T** = test jednostkowy, **K** = klikacz, **B** = bramka, **P** = przegląd kodu.

| AC | Dowód | Gdzie |
|----|-------|-------|
| AC-1 tap modułu prowadzi wprost | K | `[104-AC1/AC2]` |
| AC-2 przytrzymanie nie otwiera warstwy | K | `[104-AC1/AC2]`, `[104-AC21]` — palec trzymany 700 ms |
| AC-3 dom prowadzi wprost | P + K | `PasekKciuka` (`naKlik` → `onModul("/")`), `[104-AC21]` |
| AC-4 przewijanie od ikony | K | `[104-AC4]` — zero pozycji z `touch-action: none` |
| AC-5 sześć pozycji, kolejność | T + K | `pasekKciuka.test.ts`, `[104-AC5]` |
| AC-6 360 px, ≥ 44 px | T + K | test „sześć pozycji", `[104-AC6]` (pomiar `getBoundingClientRect`) |
| AC-7 lustrzenie, środek neutralny | T | trzy testy `stronyPaska` (obie ręce + niezmiennik odbicia) |
| AC-8 podpisy bez zawijania | P | `STYL_PODPISU` — `nowrap` + `ellipsis` + `maxWidth: 100%` |
| AC-9 panel zakotwiczony | K | `[104-AC9/AC10]` |
| AC-10 pełne nazwy modułów | K | `[104-AC9/AC10]` |
| AC-11 rozwijanie w miejscu | K | `[104-AC11/AC12]` — `aria-expanded` false → true |
| AC-12 wybór celu nawiguje | K | `[104-AC11/AC12]` — `/shopping/stores` |
| AC-13 wyszukiwarka bez ogonków | T + K | `szukajCelow.test.ts` (8 testów), `[104-AC13]` |
| AC-14 sekcja „Ostatnie" | K | `[104-AC14]` |
| AC-14a/AC-14b „Ulubione", puste pomijane | P | `PanelNawigacji` — `ostatnie.length > 0`, `ulubione.length > 0` |
| AC-15 Esc zamyka | K | `[104-AC15]` |
| AC-16 uprawnienia w panelu | P | `PasekKciukaPolaczony` — `moduly` parametrem, `celeGlebiej` + `filterAccessibleFavorites` ×2 |
| AC-17 wysokość i przewijanie | K | `[104-AC17]` — wysokość ≤ okno, `overflowY: auto` obecne |
| AC-18 tap = krok wstecz | K | `[104-AC18]` |
| AC-19 pusta historia = komunikat | K | `[104-AC19]` |
| AC-20 brak gestu na „wstecz" | K | `[104-AC19]` — brak `role="dialog"` |
| AC-21 wachlarz zniknął | B + K | `grep` (zero odwołań poza komentarzem historycznym), `[104-AC21]` |
| AC-22 panel boczny bez regresji | K | zestaw `rama-i-chrom` + `chrom-konta` |
| AC-23 kotwic nie da się usunąć | P + K | `MenuPrefsEditor` + `[104-AC23]` (ustawienia w stopce panelu) |
| AC-24 dostępność | P + K | `aria-haspopup="dialog"`, `aria-expanded`, `role="dialog"`, opisy czynności |
| AC-25 skórki, zero hexów | B | `check:ui-contract` |

## Stan bramek

`check:migrations` ✓ (bez nowej migracji) · `check:schema-drift` ✓ · `check:module-registry` ✓ ·
`check:boundaries` ✓ · `check:i18n` ✓ · `check:ui-contract` ✓ · `check:logs` ✓ ·
`check:client-safe` ✓ · `check:test-types` ✓ · `test:unit` **1257/1257** ✓ ·
`next lint --dir src` **0 błędów** · `next build` **exit 0** · `check:perf` ✓ (w paśmie, **próg bez
zmian** — kasacja 425 linii wachlarza i dodanie panelu wyszły na zero).

## Odkryte w trakcie i domknięte

1. **Luka we własnym specu (C-54).** Kasacja wachlarza zabierała gwiazdce jej listę zapisanych
   widoków (run 103 AC-8), a spec 104 o tym milczał. Dopisane AC-14a/AC-14b, plan i zadania
   przeliczone w dół; panel dostał sekcję „Ulubione".
2. **`switch` po rodzajach pozycji nie był wyczerpujący.** Dodanie wariantu `nawigacja` skompilowało
   się **bez błędu** — czyli siódmy rodzaj po prostu nic by nie narysował, a pasek z brakującą ikoną
   wygląda na wolno ładujący się, nie na zepsuty. Domknięte wariantem `never`.
3. **`\p{M}` wymaga flagi `u`, której główny `tsconfig` nie dopuszcza.** Zamienione na zakres
   `̀-ͯ`; przy okazji okazało się, że litera **ł nie ma rozkładu kanonicznego** i wymaga
   osobnej podmiany — bez niej „przeplyw" nie znajduje „Przepływ", czyli akurat ten przypadek,
   dla którego normalizacja powstała.
4. **W `ergonomia-nawigacji.spec.ts` nie było ani jednego testu gestu** (wszystkie dotyczą geometrii
   i chromu). Plan zakładał ich usunięcie — nie usunięto niczego, bo nie było czego: kasowanie
   działających testów „bo tak mówił plan" byłoby stratą pokrycia.
