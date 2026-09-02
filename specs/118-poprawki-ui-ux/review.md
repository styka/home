# Recenzja: Paczka poprawek UI/UX ze zgłoszeń administratora

- **Spec:** ./spec.md (118-poprawki-ui-ux)
- **Data:** 2026-09-01
- **Zakres:** `git diff origin/master...HEAD` (bez `src/generated/` — bakowane artefakty buildu);
  recenzja własna + świeże oko subagenta omnia-reviewer.

## Ustalenia (od najpoważniejszego)

1. **`src/modules/tasks/ui/ModalDodaniaZadania.tsx:33` — simplification (drobiazg, NANIESIONE).**
   `className="md:mx-4"` przekazywany do `Modal` był redundantny (baza prymitywu już go ma —
   `Modal.tsx:44`); zero skutku w runtime, ale mylił czytelnika sugerując odmienny układ.
   Poprawka: prop usunięty w ramach recenzji.
2. **`src/components/shell/ModuleSidebar.tsx` — convention (informacyjne, bez akcji).**
   Przycisk zwijania i ikony chromu w zwiniętej kolumnie mają ~28 px — poniżej 44 px celu
   dotyku, ale panel jest `hidden md:flex` (tylko komputer), a sąsiednie przyciski rzędu chromu
   (gwiazdka, ściągawka) mają od dawna te same wymiary — zgodne z panującym stylem, nie
   naruszenie C-31.

## Sprawdzone i czyste (główni kandydaci na regresje)

- Usunięcie `QuickAddTask`: zero martwych referencji w `src`/`e2e`; martwe klucze i18n usunięte,
  nowe dodane; page-object e2e `addTask` odporny (sam naciska `a`, gdy pola nie widać).
- Skróty przy otwartym modalu: `useKeyboardShortcuts` odsiewa cele piszące; Esc i pułapka focusu
  z Radix Dialog.
- Migracja 0288 czysto addytywna i zgodna ze `schema.prisma`; `Boolean` to nie przypadek C-12.
- `updateMenuPrefs`: patch scala się z bieżącym stanem, `revalidatePath` (C-20) i `requireAuth`
  (C-21) na miejscu.
- Executor feedbacku: `taskId` w zwrotce, `?task=` czytane przez `TasksRouteView`, link tylko
  przy `canRead`.
- `Button` nowrap + flex w stylach Roślin: dwa pozostawione `verticalAlign` siedzą w inline'owych
  `<p>` — właściwa technika, świadomie nietknięte.
- Formularze Roślin w `Modal`: Enter zapisuje jak dotąd, ostrzeżenie płodozmianowe czyszczone
  przy zamknięciu, przycisk zapisu w stopce bez zmiany logiki.
- `TaskFilters`: guard pustego paska (kanban bez etykiet) zachowany; jedyny konsument to
  `TasksPage`; semantyka koniunkcji etykiet nietknięta.

## Werdykt

**APPROVE** (ustalenie 1 naniesione w recenzji; ustalenie 2 informacyjne). Zgodnie z C-52:
merge `claude/worldofmag-ui-bugs-pplbag` → `develop` → push, następnie automatyczna promocja
`develop → master` (`--ff-only`) po kontroli integralności.
