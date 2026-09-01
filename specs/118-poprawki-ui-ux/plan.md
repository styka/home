# Plan techniczny: Paczka poprawek UI/UX ze zgłoszeń administratora

- **Spec:** ./spec.md (118-poprawki-ui-ux)
- **Status:** draft
- **Data:** 2026-09-01

> **Zasada planu:** to jest **JAK**. Plan pisze się pod istniejący kod — wzorce zostały odczytane
> z modułów Tasks, Rośliny i powłoki; żadnych nowych wzorców tam, gdzie istnieje utarty (C-53).

## 1. Podejście (2–4 zdania)

Siedem niezależnych, małych zmian w istniejących plikach + jedna kolumna w `UserMenuPref` (jedyna
zmiana schematu). Wzorce: modal = istniejący prymityw `Modal` (Radix, `components/ui/Modal.tsx`)
tak jak `ShareDialog`; preferencja zwinięcia menu = wzorzec `favoritesCollapsed`/`handedness`
(nośnik `UserMenuPref`, bo powłoka i tak czyta tę tabelę na każdej stronie); deep-link zadania =
istniejące wejście `?task=<id>` czytane przez `TasksRouteView`. Kluczowe fakty z rekonesansu:
`submitFeedbackTask` **już zwraca `taskId`**, `createSpace` **już przyjmuje `weatherLocationId`**,
akcja `getWeatherOptions()` **już istnieje** w `modules/rosliny/actions/przestrzenie.ts` —
większość poprawek to dolot istniejących zdolności do UI.

## 2. Model danych (Prisma)

Jedna zmiana: **`UserMenuPref.sidebarCollapsed Boolean @default(false)`** (zgł. 11) — obok
`favoritesCollapsed` i `handedness`, z tym samym uzasadnieniem nośnika (zero dodatkowych zapytań).

- **Migracja (C-10, C-11):** numer z `npm run next:migration` → **0288** (zweryfikować przed
  utworzeniem, inne sesje mogły zająć). Katalog `prisma/migrations/0288_sidebar_collapsed/`:
  ```sql
  ALTER TABLE "UserMenuPref" ADD COLUMN "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false;
  ```
- Zero enumów (C-12) — kolumna boolowska. Reszta feature'a: **bez zmian w schemacie**.

## 3. Warstwa serwera (Server Actions — C-20)

- `src/actions/menuPrefs.ts` — rozszerzyć `MenuPrefs` (typ w `src/lib/modules.tsx` +
  `defaultMenuPrefs()`), `readMenuPrefs` i `updateMenuPrefs` o `sidebarCollapsed?: boolean`.
  `updateMenuPrefs` już kończy się `revalidatePath`; guard = istniejący (per-user, `userId` z sesji).
- `src/modules/rosliny/actions/przestrzenie.ts` — **bez zmian** (`createSpace` przyjmuje
  `weatherLocationId`, `getWeatherOptions()` istnieje). Wołamy je tylko z nowych miejsc UI.
- `src/modules/tasks/ai/executor.ts` (gałąź `submit_feedback`, ~linia 40) — zmienić
  `navigateTo: \`/tasks/${res.projectId}\`` na `\`/tasks/${res.projectId}?task=${res.taskId}\``
  (`res.taskId` już jest w typie zwrotki `submitFeedbackTask`). To nie jest Server Action tylko
  egzekutor — żadnych zmian w `revalidatePath`.
- Żadnych zmian własności/guardów (C-21) — nie dotykamy dostępu do zasobów.

## 4. RBAC / rejestr modułu (C-22)

Bez zmian — istniejące slugi (`module.tasks`, `module.rosliny`), żadnych nowych tras ani wpisów
w `permissions.ts`/`modules.tsx`/manifeście widoków (nie dodajemy katalogów tras).

## 5. UI (C-30, C-31, C-32)

Wszystkie nowe teksty → `messages/pl.json` przez `useTranslations` (C-32, bramka `check:i18n`);
kolory wyłącznie przez zmienne CSS (C-30).

