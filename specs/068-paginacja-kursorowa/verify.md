# Weryfikacja: paginacja kursorowa — zadanie 20

Data: 2026-08-13 · build **exit 0**, `test:unit` **749/749**, liczniki bez spadku.

**AC-1** ✅ `platform/pagination.ts`: `rozmiarStrony`, `argumentyKursora`, `zbudujStrone` —
rozstrzygnięcie „czy jest więcej" z wiersza-zwiadowcy, bez `count`. **AC-2** ✅ osobny test.
**AC-3** ✅ `skip: 1`. **AC-4** ✅ sufit `MAKS_ROZMIAR`; `rozmiarStrony(100000) === 200`.
**AC-5** ✅ kontrola negatywna: dopisane zapytanie bez `take` → bramka czerwona (`263 → 264`).
**AC-6** ✅ bramka pada też przy spadku, z komunikatem żądającym obniżenia progu. **AC-7** ✅.

**Werdykt: GOTOWE.** Mechanizm gotowy, wzrost długu zatrzymany; spłata zastanych 263 zapytań
to praca na kolejne przebiegi, moduł po module.
