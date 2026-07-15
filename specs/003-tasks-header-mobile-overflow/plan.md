# Plan techniczny: Naprawa przepełnienia paska akcji w nagłówku Zadań na iPhone

- **Spec:** ./spec.md (003-tasks-header-mobile-overflow)
- **Status:** draft
- **Data:** 2026-07-15

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Zmiana czysto prezentacyjna (CSS/Tailwind),
> zero schematu bazy, zero server actions, zero RBAC/AI.

## 1. Podejście (2–4 zdania)
Nagłówek działu Zadania (`src/components/tasks/TasksPage.tsx`) to jeden rząd o stałej wysokości
(`flex items-center justify-between px-4 h-12`), którego prawy kontener akcji
(`<div className="flex items-center gap-2">`, linia ~408) pakuje 8+ przycisków. Rodzic ma
`overflow-hidden`, więc nadmiar jest **przycinany**, a nie przewijany — stąd znikające ikony na
iPhonie. Naprawa: **odizolować poziomy scroll do samego kontenera akcji** (`overflow-x-auto` +
`min-w-0`) i nie pozwolić dzieciom-akcjom kurczyć się poniżej intrinsic (żeby ikony zachowały
rozmiar, a rząd się przewijał). Wzorzec już w tym samym pliku: pasek zakresu „wiele projektów"
(linia ~527) używa `overflow-x-auto` z globalnym, cienkim (6px) scrollbarem — naśladujemy go (C-53).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Feature jest czysto prezentacyjny — brak nowych modeli/kolumn, brak
migracji. C-10/C-11/C-12 nie dotyczą.

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian.** Brak mutacji danych, brak nowych/zmienionych plików w `src/actions/`, brak
`revalidatePath`. C-20/C-21 nie dotyczą.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Istniejący `module.tasks`; przycisk „Kopiuj prompt dla Claude Code"
(`TaskListClipboardButton`) pozostaje renderowany warunkowo `isAdmin` (linia ~513) — logika
widoczności nietknięta. Brak wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
Jedyna warstwa zmian. Plik: `src/components/tasks/TasksPage.tsx`, nagłówek działu.

- **Kontener akcji** (`<div className="flex items-center gap-2">`, ~linia 408) → **rozdzielić na dwa**:
  zewnętrzny `flex items-center gap-2 min-w-0` i wewnętrzny **przewijany** `flex items-center gap-2
  min-w-0 overflow-x-auto [&>*]:flex-shrink-0` obejmujący ikony (kosz…przełącznik widoku, klipboard).
  Dzięki `overflow-hidden` na rodzicu przewijanie jest odizolowane do tego kontenera, więc **cała
  strona nie przewija się poziomo** (AC-3).
- **Popovery poza strefą scrolla (ważne):** kontener z `overflow-x-auto` liczy `overflow-y` jako `auto`
  (reguła CSS: gdy jedna oś ≠ `visible`, druga `visible` staje się `auto`), więc **przycina** wewnętrzne
  rozwijane menu. `ProjectActionsMenu` renderuje `absolute` dropdown (rename/usuń projektu) → **musi
  zostać POZA** przewijanym kontenerem, jako sibling w zewnętrznym wrapperze (`flex-shrink-0`, przypięty
  po prawej, zawsze widoczny). Inaczej menu byłoby ucięte także na desktopie.
- **Dzieci-akcje nie mogą się kurczyć** — w scroll-kontenerze flex domyślnie dzieci mogą się zwężać;
  chcemy, by ikony i pogrupowane przełączniki (bordered: grupowanie, Lista/Kanban/Timeline) zachowały
  rozmiar i żeby rząd się **przewijał**, a nie ściskał. Realizacja minimalna: na kontenerze akcji
  wariant `[&>*]:flex-shrink-0` (Tailwind arbitrary variant) — obejmuje wszystkie bezpośrednie dzieci
  bez dotykania każdego z osobna. (Alternatywa odnotowana: dopisać `flex-shrink-0` do każdego dziecka —
  odrzucona jako bardziej rozwlekła, C-53.)
