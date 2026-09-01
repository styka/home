# Zadania: Paczka poprawek UI/UX ze zgłoszeń administratora

- **Plan:** ./plan.md (118-poprawki-ui-ux)
- **Status:** todo
- **Data:** 2026-09-01

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Poprawki jednoliniowe (bez zależności)

- [x] **T-1** `[P]` — **Zgł. 10:** `src/modules/tasks/ai/executor.ts`, gałąź `submit_feedback`:
  `navigateTo` → `` `/tasks/${res.projectId}?task=${res.taskId}` ``. Gotowe, gdy: link zawiera
  `?task=` i `tsc` czysty (AC-8).
- [x] **T-2** `[P]` — **Zgł. 5/8/9 (część wspólna):** `src/components/ui/Button.tsx` — dodać
  `whitespace-nowrap` do `base`. Gotowe, gdy: klasa w bazie, szybki grep konsumentów `Button`
  nie pokazuje miejsca z celowo wielowierszową etykietą.
- [x] **T-3** `[P]` — **Zgł. 3/5/8/9 (Rośliny):** `src/modules/rosliny/ui/style.ts` —
  `przycisk`: `display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap"`;
  `naglowekSekcji`: `display:"flex", alignItems:"center", gap:6`. Potem audyt ikon w
  `RoslinyPage/PrzestrzenPage/RoslinaSzczegol/AgendaOpieki/Ewidencja/KatalogGatunkow`
  (usunąć zbędne `verticalAlign`/`marginRight`, sprawdzić `<Link style={przycisk}>`).
  Gotowe, gdy: przy ~360 px „Nowa przestrzeń", „Usuń przestrzeń", rząd akcji przestrzeni
  i nagłówek „Pomiary" są jednowierszowe (AC-3).

## Faza 1 — Fundament danych (zgł. 11)

- [ ] **T-4** — Migracja `0288_sidebar_collapsed` (numer zweryfikować `npm run next:migration`):
  `ALTER TABLE "UserMenuPref" ADD COLUMN "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false;`
  + `schema.prisma` + `prisma generate` + `npm run check:migrations`. Gotowe, gdy: obie bramki
  czyste i `migrate deploy` przechodzi na lokalnym Postgresie.
- [ ] **T-5** — `src/actions/menuPrefs.ts` + `src/lib/modules.tsx` (`MenuPrefs`,
  `defaultMenuPrefs`): odczyt/zapis `sidebarCollapsed`. Gotowe, gdy: `updateMenuPrefs({
  sidebarCollapsed: true })` zapisuje i `readMenuPrefs` zwraca pole.

## Faza 2 — UI: Rośliny

- [ ] **T-6** `[P]` — **Zgł. 4:** `PrzestrzenPage.tsx` — formularze „Nowa roślina" i „Nowe
  miejsce" do `Modal` (stan `formularz` zostaje; sekcja ustawień gear — bez zmian). Gotowe,
  gdy: obie akcje otwierają modal, treść strony nie rozsuwa się (AC-4).
- [ ] **T-7** `[P]` — **Zgł. 6:** `src/app/rosliny/page.tsx` dokłada `getWeatherOptions()` do
  `Promise.all`; `RoslinyPage.tsx` — opcjonalny select lokalizacji w formularzu tworzenia
  (pusta lista → brak pola), `createSpace({ …, weatherLocationId })`, optimistic wpis z wartością.
  Gotowe, gdy: nowa przestrzeń z lokalizacją ma ją ustawioną od razu; bez wyboru działa jak
  dotąd (AC-5).
- [ ] **T-8** `[P]` — **Zgł. 7:** `PrzestrzenPage.tsx` + `RoslinaSzczegol.tsx` — `title` +
  `aria-label` na „Pokaż zaawansowane" opisujące odsłaniane pola (teksty w `pl.json`).
  Gotowe, gdy: tooltip widoczny, zestaw pól bez zmian (AC-6).

## Faza 3 — UI: Zadania

- [ ] **T-9** — **Zgł. 1:** `TaskFilters.tsx` — jeden wiersz: zakładki (`flex-1 min-w-0
  overflow-x-auto`) + `FiltrTagow` (`ml-auto shrink-0`) + chipy w tym samym rzędzie;
  `FiltrTagow.tsx` — neutralny padding. Kanban (`showStatusTabs=false`): filtr sam w rzędzie.
  Gotowe, gdy: bez wybranych tagów pasek to 1 wiersz stałej wysokości; semantyka filtru
  nietknięta (AC-1).
- [ ] **T-10** — **Zgł. 2:** nowy `ModalDodaniaZadania.tsx` (Modal + `FormularzZadania`,
  autofocus, zamknięcie po `onCreated`); `TasksPage.tsx` — przycisk „+ Dodaj zadanie"
  (nowrap) w pasku narzędzi, skróty `a`/`n` otwierają modal, usunięcie inline
  `<QuickAddTask/>`; kasacja `QuickAddTask.tsx` jeśli bez konsumentów; teksty w `pl.json`.
  Gotowe, gdy: AC-2 w całości (klik/skrót → modal, Enter dodaje, Esc zamyka, lista odświeżona
  bez przeładowania, panel szczegółów otwiera się jak dotąd).
- [ ] **T-11** — Grep `e2e/` pod scenariusze inline pola dodawania zadania; dostosować do
  modalu. Gotowe, gdy: żaden spec nie celuje w usunięty inline formularz.

## Faza 4 — UI: powłoka (zgł. 11)

- [ ] **T-12** — `ModuleSidebar.tsx`: przełącznik zwiń/rozwiń (chevron, `aria-pressed`,
  tooltip) w rzędzie ikon chromu konta; wariant zwinięty (wąska szerokość ~64px zamiast
  `var(--sidebar-width)`, same ikony 44×44 z `title`+`aria-label`, ukryte etykiety/liczniki/
  ulubione, „Więcej…" jako ikona); stan optymistyczny + `updateMenuPrefs`; renderowany tylko
  w układzie sidebar; klasa-hak `omnia-nawigacja` zostaje (modyfikator). Teksty w `pl.json`.
  Gotowe, gdy: AC-7 (zwija/rozwija, stan w DB, mobile bez zmian, nawigacja klawiaturą działa).

## Faza 5 — Bramki i domknięcie

- [ ] **T-13** — `npm run check:i18n`, `npm run check:ui-contract`, `next lint`,
  `tsc` testowy, `next build` (lokalny Postgres, C-13 — build bez `migrate.js` na prod).
  Gotowe, gdy: wszystko zielone.
- [ ] **T-14** — Mapowanie AC-1…AC-9 → wynik (input do `/verify`); przegląd regresji AC-9
  (playground + paski akcji Pogoda/Wiadomości/Magazynowanie).
- [ ] **T-15** — Wpis(y) do `doświadczenia.md`, jeśli był nieoczywisty problem (C-51);
  commit + merge `claude/*` → `develop` wg C-52.

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 | T-9 |
| AC-2 | T-10, T-11 |
| AC-3 | T-2, T-3 |
| AC-4 | T-6 |
| AC-5 | T-7 |
| AC-6 | T-8 |
| AC-7 | T-4, T-5, T-12 |
| AC-8 | T-1 |
| AC-9 | T-13, T-14 |

## Notatki / blokady
- Ścieżka krytyczna: T-4 → T-5 → T-12 (dane → akcje → sidebar); reszta faz niezależna.
- T-10 zależy od T-9 tylko wizualnie (ten sam pasek narzędzi) — robić po kolei w tym samym pliku.
