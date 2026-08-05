# Plan techniczny: Granice modułów — Faza 1, fala 2

- **Spec:** ./spec.md (047-granice-modulow-fala-2)
- **Status:** draft
- **Data:** 2026-08-05

> **Zasada planu:** to jest **JAK**. Wzorcem jest przebieg **046** — nie wymyślamy nowego sposobu,
> powtarzamy sprawdzony (C-53).

---

## 1. Podejście

Powtarzamy dokładnie wzorzec z 046: `git mv` + przepisanie importów skryptem, kontrola typów jako
dowód poprawności, `contract.ts` z tym (i tylko tym), czego potrzebują konsumenci z zewnątrz,
`module.ts` z `defineModule`, usunięcie wpisu z listy przejściowej i ze słownika uprawnień, **jeden
commit na moduł**. Wzorzec do naśladowania w kodzie: `src/modules/reports/` (najwięcej konsumentów)
i `src/modules/qa/` (granica moduł ↔ powierzchnia administracyjna).

Kolejność — od najmniejszego promienia rażenia do największego, tak jak w 046:

| # | Moduł | Akcje | Konsumenci z zewnątrz |
|---|-------|-------|------------------------|
| 1 | **Nawyki** | `habits.ts` (8 eksportów) | `habitsExecutor` |
| 2 | **Nauka języków** | `languageDecks.ts` (12) | `languageExecutor`, `agentTools`, pulpit |
| 3 | **Warsztaty** | `warsztat.ts` (23) | `warsztatExecutor`, `agentTools` |
| 4 | **Magazynowanie** | `storage.ts` (47) | `storageExecutor`, `agentTools`, pulpit |
| 5 | **Notatki** | `notes.ts` (15), `noteGroups.ts` (4) | `notesExecutor`, `agentTools` |
| 6 | **Flota** | `flota.ts` (13) | `flotaExecutor`, pulpit |
| 7 | **Zdrowie** | `health.ts` (14), `medications.ts` (8) | `healthExecutor`, `agentTools`, pulpit |

**Reguła własnych tras (doprecyzowanie po 046).** Trasa modułu w `src/app/<moduł>/` **może** importować
jego wnętrze aliasem — jest jego powierzchnią, nie obcym konsumentem, i nie podlega regule ESLint.
Kontrakt obowiązuje **konsumentów spoza modułu**: egzekutory asystenta, `agentTools`, pulpit
(`app/page.tsx`), powłokę. W 046 trasa Raportów przeszła na kontrakt „przy okazji" — nie churnujemy
tego z powrotem, ale nowych modułów już tak nie robimy.

---

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.** Fala przenosi pliki i przestawia importy. Potwierdzi to
`npm run check:schema-drift` w buildzie — nie jest to deklaracja, tylko sprawdzalny fakt.

---

## 3. Co przenosimy, a co świadomie zostaje

### 3.1. Pliki `lib/` — tylko te używane **wyłącznie** przez jeden moduł

| Plik | Decyzja | Powód |
|------|---------|-------|
| `lib/srs.ts` | → `modules/languages/lib/srs.ts` | używany tylko przez Nauka języków |
| `lib/wikilinks.ts` | → `modules/notes/lib/wikilinks.ts` | używany tylko przez Notatki |
| `lib/notes/searchRank.ts` | → `modules/notes/lib/searchRank.ts` | j.w. |
| `lib/flota.ts` | → `modules/flota/lib/flota.ts` | używany tylko przez Flotę |
| `lib/warsztat/catalog.ts` | → `modules/warsztaty/lib/catalog.ts` | używany tylko przez Warsztaty |
| **`lib/habitStats.ts`** | **ZOSTAJE** | używa go `actions/medications`, `actions/notifications`, `kitchenExecutor` i `lib/medicationSchedule` — to helper **wspólny**, nie własność Nawyków |
| **`lib/medicationSchedule.ts`** | **ZOSTAJE** | używa go `lib/calendar/collect` i `agentTools`; wciągnięcie go do Zdrowia zmusiłoby kalendarz (jeszcze nie moduł) do importu kontraktu Zdrowia dla czystej funkcji obliczeniowej |
| **`lib/health/queryDiag.ts`** | **ZOSTAJE** | mimo nazwy **nie należy do modułu Zdrowie** — używa go `actions/systemHealth` (diagnostyka bazy w panelu admina). Nazwa jest myląca; zmiana nazwy to zmiana zachowania w commicie przenoszącym, więc odkładamy |

**Testy jadą razem z kodem.** `lib/__tests__/{flota,flotaTco,wikilinks}.test.ts`,
`lib/notes/__tests__/searchRank.test.ts`, `lib/warsztat/__tests__/catalog.test.ts` przenoszą się do
`src/modules/<x>/__tests__/`. Bramka `check:test-types` (dodana w 046 dokładnie z tego powodu) złapie
zerwany import w teście — `tsc` sam by go nie zobaczył.