**(a) Zgł. 1 — filtr etykiet w jednym wierszu.** `src/modules/tasks/ui/TaskFilters.tsx`: scalić
dwa wiersze w JEDEN — rząd zakładek statusu (`flex-1 min-w-0 overflow-x-auto`) + `FiltrTagow`
po prawej (`ml-auto shrink-0`). `FiltrTagow` zdejmuje własny padding wiersza (`px-3 py-1.5` →
neutralny), chipy wybranych etykiet zostają w tym samym rzędzie (przewijane w bok — stała
wysokość, lekcja 083/100). Gdy `showStatusTabs=false` (Kanban), filtr zostaje sam w rzędzie.
Semantyka filtru (koniunkcja w `TasksPage`) — nietknięta.

**(b) Zgł. 2 — dodawanie zadania przez modal (decyzja właściciela).**
- Nowy `src/modules/tasks/ui/ModalDodaniaZadania.tsx`: `Modal` (title z `pl.json`) opakowujący
  istniejący `FormularzZadania` (przekazuje `projectId`, `onCreated` → zamknij modal + odpal
  dotychczasowe `setJustCreated/setOpenTaskId/setFocusedTaskId`). Autofocus na polu treści po
  otwarciu (uchwyt `FormularzZadaniaHandle.focus`). Mobile: `Modal` już jest bottom-sheetem
  z `safe-area-inset-bottom` (C-31).
- `TasksPage.tsx`: usunąć inline `<QuickAddTask/>` (linie ~923–927); stan `dodawanie`;
  przycisk „+ Dodaj zadanie" (ikona `Plus` + etykieta, `whitespace-nowrap`) w rzędzie
  filtrów/paska narzędzi; skróty `a`/`n` (miejsce, które dziś woła
  `quickAddRef.current?.focus()`, ~linia 519) otwierają modal. `QuickAddTask.tsx` — skasować,
  jeśli po zmianie nie ma konsumentów (nakładka C-35 traci rację bytu); `FormularzZadania`
  zostaje (drugi konsument: `SzybkieDodanieZadania` na `/tasks` — **bez zmian**, to karta na
  stronie modułu, nie widok listy).
- Sprawdzić e2e (`e2e/`) pod kątem scenariuszy wpisujących w inline pole dodawania — dostosować.

**(c) Zgł. 3/5/8/9 — łamanie ikona/etykieta (jeden defekt, dwa wspólne miejsca + audyt).**
- `src/components/ui/Button.tsx`: do `base` dodać `whitespace-nowrap` (przycisk to etykieta,
  nie akapit; kontenery akcji mają `flex-wrap`, więc zawija się cały przycisk-klocek).
