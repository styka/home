---
description: Etap 4 SDD — wykonaj zadania z tasks.md i przejdź automatycznie do weryfikacji
argument-hint: <specs/NNN-slug | slug | konkretne T-n>
---

Jesteś na **etapie 4 (IMPLEMENT)** spec-driven pipeline'u Omnia. Realizujesz zadania z `tasks.md` —
kod, migracje, testy — **ściśle wg planu i konstytucji**, odhaczając postęp na bieżąco. Pracujesz
**autonomicznie** i po domknięciu wszystkich zadań **sam uruchamiasz `/verify`**.

## Model interakcji (C-55) i spójność artefaktów (C-54)
Decyzje właściciela zebrano na etapie `/specify` — **domyślnie nie pytasz**. Gdy w trakcie kodowania
trafisz na wybór nieprzewidziany w planie, wybierz opcję **rekomendowaną** (wzorzec sąsiedniego modułu,
minimalizm C-53) i **kontynuuj**.

**Gdy odkryjesz, że wcześniejszy artefakt jest błędny/niepełny (C-54):** nie „obchodź" tego w kodzie.
Zaktualizuj **dotknięty artefakt** — `plan.md` (gdy plan się nie broni) i/lub `spec.md` (gdy zmienia
się zakres lub kryterium akceptacji) — a potem **przelicz w dół** zadania w `tasks.md`, żeby kod, plan
i spec się zgadzały. Zostaw krótki ślad zmiany.

**Furtka (C-55):** jeśli wypłynie decyzja istotna dla właściciela, nie do przewidzenia na `/specify`,
kosztowna przy złym wyborze i nierozstrzygalna z artefaktów/kodu/konwencji — **wolno** zadać jedno
zbiorcze `AskUserQuestion` (rekomendowana pierwsza + `(zalecane)`) zamiast zgadywać, zaktualizować
artefakty po odpowiedzi (C-54) i jechać dalej. Zatrzymaj się bezwarunkowo tylko przy realnym ryzyku
nieodwracalnej szkody (utrata danych, prod DB).

## Wejście
Feature: **$ARGUMENTS**. Jeśli pusty — najnowszy katalog w `specs/` z `tasks.md`. Jeśli podano
konkretne `T-n`, zrób tylko je; inaczej jedź od pierwszego nieodhaczonego.

## Zanim ruszysz
1. Przeczytaj `specs/NNN-slug/tasks.md`, `plan.md` i `spec.md`.
2. Przeczytaj @.claude/spec-pipeline/constitution.md — to twarde reguły, nie sugestie.
3. Upewnij się, że pracujesz w `worldofmag/` (C-01) i na branchu roboczym (`claude/*`), nie na `master`.

## Jak realizować
- **Jedno zadanie na raz, w kolejności z `tasks.md`.** Po każdym: zaktualizuj `tasks.md`
  (`[ ]`→`[~]`→`[x]`) i utrzymuj listę jako żywy stan.
- **Naśladuj istniejący kod** (C-53): zanim napiszesz plik, przeczytaj analogiczny w sąsiednim module i
  dopasuj styl, nazwy, idiomy. Bez nowych zależności i abstrakcji ponad to, czego wymaga plan.
- **Migracje (C-10, C-11):** ręczny plik pod `prisma/migrations/<NNNN_slug>/migration.sql`; numer z
  `npm run next:migration`; po dodaniu odpal `npm run check:migrations`. Zsynchronizuj `schema.prisma`.
  **Nie** odpalaj builda/migrate.js przeciw prod DB (C-13) — lokalnie użyj lokalnego Postgresa.
- **Server Actions (C-20):** `revalidatePath` na końcu; guard dostępu i własność `ownerId`/`ownerTeamId` (C-21).
- **AI (C-23):** dodając `AIAction` od razu dopisz egzekutor w `/api/llm/home/execute`; sprawdź
  `npm run check:actions`.
- **UI (C-30..C-32):** tylko zmienne CSS, mobile `hidden md:flex` + tab bar, teksty PL.
- **Commituj po każdym ukończonym zadaniu** opisowym komunikatem (co i po co). Trzymaj się branchy z CLAUDE.md.

## Bramki
- Po fazie danych: `npm run check:migrations`. Po zmianach AI: `npm run check:actions`.
- Na końcu (lub gdy `tasks.md` domknięte): `next lint --dir src` + `next build` przeciw **lokalnemu**
  Postgresowi. Napraw wszystko na czerwono zanim uznasz zadanie za zrobione.
- Jeśli po drodze rozwiążesz nieoczywisty problem → wpis do `doświadczenia.md` (C-51) razem z fixem.

## Na koniec — automatyczne przejście dalej
Podsumuj: które `T-n` zrobione i stan bramek (lint/build). Następnie **nie czekaj na użytkownika** —
od razu przejdź do etapu 5, wywołując skill **`verify`** (narzędzie Skill) z argumentem
`specs/NNN-slug`. (Jeśli świadomie robisz tylko wyodrębnione `T-n`, a lista nie jest domknięta —
napisz to i dopiero wtedy nie przechodź dalej.)
