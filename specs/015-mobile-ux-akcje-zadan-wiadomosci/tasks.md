# Zadania: Poprawki UX/UI mobile — pasek akcji zadań, feedback cykliczności, ikony Wiadomości

- **Plan:** ./plan.md (015-mobile-ux-akcje-zadan-wiadomosci)
- **Status:** done
- **Data:** 2026-07-20

> Kolejność od najłatwiejszego do najtrudniejszego. Wszystkie zmiany są UI-only (bez migracji,
> Server Actions, RBAC, AI). `[P]` = niezależny plik, można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane

## Faza 0 — Fundament danych
- Nie dotyczy (bez zmian schematu/migracji — plan §2).

## Faza 1 — Warstwa serwera / RBAC
- Nie dotyczy (bez nowych Server Actions ani slugów — plan §3, §4).

## Faza 2 — UI

### Zadanie 3 (najprostsze) — Wiadomości
- [x] **T-1** `[P]` — `src/components/news/NewsPage.tsx`: akcje tematu (Edytuj `Pencil`, Usuń `Trash2`)
  widoczne na dotyku zamiast `hidden group-hover:block` → domyślnie widoczne, na desktopie
  `md:hidden md:group-hover:block`. Ikony 13→16px, cel dotyku ≥ `p-1.5` (C-31). Bez zmian logiki
  `setEditing`/`remove`. **Gotowe, gdy:** na wąskim viewport akcje widać bez hover i są wygodnie
  dotykalne; na `md+` nadal pojawiają się na hover; desktop bez regresji. (AC-4, AC-5)

### Zadanie 2 — feedback zapisu cykliczności
- [x] **T-2** `[P]` — `src/components/tasks/TaskDetail.tsx`: lokalny stan `recurringSaved` (+ czyszczący
  `setTimeout`/ref jak istniejący `saveTimeout`); `handleRecurringSave` zapisuje przez transition i po
  `await` ustawia flagę. Przycisk „Zapisz" cykliczności: Zapisz → „Zapisywanie…" (`Loader2`, disabled) →
  „Zapisano" (`CheckCircle2`, `var(--accent-green)`, ~1.5 s) → Zapisz. Kolory ze zmiennych CSS,
  `--on-accent` na tle akcentu (C-30). **Gotowe, gdy:** po dotknięciu „Zapisz" na mobile widać stan
  zapisu i potwierdzenie ≤1 s, bez skoku layoutu. (AC-3, AC-5)

### Zadanie 1 (najtrudniejsze) — pasek akcji widoku zadań
- [x] **T-3** — `src/components/tasks/TasksPage.tsx` (część A: spójność ikon): ujednolicić rozmiary
  ikon paska (`size={15}`), uzupełnić brakujące `aria-label` (część ma tylko `title`), dodać komentarz
  zbiorczy dokumentujący warunek widoczności każdej ikony (Kosz/Sort/Szukaj/Powiadomienia = zawsze;
  Grupowanie = `canToggleGrouping`; Statusy = `canEditStatuses`; Zaznacz wiele = `layout==="list"`;
  Clipboard = `isAdmin`). Bez dodawania/usuwania funkcji. **Gotowe, gdy:** warunki są udokumentowane i
  spójne, layout nie „przeskakuje" przy zmianie widoku. (AC-2)
- [x] **T-4** — `src/components/tasks/TasksPage.tsx` (część B: wskazówka scrolla): owinąć strefę
  `overflow-x-auto` wrapperem `relative`; stan `canScrollLeft/Right` liczony ze
  `scrollWidth/clientWidth/scrollLeft` (`onScroll` + mount/resize); dekoracyjny fade
  (`linear-gradient(..., var(--bg-surface), transparent)`, `pointer-events:none`, `aria-hidden`) na
  krawędzi, widoczny tylko przy realnym przepełnieniu; `aria-label` „przewiń, by zobaczyć więcej".
  **Gotowe, gdy:** przy przepełnieniu widać zanikający gradient sygnalizujący scroll, znika gdy pasek
  się mieści, skrajna ikona pozostaje w pełni klikalna. (AC-1, AC-5)

## Faza 3 — AI / integracje
- Nie dotyczy (plan §6).

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — Weryfikacja typów/lintu na dotkniętych plikach: `cd worldofmag && npx tsc --noEmit`
  (oraz `next lint`/`next build` do kroku `next build`, jeśli środowisko pozwala — **bez** `migrate.js`
  przeciw prod DB, C-13). **Gotowe, gdy:** brak błędów TS/lint na 3 zmienionych plikach.
- [x] **T-6** — Mapowanie AC → wynik (input do `/verify`): AC-1↔T-4, AC-2↔T-3, AC-3↔T-2, AC-4↔T-1,
  AC-5↔wszystkie (brak regresji desktopu).
- [x] **T-7** — Wpis-lekcja do `doświadczenia.md` (C-51): hover-only akcje niedostępne na dotyku +
  brak widocznego feedbacku `useTransition` na mobile + odkrywalność scrolla poziomego.

## Ścieżka krytyczna
T-3 → T-4 (oba w tym samym pliku `TasksPage.tsx`, więc sekwencyjnie). T-1 i T-2 niezależne (`[P]`,
inne pliki). Wszystkie UI → T-5 (bramki) → T-6 (mapowanie AC) → T-7 (lekcja).

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (wskazówka scrolla) | T-4 |
| AC-2 (spójność ikon per kontekst) | T-3 |
| AC-3 (feedback zapisu cykliczności) | T-2 |
| AC-4 (akcje Wiadomości dotykalne) | T-1 |
| AC-5 (brak regresji desktopu) | T-1, T-2, T-3, T-4 |
