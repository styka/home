# Weryfikacja: Paczka poprawek UI/UX ze zgłoszeń administratora

- **Spec:** ./spec.md (118-poprawki-ui-ux)
- **Data:** 2026-09-01
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), pełna bateria `npm run build`

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny: 0289)" |
| `npm run check:actions` | ✅ 168 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `npm run check:ui-contract` | ✅ 26/26 modułów na ModuleView |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" |
| `next build` (lokalny Postgres) | ✅ 148/148 stron; pełna bateria bramek repo (42 ✓) |
| `check-perf-budget` | ✅ w paśmie ±5% (najcięższa trasa 1181 kB — /shopping, nie nasza) |
| `prisma migrate deploy` (lokalnie) | ✅ 0288_sidebar_collapsed zaaplikowana czysto |
| `scripts/migrate.js` (ostatni krok builda) | ⏭️ pominięty świadomie — krok prod-DB (C-13); lokalna weryfikacja kończy się na `next build` (C-50) |

## Kryteria akceptacji

- **AC-1 ✅** (filtr etykiet w jednym wierszu) — `TaskFilters.tsx`: jeden rząd `minHeight: 38`
  z zakładkami (`flex min-w-0 flex-1 overflow-x-auto`) i `FiltrTagow` w `ml-auto shrink` po
  prawej; `FiltrTagow.tsx` stracił własny padding wiersza (`px-3 py-1.5` → `py-1`). Chipy
  renderują się tylko dla `wybraneTagi.length > 0`, w tym samym rzędzie z `overflow-x-auto`.
  Kanban (`showStatusTabs=false` + tagi): filtr sam w rzędzie. Semantyka koniunkcji w
  `TasksPage` nietknięta (filtrowanie `selectedTagIds.every(...)` bez zmian).
- **AC-2 ✅** (dodawanie przez modal) — `ModalDodaniaZadania.tsx` (Modal + `FormularzZadania`,
  focus na polu treści po turze auto-focusu Radixa); `TasksPage.tsx`: inline `<QuickAddTask/>`
  usunięty, stan `dodawanie`, przycisk „Dodaj zadanie" pierwszy w pasku akcji
  (`whitespace-nowrap`, etykieta chowana poniżej `sm` z pełnym `title`/`aria-label`);
  `useKeyboardShortcuts` mapuje `a`/`n` → `onQuickAdd` → `setDodawanie(true)`
  (`useKeyboardShortcuts.ts:54-56`, guard pisania w polach: `isTypingTarget`). Enter dodaje
  (obsługa w `FormularzZadania` bez zmian), `onCreated` zamyka modal i otwiera panel
  szczegółów (`setJustCreated/setOpenTaskId/setFocusedTaskId` — identycznie jak przed zmianą),
  Esc zamyka (Radix). Mobile: `Modal` to bottom-sheet z `safe-area-inset-bottom` (C-31).
- **AC-3 ✅** (łamanie ikona/etykieta) — `Button.tsx`: `whitespace-nowrap` w `base`;
  `rosliny/ui/style.ts`: `przycisk` = `inline-flex + alignItems + gap + whiteSpace:nowrap`,
  `naglowekSekcji` = `flex + alignItems + gap`. ~30 ikon w 6 plikach modułu Rośliny
  oczyszczonych z hacka `verticalAlign/marginRight` (w kontenerze flex `vertical-align` jest
  martwe, a `marginRight` dublował `gap`); ikony inline w `<p>` (2 szt.) świadomie zostały.
  Wnętrze przycisku nie może się już złamać (nowrap); w rzędach z `flex-wrap` zawija się cały
  przycisk-klocek.
- **AC-4 ✅** (akcje w modalach) — `PrzestrzenPage.tsx`: `formularz === "roslina"` i
  `"miejsce"` renderują `Modal` (wzorzec `{show && <Modal/>}` z prymitywu, jak `ShareDialog`);
  sekcja ustawień (gear) została sekcją — to slot `settings` ramy (C-33), zgłoszenie
  dotyczyło rzędu akcji. Zamknięcie modalu rośliny czyści też ostrzeżenie płodozmianowe.
- **AC-5 ✅** (lokalizacja przy tworzeniu) — `app/rosliny/page.tsx` dokłada
  `getWeatherOptions()` do `Promise.all`; `RoslinyPage.tsx`: opcjonalny `<select>` (renderowany
  tylko przy niepustej liście — pusta niczego nie blokuje), `createSpace({...,
  weatherLocationId: lokalizacja || null})`, optimistic wpis listy niesie wybraną wartość.
  Pominięcie pola = zachowanie sprzed zmiany (`null`).
- **AC-6 ✅** (objaśnienie toggle) — `PrzestrzenPage.tsx` i `RoslinaSzczegol.tsx`: przycisk
  „Pokaż zaawansowane" ma `title={t("zaawansowaneOpis")}` + `aria-label` z pełnym opisem;
  teksty w `pl.json` (`modules.rosliny.*.zaawansowaneOpis`). Zestaw odsłanianych pól
  (`lib/tryb`) nietknięty.
