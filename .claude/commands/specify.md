---
description: Etap 1 SDD — zamień pomysł na funkcję w specyfikację (specs/NNN-slug/spec.md)
argument-hint: <opis funkcji/pomysłu>
---

Jesteś na **etapie 1 (SPECIFY)** spec-driven pipeline'u Omnia. Twoim jedynym zadaniem jest zamienić
poniższy pomysł w **specyfikację produktową** — opisującą **CO** i **DLACZEGO**, nigdy **JAK**.

## Wejście
Pomysł / opis funkcji: **$ARGUMENTS**

## Zanim napiszesz spec
1. Przeczytaj reguły projektu: @CLAUDE.md oraz @.claude/spec-pipeline/constitution.md.
2. Wczytaj szablon: @.claude/spec-pipeline/templates/spec-template.md — to jest struktura wyjścia.
3. Rozejrzyj się po kodzie **tylko na tyle, by dobrze nazwać moduł i granice** (np. `src/lib/modules.tsx`,
   sąsiedni moduł). Nie projektuj implementacji.

## Co masz zrobić
1. **Ustal numer i slug.** Zajrzyj do `specs/` i weź kolejny wolny numer `NNN` (001, 002, …). Slug =
   krótki kebab-case. Utwórz katalog `specs/NNN-slug/`.
2. **Napisz `specs/NNN-slug/spec.md`** ściśle wg szablonu. Wypełnij **wszystkie** sekcje:
   - Problem/potrzeba, cel + miary sukcesu, historyjki użytkownika.
   - **Kryteria akceptacji** w formacie Given/When/Then — muszą być testowalne (użyje ich `/verify`).
   - Zakres i świadome „poza zakresem".
   - **Wpływ na Omnia**: uprawnienie/RBAC, własność danych (user vs user+team), czy dotyka asystenta
     AI, kalendarza, powiadomień, trasha.
   - **Zgodność z konstytucją**: wypisz kluczowe reguły `C-NN`.
   - **Otwarte pytania / decyzje właściciela** — jeśli coś jest niejednoznaczne, NIE zgaduj: dopisz
     pytanie do tej sekcji.
3. **Zero implementacji.** Żadnych nazw plików, tabel, endpointów, bibliotek. Jeśli łapiesz się na
   pisaniu „jak" — przenieś to w głowie do przyszłego `plan.md` i pomiń.

## Zasady
- Pisz po polsku, zwięźle, konkretnie. Każde kryterium akceptacji musi dać się zweryfikować.
- Jeśli pomysł jest za szeroki na jeden feature — zaproponuj podział i spec tylko pierwszej części
  (resztę wypisz w „poza zakresem").
- Jeśli są **twarde** niejasności blokujące sensowny spec, zadaj właścicielowi maksymalnie kilka
  pytań (`AskUserQuestion`) zanim zapiszesz plik.

## Na koniec
Wypisz: ścieżkę utworzonego `spec.md`, 3–5 zdaniowe streszczenie, listę otwartych pytań (jeśli są) i
zdanie: **„Następny krok: `/plan specs/NNN-slug`"**. Nie przechodź samodzielnie do planu.
