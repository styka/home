# Recenzja: Asystent AI nie redaguje treści opisu zadania

- **Spec:** ./spec.md (012-task-description-verbatim)
- **Data:** 2026-07-20
- **Recenzent:** Claude Code (spec-driven pipeline, etap /review)

## Zakres diffa
Kod (3 pliki, po ~1 linii każdy) + artefakty pipeline'u + wpis do `doświadczenia.md`:
- `worldofmag/src/app/api/llm/home/agent/route.ts` — sekcja `create_task` OPIS (verbatim) + reguła bulk-add.
- `worldofmag/src/components/home/AICommandSheet.tsx` — prompt zgłoszenia admina (`params.description`).
- `worldofmag/src/lib/ai/fastPath.ts` — SYSTEM_PROMPT `create_task` (klauzula verbatim).

## Ustalenia
Brak ustaleń correctness/convention/simplification/security. Szczegóły przeglądu:

- **Poprawność** — ✅ Zmiana to wyłącznie treść instrukcji promptu; brak logiki sterującej, warunków,
  `await`, guardów, migracji ani `AIAction`. Kod akcji (`tasksExecutor.ts:42` → `createTask`) nietknięty i
  nadal zapisuje `description` wiernie. `tsc --noEmit` = 0 błędów potwierdza, że edycje literałów nie
  złamały stringów (brak niezaescapowanych ASCII `"`, brak wprowadzonych backticków/`${` w template
  literałach). Reguła generowania tytułu świadomie zachowana — brak regresji.
- **Spójność (C-53/C-54)** — ✅ Trzy prompty, w których LLM ustala `description` przy tworzeniu zadania,
  dostały spójną instrukcję verbatim (agent + fast-path + zgłoszenie). Bez tego zachowanie zależałoby od
  ścieżki (fast-path vs agent). Zero nowych abstrakcji/zależności/martwego kodu.
- **Konwencje Omnia** — ✅ Praca w `worldofmag/` (C-01); brak enumów Prisma (C-12 — brak schematu);
  brak hardcodu kolorów / zmian UI (C-30/C-31 — nie dotyczą); instrukcje po polsku (C-32).
- **Bezpieczeństwo** — ✅ Brak logowania kluczy (C-41), brak zmian w kontroli uprawnień (zgłoszenia admina
  nadal za `isAdmin`; brak eskalacji — zadanie i tak powstaje w projekcie właściciela), brak wektora XSS
  (renderer markdown escapuje `&`/`<` — bez zmian).

## Zgodność ze specem/planem/verify
- Wszystkie 6 AC potwierdzone w `verify.md` (dowody plik:linia). Werdykt verify: GOTOWE Z UWAGAMI
  (jedyna uwaga: pełny `next build` pominięty wg C-13; pokryte przez tsc+lint). Recenzja to potwierdza.

## Werdykt
**APPROVE** — zmiana minimalna, poprawna, zgodna z konstytucją; realizuje intencję właściciela (opis usera
verbatim, tytuł generowany, kontekst zgłoszenia nadal doklejany). Domykam: merge `claude/*` → `develop`.
