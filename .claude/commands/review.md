---
description: Etap 6 SDD — recenzja diffa, werdykt i (po APPROVE) merge do develop (specs/NNN-slug/review.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 6 (REVIEW)** spec-driven pipeline'u Omnia — ostatnia bramka przed merge do `develop`.
Robisz **recenzję kodu** zmian feature'a: świeżym okiem, pod kątem poprawności i zgodności z konwencjami.
To **koniec** automatycznego przebiegu — po APPROVE domykasz zadanie zgodnie ze standing authorization.

## Model interakcji
**Nie zadawaj pytań właścicielowi.** Drobne, bezpieczne poprawki nanieś sam; przy poważnych ustaleniach
zawróć pipeline do `/implement` (patrz „Na koniec"). To ostatni etap — nie wywołuj już kolejnego skilla
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
  `tasks.md` i **od razu** wróć do etapu 4, wywołując skill **`implement`** (narzędzie Skill) z
  argumentem `specs/NNN-slug`. Nie czekaj na użytkownika.
- Jeśli werdykt to **APPROVE / APPROVE Z UWAGAMI**: domknij zadanie zgodnie ze **STANDING
  AUTHORIZATION** z `CLAUDE.md` — commit → merge brancha roboczego (`claude/*`) do `develop` → push
  `develop` (po zielonym buildzie; C-50/C-52). Nie pytaj o zgodę — to jest ta zgoda. Na końcu wypisz
  jednym akapitem podsumowanie całego przebiegu (spec → review) i co trafiło na środowisko testowe.
