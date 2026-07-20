# Plan techniczny: Poprawki UX/UI — przepełnienie, widoczność ikon/pól, zoom na focus

- **Spec:** ./spec.md (014-ux-ui-polish-fixes)
- **Status:** draft
- **Data:** 2026-07-20

> **Zasada planu:** to jest **JAK**. Cztery niezależne poprawki front-endowe, każda pod istniejący kod.
> Zero zmian w schemacie, danych, RBAC i AI. Minimalizm (C-53): najmniejsze zmiany realizujące AC.

## 1. Podejście
Cztery rozłączne defekty, każdy z ustaloną w rekonesansie **pierwotną przyczyną** — poprawiamy dokładnie
te miejsca, bez refaktorów. Wszystko przez zmienne CSS (C-30). Wzorce naśladujemy z sąsiedztwa: pole daty
z `TaskDetail.tsx` (Start), zawijanie treści ze stylów markdown, detekcja nakładek z `useOverlayState`.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Feature nie tworzy ani nie zmienia żadnego modelu/kolumny → **brak migracji**
(C-10/C-11/C-12 nie dotyczą).

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian.** Żadnych nowych/zmienionych Server Actions ani `revalidatePath`. Brak dostępu do danych →
guardy `ownerId`/`ownerTeamId` (C-21) nie dotyczą.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Brak nowego slug'a, brak wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32) — sedno feature'a

### 5.1. AC-1 — przepełnienie treści w Wiadomościach
Dwie pierwotne przyczyny:
1. **Grid track `1fr` bez `min-w-0`** — w `NewsPage.tsx` layout to `grid gap-5 md:grid-cols-[240px_1fr]`
   (kolumna główna). Track `1fr` ma domyślnie `min-width:auto`, więc długi niełamliwy string (URL) lub
   szeroki obraz **rozpycha całą stronę** w poziomie. Fix: nadać kolumnie treści `min-w-0` (opakować
   zawartość drugiej kolumny gridu w kontener `min-w-0`).
2. **Brak łamania długich URL/tekstu** — w `NewsItemCard.tsx` (`title` span, `summary` `<p>`) oraz w
   stylach markdown (`MARKDOWN_STYLES` w `src/lib/markdown.ts`, klasa `markdown-body` z `KnowledgePanel`)
   brakuje `overflow-wrap`/`word-break`. Fix: dodać zawijanie tam, gdzie tekst pochodzi od zewnętrznych
   źródeł: `.md-p`, `.md-li`, `.md-oli`, `.md-td`, `.md-link` → `overflow-wrap: anywhere; word-break:
   break-word;` oraz `.md-table` opakować/`display:block; overflow-x:auto` na kontenerze; w `NewsItemCard`
   dać tytułowi/streszczeniu `break-words` + `min-w-0` na kontenerze linku (obraz już ma `max-h-52 w-full
   object-cover` — bez zmian).

Kolory/kontrast bez hardcode — używamy istniejących zmiennych (C-30).

### 5.2. AC-2 / AC-5 — widoczność ikony asystenta AI przy szczegółach zadania
Pierwotna przyczyna: FAB (`AICommandSheet.tsx`, `{!modalOpen && …}`) jest chowany, gdy `useOverlayState`
wykryje „modal treściowy" selektorem `'[class~="fixed"][class~="inset-0"]:not([data-omnia-overlay])'`.
Mobilny panel szczegółów w `TasksPage.tsx` to `md:hidden fixed inset-0 z-50` — **element jest w DOM także
na desktopie** (ukryty tylko CSS-em `md:hidden`), a `document.querySelector` matchuje po klasach, nie po
`display`. Dlatego otwarcie zadania chowa FAB **i na mobile, i na desktopie**.

Fix (minimalny): oznaczyć wrapper mobilnego panelu szczegółów zadania atrybutem
`data-omnia-overlay="taskdetail"` (`TasksPage.tsx`, blok `md:hidden fixed inset-0 z-50`). Wtedy selektor
`:not([data-omnia-overlay])` go pomija → `modalOpen` nie zapala się przy szczegółach zadania:
- desktop: brak matcha → FAB widoczny nad panelem bocznym (FAB ma `zIndex 41`, panel jest w normalnym
  flow) ✓
- mobile: panel wykluczony z detekcji → FAB (`bottom-[calc(72px+safe-area)]`, `zIndex 41`) unosi się nad
  pełnoekranowym panelem i jest klikalny ✓

Świadomie **nie** ruszamy ogólnej reguły „chowaj FAB nad modalami treściowymi" — szczegóły zadania to
panel/ekran roboczy, nie przelotny dialog, więc wyjątek jest zasadny i zgodny z intencją zgłoszenia.
Brak hardcode kolorów → AC-5 zachowane.

### 5.3. AC-3 / AC-5 — widoczność pola daty przy ręcznym dodawaniu zadania
Pierwotna przyczyna: w `QuickAddTask.tsx` pole `type="date"` jest `bg-transparent`, `px-1 py-0.5`,
`width:120`, bez ikony/etykiety — na tle `bg-surface` z obramowaniem `var(--border)` (subtelne) puste
pole (natywny placeholder) łatwo przeoczyć. Referencyjne pola w `TaskDetail.tsx` mają poprzedzającą ikonę
`Calendar` + etykietę i większy padding, dzięki czemu czytają się jako pole nawet puste.

Fix (naśladując `TaskDetail`, C-53): podnieść wizualną wagę pola daty w `QuickAddTask` — nadać tło
`var(--bg-elevated)`, zwiększyć padding do poziomu innych pól (`px-2 py-1`) i dodać drobną ikonę
`Calendar` (`lucide-react`, jak w `TaskDetail`) jako afordancję. Wyłącznie zmienne CSS (C-30), tekst PL
(`title="Termin"` zostaje). Efekt: pole wyraźnie odróżnia się od tła w każdej skórce (AC-5).

