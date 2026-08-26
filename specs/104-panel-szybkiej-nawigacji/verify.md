# Weryfikacja: Panel szybkiej nawigacji zamiast łukowego wachlarza

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (18/18)
- **Data:** 2026-08-26
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`) — produkcyjna baza NIE była dotykana (C-13).

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ następny wolny 0267 — **żadna migracja nie doszła** (feature nie rusza schematu) |
| `check:schema-drift` | ✅ brak rozjazdu — uruchomione **z** lokalną bazą, nie pominięte |
| `check:actions` | ✅ 164 akcje asystenta |
| `check:module-registry` | ✅ 22 moduły (z kontrolą szybkich celów z run 103) |
| `check:boundaries` | ✅ 4 przypadki |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:ui-contract` | ✅ 23/23 |
| `check:logs` · `check:client-safe` · `check:owner-columns` | ✅ · ✅ · ✅ |
| `check:route-gating` · `check:e2e-waits` · `check:tailwind` | ✅ · ✅ · ✅ |
| `check:test-types` | ✅ |
| `test:unit` | ✅ **1257 / 1257** |
| `next lint --dir src` | ✅ **0 błędów** |
| `next build` | ✅ **exit 0** |
| `check:perf` | ✅ w paśmie ±5 % — **próg bez zmian** |

**Klikacze** (`dolny-pasek-kotwice` + `ergonomia-nawigacji` + `chrom-konta` + `rama-i-chrom`):
**52 zdane, 1 niezdany, 1 pominięty.** Jedyny niezdany to `[085-AC4]` — Wiadomości, zależny od
sieci (puste kanały RSS), **udowodniony jako zastany** na commicie bazowym jeszcze w run 103.

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| AC-1 tap modułu prowadzi wprost | ✅ | klikacz `[104-AC1/AC2]` |
| AC-2 przytrzymanie nie otwiera warstwy | ✅ | `[104-AC1/AC2]` — palec trzymany **700 ms**, potem nawigacja i brak `role="dialog"`; `[104-AC21]` |
| AC-3 dom prowadzi wprost | ✅ | `PasekKciuka` — kotwica „dom" ma `naKlik={() => onModul("/")}` i żadnych uchwytów gestu |
| AC-4 przewijanie od ikony | ✅ | `[104-AC4]` — zero pozycji z `touch-action: none` |
| AC-5 sześć pozycji, kolejność | ✅ | test `pozycjePaska` + `[104-AC5]` (pięć kotwic + moduły) |
| AC-6 360 px, ≥ 44 px | ✅ | `[104-AC6]` — pomiar `getBoundingClientRect` każdej pozycji |
| AC-7 lustrzenie, środek neutralny | ✅ | trzy testy `stronyPaska` (obie ręce + niezmiennik odbicia) + `[104-AC7]` |
| AC-8 podpisy bez zawijania | ✅ | `STYL_PODPISU` — `nowrap` + `ellipsis` + `maxWidth: 100%` (PasekKciuka:219–220) |
| AC-9 panel zakotwiczony nad paskiem | ✅ | `[104-AC9/AC10]` |
| AC-10 pełne nazwy modułów | ✅ | `[104-AC9/AC10]` |
| AC-11 rozwijanie w miejscu | ✅ | `[104-AC11/AC12]` — `aria-expanded` false → true, bez zamiany ekranu |
| AC-12 wybór celu nawiguje | ✅ | `[104-AC11/AC12]` — `/shopping/stores` |
| AC-13 wyszukiwarka bez ogonków | ✅ | 8 testów `szukajCelow` + `[104-AC13]` („zalegle" → „Zaległe") |
| AC-14 sekcja „Ostatnie" | ✅ | `[104-AC14]` |
| AC-14a „Ulubione" w panelu | ✅ | `PanelNawigacji:156` — sekcja renderowana z `ulubioneDostepne` |
| AC-14b puste sekcje pomijane | ✅ | `PanelNawigacji:148,156` — `ostatnie.length > 0`, `ulubione.length > 0` |
| AC-15 Esc i klik poza zamykają | ✅ | `[104-AC15]` + `AnchoredLayer` (080) obsługuje oba |
| AC-16 uprawnienia w panelu | ✅ | `PasekKciukaPolaczony` — `moduly` **parametrem** z `resolveMenu`, `celeGlebiej(…, isPathLocked)`, `filterAccessibleFavorites` ×2 (linie 61, 66, 74) |
| AC-17 wysokość i przewijanie | ✅ | `[104-AC17]` — wysokość ≤ okno **i** sam panel nie przewija (nagłówek/stopka stoją) |
| AC-18 tap = krok wstecz | ✅ | `[104-AC18]` |
| AC-19 pusta historia = komunikat | ✅ | `[104-AC19]` |
| AC-20 brak gestu na „wstecz" | ✅ | `[104-AC19]` — brak `role="dialog"` po przytrzymaniu |
| AC-21 wachlarz zniknął | ✅ | `grep` — zero odwołań w `src/` i `e2e/` (poza komentarzem historycznym); `[104-AC21]` |
| AC-22 panel boczny bez regresji | ✅ | zestawy `rama-i-chrom` i `chrom-konta` — wszystkie zdane |
| AC-23 kotwic nie da się usunąć | ✅ | `MenuPrefsEditor` (kotwice nie są pozycjami listy) + `[104-AC23]` |
| AC-24 dostępność | ✅ | `aria-haspopup="dialog"` + `aria-expanded` na kotwicy, `role="dialog"` na panelu, `aria-expanded` na wierszu modułu, opisy czynności zamiast nazw zbiorów |
| AC-25 skórki, zero hexów | ✅ | `check:ui-contract` |

