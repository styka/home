# Weryfikacja: udostępnienia Zadań jako nadania — zadanie 12, etap 1

Spec: `spec.md` · Data: 2026-08-13

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| komplet bramek statycznych | ✅ **160 / 551 / 35 / 35** bez spadku |
| `check:migrations` | ✅ następny wolny numer 0230 |
| `check:schema-drift` | ✅ brak rozjazdu — migracja rusza **dane**, nie kształt |
| `check:workspace-mirror` · `check:workspace-fill` · `check:ownership-scope` | ✅ · ✅ 45/45 · ✅ 3 wyjątki |
| **`check:grant-mirror`** | ✅ 3 pliki mutujące, 1 świadomy wyjątek |
| `check:test-types` · `tsc --noEmit` | ✅ · ✅ |
| `test:unit` | ✅ **711/711** (było 701 — dziesięć asercji lustra) |
| `next lint` · `npm run build` | ✅ · ✅ **exit 0**, 23 bramki |

## 2. Kryteria akceptacji

**AC-1 — każde członkostwo i udostępnienie ma nadanie; powtórzenie nic nie zmienia.** ✅
Migracja 0229, trzy `INSERT … SELECT` z `ON CONFLICT DO NOTHING`. Powtórne uruchomienie na tej
samej bazie nie zmieniło liczby wierszy. **Zastrzeżenie uczciwe:** lokalna baza ma zero członkostw
i zero udostępnień, więc idempotencja jest sprawdzona, ale **kompletność na danych — nie**.
Pokrywa to test lustra, który tworzy własny fixture i przechodzi tę samą drogę co migracja.

**AC-2 — nadanie powstaje razem ze źródłem.** ✅ `mirrorProjectMember`/`mirrorTaskShare` wpięte
w trzy ścieżki zapisu; test sprawdza powstanie, awans i degradację.

**AC-3 — nadanie znika ze źródłem.** ✅ Dwie asercje (członkostwo, udostępnienie zespołowe).
Dodatkowo `purge.ts` kasuje nadania usuwanego konta — bez tego zostałyby w bazie, bo
`ResourceGrant` **nie ma klucza obcego do `User`**.

**AC-4 — odwzorowanie ról w jednym miejscu.** ✅ `resourceRoleFromLegacy`
(`platform/workspaces/types.ts`), używane przez kod; migracja SQL powtarza tę samą tabelę w `CASE`
i nagłówek migracji **nazywa tę zależność wprost**. Rola spoza słownika → `null`, nie „bezpieczny
domyślny".

**AC-5 — odczyty nietknięte.** ✅ `extraGrants` i dzisiejsze guardy bez zmian; tabela prawdy
z 052/056 przechodzi bez ruchu (`test:unit`). Nadania są zapisywane i **nieczytane**.

**AC-6 — bramka.** ✅ `check:grant-mirror` w `build`; złapała `purge.ts` **przy pierwszym
uruchomieniu**.

**AC-7 — bramki i build.** ✅ Tabela wyżej. **AC-8 — dziennik.** ✅ Wpis „059" z zakresem etapów
2 i 3 oraz zależnością `PetShare` → zadanie 13.

## 3. Werdykt

**GOTOWE Z UWAGAMI.** Osiem z ośmiu kryteriów; uwaga dotyczy AC-1: **kompletność backfillu na
prawdziwych danych nie została zmierzona**, bo lokalna baza jest pusta w tych tabelach. Zmierzy to
etap 2, który przed przełączeniem odczytów musi policzyć rozjazd tabela ↔ nadanie na produkcji.
Odnotowane jako warunek wejścia etapu 2, nie jako brak do naprawienia tutaj.
