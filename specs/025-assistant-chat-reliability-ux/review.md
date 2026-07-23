# Recenzja: Niezawodność i UX czatu asystenta AI

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-23
- **Diff:** 5 plików kodu (agent/route.ts, AICommandSheet.tsx, agentTools.ts, chat.ts, tpmLimiter.ts) + artefakty + `doświadczenia.md`. ~648 wstawień. Bez zmian schematu, bez nowych zależności.

## Ustalenia (od najpoważniejszego)

Brak ustaleń blokujących ani poważnych. Poniżej drobne obserwacje (nie wymagają zmian).

### 1. [simplification · drobne] Podwójne pobranie projektów w `list_tasks`
`agentTools.ts` — `list_tasks` woła najpierw `accessibleProjectIds(userId)` (findMany po projektach),
a `resolveProjectRef` robi drugi, analogiczny `findMany`. **Skutek:** dodatkowe zapytanie DB tylko gdy
podano `projectId`; dla systemu jednoosobowego pomijalne. **Sugestia (opcjonalna):** można by wpiąć
resolucję w jedną listę projektów, ale kosztem czytelności — zostawiam jak jest (C-53: jasne i
poprawne > mikrooptymalizacja). Nie blokuje.

### 2. [correctness · świadome] Skip używa surowego limitu, `reserveTpm` capuje 0.9×limit
`chat.ts` `requestExceedsModelLimit` porównuje `reserve > modelTpmLimit(model)` (pełny limit), a
`reserveTpm` rezerwuje wobec `0.9×limit`. **Skutek:** zapytanie między 0.9×limit a limit nie zostanie
pominięte (trafi do modelu), co jest zamierzone — pomijanie to gruba bramka „w ogóle się nie zmieści",
a nie precyzyjny pacing. Szacunek tokenów i tak jest przybliżony. **Werdykt:** poprawne dla celu (AC-5);
w najgorszym razie pojedynczy model dostanie 413 i zadziała istniejący fallback/komunikat. Nie blokuje.

## Weryfikacja pod kątem poprawności (przeszły)
- **Guard dostępu (C-21):** `resolveProjectRef` zwraca wyłącznie id projektów dostępnych dla użytkownika
  (owner/member), a `where.projectId = resolved.id` łączy się z istniejącym `OR` dostępu — brak wycieku
  cudzych zadań. ✅
- **Sygnał braku dopasowania:** nierozwiązany `projectId` → `throw` → `runReadTool` w pętli agenta łapie
  i zwraca `{ error }` (`agent/route.ts:576`) → agent robi `clarify`/`answer`, nie cichą pustkę (AC-2). ✅
- **Kompatybilność wstecz:** realne id → gałąź `byId`; `list_tasks` bez `projectId` → ścieżka
  niezmieniona. ✅
- **Fallback modeli:** pomijanie tylko dla Groq (`isTpmLimitedProvider`); Anthropic/inne bez zmian;
  `hadRealFailure` chroni uczciwy komunikat (429 dzienny z 70b nie jest nadpisywany placeholderem). ✅
- **Hoisting:** `requestExceedsModelLimit`/`isTpmLimitedProvider` (deklaracje funkcji) użyte w
  `chatComplete` powyżej ich definicji — poprawne (hoisting), potwierdzone zielonym buildem. ✅
- **Bezpieczeństwo (C-41):** żadna ścieżka nie zwraca surowej treści dostawcy — 413/429 mapowane na PL;
  klucze nietknięte, nielogowane. ✅

## Zgodność z konwencjami Omnia
- **C-01** praca w `worldofmag/` ✅ · **C-12** brak enumów Prisma (nie dotyczy) ✅ · **C-30** przycisk
  clarify na zmiennych CSS (`--accent-blue`/`--on-accent`), zero hardcode hexów ✅ · **C-31** mobilny cel
  dotyku (`padding:10px 16px`) ✅ · **C-32** teksty PL ✅ · **C-40** routing nadal DB-driven ✅ ·
  **C-53** minimalizm, bez nowych zależności ✅.

## Werdykt
**APPROVE.** Zmiany realizują wszystkie 6 kryteriów akceptacji, są poprawne, minimalne i zgodne z
konstytucją. Dwie drobne obserwacje wyżej są świadome i nie wymagają poprawek. Domykam pipeline: merge
do `develop` i automatyczna promocja `develop → master` (C-52).
