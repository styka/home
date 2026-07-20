# Weryfikacja: Poprawki UX/UI mobile — pasek akcji zadań, feedback cykliczności, ikony Wiadomości

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-20
- **Commit:** c308204

## Bramki
| Komenda | Wynik | Uwaga |
|---------|-------|-------|
| `npm run check:migrations` | ✅ EXIT 0 | „Numeracja migracji OK (następny wolny: 0206)". Brak nowych migracji (feature UI-only). |
| `npm run check:actions` | ✅ EXIT 0 | 159 akcji, wszystkie obsłużone. Brak nowej `AIAction`. |
| `npx next lint --dir src` | ✅ EXIT 0 | Zero ostrzeżeń z 3 zmienionych plików; pozostałe to preexisting (img/exhaustive-deps w innych modułach). |
| `npx tsc --noEmit` | ✅ EXIT 0 | Typy czyste. |
| `npx next build` | ✅ EXIT 0 | Pełna kompilacja, w tym `/tasks/[projectId]` i `/wiadomosci`. Bez `migrate.js` (C-13). |

## Kryteria akceptacji
| AC | Werdykt | Dowód / jak sprawdzone |
|----|---------|------------------------|
| **AC-1** — wskazówka przewijania paska akcji na mobile | ✅ | `TasksPage.tsx`: strefa scrolla owinięta wrapperem `relative` (l. 486), `ref={actionsScrollRef}` + `onScroll` przeliczający `actionScroll{left,right}` ze `scrollWidth/clientWidth/scrollLeft` (l. 488–496); dekoracyjny fade `linear-gradient(..., var(--bg-surface), transparent)` renderowany **warunkowo** przy `actionScroll.left/right` (l. 635–648), `pointer-events:none` + `aria-hidden` → nie łapie kliknięć, znika gdy pasek się mieści. Efekt przeliczany na mount/resize (useEffect l. 116–126) i przy zmianie zestawu ikon (deps: viewMode/layout/canEditStatuses/isAdmin/selectionMode). |
| **AC-2** — spójność ikon per kontekst | ✅ | `TasksPage.tsx`: komentarz zbiorczy dokumentujący warunek widoczności każdej ikony (l. ~500–508 nad rzędem); wszystkie ikony `size={15}` (spójne, brak skoku layoutu); uzupełnione `aria-label` na wszystkich przyciskach, które miały tylko `title` (Kosz, ListTree, Flag, CalendarCheck, Search, Bell/BellOff, SlidersHorizontal). Żadna funkcja nie dodana/usunięta — porządek i etykiety (C-53). |
| **AC-3** — widoczny feedback zapisu cykliczności (mobile) | ✅ | `TaskDetail.tsx`: `handleRecurringSave` ustawia `recurringSaving=true`, zapisuje przez `startTransition(async … await updateTask)`, po `await` `recurringSaving=false` + `recurringSaved=true`, czyszczone `setTimeout(…,1500)` (l. 199–209). Przycisk (l. 682–698) trzy stany w miejscu: „Zapisz" → „Zapisywanie…" (`Loader2` spin, `disabled`) → „Zapisano" (`CheckCircle2`, tło `var(--accent-green)`); tekst na akcencie = `var(--on-accent)`. Brak skoku layoutu (`inline-flex items-center gap-1`). |
| **AC-4** — akcje tematów Wiadomości dotykalne na mobile | ✅ | `NewsPage.tsx`: `hidden group-hover:block` → domyślnie widoczne + `md:hidden md:group-hover:block` (hover tylko od `md`, l. 346/354); ikony 13→`size={16}` (l. 350/358), `p-1.5` na cel dotyku; dodane `aria-label` (l. 348/356). Logika `setEditing`/`remove` bez zmian. |
| **AC-5** — brak regresji desktopu | ✅ | Zmiany warunkowane breakpointem `md`/stanem: fade pojawia się tylko przy realnym przepełnieniu (na desktopie pasek zwykle się mieści → brak fade); akcje Wiadomości od `md` zachowują hover; feedback zapisu działa tak samo na desktopie. `next build` + `tsc` zielone → brak błędów kompilacji na dotkniętych ścieżkach. |

## Zgodność z konstytucją
- **C-30** ✅ — gradient i stany feedbacku wyłącznie na `var(--*)` (`--bg-surface`, `--accent-green`, `--on-accent`); zero hardcoded hexów.
- **C-31** ✅ — sedno AC-1/AC-4: odkrywalność scrolla, brak zależności od hover na dotyku, `p-1.5` cel dotyku.
- **C-32** ✅ — teksty PL („Zapisywanie…", „Zapisano", aria-label po polsku).
- **C-20/C-21** ✅ — brak nowych akcji; korzystamy z istniejącego `updateTask` (revalidatePath po jego stronie). Brak zmian własności/RBAC.
- **C-53** ✅ — 3 pliki, zero nowych zależności (wszystkie ikony już importowane), zero refaktorów „przy okazji".
- **C-51** ✅ — wpis-lekcja dopisany do `doświadczenia.md` (2026-07-20).
- **C-10..C-14, C-23, C-40** — nie dotyczy (bez schematu/migracji/AI), świadomie.

## Regresje
- **Brak nowych migracji / AIAction** → `check:migrations` i `check:actions` zielone; sąsiednie moduły nietknięte.
- **Wspólne komponenty:** zmiany lokalne w `TasksPage`/`TaskDetail`/`NewsPage`; brak modyfikacji współdzielonych helperów/akcji.
- **`overflow-x-auto` a popovery:** `ProjectActionsMenu` pozostaje POZA strefą scrolla (bez zmian) — fade nie wpływa na przycinanie menu.
- **Fade a klikalność:** `pointer-events:none` na nakładkach; skrajne ikony mają `flex-shrink-0` i pełną klikalność.

## Werdykt końcowy
**GOTOWE.** Wszystkie bramki (check:migrations, check:actions, lint, tsc, build) zielone; AC-1…AC-5
spełnione z dowodami w kodzie; brak naruszeń konstytucji i regresji. Przejście do `/review`.