- `src/modules/rosliny/ui/style.ts`: `przycisk` dostaje `display: "inline-flex",
  alignItems: "center", gap: 6, whiteSpace: "nowrap"` (dziedziczy `przyciskGlowny`);
  `naglowekSekcji` dostaje `display: "flex", alignItems: "center", gap: 6` — tekst nagłówka
  łamie się we własnej kolumnie, nigdy pod ikonę. Po zmianie usunąć zbędne
  `verticalAlign/marginRight` z ikon w plikach modułu Rośliny (audyt `RoslinyPage`,
  `PrzestrzenPage`, `RoslinaSzczegol`, `AgendaOpieki`, `Ewidencja`, `KatalogGatunkow`).
  Uwaga na `<Link style={przycisk}>` („Całe zestawienie") — `inline-flex` mu nie szkodzi.
- Przegląd regresji AC-9: paski akcji Pogody/Wiadomości/Magazynowania używają własnych klas —
  zmiana `Button.tsx` dotyka tylko konsumentów prymitywu (sprawdzić galerię playground).

**(d) Zgł. 4 — akcje Roślin w modalach.** `PrzestrzenPage.tsx`: sekcje `formularz === "roslina"`
i `formularz === "miejsce"` przenieść do `Modal` (stan `formularz` zostaje, `{formularz ===
"roslina" && <Modal …>}` — wzorzec `{show && <Modal/>}` z prymitywu). Sekcja ustawień (gear,
lokalizacja+usuń) zostaje sekcją — to slot `settings` ramy (C-33), nie akcja; zgłoszenie
dotyczyło rzędu akcji.

**(e) Zgł. 6 — lokalizacja pogodowa przy tworzeniu przestrzeni.** `src/app/rosliny/page.tsx`:
dołożyć `getWeatherOptions()` do `Promise.all` i przekazać do `RoslinyPage`. W formularzu
tworzenia (`RoslinyPage.tsx`) opcjonalny `<select>` lokalizacji (pusta lista → pole się nie
renderuje — brak lokalizacji nie blokuje, jak w `PrzestrzenPage`); `createSpace({ …,
weatherLocationId })`; optimistic wpis listy dostaje wybraną wartość.

**(f) Zgł. 7 — objaśnienie „Pokaż zaawansowane".** `PrzestrzenPage.tsx` i `RoslinaSzczegol.tsx`:
przycisk dostaje `title` + `aria-label` z krótkim opisem CO odsłania (tekst per widok
z `pl.json`, np. „Pokazuje pola zaawansowane: liczność, fazę rozwoju i powierzchnię miejsc");
zestaw pól odsłanianych — bez zmian (reguła w `lib/tryb` nietknięta).

**(g) Zgł. 11 — zwijanie menu bocznego.** `src/components/shell/ModuleSidebar.tsx`:
- przycisk zwiń/rozwiń (chevron, `aria-pressed`, tooltip) w rzędzie ikon chromu konta nad
  nawigacją (miejsce z 085/086);
- stan z `menuPrefs.sidebarCollapsed`, optymistycznie w `useState`, zapis `updateMenuPrefs({
  sidebarCollapsed })` (dokładny wzorzec `favoritesCollapsed`);
- zwinięte: szerokość przez nadpisanie `width` (wartość zwężona, np. 64px, zamiast
  `var(--sidebar-width)`), pozycje = same ikony 44×44 wyśrodkowane z `title` (nazwa modułu),
  etykiety/liczniki/sekcja ulubionych ukryte, „Więcej…" jako ikona; dostępność: `aria-label` na
  pozycjach. Dotyczy tylko `hidden md:flex` — mobile nietknięty (C-31). Układ „poziomy pasek"
  (`ukladNawigacji`) — przełącznik zwijania renderujemy tylko w układzie sidebar.

## 6. AI / integracje (C-23, C-40)

Żadnych nowych `AIAction` (zmiana w istniejącej gałęzi `submit_feedback` nie zmienia typu akcji —
`check:actions` bez zmian). Kalendarz/powiadomienia/trash — nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0288_sidebar_collapsed/migration.sql` | nowy | kolumna `sidebarCollapsed` (zgł. 11) |
| `prisma/schema.prisma` | edycja | `UserMenuPref.sidebarCollapsed` |
| `src/actions/menuPrefs.ts` | edycja | odczyt/zapis `sidebarCollapsed` |
| `src/lib/modules.tsx` | edycja | typ `MenuPrefs` + `defaultMenuPrefs()` |
| `src/components/shell/ModuleSidebar.tsx` | edycja | przełącznik + wariant zwinięty (zgł. 11) |
| `src/components/ui/Button.tsx` | edycja | `whitespace-nowrap` w bazie (zgł. 5/8/9) |
| `src/modules/rosliny/ui/style.ts` | edycja | flex+nowrap w `przycisk`, flex w `naglowekSekcji` (zgł. 3/5/8/9) |
| `src/modules/rosliny/ui/RoslinyPage.tsx` | edycja | select lokalizacji w tworzeniu (zgł. 6) + sprzątnięcie ikon |
| `src/app/rosliny/page.tsx` | edycja | dolot `getWeatherOptions()` |
| `src/modules/rosliny/ui/PrzestrzenPage.tsx` | edycja | formularze → `Modal` (zgł. 4), opis toggle (zgł. 7), ikony |
| `src/modules/rosliny/ui/RoslinaSzczegol.tsx` | edycja | opis toggle (zgł. 7) + ikony nagłówków (zgł. 3) |
| `src/modules/tasks/ui/TaskFilters.tsx` | edycja | jeden wiersz: zakładki + filtr etykiet (zgł. 1) |
| `src/modules/tasks/ui/FiltrTagow.tsx` | edycja | neutralny padding (siedzi w cudzym rzędzie) |
| `src/modules/tasks/ui/ModalDodaniaZadania.tsx` | nowy | modal dodawania (zgł. 2, decyzja właściciela) |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | przycisk + skróty `a`/`n` → modal; bez inline formularza |
| `src/modules/tasks/ui/QuickAddTask.tsx` | usunięcie | nakładka bez konsumentów po zmianie |
| `src/modules/tasks/ai/executor.ts` | edycja | `?task=` w linku zgłoszenia (zgł. 10) |
| `messages/pl.json` | edycja | nowe teksty (przycisk dodawania, tooltipy, zwijanie menu) |
| `doświadczenia.md` | edycja | lekcje z naprawionych bugów (C-51) |
| e2e specs (wg grep) | edycja? | scenariusze inline-formularza dodawania, jeśli są |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: lokalny Postgres (`pg_ctlcluster 16 main start`, `.env.local` + eksport zmiennych),
  `npx prisma migrate deploy` — nigdy prod DB (C-13). Build do kroku `next build`.
- Bramki wrażliwe na te zmiany: `check:i18n` (nowe teksty przez `t()`), `check:ui-contract`
  (widoki dalej przez `ModuleView` + `state`), `check:migrations` (0288), `tsc` testowy, lint.
- Mapowanie AC:
  - AC-1 → oględziny `/tasks/<id>`: bez wybranych tagów pasek filtrów = 1 wiersz (przycisk po
    prawej rzędu zakładek); wybór tagu → chipy w tym samym rzędzie.
  - AC-2 → klik „+ Dodaj zadanie" i skróty `a`/`n` otwierają modal; Enter dodaje; Esc zamyka;
    zadanie ląduje na liście bez przeładowania.
  - AC-3 → zwężenie okna (~360 px): przyciski Roślin i nagłówek „Pomiary" jednowierszowe.
  - AC-4 → „Nowe miejsce"/„Nowa roślina" otwierają `Modal`; treść strony nie skacze.
  - AC-5 → formularz „Nowa przestrzeń" ma select lokalizacji; pominięcie działa jak dziś.
  - AC-6 → tooltip/aria przy „Pokaż zaawansowane" opisuje odsłaniane pola.
  - AC-7 → klik chevrona zwija sidebar do ikon; stan w DB (drugi login/urządzenie go widzi);
    mobile bez zmian.
  - AC-8 → wykonanie `submit_feedback` (lub inspekcja egzekutora + ręczny test linku
    `/tasks/<projekt>?task=<id>`) otwiera podgląd zadania.
  - AC-9 → `npm run build` do `next build` + przegląd playground/gallery i pasków akcji
    Pogoda/Wiadomości/Magazynowanie.

## 9. Ryzyka techniczne i plan wycofania

- **`whitespace-nowrap` w `Button.tsx` może wypchnąć długą etykietę poza wąski kontener** →
  przegląd konsumentów prymitywu (grep + playground); etykiety w aplikacji są krótkie; w razie
  wyjątku pojedynczy konsument może nadpisać klasą. Rollback: rewert 1 linii.
- **Scalenie wierszy TaskFilters może zmienić wysokość przyklejonych elementów** → wysokość rzędu
  zostaje ~38px; sprawdzić widoki z `--view-bar-h` (Tasks nie mierzy zasłony jak News — niskie
  ryzyko).
- **Modal dodawania a szybkie wpisywanie wielu zadań** → po `onCreated` modal zostaje otwarty?
  NIE — decyzja: modal ZAMYKA się po dodaniu (otwiera panel szczegółów jak dziś); seryjne
  dodawanie ma osobne wejście (bulk add) — odnotowane w spec (ryzyka).
- **Zwinięty sidebar vs. skórki zaawansowane (`omnia-nawigacja` jako hak 116)** → zwinięcie
  dodaje modyfikator klasy, nie zmienia nazwy haka; szybki test na skórce flagowej.
- **Migracja**: czysty `ADD COLUMN ... DEFAULT` — rollback kodu niezależny od migracji (kolumna
  może zostać; runbook devops).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — jedna ręczna migracja 0288, bez enumów, bez buildów na prod DB
- [x] C-20..C-25 — `updateMenuPrefs` istniejące, bez zmian RBAC/guardów, bez nowych AIAction
- [x] C-30..C-32 — zmienne CSS, mobile nietknięty (zwijanie tylko `md:`), teksty w `pl.json`
- [x] C-33..C-35 — `ModuleView` bez wyjątków, `Modal` jako prymityw z konsumentami, zero `window.confirm`
- [x] C-53 — minimalizm: 1 kolumna, 1 nowy komponent, reszta to edycje punktowe