### 3.2. `actions/tags.ts` — **ZOSTAJE w `src/actions`**, choć wygląda na część Notatek

Tagi są **słownikiem współdzielonym**: obok Notatek używa ich `app/kitchen/recipes/page.tsx`
i `agentTools`. Wciągnięcie ich do modułu Notatki oznaczałoby, że Kuchnia zależy od kontraktu Notatek
dla słownika, który nie jest własnością żadnego z nich — czyli **zabetonowałoby przypadkowe
sprzężenie** zamiast je rozwiązać. Docelowe miejsce tagów to warstwa słowników platformy (razem
z kategoriami i jednostkami), a to jest osobne zadanie. Odnotowane w dzienniku.

Analogicznie: `actions/noteGroups.ts` **przenosimy** — grupy notatek mają jednego konsumenta poza
Notatkami (`agentTools` → `getNoteGroups`) i są bez wątpienia własnością modułu.

---

## 4. Kontrakty — co dokładnie wystawia każdy moduł

Kontrakt piszemy **po** sprawdzeniu, czego używa konsument, nie „na zapas" (C-36). Punkt wyjścia:

| Moduł | Kontrakt wystawia | Dla kogo |
|-------|-------------------|----------|
| Nawyki | operacje używane przez `habitsExecutor` | asystent |
| Nauka języków | `getDecks` (pulpit), `getDueCards`/`getStudyStreak` (`agentTools`) + operacje `languageExecutor` | pulpit, asystent |
| Warsztaty | `getMaintenanceOverview` (`agentTools`) + operacje `warsztatExecutor` | asystent |
| Magazynowanie | `getSuppliers`/`getLowStock`/`getExpiringStorage`/`getStorageAnalytics` (`agentTools`), `getLowStock`/`getExpiringStorage` (pulpit) + operacje `storageExecutor` | asystent, pulpit |
| Notatki | `getNoteGroups` (`agentTools`) + operacje `notesExecutor` | asystent |
| Flota | `getVehicles` (pulpit) + operacje `flotaExecutor` | pulpit, asystent |
| Zdrowie | `getHealthEvents` (pulpit), `getTestTrends` (`agentTools`) + operacje `healthExecutor` | pulpit, asystent |

**Kontrakt Magazynowania jest testem zasady.** Moduł ma **47 eksportów akcji**; kontrakt ma wystawić
kilkanaście, a nie wszystkie. Rozdz. 9 mówi wprost: kontrakt rosnący do kilkudziesięciu funkcji to
sygnał, że moduł robi za dużo — i to jest sygnał, który chcemy **zobaczyć**, a nie ukryć eksportując
całość.

---

## 5. Warstwa serwera (C-20, C-21)

**Bez zmian w treści akcji.** Pliki wędrują `git mv`, ich wnętrze zostaje bit w bit: `revalidatePath`
na końcu każdej mutacji, guardy dostępu i `ownerId`/`ownerTeamId` przenoszą się razem z kodem.
Sprawdzian: `check:ai-coverage` liczy dziś **550** akcji z zadeklarowanym zakresem i guardem —
po fali musi być **dokładnie tyle samo**. Spadek oznacza, że bramka przestała widzieć przeniesiony
plik (dokładnie ten błąd wykrył przebieg 046) albo że guard wyparował.

---

## 6. RBAC / rejestr (C-22)

Dla każdego przenoszonego modułu:
1. `module.ts` z `defineModule` — `id`, `label`, `href`, `permission`, `color`, `Icon`, `defaultEnabled`
   przepisane **jeden do jednego** z dotychczasowego wpisu w `src/lib/modules.tsx`.
2. Import deklaracji w korzeniu kompozycji `src/lib/modules.tsx` + dopisanie do `DECLARED`.
3. **Usunięcie** wpisu z `LEGACY` oraz z `PERMISSIONS` i z `legacyPermissionForPath`
   w `src/platform/auth/permissions.ts`.
4. Strażniki tras w `src/app/<moduł>/**` czytają uprawnienie z deklaracji
   (`hasPermission(session, xModule.permission)`), a nie ze stałej `PERMISSIONS`.

**Slugi w bazie i przypisania ról pozostają nietknięte** — przenosimy tylko miejsce, w którym slug
jest zapisany w kodzie. Kolejność w menu trzyma `MODULE_ORDER`, więc przeniesienie modułu **nie
zmienia jego pozycji** na pasku.

**Uwaga na `Icon`:** ikony znikają z importu w `src/lib/modules.tsx` razem z wpisem `LEGACY`
i pojawiają się w `module.ts`. Nieusunięty import to ostrzeżenie lintu, nie błąd — trzeba go
sprzątnąć ręcznie przy każdym module.

