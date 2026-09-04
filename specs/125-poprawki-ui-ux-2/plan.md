# Plan techniczny: Druga paczka poprawek UI/UX ze zgłoszeń administratora

- **Spec:** ./spec.md (125-poprawki-ui-ux-2)
- **Status:** draft
- **Data:** 2026-09-04

> **Zasada planu:** to jest **JAK**. Cztery punktowe edycje w istniejących plikach — wzorce
> pochodzą wprost z paczki 118 i z bieżącego kodu na `develop` (m.in. 121 już dodało do
> `ModalDodaniaZadania` propsy wyboru projektu, których użyjemy).

## 1. Podejście (2–4 zdania)

Zero zmian schematu i akcji serwera — wszystkie cztery zgłoszenia to warstwa UI + treść linków.
Wzorce: dialog = prymityw `Modal` (jak formularze Roślin z 118); wybór projektu = istniejące
propsy `pokazWyborProjektu`/`domyslnyProjektId` w `ModalDodaniaZadania`/`FormularzZadania`
(konsument: strona modułu /tasks od 121); przycisk filtra w pasku akcji = istniejący `FiltrTagow`
w wariancie kompaktowym (ikona + licznik, wzorzec ikon paska: size 15, p-1.5, title+aria).
Zgł. 4: `submitFeedbackTask` zwraca `taskId`, a `TasksRouteView` czyta `?task=` — poprawiamy
TRZY miejsca w `AICommandSheet`, które budują link/nawigację bez `?task=`.

## 2. Model danych (Prisma)

**Bez zmian w schemacie** — żadnych migracji.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez zmian.** `submitFeedbackTask` już zwraca `taskId` (typ `SubmitFeedbackResult`);
`updateSpace`/`deleteSpace` bez zmian. Żadnych nowych guardów ani `revalidatePath`.

## 4. RBAC / rejestr modułu (C-22)

Bez zmian — istniejące slugi, żadnych nowych tras.

## 5. UI (C-30, C-31, C-32)

**(a) Zgł. 1 — ustawienia przestrzeni Roślin w dialogu.** `src/modules/rosliny/ui/PrzestrzenPage.tsx`:
- blok `{ustawienia && <section style={sekcja}>…}` (lokalizacja pogodowa + „Usuń przestrzeń",
  linie ~276–308) przenieść do `{ustawienia && <Modal title={t("ustawienia")} onClose={() =>
  setUstawienia(false)}>…}` — wzorzec identyczny jak formularze „roslina"/„miejsce" z 118;
  zawartość (select lokalizacji, komunikat, sekcja usunięcia) bez zmian merytorycznych;
  wewnętrzne `<h2 style={naglowekSekcji}>` zostają jako śródtytuły w ciele dialogu (tytuł dialogu
  niesie `Modal`).
- `usunPrzestrzen()`: przed `router.push("/rosliny")` zamknąć dialog (`setUstawienia(false)`) —
  nawigacja i tak odmontowuje, ale jawne zamknięcie chroni przed mignięciem dialogu nad listą.
- Slot ramy: `settings={{ onClick: () => setUstawienia(true), active: ustawienia, … }}` —
  otwarcie zawsze na `true` (dialog zamyka się przez X/Esc/tło), `active` odzwierciedla otwarty
  dialog. Wejście zostaje w slocie `settings` (C-33) — zmienia się prezentacja, nie miejsce.

**(b) Zgł. 2 — pole projektu w dialogu dodawania.** `src/modules/tasks/ui/TasksPage.tsx`
(wywołanie `ModalDodaniaZadania`, ~linia 908):
- przekazać `pokazWyborProjektu` (zawsze), `projekty={allProjects}`,
  `domyslnyProjektId={viewMode === "project" ? projectId : null}`;
- `projectId` przekazywany dalej bez zmian (fallback nieużywany przy pokazWyborProjektu);
- `onCreated` bez zmian — `setJustCreated/setOpenTaskId/setFocusedTaskId` już obsługuje zadanie
  spoza przefiltrowanej listy (fallback `justCreated`), co realizuje decyzję „zostań w widoku +
  otwórz podgląd". Sygnatura `onCreated` w `TasksPage` przyjmie drugi argument (ignorowany).
- `FormularzZadania`/`ModalDodaniaZadania` — bez zmian (121 dało całą potrzebną powierzchnię;
  pusta wartość selecta = Skrzynka, zgodnie ze specem).