**Wynik: 25 / 25 ✅** (26 pozycji w tabeli — AC-14 rozbite na 14/14a/14b przy poprawce C-54).

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01 praca w `worldofmag/` | ✅ |
| C-10..C-14 migracje | ✅ — brak zmian schematu; potwierdzone bramką **przed** pierwszą zmianą kodu, nie założone |
| C-20/C-21 akcje i własność | ✅ — zero nowych akcji; panel wyłącznie czyta i nawiguje |
| C-22 RBAC | ✅ — trzy powierzchnie panelu przez ten sam filtr co reszta powłoki |
| C-30 zmienne CSS | ✅ |
| C-31 mobile, 44 px, safe-area | ✅ — sześć pozycji zmierzonych przy 360 px |
| C-32 teksty przez `t()` | ✅ |
| C-34 potwierdzenia | ✅ — brak nowych; zero `window.confirm` |
| C-35 komponent z konsumentem | ✅ **w obie strony** — panel dowieziony z wpięciem, a zastąpiony wachlarz **skasowany**, nie zostawiony |
| C-36 granice | ✅ — panel dostaje moduły **parametrem**; `platform/nawigacja` nadal nie zna modułów |
| C-51 doświadczenia | ✅ — dwa wpisy (cudzysłów zamykający, stała w `page.evaluate`) |
| C-53 minimalizm | ✅ — zero nowych zależności; panel na istniejącym `AnchoredLayer` |
| C-54 spójność artefaktów | ✅ — luka o sekcję „Ulubione" domknięta w specu/planie/zadaniach **przed** kodem; spec run 103 dostał przypis o zastąpionym AC-3 |

## 4. Regresje

- **Nawigacja boczna na komputerze** — `uchwytyLinku()` usunięte, pozycje wróciły do bycia zwykłymi
  `<Link>`. Zestawy `rama-i-chrom` i `chrom-konta` zdane w całości (AC-22).
- **Testy jednostkowe sąsiednich modułów** — 1257/1257.
- **Budżet wydajnościowy** — kasacja 425 linii wachlarza i dodanie panelu wyszły **na zero**: bramka
  w paśmie, próg bez zmian.
- **Brak zmian w schemacie** — wycofanie jest czysto kodowe.

## 5. Błędy znalezione i naprawione w trakcie

Trzy, wszystkie **niewidoczne dla `tsc`** — i to jest ich wspólna cecha warta odnotowania:

1. **`ref` przekazany do komponentu funkcyjnego (React 18).** Typ się zgadzał, kompilacja czysta,
   a prop po cichu znikał — React traktuje `ref` jako specjalny. `kotwicaRef.current` zostawało
   `null`, `AnchoredLayer` nie miał czego zmierzyć i **panel po prostu się nie otwierał**, bez
   błędu w konsoli. Prop nazywa się teraz `kotwicaRef`.
2. **Dwa zagnieżdżone kontenery przewijania.** `AnchoredLayer` sam ma `overflowY: auto`, więc
   przewijałby się ten zewnętrzny — wyszukiwarka i stopka odjeżdżałyby razem z listą. Panel wyłącza
   przewijanie warstwy i bierze je na siebie; klikacz sprawdza **obie** strony.
3. **Stała ze specu użyta wewnątrz `page.evaluate`.** Ta funkcja wykonuje się w przeglądarce, więc
   domknięcie nad zmienną z Node nie przechodzi przez granicę — `ReferenceError` w teście, który
   wygląda na pomiar układu.

Punkty 1 i 3 mają wpisy w `doświadczenia.md` (C-51).

## 6. Werdykt

**GOTOWE** — 25/25 kryteriów spełnionych, wszystkie bramki zielone, `next build` exit 0, budżet
wydajnościowy w paśmie bez podnoszenia progu, brak zmian w schemacie bazy. Jedyne czerwone
niepowodzenie klikaczy jest **zastane** i udowodnione porównawczo na commicie bazowym.
