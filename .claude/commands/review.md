---
description: Etap 6 SDD — recenzja diffa, werdykt, auto-merge do develop i pytanie o promocję do master (specs/NNN-slug/review.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 6 (REVIEW)** spec-driven pipeline'u Omnia — ostatnia bramka przed merge do `develop`.
Robisz **recenzję kodu** zmian feature'a: świeżym okiem, pod kątem poprawności i zgodności z konwencjami.
To **koniec** automatycznego przebiegu — sam wystawiasz werdykt i po APPROVE domykasz zadanie zgodnie ze
standing authorization, **bez czekania na approve właściciela**.

## Model interakcji (C-55, C-54)
**Werdykt wystawiasz sam — nie prosisz właściciela o approve.** Drobne, bezpieczne poprawki nanieś sam;
przy poważnych ustaleniach zawróć pipeline do `/implement` (patrz „Na koniec"), a jeśli defekt wynika z
błędnego speca/planu — powrót ma najpierw poprawić `spec.md`/`plan.md` (C-54). Furtka C-55 (jedno
zbiorcze pytanie) obowiązuje też tu, gdy trafisz na istotną, niejednoznaczną decyzję właściciela.
**Jedyne pytanie na tym etapie to obowiązkowe pytanie domykające o promocję `develop → master`** (patrz
„Na koniec") — zadaj je zawsze po udanym merge do `develop`. To ostatni etap — nie wywołujesz już
kolejnego skilla pipeline'u.

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
  2. Wypisz jednym akapitem podsumowanie całego przebiegu (spec → review) i co trafiło na środowisko
     testowe (`develop` → `worldofmag.onrender.com`).
  3. **Pytanie domykające (obowiązkowe, zawsze — C-52/C-55):** na sam koniec zadaj właścicielowi
     **jedno** pytanie `AskUserQuestion` o promocję na produkcję. Pytanie brzmi **dokładnie**:
     „Mistrzu Magu, czy zrobić merge develop do master?". Opcje (rekomendowana **pierwsza**, z etykietą
     `(zalecane)`):
     - **„Nie — zostaw na develop (zalecane)"** — najpierw sprawdź zmianę na środowisku testowym;
       `master` to produkcja (Render auto-deploy), promujemy dopiero po weryfikacji.
     - **„Tak — merge develop → master (produkcja)"** — od razu promuj na produkcję.
  4. Reakcja na odpowiedź:
     - **„Nie"** → koniec. Nic więcej nie pushujesz; napisz, że zmiana czeka na `develop`.
     - **„Tak"** → `git checkout master` → `git merge --no-ff develop` → `git push origin master`
       (z retry/backoff wg `CLAUDE.md`). To **jedyny** moment, w którym pipeline dotyka `master`, i
       tylko na wyraźne „Tak" (C-52). Potwierdź, że produkcja została zaktualizowana.
