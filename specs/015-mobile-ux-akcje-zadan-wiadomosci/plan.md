# Plan techniczny: Poprawki UX/UI mobile — pasek akcji zadań, feedback cykliczności, ikony Wiadomości

- **Spec:** ./spec.md (015-mobile-ux-akcje-zadan-wiadomosci)
- **Status:** draft
- **Data:** 2026-07-20

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Wszystkie trzy zmiany są **czysto
> prezentacyjne** (warstwa UI) — bez schematu, bez migracji, bez Server Actions, bez RBAC/AI.

## 1. Podejście (2–4 zdania)
Trzy punktowe poprawki w istniejących komponentach klienckich, każda naśladując wzorce już obecne w
repo: (1) pasek akcji w `TasksPage.tsx` — dodać wizualną wskazówkę przewijania do istniejącego
kontenera `overflow-x-auto` i uporządkować/udokumentować warunki widoczności ikon; (2) `TaskDetail.tsx`
— rozszerzyć istniejący mechanizm `run()`/`isPending` (`useTransition`) o lokalny, widoczny stan
„Zapisano" przy przycisku „Zapisz" cykliczności; (3) `NewsPage.tsx` — akcje tematu (Edytuj/Usuń), dziś
`hidden group-hover:block`, uczynić widocznymi i większymi na dotyku, hover-only zostawić na desktopie.
Wzorce feedbacku i „always-visible na mobile / hover na desktopie" są już w kodzie — powielamy je (C-53).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji (`npm run next:migration`
niepotrzebne). Wszystkie zmiany dotyczą warstwy prezentacji.

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian.** Feedback zapisu cykliczności korzysta z **istniejącej** akcji `updateTask(task.id,
{ recurring })` (już wołanej w `handleRecurringSave`), która kończy się `revalidatePath` po swojej
stronie. Nie tworzymy nowej akcji ani równoległego przepływu zapisu.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Używane istniejące slugi `module.tasks` i `module.news`. Brak wpięć w
`permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

### 5a. Zadanie 1 — pasek akcji widoku zadań (`src/components/tasks/TasksPage.tsx`)
Kontekst: rząd akcji jest w `<div className="flex items-center gap-2 min-w-0 overflow-x-auto
[&>*]:flex-shrink-0">` (ok. linia 467). Ikony i ich warunki widoczności (stan faktyczny):
- **Kosz** (`Trash2`) — zawsze.
- **Grupowanie** `ListTree`/`Flag` — tylko gdy `canToggleGrouping` (`upcoming|overdue|all|multi`).
- **Sortuj „Zrobione"** (`CalendarCheck`) — zawsze.
- **Szukaj** (`Search`) — zawsze.
- **Powiadomienia** (`Bell`/`BellOff`) — zawsze.
- **Konfiguracja statusów** (`SlidersHorizontal`) — tylko `canEditStatuses` (właściciel listy).
- **Zaznacz wiele** (`CheckSquare`) — tylko `layout === "list"`.
- **Przełącznik układu** Lista/Kanban/Timeline — zawsze.
- **Clipboard dla Claude** — tylko `isAdmin`.

