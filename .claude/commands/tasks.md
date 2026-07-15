---
description: Etap 3 SDD — rozbij plan na listę zadań i przejdź automatycznie do implementacji (specs/NNN-slug/tasks.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 3 (TASKS)** spec-driven pipeline'u Omnia. Zamieniasz plan techniczny w
**uporządkowaną, weryfikowalną listę zadań** gotową do wykonania przez `/implement`. Pracujesz
**autonomicznie** i po skończeniu **sam uruchamiasz `/implement`**.

## Model interakcji
Wszystkie decyzje właściciela zebrano na etapie `/specify`. **Nie zadawaj pytań.** Rozbicie na zadania
to praca mechaniczna na bazie planu — jeśli coś jest niedopowiedziane, przyjmij domyślne wynikające z
planu i jedź dalej.

## Wejście
Feature: **$ARGUMENTS**. Jeśli pusty — najnowszy katalog w `specs/` z `plan.md` a bez `tasks.md`.

## Zanim rozbijesz
1. Przeczytaj `specs/NNN-slug/plan.md` (i w razie potrzeby `spec.md` — po kryteria akceptacji).
2. Wczytaj szablon: @.claude/spec-pipeline/templates/tasks-template.md.
3. Przypomnij sobie bramki z @.claude/spec-pipeline/constitution.md (C-50: check:migrations,
   check:actions, next build).

## Co masz zrobić — napisz `specs/NNN-slug/tasks.md` wg szablonu
- Kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z zależnościami**:
  migracja/schemat → Server Actions/RBAC → UI → AI/integracje → bramki/domknięcie.
- Każde zadanie: **małe, samodzielne, weryfikowalne** — z jasnym „gotowe, gdy…". Numeruj `T-1`, `T-2`, …
- Zaznacz `[P]` przy zadaniach, które można robić równolegle (niezależne pliki).
- **Wpnij bramki jako realne kroki**: `npm run check:migrations` po migracji, `npm run check:actions`
  po dodaniu `AIAction`, `next lint` + `next build` (lokalny Postgres — C-13) na końcu.
- **Dopnij mapowanie kryteriów akceptacji** ze speca do zadań, żeby żaden AC nie został bez pokrycia.
- Ostatnie zadanie fazy domknięcia: wpis do `doświadczenia.md` jeśli pojawi się nieoczywisty problem (C-51).

## Zasady
- Nie dokładaj zadań spoza planu (C-53). Jeśli plan czegoś nie pokrywa, a jest potrzebne — najpierw
  zaktualizuj `plan.md`, potem wypisz zadanie.
- Granulacja: jedno zadanie ≈ jeden spójny commit. Za duże → rozbij; trywialne → połącz.

## Na koniec — automatyczne przejście dalej
Wypisz ścieżkę `tasks.md`, liczbę zadań i faz oraz ścieżkę krytyczną (co blokuje co). Następnie
**nie czekaj na użytkownika** — od razu przejdź do etapu 4, wywołując skill **`implement`**
(narzędzie Skill) z argumentem `specs/NNN-slug`.
