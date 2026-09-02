# Plan techniczny: Poprawki UX — edytor skórek w dialogu, panel szczegółów zadania bez zbędnej linii, jeden mechanizm zakresu projektów

- **Spec:** ./spec.md (122-ux-skorki-zadania-filtr)
- **Status:** draft
- **Data:** 2026-09-02

> **Zasada planu:** to jest **JAK**. Plan pisze się pod istniejący kod — wzorce zostały odczytane
> z `SkinPicker`/`Modal`, `TaskDetail`, `TasksPage`/`TasksRouteView`/`TasksSideNav`/
> `ProjectScopeFilter` przed projektowaniem.

## 1. Podejście (2–4 zdania)

Trzy niezależne poprawki UI w istniejących komponentach, **zero zmian schematu i zero nowych bytów**.
(1) `SkinPicker` przestaje renderować `SkinEditor` inline i osadza go w istniejącym `Modal`
(`src/components/ui/Modal.tsx` — na telefonie arkusz dolny z `safe-area`, konwencja 087).
(2) `TaskDetail` traci wiersz nagłówka `h-12`; jego przyciski wchodzą do wiersza tytułu zadania.
(3) `ProjectScopeFilter` staje się **jedynym** mechanizmem zakresu projektów: w widoku zapisanego
zestawu pokazuje i edytuje zakres + metadane zestawu (nazwa/emoji/kolor, usunięcie), a pasek chipów
„Projekty: …" w `TasksPage` i edytor grup w `TasksSideNav` znikają. Wzorcem panelu jest już użyty
w tym komponencie `AnchoredLayer` (080) i `FiltrTagow` (100).

## 2. Model danych (Prisma)

**Bez zmian w schemacie — żadnej migracji.** Zapisany zestaw pozostaje modelem `ProjectGroup`
(`@@map "TaskView"`, `projectIds` JSON) — zmiana jest wyłącznie prezentacyjna (AC-8 speca).
C-10..C-14 nie są dotknięte; `check:migrations` przechodzi bez nowego katalogu.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych akcji.** Istniejące w `src/modules/tasks/actions/projectGroups.ts` pokrywają całość:
`getProjectGroups`, `getProjectGroup`, `createProjectGroup`, `updateProjectGroup`,
`deleteProjectGroup` — wszystkie z guardem dostępu i `revalidatePath` (zweryfikować przy
implementacji, że `updateProjectGroup`/`deleteProjectGroup` rewalidują `/tasks`; jeśli rewalidują
tylko starą ścieżkę, dopisać `revalidatePath("/tasks")` w tych akcjach — to jedyna dopuszczalna
zmiana serwerowa). Skórki: `setActiveSkin`/`updateSkin`/`deleteSkin`/zapis w `SkinEditor` — bez zmian.

- **Semantyka edycji zakresu w widoku zestawu:** zmiana zaznaczenia w dropdownie to **zmiana
  oczekująca** (stan lokalny komponentu), zapisywana przyciskiem przez `updateProjectGroup` →
  `revalidatePath` → serwer przeładowuje widok z nowym zakresem. Powód techniczny: widok zestawu
  ładuje z serwera wyłącznie zadania projektów grupy (`getTasksForProjects(scopeIds)` w
  `TasksRouteView`), więc podgląd „na żywo" po dodaniu projektu nie miałby danych; zapis-i-odśwież
  jest jedyną spójną semantyką bez poszerzania odczytu (C-53). W widokach wirtualnych semantyka
  bez zmian: zaznaczenie filtruje po stronie klienta natychmiast (AC-9).

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: istniejące `module.settings` i `module.tasks`; żadnej nowej trasy, wpięcia w
`permissions.ts`/`modules.tsx`/`ModuleSidebar` nietknięte. Guard tras dziedziczony z layoutów (098).

## 5. UI (C-30, C-31, C-32)

### 5.1 Skórki — `src/components/settings/SkinPicker.tsx`

- Stan `editor` zostaje; zmienia się **nośnik**: zamiast bloku inline na dole (`editor.open && <div…>`)
  renderujemy `<Modal open onClose={…} title={…} wide>` z `SkinEditor` w środku. `Modal` daje Esc,
  focus-trap i arkusz dolny na telefonie (stopka nad `env(safe-area-inset-bottom)` — 087, C-31).