Zmiany:
1. **Wskazówka przewijania (AC-1):** owinąć strefę scrolla wrapperem `relative` i nałożyć dekoracyjny,
   zanikający gradient („fade") na **prawej** (i warunkowo lewej) krawędzi — `pointer-events:none`,
   kolor z `linear-gradient(to left, var(--bg-surface), transparent)` (tło nagłówka), widoczny tylko
   gdy realnie jest przepełnienie i tylko na wąskich ekranach. Odkrywalność bez psucia estetyki i bez
   hardcodowanych kolorów (C-30). Detekcja przepełnienia: prosty stan `canScrollRight/Left` liczony ze
   `scrollWidth/clientWidth/scrollLeft` na `onScroll` + na mount/resize (bez nowych zależności).
   `aria-hidden` na gradiencie; sam kontener dostaje `role`/`aria-label` „Pasek akcji — przewiń, by
   zobaczyć więcej" dla czytelności a11y.
2. **Spójność ikon per kontekst (AC-2):** utrzymujemy obecną zasadę „pokazuj akcję tam, gdzie ma sens"
   i **dokumentujemy ją** (komentarz zbiorczy nad rzędem opisujący warunki każdej ikony). Realne
   niespójności do usunięcia:
   - `canToggleGrouping` obejmuje `multi` (grupa wielu list) — grupowanie ma tam sens, zostawiamy;
     upewniamy się, że w widoku **pojedynczej listy/„Dziś"** brak tej pary jest zamierzony (jest — w
     „Dziś" grupowanie po priorytetach jest domyślne), i dodajemy `title`/`aria-label` spójne.
   - Ujednolicić rozmiary (wszystkie ikony `size={15}`) i odstępy, żeby pojawianie/znikanie nie
     „przeskakiwało" layoutu; brakujące `aria-label` uzupełnić (część ma tylko `title`).
   - Nie dodajemy/nie usuwamy żadnej funkcji — porządkujemy tylko widoczność i etykiety (C-53).

### 5b. Zadanie 2 — feedback zapisu cykliczności (`src/components/tasks/TaskDetail.tsx`)
Kontekst: `handleRecurringSave()` (ok. linia 186) woła `run(() => updateTask(task.id, { recurring }))`;
`run` używa `useTransition` → `isPending`. Przycisk „Zapisz" (ok. linia 669) to fioletowy button bez
własnego stanu. W nagłówku jest globalny `Loader2` przy `isPending` (linia 294) — na mobile łatwy do
przeoczenia.

Zmiany (AC-3):
- Dodać lokalny stan `recurringSaved` (`useState<boolean>`), ustawiany na `true` po udanym zapisie
  cykliczności i czyszczony po ~1.5 s (`setTimeout`, sprzątany w cleanup/ref jak istniejący
  `saveTimeout`).
- `handleRecurringSave` zmienić na: uruchom zapis przez `run(...)`, a po zakończeniu transition ustaw
  `recurringSaved=true` (np. `startTransition(async () => { await updateTask(...); })` z ustawieniem
  flagi po `await`, lub obserwacja przejścia `isPending` z pending→false po kliknięciu — wybieramy
  wariant z bezpośrednim `await` w lokalnej funkcji, spójny z `autosave`).
- Przycisk „Zapisz" pokazuje trzy stany, w miejscu (bez skoku layoutu): domyślnie „Zapisz"; podczas
  zapisu — `Loader2` (spin) + „Zapisywanie…", `disabled`; po sukcesie — `Check`/`CheckCircle2` +
  „Zapisano" (kolor `var(--accent-green)`), zanikające po ~1.5 s do „Zapisz". Kolory wyłącznie ze
  zmiennych CSS, tekst na tle akcentu = `var(--on-accent)` (C-30). Ikony z `lucide-react` już
  importowane (`Loader2`, `CheckCircle2`).
- To samo dotyczy równie „niewidocznego" `handleRecurringClear` — opcjonalnie ten sam wzorzec, ale
  minimalnie: wystarczy, że „Zapisz" daje feedback (AC-3 mówi o „Zapisz"). Clear zostawiamy bez
  dodatkowego stanu, chyba że to trywialne przy okazji (C-53 — nie rozdmuchujemy).

### 5c. Zadanie 3 — akcje tematów Wiadomości (`src/components/news/NewsPage.tsx`)
Kontekst: lista `space-y-1` (linia 325); każdy temat to `div.group … flex items-center gap-1 px-2
py-1.5`; przyciski Edytuj (`Pencil size={13}`) i Usuń (`Trash2 size={13}`) mają `hidden … 
group-hover:block` — na dotyku (brak hover) **nigdy** się nie pokazują.

Zmiany (AC-4):
- Zmienić widoczność: na mobile akcje **zawsze widoczne**, na desktopie zachować hover. Wzorzec Tailwind
  bez nowych zależności: zamiast `hidden group-hover:block` użyć np. `block md:hidden` dla widoczności
  bazowej + `md:group-hover:block` na desktopie — praktycznie: `class="text-… md:hidden
  group-hover:block md:group-hover:block"` upraszczamy do: **widoczne domyślnie**, a od `md` w górę
  `hidden` + `group-hover:block`. (tj. `block md:hidden md:group-hover:block`).
- Powiększyć cel dotyku i ikony na mobile: ikony `size={16}` (z 13), owinąć w przyciski z paddingiem
  spełniającym min. cel dotyku (C-31, `py`/`p` ~≥ `p-1.5`, realnie ~≥40px klikalnego pola razem z
  wysokością wiersza) — na desktopie mogą zostać kompaktowe.
