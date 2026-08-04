# Zadania: Granice modułów — Faza 1 (pionowy wycinek)

- **Plan:** ./plan.md (046-granice-modulow-faza-1)
- **Status:** w trakcie
- **Data:** 2026-08-04

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. `[P]` = można
> zrównoleglić.
>
> **Zasada nadrzędna tej fazy:** każdy commit przenoszący zawiera **wyłącznie** przenosiny
> i przepisane importy. Napotkany błąd naprawiamy **osobnym** commitem, przed albo po.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane

---

## Faza A — Narzędzie i szkielet platformy

- [x] **T-1** — Skrypt pomocniczy do przenoszenia zdolności: `git mv` + przepisanie importów
      (`@/lib/X` → `@/platform/Y/X`) w całym `src/`, z raportem liczby podmian.
      **Gotowe, gdy:** uruchomiony na sucho pokazuje spodziewaną liczbę plików do zmiany.
- [x] **T-2** — Szkielet `src/platform/` + `src/platform/ui/index.ts` re-eksportujący
      `components/ui` (plan §3 — świadomie re-eksport, nie przenosiny).
      **Gotowe, gdy:** `import { Button } from "@/platform/ui"` działa i `tsc` jest czysty.

## Faza B — Przeniesienie zdolności platformy (osobny commit na zdolność)

> Kolejność od najmniejszego promienia rażenia do największego — żeby skrypt z T-1 był sprawdzony
> na małym zbiorze, zanim ruszy 155 plików.

- [x] **T-3** — `lib/activity.ts` (0 importujących) + `lib/notifications.ts` (1) → `platform/`.
      **Gotowe, gdy:** `tsc` czysty.
- [x] **T-4** — `lib/audit.ts` (4), `lib/shortcuts/` (4), `lib/ownership.ts` (5), `lib/trash.ts` (6)
      → `platform/`.
- [x] **T-5** — `lib/favorites/` (11), `lib/viewState/` (18) → `platform/`.
- [x] **T-6** — `lib/server-utils.ts` (85) → `platform/auth/serverUtils.ts`.
- [x] **T-7** — `lib/permissions.ts` (91) → `platform/auth/permissions.ts`.
- [x] **T-8** — `lib/auth.ts` (155) → `platform/auth/session.ts`.
- [x] **T-9** — `lib/prisma.ts` (155) → `platform/db/prisma.ts`.
      **Gotowe, gdy:** po każdym z T-3…T-9 `tsc --noEmit` jest czysty, a `next build` przechodzi
      po ostatnim. **(AC-1)**

## Faza C — Moduły pilotażowe (osobny commit na moduł)

- [ ] **T-10** — **Truck** → `src/modules/truck/` (`actions/`, `ui/`, `lib/{ors,overpass,googleMaps}`).
      Trasa `app/truck/` cienka. `contract.ts` — dziś pusty eksport typów, bo **nikt go nie importuje**;
      istnieje jako granica, nie jako spis życzeń.
      **Gotowe, gdy:** `tsc` czysty, `/truck` otwiera się w klikaczu. **(AC-3, AC-12)**
- [ ] **T-11** — **Kontakty** → `src/modules/contacts/`. `contract.ts` eksportuje to, czego potrzebuje
      `lib/ai/executors/contactsExecutor.ts`; executor przechodzi na import kontraktu.
      **Gotowe, gdy:** executor nie importuje wnętrza modułu. **(AC-3, AC-5)**
- [ ] **T-12** — **Raporty** → `src/modules/reports/`. Konsumenci: panel admina, `AICommandSheet`,
      `agentTools`, `reportExecutor` — wszyscy przez `contract.ts`.
      **Gotowe, gdy:** żaden konsument nie sięga do wnętrza. **(AC-3, AC-5)**
- [ ] **T-13** — **QA** → `src/modules/qa/`. Konsumenci w `app/admin/qa/*` i `components/admin/qa/*`.
      **Gotowe, gdy:** granica moduł ↔ powierzchnia administracyjna trzyma. **(AC-3, AC-5)**

## Faza D — Egzekwowanie granic (zadanie 6 — **nieopcjonalne**)

- [ ] **T-14** — Reguła ESLint `no-restricted-imports` w `overrides` dla `src/modules/**`:
      import `@/modules/*/!(contract)` = błąd, komunikat po polsku wskazujący właściwą drogę.
      Import **własnego** wnętrza modułu musi przechodzić.
      **Gotowe, gdy:** test pozytywny (import własnego wnętrza) zielony. **(AC-4)**
- [ ] **T-15** — Druga reguła: `src/platform/**` nie importuje `@/modules/*` w ogóle — asymetria
      z rozdz. 7.1.
      **Gotowe, gdy:** test negatywny czerwieni lint. **(AC-2)**
- [ ] **T-16** — **Testy negatywne obu reguł.** Tymczasowy import wnętrza obcego modułu → lint
      czerwony; import `contract.ts` → zielony. Bez tego reguła może być składniowo poprawna
      i nic nie łapać.
      **Gotowe, gdy:** oba przypadki potwierdzone i cofnięte. **(AC-4, AC-5)**

## Faza E — Jedna deklaracja zamiast ośmiu list