- `SkinEditor` ma własne przyciski Zapisz/Anuluj (`onClose`/`onSaved`) — slot `footer` modala
  zostaje pusty; `onSaved` nadal woła `choose(id)` (aktywacja nowej skórki, AC-2).
- Tytuł modala („Nowa skórka" / „Edycja skórki") przez `t()` — literały z linii 181 przenoszą się
  do `messages/pl.json` (`components.settings.SkinPicker.*`), zgodnie z C-32.
- „Duplikuj i edytuj" / „Edytuj" otwierają ten sam modal (AC-3) — bez zmian w logice `duplicate`/
  `setEditor`, zmienia się tylko render.
- Długi formularz: treść modala przewijalna wewnątrz (Modal już to robi przez własny scroll);
  sprawdzić na telefonie, że edytor tokenów (długa lista kontrolek) przewija się w arkuszu.

### 5.2 Zadania — panel szczegółów, `src/modules/tasks/ui/TaskDetail.tsx`

- Usuwamy cały blok „Header" (`div.flex.items-center.justify-between.px-4.h-12.border-b`, linie
  ~947–990): etykieta `szczegolyZadania`, spinner, przyciski.
- Do **wiersza tytułu** (`sekcjaTytul`) dokładamy po prawej zwartą grupę akcji:
  spinner `isPending` (zamiast w nagłówku), rozwiń/zwiń (`onPrzelaczSzeroki`, desktop-only
  `hidden md:flex`, `aria-pressed`), usuń (`handleDelete`, `--accent-red`), zamknij (X, `onClose`).
  Na telefonie przycisk „Wróć" (ChevronLeft + tekst) staje się pierwszym elementem wiersza tytułu
  (`md:hidden`), przed polem tytułu. Cele dotyku ≥ 44 px (`p-2.5`/`py-3` zamiast dotychczasowych
  `p-1.5` tam, gdzie trzeba) — C-31.
- Wiersz tytułu musi pozostać użyteczny przy edycji: pole tytułu dostaje `min-w-0 flex-1`, grupa
  akcji `flex-shrink-0`. Skróty klawiszowe (Esc = zamknij) nie żyją w usuwanym nagłówku —
  zweryfikować w kodzie i zostawić bez zmian (AC-4).
- Klucz `szczegolyZadania` w `messages/pl.json` zostaje (używa go `TasksGuide`); z `TaskDetail`
  znika tylko użycie. Ilustrację w `TasksGuide` aktualizujemy **tylko jeśli** rysuje ten nagłówek
  w sposób sprzeczny z nowym UI (szybki przegląd przy implementacji; przewodnik to nie AC).

### 5.3 Zadania — jeden mechanizm zakresu projektów

**`src/modules/tasks/ui/ProjectScopeFilter.tsx`** — rozszerzenie o tryb zestawu:

- Nowy opcjonalny prop `zestaw?: { id: string; name: string; emoji: string; color: string | null;
  projectIds: string[] }` (dane ma już `TasksRouteView` z `getProjectGroup`).
- **Bez propa `zestaw`** (widoki wirtualne): zachowanie dokładnie dzisiejsze — kontrolowane
  `selected`/`onChange`, natychmiastowe zawężanie klienckie, „zapisz jako zestaw" → `createProjectGroup`
  → `router.push` do `/tasks/zestaw/<id>` (AC-9).
- **Z propem `zestaw`** (widok `/tasks/zestaw/[zestawId]`): komponent sam trzyma **roboczy** wybór
  (inicjowany z `zestaw.projectIds`) i sekcję ustawień zestawu:
  - checkboxy projektów jak dziś; etykieta przycisku-kotwicy pokazuje licznik zaznaczonych
    (np. „3 z 8 projektów") — widać zakres bez otwierania panelu (lekcja 100: stan nie może
    mieszkać wyłącznie w zamkniętej warstwie);
  - pola nazwa + emoji + kolor (przeniesione 1:1 z edytora w `TasksSideNav` — te same kontrolki,
    żeby nie tracić żadnej funkcji);
  - „Zapisz zmiany" (aktywny, gdy roboczy stan ≠ zapisany) → `updateProjectGroup` → zamknięcie
    panelu (serwer odświeży widok przez `revalidatePath`);
  - „Zapisz jako nowy zestaw" → `createProjectGroup` + `router.push` (jak dziś w trybie ad hoc);
  - „Usuń zestaw" → `confirmDialog({ …, destructive: true })` (C-34) → `deleteProjectGroup` →
    `router.push("/tasks")` (AC-6, AC-7).
