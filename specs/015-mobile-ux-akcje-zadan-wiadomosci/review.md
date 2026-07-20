# Recenzja: Poprawki UX/UI mobile — pasek akcji zadań, feedback cykliczności, ikony Wiadomości

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md
- **Commit recenzowany:** c308204 (diff vs `origin/develop`)
- **Data:** 2026-07-20

## Zakres
Diff: 3 pliki kodu (`TasksPage.tsx` +65/-… , `TaskDetail.tsx` +35, `NewsPage.tsx` +14) + artefakty
pipeline'u + wpis do `doświadczenia.md`. Zmiany wyłącznie prezentacyjne — brak migracji, Server
Actions, RBAC, AI.

## Ustalenia (od najpoważniejszego)
Brak ustaleń blokujących ani istotnych. Poniżej drobne obserwacje (nie wymagają zmian):

1. **`TasksPage.tsx:111–126` — convention/minor.** useEffect przeliczający `actionScroll` nie zależy
   od `counts.ALL` (szerokość napisu „N aktywne") ani `isSearchOpen`. Skutek: teoretycznie fade mógłby
   być chwilowo nieaktualny po zmianie licznika bez resize/scroll. W praktyce różnica szerokości jest
   znikoma, a `onScroll` + `resize` + zmiana widoku/układu pokrywają realne przypadki. Zgodne z
   minimalizmem (C-53) — świadomie zostawione.
2. **`NewsPage.tsx:346/354` — convention.** `p-1.5` daje ~28px celu dotyku wokół ikony 16px; to
   spójne z pozostałymi ikon-przyciskami w repo (`p-1.5` w `TasksPage`) i mieści się w wyższym wierszu
   tematu. Akceptowalne dla akcji ikonowej; nie blokuje.
3. **`TaskDetail.tsx:201–209` — correctness (sprawdzone, OK).** `recurringSavedTimeout` nie jest
   czyszczony przy unmount — **identycznie jak istniejący `saveTimeout`** w tym samym pliku; setState
   po unmount w React 18 nie rzuca ostrzeżeń. Spójne z panującym wzorcem (C-53).

## Poprawność (prześledzone scenariusze)
- **Feedback zapisu (`TaskDetail`):** `handleRecurringSave` czyści poprzedni timeout, ustawia
  `saving`, w `startTransition(async … await updateTask …)` po `await` ustawia `saved` i planuje
  reset po 1500 ms. Kolejne kliknięcia nie kumulują timeoutów (clear na wejściu). `disabled` blokuje
  podwójny zapis w trakcie. ✅
- **Fade scrolla (`TasksPage`):** overlay renderowany tylko przy `actionScroll.left/right`,
  `pointer-events:none` + `aria-hidden` — nie przechwytuje kliknięć skrajnej ikony (`flex-shrink-0`).
  Przelicz na mount/scroll/resize/zmianę widoku. `role="toolbar"` + `aria-label` po polsku. ✅
- **Akcje Wiadomości (`NewsPage`):** `md:hidden md:group-hover:block` — na mobile (bez `md`) przyciski
  widoczne domyślnie; od `md` chowane i pokazywane na hover (ten sam mechanizm nadpisywania co
  oryginalne `group-hover:block` nad `hidden`, potwierdzony przez zielony `next build`). Logika
  `setEditing`/`remove` bez zmian. ✅

## Konwencje Omnia
- **C-30** ✅ tylko `var(--*)` (`--bg-surface`, `--accent-green`, `--accent-purple`, `--on-accent`); zero hexów.
- **C-31** ✅ mobile-first: odkrywalność scrolla, brak zależności od hover na dotyku, cel dotyku.
- **C-32** ✅ teksty PL, aria-label PL.
- **C-01** ✅ zmiany tylko w `worldofmag/`.
- **C-12/C-20/C-21/C-23** — nie dotyczy (bez enumów/akcji/RBAC/AI).
- **C-53** ✅ 3 pliki, zero nowych zależności, brak refaktorów „przy okazji".

## Bezpieczeństwo
Brak. Żadnych kluczy, uprawnień, renderu HTML/markdown ani nowych ścieżek danych.

## Werdykt
**APPROVE.** Zmiany poprawne, minimalne, zgodne z konstytucją; wszystkie AC pokryte (verify.md),
wszystkie bramki zielone. Domykam → merge do `develop`.