**(c) Zgł. 3 — filtr tagów w górnym pasku akcji.**
- `src/modules/tasks/ui/FiltrTagow.tsx`: nowy wariant kompaktowy (prop `kompaktowy?: boolean`):
  przycisk = ikona `Tags` size 15 + licznik wybranych (badge jak liczniki zakładek: rounded-full,
  `--bg-elevated`/`--accent-blue` gdy aktywny), stylistyka sąsiadów paska (p-1.5, rounded,
  `title`/`aria-label` z pełną treścią „Filtr etykiet: 5 z 17"); bez chipów w tym wariancie
  (decyzja właściciela — wybór ogląda się w panelu). Panel `AnchoredLayer` bez zmian (portal —
  przewijany kontener paska go nie przytnie). Stary wariant renderu z chipami USUNĄĆ (jedyny
  konsument przechodzi na pasek akcji; martwy wariant we wspólnym komponencie = antywzorzec 084).
- `src/modules/tasks/ui/TaskFilters.tsx`: wyjąć `FiltrTagow` + propsy tagów w całości; wiersz
  zostaje samymi zakładkami (`overflow-x-auto`); warunek pustego paska upraszcza się do
  `if (!showStatusTabs) return null` (Kanban nie renderuje wiersza wcale).
- `src/modules/tasks/ui/TasksPage.tsx`: `<FiltrTagow kompaktowy …>` w pasku akcji ZARAZ ZA
  przyciskiem Szukaj (ten sam scrollowany rząd `role="toolbar"`); propsy tagów przestają iść do
  `TaskFilters`. Render warunkowy `allTags.length > 0` jak dotąd.

**(d) Zgł. 4 — linki potwierdzenia zgłoszenia z `?task=`.**
`src/components/assistant/AICommandSheet.tsx`, trzy miejsca:
1. ~1481 (tryb robaczka/inspektora): markdown link →
   `` `[Otwórz w zadaniach](/tasks/${res.projectId}?task=${res.taskId})` ``;
2. ~547: stan `reportDone` poszerzyć o `taskId: string`;
3. ~1162 (sekcja zgłoszenia problemu): `setReportDone({ projectId, taskId: res.taskId, canRead })`;
4. ~2094: przycisk „Otwórz w zadaniach" → `goTo(\`/tasks/${reportDone.projectId}?task=${reportDone.taskId}\`)`.
Po zmianie grep kontrolny `/tasks/\$\{.*projectId\}` w `src` — nie może zostać czwarte miejsce
bez `?task=` (poza celowymi linkami do LISTY, jeśli takie są — decyzja per trafienie).

Teksty: nowe/zmienione etykiety przez `t()` w `pl.json` (`FiltrTagow` ma już namespace; dialog
ustawień Roślin użyje istniejącego klucza `ustawienia`). Kolory wyłącznie przez zmienne CSS.

## 6. AI / integracje (C-23, C-40)

Bez nowych `AIAction`; `check:actions` bez zmian. Egzekutor `submit_feedback` (naprawiony w 118)
nietknięty.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/rosliny/ui/PrzestrzenPage.tsx` | edycja | sekcja ustawień → `Modal` (zgł. 1) |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | propsy wyboru projektu do modalu (zgł. 2); `FiltrTagow kompaktowy` w pasku akcji (zgł. 3) |
| `src/modules/tasks/ui/TaskFilters.tsx` | edycja | wiersz bez filtra tagów; uproszczony warunek (zgł. 3) |
| `src/modules/tasks/ui/FiltrTagow.tsx` | edycja | wariant kompaktowy ikona+licznik; kasacja wariantu z chipami (zgł. 3) |
| `src/components/assistant/AICommandSheet.tsx` | edycja | `?task=` w trzech miejscach + `taskId` w `reportDone` (zgł. 4) |
| `messages/pl.json` | edycja | ewent. nowe klucze etykiet filtra |
| e2e specs (wg grep) | edycja? | scenariusze celujące w filtr tagów/wiersz filtrów, jeśli są |
| `doświadczenia.md` | edycja | lekcja o dwóch ścieżkach jednego linku (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: lokalny Postgres (już skonfigurowany: `omnia_dev`), build do kroku `next build`
  (C-13); `check:i18n`, `check:ui-contract`, `tsc` testowy, `next lint`.
- Mapowanie AC:
  - AC-1 → klik koła zębatego w widoku przestrzeni: dialog nad treścią, zawartość kompletna,
    usunięcie działa (confirm + powrót na listę), Esc zamyka.
  - AC-2 → dialog z widoku projektu: select widoczny z wartością projektu; z Dziś/zestawu:
    select bez preselekcji; zmiana projektu → zadanie w wybranym projekcie, panel podglądu
    otwarty w bieżącym widoku (mechanizm `justCreated`).
  - AC-3 → przy 5 wybranych tagach: wiersz zakładek pełny, przycisk filtra obok lupy z
    licznikiem i wyróżnieniem; klik → panel; koniunkcja bez zmian (kod `TasksPage` nietknięty
    w tej części).
  - AC-4 → inspekcja trzech poprawionych miejsc + ręczny test linku `/tasks/<proj>?task=<id>`;
    grep kontrolny bez czwartego miejsca.
  - AC-5 → pełna bateria buildu + przegląd widoków (lista/kanban/timeline/obszary, wirtualne,
    zestaw) + skróty `a`/`n`.
- E2E: grep `e2e/` pod `FiltrTagow`/„Filtr etykiet"/„z 17" — dostosować selektory, jeśli
  jakiś spec celuje w filtr w starym miejscu.

## 9. Ryzyka techniczne i plan wycofania

- **Kasacja wariantu z chipami w `FiltrTagow`** → jedyny konsument to Zadania (grep z rekonesansu);
  po zmianie ponowny grep. Rollback: rewert pliku.
- **`reportDone` w innych miejscach pliku** → grep wszystkich użyć stanu przy edycji typu.
- **Pasek akcji przewijany na mobile** → przycisk filtra jako `flex-shrink-0` jak sąsiedzi;
  AnchoredLayer to portal, więc scroll-kontener go nie tnie.
- **Dialog ustawień a `komunikat` lokalizacji** → stan `komunikat` czyścić przy zamknięciu
  dialogu, żeby nie wracał przy ponownym otwarciu jako stary „zapisano".
- Rollback całości: rewert commitów UI — brak migracji, brak zmian danych.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — bez zmian schematu (jawnie)
- [x] C-20..C-25 — bez zmian akcji/RBAC/AI; C-34 zachowane przy usuwaniu przestrzeni
- [x] C-30..C-32 — zmienne CSS, mobile (bottom-sheet, safe-area, cele dotyku), teksty w pl.json
- [x] C-33 — wejście ustawień zostaje w slocie `settings`; filtr w strefie akcji ramy
- [x] C-53 — zero nowych plików i zależności; kasacja martwego wariantu zamiast utrzymywania dwóch
