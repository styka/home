---
description: Etap 2 SDD — zamień spec w plan techniczny (specs/NNN-slug/plan.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 2 (PLAN)** spec-driven pipeline'u Omnia. Zamieniasz zatwierdzony spec w
**plan techniczny** — to jest **JAK**, ściśle pod istniejący kod i konwencje Omnia.

## Wejście
Feature: **$ARGUMENTS** (ścieżka `specs/NNN-slug` albo sam slug — jeśli podano tylko slug, znajdź katalog).
Jeśli argument pusty — weź najnowszy katalog w `specs/` bez `plan.md`.

## Zanim zaplanujesz
1. Przeczytaj `specs/NNN-slug/spec.md` — to kontrakt. Plan realizuje **wszystkie** kryteria akceptacji.
2. Przeczytaj @.claude/spec-pipeline/constitution.md i @CLAUDE.md (sekcje: Database & migrations,
   Server Actions, Auth/RBAC, Key Conventions, Build pipeline).
3. Wczytaj szablon: @.claude/spec-pipeline/templates/plan-template.md.
4. **Przeczytaj sąsiedni, najbardziej podobny moduł w kodzie** i naśladuj jego wzorzec (C-53).
   Konkretnie sprawdź: analogiczny plik w `src/actions/`, `src/app/<moduł>/`, `src/components/<moduł>/`,
   wpis w `src/lib/modules.tsx` i `src/lib/permissions.ts`. Nie wymyślaj nowych wzorców, jeśli istnieje utarty.

## Co masz zrobić — napisz `specs/NNN-slug/plan.md` wg szablonu, jawnie adresując:
- **Model danych + migracja (C-10, C-11, C-12):** modele/kolumny (statusy jako `String`+union, NIE enum),
  numer z `npm run next:migration`, szkic DDL. Jeśli bez zmian schematu — napisz to wprost.
- **Server Actions (C-20):** pliki, funkcje, `revalidatePath`, guard dostępu i własność `ownerId`/`ownerTeamId` (C-21).
- **RBAC / rejestr (C-22):** istniejący slug czy nowy; wpięcia `permissions.ts` / `modules.tsx` / `ModuleSidebar`.
- **UI (C-30, C-31, C-32):** trasy, komponenty, zmienne CSS, mobile `hidden md:flex` + tab bar, teksty PL.
- **AI/integracje (C-23, C-40):** nowe `AIAction` + egzekutor, read-tool, kalendarz/powiadomienia.
- **Tabela plików do utworzenia/zmiany.**
- **Bramki i weryfikacja (C-50):** jak lokalnie (lokalny Postgres, C-13), mapowanie AC → sposób sprawdzenia.
- **Ryzyka + rollback**, oraz **checklista zgodności z konstytucją**.

## Zasady
- Plan ma być na tyle konkretny, że `/tasks` rozbije go na kroki bez dopytywania.
- Preferuj minimalizm (C-53): najmniejszy zestaw zmian realizujący spec. Zero nowych zależności bez uzasadnienia.
- Jeśli podczas planowania wyjdzie, że spec ma lukę/sprzeczność — **zatrzymaj się**, dopisz to do sekcji
  otwartych pytań w `spec.md` i zasygnalizuj właścicielowi zamiast zgadywać.
- Możesz zlecić głębszy rekonesans architektury subagentowi **omnia-planner** (Agent tool), jeśli feature
  jest złożony i dotyka wielu modułów.

## Na koniec
Wypisz ścieżkę `plan.md`, najważniejsze decyzje techniczne (3–6 punktów), ryzyka i zdanie:
**„Następny krok: `/tasks specs/NNN-slug`"**. Nie zaczynaj implementacji.
