# Recenzja: Poprawki UI na mobile — zadania + asystent AI

- **Spec:** ./spec.md (018-mobile-ui-bugs) · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-22 · **Recenzent:** Claude Code (etap /review)

## Zakres
Diff względem `origin/develop`: 4 pliki, +19/−7 (czysto klient/CSS):
`globals.css`, `AICommandSheet.tsx`, `BulkActionBar.tsx`, `CompletedSection.tsx`.
Brak zmian schematu, migracji, Server Actions, RBAC, `AIAction`.

## Ustalenia
**Brak ustaleń** (żadnej kategorii: correctness / convention / simplification / security).

Przegląd pod kątem typowych defektów — wszystkie negatywne (w dobrym sensie):
- **Poprawność `globals.css`:** `font-size:16px !important` w regule `@media (pointer: coarse)` —
  `!important` w arkuszu autora bije deklarację inline bez `!important` (kaskada CSS), więc naprawia
  dokładnie zgłoszony przypadek (inline `fontSize:15` kompozytora). Zakres ograniczony do urządzeń
  dotykowych → brak wpływu na desktop. Poprawne.
- **`AICommandSheet.tsx`:** inline `paddingBottom` nadpisuje dolny `py-3`; na desktopie
  `env(safe-area-inset-bottom)=0` → zachowanie bez zmian. Poprawne.
- **`BulkActionBar.tsx`:** `overflow-x-auto [&>*]:flex-shrink-0` na rzędzie akcji — popovery są
  **rodzeństwem** rzędu (dziećmi `relative` pigułki), więc nie są przycinane; treść rzędu nie ma
  przepełnienia pionowego. Poprawne, wzorzec zgodny z `TasksPage.tsx:494`.
- **`CompletedSection.tsx`:** `key={sortBy}` (stabilne stringi „default"/„completedAt") remountuje
  `TaskGroup`, ponownie stosując `defaultOpen` — zamierzone i poprawne; brak nowych zależności.
- **Konwencje:** brak enumów Prisma (C-12 n/d), zero hardcodu kolorów (C-30), warianty mobilne
  zaadresowane (C-31), teksty/komentarze PL (C-32), praca w `worldofmag/` (C-01). ✅
- **Bezpieczeństwo:** brak renderu markdown/HTML, brak kluczy/logów, brak akcji serwerowych →
  brak powierzchni ataku w tym diffie. ✅
- **Minimalizm (C-53):** najmniejszy możliwy zestaw zmian, reuse istniejących wzorców. ✅

## Werdykt
**APPROVE.** Diff jest poprawny, zgodny z konwencjami Omnia i minimalny; wszystkie AC pokryte
(patrz `verify.md`), bramki zielone. Domknięcie: merge do `develop` + automatyczna promocja na
`master` (C-52).
