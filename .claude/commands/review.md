---
description: Etap 6 SDD — recenzja diffa, werdykt i auto-merge do develop, a na końcu automatyczna promocja develop → master (specs/NNN-slug/review.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 6 (REVIEW)** spec-driven pipeline'u Omnia — ostatnia bramka przed merge do `develop`
i automatyczną promocją na produkcję (`master`). Robisz **recenzję kodu** zmian feature'a: świeżym
okiem, pod kątem poprawności i zgodności z konwencjami. To **koniec** automatycznego przebiegu — sam
wystawiasz werdykt i po APPROVE domykasz zadanie zgodnie ze standing authorization, **bez czekania na
approve właściciela i bez pytania o produkcję**.

## Model interakcji (C-55, C-54)
**Werdykt wystawiasz sam — nie prosisz właściciela o approve.** Drobne, bezpieczne poprawki nanieś sam;
przy poważnych ustaleniach zawróć pipeline do `/implement` (patrz „Na koniec"), a jeśli defekt wynika z
błędnego speca/planu — powrót ma najpierw poprawić `spec.md`/`plan.md` (C-54). Furtka C-55 (jedno
zbiorcze pytanie) obowiązuje też tu, gdy trafisz na istotną, niejednoznaczną decyzję właściciela.
**Na tym etapie nie ma już pytania domykającego** — właściciel z góry autoryzował automatyczną promocję
`develop → master` na koniec pipeline'u (C-52). To ostatni etap — nie wywołujesz już kolejnego skilla
pipeline'u.

## Wejście
Feature: **$ARGUMENTS**. Jeśli pusty — najnowszy katalog w `specs/` z `verify.md`.

## Zakres recenzji
1. Ustal diff feature'a: `git diff --stat` względem punktu startu (branch bazowy `develop`/`master`)
   oraz pełny `git diff`. Skup recenzję na tych zmianach.
2. Przeczytaj `spec.md` (intencja), `plan.md` (założenia), `verify.md` (co już sprawdzono) — żeby nie
   dublować i celować w to, co istotne.

## Na co patrzysz (priorytetowo)
- **Poprawność:** realne błędy — złe warunki brzegowe, brak `await`, wyścigi, złe guardy dostępu
  (C-21), brak `revalidatePath` (C-20), niespójność migracji ze `schema.prisma`, `AIAction` bez
  egzekutora (C-23). Dla każdego podaj **scenariusz awarii** (wejście → zły wynik).
- **Konwencje Omnia:** enumy Prisma zamiast `String`+union (C-12), hardcode kolorów zamiast zmiennych
  CSS (C-30), brak wariantu mobilnego (C-31), teksty nie-PL (C-32), praca poza `worldofmag/` (C-01).
- **Uproszczenia / reuse (C-53):** duplikacja zamiast użycia istniejącego helpera, nadmiarowe
  abstrakcje, martwy kod, nowe zależności bez potrzeby.
- **Bezpieczeństwo:** wyciek/log klucza (C-41), brak kontroli uprawnień na akcji, XSS w renderze
  markdown/HTML.

## Wyjście — zapisz `specs/NNN-slug/review.md`
Lista ustaleń posortowana **od najpoważniejszego**. Każde: *plik:linia*, kategoria
(correctness/convention/simplification/security), 1-zdaniowy opis, scenariusz awarii/skutku,
sugerowana poprawka. Na końcu **werdykt**: APPROVE / APPROVE Z UWAGAMI / ZMIANY WYMAGANE.

## Zasady
- Zgłaszaj tylko ustalenia, których jesteś realnie pewien — bez czepiania się stylu, który już panuje
  w repo. Fałszywy alarm kosztuje właściciela czas.
- Dla złożonego/wielomodułowego diffa możesz zlecić recenzję świeżym okiem subagentowi
  **omnia-reviewer** (Agent tool) i zebrać jego ustalenia tutaj.
- Możesz od razu nanieść **drobne, bezpieczne** poprawki (literówki, brakujący `revalidatePath`) i
  odnotować je.

## Na koniec — domknięcie
- Jeśli werdykt to **ZMIANY WYMAGANE**: wypisz konkretne poprawki, dopisz je jako zadania do
  `tasks.md` (a jeśli źródłem jest błędny spec/plan — najpierw popraw `spec.md`/`plan.md`, C-54) i
  **od razu** wróć do etapu 4, wywołując skill **`implement`** (narzędzie Skill) z argumentem
  `specs/NNN-slug`. Nie czekaj na użytkownika.
- Jeśli werdykt to **APPROVE / APPROVE Z UWAGAMI**:
  1. Domknij zadanie zgodnie ze **STANDING AUTHORIZATION** z `CLAUDE.md` — commit → merge brancha
     roboczego (`claude/*`) do `develop` → push `develop` (po zielonym buildzie; C-50/C-52). Nie pytaj
     o zgodę na to — to jest ta zgoda.
  2. **Automatyczna promocja `develop → master` (C-52) — bez pytania.** Właściciel z góry autoryzował
     merge na produkcję na koniec pipeline'u. Wykonaj to od razu po pushu `develop`, pod warunkiem
     APPROVE/APPROVE Z UWAGAMI i zielonego buildu (C-50):
     - `git fetch origin master` → `git checkout master`.
     - **Kontrola integralności (obowiązkowo, żeby nie cofnąć produkcji):**
       `git merge-base --is-ancestor origin/master develop` — jeśli **fałsz**, to `develop` nie zawiera
       aktualnej produkcji: **NIE merguj**, zawróć: zsynchronizuj (`git merge origin/master` do develop
       albo rebase) i dopiero wtedy promuj. Lokalny `master` zawsze ustaw z `origin/master`
       (`git reset --hard origin/master` na świeżo checkoutowanej gałęzi, jeśli tracking jest za nią).
     - `git merge --no-ff develop -m "Merge develop → master: <feature> [produkcja]"`.
     - Po merge ponownie potwierdź: `git merge-base --is-ancestor origin/master HEAD` (musi być prawda)
       oraz że HEAD dokłada tylko oczekiwane commity feature'a ponad `origin/master`.
     - `git push origin master` (z retry/backoff wg `CLAUDE.md`).
     - Jeśli którakolwiek kontrola integralności zawiedzie albo push odbije (np. równoległa zmiana na
       `master`) — **zatrzymaj się i zgłoś to właścicielowi** zamiast forsować `master`. To jedyny
       moment, w którym auto-promocja ustępuje.
  3. Wypisz jednym akapitem podsumowanie całego przebiegu (spec → review) oraz co trafiło na
     środowisko testowe (`develop` → `worldofmag.onrender.com`) **i na produkcję**
     (`master` → `omnia-prod.onrender.com`). Potwierdź, że produkcja została zaktualizowana. Koniec —
     bez pytania domykającego.
