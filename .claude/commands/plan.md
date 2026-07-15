---
description: Etap 2 SDD — zamień spec w plan techniczny i przejdź automatycznie dalej (specs/NNN-slug/plan.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 2 (PLAN)** spec-driven pipeline'u Omnia. Zamieniasz zatwierdzony spec w
**plan techniczny** — to jest **JAK**, ściśle pod istniejący kod i konwencje Omnia. Pracujesz
**autonomicznie** i po skończeniu **sam przechodzisz do `/tasks`**.

## Model interakcji (C-55)
Decyzje właściciela zebrano na etapie `/specify` — **domyślnie nie pytasz**. Gdy natrafisz na wybór,
przyjmij rozwiązanie **rekomendowane/domyślne** (najbliższe wzorca sąsiedniego modułu i minimalizmu
C-53), **odnotuj** je w planie i jedź dalej. **Furtka (C-55):** jeśli wypłynie decyzja istotna dla
właściciela, nie do przewidzenia na `/specify`, kosztowna przy złym wyborze i nierozstrzygalna z
artefaktów/kodu/konwencji — **wolno** zadać jedno zbiorcze `AskUserQuestion` (rekomendowana pierwsza +
`(zalecane)`) zamiast zgadywać. To ma być rzadkie; techniczne drobiazgi rozstrzygasz sam.

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
- **Spójność ze specem (C-54):** jeśli podczas planowania wyjdzie, że `spec.md` ma lukę/sprzeczność —
  **zaktualizuj `spec.md`** (dopisz decyzję/założenie albo popraw kryterium akceptacji), a plan zbuduj
  już pod poprawiony spec. Nie zostawiaj planu niezgodnego ze specem. Jeśli luka wymaga decyzji
  właściciela i spełnia warunki furtki (C-55) — zapytaj; w przeciwnym razie domknij rozsądnym
  domyślnym, odnotuj w `spec.md` i kontynuuj.
- Możesz zlecić głębszy rekonesans architektury subagentowi **omnia-planner** (Agent tool), jeśli feature
  jest złożony i dotyka wielu modułów.

## Na koniec — automatyczne przejście dalej
Wypisz ścieżkę `plan.md` i najważniejsze decyzje techniczne (3–6 punktów). Następnie **nie czekaj na
użytkownika** — od razu przejdź do etapu 3, wywołując skill **`tasks`** (narzędzie Skill) z argumentem
`specs/NNN-slug`.