---

## 7. UI (C-30, C-31, C-32, C-33)

- Komponenty modułu: `src/components/<moduł>/` → `src/modules/<moduł>/ui/`.
- **`src/lib/ui/view-contract.json` musi dostać nowe ścieżki** w tym samym commicie — bramka
  `check:ui-contract` wywala się na nieistniejącym pliku, więc jest to realna weryfikacja przenosin,
  a nie formalność.
- Kontrola zaszytych kolorów obejmuje już `src/modules/*/ui` (dodane w 046), więc przenoszone widoki
  **nie wypadają** spod tej reguły. Jeśli któryś ma wpis w `colorExceptions` — ścieżkę trzeba
  zaktualizować, inaczej wpis stanie się „przestarzały", a plik nieudokumentowany.
- Zero zmian w treści komponentów: te same teksty PL, te same zmienne CSS, ten sam `ModuleView`.

---

## 8. AI / integracje (C-23)

- **Zero nowych `AIAction`, zero nowych read-tooli.** Zmienia się **wyłącznie ścieżka importu**
  w `src/lib/ai/executors/*.ts` i w `src/lib/ai/agentTools.ts`: z `@/actions/<moduł>` na
  `@/modules/<moduł>/contract`.
- `check:actions` musi dalej raportować **160** akcji, a `check:ai-coverage` — **550**.
- `lib/ai/**` zostaje w `src/lib` (przeniesienie do platformy to osobny przebieg, poza zakresem).
  Nie podlega regule granic, więc import kontraktu jest tam legalny — i o to chodzi.

---

## 9. Dług z przebiegu 046

### 9.1. Panel admina QA przez kontrakt (AC-5) — **osobny commit**
`src/app/admin/qa/page.tsx` woła `prisma.qaEpic.findMany` z zagnieżdżonym `include`. Kontrakt QA ma
już `getAllEpics`. Trzeba sprawdzić, czy kształt danych z `getAllEpics` pokrywa to, czego używa
`QaAdminTree`; jeśli nie — **rozszerzyć kontrakt QA**, a nie obchodzić granicę. To jest zmiana
zachowania (inny sposób pobrania danych), więc **nie może** iść w commicie przenoszącym.

### 9.2. Dane z seeda w środowisku klikaczy (AC-6) — **osobny commit**
`scripts/e2e-web.sh` odpala `npx prisma migrate deploy`, ale nie seed danych. Dokładamy istniejący
mechanizm (`npm run db:seed`), **nie** piszemy drugiego zestawu danych obok. Ryzyko: seed wydłuża
przebieg albo jest niekompatybilny z użytkownikami E2E — wtedy ograniczamy się do tego, czego testy
naprawdę potrzebują, i mówimy o tym wprost w `verify.md` (spec dopuszcza to w §9).

### 9.3. Odnotowanie stanu AC-6 z 046 (AC-7)
Po fali dziennik ma podać: ile modułów w `src/modules/`, ile na liście przejściowej, które to są.
Zaostrzenie bramki rejestru pozostaje poza zakresem — jest możliwe dopiero przy pustej liście.

---

## 10. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/{habits,languages,warsztaty,magazynowanie,notes,flota,health}/contract.ts` | nowy | granica modułu |
| `src/modules/…/module.ts` | nowy | deklaracja (`defineModule`) |
| `src/modules/…/actions/*.ts` | `git mv` z `src/actions/` | akcje modułu |
| `src/modules/…/ui/*.tsx` | `git mv` z `src/components/<moduł>/` | widoki modułu |
| `src/modules/…/lib/*.ts` | `git mv` z `src/lib/` | logika wyłącznie modułu (tabela §3.1) |
| `src/modules/…/__tests__/*.ts` | `git mv` | testy jadą za kodem |
| `src/lib/modules.tsx` | edycja ×7 | `DECLARED` rośnie, `LEGACY` maleje, importy ikon sprzątane |
| `src/platform/auth/permissions.ts` | edycja ×7 | usunięcie stałych i gałęzi ścieżek |
| `src/app/<moduł>/**/page.tsx` | edycja | uprawnienie z deklaracji; importy na nowe ścieżki |
| `src/app/page.tsx` (pulpit) | edycja | import przez kontrakty (Flota, Zdrowie, Magazynowanie, Języki) |
| `src/lib/ai/executors/*.ts`, `src/lib/ai/agentTools.ts` | edycja | import przez kontrakty |
| `src/lib/ui/view-contract.json` | edycja | nowe ścieżki widoków (+ `colorExceptions`) |
| `src/app/admin/qa/page.tsx` | edycja (osobny commit) | kontrakt zamiast `prisma` |
| `scripts/e2e-web.sh` | edycja (osobny commit) | seed danych do klikaczy |
| `content/architektura/15-dziennik.md` | edycja | wpis 047, statusy, lista pozostałych |
| `CLAUDE.md` | edycja | aktualizacja liczby przeniesionych modułów |
| `doświadczenia.md` | edycja | lekcje (C-51) |

