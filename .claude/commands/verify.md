---
description: Etap 5 SDD — zweryfikuj implementację względem kryteriów akceptacji (specs/NNN-slug/verify.md)
argument-hint: <specs/NNN-slug | slug>
---

Jesteś na **etapie 5 (VERIFY)** spec-driven pipeline'u Omnia. Sprawdzasz, czy implementacja **realnie
spełnia** kryteria akceptacji ze speca i przechodzi bramki jakości. To weryfikacja **zachowania**, nie
tylko „czy się kompiluje".

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
- Jeśli werdykt to „DO POPRAWY" — wypisz konkretne braki jako zadania do dopisania w `tasks.md` i
  zaproponuj powrót do `/implement`. Nie „naprawiaj po cichu" w ramach verify.

## Na koniec
Wypisz werdykt i zdanie: **„Następny krok: `/review specs/NNN-slug`"** (jeśli GOTOWE) albo
**„Wróć do `/implement` — braki: …"** (jeśli DO POPRAWY).