- Zakres nie może zdegradować do zera (reguła 080): „Zapisz zmiany" wyłączony przy pustym wyborze.

**`src/modules/tasks/ui/TasksPage.tsx`**:
- Pasek chipów „Projekty: …" (`viewMode === "multi" && scopeProjects.length > 0`, linie ~852–885)
  **znika w całości**, razem z ołówkiem `?edit=1`.
- `ProjectScopeFilter` renderuje się także dla `viewMode === "multi"` (dziś tylko `isVirtualView`),
  z propem `zestaw` (dane przekazane z `TasksRouteView` — ma tam `group`; do propsów `TasksPage`
  dochodzi `zestaw` obok istniejącego `multiGroupId`, który może wtedy zniknąć jako nadmiarowy,
  jeśli nic innego go nie czyta).
- Literał „Projekty:" znika razem z paskiem (mniej długu i18n, nie więcej).

**`src/modules/tasks/ui/TasksSideNav.tsx`**:
- Znika edytor grup: stan `groupEditor`, `openEditGroup`, `handleDeleteGroup`, auto-otwieranie
  z `?edit=1` (`autoEditedId` + efekt), formularz „Utwórz grupę / Zapisz" oraz ikonki ołówka/kosza
  przy grupach. Grupy pozostają **czystymi linkami** do `/tasks/zestaw/<id>` (AC-7 — dostęp
  z nawigacji zostaje; zarządzanie przejmuje dropdown w widoku zestawu).
- Tworzenie zestawu: wyłącznie przez zapis wyboru w dropdownie (jak dziś w widokach zbiorczych) —
  jeśli sidebar ma dziś przycisk „nowa grupa" otwierający formularz, zastępujemy go linkiem do
  widoku „Wszystkie" z podpowiedzią (title) albo usuwamy — decyzja przy implementacji wg
  najmniejszego zaskoczenia; funkcja tworzenia NIE znika (dropdown ją ma).

**`src/modules/tasks/ui/TasksRouteView.tsx`**: przekazuje pełne dane zestawu do `TasksPage`
(nazwa/emoji/kolor/projectIds — już pobrane przez `getProjectGroup`); `scopeProjects` zostaje,
bo nagłówek widoku może z niego korzystać (sprawdzić konsumentów przed usunięciem).

