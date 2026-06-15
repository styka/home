# Rozdział 38 — QA + E2E

## Kontekst / stan z kodu

- **Moduł QA:** `src/actions/qa.ts`; modele `QaEpic`, `QaUserStory`, `QaTestScenario` (Epic → Story →
  Scenario); autoring w `/admin/qa`, przegląd `/qa`.
- **E2E:** Playwright (`e2e/`), runbook `/admin/e2e`, skrypt `scripts/e2e-web.sh` (preinstalowany
  Chromium + lokalny Postgres, bez Dockera — dla sandboxa). **Login E2E offline-only** (`E2E_TEST_MODE=1`,
  nigdy na prod).
- **Strażniki buildu** (`check-action-coverage`, `check-migrations`) pełnią rolę „testów” spójności.

## Mocne strony

- **Strukturalne scenariusze QA** (Epic/Story/Scenario) jako narzędzie wewnętrzne.
- **E2E przygotowane pod sandbox** (offline login, preinstalowany Chromium) — przemyślane ograniczenia sieci.
- Strażniki buildu jako tania, automatyczna kontrola spójności.

## Głos Zespołu A — Strażnicy

**Ewa (QA):** „Mamy scenariusze QA **i** E2E, ale **nie są połączone** (Q1) ani **bramkujące w CI**
(Z-170). Scenariusz w bazie + test Playwrighta żyją osobno — powinno być: scenariusz → generowany/wiązany
test → wynik w CI. Inaczej QA to dokumentacja, nie kontrola jakości.”

**Michał (senior dev):** „Brak testów Server Actions na bazie (Z-174) i ścieżek krytycznych (auth,
płatności, izolacja) — to największa luka jakości (patrz Rozdz. 14).”

## Głos Zespołu B — Pionierzy

**Bartosz (QA, B):** „Zautomatyzujmy: **smoke E2E w CI** (Z-175, 10 ścieżek), a scenariusze QA niech
**generują szkielety testów** (Z-183). AI może pomóc pisać scenariusze i `data-testid` (Z-182).”

## Punkty sporne

- **QA w bazie vs w repo.** **Konsensus:** scenariusze mogą zostać w DB (autoring), ale **wynik wiązać z
  E2E w CI** — inaczej to dwa światy.

## Głos użytkowników

— (moduł wewnętrzny; użytkownik korzysta pośrednio przez stabilność produktu.)

## Konsensus i zalecenia

- **Z-430** *(P0 · S)* — **E2E smoke w CI** (Z-175) — bramka regresji ścieżek krytycznych.
- **Z-431** *(P1 · M)* — **Powiązać scenariusze QA z testami E2E** (Q1) — wynik scenariusza z realnego testu.
- **Z-432** *(P1 · S)* — **`data-testid` na elementach krytycznych** (Z-182) przed i18n — stabilne selektory.
- **Z-433** *(P2 · L)* — **Generowanie szkieletów testów ze scenariuszy QA** (Z-183), wspierane AI.

## Dobre vs złe praktyki

**Dobre:** strukturalne QA, E2E pod sandbox (offline login), strażniki buildu.
**Złe / do poprawy:** QA i E2E rozłączne, brak bramki CI, brak testów akcji/ścieżek krytycznych.
