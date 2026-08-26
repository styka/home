# Recenzja: Panel szybkiej nawigacji zamiast łukowego wachlarza

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-26
- **Zakres diffa:** `0c08876..HEAD` — 19 plików, **+1694 / −758** (z tego 758 usunięć to w większości
  skasowany `WachlarzNawigacji`).

## Metoda

Recenzja szukała czterech rzeczy w kolejności: poprawność, konwencje Omnii, uproszczenia/reuse,
bezpieczeństwo — z pominięciem tego, co `verify.md` już udowodniło pomiarem. Trzy najpoważniejsze
defekty tej zmiany zostały złapane **przez klikacze na etapie implementacji** i są opisane w
`verify.md` §5; recenzja skupiła się na tym, czego testy z natury nie widzą.

## Ustalenia

**Brak ustaleń blokujących. Brak ustaleń wymagających poprawki.**

### Sprawdzone i ODRZUCONE jako fałszywe alarmy

Zapisane, bo każde z nich wyglądało na problem i kosztowałoby czas przy następnym czytaniu diffa:

**`PanelNawigacji` montowany bez `md:hidden`.** Panel wisi w drzewie na każdej szerokości, więc na
komputerze wyglądał na zbędny koszt. Sprawdzone w kodzie: `AnchoredLayer` ma `if (!open ||
!zamontowany …) return null` (linia 140), a wszystkie jego efekty otwierają się na `if (!open)
return`. Zamknięty panel nie renderuje **niczego** i nie zakłada nasłuchiwaczy — montowanie go obok
paska jest bezkosztowe, a warunek `md:` byłby tu szumem.

**`galezie` przeliczane przy każdym renderze powłoki.** `celeGlebiej` biegnie dla 22 modułów bez
`useMemo`. Odrzucone świadomie: `moduly` przychodzi jako `enabled` z `resolveMenu`, liczone w
`AppShell` przy każdym renderze, więc **`useMemo` i tak by nie trafiło** — nowa tożsamość tablicy
unieważniałaby zapamiętanie. Realna praca to 22 przefiltrowania listy ulubionych (rząd
mikrosekund), a powłoka renderuje się przy zmianie trasy i otwarciu menu, nie przy pisaniu.
Dokładanie zapamiętywania, które nie zapamiętuje, byłoby abstrakcją bez efektu (C-53).

**Utrata zwrotu ogniskowania po zamknięciu panelu.** Sprawdzone: `AnchoredLayer` oddaje ognisko
kotwicy (linia 119–120), więc zamknięcie klawiszem `Esc` nie gubi miejsca — to jedna z czterech
rzeczy, dla których panel stoi na tym komponencie zamiast na własnej warstwie.

**Martwy kod po skasowanym wachlarzu.** `grep` po `ZrodloWachlarza`, `UchwytyPozycji`,
`PozycjaWachlarza`, `useWachlarz`, `uchwytyLinku` — **zero trafień** w `src/` i `e2e/`. Lint nie
zgłasza ani jednego nieużywanego importu w dotkniętych plikach.

## Zgodność z konwencjami

| Reguła | Ocena |
|---|---|
| C-01 praca w `worldofmag/` | ✅ |
| C-10..C-14 migracje | ✅ — brak zmian schematu; `check:schema-drift` uruchomiony **z bazą**, nie pominięty |
| C-12 zero enumów Prisma | ✅ — nie dochodzi żadna kolumna |
| C-20/C-21 akcje i własność | ✅ — feature nie dodaje ani jednej akcji ani trasy API; panel czyta i nawiguje |
| C-22 RBAC | ✅ — trzy powierzchnie panelu (moduły, cele, historia + ulubione) przez ten sam filtr co reszta powłoki |
| C-30 zmienne CSS | ✅ — `check:ui-contract` zielony; kolor modułu z `ModuleDef.color` |
| C-31 mobile, 44 px, safe-area | ✅ — sześć pozycji **zmierzonych** klikaczem przy 360 px; wiersze panelu `minHeight: 44` |
| C-32 teksty przez `t()` | ✅ |
| C-34 potwierdzenia | ✅ — brak nowych, zero `window.confirm` |
| C-35 **w obie strony** | ✅ — panel dowieziony z wpięciem, a zastąpiony wachlarz **skasowany**; to jest wzorcowe zastosowanie tej reguły w kierunku, w którym zwykle się o niej zapomina |
| C-36 granice | ✅ — panel dostaje moduły **parametrem**; `platform/nawigacja` nadal nie zna modułów; `check:boundaries` zielony |
| C-53 minimalizm | ✅ — zero nowych zależności; panel na istniejącym `AnchoredLayer` zamiast własnej warstwy |
| C-54 spójność | ✅ — luka o sekcję „Ulubione" domknięta w specu/planie/zadaniach **przed** napisaniem kodu; spec run 103 dostał przypis o zastąpionym AC-3 |

## Bezpieczeństwo

- **Brak nowych powierzchni serwerowych** — zero akcji, zero tras API, zero zmian w schemacie.
- **Panel nie jest obejściem RBAC** — moduły przychodzą już przefiltrowane (`resolveMenu`), a cele
  i wpisy historii przechodzą przez `filterAccessibleFavorites(…, isPathLocked)` **przy odczycie**.
- **Wyszukiwarka nie renderuje HTML** — wyniki trafiają do `<span>` jako tekst.
- **Brak logowania czegokolwiek wrażliwego** (C-41 nie dotyczy).

## Stan bramek

`check:migrations` ✓ · `check:schema-drift` ✓ · `check:actions` ✓ · `check:module-registry` ✓ ·
`check:boundaries` ✓ · `check:i18n` ✓ · `check:ui-contract` ✓ · `check:logs` ✓ · `check:client-safe` ✓
· `check:owner-columns` ✓ · `check:route-gating` ✓ · `check:e2e-waits` ✓ · `check:tailwind` ✓ ·
`check:test-types` ✓ · `test:unit` **1257/1257** ✓ · `next lint --dir src` **0 błędów** ·
`next build` **exit 0** · `check:perf` ✓ (w paśmie, **próg bez zmian**).

Klikacze: **52 zdane, 1 niezdany, 1 pominięty** — jedyny niezdany (`085-AC4`) jest zastany
i udowodniony na commicie bazowym w run 103.

## Uwagi na przyszłość (nie blokujące)

1. **Łańcuch `if (id === …)` w `MobileModuleSubNav`** (menu wysuwane telefonu) nadal duplikuje to,
   co dziś deklarują `szybkieCele`. Panel jest jego naturalnym następcą — migracja to osobne,
   świadome zadanie (C-36 zabrania rozbudowy tego łańcucha, nie nakazuje kasowania przy okazji).
2. **Zastana rywalizacja klikaczy o wspólne konto** (`favorites.spec` ↔ `view-state.spec`)
   i **dwanaście zastanych niepowodzeń w Wiadomościach** (brak sieci) — oba udowodnione na commicie
   bazowym w run 103, oba warte osobnej zmiany.

## Werdykt

**APPROVE** — zero ustaleń blokujących, zero poprawek naniesionych w recenzji (trzy defekty złapały
klikacze wcześniej i są już naprawione). 25/25 kryteriów akceptacji, wszystkie bramki zielone,
build exit 0, brak zmian w schemacie bazy — a więc i brak ryzyka migracyjnego przy wycofaniu.