### 5.4. AC-4 — auto-zoom po focusie pola (iOS)
Pierwotna przyczyna: iOS Safari automatycznie przybliża widok, gdy focusowane pole ma `font-size < 16px`
(wiele pól używa `text-sm`/`text-xs`). Zgodnie z decyzją ze speca (§8) wybieramy rozwiązanie **przyjazne
dostępności** — **nie** blokujemy pinch-zoomu (`user-scalable`/`maximum-scale` zostają bez zmian), tylko
wymuszamy min. 16px na kontrolkach formularzy na urządzeniach dotykowych.

Fix: reguła w `globals.css` w `@media (pointer: coarse)`:
```css
@media (pointer: coarse) {
  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea { font-size: 16px; }
}
```
Specyficzność `input:not([type="checkbox"])…` (≈0,0,2,1) przebija utility Tailwinda `.text-xs`/`.text-sm`
(0,0,1,0) **bez** `!important`. Desktop (`pointer: fine`) nietknięty → gęstość na komputerze bez zmian.
Na mobile pola stają się 16px (i tak lepszy cel dotyku, C-31) — świadomy, akceptowalny koszt gęstości.

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Zero nowych `AIAction`/read-tooli (to tylko widoczność istniejącego FAB), zero routingu
LLM, kalendarza, powiadomień, trasha.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/news/NewsPage.tsx` | edycja | `min-w-0` na kolumnie treści gridu (AC-1) |
| `worldofmag/src/components/news/NewsItemCard.tsx` | edycja | `break-words`/`min-w-0` na tytule i streszczeniu (AC-1) |
| `worldofmag/src/lib/markdown.ts` | edycja | `overflow-wrap/word-break` w `MARKDOWN_STYLES`; scroll tabel (AC-1) |
| `worldofmag/src/components/tasks/TasksPage.tsx` | edycja | `data-omnia-overlay="taskdetail"` na mobilnym panelu (AC-2) |
| `worldofmag/src/components/tasks/QuickAddTask.tsx` | edycja | tło+padding+ikona pola daty (AC-3) |
| `worldofmag/src/app/globals.css` | edycja | reguła `@media (pointer: coarse)` font-size 16px (AC-4) |
| `doświadczenia.md` | edycja | wpis lekcji (C-51) |

## 8. Bramki i weryfikacja (C-50)
- Lokalnie: to zmiany czysto front-endowe (CSS/JSX) — **bez migracji i bez dotykania DB** (C-13). Weryfikacja
  do kroku `next build` / `next lint`; `check:migrations` i `check:actions` przechodzą trywialnie (brak
  nowych migracji/akcji).
- Mapowanie AC → sprawdzenie:
  - **AC-1**: przegląd, że kolumna treści ma `min-w-0` a treść/markdown zawijają długie URL; brak poziomego
    scrolla przy szerokim obrazie/długim linku (weryfikacja wizualna na wąskim widoku).
  - **AC-2**: przy otwartych szczegółach zadania (mobile modal + desktop panel) `modalOpen` nie zapala się
    → FAB renderowany; sprawdzić że atrybut wyklucza panel z `CONTENT_MODAL_SELECTOR`.
  - **AC-3**: puste pole daty w `QuickAddTask` ma tło `--bg-elevated` + ikonę → widoczne; porównać wizualnie
    z polem Start w `TaskDetail`.
  - **AC-4**: pole formularza na mobile ma efektywnie `font-size:16px` (DevTools/urządzenie) → brak
    auto-zoomu; pinch-zoom nadal działa (brak `maximum-scale`).
  - **AC-5**: przełączenie skórek Dark/Light/Casual/Blue/Pink — pole daty i FAB czytelne (brak hardcode).
- `npm run build` musi przejść (C-50), po czym auto-merge do `develop` (C-52).

## 9. Ryzyka techniczne i plan wycofania
- **Zoom vs. gęstość na mobile:** 16px na wszystkich polach mobilnych zmienia gęstość drobnych inputów
  (np. pola daty). Mitygacja: reguła tylko `pointer: coarse`; desktop nietknięty. Rollback: usunięcie
  reguły z `globals.css`.
- **Agresywne łamanie (`break-word`) brzydko dzieli zwykły tekst:** stosujemy `overflow-wrap: anywhere`
  głównie na treściach zewnętrznych (markdown, tytuły/URL newsów), nie globalnie. Rollback: cofnięcie
  reguł w `markdown.ts`/`NewsItemCard`.
- **Wykluczenie panelu z detekcji nakładek:** admin. przycisk „zgłoś błąd" (FeedbackInspector) nie wskoczy
  nad panel szczegółów — akceptowalne (panel ma własny nagłówek). Rollback: usunięcie atrybutu.
- Wszystkie zmiany są **czysto kodowe** (bez migracji) → rollback = rewert commita, bez procedury DB
  (runbook devops nie dotyczy).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu), świadomie potwierdzone.
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — **nie dotyczy** (brak akcji/danych/AI).
- [x] C-30 — tylko zmienne CSS, zero hardcode hexów (pole daty, FAB, treści).
- [x] C-31 — mobile-first: overflow/zoom/widoczność FAB naprawiane głównie pod telefon; brak drugiego
  sidebara; `pointer: coarse` celuje w dotyk.
- [x] C-32 — teksty UI po polsku (brak nowych tekstów poza istniejącym `title="Termin"`).
- [x] C-53 — minimalizm: sześć punktowych edycji, zero nowych zależności/abstrakcji/refaktorów.
- [x] C-50/C-51/C-52 — build zielony → wpis do `doświadczenia.md` → auto-merge do `develop`.