- **AC-7 ✅** (zwijanie menu) — migracja 0288 + `UserMenuPref.sidebarCollapsed` +
  `readMenuPrefs`/`updateMenuPrefs` (typ `MenuPrefs` + `defaultMenuPrefs` w `lib/modules.tsx`);
  `ModuleSidebar.tsx`: przełącznik (PanelLeftClose/Open, `aria-pressed`, `title`) na końcu
  rzędu chromu konta w OBU wariantach; zwinięte = 64 px, pozycje jako wyśrodkowane ikony z
  `title` + `aria-label` (`NavItem zwiniete`), „Więcej…" i pozycje dolne analogicznie; ikony
  konta (dzwonek/czat/tryb admina) w zwiniętym wariancie schodzą do pionowej kolumny chromu —
  nic nie znika. Stan czytany na serwerze (`layout.tsx:71 readMenuPrefs`) → zero mrugnięcia
  i powrót na każdym urządzeniu; zapis optymistyczny + `updateMenuPrefs` (`revalidatePath`).
  Mobile nietknięty (`hidden md:flex` bez zmian); w układzie „pasek górny" przełącznik nie
  istnieje (ModuleSidebar tam nie renderuje). Klasa-hak `omnia-nawigacja` (116) zostaje,
  zwinięcie dodaje modyfikator `omnia-nawigacja--zwinieta`.
- **AC-8 ✅** (link do podglądu zadania) — `modules/tasks/ai/executor.ts` (submit_feedback):
  `navigateTo: /tasks/${res.projectId}?task=${res.taskId}`; `submitFeedbackTask` zwraca
  `taskId` (`actions/feedback.ts:95`), a `?task=` to istniejące wejście czytane przez
  `TasksRouteView` (używane też przez `create_task openAfter` i `SzybkieDodanieZadania`).
- **AC-9 ✅** (regresje) — pełny `next build` zielony (148 stron, wszystkie bramki repo);
  konsumenci `Button` (news/weather/admin/settings/playground) mają krótkie etykiety akcji —
  `nowrap` bezpieczny; e2e: page-object `addTask` już naciskał `a` gdy pola nie widać (działa
  z modalem bez zmian), `[105-AC5]` zaktualizowany o otwarcie skrótem, `[105-AC1]` (strona
  modułu, `SzybkieDodanieZadania`) — bez zmian, bo ten widok celowo zachowuje inline widget.

## Zgodność z konstytucją

- C-01 ✅ tylko `worldofmag/` (+ artefakty w `specs/`, lekcja w `doświadczenia.md` — zgodnie z regułami repo).
- C-10/C-11/C-12 ✅ ręczna migracja 0288, numer z `next:migration`, kolumna Boolean (bez enuma).
- C-13 ✅ build i migracje wyłącznie na lokalnym Postgresie.
- C-20/C-21 ✅ jedyna zmiana akcji (`updateMenuPrefs`) trzyma istniejący guard i `revalidatePath`; zero zmian własności.
- C-23 ✅ bez nowych `AIAction`; `check:actions` zielone.
- C-30 ✅ wyłącznie zmienne CSS (nowe style: `var(--on-accent)`, `var(--text-muted)` itd.).
- C-31 ✅ mobile nietknięty; modal = bottom-sheet z safe-area; cele dotyku zachowane (py-2.5 w zwiniętym menu, 44 px szerokości wiersza).
- C-32 ✅ nowe teksty przez `t()` w `pl.json`; martwy namespace `QuickAddTask` usunięty.
- C-33 ✅ widoki dalej na `ModuleView`; filtr w strefie paska widoku.
- C-34 ✅ zero `window.confirm`; potwierdzenia bez zmian.
- C-35 ✅ `ModalDodaniaZadania` dowieziony z konsumentem; martwa nakładka `QuickAddTask` skasowana.
- C-51 ✅ lekcja „ikona inline + brak nowrap" dopisana do `doświadczenia.md`.
- C-53 ✅ 1 kolumna, 1 nowy komponent, reszta to edycje punktowe; bez nowych zależności.

## Regresje

- Wspólny `Button`: przegląd konsumentów (grep) — same krótkie etykiety; budżet JS w paśmie.
- `TaskFilters`: wysokość rzędu stała (minHeight 38, jak dotychczasowy rząd zakładek) — Tasks
  nie liczy zasłony sticky jak News, brak wpływu na `--view-bar-h`.
- Sidebar: `resolveMenu`/`pozycjePaska`/wachlarz nietknięte; `PoziomyPasekModulow` bez zmian.
- Migracja czysto addytywna (`ADD COLUMN ... DEFAULT false`) — rollback kodu niezależny.

## Werdykt końcowy

**GOTOWE Z UWAGAMI**

Uwagi (nieblokujące):
1. Weryfikacja AC-1…AC-7 oparta na prześledzeniu kodu + bramkach + istniejących e2e; pełny
   przebieg klikaczy (`scripts/e2e-web.sh`, ~2 min buildu + suite) nie był uruchamiany w tej
   sesji — scenariusze dotknięte zmianą zostały przejrzane i zaktualizowane ręcznie.
2. W zwiniętym menu licznik zaproszeń nie jest widoczny (ikony bez badge) — świadomy kompromis
   minimalizmu; dzwonek powiadomień pozostaje widoczny.