---

## 11. Bramki i weryfikacja (C-50)

**Lokalnie (C-13):** lokalny Postgres 16 (`omnia_dev`), `DATABASE_URL`/`DIRECT_URL` **eksportowane
osobnymi instrukcjami** (`export A=…; export B=$A` w jednej linii nie widzi jeszcze `$A` — pułapka
z 045). Weryfikacja do kroku `next build`; `migrate.js` nieuruchamiany.

**Po każdym module:** `tsc --noEmit`, `check:ai-coverage` (liczba akcji **bez spadku**),
`check:module-registry`, `check:ui-contract`.
**Na końcu:** komplet bramek + `check:test-types` + `next lint` + `next build` + `test:unit` + klikacz.

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | Struktura katalogu każdego przeniesionego modułu; trasy nadal cienkie |
| AC-2 | `grep` po `src/lib/ai` i `src/app/page.tsx`: wszystkie importy modułów fali idą przez `/contract` |
| AC-3 | `grep` po `src/lib/modules.tsx` i `platform/auth/permissions.ts`: zero wystąpień przeniesionych modułów |
| AC-4 | Moduł pominięty → wpis w dzienniku z powodem (jeśli wystąpi) |
| AC-5 | `app/admin/qa/page.tsx` nie zawiera `prisma.`; drzewo epików nadal się renderuje (klikacz `scenario-qa-admin-create-hierarchy`) |
| AC-6 | Pełny zestaw klikaczy po dołożeniu seeda; porównanie liczby czerwonych z 19 sprzed fali |
| AC-7 | Rozdz. 15 dziennika po przebiegu |
| AC-8 | `e2e/specs/modules-happy-path.spec.ts` — 22/22 (21 modułów + odczyt rejestru) |
| AC-9 | Komplet bramek; **`check:ai-coverage` = 550 akcji, `check:actions` = 160** |
| AC-10 | `git show --stat` każdego commita przenoszącego: same rename + przepisane importy |

---

## 12. Ryzyka techniczne i plan wycofania

| Ryzyko | Skutek | Mitygacja |
|--------|--------|-----------|
| Moduł dzieli helper z modułem nieprzeniesionym | wciągnięcie cudzej logiki do modułu albo import przez granicę | tabela §3.1 rozstrzyga to **przed** przenosinami; helper wspólny zostaje w `src/lib` |
| Bramka pokrycia przestaje widzieć akcje | ciche osłabienie kontroli dostępu | po **każdym** module sprawdzamy liczbę 550; korzeń `src/modules/*/actions` dodany w 046 |
| Zerwany import w teście | `tsc` nie widzi, `test:unit` widzi po 40 s | `check:test-types` (046) — łapie od razu |
| Manifest kontraktu widoku wskazuje nieistniejący plik | build pada | aktualizacja ścieżek **w tym samym commicie** co przenosiny |
| Kontrakt Magazynowania puchnie do 47 funkcji | granica przestaje cokolwiek znaczyć | kontrakt piszemy z listy realnych wywołań konsumenta, nie z listy eksportów |
| Seed w klikaczach destabilizuje przebieg | fałszywe czerwone | jeśli seed nie współgra, ograniczamy zakres danych i raportujemy wprost |

**Rollback:** wyłącznie kod, brak migracji. Każdy moduł to osobny commit, więc wycofanie pojedynczego
modułu to `git revert` jednego commita bez dotykania pozostałych.

---

## 13. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — bez zmian schematu, bez migracji; potwierdza `check:schema-drift`
- [x] **C-20, C-21** — treść akcji nietknięta; `revalidatePath` i guardy jadą razem z kodem
- [x] **C-22** — slugi bez zmian; przenosi się tylko miejsce ich zapisania w kodzie
- [x] **C-23** — zero nowych `AIAction`; egzekutory przechodzą na kontrakty; `check:actions` = 160
- [x] **C-30..C-33** — komponenty bez zmian; kontrola kolorów i kontrakt widoku obejmują `src/modules`
- [x] **C-36** — kontrakt jako jedyne wejście z zewnątrz, wnętrze ścieżką względną, jedna deklaracja
- [x] **C-53** — powtarzamy wzorzec z 046; jedyne nowe rzeczy to spłata dwóch nazwanych długów
- [x] **C-54** — odstępstwa od planu odnotowujemy tutaj **przed** kodem
