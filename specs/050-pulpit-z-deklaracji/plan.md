# Plan techniczny: Migawka pulpitu z deklaracji

- **Spec:** ./spec.md (050-pulpit-z-deklaracji)
- **Status:** draft
- **Data:** 2026-08-11

> **Zasada planu:** to jest **JAK**. Wzorcem jest kalendarz z 049 — pole w serwerowej części
> deklaracji, wkłady per moduł, składanie w warstwie kompozycji.

## 1. Podejście

Powtarzamy wzorzec, który w 049 zadziałał dla kalendarza, z jedną różnicą wymuszoną przez spec:
**najpierw dowód, potem przenosiny.** Trasa pulpitu składa dziś migawkę w miejscu, więc krok zero to
wyodrębnienie tych obliczeń do funkcji **bez zmiany struktury** — wtedy da się je zawołać i zrzucić
wynik. Dopiero mając punkt odniesienia rozbijamy je na wkłady modułowe.

Druga różnica wobec kalendarza: **uprawnienia**. Agenda kalendarza pytała każdy moduł bezwarunkowo;
pulpit wywołuje wkład tylko wtedy, gdy użytkownik ma uprawnienie modułu. Bramkowanie zostaje
w kompozycji — moduł nie dostaje prawa decydowania o własnej widoczności (C-22).

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Zero modeli, kolumn i migracji. Potwierdzą `check:schema-drift`
i `check:migrations` (numer nie rośnie).

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions.** Wkłady modułów to zwykłe moduły serwerowe (nie `"use server"`), tak
jak `calendar.ts` z 049 — biorą `userId` parametrem, nie od klienta. Trasa pulpitu jest komponentem
serwerowym i woła je bezpośrednio.

Zapytania **przenosimy bez przepisywania**: te same `where`, `select`, `take`, `orderBy`, te same
`try/catch` i te same wartości domyślne przy błędzie. To jest warunek AC-6.

## 4. RBAC / rejestr modułu (C-22)

Bez nowych slugów. Bramkowanie **zostaje w kompozycji** i jest teraz **wyprowadzone z rejestru**
zamiast wpisane ręcznie: dla każdego modułu wnoszącego wkład korzeń kompozycji sprawdza
`m.permission` z `MODULES` i pomija wkład, gdy użytkownik go nie ma. Dziś to dziesięć ręcznych
`if (has("module.x"))`; po zmianie jedna pętla, która nie może pominąć modułu przez przeoczenie.

Deklaracja zyskuje **jedno pole**, w części **serwerowej** (`ModuleServerContributions`):

```ts
/** Wkład modułu do migawki pulpitu. Leniwy — sięga do bazy. */
dashboard?: () => Promise<{ default: DashboardContributor }>;
```

**Nie w `module.ts`.** To jest bezpośrednia lekcja z 049: `module.ts` trafia do grafu klienta przez
`ModuleSidebar`, a leniwy `import()` zmienia moment ładowania, nie przynależność do grafu.

## 5. UI (C-30, C-31, C-32)

**Zero zmian w UI.** `HomePage` dostaje dokładnie te same propsy, tej samej treści, w tej samej
kolejności sekcji. Żadnego nowego komponentu ani tekstu.

## 6. AI / integracje

Nie dotyczy — zero nowych `AIAction` i read-tooli. Liczniki bramek muszą zostać bez zmian.

## 7. Kształt rozwiązania

### 7.1. Typy

- `src/platform/dashboard.ts` — **niewiedzący o module**:
  ```ts
  export interface DashboardContext { todayStart: Date; todayEnd: Date; teamIds: string[] }
  export type DashboardContributor<T = Record<string, unknown>> =
    (userId: string, ctx: DashboardContext) => Promise<T>;
  ```
  `ctx` niesie to, co dziś trasa liczy **raz** i podaje wszystkim blokom (granice dnia, zespoły
  użytkownika) — bez tego każdy wkład liczyłby je od nowa i `getUserTeamIds` poszłoby dziesięć razy
  do bazy zamiast raz.