- [ ] **T-17** — `src/platform/defineModule.ts` — typ deklaracji + funkcja pomocnicza
      (`String` + unia, zero enumów — C-12).
- [ ] **T-18** — `module.ts` dla czterech modułów pilotażowych.
- [ ] **T-19** — `src/platform/registry.ts` — scalanie deklaracji z tablicą przejściową
      `lib/modules.tsx`, plus test jednostkowy: żaden moduł nie ginie, brak duplikatów id.
      **Gotowe, gdy:** rejestr ma dokładnie 21 modułów. **(AC-8)**
- [ ] **T-20** — **Usunięcie** wpisów modułów pilotażowych z `lib/modules.tsx` i `lib/permissions.ts`.
      To jest sedno: deklaracja ma **zastąpić** listy, nie dołożyć dziewiątą.
      **Gotowe, gdy:** build i klikacz zielone przy usuniętych wpisach. **(AC-7)**
- [ ] **T-21** — Bramka `scripts/check-module-registry.js`: katalog w `src/modules/` bez `module.ts`
      lub `contract.ts` = błąd; deklaracja niekompletna = błąd; zduplikowane id = błąd.
      Wpięcie w `build` + skrót w `package.json`.
      **Gotowe, gdy:** test negatywny (usunięty `module.ts`) czerwieni build. **(AC-6, AC-9)**

## Faza F — Domknięcie

- [ ] **T-22** — Aktualizacja `src/lib/ui/view-contract.json` o nowe ścieżki modułów pilotażowych.
      **Gotowe, gdy:** `check:ui-contract` zielony (wywala się na nieistniejącym pliku, więc to jest
      realna weryfikacja przenosin).
- [ ] **T-23** — Komplet bramek na lokalnym Postgresie (C-13; `export` osobno dla `DATABASE_URL`
      i `DIRECT_URL`): `check:actions`, `check:ai-coverage`, `check:cost-badge`,
      `check:content-memory`, `check:migrations`, `check:ui-contract`, `check:schema-drift`,
      `check:module-registry`, `next lint`, `next build`, `test:unit`. **(AC-11)**
- [ ] **T-24** — Klikacz ścieżki szczęśliwej **25/25**. To jedyny dowód, że przeniesienie plików
      niczego nie zmieniło dla użytkownika. **(AC-10, AC-12)**
- [ ] **T-25** — `CLAUDE.md` + konstytucja: opis struktury `platform/`+`modules/` i reguły granic
      jako `C-36`. Bez tego następna sesja pozna regułę dopiero z czerwonego lintu (lekcja z 045b).
- [ ] **T-26** — Rozdz. 15 dokumentu architektury: wpis 046, statusy zadań 4–7, **jawna lista
      17 modułów czekających** i zdolności platformy odłożonych (`ai`, `llm`, `jobs`). **(AC-13)**
- [ ] **T-27** — Wpisy do `doświadczenia.md` (C-51).

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania | AC | Zadania |
|----|---------|----|---------|
| AC-1 | T-2…T-9 | AC-8 | T-19 |
| AC-2 | T-15, T-16 | AC-9 | T-21 |
| AC-3 | T-10…T-13 | AC-10 | T-24 |
| AC-4 | T-14, T-16 | AC-11 | T-23 |
| AC-5 | T-11…T-13, T-16 | AC-12 | T-10…T-13, T-24 |
| AC-6 | T-21 | AC-13 | T-26 |
| AC-7 | T-20 | | |

**Żaden AC nie został bez pokrycia.**

---

## Ścieżka krytyczna

```
T-1 (skrypt) → T-3…T-9 (zdolności platformy, rosnący promień rażenia)
                    ↓
              T-10…T-13 (moduły pilotażowe, osobny commit każdy)
                    ↓
        T-14/T-15 → T-16 (reguły granic + testy negatywne)
                    ↓
   T-17 → T-18 → T-19 → T-20 (deklaracja ZASTĘPUJE listy) → T-21 (bramka)
                    ↓
              T-22 → T-23 → T-24 (bramki i klikacz)
```

- **T-1 jest fundamentem** — bez sprawdzonego skryptu 486 podmian importu robi się ręcznie.
- **Kolejność T-3…T-9 nie jest przypadkowa:** od 0 importujących do 155. Skrypt musi być sprawdzony
  na małym zbiorze, zanim dotknie `prisma` i `auth`.
- **T-20 jest sednem całej fazy.** Bez usunięcia wpisów z list globalnych deklaracja jest dziewiątym
  miejscem, a nie zastąpieniem ośmiu — i cel „8 → 1" pozostaje niespełniony mimo zielonego builda.
- **T-16 decyduje, czy reguła granic cokolwiek znaczy.** Reguła bez testu negatywnego bywa
  składniowo poprawna i nie łapie niczego.

## Notatki / blokady

- **Poza zakresem, odnotowane w dzienniku:** 17 pozostałych modułów, zdolności platformy `ai`/`llm`/
  `jobs` (25/8/5 plików, 97/55/45 importujących) oraz zadanie 8 (asystent AI składany z deklaracji —
  dokument stawia je jako ostatnie w fazie, po wszystkich modułach).
- **Bez migracji.** Faza 1 nie dotyka schematu; `check:schema-drift` to potwierdzi.
