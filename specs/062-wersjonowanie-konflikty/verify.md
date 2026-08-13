# Weryfikacja: wersjonowanie — zadanie 15 (mechanizm + pilot)

Data: 2026-08-13

| Bramka | Wynik |
|--------|-------|
| komplet bramek | ✅ **160 / 551 / 35 / 35** bez spadku |
| `check:migrations` · `check:schema-drift` | ✅ 0232 wolny · ✅ brak rozjazdu |
| **`check:versioning`** | ✅ 2 modele z wersją, 2 pliki zapisujące, manifest pusty |
| `check:test-types` · `tsc --noEmit` | ✅ · ✅ |
| `test:unit` | ✅ **727/727** (było 719 — siedem asercji mechanizmu) |
| `npm run build` | ✅ **exit 0**, 24 bramki |

## Kryteria akceptacji

**AC-1** ✅ zapis z aktualną wersją przechodzi, wersja 0→1. **AC-2** ✅ **kluczowy**: dwie osoby na
tej samej wersji → jeden sukces, jeden `ConflictError`, a w bazie zostaje treść **pierwszej**.
Przed 062 obie kończyły się sukcesem. **AC-3** ✅ brak rekordu daje `MissingRecordError`, nie
konflikt. **AC-4** ✅ zapis bez podanej wersji działa jak dotąd (wersja i tak rośnie).
**AC-5** ✅ bramka wskazała oba pliki; zbiór modeli czytany ze schematu, więc następny model obejmie
sama. **AC-6** ✅ liczniki, dziennikowe i zasoby jednego użytkownika bez kolumny — powód
w nagłówku migracji. **AC-7** ✅ · **AC-8** ✅ dziennik.

## Regresje

- **`updateTask`/`updateNote` zwracają teraz rekord z osobnego odczytu** (`findUniqueOrThrow`),
  bo `updateMany` nie zwraca wiersza. Kształt zwracanej wartości bez zmian — te same `include`.
  Koszt: jedno dodatkowe zapytanie na edycję, świadomie przyjęte za odróżnialność konfliktu.
- **Domykanie zadania cyklicznego** nie podaje wersji — to zapis systemowy, nie edycja
  użytkownika; nazwane w komentarzu.

## Werdykt

**GOTOWE.** Osiem z ośmiu kryteriów, build exit 0.