- `src/modules/home/contract.ts` — typ **`DashboardSnapshot`**: dokładnie te pola `HomePageProps`,
  które wnoszą moduły (bez sesji, preferencji, aktywności i statystyk admina), plus
  **`EMPTY_SNAPSHOT`** z wartościami domyślnymi.
  **Dlaczego w kontrakcie Strony głównej:** to jej widok definiuje, czego potrzebuje. Moduł wnoszący
  dane musi znać ten kształt, więc importuje go **z kontraktu** (moduł → moduł, legalnie).
  Import jest **wyłącznie typowy**, więc znika przy kompilacji i nie powiększa grafu — a to jest tu
  warunek, nie ciekawostka (AC-7).

### 7.2. Wkłady modułowe

Jedenaście plików `src/modules/<x>/dashboard.ts`, każdy zwracający `Partial<DashboardSnapshot>`:

| Moduł | Co wnosi |
|---|---|
| shopping | `pendingItems` |
| tasks | `todayTasks`, `overdueTasks`, `todayTaskPreview` |
| notes | `pinnedNotes` |
| kitchen | `todayMeals`, `expiringSoon` |
| pets | `petCareDue`, `petAgenda` |
| flota | `vehiclesCount`, `vehicleAlerts` |
| portfel | `wallet` |
| languages | `languagesDue`, `languageDecks` |
| health | `healthUpcomingCount`, `healthUpcoming` |
| magazynowanie | `storageLowStock`, `storageExpiring` |
| reports | `recentReports` |

**Reports jest w tej liście świadomie.** Trasa liczy dziś liczbę raportów **wprost z Prismy**, razem
z filtrem dostępu — czyli sięga do danych modułu Raporty z pominięciem jego kontraktu. Przy okazji
tej przebudowy to sprzężenie znika.

### 7.3. Korzeń kompozycji

`src/lib/dashboardSnapshot.ts`:

```ts
export async function collectDashboardSnapshot(
  userId: string, permissions: string[], ctx: DashboardContext,
): Promise<DashboardSnapshot>
```

Iteruje `MODULE_SERVER`, dla każdego wkładu sprawdza uprawnienie z `MODULES`, woła równolegle
(`Promise.all`) i scala na `EMPTY_SNAPSHOT`. **Błąd pojedynczego wkładu nie wywala pulpitu** — dziś
każdy blok ma własny `try/catch` z wartościami zerowymi i to zachowanie zostaje; przeniesione
z ośmiu miejsc do jednego.

### 7.4. Trasa

`src/app/page.tsx` chudnie z 322 linii do ~70: sesja → uprawnienia → kontekst → migawka z korzenia
kompozycji → dane przekrojowe (aktywność, zaproszenia, statystyki admina, preferencje, ulubione) →
render. **Zero importów z `@/modules/*`** poza `HomePage` (widok Strony głównej — to jej trasa).

**Zostaje w trasie i to jest świadome:** `getRecentActivity`, `getPendingInvitationsCount`,
`adminStats` (liczniki użytkowników/zespołów/raportów dla admina), `getDashboardPrefs`,
`readFavoriteViews`. Żadne z nich nie należy do modułu — to dane konta i powierzchni admina.

## 8. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|---|---|---|
| `src/platform/dashboard.ts` | nowy | typ wkładu, bez wiedzy o module |
| `src/platform/registry.server.ts` | edycja | pole `dashboard` |
| `src/modules/home/contract.ts` | edycja | `DashboardSnapshot` + `EMPTY_SNAPSHOT` |
| `src/lib/dashboardSnapshot.ts` | nowy | korzeń kompozycji + bramkowanie uprawnieniem |
| `src/modules/<x>/dashboard.ts` | nowe ×11 | wkłady |
| `src/modules/<x>/module.server.ts` | edycja ×11 | pole `dashboard` |
| `src/app/page.tsx` | przepisanie | 322 → ~70 linii |
| `scripts/snapshot-ai-surface.ts` | edycja | zrzut migawki do punktu odniesienia |
| `scripts/fixture-calendar-surface.ts` | edycja | dane dla wszystkich jedenastu wkładów |
| `scripts/check-module-registry.js` | edycja | siódmy test (AC-9) |
| `CLAUDE.md`, `constitution.md`, `content/architektura/15-dziennik.md` | edycja | domknięcie Fazy 1 |

