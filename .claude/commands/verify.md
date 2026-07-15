---
description: Etap 5 SDD — zweryfikuj implementację wobec kryteriów akceptacji i przejdź dalej (specs/NNN-slug/verify.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 5 (VERIFY)** spec-driven pipeline'u Omnia. Sprawdzasz, czy implementacja **realnie
spełnia** kryteria akceptacji ze speca i przechodzi bramki jakości. To weryfikacja **zachowania**, nie
tylko „czy się kompiluje". Pracujesz **autonomicznie** i sam decydujesz, czy przejść do `/review`, czy
zawrócić do `/implement`.

## Model interakcji
**Nie zadawaj pytań właścicielowi.** Jeśli AC jest niespełnione — nie pytaj, tylko zawróć pipeline do
`/implement` (patrz „Na koniec"). Raportuj natomiast bezwzględnie uczciwie: co przechodzi, co nie i
czego nie dało się sprawdzić.

## Wejście
Feature: **$ARGUMENTS**. Jeśli pusty — najnowszy katalog w `specs/` z odhaczonym `tasks.md`.

## Zanim zweryfikujesz
1. Przeczytaj `specs/NNN-slug/spec.md` (kryteria akceptacji AC-*) i `tasks.md` (co miało powstać).
2. Przypomnij bramki z @.claude/spec-pipeline/constitution.md (C-50).

## Co masz zrobić
1. **Bramki techniczne** — uruchom i zaraportuj wynik każdej:
   - `npm run check:migrations` i `npm run check:actions`
   - `next lint --dir src`
   - `next build` przeciw **lokalnemu** Postgresowi (C-13 — nigdy prod DB; jeśli brak lokalnej bazy,
     odnotuj to jako ograniczenie zamiast ruszać prod).
2. **Kryteria akceptacji** — przejdź AC po AC. Dla każdego opisz **jak** je sprawdziłeś (uruchomienie
   ścieżki w kodzie/UI, test, ręczne prześledzenie logiki) i werdykt: ✅ spełnione / ⚠️ częściowo /
   ❌ niespełnione. Nie zaliczaj AC „na oko" — wskaż dowód (plik:linia, zachowanie, output).
3. **Zgodność z konstytucją** — szybki przelot po `C-NN` istotnych dla feature'a; wypisz naruszenia.
4. **Regresje** — sprawdź, czy zmiany nie psują sąsiednich modułów (migracja, wspólne komponenty,
   `revalidatePath`, RBAC).

## Wyjście — zapisz `specs/NNN-slug/verify.md`
Sekcje: *Bramki* (tabela komenda→wynik), *Kryteria akceptacji* (AC → werdykt + dowód), *Zgodność z
konstytucją*, *Regresje*, *Werdykt końcowy* (GOTOWE / GOTOWE Z UWAGAMI / DO POPRAWY + lista braków).

## Zasady
- Raportuj uczciwie: jeśli coś nie przechodzi albo nie dało się sprawdzić — napisz to wprost z outputem.
- „Nie naprawiaj po cichu" w ramach verify — od poprawek jest `/implement`.

## Na koniec — automatyczne przejście dalej
- Jeśli werdykt to **DO POPRAWY**: wypisz braki jako konkretne zadania, **dopisz je do `tasks.md`**
  (odznaczone) i **od razu** wróć do etapu 4, wywołując skill **`implement`** (narzędzie Skill) z
  argumentem `specs/NNN-slug`. Nie czekaj na użytkownika. (Uważaj na zapętlenie: jeśli po ~2–3
  nawrotach ten sam brak dalej nie schodzi, zatrzymaj się i opisz, gdzie utknąłeś.)
- Jeśli werdykt to **GOTOWE / GOTOWE Z UWAGAMI**: **od razu** przejdź do etapu 6, wywołując skill
  **`review`** (narzędzie Skill) z argumentem `specs/NNN-slug`.