- **Lewa strona nagłówka**: mobilny picker projektu ma `flex-1 mr-2` (~linia 376) — zostaje bez zmian;
  zachowuje priorytet szerokości, a kontener akcji (`min-w-0`) ustępuje mu i przewija się w swojej
  strefie. Desktopowy tytuł (`hidden md:block`) bez zmian.
- **Desktop bez regresu (AC-4):** `overflow-x-auto` jest bezczynne, gdy treść się mieści — na ≥ `md`
  wszystkie akcje mieszczą się w rzędzie, więc wygląd i zachowanie pozostają identyczne. Nie
  wprowadzamy osobnego breakpointu, bo klasa jest inertna przy braku nadmiaru (minimalizm C-53).
- **Motyw (C-30):** brak nowych kolorów; scrollbar dziedziczy globalny styl na zmiennych CSS
  (`var(--border)`), zero hardcodowanych hexów.
- **Teksty (C-32):** brak nowych tekstów UI.
- **Mobile-first (C-31):** poprawka realizuje właśnie tę regułę; nie tworzy drugiego sidebara, nie
  rusza tab bara ani `safe-area`.

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`, read-toola, kalendarza, powiadomień.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/components/tasks/TasksPage.tsx` | edycja | Dodać `min-w-0 overflow-x-auto [&>*]:flex-shrink-0` na kontenerze akcji nagłówka; reszta bez zmian. |
| `doświadczenia.md` | edycja (append) | Wpis-lekcja o przycinaniu nagłówka przez `overflow-hidden` rodzica na mobile (C-51). |

## 8. Bramki i weryfikacja (C-50)
- Zmiana front-endowa bez schematu → weryfikacja lokalna do kroku `next build` (nie pełny `npm run
  build`, bo kończy się `migrate.js` ruszającym prod DB — C-13). Lokalny Postgres tylko jeśli build
  go wymaga do wygenerowania klienta; `prisma generate` wystarcza.
- Kroki: `node_modules/.bin/next lint` (jeśli dostępny) → `node_modules/.bin/next build`. `check:migrations`
  i `check:actions` przechodzą trywialnie (brak nowych migracji i `AIAction`).
- **Mapowanie AC → weryfikacja:**
  - **AC-1 / AC-2 / AC-5** — inspekcja renderu / responsive: przy ~375px kontener akcji przewija się
    w poziomie i każda akcja (w tym „Kopiuj prompt", akcje projektu) jest osiągalna we wszystkich
    układach (Lista/Kanban/Timeline) i widokach. Weryfikacja wzrokowa w dev/responsywnym podglądzie.
  - **AC-3** — sprawdzić, że przewija się **tylko** kontener akcji, a `body`/strona nie ma poziomego
    scrolla (rodzic `overflow-hidden` + izolacja do kontenera akcji).
  - **AC-4** — na ≥ `md` nagłówek wygląda i działa jak dotąd (klasa inertna przy braku nadmiaru).

## 9. Ryzyka techniczne i plan wycofania
- **Ryzyko:** `[&>*]:flex-shrink-0` mogłoby usztywnić element, który wcześniej celowo się kurczył —
  w tym kontenerze wszystkie dzieci to przyciski/ikony o intrinsic rozmiarze, więc bezpieczne.
- **Ryzyko:** część ikon początkowo poza kadrem (afordancja scrolla) — akceptowane w specie; cienki
  globalny scrollbar + naturalne wystawanie kolejnej ikony sygnalizują możliwość przewinięcia.
- **Rollback:** zmiana to kilka klas CSS w jednym pliku — rewert commita. Brak migracji, więc brak
  rollbacku bazy (runbook devops nie dotyczy).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczą** (brak zmian schematu), świadomie odnotowane.
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — **nie dotyczą** (zmiana czysto prezentacyjna).
- [x] C-30..C-32 (UX) — zaadresowane: zmienne CSS, mobile-first, teksty PL (brak nowych).
- [x] C-53 (minimalizm) — najmniejsza możliwa zmiana: kilka klas Tailwind w jednym pliku, zero nowych
  zależności, zero refaktorów „przy okazji".
- [x] C-50 — weryfikacja do `next build` (bez prod DB, C-13).
- [x] C-51 — zaplanowany wpis do `doświadczenia.md`.