## 9. Bramki i weryfikacja (C-50)

Rytuał po każdym kroku: `tsc --noEmit` · `check:actions` (160) · `check:ai-coverage` (551) ·
`check:cost-badge` (35) · `check:content-memory` (35) · `next lint --dir src` ·
`check:module-registry` · `check:boundaries`. Na końcu `test:unit` + `next build` przeciw
**lokalnemu** Postgresowi (C-13).

**Nigdy `next build` ani `next dev` równolegle z klikaczami** — w 049 popełniłem ten błąd trzy razy;
za każdym razem dawał fałszywą diagnozę.

| AC | Jak sprawdzimy |
|---|---|
| AC-1 | wyodrębniona funkcja daje się zawołać ze skryptu; diff pokazuje przenosiny, nie przepisanie |
| AC-2 | zrzut zapisany **przed** rozbiciem, w `specs/050…/baseline-pulpit.json` |
| AC-3 | `MODULE_SERVER` ma `dashboard` dla jedenastu modułów |
| AC-4 | `grep "@/modules/" src/app/page.tsx` → tylko `HomePage` |
| AC-5 | zrzut dla użytkownika **bez** uprawnień = `EMPTY_SNAPSHOT`; wkład niewołany |
| AC-6 | porównanie zrzutu przed/po **wartość po wartości** |
| AC-7 | `next dev`: `Compiled /auth/signin` i `/` — nie powyżej 1771 / 1889 modułów |
| AC-8 | cztery liczniki bez spadku + `next build` exit 0 |
| AC-9 | test negatywny: podłożony import kontraktu w trasie pulpitu → bramka czerwona |
| AC-10 | wpis w rozdz. 15 |

## 10. Ryzyka techniczne i plan wycofania

| Ryzyko | Ograniczenie |
|---|---|
| **Zrzutu „przed" nie da się zrobić** (sesja, cookies) | wyodrębniona funkcja bierze `userId` i `permissions` **parametrem**, więc nie potrzebuje sesji — tak samo jak `collectCalendarEvents` |
| **Fixture nie pokrywa wszystkich jedenastu wkładów** → zrzut pełen zer i porównanie niczego nie dowodzi | fixture z 049 rozszerzamy o dane dla każdego wkładu; **zrzut z samymi zerami traktujemy jako brak dowodu**, nie jako sukces (lekcja z 049: pusty wynik zgadza się z pustym) |
| **Nowe pole powtórzy błąd z 049** (kod serwerowy w grafie klienta) | pole wyłącznie w `module.server.ts`; AC-7 mierzy graf, bo `next build` tego nie pokazuje |
| **Zmiana zachowania przy braku uprawnienia** | wkład niewołany = wartości z `EMPTY_SNAPSHOT`, czyli dokładnie dzisiejsze inicjalizatory `let x = 0` |
| **Równoległe wołanie wkładów zmieni kolejność zapytań** | wynik jest obiektem, nie listą — kolejność zapytań nie wpływa na treść; potwierdzi porównanie zrzutów |

**Rollback:** wyłącznie kod, brak migracji — `git revert` kroku albo całej fazy.

## 11. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — nie dotyczą: zero zmian schematu; build tylko lokalnie (C-13).
- [x] **C-20..C-25** — bez nowych akcji; **RBAC zostaje w kompozycji** i jest wyprowadzony z rejestru,
      więc nie da się pominąć modułu przez przeoczenie (C-22).
- [x] **C-30..C-32** — zero zmian w UI.
- [x] **C-36** — znika ostatnie miejsce, w którym moduł opisuje się poza swoim katalogiem; wkład
      serwerowy po serwerowej stronie deklaracji.
- [x] **C-53** — jedno nowe pole, jeden nowy typ, jeden korzeń kompozycji; wzorzec skopiowany
      z kalendarza, nie wymyślony od nowa.
- [x] **C-54** — jeśli któryś blok okaże się nienależeć do modułu, zostaje w kompozycji z powodem,
      a spec dostaje adnotację.