### 5.4 i18n (C-32)
Nowe klucze w `messages/pl.json`: tytuły modala skórki, etykiety sekcji zestawu w dropdownie
(„Zapisz zmiany", „Zapisz jako nowy zestaw", „Usuń zestaw", „Nazwa zestawu", licznik „N z M"),
aria-labels przeniesionych przycisków. Zero literałów z diakrytykami w komponentach
(`check:i18n` jest bramką absolutną — 097); usuwane literały („Projekty:") obniżają dług.

## 6. AI / integracje

Nie dotyczy: żadnej nowej `AIAction`, read-toola, wpięcia w kalendarz/powiadomienia. `check:actions`
i `check:ai-coverage` bez zmian (nie dodajemy ani nie usuwamy żadnej Server Action; jeśli dojdzie
`revalidatePath` w istniejącej akcji, manifesty pokrycia nie zmieniają się — to ta sama akcja).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/components/settings/SkinPicker.tsx` | edycja | Edytor skórki w `Modal` zamiast inline; tytuły przez `t()` (AC-1..AC-3) |
| `src/modules/tasks/ui/TaskDetail.tsx` | edycja | Usunięcie wiersza nagłówka; akcje w wierszu tytułu; „Wróć" na telefonie (AC-4, AC-5) |
| `src/modules/tasks/ui/ProjectScopeFilter.tsx` | edycja | Tryb zestawu: edycja zakresu + nazwa/emoji/kolor, zapisz/zapisz-jako/usuń (AC-6, AC-9) |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | Bez paska chipów; filtr także w `viewMode="multi"`; nowy prop `zestaw` (AC-6) |
| `src/modules/tasks/ui/TasksSideNav.tsx` | edycja | Grupy jako czyste linki; edytor grup i `?edit=1` znikają (AC-7) |
| `src/modules/tasks/ui/TasksRouteView.tsx` | edycja | Przekazanie danych zestawu do `TasksPage` |
| `src/modules/tasks/actions/projectGroups.ts` | ewent. edycja | Tylko jeśli `update/delete` nie rewalidują `/tasks` (AC-6/AC-8) |
| `messages/pl.json` | edycja | Nowe klucze i18n (C-32) |
| `doświadczenia.md` | edycja | Wpis, jeśli po drodze naprawimy nieoczywisty problem (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalny Postgres (sandbox: `pg_ctlcluster 16 main start`, rola `omnia/omnia_dev`) +
  `npx prisma migrate deploy` — bez tego `next build` nie przejdzie; **nigdy prod DB** (C-13).
- Kolejność: `tsc --noEmit -p tsconfig.test.json` → `npm run check:i18n` → `npm run check:ui-contract`
  → `next lint --dir src` → pełny `npm run build` **do kroku `next build`** (bez `migrate.js`).
- Mapowanie AC → weryfikacja:
  - AC-1/AC-2/AC-3 — inspekcja renderu `SkinPicker` (modal w drzewie, `open`, Esc przez `Modal`);
    e2e nie jest wymagane, przegląd + `next build`;
  - AC-4/AC-5 — przegląd `TaskDetail` (brak bloku nagłówka, wszystkie 4 akcje + „Wróć" w wierszu
    tytułu, rozmiary celów dotyku);
  - AC-6 — przegląd `TasksPage` (brak bloku chips) + `ProjectScopeFilter` z propem `zestaw`
    (zapisz/zapisz-jako/usuń wywołują właściwe akcje);
  - AC-7 — `TasksSideNav`: linki grup bez edytora; usunięcie/rename osiągalne w dropdownie;
  - AC-8 — brak zmian w `projectGroups.ts` poza ewent. `revalidatePath`; adres `/tasks/zestaw/…`
    nietknięty; brak migracji;
  - AC-9 — ścieżka `isVirtualView` w `TasksPage` niezmieniona (diff nie dotyka `view.projekty`);
  - AC-10 — pełny build do `next build` zielony.

## 9. Ryzyka techniczne i plan wycofania

- **`check:i18n`** wyłapie każdy nowy literał z diakrytykami → wszystkie teksty od razu do
  `pl.json`; uwaga na `title`/`aria-label` przenoszonych przycisków.
- **`check:ui-contract`** — nie zmieniamy tras ani `ModuleView`, manifest bez zmian; usunięcie
  paska chips nie dotyka `state`.
- **Regres skrótów/fokusu w `TaskDetail`** (autofokus tytułu, Esc) → przetestować ścieżki w kodzie;
  AC-4 wymienia akcje wprost.
- **Konsumenci usuwanych rzeczy**: przed skasowaniem `multiGroupId`/`scopeProjects`/`?edit=1`
  przejść po użyciach greppem — nic nie może zostać osierocone (wzorzec 095: martwe API w
  komponencie współdzielonym jest gorsze niż brak).
- **Perf budget (±5 %)** — zmiany netto ujemne w bajtach; ryzyko minimalne.
- **Rollback:** wyłącznie kod (brak migracji) — revert commita na `develop`; produkcja nietknięta
  do czasu promocji `master`.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — **bez migracji**; jawnie potwierdzone (schemat nietknięty)
- [x] C-20..C-25 — bez nowych akcji; ewent. tylko `revalidatePath` w istniejących; RBAC/trash/audit nietknięte; C-34 przy „Usuń zestaw"
- [x] C-30..C-32 — zmienne CSS (żadnych hexów), arkusz dolny + safe-area, cele dotyku ≥ 44 px, teksty przez `t()`
- [x] C-33 — rama `ModuleView` nietknięta; zmiany wewnątrz treści widoku
- [x] C-35 — zero nowych wspólnych komponentów; rozszerzamy istniejące z konsumentem w tym samym diffie
- [x] C-53 — minimalizm: netto **ubywa** UI (pasek chips, edytor w sidebarze, wiersz nagłówka); zero nowych bytów danych
