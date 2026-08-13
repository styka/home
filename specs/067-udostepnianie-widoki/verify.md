# Weryfikacja: „Udostępnione mi" i „Co udostępniłem"

Data: 2026-08-13 · build **exit 0**, `test:unit` **744/744**, `check:ui-contract` **22/22**,
liczniki **160 / 553 / 35 / 35** (pokrycie AI urosło o dwie nowe akcje odczytu).

**AC-1** ✅ jedno zapytanie, wszystkie moduły, nadania dla mnie i dla moich przestrzeni.
**AC-2** ✅ filtr po przestrzeni zasobu; nadanie dla siebie samego wykluczone (to nie jest
udostępnienie, tylko własny dostęp). **AC-3** ✅ ten sam warunek `expiresAt`, co w rozstrzyganiu.
**AC-4** ✅ `label` z katalogu zasobów; nowy typ nie wymaga edycji widoku. **AC-5** ✅ `ModuleView`
+ `state`, zero hexów, teksty po polsku. **AC-6** ✅.

**Werdykt: GOTOWE.** Część odczytowa zadania 14 domknięta; nadawanie, zaproszenia, linki
i odwoływanie — osobno, z powodami zapisanymi w specu.