- Ewentualnie podnieść wysokość wiersza tematu na mobile (`py-2`+) dla wygodnego dotyku; kolory bez
  zmian (już `var(--*)`). Badge `pendingCount` bez zmian.
- Zero zmian logiki (`setEditing`/`remove`) — tylko klasy/rozmiary. Desktop bez regresji (AC-5).

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowych `AIAction`, read-tooli, wpięć kalendarza/powiadomień/auto-expense.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/tasks/TasksPage.tsx` | edycja | Wskazówka scrolla (fade) na pasku akcji + ujednolicenie/dokumentacja widoczności ikon (AC-1, AC-2) |
| `worldofmag/src/components/tasks/TaskDetail.tsx` | edycja | Widoczny feedback „Zapisywanie…/Zapisano" przy zapisie cykliczności (AC-3) |
| `worldofmag/src/components/news/NewsPage.tsx` | edycja | Akcje tematu widoczne+większe na dotyku, hover na desktopie (AC-4) |
| `doświadczenia.md` | edycja | Wpis-lekcja (C-51): hover-only akcje niedostępne na dotyku + brak feedbacku transition na mobile |

## 8. Bramki i weryfikacja (C-50)
- Zmiany czysto frontowe — brak migracji, więc `check:migrations` bez nowych wpisów; brak nowej
  `AIAction`, więc `check:actions` bez zmian.
- Lokalna weryfikacja: `cd worldofmag && npm run build` do kroku `next build` (bez odpalania
  `migrate.js` przeciw prod DB — C-13; jeśli build lokalny nie ma DB, weryfikujemy do `next build`/
  `next lint`, ewentualnie `npx tsc --noEmit` na dotkniętych plikach).
- Mapowanie AC → weryfikacja:
  - **AC-1**: przegląd kodu + wąski viewport — gradient pojawia się przy przepełnieniu, znika gdy pasek
    mieści się w całości; `pointer-events:none` (nie blokuje kliknięć skrajnej ikony).
  - **AC-2**: przegląd — każda ikona ma udokumentowany warunek i `title`+`aria-label`; brak „gubionych"
    akcji; layout nie skacze przy zmianie widoku.
  - **AC-3**: interakcja — po „Zapisz" przycisk przechodzi Zapisywanie… → Zapisano (≤1 s) → Zapisz.
  - **AC-4**: wąski viewport — akcje Edytuj/Usuń widoczne bez hover, ikony ≥16px, wygodny cel dotyku;
    desktop nadal hover.
  - **AC-5**: przegląd desktopu — pasek, `TaskDetail`, lista tematów bez regresji.
- Opcjonalnie e2e „klikacze" wg runbooka, jeśli będzie potrzeba (nie wymagane dla zmian kosmetycznych).

## 9. Ryzyka techniczne i plan wycofania
- **Fade zasłania skrajną ikonę / łapie kliknięcia** → `pointer-events:none` + wąska szerokość
  gradientu; skrajna ikona ma `flex-shrink-0` i pełną klikalność. Mitygacja w testach wąskiego viewportu.
- **Feedback koliduje z globalnym `isPending`** → używamy tego samego transition; lokalna flaga
  `recurringSaved` jest niezależna i tylko dokłada widoczny stan po sukcesie, nie zmienia przepływu.
- **Regresja desktopu Wiadomości** → zmiana warunkowana breakpointem `md`; hover zachowany od `md` w górę.
- **Rollback**: zmiany wyłącznie w 3 plikach komponentów — rewert kodu (brak migracji, brak stanu w DB),
  czysty rollback po stronie kodu (por. runbook devops).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (bez zmian schematu; świadomie).
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — bez nowych akcji; korzystamy z istniejącego
      `updateTask`; brak zmian RBAC/AI/trash.
- [x] C-30 (motyw przez zmienne CSS) — gradient i stany feedbacku wyłącznie na `var(--*)`, `--on-accent`.
- [x] C-31 (mobile-first, cele dotyku) — sedno AC-1/AC-4; min. cel dotyku, brak zależności od hover.
- [x] C-32 (teksty PL) — „Zapisywanie…", „Zapisano", etykiety aria po polsku.
- [x] C-51 (lekcja do `doświadczenia.md`) — zaplanowany wpis.
- [x] C-53 (minimalizm) — 3 pliki, zero nowych zależności, zero refaktorów „przy okazji".
